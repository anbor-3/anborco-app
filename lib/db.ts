import { neon } from '@neondatabase/serverless';

/** Neon HTTPドライバ（Vercel/Edgeとも相性良） */
export const sql = neon(process.env.DATABASE_URL!);
