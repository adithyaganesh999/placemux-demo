const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const express = require('express');
const { createClient } = require('redis');
const db = require('./db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_placemux';
const GRPC_PORT = process.env.AUTH_GRPC_PORT || 5001;
const HTTP_PORT = process.env.AUTH_HTTP_PORT || 3001;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Setup Redis
const redisClient = createClient({ url: REDIS_URL });
redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect().then(() => {
  console.log('Connected to Redis cache');
}).catch((err) => {
  console.error('Failed to connect to Redis, continuing without cache...', err.message);
});

// Load proto
const PROTO_PATH = path.resolve(__dirname, '../../protos/auth.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const authProto = grpc.loadPackageDefinition(packageDefinition).auth;

// gRPC Handlers
const register = async (call, callback) => {
  const { email, password, name } = call.request;
  try {
    if (!email || !password || !name) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Email, password, and name are required'
      });
    }

    // Check existing
    const existing = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return callback({
        code: grpc.status.ALREADY_EXISTS,
        message: 'User already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hashedPassword, name]
    );
    const user = result.rows[0];

    callback(null, {
      id: user.id.toString(),
      email: user.email,
      name: user.name,
      message: 'Registration successful'
    });
  } catch (err) {
    console.error('Register error:', err);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error'
    });
  }
};

const login = async (call, callback) => {
  const { email, password } = call.request;
  try {
    if (!email || !password) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Email and password are required'
      });
    }

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'User not found'
      });
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'Invalid password'
      });
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '24h' });

    // Cache the user info in Redis for quick access
    try {
      if (redisClient.isOpen) {
        await redisClient.setEx(`token:${token}`, 86400, JSON.stringify({
          id: user.id.toString(),
          email: user.email,
          name: user.name
        }));
      }
    } catch (redisErr) {
      console.warn('Redis cache save failure:', redisErr.message);
    }

    callback(null, {
      token,
      id: user.id.toString(),
      email: user.email,
      name: user.name
    });
  } catch (err) {
    console.error('Login error:', err);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error'
    });
  }
};

const validateToken = async (call, callback) => {
  const { token } = call.request;
  try {
    if (!token) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Token is required'
      });
    }

    // Try cache first
    try {
      if (redisClient.isOpen) {
        const cached = await redisClient.get(`token:${token}`);
        if (cached) {
          const user = JSON.parse(cached);
          return callback(null, {
            valid: true,
            id: user.id,
            email: user.email,
            name: user.name
          });
        }
      }
    } catch (redisErr) {
      console.warn('Redis cache get failure:', redisErr.message);
    }

    // Validate JWT
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify user exists in Database
    const result = await db.query('SELECT id, email, name FROM users WHERE id = $1', [decoded.id]);
    if (result.rows.length === 0) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'User no longer exists'
      });
    }

    const user = result.rows[0];

    // Re-cache
    try {
      if (redisClient.isOpen) {
        await redisClient.setEx(`token:${token}`, 86400, JSON.stringify({
          id: user.id.toString(),
          email: user.email,
          name: user.name
        }));
      }
    } catch (redisErr) {
      console.warn('Redis cache write failure:', redisErr.message);
    }

    callback(null, {
      valid: true,
      id: user.id.toString(),
      email: user.email,
      name: user.name
    });
  } catch (err) {
    console.error('Token validation error:', err.message);
    callback(null, {
      valid: false,
      id: '',
      email: '',
      name: ''
    });
  }
};

// Start gRPC Server
const server = new grpc.Server();
server.addService(authProto.AuthService.service, {
  Register: register,
  Login: login,
  ValidateToken: validateToken
});

server.bindAsync(`0.0.0.0:${GRPC_PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error('Failed to bind gRPC server:', err);
    return;
  }
  console.log(`Auth Service gRPC server running on port: ${port}`);
});

// Start HTTP Health Check Server
const app = express();
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    const redisStatus = redisClient.isOpen ? 'CONNECTED' : 'DISCONNECTED';
    res.status(200).json({
      service: 'Auth Service',
      status: 'UP',
      database: 'CONNECTED',
      cache: redisStatus
    });
  } catch (err) {
    res.status(500).json({
      service: 'Auth Service',
      status: 'DOWN',
      database: 'DISCONNECTED',
      error: err.message
    });
  }
});

app.listen(HTTP_PORT, () => {
  console.log(`Auth Service health check HTTP server running on port: ${HTTP_PORT}`);
});
