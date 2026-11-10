-- ═══════════════════════════════════════════════════════════
-- 07 — إضافة دور المشرف (supervisor) + عمود managed_dept
-- شغّله في Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. عمود managed_dept لو مش موجود (مشترك بين manager و supervisor)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS managed_dept TEXT;

-- 2. تحديث الـ RLS check_role لو عندك constraint
--    (لو مش عندك constraint تجاهل السطرين دول)
-- ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
-- ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
--   CHECK (role IN ('admin','hr','manager','supervisor','employee'));

-- 3. منح صلاحية للمشرف يقرأ موظفي قسمه (مثل المدير)
-- ملاحظة: لو عندك RLS على employees ضيف policy للـ supervisor

-- تحقق
SELECT id, email, role, managed_dept FROM profiles ORDER BY role;
