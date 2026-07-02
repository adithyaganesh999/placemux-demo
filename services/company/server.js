const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const express = require('express');
const db = require('./db');
require('dotenv').config();

const GRPC_PORT = process.env.COMPANY_GRPC_PORT || 5002;
const HTTP_PORT = process.env.COMPANY_HTTP_PORT || 3002;

// Load proto
const PROTO_PATH = path.resolve(__dirname, '../../protos/company.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const companyProto = grpc.loadPackageDefinition(packageDefinition).company;

// gRPC Handlers
const createCompany = async (call, callback) => {
  const { name, industry, description } = call.request;
  try {
    if (!name) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Company name is required'
      });
    }

    const result = await db.query(
      'INSERT INTO companies (name, industry, description) VALUES ($1, $2, $3) RETURNING id, name, industry, description',
      [name, industry, description]
    );
    const company = result.rows[0];

    callback(null, {
      id: company.id.toString(),
      name: company.name,
      industry: company.industry || '',
      description: company.description || ''
    });
  } catch (err) {
    console.error('CreateCompany error:', err);
    if (err.code === '23505') { // Unique constraint violation
      return callback({
        code: grpc.status.ALREADY_EXISTS,
        message: 'Company name already exists'
      });
    }
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error'
    });
  }
};

const getCompany = async (call, callback) => {
  const { id } = call.request;
  try {
    if (!id) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Company ID is required'
      });
    }

    const result = await db.query('SELECT * FROM companies WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Company not found'
      });
    }

    const company = result.rows[0];
    callback(null, {
      id: company.id.toString(),
      name: company.name,
      industry: company.industry || '',
      description: company.description || ''
    });
  } catch (err) {
    console.error('GetCompany error:', err);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error'
    });
  }
};

const listCompanies = async (call, callback) => {
  try {
    const result = await db.query('SELECT * FROM companies ORDER BY id ASC');
    const companies = result.rows.map(c => ({
      id: c.id.toString(),
      name: c.name,
      industry: c.industry || '',
      description: c.description || ''
    }));
    callback(null, { companies });
  } catch (err) {
    console.error('ListCompanies error:', err);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error'
    });
  }
};

// Start gRPC Server
const server = new grpc.Server();
server.addService(companyProto.CompanyService.service, {
  CreateCompany: createCompany,
  GetCompany: getCompany,
  ListCompanies: listCompanies
});

server.bindAsync(`0.0.0.0:${GRPC_PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error('Failed to bind gRPC server:', err);
    return;
  }
  console.log(`Company Service gRPC server running on port: ${port}`);
});

// Start HTTP Health Check Server
const app = express();
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.status(200).json({
      service: 'Company Service',
      status: 'UP',
      database: 'CONNECTED'
    });
  } catch (err) {
    res.status(500).json({
      service: 'Company Service',
      status: 'DOWN',
      database: 'DISCONNECTED',
      error: err.message
    });
  }
});

app.listen(HTTP_PORT, () => {
  console.log(`Company Service health check HTTP server running on port: ${HTTP_PORT}`);
});
