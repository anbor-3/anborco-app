-- Projects main table
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  company TEXT NOT NULL,
  manager TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  contract_start DATE,
  contract_end DATE,
  unit_price INTEGER NOT NULL DEFAULT 0,
  start_time TEXT NOT NULL DEFAULT '08:00',
  end_time   TEXT NOT NULL DEFAULT '17:00',
  payment_date  TEXT NOT NULL DEFAULT '',
  transfer_date TEXT NOT NULL DEFAULT '',
  required_people TEXT NOT NULL DEFAULT '0',
  required_unit   TEXT NOT NULL DEFAULT '名',
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company);

-- Attachments table (URL メタデータのみを保存)
CREATE TABLE IF NOT EXISTS attachments (
  id BIGSERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url  TEXT NOT NULL,
  size BIGINT,
  type TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_project ON attachments(project_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at();
