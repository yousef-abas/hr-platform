-- =====================================================================
-- تطبيق الموظفين: الحضور بالموقع (من السيرفر)، موافقة المدير المباشر، القسايم
-- شغّله بعد 06-leaves-termination.sql. آمن لإعادة التشغيل.
-- =====================================================================
set role postgres;

alter table public.employees add column if not exists remote_ok boolean not null default false;
alter table public.attendance
  add column if not exists in_lat double precision, add column if not exists in_lng double precision, add column if not exists in_acc double precision,
  add column if not exists in_dist numeric, add column if not exists in_site text,
  add column if not exists out_lat double precision, add column if not exists out_lng double precision, add column if not exists out_acc double precision,
  add column if not exists out_dist numeric, add column if not exists source text not null default 'admin';
alter table public.leaves
  add column if not exists mgr_status text not null default '', add column if not exists mgr_by text,
  add column if not exists mgr_at timestamptz, add column if not exists mgr_reason text;

-- ---------- دوال مساعدة ----------
create or replace function public.haversine_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

create or replace function public.is_my_report(emp text) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.employees e where e.id = emp and e.manager_id is not null and e.manager_id = public.my_emp()) $$;

-- فحص الموقع: بيرجع اسم الموقع والمسافة أو بيرفض برسالة عربي
create or replace function public.geo_check(p_emp text, p_lat double precision, p_lng double precision, p_acc double precision)
returns jsonb language plpgsql security definer set search_path = public as $$
declare gf jsonb; e public.employees; s jsonb; d double precision; best double precision; bestname text; maxacc numeric;
begin
  select * into e from public.employees where id = p_emp;
  select value into gf from public.settings where key = 'geofence';
  gf := coalesce(gf, '{}'::jsonb);
  if not coalesce((gf->>'enabled')::boolean, false) or coalesce(e.remote_ok, false) then
    return jsonb_build_object('site', null, 'dist', null);
  end if;
  if p_lat is null or p_lng is null then raise exception 'لازم تفعّل تحديد الموقع في الموبايل'; end if;
  if jsonb_array_length(coalesce(gf->'sites', '[]'::jsonb)) = 0 then raise exception 'لم يتم تحديد مواقع العمل بعد، كلّم الموارد البشرية'; end if;
  maxacc := coalesce((gf->>'maxAccuracy')::numeric, 100);
  if p_acc is not null and p_acc > maxacc then raise exception 'دقة الموقع ضعيفة (% متر). اقترب من مكان مفتوح وأعد المحاولة', round(p_acc); end if;
  for s in select * from jsonb_array_elements(gf->'sites') loop
    d := public.haversine_m(p_lat, p_lng, (s->>'lat')::double precision, (s->>'lng')::double precision);
    if best is null or d < best then best := d; bestname := s->>'name'; end if;
    if d <= coalesce((s->>'radius')::double precision, 100) then
      return jsonb_build_object('site', s->>'name', 'dist', round(d::numeric, 1));
    end if;
  end loop;
  raise exception 'أنت خارج نطاق العمل. أقرب موقع (%) على بعد % متر', bestname, round(best::numeric);
end $$;

