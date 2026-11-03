-- =====================================================================
-- تحصين البيانات: قيود تمنع الأخطاء والتلاعب على مستوى قاعدة البيانات
-- شغّله مرة واحدة بعد setup.sql و 02-audit.sql. آمن لإعادة التشغيل.
-- لو في بيانات قديمة بتخالف قيد، هيقولك أنهي واحد وتصلحها وتعيد التشغيل.
-- =====================================================================
set role postgres;
create extension if not exists btree_gist with schema extensions;

-- الإجازات: تاريخ النهاية بعد البداية، وأيام موجبة، ومنع تداخل إجازتين لنفس الموظف
alter table public.leaves drop constraint if exists leaves_dates_ok;
alter table public.leaves add constraint leaves_dates_ok check (to_date >= from_date and days > 0);
alter table public.leaves drop constraint if exists leaves_no_overlap;
alter table public.leaves add constraint leaves_no_overlap
  exclude using gist (emp_id with =, daterange(from_date, to_date, '[]') with &&) where (status <> 'مرفوضة');

-- الحضور: صيغة الوقت HH:MM
alter table public.attendance drop constraint if exists attendance_time_fmt;
alter table public.attendance add constraint attendance_time_fmt
  check ((check_in is null or check_in ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') and (check_out is null or check_out ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'));

-- الموظفون: رقم قومي فريد، ومبالغ غير سالبة
create unique index if not exists employees_nid_uniq on public.employees(nid) where nid is not null;
alter table public.employees drop constraint if exists employees_money_ok;
alter table public.employees add constraint employees_money_ok check (salary >= 0 and allowances >= 0);

-- الرواتب والتقييمات: نطاقات منطقية
alter table public.payroll_adjustments drop constraint if exists payroll_ok;
alter table public.payroll_adjustments add constraint payroll_ok check (bonus >= 0 and absent >= 0 and absent <= 31 and other >= 0);
alter table public.reviews drop constraint if exists reviews_ok;
alter table public.reviews add constraint reviews_ok check (q between 1 and 5 and t between 1 and 5 and p between 1 and 5 and i between 1 and 5);

-- تخزين المستندات: PDF/JPG/PNG فقط وحد أقصى 5 ميجا (على مستوى الـ bucket)
update storage.buckets
set file_size_limit = 5242880, allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
where id = 'employee-docs';
