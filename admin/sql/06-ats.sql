-- ════════════════════════════════════════════
-- نظام ATS — جداول الوظائف والمقابلات
-- شغّل هذا الملف مرة واحدة في Supabase SQL Editor
-- ════════════════════════════════════════════

-- جدول الوظائف
create table if not exists ats_jobs (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  dept        text,
  type        text,          -- full / part / contract / intern
  salary      numeric,
  description text,
  req         text,          -- المتطلبات
  status      text not null default 'open',  -- open / hold / closed
  created_at  timestamptz default now()
);

-- جدول المقابلات
create table if not exists ats_interviews (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  text not null,   -- foreign key ناعم لـ candidates.id
  date          date not null,
  time          text,
  type          text,            -- هاتفية / أونلاين / شخصية / تقنية
  interviewer   text,
  result        text,            -- ناجح / راسب / معلق
  notes         text,
  created_at    timestamptz default now()
);

-- تحديث جدول candidates: stage يصبح text بدل integer
alter table candidates
  alter column stage type text using (
    case stage::text
      when '0' then 'applied'
      when '1' then 'screening'
      when '2' then 'interview'
      when '3' then 'offer'
      else stage::text
    end
  );

-- إضافة حقول إضافية للمرشح
alter table candidates
  add column if not exists job_id      uuid references ats_jobs(id) on delete set null,
  add column if not exists email       text,
  add column if not exists source      text,
  add column if not exists cv_url      text,
  add column if not exists note        text,
  add column if not exists offer_salary numeric,
  add column if not exists offer_start  date,
  add column if not exists offer_note   text;

-- RLS
alter table ats_jobs        enable row level security;
alter table ats_interviews  enable row level security;

-- السماح للـ authenticated بالقراءة
create policy "read ats_jobs"       on ats_jobs       for select using (auth.role() = 'authenticated');
create policy "read ats_interviews" on ats_interviews for select using (auth.role() = 'authenticated');

-- السماح للـ hr/admin بالكتابة
create policy "write ats_jobs"       on ats_jobs       for all using (true) with check (true);
create policy "write ats_interviews" on ats_interviews for all using (true) with check (true);
