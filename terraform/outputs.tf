output "ec2_public_ip" {
  description = "Public IP address of the deployed EC2 server"
  value       = aws_instance.placemux_server.public_ip
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.placemux_alb.dns_name
}
