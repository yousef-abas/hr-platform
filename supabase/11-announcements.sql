-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 11-announcements.sql
-- O: جدول الإعلانات الداخلية للشركة
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text,
  type        text not null default 'general', -- general | holiday | urgent | event
  active      boolean not null default true,
  pinned      boolean not null default false,
  expires_at  date,
  created_by  text,
  created_at  timestamptz not null default now()
);
alter table public.announcements enable row level security;

-- كل الموظفين يقرأوا
create policy "all read announcements" on public.announcements
  for select using (active = true);

-- HR/admin فقط يكتبوا
create policy "hr writes announcements" on public.announcements
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','hr'))
  );
