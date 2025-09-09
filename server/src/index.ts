import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { Pool } from 'pg';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url'; // ★ 追加

import projectsRouter from './routes/projects.js';

const app = express();

const PORT = Number(process.env.PORT || 4321);
const ORIGIN = process.env.CORS_ORIGIN || '*';
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// middlewares
app.use(helmet());
app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(morgan('dev'));
app.use(express.json());

// ★ ESM で __dirname を作る
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ★ /uploads を常に公開（条件はナシ）
//    実体パスは server/public/uploads（相対: src から一つ上の public/uploads）
const uploadsDir = path.resolve(__dirname, '..', process.env.UPLOAD_DIR ?? 'public/uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// health
app.get('/health', (_req, res) => res.json({ ok: true }));

// routes
app.use('/api/projects', projectsRouter);

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`Serving uploads from: ${uploadsDir}`);
});
