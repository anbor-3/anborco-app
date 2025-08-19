-- 必須拡張
create extension if not exists "uuid-ossp";

-- 日報（UI変化に強いよう JSONB 併用）
create table if not exists daily_reports (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  external_id text not null,            -- 画面側のレポートID（例: "REP-0001"）
  driver_external_id text not null,     -- 画面側のドライバーID（例: "driver0001"）
  date date not null,
  status text not null default 'submitted' check (status in ('submitted','returned','approved')),
  data jsonb not null default '{}',     -- 温度/アルコール/時間/距離など
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_daily_company_external on daily_reports(company_id, external_id);
create index if not exists idx_daily_company_date on daily_reports(company_id, date);

-- 通知（未作成の場合のみ）
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  type text not null check (type in ('warning','report','shift')),
  category text not null,
  message text not null,
  target text,
  created_at timestamptz not null default now(),
  read boolean not null default false
);
create index if not exists idx_notifications_company_time on notifications(company_id, created_at desc);
create index if not exists idx_notifications_read on notifications(read);

-- 更新時刻トリガー（共通）
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_daily_reports_updated_at on daily_reports;
create trigger trg_daily_reports_updated_at before update on daily_reports
for each row execute procedure set_updated_at();
