# نظام الموارد البشرية

- `admin/` لوحة الإدارة (HTML/CSS/JS بدون أدوات بناء)
- `supabase/schema.sql` الجداول والصلاحيات وتخزين المستندات

## التشغيل على Supabase
1. أنشئ مشروعًا على supabase.com.
2. SQL Editor ← الصق محتوى `supabase/schema.sql` ← Run.
3. Authentication ← Users ← Add user (فعّل Auto Confirm User).
4. شغّل: `update public.profiles set role = 'admin' where email = 'إيميلك';`
5. افتح `admin/js/config.js` وضع `supabaseUrl` و`supabaseKey` (anon key فقط).
6. ارفع على GitHub وافتح الموقع، وهيطلب تسجيل الدخول.

> المفتاح العام (anon) مصمم يكون ظاهر في الكود، والحماية الحقيقية من RLS في `schema.sql`.
> ممنوع وضع `service_role` في أي ملف.
