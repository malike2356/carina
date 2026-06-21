-- Enable pgvector extension on the central database
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

SELECT 'CREATE DATABASE carina_skills_hub'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'carina_skills_hub')\gexec

SELECT 'CREATE DATABASE carina_central'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'carina_central')\gexec

SELECT 'CREATE DATABASE carina_cloud'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'carina_cloud')\gexec
