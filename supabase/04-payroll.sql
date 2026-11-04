-- =====================================================================
-- الرواتب: إعدادات القواعد + إقفال الشهر مع لقطة ثابتة
-- شغّله بعد setup.sql و 02-audit.sql و 03-hardening.sql. آمن لإعادة التشغيل.
-- =====================================================================
set role postgres;

alter table public.employees add column if not exists insured boolean not null default true;

alter table public.payroll_adjustments
  add column if not exists ot_normal numeric not null default 0,
  add column if not exists ot_night numeric not null default 0,
  add column if not exists ot_rest numeric not null default 0,
  add column if not exists ot_holiday numeric not null default 0,
  add column if not exists advance numeric not null default 0,
  add column if not exists penalty numeric not null default 0,
  add column if not exists note text;

-- إعدادات (قواعد الشركة + الثوابت الرسمية) كقيم JSON
create table if not exists public.settings (
  id text primary key default gen_random_uuid()::text,
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.payroll_runs (
  id text primary key default gen_random_uuid()::text,
  month text not null unique,
  status text not null default 'draft' check (status in ('draft','review','approved','paid')),
  total_net numeric not null default 0, total_cost numeric not null default 0, emp_count int not null default 0,
  rules_snapshot jsonb, state_snapshot jsonb,
  approved_at timestamptz, approved_by text, reopen_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.payroll_lines (
  id text primary key default gen_random_uuid()::text,
  run_id text not null references public.payroll_runs(id) on delete cascade,
  emp_id text references public.employees(id) on delete set null,
  net numeric not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_lines_run on public.payroll_lines(run_id);
create index if not exists idx_lines_emp on public.payroll_lines(emp_id);

alter table public.settings enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payroll_lines enable row level security;

-- القواعد: الموارد البشرية تقرأ، والمدير فقط يعدّل
drop policy if exists settings_read on public.settings;  create policy settings_read on public.settings for select to authenticated using (public.is_staff());
drop policy if exists settings_admin on public.settings; create policy settings_admin on public.settings for all to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
drop policy if exists staff_all on public.payroll_runs;  create policy staff_all on public.payroll_runs for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists staff_all on public.payroll_lines; create policy staff_all on public.payroll_lines for all to authenticated using (public.is_staff()) with check (public.is_staff());
-- الموظف يشوف قسيمته بعد اعتماد الشهر فقط (الدالة بتتخطى RLS لأن الموظف مالوش صلاحية على جدول الأشهر)
create or replace function public.run_locked(rid text) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.payroll_runs r where r.id = rid and r.status in ('approved','paid')) $$;
drop policy if exists self_read on public.payroll_lines;
create policy self_read on public.payroll_lines for select to authenticated using (emp_id = public.my_emp() and public.run_locked(run_id));

-- الشهر المعتمد: الدخول والخروج من حالة الاعتماد للمدير فقط
create or replace function public.guard_run() returns trigger language plpgsql security definer set search_path = public as $$
declare was boolean := false; will boolean := false;
begin
  if TG_OP = 'DELETE' then
    if OLD.status in ('approved','paid') then raise exception 'لا يمكن حذف شهر معتمد'; end if;
    return OLD;
  end if;
  if TG_OP = 'UPDATE' then was := OLD.status in ('approved','paid'); end if;
  will := NEW.status in ('approved','paid');
  if was and will and (NEW.month <> OLD.month or NEW.total_net <> OLD.total_net or NEW.total_cost <> OLD.total_cost or NEW.emp_count <> OLD.emp_count) then
    raise exception 'لا يمكن تعديل أرقام شهر معتمد';
  end if;
  if (was <> will) and auth.uid() is not null and public.my_role() is distinct from 'admin' then
    raise exception 'اعتماد الشهر أو إعادة فتحه للمدير فقط';
  end if;
  if will and not was then NEW.approved_at := coalesce(NEW.approved_at, now()); end if;
  if was and not will and coalesce(NEW.reopen_reason, '') = '' then raise exception 'سبب إعادة الفتح مطلوب'; end if;
  return NEW;
end $$;
drop trigger if exists guard_run on public.payroll_runs;
create trigger guard_run before insert or update or delete on public.payroll_runs for each row execute function public.guard_run();

-- منع أي تعديل في سطور أو تعديلات شهر معتمد
create or replace function public.guard_lines() returns trigger language plpgsql security definer set search_path = public as $$
declare rid text := coalesce(case when TG_OP = 'DELETE' then OLD.run_id else NEW.run_id end, '');
begin
  if exists (select 1 from public.payroll_runs r where r.id = rid and r.status in ('approved','paid')) then
    raise exception 'الشهر معتمد ومقفول، أعد فتحه أولًا';
  end if;
  if TG_OP = 'DELETE' then return OLD; end if; return NEW;
end $$;
drop trigger if exists guard_lines on public.payroll_lines;
create trigger guard_lines before insert or update or delete on public.payroll_lines for each row execute function public.guard_lines();

create or replace function public.guard_adjustments() returns trigger language plpgsql security definer set search_path = public as $$
declare m text := case when TG_OP = 'DELETE' then OLD.month else NEW.month end;
begin
  if exists (select 1 from public.payroll_runs r where r.month = m and r.status in ('approved','paid')) then
    raise exception 'الشهر % معتمد ومقفول، أعد فتحه أولًا', m;
  end if;
  if TG_OP = 'DELETE' then return OLD; end if; return NEW;
end $$;
drop trigger if exists guard_adjustments on public.payroll_adjustments;
create trigger guard_adjustments before insert or update or delete on public.payroll_adjustments for each row execute function public.guard_adjustments();

-- سجل التعديلات يشمل القواعد والأشهر
do $$
declare t text;
begin
  foreach t in array array['settings','payroll_runs','payroll_lines'] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_trigger()', t);
  end loop;
end $$;
