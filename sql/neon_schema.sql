-- 必須拡張
create extension if not exists "uuid-ossp";

-- 会社
create table if not exists companies (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  created_at timestamptz not null default now()
);

-- ドライバー（UIの型変化に強いよう JSONB を併用）
create table if not exists drivers (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  external_id text not null,           -- 画面側の d.id（例: "driver0001"）
  login_id text,
  password text,
  name text not null default '',
  data jsonb not null default '{}',    -- 画面側のその他フィールドを丸ごと保存
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_drivers_company_external on drivers(company_id, external_id);
create index if not exists idx_drivers_company on drivers(company_id);

-- 更新時刻トリガー
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_drivers_updated_at on drivers;
create trigger trg_drivers_updated_at before update on drivers
for each row execute procedure set_updated_at();
