-- 既存 notifications に company_id を追加したい場合に実行
alter table notifications add column if not exists company_id uuid;
-- 一旦NULLを許容 → 既存行に値を入れてから NOT NULL 化推奨
-- 例:
-- update notifications set company_id = '<DEFAULT_COMPANY_ID>' where company_id is null;
-- その後に:
-- alter table notifications alter column company_id set not null;
alter table notifications
  add constraint if not exists notifications_company_fk
  foreign key (company_id) references companies(id) on delete cascade;

create index if not exists idx_notifications_company_time on notifications(company_id, created_at desc);
create index if not exists idx_notifications_read on notifications(read);