-- تسجيل حضور: الوقت والتاريخ من السيرفر بتوقيت القاهرة
create or replace function public.check_in(p_lat double precision default null, p_lng double precision default null, p_acc double precision default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare emp text := public.my_emp(); e public.employees; g jsonb; d date := (now() at time zone 'Africa/Cairo')::date;
        t text := to_char(now() at time zone 'Africa/Cairo', 'HH24:MI'); a public.attendance;
begin
  if emp is null then raise exception 'حسابك غير مربوط بملف موظف، كلّم الموارد البشرية'; end if;
  select * into e from public.employees where id = emp;
  if e.status = 'terminated' then raise exception 'الخدمة منتهية'; end if;
  if e.hire is not null and d < e.hire then raise exception 'لسه ما بدأتش الخدمة'; end if;
  select * into a from public.attendance where emp_id = emp and date = d;
  if found and a.check_in is not null then raise exception 'سجّلت حضورك النهارده الساعة %', a.check_in; end if;
  g := public.geo_check(emp, p_lat, p_lng, p_acc);
  if found then
    update public.attendance set check_in = t, in_lat = p_lat, in_lng = p_lng, in_acc = p_acc, in_dist = (g->>'dist')::numeric, in_site = g->>'site', source = 'app' where id = a.id;
  else
    insert into public.attendance (emp_id, date, check_in, in_lat, in_lng, in_acc, in_dist, in_site, source)
    values (emp, d, t, p_lat, p_lng, p_acc, (g->>'dist')::numeric, g->>'site', 'app');
  end if;
  return jsonb_build_object('time', t, 'date', d, 'site', g->>'site', 'dist', g->'dist');
end $$;

create or replace function public.check_out(p_lat double precision default null, p_lng double precision default null, p_acc double precision default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare emp text := public.my_emp(); g jsonb; d date := (now() at time zone 'Africa/Cairo')::date;
        t text := to_char(now() at time zone 'Africa/Cairo', 'HH24:MI'); a public.attendance;
begin
  if emp is null then raise exception 'حسابك غير مربوط بملف موظف، كلّم الموارد البشرية'; end if;
  select * into a from public.attendance where emp_id = emp and date = d;
  if not found or a.check_in is null then raise exception 'لازم تسجل الحضور الأول'; end if;
  if a.check_out is not null then raise exception 'سجّلت انصرافك النهارده الساعة %', a.check_out; end if;
  if t < a.check_in then raise exception 'وقت الانصراف قبل الحضور'; end if;
  g := public.geo_check(emp, p_lat, p_lng, p_acc);
  update public.attendance set check_out = t, out_lat = p_lat, out_lng = p_lng, out_acc = p_acc, out_dist = (g->>'dist')::numeric where id = a.id;
  return jsonb_build_object('time', t, 'date', d, 'site', g->>'site', 'dist', g->'dist');
end $$;

-- إعدادات التطبيق للموظف: القواعد اللي يحتاجها فقط (مش الرواتب ولا الثوابت)
create or replace function public.app_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'leaves', (select value from public.settings where key = 'leaves'),
    'pay', (select jsonb_build_object('weekend', value->'weekend', 'holidays', value->'holidays') from public.settings where key = 'rules'),
    'company', (select value->'company' from public.settings where key = 'rules'),
    'geo', jsonb_build_object('enabled', coalesce((select (value->>'enabled')::boolean from public.settings where key = 'geofence'), false)),
    'me', (select jsonb_build_object('id', e.id, 'name', e.name, 'title', e.title, 'dept', e.dept, 'hire', e.hire, 'status', e.status, 'remote', e.remote_ok,
             'isManager', exists (select 1 from public.employees r where r.manager_id = e.id and r.status <> 'terminated')) from public.employees e where e.id = public.my_emp()))
$$;

-- قسايم الموظف: بعد اعتماد الشهر فقط
create or replace function public.my_payslips() returns table(month text, status text, approved_at timestamptz, data jsonb)
language sql stable security definer set search_path = public as $$
  select r.month, r.status, r.approved_at, l.data from public.payroll_lines l join public.payroll_runs r on r.id = l.run_id
  where l.emp_id = public.my_emp() and r.status in ('approved', 'paid') order by r.month desc
$$;

-- المدير المباشر: فريقه بدون أي بيانات مالية
create or replace function public.team_directory() returns table(id text, name text, title text, dept text)
language sql stable security definer set search_path = public as $$
  select e.id, e.name, e.title, e.dept from public.employees e where e.manager_id = public.my_emp() and e.status <> 'terminated' order by e.name
$$;

create or replace function public.manager_decide_leave(p_id text, p_approve boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare l public.leaves; me public.employees;
begin
  select * into l from public.leaves where id = p_id;
  if not found or l.status <> 'معلقة' or not public.is_my_report(l.emp_id) then raise exception 'مش مسموح لك بالقرار على الطلب ده'; end if;
  select * into me from public.employees where id = public.my_emp();
  if p_approve then
    update public.leaves set mgr_status = 'موافق', mgr_by = me.name, mgr_at = now(), mgr_reason = null where id = p_id;
  else
    if coalesce(trim(p_reason), '') = '' then raise exception 'سبب الرفض مطلوب'; end if;
    update public.leaves set status = 'مرفوضة', reject_reason = p_reason, mgr_status = 'مرفوض', mgr_by = me.name, mgr_at = now(), mgr_reason = p_reason, decided_by = me.name, decided_at = now() where id = p_id;
  end if;
end $$;

-- ---------- سياسات إضافية ----------
-- الموظف يلغي طلبه المعلق فقط
drop policy if exists self_cancel on public.leaves;
create policy self_cancel on public.leaves for delete to authenticated using (emp_id = public.my_emp() and status = 'معلقة');
-- طلب الموظف: معلق وبدون أي قرار جاهز
drop policy if exists self_request on public.leaves;
create policy self_request on public.leaves for insert to authenticated with check (emp_id = public.my_emp() and status = 'معلقة' and coalesce(mgr_status, '') = '' and decided_by is null);
-- المدير يقرأ إجازات وحضور فريقه (قراءة فقط)
drop policy if exists team_read on public.leaves;     create policy team_read on public.leaves     for select to authenticated using (public.is_my_report(emp_id));
drop policy if exists team_read on public.attendance; create policy team_read on public.attendance for select to authenticated using (public.is_my_report(emp_id));

-- الدوال متاحة للمستخدمين المسجلين فقط
revoke execute on function public.check_in(double precision, double precision, double precision) from public, anon;
revoke execute on function public.check_out(double precision, double precision, double precision) from public, anon;
revoke execute on function public.app_config() from public, anon;
revoke execute on function public.my_payslips() from public, anon;
revoke execute on function public.team_directory() from public, anon;
revoke execute on function public.manager_decide_leave(text, boolean, text) from public, anon;
grant execute on function public.check_in(double precision, double precision, double precision) to authenticated;
grant execute on function public.check_out(double precision, double precision, double precision) to authenticated;
grant execute on function public.app_config() to authenticated;
grant execute on function public.my_payslips() to authenticated;
grant execute on function public.team_directory() to authenticated;
grant execute on function public.manager_decide_leave(text, boolean, text) to authenticated;
