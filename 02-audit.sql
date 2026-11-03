-- =====================================================================
-- سجل التعديلات (Audit log): مين غيّر إيه ومتى. شغّله مرة واحدة بعد setup.sql
-- بيتسجل من داخل قاعدة البيانات نفسها، فمش ممكن حد يتجاوزه من المتصفح.
-- =====================================================================
set role postgres;

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid, user_email text,
  table_name text not null, row_id text, action text not null,
  old_data jsonb, new_data jsonb
);
create index if not exists idx_audit_at on public.audit_log(at desc);
create index if not exists idx_audit_row on public.audit_log(table_name, row_id);

alter table public.audit_log enable row level security;
-- المدير فقط يقرأ السجل. ما فيش سياسة كتابة: التسجيل بيتم من الـ trigger فقط.
drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log for select to authenticated using (public.my_role() = 'admin');
revoke insert, update, delete on public.audit_log from anon, authenticated;

create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb; n jsonb; od jsonb; nd jsonb; rid text;
begin
  if TG_OP in ('UPDATE', 'DELETE') then o := to_jsonb(OLD) - 'photo' - 'file'; end if;
  if TG_OP in ('INSERT', 'UPDATE') then n := to_jsonb(NEW) - 'photo' - 'file'; end if;
  rid := coalesce(n->>'id', o->>'id');
  if TG_OP = 'UPDATE' then
    select coalesce(jsonb_object_agg(k, o->k), '{}'::jsonb), coalesce(jsonb_object_agg(k, n->k), '{}'::jsonb)
      into od, nd from jsonb_object_keys(n) as k where (n->k) is distinct from (o->k);
    if nd = '{}'::jsonb then return NEW; end if;
  else
    od := o; nd := n;
  end if;
  insert into public.audit_log (user_id, user_email, table_name, row_id, action, old_data, new_data)
  values (auth.uid(), (select email from public.profiles where id = auth.uid()), TG_TABLE_NAME, rid, TG_OP, od, nd);
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end $$;

do $$
declare t text;
begin
  foreach t in array array['employees','attendance','leaves','candidates','payroll_adjustments','reviews','documents','timeline','profiles'] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_trigger()', t);
  end loop;
end $$;
