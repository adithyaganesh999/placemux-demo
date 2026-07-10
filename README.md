# PlaceMux Backend Microservices Architecture

This is the complete containerized microservices backend skeleton for the PlaceMux platform. It adheres to the design architecture containing an API Gateway and four distinct gRPC microservices.

## 🏗️ Architecture & Network Layout

```
                  ┌───────────────────────┐
                  │    React Frontend     │ (hub.placemux.com)
                  └───────────┬───────────┘
                              │ HTTP / HTTPS
                              ▼
                  ┌───────────────────────┐
                  │      API Gateway      │ (Port 3000)
                  └─────┬───┬───┬───┬─────┘
                        │   │   │   │
        ┌───────────────┘   │   │   └────────────────┐
   gRPC │              gRPC │   │ gRPC               │ gRPC
        ▼                   ▼   ▼                    ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ Auth Service  │ │Company Service│ │Interview Serv.│ │ Admin Service │
│ (Port 3001)   │ │ (Port 3002)   │ │ (Port 3005)   │ │ (Port 3006)   │
│ gRPC: 5001    │ │ gRPC: 5002    │ │ gRPC: 5003    │ │ gRPC: 5006    │
└───────┬───────┘ └───────┬───────┘ └───────┬───────┘ └───────────────┘
        │                 │                 │
        ▼                 ▼                 ▼
   [auth_db]        [company_db]     [interview_db]   ◄── Neon PostgreSQL
```

- **Docker Network**: All services communicate internally via the custom Docker network `placemux-network`.
- **Database Layer**: Neon Postgres is mocked locally using a PostgreSQL docker container configured to seed multiple databases: `auth_db`, `company_db`, and `interview_db`.
- **Caching Layer**: Redis (Port 6379) serves as a session/access cache for the Auth Service.

---

## 📂 Project Directory Structure

```
placemux/
├── protos/
│   ├── auth.proto            # Auth service interface
│   ├── company.proto         # Company service interface
│   ├── interview.proto       # Interview scheduling interface
│   └── admin.proto           # Admin service interface
├── database/
│   └── init.sql              # Seeds databases auth_db, company_db, and interview_db
├── gateway/
│   ├── server.js             # REST Gateway to gRPC Mapper
│   ├── package.json
│   └── Dockerfile
├── services/
│   ├── auth/
│   │   ├── server.js         # Auth gRPC server & Redis token cache
│   │   ├── db.js             # auth_db Postgres Pool
│   │   ├── package.json
│   │   └── Dockerfile
│   ├── company/
│   │   ├── server.js         # Company gRPC server
│   │   ├── db.js             # company_db Postgres Pool
│   │   ├── package.json
│   │   └── Dockerfile
│   ├── interview/
│   │   ├── server.js         # Interview gRPC server
│   │   ├── db.js             # interview_db Postgres Pool
│   │   ├── package.json
│   │   └── Dockerfile
│   └── admin/
│       ├── server.js         # Admin gRPC server aggregates DB metrics
│       ├── package.json
│       └── Dockerfile
├── docker-compose.yml        # Main orchestration descriptor
├── .env                      # Unified environment variables
└── README.md                 # Project guide
```

---

## ⚡ Quick Start: Running with Docker Compose

Running the entire stack requires Docker and Docker Compose.

### 1. Build and Start All Services
```bash
docker compose up --build -d
```

### 2. Verify System Health
Check that all services are online:
```bash
# Check overall gateway dependency binding
curl http://localhost:3000/health

# Check specific service health statuses
curl http://localhost:3001/health  # Auth Service
curl http://localhost:3002/health  # Company Service
curl http://localhost:3005/health  # Interview Service
curl http://localhost:3006/health  # Admin Service
```

### 3. Tear Down the Stack
```bash
docker compose down -v
```

---

## 📡 API Reference & Integration Flow

The API Gateway handles REST requests and translates them internally to microservices gRPC transactions.

### Authentication Endpoints

#### Register a user
- **Method**: `POST`
- **Path**: `/api/auth/register`
- **Body**:
  ```json
  {
    "email": "dev@placemux.com",
    "password": "password123",
    "name": "Developer"
  }
  ```

#### Login (Obtain JWT)
- **Method**: `POST`
- **Path**: `/api/auth/login`
- **Body**:
  ```json
  {
    "email": "candidate@placemux.com",
    "password": "password123"
  }
  ```
- **Response**: Returns a JSON object containing a `token` (JWT). Use this token in the header of protected requests: `Authorization: Bearer <JWT_TOKEN>`.

---

### Company Endpoints

#### Create a company (Protected)
- **Method**: `POST`
- **Path**: `/api/company`
- **Body**:
  ```json
  {
    "name": "Apple",
    "industry": "Consumer Electronics",
    "description": "Think Different."
  }
  ```

#### List Companies
- **Method**: `GET`
- **Path**: `/api/company`

---

### Interview Endpoints

#### Schedule an Interview (Protected)
- **Method**: `POST`
- **Path**: `/api/interview`
- **Body**:
  ```json
  {
    "company_id": "1",
    "scheduled_time": "2026-09-01T10:00:00Z",
    "role": "Systems Engineer"
  }
  ```

#### List My Scheduled Interviews (Protected)
- **Method**: `GET`
- **Path**: `/api/interview`

---

### Admin Stats Endpoint

#### Fetch System Overview Metrics
- **Method**: `GET`
- **Path**: `/api/admin/stats`
- **Response**:
  ```json
  {
    "total_users": 2,
    "total_companies": 3,
    "total_interviews": 2
  }
  ```

---

## 🌐 Production Deployment (AWS & Neon Postgres)

The production stack configuration is defined in [docker-compose.prod.yml](file:///C:/Users/adith/OneDrive/Desktop/micro/docker-compose.prod.yml) and automated via GitHub Actions:

1. **GitHub Actions CI/CD**:
   * On pushes to `main`, `.github/workflows/deploy.yml` builds all 6 microservice and frontend Docker images.
   * Logs into your private **Amazon ECR** registry and pushes the built images.
   * Establishes a secure SSH connection to your **AWS EC2** instance (`3.110.157.187`) to log into ECR, pull the latest images, and launch the stack.
2. **Nginx Reverse Proxy**:
   * The frontend container is built using a multi-stage Nginx setup.
   * Nginx serves the React dashboard on port `5173` and automatically reverse-proxies `/api/*` requests to the `api-gateway` container internally on the private Docker network, bypassing CORS and port exposure.
3. **Serverless Neon PostgreSQL**:
   * The production database is serverless Neon PostgreSQL. The local `postgres` container is removed, and services connect directly to Neon over SSL.
4. **Local Redis Cache**:
   * A local production-grade `redis` cache container is started on the EC2 host to manage access tokens for `auth-service` securely.
