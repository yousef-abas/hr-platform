-- =====================================================================
-- إعداد نظام الموارد البشرية: الجداول + الصلاحيات + حساب المدير
-- شغّله مرة واحدة في SQL Editor. آمن لإعادة التشغيل.
-- =====================================================================
set role postgres;

-- =====================================================================
-- نظام الموارد البشرية: الجداول والصلاحيات (Supabase / PostgreSQL)
-- شغّله مرة واحدة من: SQL Editor ← New query ← الصق ← Run
-- آمن لإعادة التشغيل (idempotent).
-- =====================================================================

-- ---------- 1) الجداول ----------
create table if not exists public.employees (
  id text primary key default gen_random_uuid()::text,
  name text not null, title text, dept text, phone text, email text,
  salary numeric not null default 0, allowances numeric not null default 0,
  hire date, status text not null default 'active' check (status in ('active','leave','terminated')),
  nid text, birth date, gender text, gov text, marital text, military text, address text,
  emerg_name text, emerg_phone text, emerg_rel text,
  contract_type text, contract_end date, probation_end date,
  insurance_no text, bank text, iban text,
  manager_id text references public.employees(id) on delete set null,
  photo text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, full_name text,
  role text not null default 'employee' check (role in ('admin','hr','employee')),
  employee_id text references public.employees(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id text primary key default gen_random_uuid()::text,
  emp_id text not null references public.employees(id) on delete cascade,
  date date not null, check_in text, check_out text,
  created_at timestamptz not null default now(),
  unique (emp_id, date)
);

create table if not exists public.leaves (
  id text primary key default gen_random_uuid()::text,
  emp_id text not null references public.employees(id) on delete cascade,
  type text not null, from_date date not null, to_date date not null,
  days int not null default 1, note text,
  status text not null default 'معلقة' check (status in ('معلقة','معتمدة','مرفوضة')),
  created_at timestamptz not null default now()
);

create table if not exists public.candidates (
  id text primary key default gen_random_uuid()::text,
  name text not null, role text, stage int not null default 0, phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.payroll_adjustments (
  id text primary key default gen_random_uuid()::text,
  emp_id text not null references public.employees(id) on delete cascade,
  month text not null, bonus numeric not null default 0, absent numeric not null default 0, other numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (emp_id, month)
);

create table if not exists public.reviews (
  id text primary key default gen_random_uuid()::text,
  emp_id text not null references public.employees(id) on delete cascade,
  period text not null, q int, t int, p int, i int, avg numeric, note text,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id text primary key default gen_random_uuid()::text,
  emp_id text not null references public.employees(id) on delete cascade,
  type text not null, received date, expiry date, note text, file text, fname text,
  created_at timestamptz not null default now(),
  unique (emp_id, type)
);

create table if not exists public.timeline (
  id text primary key default gen_random_uuid()::text,
  emp_id text not null references public.employees(id) on delete cascade,
  date date not null, type text not null, text text,
  created_at timestamptz not null default now()
);

create index if not exists idx_att_emp on public.attendance(emp_id, date);
create index if not exists idx_leaves_emp on public.leaves(emp_id);
create index if not exists idx_docs_emp on public.documents(emp_id);

-- ---------- 2) إنشاء ملف المستخدم تلقائيًا عند التسجيل ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- 3) دوال الصلاحيات ----------
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.my_emp() returns text
language sql stable security definer set search_path = public as
$$ select employee_id from public.profiles where id = auth.uid() $$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.my_role() in ('admin','hr'), false) $$;

-- ---------- 4) تفعيل RLS (من غيره أي حد معاه المفتاح العام يقرأ كل شيء) ----------
alter table public.employees enable row level security;
alter table public.profiles enable row level security;
alter table public.attendance enable row level security;
alter table public.leaves enable row level security;
alter table public.candidates enable row level security;
alter table public.payroll_adjustments enable row level security;
alter table public.reviews enable row level security;
alter table public.documents enable row level security;
alter table public.timeline enable row level security;

-- الموارد البشرية والمدير: كل شيء
drop policy if exists staff_all on public.employees;           create policy staff_all on public.employees           for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists staff_all on public.attendance;          create policy staff_all on public.attendance          for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists staff_all on public.leaves;              create policy staff_all on public.leaves              for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists staff_all on public.candidates;          create policy staff_all on public.candidates          for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists staff_all on public.payroll_adjustments; create policy staff_all on public.payroll_adjustments for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists staff_all on public.reviews;             create policy staff_all on public.reviews             for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists staff_all on public.documents;           create policy staff_all on public.documents           for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists staff_all on public.timeline;            create policy staff_all on public.timeline            for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- الموظف: يقرأ بياناته هو فقط (السجل الوظيفي والإنذارات للموارد البشرية فقط)
drop policy if exists self_read on public.employees;           create policy self_read on public.employees           for select to authenticated using (id = public.my_emp());
drop policy if exists self_read on public.attendance;          create policy self_read on public.attendance          for select to authenticated using (emp_id = public.my_emp());
drop policy if exists self_read on public.leaves;              create policy self_read on public.leaves              for select to authenticated using (emp_id = public.my_emp());
drop policy if exists self_read on public.payroll_adjustments; create policy self_read on public.payroll_adjustments for select to authenticated using (emp_id = public.my_emp());
drop policy if exists self_read on public.reviews;             create policy self_read on public.reviews             for select to authenticated using (emp_id = public.my_emp());
drop policy if exists self_read on public.documents;           create policy self_read on public.documents           for select to authenticated using (emp_id = public.my_emp());
-- الموظف يقدم طلب إجازة لنفسه فقط وبحالة "معلقة"
drop policy if exists self_request on public.leaves;           create policy self_request on public.leaves           for insert to authenticated with check (emp_id = public.my_emp() and status = 'معلقة');

-- الحسابات: كل مستخدم يقرأ حسابه، والموارد البشرية تقرأ الكل، والمدير فقط يغيّر الأدوار
drop policy if exists profiles_read on public.profiles;       create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());
drop policy if exists profiles_admin on public.profiles;      create policy profiles_admin on public.profiles for update to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- ---------- 5) تخزين المستندات (خاص) ----------
insert into storage.buckets (id, name, public) values ('employee-docs', 'employee-docs', false) on conflict (id) do nothing;
drop policy if exists "docs staff all" on storage.objects;
create policy "docs staff all" on storage.objects for all to authenticated
  using (bucket_id = 'employee-docs' and public.is_staff()) with check (bucket_id = 'employee-docs' and public.is_staff());
drop policy if exists "docs self read" on storage.objects;
create policy "docs self read" on storage.objects for select to authenticated
  using (bucket_id = 'employee-docs' and (storage.foldername(name))[1] = public.my_emp());

-- ---------- 6) حساب المدير (غيّر الباسورد وقت ما تحب بإعادة تشغيل الجزء ده) ----------
update auth.users
set encrypted_password = extensions.crypt('Aa@@2020', extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now())
where email = 'yousef-abas@hotmail.com';

insert into public.profiles (id, email, full_name)
select id, email, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

update public.profiles set role = 'admin' where email = 'yousef-abas@hotmail.com';

-- النتيجة المتوقعة: صف فيه الإيميل والدور admin
select email, role from public.profiles;
