/* أدوات الرواتب: مقارنة، قائمة فحص، سلف، تصدير، قسايم */
(function () {
  const H = window.HR, T = H.payrollTools = {};
  const num = v => Number(v) || 0;

  /* ---- مقارنة بآخر شهر معتمد ---- */
  T.compare = function (rows, prevRows, thr) {
    const pm = {}; prevRows.forEach(r => { pm[r.id] = r; });
    const map = c => { const o = {}; c.lines.forEach(l => { o[l.label] = (o[l.label] || 0) + (l.t === 'ded' ? -l.amount : l.amount); }); return o; };
    const out = [];
    rows.forEach(r => {
      const p = pm[r.id];
      if (!p) { out.push({ name: r.name, kind: 'new', net: r.calc.net, pct: 0 }); return; }
      const diff = r.calc.net - p.calc.net, pct = p.calc.net ? diff / p.calc.net * 100 : (diff ? 100 : 0);
      if (Math.abs(pct) < thr) return;
      const a = map(r.calc), b = map(p.calc), labs = Object.keys(Object.assign({}, a, b));
      const reasons = labs.map(k => ({ k, d: (a[k] || 0) - (b[k] || 0) })).filter(x => Math.abs(x.d) >= 1).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 3);
      out.push({ name: r.name, kind: 'chg', prev: p.calc.net, net: r.calc.net, diff, pct, reasons });
    });
    prevRows.forEach(p => { if (!rows.find(r => r.id === p.id)) out.push({ name: p.name, kind: 'gone', prev: p.calc.net, pct: 0 }); });
    return out.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  };

  /* ---- قائمة الفحص قبل الاعتماد ---- */
  T.checklist = function (o) {
    const { rows, L0, A0, E0, per, rules } = o, items = [];
    const push = (text, list) => items.push({ ok: !list.length, text, names: list });
    push('طلبات إجازة معلقة داخل الفترة (لسه ما اتحسمتش)', L0.filter(l => l.status === 'معلقة' && l.from <= per.end && l.to >= per.start).map(l => (E0.find(e => e.id === l.empId) || {}).name || '؟'));
    if (rules.attendance.auto) push('موظفون ما عندهمش أي حضور مسجل في الفترة (هيتحسبوا غياب كامل)', rows.filter(r => !A0.some(a => a.empId === r.id && a.in && a.date >= per.start && a.date <= per.end)).map(r => r.name));
    push('موظفون عليهم تنبيهات في الحساب', rows.filter(r => r.calc.flags.length).map(r => r.name + ' (' + r.calc.flags.join('، ') + ')'));
    push('موظفون بدون IBAN أو بنك (مش هيدخلوا ملف التحويل)', rows.filter(r => { const e = E0.find(x => x.id === r.id) || {}; return !e.iban || !e.bank; }).map(r => r.name));
    push('موظفون راتبهم جزئي (تعيين أو إنهاء خدمة داخل الفترة): اتحسب بالتناسب تلقائيًا، راجع الأيام', rows.filter(r => r.calc.meta.prorated).map(r => r.name + ' (' + r.calc.meta.prorated.days + ' من ' + r.calc.meta.prorated.of + ' يوم)'));
    return items;
  };

  /* ---- قسيمة الراتب ---- */
  T.slipHtml = function (r, month, company) {
    const ui = H.ui, esc = ui.esc, c = r.calc;
    return '<div class="slipx"><div class="sx-h"><b>' + esc((company && company.name) || 'قسيمة راتب') + '</b><span>قسيمة راتب • ' + month + '</span></div>' +
      '<div class="sx-i"><div>الموظف: <b>' + esc(r.name) + '</b></div><div>القسم: ' + esc(r.dept || '—') + '</div><div>الوظيفة: ' + esc(r.title || '—') + '</div></div>' +
      '<table class="slip">' + c.lines.map(l => '<tr><td>' + esc(l.label) + (l.note ? ' <small style="color:var(--mu)">(' + esc(l.note) + ')</small>' : '') + '</td><td>' + (l.t === 'ded' ? '−' : '') + ui.money(l.amount) + '</td></tr>').join('') +
      '<tr><td><b>الصافي</b></td><td class="net">' + ui.money(c.net) + '</td></tr></table>' +
      '<div class="sx-sig"><span>توقيع الموظف: ____________</span><span>اعتماد: ____________</span></div></div>';
  };
  T.printSlips = function (rows, month, company, title) {
    const ui = H.ui;
    const m = ui.modal(title || 'قسايم الرواتب', rows.map(r => T.slipHtml(r, month, company)).join('') + '<div class="acts noprint"><button class="btn" id="pr">طباعة / حفظ PDF</button><button class="btn ghost" id="cl">إغلاق</button></div>', true);
    m.el.querySelector('#pr').onclick = () => window.print(); m.el.querySelector('#cl').onclick = m.close;
  };

  /* ---- تصدير Excel ---- */
  const save = (wb, name) => window.XLSX.writeFile(wb, name);
  T.exportBank = function (rows, E0, month) {
    const X = window.XLSX, data = [['اسم الموظف', 'البنك', 'رقم الحساب / IBAN', 'المبلغ', 'الشهر', 'ملاحظات']]; let total = 0, miss = 0;
    rows.filter(r => r.calc.net > 0).forEach(r => {
      const e = E0.find(x => x.id === r.id) || {}, bad = !e.iban; if (bad) miss++;
      total += r.calc.net; data.push([r.name, e.bank || '', e.iban || '', r.calc.net, month, bad ? 'IBAN ناقص' : '']);
    });
    data.push([]); data.push(['الإجمالي', '', '', Math.round(total * 100) / 100, month, '']);
    const wb = X.utils.book_new(), ws = X.utils.aoa_to_sheet(data); ws['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 32 }, { wch: 14 }, { wch: 10 }, { wch: 14 }];
    X.utils.book_append_sheet(wb, ws, 'تحويل'); save(wb, 'bank-transfer-' + month + '.xlsx');
    return { count: rows.filter(r => r.calc.net > 0).length, missing: miss, total };
  };
  T.exportAccountant = function (rows, month) {
    const X = window.XLSX, L = (c, k) => c.lines.filter(l => l.label === k).reduce((s, l) => s + l.amount, 0), r2 = n => Math.round(n * 100) / 100;
    const head = ['الاسم', 'القسم', 'الأساسي', 'البدلات', 'بنود إضافية', 'أوفر تايم', 'مكافأة', 'الإجمالي', 'الأجر التأميني', 'تأمينات الموظف', 'تأمينات صاحب العمل', 'ضريبة', 'غياب وإجازة بدون مرتب', 'تأخير', 'سلف وجزاءات وأخرى', 'إجمالي الخصومات', 'الصافي', 'تكلفة الشركة'];
    const body = rows.map(r => { const c = r.calc, basic = L(c, 'الراتب الأساسي'), al = L(c, 'البدلات'), bonus = L(c, 'مكافأة'), ab = L(c, 'خصم الغياب') + L(c, 'إجازة بدون مرتب'), lt = L(c, 'خصم التأخير');
      return [r.name, r.dept || '', basic, al, r2(c.gross - basic - al - c.ot - bonus), c.ot, bonus, c.gross, c.insWage, c.insurance, c.employerIns, c.tax, r2(ab), lt, r2(c.deductions - c.insurance - c.tax - ab - lt), c.deductions, c.net, c.cost]; });
    const tot = ['الإجمالي', ''].concat(head.slice(2).map((_, i) => r2(body.reduce((s, b) => s + num(b[i + 2]), 0))));
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([head].concat(body, [tot])), 'الموظفون');
    const d = {}; rows.forEach(r => { const k = r.dept || '—'; d[k] = d[k] || [0, 0, 0, 0]; d[k][0]++; d[k][1] += r.calc.gross; d[k][2] += r.calc.net; d[k][3] += r.calc.cost; });
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['القسم', 'عدد الموظفين', 'الإجمالي', 'الصافي', 'تكلفة الشركة']].concat(Object.keys(d).map(k => [k, d[k][0], r2(d[k][1]), r2(d[k][2]), r2(d[k][3])]))), 'الأقسام');
    const s = k => r2(rows.reduce((a, r) => a + r.calc[k], 0));
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['البند', 'القيمة'], ['إجمالي الأجور التأمينية', s('insWage')], ['تأمينات الموظفين', s('insurance')], ['تأمينات صاحب العمل', s('employerIns')], ['إجمالي المستحق للتأمينات', r2(s('insurance') + s('employerIns'))], ['إجمالي ضريبة كسب العمل', s('tax')]]), 'التأمينات والضريبة');
    save(wb, 'accountant-' + month + '.xlsx');
  };

  /* ---- السلف ---- */
  T.loansModal = async function (month) {
    const { store, ui } = H, esc = ui.esc, P = H.payroll;
    const m = ui.modal('السلف والأقساط', '<div id="lm"></div>', true), box = m.el.querySelector('#lm');
    const draw = async () => {
      const [E, LN] = await Promise.all([store.list('employees'), store.list('loans')]);
      const nm = id => (E.find(e => e.id === id) || { name: 'محذوف' }).name;
      box.innerHTML = '<div class="acts" style="margin:0 0 12px"><button class="btn" data-a="add">+ سلفة جديدة</button><button class="btn ghost" data-a="x">إغلاق</button></div><div class="tw"><table><tr><th>الموظف</th><th>البيان</th><th>الإجمالي</th><th>الأقساط</th><th>تبدأ</th><th>القسط الحالي</th><th>المتبقي</th><th>الحالة</th><th></th></tr>' +
        LN.map(l => { const d = P.loanDue(l, month), left = Math.max(0, d.n - Math.max(0, Math.min(d.idx, d.n)));
          return '<tr data-id="' + l.id + '"><td>' + esc(nm(l.empId)) + '</td><td>' + esc(l.title || '—') + '</td><td>' + ui.money(l.total) + '</td><td>' + l.installments + '</td><td>' + l.startMonth + '</td><td>' + (d.amount ? ui.money(d.amount) : '—') + '</td><td>' + (l.status === 'stopped' ? '—' : left + ' قسط') + '</td><td>' + ui.tag(l.status === 'stopped' ? 'موقوفة' : 'نشطة', l.status === 'stopped' ? 'mu' : 'ok') + '</td><td><button class="btn ghost sm" data-a="tg">' + (l.status === 'stopped' ? 'استئناف' : 'إيقاف') + '</button> <button class="btn danger sm" data-a="dl">حذف</button></td></tr>'; }).join('') + '</table>' + (LN.length ? '' : '<div class="em">لا توجد سلف</div>') + '</div><p style="color:var(--mu);font-size:13px">القسط بيتخصم تلقائي كل شهر. الشهور المعتمدة ما بتتغيرش لو أضفت أو أوقفت سلفة بعد الاعتماد.</p>';
      box.onclick = async e => {
        const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, id = b.closest('tr') && b.closest('tr').dataset.id;
        if (a === 'x') { m.close(); return; }
        if (a === 'add') {
          const o = await ui.form('سلفة جديدة', [{ n: 'empId', l: 'الموظف', opts: E.filter(x => x.status !== 'terminated').map(x => [x.id, x.name]) }, { n: 'title', l: 'البيان (اختياري)' }, { n: 'total', l: 'المبلغ الإجمالي', t: 'number', req: 1 }, { n: 'installments', l: 'عدد الأقساط', t: 'number', req: 1 }, { n: 'startMonth', l: 'أول قسط في شهر', t: 'month', req: 1 }], { startMonth: month, installments: 6 });
          if (!o) return;
          o.total = +o.total; o.installments = Math.floor(+o.installments); o.status = 'active';
          if (!(o.total > 0) || !(o.installments >= 1 && o.installments <= 120)) return ui.toast('المبلغ أو عدد الأقساط غير صحيح');
          await store.create('loans', o); ui.toast('تمت إضافة السلفة'); await draw(); H.refresh();
        } else if (a === 'tg') { const l = LN.find(x => x.id === id); await store.update('loans', id, { status: l.status === 'stopped' ? 'active' : 'stopped' }); await draw(); H.refresh(); }
        else if (a === 'dl' && confirm('حذف السلفة؟ الشهور المعتمدة ما بتتأثرش.')) { await store.remove('loans', id); await draw(); H.refresh(); }
      };
    };
    await draw();
  };
})();
