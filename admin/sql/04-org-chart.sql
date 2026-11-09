-- =====================================================================
-- 04-org-chart.sql — الهيكل التنظيمي + تدفق الموافقة المتدرج
-- =====================================================================

-- 1. إضافة manager_id على جدول employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES employees(id) ON DELETE SET NULL;

-- 2. تحديث role constraint على profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin','hr','manager','employee'));

-- 3. حقول تدفق الموافقة على leaves
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS mgr_status TEXT;
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS mgr_by     TEXT;
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS mgr_at     TIMESTAMPTZ;

-- 4. index للأداء
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);

-- 5. RLS policies (DROP أول عشان نتجنب التكرار)
DROP POLICY IF EXISTS "manager_sees_team_employees" ON employees;
DROP POLICY IF EXISTS "manager_sees_team_leaves"    ON leaves;

CREATE POLICY "manager_sees_team_employees"
  ON employees FOR SELECT
  USING (
    manager_id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
    OR id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','hr'))
  );

CREATE POLICY "manager_sees_team_leaves"
  ON leaves FOR SELECT
  USING (
    emp_id IN (
      SELECT id FROM employees
      WHERE manager_id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
    )
    OR emp_id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','hr'))
  );
