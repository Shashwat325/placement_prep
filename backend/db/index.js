import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Reuses connections instead of opening a new one per query — important
// once you have concurrent users hitting the API.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false }, // needed for most hosted Postgres (Supabase/Neon)
});

// Small helper so route files don't import `pool` everywhere —
// just call query(text, params)
export const query = (text, params) => pool.query(text, params);