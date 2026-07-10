const { Client } = require('pg');
require('dotenv').config({ path: '../../.env' });

const client = new Client({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.AUTH_DB_NAME,
  ssl: { rejectUnauthorized: false }
});

const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  industry VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interviews (
  id SERIAL PRIMARY KEY,
  candidate_id VARCHAR(255) NOT NULL,
  company_id VARCHAR(255) NOT NULL,
  scheduled_time TIMESTAMP NOT NULL,
  role VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'SCHEDULED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const seedSql = `
INSERT INTO users (email, password, name) VALUES 
('candidate@placemux.com', '$2b$10$vI8aWBnd3G6eK2S6BqE6I.tJc.pP7k3v2k/2rE/lG5fT3E3wVv.fG', 'Candidate User'),
('admin@placemux.com', '$2b$10$vI8aWBnd3G6eK2S6BqE6I.tJc.pP7k3v2k/2rE/lG5fT3E3wVv.fG', 'Admin User')
ON CONFLICT (email) DO NOTHING;

INSERT INTO companies (name, industry, description) VALUES
('Google', 'Technology', 'Search engine and cloud computing leader.'),
('Meta', 'Social Media', 'Connecting people and building the metaverse.'),
('Netflix', 'Entertainment', 'Streaming entertainment service.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO interviews (id, candidate_id, company_id, scheduled_time, role, status) VALUES
(1, '1', '1', '2026-08-15 10:00:00', 'Software Engineer', 'SCHEDULED'),
(2, '1', '2', '2026-08-20 14:00:00', 'Frontend Developer', 'SCHEDULED')
ON CONFLICT (id) DO NOTHING;
`;

async function main() {
  console.log('Connecting to Neon PostgreSQL...');
  await client.connect();
  console.log('Connected successfully!');

  console.log('Creating tables...');
  await client.query(schemaSql);
  console.log('Tables created successfully!');

  console.log('Inserting seed data...');
  await client.query(seedSql);
  console.log('Seed data inserted successfully!');

  await client.end();
  console.log('Database initialization complete!');
}

main().catch(err => {
  console.error('Error during database initialization:', err);
  process.exit(1);
});
