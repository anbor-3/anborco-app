create schema if not exists app;

create table if not exists app.projects (
  id               bigserial primary key,
  company          text not null,
  manager          text not null default '',
  phone            text not null default '',
  name             text not null,
  contract_start   date,
  contract_end     date,
  unit_price       integer not null default 0,
  start_time       time without time zone,
  end_time         time without time zone,
  payment_date     text default '',
  transfer_date    text default '',
  required_people  text default '0',
  required_unit    text default '名',
  custom_fields    jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists app.attachments (
  id           bigserial primary key,
  project_id   bigint not null references app.projects(id) on delete cascade,
  name         text not null,
  url          text not null,
  size         bigint not null default 0,
  type         text not null default '',
  uploaded_at  timestamptz not null default now()
);

create index if not exists idx_projects_company    on app.projects(company);
create index if not exists idx_attachments_project on app.attachments(project_id);

create or replace function app.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists trg_projects_updated on app.projects;
create trigger trg_projects_updated
before update on app.projects
for each row execute function app.touch_updated_at();
