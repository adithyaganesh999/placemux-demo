-- Create Databases
CREATE DATABASE auth_db;
CREATE DATABASE company_db;
CREATE DATABASE interview_db;

-- Connect to auth_db and initialize schema
\c auth_db;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed user: password is 'password123' bcrypt hash: '$2b$10$vI8aWBnd3G6eK2S6BqE6I.tJc.pP7k3v2k/2rE/lG5fT3E3wVv.fG'
INSERT INTO users (email, password, name) VALUES 
('candidate@placemux.com', '$2b$10$vI8aWBnd3G6eK2S6BqE6I.tJc.pP7k3v2k/2rE/lG5fT3E3wVv.fG', 'Candidate User'),
('admin@placemux.com', '$2b$10$vI8aWBnd3G6eK2S6BqE6I.tJc.pP7k3v2k/2rE/lG5fT3E3wVv.fG', 'Admin User');


-- Connect to company_db and initialize schema
\c company_db;

CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  industry VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO companies (name, industry, description) VALUES
('Google', 'Technology', 'Search engine and cloud computing leader.'),
('Meta', 'Social Media', 'Connecting people and building the metaverse.'),
('Netflix', 'Entertainment', 'Streaming entertainment service.');


-- Connect to interview_db and initialize schema
\c interview_db;

CREATE TABLE interviews (
  id SERIAL PRIMARY KEY,
  candidate_id VARCHAR(255) NOT NULL,
  company_id VARCHAR(255) NOT NULL,
  scheduled_time TIMESTAMP NOT NULL,
  role VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'SCHEDULED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO interviews (candidate_id, company_id, scheduled_time, role, status) VALUES
('1', '1', '2026-08-15 10:00:00', 'Software Engineer', 'SCHEDULED'),
('1', '2', '2026-08-20 14:00:00', 'Frontend Developer', 'SCHEDULED');
