/* طبقة البيانات الحقيقية (Supabase). تحل محل التخزين المحلي لما يتملأ js/config.js */
(function () {
  const H = window.HR, C = window.HR_CONFIG || {};
  if (!C.supabaseUrl || !C.supabaseKey) return;           // وضع تجريبي صريح: الإعداد فاضي
  if (!window.supabase) {                                 // الإعداد موجود لكن المكتبة ما اتحملتش: ممنوع الدخول
    H.mode = 'error';
    H.auth = { async ready() { throw new Error('تعذر تحميل مكتبة الاتصال بقاعدة البيانات. اتأكد من الاتصال بالإنترنت وحدّث الصفحة.'); }, async logoutSoft() {}, async logout() {} };
    return;
  }
  // تنظيف الرابط لو اتلصق ومعاه /rest/v1 أو / زيادة في آخره
  const URL_CLEAN = String(C.supabaseUrl).trim().replace(/\/+$/, '').replace(/\/(rest|auth)\/v1$/, '').replace(/\/+$/, '');
  const sb = window.supabase.createClient(URL_CLEAN, String(C.supabaseKey).trim());
  H.mode = 'supabase';

  const TABLE = { employees: 'employees', attendance: 'attendance', leaves: 'leaves', candidates: 'candidates', payroll: 'payroll_adjustments', reviews: 'reviews', documents: 'documents', timeline: 'timeline', profiles: 'profiles' };
  const COLS = {
    employees: 'id name title dept phone email salary allowances hire status nid birth gender gov marital military address emerg_name emerg_phone emerg_rel contract_type contract_end probation_end insurance_no bank iban manager_id photo',
    attendance: 'id emp_id date check_in check_out',
    leaves: 'id emp_id type from_date to_date days note status',
    candidates: 'id name role stage phone',
    payroll: 'id emp_id month bonus absent other',
    reviews: 'id emp_id period q t p i avg note',
    documents: 'id emp_id type received expiry note file fname',
    timeline: 'id emp_id date type text',
    profiles: 'id email full_name role employee_id'
  };
  Object.keys(COLS).forEach(k => COLS[k] = COLS[k].split(' '));
  const REN = { employees: { allow: 'allowances' }, attendance: { in: 'check_in', out: 'check_out' }, leaves: { from: 'from_date', to: 'to_date' } };
  const snake = k => k.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
  const camel = k => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  function toDb(t, o) {
    const r = {};
    Object.keys(o).forEach(k => {
      const col = (REN[t] && REN[t][k]) || snake(k);
      if (COLS[t].indexOf(col) < 0 || o[k] === undefined) return;
      r[col] = o[k] === '' ? null : o[k];
    });
    return r;
  }
  function fromDb(t, row) {
    const rev = {}; Object.keys(REN[t] || {}).forEach(k => rev[REN[t][k]] = k);
    const r = {};
    COLS[t].forEach(c => { if (c in row) r[rev[c] || camel(c)] = row[c] === null ? '' : row[c]; });
    return r;
  }
  const MSG = { '23505': 'القيمة مكررة (رقم قومي أو سجل موجود بالفعل)', '23514': 'قيمة غير مسموحة في أحد الحقول', '23P01': 'الإجازة متداخلة مع إجازة أخرى لنفس الموظف', '23503': 'السجل مرتبط ببيانات أخرى', '42501': 'ليس لديك صلاحية لهذه العملية', 'PGRST301': 'انتهت الجلسة، سجّل الدخول من جديد' };
  const fail = e => { if (e) throw new Error(MSG[e.code] || e.message || 'خطأ في الاتصال بقاعدة البيانات'); };

  H.store = {
    async list(t) {
      let out = [], from = 0;
      for (;;) {
        const { data, error } = await sb.from(TABLE[t]).select('*').order('created_at').range(from, from + 999);
        fail(error); out = out.concat(data);
        if (data.length < 1000) break; from += 1000;
      }
      return out.map(r => fromDb(t, r));
    },
    async create(t, row) { const { data, error } = await sb.from(TABLE[t]).insert(toDb(t, row)).select().single(); fail(error); return fromDb(t, data); },
    async update(t, id, patch) { const p = toDb(t, patch); delete p.id; const { data, error } = await sb.from(TABLE[t]).update(p).eq('id', id).select().single(); fail(error); return fromDb(t, data); },
    async createMany(t, rows) {
      let out = [];
      for (let i = 0; i < rows.length; i += 100) {
        const { data, error } = await sb.from(TABLE[t]).insert(rows.slice(i, i + 100).map(r => toDb(t, r))).select();
        fail(error); out = out.concat(data);
      }
      return out.map(r => fromDb(t, r));
    },
    async audit(limit) { const { data, error } = await sb.from('audit_log').select('*').order('at', { ascending: false }).limit(limit || 300); fail(error); return data; },
    async remove(t, id) { const { error } = await sb.from(TABLE[t]).delete().eq('id', id); fail(error); }
  };

  const BUCKET = 'employee-docs';
  H.files = {
    max: 5 * 1024 * 1024,
    note: 'الملفات محفوظة في تخزين خاص ومحمي بالصلاحيات، وبتتفتح برابط مؤقت (5 دقايق). الحد الأقصى 5 ميجا للملف.',
    async upload(empId, key, f) {
      const ext = (f.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = empId + '/' + key + '-' + Date.now() + '.' + ext;
      const { error } = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type || undefined });
      fail(error); return path;
    },
    async url(ref) { const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(ref, 300); fail(error); return data.signedUrl; }
  };

  H.auth = {
    async ready() {
      const { data } = await sb.auth.getSession();
      if (data.session) await this.load(data.session.user);
    },
    async load(u) {
      const { data, error } = await sb.from('profiles').select('*').eq('id', u.id).maybeSingle();
      fail(error);
      if (!data) throw new Error('الحساب موجود لكن ملفه الشخصي غير مُنشأ. شغّل سكربت الجداول وسكربت إنشاء الملفات الناقصة');
      H.user = { id: u.id, email: u.email, name: data.full_name || u.email, role: data.role };
    },
    async login(email, pw) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
      if (error) {
        const m = (error.message || '').toLowerCase();
        if (m.indexOf('invalid login') > -1) throw new Error('الإيميل أو كلمة المرور غير صحيحة');
        if (m.indexOf('not confirmed') > -1) throw new Error('الحساب لم يتم تأكيده. في Supabase افتح المستخدم واضغط Confirm');
        throw new Error('تعذر تسجيل الدخول: ' + error.message);
      }
      await this.load(data.user);
    },
    async logoutSoft() { await sb.auth.signOut(); H.user = null; },
    async logout() { await this.logoutSoft(); location.reload(); }
  };
})();
