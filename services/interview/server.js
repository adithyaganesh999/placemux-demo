const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const express = require('express');
const db = require('./db');
require('dotenv').config();

const GRPC_PORT = process.env.INTERVIEW_GRPC_PORT || 5003;
const HTTP_PORT = process.env.INTERVIEW_HTTP_PORT || 3005;

// Load proto
const PROTO_PATH = path.resolve(__dirname, '../../protos/interview.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const interviewProto = grpc.loadPackageDefinition(packageDefinition).interview;

// gRPC Handlers
const scheduleInterview = async (call, callback) => {
  const { candidate_id, company_id, scheduled_time, role } = call.request;
  try {
    if (!candidate_id || !company_id || !scheduled_time || !role) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'candidate_id, company_id, scheduled_time, and role are required'
      });
    }

    const result = await db.query(
      'INSERT INTO interviews (candidate_id, company_id, scheduled_time, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, candidate_id, company_id, scheduled_time, role, status',
      [candidate_id, company_id, scheduled_time, role, 'SCHEDULED']
    );
    const interview = result.rows[0];

    callback(null, {
      id: interview.id.toString(),
      candidate_id: interview.candidate_id,
      company_id: interview.company_id,
      scheduled_time: interview.scheduled_time.toISOString(),
      role: interview.role,
      status: interview.status
    });
  } catch (err) {
    console.error('ScheduleInterview error:', err);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error'
    });
  }
};

const getInterview = async (call, callback) => {
  const { id } = call.request;
  try {
    if (!id) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Interview ID is required'
      });
    }

    const result = await db.query('SELECT * FROM interviews WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Interview not found'
      });
    }

    const interview = result.rows[0];
    callback(null, {
      id: interview.id.toString(),
      candidate_id: interview.candidate_id,
      company_id: interview.company_id,
      scheduled_time: interview.scheduled_time.toISOString(),
      role: interview.role,
      status: interview.status
    });
  } catch (err) {
    console.error('GetInterview error:', err);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error'
    });
  }
};

const listInterviews = async (call, callback) => {
  const { candidate_id } = call.request;
  try {
    let result;
    if (candidate_id) {
      result = await db.query('SELECT * FROM interviews WHERE candidate_id = $1 ORDER BY id DESC', [candidate_id]);
    } else {
      result = await db.query('SELECT * FROM interviews ORDER BY id DESC');
    }

    const interviews = result.rows.map(i => ({
      id: i.id.toString(),
      candidate_id: i.candidate_id,
      company_id: i.company_id,
      scheduled_time: i.scheduled_time.toISOString(),
      role: i.role,
      status: i.status
    }));
    callback(null, { interviews });
  } catch (err) {
    console.error('ListInterviews error:', err);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error'
    });
  }
};

// Start gRPC Server
const server = new grpc.Server();
server.addService(interviewProto.InterviewService.service, {
  ScheduleInterview: scheduleInterview,
  GetInterview: getInterview,
  ListInterviews: listInterviews
});

server.bindAsync(`0.0.0.0:${GRPC_PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error('Failed to bind gRPC server:', err);
    return;
  }
  console.log(`Interview Service gRPC server running on port: ${port}`);
});

// Start HTTP Health Check Server
const app = express();
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.status(200).json({
      service: 'Interview Service',
      status: 'UP',
      database: 'CONNECTED'
    });
  } catch (err) {
    res.status(500).json({
      service: 'Interview Service',
      status: 'DOWN',
      database: 'DISCONNECTED',
      error: err.message
    });
  }
});

app.listen(HTTP_PORT, () => {
  console.log(`Interview Service health check HTTP server running on port: ${HTTP_PORT}`);
});
