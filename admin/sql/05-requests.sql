-- جدول الطلبات (سلف · أوفر تايم · تغيير بيانات)
CREATE TABLE IF NOT EXISTS requests (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  emp_id      UUID REFERENCES employees(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('loan','overtime','change')),
  status      TEXT NOT NULL DEFAULT 'معلقة',

  -- سلفة
  amount      NUMERIC,
  months      INTEGER,
  remaining   NUMERIC,
  reason      TEXT,

  -- أوفر تايم
  date        DATE,
  hours       NUMERIC,

  -- تغيير بيانات
  field       TEXT,
  new_value   TEXT,

  -- مشترك
  note        TEXT,
  hr_note     TEXT,
  hr_by       TEXT,
  hr_at       TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

-- HR/Admin يشوف كل شيء
CREATE POLICY hr_all_requests ON requests
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','hr'))
  );

-- الموظف يشوف طلباته بس
CREATE POLICY emp_own_requests ON requests
  FOR ALL TO authenticated
  USING (
    emp_id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
  );

-- المدير يشوف طلبات فريقه
CREATE POLICY mgr_team_requests ON requests
  FOR SELECT TO authenticated
  USING (
    emp_id IN (
      SELECT id FROM employees
      WHERE manager_id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
    )
  );
