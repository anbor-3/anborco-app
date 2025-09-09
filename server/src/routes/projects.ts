import { Router } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../index.js';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url'; // ★追加

const router = Router();

/** 小ユーティリティ：snake_case → camelCase 変換 */
const toCamel = (row: any) => ({
  id: row.id,
  company: row.company,
  manager: row.manager,
  phone: row.phone,
  name: row.name,
  contractStart: row.contract_start ? row.contract_start.toISOString().slice(0, 10) : '',
  contractEnd: row.contract_end ? row.contract_end.toISOString().slice(0, 10) : '',
  unitPrice: Number(row.unit_price ?? 0),
  startTime: row.start_time ? row.start_time.toString().slice(0,5) : '',
  endTime: row.end_time ? row.end_time.toString().slice(0,5) : '',
  paymentDate: row.payment_date ?? '',
  transferDate: row.transfer_date ?? '',
  requiredPeople: row.required_people ?? '0',
  requiredUnit: row.required_unit ?? '名',
  customFields: row.custom_fields ?? {},
  attachments: row.attachments ?? [],
});

/* ========= ここから A: アップロード先定義（クロスプラットフォーム安全版） ========= */
// ESM で __dirname を作成
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// UPLOAD_DIR の実体パス（デフォルト: server/public/uploads）
// 環境変数 UPLOAD_DIR を変えれば相対で上書き可能（例: "public/uploads"）
const UPLOAD_DIR = path.resolve(
  __dirname,
  process.env.UPLOAD_DIR ? path.join('..', '..', process.env.UPLOAD_DIR) : '../../public/uploads'
);

// 必ず作成
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ファイル名を安全化して保存（20MB/最大10ファイル）
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${ts}-${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
});
/* ========= ここまで A ========= */

/** GET /api/projects?company=XXX */
router.get('/', async (req: Request, res: Response) => {
  const company = String(req.query.company || '').trim();
  if (!company) return res.status(400).json({ error: 'company is required' });

  const sql = `
    select
      p.*,
      coalesce(
        json_agg(
          json_build_object(
            'name', a.name,
            'url',  a.url,
            'size', a.size,
            'type', a.type,
            'uploadedAt', a.uploaded_at
          ) order by a.id
        ) filter (where a.id is not null),
        '[]'
      ) as attachments
    from app.projects p
    left join app.attachments a on a.project_id = p.id
    where p.company = $1
    group by p.id
    order by p.id desc
  `;
  const { rows } = await pool.query(sql, [company]);
  res.json(rows.map(toCamel));
});

/** POST /api/projects/save-bulk { company, projects: Project[] } */
router.post('/save-bulk', async (req: Request, res: Response) => {
  const { company, projects } = req.body || {};
  if (!company || !Array.isArray(projects)) {
    return res.status(400).json({ error: 'invalid payload' });
  }
  const client = await pool.connect();
  try {
    await client.query('begin');

    for (const p of projects) {
      const params = [
        p.company ?? company,
        p.manager ?? '',
        p.phone ?? '',
        p.name ?? '',
        p.contractStart || null,
        p.contractEnd   || null,
        Number(p.unitPrice || 0),
        p.startTime || null,
        p.endTime   || null,
        p.paymentDate ?? '',
        p.transferDate ?? '',
        p.requiredPeople ?? '0',
        p.requiredUnit   ?? '名',
        p.customFields   ?? {},
      ];

      if (p.id && p.id > 0) {
        await client.query(
          `update app.projects
           set company=$1, manager=$2, phone=$3, name=$4,
               contract_start=$5, contract_end=$6,
               unit_price=$7, start_time=$8, end_time=$9,
               payment_date=$10, transfer_date=$11,
               required_people=$12, required_unit=$13,
               custom_fields=$14
           where id=${p.id}`,
          params
        );
      } else {
        const ins = await client.query(
          `insert into app.projects
           (company, manager, phone, name, contract_start, contract_end,
            unit_price, start_time, end_time, payment_date, transfer_date,
            required_people, required_unit, custom_fields)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           returning id`,
          params
        );
        p.id = ins.rows[0].id;
      }
    }

    await client.query('commit');

    const { rows } = await client.query(
      `select
         p.*,
         coalesce(
           json_agg(
             json_build_object(
               'name', a.name,
               'url',  a.url,
               'size', a.size,
               'type', a.type,
               'uploadedAt', a.uploaded_at
             ) order by a.id
           ) filter (where a.id is not null),
           '[]'
         ) as attachments
       from app.projects p
       left join app.attachments a on a.project_id = p.id
       where p.company = $1
       group by p.id
       order by p.id desc`,
      [company]
    );

    res.json({ projects: rows.map(toCamel) });
  } catch (e) {
    await client.query('rollback');
    console.error(e);
    res.status(500).json({ error: 'save failed' });
  } finally {
    client.release();
  }
});

/** DELETE /api/projects/:id */
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid id' });
  await pool.query(`delete from app.projects where id=$1`, [id]);
  res.json({ ok: true });
});

/** 添付アップロード POST /api/projects/:id/files */
router.post('/:id/files', upload.array('files'), async (req: any, res: Response) => {
  const id = Number(req.params.id);
  if (!id || !req.files?.length) return res.json([]);

  /* ======== ここから B: 公開URLは API サーバに合わせる ========
     server/.env.local に PUBLIC_BASE を入れておく:
       PUBLIC_BASE=http://localhost:4321
     そうすると URL は `${PUBLIC_BASE}/uploads/<ファイル名>` になります。
  */
  const publicBase = (process.env.PUBLIC_BASE || `http://localhost:${process.env.PORT || 4321}`).replace(/\/+$/, '');
  /* ======== ここまで B ======== */

  const client = await pool.connect();
  try {
    await client.query('begin');
    const out: any[] = [];

    for (const f of req.files as Express.Multer.File[]) {
      // multer.diskStorageで付けたファイル名をそのまま公開
      const basename = path.basename(f.filename || f.path);
      const url = `${publicBase}/uploads/${basename}`;

      const q = await client.query(
        `insert into app.attachments(project_id,name,url,size,type)
         values ($1,$2,$3,$4,$5)
         returning name,url,size,type,uploaded_at`,
        [id, f.originalname, url, f.size, f.mimetype]
      );
      out.push(q.rows[0]);
    }
    await client.query('commit');
    res.json(out);
  } catch (e) {
    await client.query('rollback');
    console.error(e);
    res.status(500).json({ error: 'upload failed' });
  } finally {
    client.release();
  }
});

export default router;
