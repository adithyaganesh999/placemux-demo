# 1. Fetch Latest Ubuntu 22.04 AMI dynamically from AWS
data "aws_ami" "ubuntu" {
  most_recent = true
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
  owners = ["099720109477"] # Canonical owner ID
}

# 2. Create the Virtual Private Cloud (VPC)
resource "aws_vpc" "placemux_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "placemux-vpc"
  }
}

# 3. Create the Internet Gateway (Allows public subnets to talk to the Internet)
resource "aws_internet_gateway" "placemux_igw" {
  vpc_id = aws_vpc.placemux_vpc.id

  tags = {
    Name = "placemux-igw"
  }
}

# 4. Create 2 Public Subnets (For Load Balancer & public-facing EC2)
resource "aws_subnet" "public_subnets" {
  count                   = length(var.public_subnets)
  vpc_id                  = aws_vpc.placemux_vpc.id
  cidr_block              = var.public_subnets[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "placemux-public-subnet-${count.index + 1}"
  }
}

# 5. Create 2 Private Subnets (For secure database and internal workloads)
resource "aws_subnet" "private_subnets" {
  count             = length(var.private_subnets)
  vpc_id            = aws_vpc.placemux_vpc.id
  cidr_block        = var.private_subnets[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "placemux-private-subnet-${count.index + 1}"
  }
}

# 6. Create Route Table for Public Subnets (Point 0.0.0.0/0 to Internet Gateway)
resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.placemux_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.placemux_igw.id
  }

  tags = {
    Name = "placemux-public-rt"
  }
}

# 7. Associate the 2 Public Subnets with the Public Route Table
resource "aws_route_table_association" "public_assoc" {
  count          = length(var.public_subnets)
  subnet_id      = aws_subnet.public_subnets[count.index].id
  route_table_id = aws_route_table.public_rt.id
}

# 8. Create Security Group for the Application Load Balancer (ALB)
resource "aws_security_group" "alb_sg" {
  name        = "placemux-alb-sg"
  description = "Allow public web traffic to ALB"
  vpc_id      = aws_vpc.placemux_vpc.id

  # Allow HTTP traffic from the public internet
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "placemux-alb-sg"
  }
}

# 9. Create Security Group for the EC2 Host Server
resource "aws_security_group" "ec2_sg" {
  name        = "placemux-ec2-sg"
  description = "Access rules for EC2 host"
  vpc_id      = aws_vpc.placemux_vpc.id

  # Allow SSH access from anywhere (for administration)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow web traffic ONLY from the Application Load Balancer
  ingress {
    from_port       = 5173
    to_port         = 5173
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id] # Source must be the ALB
  }

  # Allow access to Grafana Monitoring Dashboard
  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow all outbound traffic (so containers can pull updates & connect to Neon)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "placemux-ec2-sg"
  }
}

# 10. Create the Application Load Balancer (ALB)
resource "aws_lb" "placemux_alb" {
  name               = "placemux-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = aws_subnet.public_subnets[*].id # Associated with both public subnets

  tags = {
    Name = "placemux-alb"
  }
}

# 11. Create the Target Group (Tells ALB to send requests to Port 5173 on the host)
resource "aws_lb_target_group" "placemux_tg" {
  name     = "placemux-tg"
  port     = 5173
  protocol = "HTTP"
  vpc_id   = aws_vpc.placemux_vpc.id

  # Health check rules: ALB queries "/" on port 5173 to verify Nginx is online
  health_check {
    path                = "/"
    port                = "5173"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 3
    unhealthy_threshold = 3
  }
}

# 12. Create the ALB Listener (Listens on port 80 and routes to the Target Group)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.placemux_alb.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.placemux_tg.arn
  }
}

# 13. Create the EC2 Instance
resource "aws_instance" "placemux_server" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  key_name                    = var.key_name
  subnet_id                   = aws_subnet.public_subnets[0].id
  vpc_security_group_ids      = [aws_security_group.ec2_sg.id]
  associate_public_ip_address = true

  # User Data Script runs automatically as Root on first boot
  user_data = <<-EOF
              #!/bin/bash
              # 1. Update OS packages and install AWS CLI
              apt-get update -y
              apt-get install -y apt-transport-https ca-certificates curl software-properties-common gnupg lsb-release awscli

              # 2. Configure 2GB Swap space (crucial for running 12 containers on 2GB RAM)
              fallocate -l 2G /swapfile
              chmod 600 /swapfile
              mkswap /swapfile
              swapon /swapfile
              echo '/swapfile none swap sw 0 0' >> /etc/fstab

              # 3. Add Docker official GPG key
              curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

              # 4. Set up Docker stable repository
              echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
              $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

              # 5. Install Docker Engine
              apt-get update -y
              apt-get install -y docker-ce docker-ce-cli containerd.io

              # 6. Install Docker Compose V2 plugin
              mkdir -p /usr/local/lib/docker/cli-plugins
              curl -SL https://github.com/docker/compose/releases/download/v2.24.1/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose
              chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

              # 7. Add default user to docker group and enable service
              usermod -aG docker ubuntu
              systemctl enable docker
              systemctl start docker
              EOF

  tags = {
    Name = "placemux-production-server"
  }
}

# 14. Attach the EC2 Instance to the Load Balancer Target Group
resource "aws_lb_target_group_attachment" "placemux_attachment" {
  target_group_arn = aws_lb_target_group.placemux_tg.arn
  target_id        = aws_instance.placemux_server.id
  port             = 5173
}