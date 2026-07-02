const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const GRPC_PORT = process.env.ADMIN_GRPC_PORT || 5006;
const HTTP_PORT = process.env.ADMIN_HTTP_PORT || 3006;

// Database configurations
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || 'postgres';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT || 5432;

const authPool = new Pool({ user: dbUser, password: dbPassword, host: dbHost, port: dbPort, database: process.env.AUTH_DB_NAME || 'auth_db' });
const companyPool = new Pool({ user: dbUser, password: dbPassword, host: dbHost, port: dbPort, database: process.env.COMPANY_DB_NAME || 'company_db' });
const interviewPool = new Pool({ user: dbUser, password: dbPassword, host: dbHost, port: dbPort, database: process.env.INTERVIEW_DB_NAME || 'interview_db' });

// Load proto
const PROTO_PATH = path.resolve(__dirname, '../../protos/admin.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const adminProto = grpc.loadPackageDefinition(packageDefinition).admin;

// gRPC Handlers
const getSystemStats = async (call, callback) => {
  try {
    const userRes = await authPool.query('SELECT COUNT(*) FROM users');
    const companyRes = await companyPool.query('SELECT COUNT(*) FROM companies');
    const interviewRes = await interviewPool.query('SELECT COUNT(*) FROM interviews');

    callback(null, {
      total_users: parseInt(userRes.rows[0].count, 10),
      total_companies: parseInt(companyRes.rows[0].count, 10),
      total_interviews: parseInt(interviewRes.rows[0].count, 10),
    });
  } catch (err) {
    console.error('GetSystemStats error:', err);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error: ' + err.message
    });
  }
};

// Start gRPC Server
const server = new grpc.Server();
server.addService(adminProto.AdminService.service, {
  GetSystemStats: getSystemStats
});

server.bindAsync(`0.0.0.0:${GRPC_PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error('Failed to bind gRPC server:', err);
    return;
  }
  console.log(`Admin Service gRPC server running on port: ${port}`);
});

// Start HTTP Health Check Server
const app = express();
app.get('/health', async (req, res) => {
  try {
    await authPool.query('SELECT 1');
    await companyPool.query('SELECT 1');
    await interviewPool.query('SELECT 1');
    res.status(200).json({
      service: 'Admin Service',
      status: 'UP',
      databases: {
        auth_db: 'CONNECTED',
        company_db: 'CONNECTED',
        interview_db: 'CONNECTED'
      }
    });
  } catch (err) {
    res.status(500).json({
      service: 'Admin Service',
      status: 'DOWN',
      error: err.message
    });
  }
});

app.listen(HTTP_PORT, () => {
  console.log(`Admin Service health check HTTP server running on port: ${HTTP_PORT}`);
});
