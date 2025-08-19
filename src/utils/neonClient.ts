// src/utils/neonClient.ts
import { neon, neonConfig } from '@neondatabase/serverless';

// Keep connections warm in dev for performance
neonConfig.fetchConnectionCache = true;

const connectionString = process.env.NEON_DATABASE_URL;
if (!connectionString) {
  throw new Error('NEON_DATABASE_URL is not set. Did you create .env.local?');
}

export const sql = neon(connectionString);
