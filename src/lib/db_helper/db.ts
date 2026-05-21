import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'family_story',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || undefined, // undefined for peer auth
});

export default pool;
