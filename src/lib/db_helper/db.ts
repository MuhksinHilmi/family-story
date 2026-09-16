import { Pool } from "pg";

// Supports both DATABASE_URL (Neon/production) and individual DB_* vars (local dev)
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      // Neon requires SSL in production
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
      max: 10, // Neon free tier has connection limits — keep pool small
    })
  : new Pool({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME || "family_story",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || undefined,
    });

export default pool;
