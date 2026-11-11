-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 10-improvements.sql (v3)
-- employees.id = text | users table = profiles
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- [F] Error Logs
create table if not exists public.error_logs (
  id          uuid primary key default gen_random_uuid(),
  emp_id      text references public.employees(id) on delete set null,
  context     text,
  message     text not null,
  stack       text,
  url         text,
  created_at  timestamptz not null default now()
);
alter table public.error_logs enable row level security;

create policy "admin reads errors" on public.error_logs
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','hr'))
  );
create policy "anyone inserts errors" on public.error_logs
  for insert with check (true);

-- [E] Inbox
create table if not exists public.inbox (
  id          uuid primary key default gen_random_uuid(),
  emp_id      text not null references public.employees(id) on delete cascade,
  type        text not null default 'general',
  title       text not null,
  body        text,
  url         text default '#',
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.inbox enable row level security;

create policy "employee reads own inbox" on public.inbox
  for select using (emp_id = public.my_emp());
create policy "employee updates own inbox" on public.inbox
  for update using (emp_id = public.my_emp());
create policy "hr writes inbox" on public.inbox
  for insert with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','hr'))
  );

-- [A] Push Subscriptions
create table if not exists public.push_subscriptions (
  emp_id       text primary key references public.employees(id) on delete cascade,
  subscription jsonb not null,
  updated_at   timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

create policy "employee manages own push sub" on public.push_subscriptions
  for all using (emp_id = public.my_emp());

-- [G] app_config() مع version + inboxUnread
create or replace function public.app_config()
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_emp      employees%rowtype;
  v_prof     profiles%rowtype;
  v_leaves   jsonb;
  v_pay      jsonb;
  v_company  jsonb;
  v_geo      jsonb;
  v_unread   int := 0;
begin
  select * into v_prof from public.profiles where id = auth.uid();
  if not found then raise exception 'غير مسموح'; end if;

  select * into v_emp from public.employees where id = v_prof.employee_id;

  select value into v_leaves  from public.settings where key = 'leaves'   limit 1;
  select value into v_pay     from public.settings where key = 'pay'       limit 1;
  select value into v_company from public.settings where key = 'company'   limit 1;
  select value into v_geo     from public.settings where key = 'geofence'  limit 1;

  if v_emp.id is not null then
    select count(*) into v_unread
    from public.inbox
    where emp_id = v_emp.id and read = false;
  end if;

  return jsonb_build_object(
    'version',     '1.4',
    'leaves',      coalesce(v_leaves,  '{}'::jsonb),
    'pay',         coalesce(v_pay,     '{"weekend":[5,6],"holidays":[]}'::jsonb),
    'company',     coalesce(v_company, '{}'::jsonb),
    'geo',         coalesce(v_geo,     '{"enabled":false}'::jsonb),
    'inboxUnread', v_unread,
    'me', jsonb_build_object(
      'id',        v_emp.id,
      'name',      v_emp.name,
      'title',     v_emp.title,
      'dept',      v_emp.dept,
      'hire',      v_emp.hire,
      'status',    v_emp.status,
      'photo',     v_emp.photo,
      'remote',    coalesce(v_emp.remote_ok, false),
      'isManager', exists(
        select 1 from public.employees x
        where x.manager_id = v_emp.id
        and x.status <> 'terminated'
      )
    )
  );
end;
$$;

grant execute on function public.app_config() to authenticated;
