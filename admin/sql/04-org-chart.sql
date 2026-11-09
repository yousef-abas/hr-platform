-- =====================================================================
-- 04-org-chart.sql — الهيكل التنظيمي + تدفق الموافقة المتدرج
-- شغّله في Supabase SQL Editor
-- =====================================================================

-- 1. إضافة managerId على جدول employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES employees(id) ON DELETE SET NULL;

-- 2. إضافة role = manager على profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin','hr','manager','employee'));

-- 3. حقول تدفق الموافقة على leaves
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS mgr_status TEXT;   -- 'موافق' | 'مرفوض' | null
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS mgr_by     TEXT;   -- email المدير
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS mgr_at     TIMESTAMPTZ;

-- 4. تحديث status values للـ leaves (معلقة عند المدير → معلقة عند HR → موافق)
-- القيم الجديدة:
-- 'معلقة'         = في انتظار المدير (أو HR مباشرة لو ما فيش مدير)
-- 'معلقة HR'      = المدير وافق، في انتظار HR
-- 'موافق عليها'   = HR وافق
-- 'مرفوضة'        = مرفوض من المدير أو HR

-- 5. RLS - المدير يشوف موظفيه بس
CREATE POLICY IF NOT EXISTS "manager_sees_team_employees"
  ON employees FOR SELECT
  USING (
    manager_id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
    OR id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','hr'))
  );

CREATE POLICY IF NOT EXISTS "manager_sees_team_leaves"
  ON leaves FOR SELECT
  USING (
    emp_id IN (
      SELECT id FROM employees
      WHERE manager_id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
    )
    OR emp_id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','hr'))
  );

-- 6. index للأداء
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);
