-- =====================================================================
-- السلف بأقساط: بتتخصم تلقائيًا من الرواتب. شغّله بعد 04-payroll.sql. آمن لإعادة التشغيل.
-- =====================================================================
set role postgres;

create table if not exists public.loans (
  id text primary key default gen_random_uuid()::text,
  emp_id text not null references public.employees(id) on delete cascade,
  title text, total numeric not null check (total > 0),
  installments int not null check (installments between 1 and 120),
  start_month text not null check (start_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'active' check (status in ('active','stopped')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_loans_emp on public.loans(emp_id);
alter table public.loans enable row level security;
drop policy if exists staff_all on public.loans; create policy staff_all on public.loans for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists self_read on public.loans; create policy self_read on public.loans for select to authenticated using (emp_id = public.my_emp());
drop trigger if exists audit_loans on public.loans;
create trigger audit_loans after insert or update or delete on public.loans for each row execute function public.audit_trigger();
