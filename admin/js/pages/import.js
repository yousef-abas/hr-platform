/* استيراد الموظفين من Excel أو CSV */
HR.IMPORT_COLS = [['الاسم', 'name'], ['الوظيفة', 'title'], ['القسم', 'dept'], ['الرقم القومي', 'nid'], ['الموبايل', 'phone'], ['الإيميل', 'email'], ['الراتب الأساسي', 'salary'], ['البدلات', 'allow'], ['تاريخ التعيين', 'hire'], ['نوع العقد', 'contractType'], ['العنوان', 'address'], ['الحالة الاجتماعية', 'marital'], ['موقف التجنيد', 'military'], ['البنك', 'bank'], ['IBAN', 'iban'], ['رقم التأمينات', 'insuranceNo']];

HR.normDate = v => {
  if (v === '' || v == null) return '';
  const ok = d => { const t = new Date(d + 'T00:00:00Z'); return !isNaN(t) && t.toISOString().slice(0, 10) === d ? d : null; };
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/.exec(s);
  if (m) return ok(m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0'));
  m = /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/.exec(s);
  if (m) return ok(m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'));
  return null;
};

/* دالة نقية: تاخد صفوف الملف وتطلع نتيجة كل صف (للاختبار والاستخدام) */
HR.importRows = function (raw, existingNids) {
  const seen = new Set(existingNids || []);
  return raw.map((r, i) => {
    const o = {}; HR.IMPORT_COLS.forEach(c => { const v = r[c[0]]; o[c[1]] = v == null ? '' : v; });
    const errs = [], d = { status: 'active', birth: '', gender: '', gov: '' };
    ['name', 'title', 'dept', 'email', 'contractType', 'address', 'marital', 'military', 'bank', 'iban', 'insuranceNo'].forEach(k => d[k] = String(o[k]).trim());
    if (!d.name) errs.push('الاسم فاضي');
    let ph = String(o.phone).replace(/\D/g, ''); if (/^1\d{9}$/.test(ph)) ph = '0' + ph; d.phone = ph;
    d.salary = o.salary === '' ? 0 : Number(String(o.salary).replace(/,/g, ''));
    d.allow = o.allow === '' ? 0 : Number(String(o.allow).replace(/,/g, ''));
    if (isNaN(d.salary) || d.salary < 0) { errs.push('الراتب غير صحيح'); d.salary = 0; }
    if (isNaN(d.allow) || d.allow < 0) { errs.push('البدلات غير صحيحة'); d.allow = 0; }
    d.hire = HR.normDate(o.hire);
    if (d.hire === null) { errs.push('تاريخ التعيين غير مفهوم'); d.hire = ''; }
    d.nid = String(o.nid).replace(/\D/g, '');
    if (d.nid) {
      const x = HR.ui.nid(d.nid);
      if (!x) errs.push('الرقم القومي غير صحيح');
      else if (seen.has(d.nid)) errs.push('الرقم القومي مكرر');
      else { Object.assign(d, x); seen.add(d.nid); }
    }
    return { line: i + 2, data: d, errs };
  });
};

HR.importEmployees = async function () {
  const { ui, store } = HR;
  if (!window.XLSX) return ui.toast('مكتبة Excel ما اتحملتش. اتأكد من الاتصال بالإنترنت');
  const m = ui.modal('استيراد موظفين من Excel', '<div id="im"></div>', true);
  const box = m.el.querySelector('#im');
  const step1 = () => {
    box.innerHTML = '<p style="color:var(--mu)">نزّل النموذج، املاه بالموظفين (الاسم إجباري والباقي اختياري)، وارفعه. هتشوف مراجعة قبل الحفظ.</p><div class="acts"><button class="btn ghost" id="tp">تحميل النموذج</button><button class="btn" id="pk">اختيار ملف Excel أو CSV</button><button class="btn ghost" id="cl">إلغاء</button></div>';
    box.querySelector('#cl').onclick = m.close;
    box.querySelector('#tp').onclick = () => {
      const ws = XLSX.utils.aoa_to_sheet([HR.IMPORT_COLS.map(c => c[0]), ['أحمد علي', 'محاسب', 'المالية', '29501011234577', '01001234567', 'ahmed@example.com', 12000, 1500, '2024-03-01', 'دائم', 'القاهرة', 'متزوج', 'أدى الخدمة', 'البنك الأهلي', '', '']]);
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'الموظفون'); XLSX.writeFile(wb, 'employees-template.xlsx');
    };
    box.querySelector('#pk').onclick = () => {
      const i = document.createElement('input'); i.type = 'file'; i.accept = '.xlsx,.xls,.csv';
      i.onchange = async () => {
        try {
          const wb = XLSX.read(await i.files[0].arrayBuffer(), { type: 'array' });
          const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
          const ex = (await store.list('employees')).map(e => e.nid).filter(Boolean);
          step2(HR.importRows(raw.filter(r => Object.values(r).some(v => String(v).trim() !== '')), ex));
        } catch (e) { ui.toast('تعذر قراءة الملف: ' + e.message); }
      };
      i.click();
    };
  };
  const step2 = res => {
    const ok = res.filter(r => !r.errs.length), bad = res.length - ok.length;
    box.innerHTML = '<p><b>' + res.length + '</b> صف في الملف: ' + ui.tag(ok.length + ' صالح', 'ok') + ' ' + (bad ? ui.tag(bad + ' فيه مشاكل (هيتخطى)', 'da') : '') + '</p>' +
      '<div class="tw" style="max-height:340px;overflow:auto"><table><tr><th>سطر</th><th>الاسم</th><th>الوظيفة</th><th>القسم</th><th>الراتب</th><th>التعيين</th><th>الحالة</th></tr>' +
      res.slice(0, 200).map(r => '<tr><td>' + r.line + '</td><td>' + ui.esc(r.data.name) + '</td><td>' + ui.esc(r.data.title) + '</td><td>' + ui.esc(r.data.dept) + '</td><td>' + ui.money(r.data.salary) + '</td><td>' + (r.data.hire || '—') + '</td><td>' + (r.errs.length ? ui.tag(r.errs.join('، '), 'da') : ui.tag('جاهز', 'ok')) + '</td></tr>').join('') + '</table></div>' +
      '<div class="acts"><button class="btn" id="go"' + (ok.length ? '' : ' disabled') + '>استيراد ' + ok.length + ' موظف</button><button class="btn ghost" id="bk">رجوع</button></div>';
    box.querySelector('#bk').onclick = step1;
    box.querySelector('#go').onclick = async ev => {
      ev.target.disabled = true; ev.target.textContent = 'جاري الاستيراد...';
      try { await store.createMany('employees', ok.map(r => r.data)); m.close(); ui.toast('تم استيراد ' + ok.length + ' موظف'); HR.refresh(); }
      catch (e) { ev.target.disabled = false; ev.target.textContent = 'إعادة المحاولة'; ui.toast('فشل الاستيراد: ' + e.message); }
    };
  };
  step1();
};
