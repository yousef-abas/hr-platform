/* ─────────────────────────────────────────────────────────────────────
   backup.js — تصدير واستيراد كامل لبيانات النظام
   ───────────────────────────────────────────────────────────────────── */
HR.backup = {

  /* ── تصدير كل البيانات كـ JSON ── */
  async export() {
    const ui = HR.ui, store = HR.store;
    ui.toast('جاري تجميع البيانات...');
    try {
      const tables = ['employees','attendance','leaves','candidates','payroll','reviews','documents','timeline','settings','runs','lines','loans'];
      const data = { version: 2, exportedAt: new Date().toISOString(), tables: {} };
      await Promise.all(tables.map(async t => {
        try { data.tables[t] = await store.list(t); }
        catch(_) { data.tables[t] = []; }
      }));
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'hr-backup-' + new Date().toISOString().slice(0,10) + '.json';
      a.click();
      ui.toast('✅ تم تصدير ' + Object.values(data.tables).reduce((s,t) => s+t.length,0) + ' سجل بنجاح');
    } catch(e) {
      ui.toast('فشل التصدير: ' + e.message);
    }
  },

  /* ── عرض modal الـ backup ── */
  show() {
    const ui = HR.ui;
    const lastBackup = localStorage.getItem('hr-last-backup');
    const m = ui.modal('💾 النسخ الاحتياطي', `
      <div style="display:flex;flex-direction:column;gap:16px;padding:4px 0">

        <div class="al ok">
          <span>✅</span>
          <div>البيانات محفوظة على Supabase — النسخ الاحتياطي هنا للحماية الإضافية فقط.</div>
        </div>

        <div class="card" style="padding:16px">
          <h4 style="margin-bottom:8px;font-weight:800">📤 تصدير نسخة احتياطية</h4>
          <p style="font-size:13px;color:var(--mu);margin-bottom:12px">
            يصدّر كل البيانات (موظفون، حضور، إجازات، رواتب...) كملف JSON يمكن حفظه على جهازك.
          </p>
          ${lastBackup ? '<p style="font-size:12px;color:var(--mu)">آخر نسخة: ' + new Date(lastBackup).toLocaleDateString('ar-EG') + '</p>' : ''}
          <button class="btn" id="do-export">⬇️ تحميل النسخة الاحتياطية الآن</button>
        </div>

        <div class="card" style="padding:16px">
          <h4 style="margin-bottom:8px;font-weight:800">📊 تصدير Excel</h4>
          <p style="font-size:13px;color:var(--mu);margin-bottom:12px">
            تصدير قائمة الموظفين كملف Excel.
          </p>
          <button class="btn ghost" id="do-excel">📊 تصدير الموظفين Excel</button>
        </div>

        <div class="al wa">
          <span>!</span>
          <div>ننصح بعمل نسخة احتياطية أسبوعياً وحفظها في مكان آمن.</div>
        </div>

        <button class="btn ghost" id="close-bk">إغلاق</button>
      </div>
    `);

    m.el.querySelector('#close-bk').onclick = m.close;

    m.el.querySelector('#do-export').onclick = async () => {
      localStorage.setItem('hr-last-backup', new Date().toISOString());
      await HR.backup.export();
    };

    m.el.querySelector('#do-excel').onclick = async () => {
      if (!window.XLSX) return ui.toast('مكتبة Excel غير محملة');
      const E = await HR.store.list('employees');
      const rows = [['الاسم','الوظيفة','القسم','الراتب','البدلات','الحالة','التعيين','الهاتف','الإيميل']];
      E.forEach(e => rows.push([e.name,e.title,e.dept,e.salary,e.allow||0,e.status,e.hire,e.phone,e.email]));
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'الموظفون');
      XLSX.writeFile(wb, 'employees-' + new Date().toISOString().slice(0,10) + '.xlsx');
      ui.toast('✅ تم تصدير ' + E.length + ' موظف');
    };
  }
};
