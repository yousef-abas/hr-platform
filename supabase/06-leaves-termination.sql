-- =====================================================================
-- إنهاء الخدمة + أثر قرارات الإجازات. شغّله بعد 05-loans.sql. آمن لإعادة التشغيل.
-- =====================================================================
set role postgres;

alter table public.employees add column if not exists end_date date, add column if not exists end_reason text;
alter table public.employees drop constraint if exists employees_end_after_hire;
alter table public.employees add constraint employees_end_after_hire check (end_date is null or hire is null or end_date >= hire);

alter table public.leaves add column if not exists reject_reason text, add column if not exists decided_by text, add column if not exists decided_at timestamptz;
