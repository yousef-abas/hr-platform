-- =====================================================================
-- إضافة photo لـ app_config() — عشان الموظف يشوف صورته بدون RLS مشاكل
-- شغّله في Supabase → SQL Editor
-- =====================================================================

CREATE OR REPLACE FUNCTION public.app_config() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'leaves',  (SELECT value FROM public.settings WHERE key = 'leaves'),
    'pay',     (SELECT jsonb_build_object('weekend', value->'weekend', 'holidays', value->'holidays') FROM public.settings WHERE key = 'rules'),
    'company', (SELECT value->'company' FROM public.settings WHERE key = 'rules'),
    'geo',     jsonb_build_object('enabled', COALESCE((SELECT (value->>'enabled')::boolean FROM public.settings WHERE key = 'geofence'), false)),
    'me', (
      SELECT jsonb_build_object(
        'id',        e.id,
        'name',      e.name,
        'title',     e.title,
        'dept',      e.dept,
        'hire',      e.hire,
        'status',    e.status,
        'remote',    e.remote_ok,
        'photo',     e.photo,
        'isManager', EXISTS (SELECT 1 FROM public.employees r WHERE r.manager_id = e.id AND r.status <> 'terminated')
      )
      FROM public.employees e
      WHERE e.id = public.my_emp()
    )
  )
$$;

-- تأكيد الصلاحيات
REVOKE EXECUTE ON FUNCTION public.app_config() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.app_config() TO authenticated;
