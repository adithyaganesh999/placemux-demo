const path = require('path');
const express = require('express');
const cors = require('cors');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
require('dotenv').config();

const HTTP_PORT = process.env.GATEWAY_PORT || 3000;

// Host addresses for services (default to localhost, override with env in docker-compose)
const AUTH_SERVICE_ADDR = process.env.AUTH_SERVICE_ADDR || 'localhost:5001';
const COMPANY_SERVICE_ADDR = process.env.COMPANY_SERVICE_ADDR || 'localhost:5002';
const INTERVIEW_SERVICE_ADDR = process.env.INTERVIEW_SERVICE_ADDR || 'localhost:5003';
const ADMIN_SERVICE_ADDR = process.env.ADMIN_SERVICE_ADDR || 'localhost:5006';

// Helper to load gRPC protos
function loadGrpcService(protoFileName, packageName, serviceName, address) {
  const PROTO_PATH = path.resolve(__dirname, `../protos/${protoFileName}`);
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const protoPackage = grpc.loadPackageDefinition(packageDefinition)[packageName];
  return new protoPackage[serviceName](address, grpc.credentials.createInsecure());
}

// Instantiate gRPC Clients
const authClient = loadGrpcService('auth.proto', 'auth', 'AuthService', AUTH_SERVICE_ADDR);
const companyClient = loadGrpcService('company.proto', 'company', 'CompanyService', COMPANY_SERVICE_ADDR);
const interviewClient = loadGrpcService('interview.proto', 'interview', 'InterviewService', INTERVIEW_SERVICE_ADDR);
const adminClient = loadGrpcService('admin.proto', 'admin', 'AdminService', ADMIN_SERVICE_ADDR);

const app = express();
app.use(cors());
app.use(express.json());

// Logger Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  authClient.ValidateToken({ token }, (err, response) => {
    if (err || !response || !response.valid) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = {
      id: response.id,
      email: response.email,
      name: response.name
    };
    next();
  });
};

// ================= AUTH ROUTES =================

app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;
  authClient.Register({ email, password, name }, (err, response) => {
    if (err) {
      console.error('gRPC Register Error:', err);
      const code = err.code === grpc.status.ALREADY_EXISTS ? 409 : 500;
      return res.status(code).json({ error: err.message });
    }
    res.status(201).json(response);
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  authClient.Login({ email, password }, (err, response) => {
    if (err) {
      console.error('gRPC Login Error:', err);
      const code = err.code === grpc.status.UNAUTHENTICATED ? 401 : (err.code === grpc.status.NOT_FOUND ? 404 : 500);
      return res.status(code).json({ error: err.message });
    }
    res.status(200).json(response);
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.status(200).json({ user: req.user });
});

// ================= COMPANY ROUTES =================

app.post('/api/company', authenticateToken, (req, res) => {
  const { name, industry, description } = req.body;
  companyClient.CreateCompany({ name, industry, description }, (err, response) => {
    if (err) {
      console.error('gRPC CreateCompany Error:', err);
      const code = err.code === grpc.status.ALREADY_EXISTS ? 409 : 500;
      return res.status(code).json({ error: err.message });
    }
    res.status(201).json(response);
  });
});

app.get('/api/company/:id', (req, res) => {
  const { id } = req.params;
  companyClient.GetCompany({ id }, (err, response) => {
    if (err) {
      console.error('gRPC GetCompany Error:', err);
      const code = err.code === grpc.status.NOT_FOUND ? 404 : 500;
      return res.status(code).json({ error: err.message });
    }
    res.status(200).json(response);
  });
});

app.get('/api/company', (req, res) => {
  companyClient.ListCompanies({}, (err, response) => {
    if (err) {
      console.error('gRPC ListCompanies Error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.status(200).json(response.companies || []);
  });
});

// ================= INTERVIEW ROUTES =================

app.post('/api/interview', authenticateToken, (req, res) => {
  const { company_id, scheduled_time, role } = req.body;
  interviewClient.ScheduleInterview({
    candidate_id: req.user.id,
    company_id,
    scheduled_time,
    role
  }, (err, response) => {
    if (err) {
      console.error('gRPC ScheduleInterview Error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json(response);
  });
});

app.get('/api/interview/:id', (req, res) => {
  const { id } = req.params;
  interviewClient.GetInterview({ id }, (err, response) => {
    if (err) {
      console.error('gRPC GetInterview Error:', err);
      const code = err.code === grpc.status.NOT_FOUND ? 404 : 500;
      return res.status(code).json({ error: err.message });
    }
    res.status(200).json(response);
  });
});

app.get('/api/interview', authenticateToken, (req, res) => {
  // Query interviews for the logged-in candidate
  interviewClient.ListInterviews({ candidate_id: req.user.id }, (err, response) => {
    if (err) {
      console.error('gRPC ListInterviews Error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.status(200).json(response.interviews || []);
  });
});

// ================= ADMIN ROUTES =================

app.get('/api/admin/stats', (req, res) => {
  adminClient.GetSystemStats({}, (err, response) => {
    if (err) {
      console.error('gRPC GetSystemStats Error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.status(200).json(response);
  });
});

// ================= SYSTEM HEALTH ROUTE =================

app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'API Gateway',
    status: 'UP',
    dependencies: {
      auth_service: AUTH_SERVICE_ADDR,
      company_service: COMPANY_SERVICE_ADDR,
      interview_service: INTERVIEW_SERVICE_ADDR,
      admin_service: ADMIN_SERVICE_ADDR
    }
  });
});

app.listen(HTTP_PORT, () => {
  console.log(`API Gateway HTTP server running on port: ${HTTP_PORT}`);
});
