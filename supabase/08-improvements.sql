-- =====================================================================
-- تحسينات النظام: حماية سجلات الحضور + updated_at على الجداول الحساسة
-- شغّله بعد 07-employee-app.sql. آمن لإعادة التشغيل.
-- =====================================================================
set role postgres;

-- =====================================================================
-- [تحسين #7] إضافة updated_at على الجداول الحساسة
-- يسهّل معرفة "متى تعدّل الراتب" بدون الرجوع لسجل التعديلات
-- =====================================================================

alter table public.employees          add column if not exists updated_at timestamptz not null default now();
alter table public.payroll_adjustments add column if not exists updated_at timestamptz not null default now();
alter table public.settings           add column if not exists updated_at timestamptz not null default now();
alter table public.leaves             add column if not exists updated_at timestamptz not null default now();

-- trigger بيحدّث updated_at تلقائياً عند كل update
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at := now();
  return NEW;
end $$;

do $$
declare t text;
begin
  foreach t in array array['employees','payroll_adjustments','settings','leaves'] loop
    execute format('drop trigger if exists set_updated_at_%1$s on public.%1$s', t);
    execute format('create trigger set_updated_at_%1$s before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- =====================================================================
-- [تحسين #3] حماية سجلات الحضور المسجّلة من التطبيق (source = 'app')
-- الموظف لا يستطيع حذف سجل حضوره بعد التسجيل
-- الموظف لا يستطيع تعديل check_in بعد تسجيله من التطبيق
-- =====================================================================

-- trigger يمنع تعديل check_in في سجل source='app' من طرف الموظف
create or replace function public.guard_attendance_app()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- منع الحذف للموظف (not staff): الموارد البشرية تقدر تحذف
  if TG_OP = 'DELETE' then
    if OLD.source = 'app' and not public.is_staff() then
      raise exception 'لا يمكن حذف سجل حضور مسجّل من التطبيق';
    end if;
    return OLD;
  end if;
  -- منع تغيير check_in في سجل app من طرف الموظف
  if TG_OP = 'UPDATE' then
    if OLD.source = 'app' and not public.is_staff() then
      if NEW.check_in is distinct from OLD.check_in then
        raise exception 'لا يمكن تعديل وقت الحضور المسجّل من التطبيق';
      end if;
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists guard_attendance_app on public.attendance;
create trigger guard_attendance_app
  before update or delete on public.attendance
  for each row execute function public.guard_attendance_app();

-- RLS: الموظف يحذف سجل حضوره فقط لو source != 'app'
-- (الـ policy الأصلية ما كانتش موجودة للموظف على الحضور — بس للقراءة)
-- السجل من التطبيق محمي بالـ trigger أعلاه

-- =====================================================================
-- [تحسين #7] index على updated_at للجداول الكبيرة
-- =====================================================================
create index if not exists idx_employees_updated   on public.employees(updated_at desc);
create index if not exists idx_att_date            on public.attendance(date desc);
create index if not exists idx_leaves_dates        on public.leaves(from_date, to_date);

-- =====================================================================
-- تسجيل هذا الملف في سجل التعديلات (اختياري)
-- =====================================================================
-- do $$ begin
--   insert into public.timeline (emp_id, date, type, text)
--   values (null, now()::date, 'ترقية النظام', 'تطبيق تحسينات: updated_at + حماية الحضور + فهارس');
-- end $$;
