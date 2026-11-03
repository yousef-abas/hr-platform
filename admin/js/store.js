/* طبقة البيانات: كل الصفحات تتعامل مع HR.store فقط.
   لاحقًا نستبدل LocalAdapter بـ SupabaseAdapter بنفس الدوال من غير ما نغيّر أي صفحة. */
(function () {
  const KEY = 'hr-v2';
  const uid = () => Math.random().toString(36).slice(2, 9);
  const dayStr = (back) => { const d = new Date(); d.setDate(d.getDate() - back); return d.toISOString().slice(0, 10); };

  function seed() {
    const E = [
      ['أحمد سمير', 'محاسب أول', 'المالية', 14000, 1500],
      ['منى خالد', 'مسؤولة موارد بشرية', 'الموارد البشرية', 16000, 2000],
      ['محمود عادل', 'مندوب مبيعات', 'المبيعات', 9000, 1000],
      ['سارة يوسف', 'خدمة عملاء', 'المبيعات', 8500, 800],
      ['عمر فتحي', 'مطور برمجيات', 'التقنية', 20000, 2500],
      ['هدى مصطفى', 'مصممة واجهات', 'التقنية', 15000, 1500]
    ].map((r, i) => ({ id: 'e' + (i + 1), name: r[0], title: r[1], dept: r[2], salary: r[3], allow: r[4], phone: '0100' + (1000000 + i * 111111), email: '', hire: '202' + (2 + i % 3) + '-0' + (i + 3) + '-10', status: i === 3 ? 'leave' : 'active' }));
    const X = {
      e1: { nid: '29501011234577', birth: '1995-01-01', gender: 'ذكر', gov: 'الدقهلية', marital: 'متزوج', military: 'أدى الخدمة', contractType: 'دائم', insuranceNo: '1234567', bank: 'البنك الأهلي المصري', iban: 'EG380019000500000000263180002', emergName: 'سمير محمد', emergPhone: '01000000001', emergRel: 'الأب', address: 'مدينة نصر، القاهرة', managerId: 'e2', email: 'ahmed@example.com' },
      e2: { nid: '29803151234546', birth: '1998-03-15', gender: 'أنثى', gov: 'الدقهلية', marital: 'متزوج', military: 'لا ينطبق', contractType: 'دائم', insuranceNo: '7654321', bank: 'بنك مصر', emergName: 'خالد حسن', emergPhone: '01000000002', emergRel: 'الزوج', address: 'المعادي، القاهرة', email: 'mona@example.com' },
      e3: { contractType: 'محدد المدة', contractEnd: dayStr(-45), managerId: 'e2' },
      e5: { nid: '29707201234577', birth: '1997-07-20', gender: 'ذكر', gov: 'الدقهلية', contractType: 'دائم', managerId: 'e2' },
      e6: { contractType: 'تحت التجربة', probationEnd: dayStr(-20), managerId: 'e5' }
    };
    E.forEach(e => Object.assign(e, X[e.id] || {}));
    const docs = [], dd = (empId, type, received, expiry) => docs.push({ id: uid(), empId, type, received, expiry: expiry || '' });
    ['id', 'birth', 'edu', 'crim', 'mil', 'contract', 'med', 'photo'].forEach(k => dd('e1', k, dayStr(500), k === 'id' ? dayStr(-20) : ''));
    ['id', 'birth', 'edu', 'crim', 'contract', 'photo'].forEach(k => dd('e2', k, dayStr(700), k === 'id' ? dayStr(-900) : ''));
    ['id', 'birth'].forEach(k => dd('e5', k, dayStr(200), ''));
    const A = [];
    for (let d = 0; d < 7; d++) E.forEach((e, i) => {
      if (e.status !== 'active' || (d + i) % 5 === 3) return;
      A.push({ id: uid(), empId: e.id, date: dayStr(d), in: (i + d) % 4 === 0 ? '09:48' : '08:5' + (i % 10), out: d === 0 ? '' : '17:0' + (i % 10) });
    });
    return {
      employees: E, attendance: A,
      leaves: [
        { id: uid(), empId: 'e4', type: 'سنوية', from: dayStr(1), to: dayStr(-3), days: 5, note: '', status: 'معتمدة' },
        { id: uid(), empId: 'e3', type: 'عارضة', from: dayStr(-2), to: dayStr(-2), days: 1, note: '', status: 'معلقة' }
      ],
      candidates: [
        { id: uid(), name: 'كريم حسن', role: 'مندوب مبيعات', stage: 0 },
        { id: uid(), name: 'نورا علي', role: 'محاسب', stage: 1 },
        { id: uid(), name: 'ياسر محمد', role: 'مطور برمجيات', stage: 2 }
      ],
      payroll: [], documents: docs,
      timeline: [
        { id: uid(), empId: 'e1', date: dayStr(400), type: 'ترقية', text: 'ترقية إلى محاسب أول' },
        { id: uid(), empId: 'e1', date: dayStr(200), type: 'تغيير راتب', text: 'زيادة سنوية 10%' },
        { id: uid(), empId: 'e5', date: dayStr(100), type: 'دورة تدريبية', text: 'دورة أمن المعلومات' }
      ],
      reviews: [
        { id: uid(), empId: 'e1', period: '2026-09', q: 5, t: 4, p: 5, i: 4, avg: 4.5, note: 'دقة عالية في إغلاق الشهر' },
        { id: uid(), empId: 'e5', period: '2026-09', q: 5, t: 5, p: 4, i: 5, avg: 4.8, note: 'قاد تسليم المشروع في موعده' }
      ]
    };
  }

  const Local = {
    db: null,
    load() { try { this.db = JSON.parse(localStorage.getItem(KEY)); } catch (e) {} if (!this.db) this.db = seed(); ['employees', 'attendance', 'leaves', 'candidates', 'payroll', 'reviews', 'documents', 'timeline', 'profiles'].forEach(k => { this.db[k] = this.db[k] || []; }); if (!this.db.profiles.length) this.db.profiles = [{ id: 'demo', email: 'demo@local', fullName: 'مدير النظام', role: 'admin', employeeId: '' }]; },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.db)); } catch (e) {} },
    async list(t) { return this.db[t].map(x => ({ ...x })); },
    async create(t, row) { row = { id: uid(), ...row }; this.db[t].push(row); this.save(); return row; },
    async update(t, id, patch) { const r = this.db[t].find(x => x.id === id); if (r) Object.assign(r, patch); this.save(); return r; },
    async createMany(t, rows) { const out = []; for (const r of rows) out.push(await this.create(t, r)); return out; },
    async audit() { return []; },
    async remove(t, id) { this.db[t] = this.db[t].filter(x => x.id !== id); this.save(); },
    async reset() { this.db = seed(); this.save(); }
  };
  Local.load();
  const files = {
    max: 250 * 1024,
    note: 'رفع الملفات هنا للتجربة فقط (حد أقصى 250 كيلوبايت للملف). التخزين الحقيقي والآمن يتفعل مع ربط قاعدة البيانات.',
    upload(empId, key, f) { return new Promise(r => { const x = new FileReader(); x.onload = () => r(x.result); x.readAsDataURL(f); }); },
    async url(ref) { const b = await (await fetch(ref)).blob(); return URL.createObjectURL(b); }
  };
  window.HR = { store: Local, files, state: {}, pages: {}, mode: 'local' };
})();
