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
      payroll: []
    };
  }

  const Local = {
    db: null,
    load() { try { this.db = JSON.parse(localStorage.getItem(KEY)); } catch (e) {} if (!this.db) this.db = seed(); },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.db)); } catch (e) {} },
    async list(t) { return this.db[t].map(x => ({ ...x })); },
    async create(t, row) { row = { id: uid(), ...row }; this.db[t].push(row); this.save(); return row; },
    async update(t, id, patch) { const r = this.db[t].find(x => x.id === id); if (r) Object.assign(r, patch); this.save(); return r; },
    async remove(t, id) { this.db[t] = this.db[t].filter(x => x.id !== id); this.save(); },
    async reset() { this.db = seed(); this.save(); }
  };
  Local.load();
  window.HR = { store: Local, state: {}, pages: {} };
})();
