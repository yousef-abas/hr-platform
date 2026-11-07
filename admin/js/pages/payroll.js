HR.pages.payroll = {
  title: 'الرواتب', icon: 'wallet',
  async render(root) {
    const { store, ui, state: st } = HR, P = HR.payroll, esc = ui.esc;
    if (st.pview === 'rules') return HR.payrollRules(root);
    st.pmonth = st.pmonth || ui.today().slice(0, 7);
    const month = st.pmonth, isAdmin = HR.user.role === 'admin';
    const [E0, A0, L0, ADJ, RUNS, LINES, LOANS, cfg, LRULES] = await Promise.all([store.list('employees'), store.list('attendance'), store.list('leaves'), store.list('payroll'), store.list('runs'), store.list('lines'), store.list('loans'), P.load(), HR.leaves.load()]);
    const T = HR.payrollTools;
    const { rules, state } = cfg, per = P.period(month, rules), today = ui.today();
    const run = RUNS.find(r => r.month === month) || null, status = run ? run.status : 'draft', locked = status === 'approved' || status === 'paid';
    let rows;
    if (locked) rows = LINES.filter(l => l.runId === run.id).map(l => ({ id: l.empId, name: l.data.name, title: l.data.title, dept: l.data.dept, calc: l.data.calc, adj: null }));
    const unpaidTypes = HR.leaves.unpaidTypes(LRULES);
    if (!locked) rows = E0.filter(e => (!e.hire || e.hire <= per.end) && (e.status !== 'terminated' || (e.endDate && e.endDate >= per.start))).map(e => {
      const adj = ADJ.find(a => a.empId === e.id && a.month === month);
      return { id: e.id, name: e.name, title: e.title, dept: e.dept, photo: e.photo, adj, calc: P.calc(e, { rules, state, adj, att: A0.filter(a => a.empId === e.id && a.date >= per.start && a.date <= per.end), leaves: L0.filter(l => l.empId === e.id), loans: LOANS.filter(l => l.empId === e.id), unpaidTypes, month, period: per, today }) };
    });
    rows.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
    const sum = k => rows.reduce((s, r) => s + r.calc[k], 0), tot = { net: sum('net'), cost: sum('cost'), ded: sum('deductions'), gross: sum('gross') };
    const STEPS = [['draft', 'مسودة'], ['review', 'مراجعة'], ['approved', 'معتمد'], ['paid', 'مصروف']], ci = STEPS.findIndex(s => s[0] === status);
    const btn = (a, t, c) => '<button class="btn ' + (c || '') + '" data-a="' + a + '">' + t + '</button>';
    let acts = '';
    if (status === 'draft') acts = btn('s-review', 'إرسال للمراجعة');
    else if (status === 'review') acts = btn('s-draft', 'رجوع لمسودة', 'ghost') + (isAdmin ? btn('s-approve', 'اعتماد الشهر') : '<span style="color:var(--mu);font-size:13px">الاعتماد للمدير فقط</span>');
    else if (isAdmin) acts = (status === 'approved' ? btn('s-paid', 'تسجيل الصرف') : '') + btn('s-reopen', 'إعادة فتح', 'danger');
    const prevRun = RUNS.filter(r => (r.status === 'approved' || r.status === 'paid') && r.month < month).sort((a, b) => a.month < b.month ? 1 : -1)[0];
    const prevRows = prevRun ? LINES.filter(l => l.runId === prevRun.id).map(l => ({ id: l.empId, name: l.data.name, calc: l.data.calc })) : [];
    const thr = st.pthr == null ? 10 : st.pthr;
    const cmp = prevRun ? T.compare(rows, prevRows, thr) : [];
    const chk = locked ? [] : T.checklist({ rows, L0, A0, E0, per, rules });
    const warn = chk.filter(x => !x.ok).length;
    const company = rules.company || {};
    const exp = st.pexp;

    root.innerHTML = ui.head('الرواتب', 'فترة الحساب: ' + per.start + ' إلى ' + per.end,
      '<input type="month" id="mo" value="' + month + '"><button class="btn ghost" data-a="rules">قواعد الرواتب</button><button class="btn ghost" data-a="loans">السلف</button><button class="btn ghost" data-a="exp">تصدير وطباعة</button>' + acts) +
      '<div class="pr-hero"><div class="pr-tot"><span>إجمالي صافي الرواتب</span><b>' + ui.money(tot.net) + '</b><small>تكلفة الشركة شاملة التأمينات: ' + ui.money(tot.cost) + '</small>' +
      '<div class="pr-mini"><div>الموظفون<b>' + rows.length + '</b></div><div>الإجمالي<b>' + ui.money(tot.gross) + '</b></div><div>الخصومات<b>' + ui.money(tot.ded) + '</b></div></div></div>' +
      '<div class="step">' + STEPS.map((s, i) => '<i class="' + (i < ci ? 'done' : i === ci ? 'cur' : '') + '">' + s[1] + '</i>').join('') + '</div></div>' +
      (locked ? '<div class="lockbar">الشهر ' + (status === 'paid' ? 'مصروف' : 'معتمد') + ' ومقفول. الأرقام لقطة ثابتة وقت الاعتماد' + (run.approvedBy ? ' بواسطة ' + esc(run.approvedBy) : '') + '. تغيير الراتب أو القواعد لن يغيّرها.</div>' : '') +
      (locked ? '' : '<div class="card"><h3>قائمة الفحص قبل الاعتماد ' + (warn ? ui.tag(warn + ' تحتاج مراجعة', 'wa') : ui.tag('كله تمام', 'ok')) + '</h3>' + chk.map(x => '<div class="al ' + (x.ok ? 'ok' : 'wa') + '"><span>' + (x.ok ? '✓' : '!') + '</span><div>' + esc(x.text) + (x.ok ? '' : ': <b>' + x.names.length + '</b><small style="display:block;font-weight:400">' + esc(x.names.slice(0, 6).join('، ')) + (x.names.length > 6 ? ' ...' : '') + '</small>') + '</div></div>').join('') + '</div>') +
      '<div class="card"><h3>مقارنة بالشهر السابق ' + (prevRun ? '(' + prevRun.month + ')' : '') + (prevRun ? '<span style="font-weight:400;font-size:13px">التغيير أكبر من <input type="number" id="thr" min="0" style="width:64px;padding:3px 8px" value="' + thr + '">%</span>' : '') + '</h3>' +
      (!prevRun ? '<div class="em">مفيش شهر معتمد سابق للمقارنة. بعد اعتماد أول شهر هتظهر هنا الفروقات.</div>' : cmp.length ? '<table><tr><th>الموظف</th><th>الصافي السابق</th><th>الصافي الحالي</th><th>التغيير</th><th>السبب</th></tr>' + cmp.map(x => '<tr><td>' + esc(x.name) + '</td>' + (x.kind === 'chg' ? '<td>' + ui.money(x.prev) + '</td><td>' + ui.money(x.net) + '</td><td>' + ui.tag((x.diff > 0 ? '+' : '−') + Math.abs(Math.round(x.pct)) + '%', x.diff > 0 ? 'ok' : 'da') + '</td><td style="white-space:normal">' + esc(x.reasons.map(r => r.k + ' ' + (r.d > 0 ? '+' : '−') + Math.round(Math.abs(r.d))).join(' | ')) + '</td>' : x.kind === 'new' ? '<td>—</td><td>' + ui.money(x.net) + '</td><td>' + ui.tag('جديد', 'wa') + '</td><td>غير موجود في الشهر السابق</td>' : '<td>' + ui.money(x.prev) + '</td><td>—</td><td>' + ui.tag('غير موجود', 'mu') + '</td><td>كان في الشهر السابق ومش في الحالي</td>') + '</tr>').join('') + '</table>' : '<div class="em">مفيش فروقات أكبر من ' + thr + '%. كل الأرقام قريبة من الشهر السابق.</div>') + '</div>' +
      '<div class="card"><h3>تكلفة كل قسم</h3><div class="cv" style="height:' + (60 + Object.keys(rows.reduce((o, r) => (o[r.dept || '—'] = 1, o), {})).length * 38) + 'px"><canvas id="pc"></canvas></div></div>' +
      '<div class="card tw"><table><tr><th>الموظف</th><th>القسم</th><th>الإجمالي</th><th>الخصومات</th><th>الصافي</th><th></th></tr>' +
      rows.map(r => {
        const c = r.calc, open = exp === r.id;
        let h = '<tr class="pr-row' + (open ? ' on' : '') + '" data-id="' + r.id + '"><td>' + ui.who({ name: r.name, title: r.title, photo: r.photo }) + '</td><td>' + esc(r.dept || '—') + '</td><td>' + ui.money(c.gross) + '</td><td>' + ui.money(c.deductions) + '</td><td class="net">' + ui.money(c.net) + '</td><td>' + (c.flags.length ? ui.tag('!', 'wa') : '') + (open ? ' ▲' : ' ▼') + '</td></tr>';
        if (open) {
          const ln = t => c.lines.filter(l => l.t === t).map(l => '<div class="ln"><span>' + esc(l.label) + (l.note ? '<small>' + esc(l.note) + '</small>' : '') + '</span><b>' + ui.money(l.amount) + '</b></div>').join('') || '<div class="em" style="padding:6px">لا يوجد</div>';
          const a = r.adj || {}, inp = (f, l) => '<label>' + l + '<input type="number" min="0" step="any" data-f="' + f + '" value="' + (a[f] || 0) + '"' + (locked ? ' disabled' : '') + '></label>';
          h += '<tr class="pr-x" data-id="' + r.id + '"><td colspan="6"><div class="bd"><div><h4>المستحقات</h4>' + ln('earn') + '<div class="ln tot"><span>الإجمالي</span><b>' + ui.money(c.gross) + '</b></div></div><div><h4>الخصومات</h4>' + ln('ded') + '<div class="ln tot"><span>إجمالي الخصومات</span><b>' + ui.money(c.deductions) + '</b></div></div></div>' +
            '<div class="ln tot" style="font-size:18px;display:flex;justify-content:space-between"><span>الصافي</span><span class="net">' + ui.money(c.net) + '</span></div>' +
            '<div style="color:var(--mu);font-size:13px;margin-top:6px">قيمة اليوم ' + ui.money(c.meta.dayValue) + ' • غياب ' + c.meta.absentDays + ' يوم • تأخير ' + c.meta.lateDays + ' مرة • أوفر تايم ' + c.meta.otHours + ' ساعة</div>' +
            (locked ? '' : '<div class="ed">' + inp('bonus', 'مكافأة') + inp('absent', 'أيام غياب إضافية') + inp('otNormal', 'أوفر تايم نهاري (ساعة)') + inp('otNight', 'أوفر تايم ليلي') + inp('otRest', 'أوفر تايم راحة') + inp('otHoliday', 'أوفر تايم عطلة') + inp('advance', 'سلفة') + inp('penalty', 'جزاء') + inp('other', 'خصومات أخرى') + '</div>') +
            '<div class="acts noprint"><button class="btn ghost sm" data-a="slip">قسيمة الراتب</button></div></td></tr>';
        }
        return h;
      }).join('') + '</table>' + (rows.length ? '' : '<div class="em">لا يوجد موظفون في هذا الشهر</div>') + '</div>';

    if (window.Chart) {
      const d = {}; rows.forEach(r => { const k = r.dept || '—'; d[k] = (d[k] || 0) + r.calc.cost; });
      Chart.defaults.font.family = 'Cairo';
      new Chart(root.querySelector('#pc'), { type: 'bar', data: { labels: Object.keys(d), datasets: [{ data: Object.values(d).map(Math.round), backgroundColor: '#0070f2', borderRadius: 8, maxBarThickness: 26 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true }, y: { grid: { display: false } } } } });
    }

    const put = async (empId, f, v) => {
      const r = ADJ.find(a => a.empId === empId && a.month === month), val = Math.max(0, +v || 0);
      if (r) await store.update('payroll', r.id, { [f]: val });
      else await store.create('payroll', { empId, month, bonus: 0, absent: 0, other: 0, otNormal: 0, otNight: 0, otRest: 0, otHoliday: 0, advance: 0, penalty: 0, [f]: val });
      HR.refresh();
    };
    const runBody = extra => Object.assign({ month, totalNet: tot.net, totalCost: tot.cost, empCount: rows.length }, extra || {});
    const setStatus = async (s, extra) => { if (run) await store.update('runs', run.id, Object.assign(runBody(extra), { status: s })); else await store.create('runs', Object.assign(runBody(extra), { status: s })); HR.refresh(); };
    const th = root.querySelector('#thr'); if (th) th.onchange = e => { st.pthr = Math.max(0, +e.target.value || 0); HR.refresh(); };
    root.querySelector('#mo').onchange = e => { st.pmonth = e.target.value || month; st.pexp = null; HR.refresh(); };
    root.onchange = e => { const t = e.target; if (t.dataset.f) put(t.closest('tr').dataset.id, t.dataset.f, t.value); };
    root.onclick = async e => {
      const row = e.target.closest('.pr-row');
      if (row && !e.target.closest('button')) { st.pexp = st.pexp === row.dataset.id ? null : row.dataset.id; HR.refresh(); return; }
      const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
      if (a === 'rules') { st.pview = 'rules'; HR.refresh(); }
      else if (a === 'loans') T.loansModal(month);
      else if (a === 'exp') {
        const m = ui.modal('تصدير وطباعة: ' + month, '<div class="acts" style="flex-direction:column;align-items:stretch;gap:10px"><button class="btn" data-x="bank"' + (locked ? '' : ' disabled') + '>ملف التحويل البنكي (Excel)</button>' + (locked ? '' : '<small style="color:var(--mu)">ملف التحويل متاح بعد اعتماد الشهر فقط.</small>') + '<button class="btn" data-x="acc">ملف المحاسب (Excel): تأمينات وضريبة وأقسام</button><button class="btn" data-x="slips">طباعة كل القسايم / حفظ PDF</button><button class="btn ghost" data-x="csv">جدول مبسط (CSV)</button><button class="btn ghost" data-x="no">إغلاق</button></div>');
        m.el.onclick = ev => {
          const x = ev.target.dataset.x; if (!x) return;
          if (x === 'no') return m.close();
          if (!window.XLSX && (x === 'bank' || x === 'acc')) return ui.toast('مكتبة Excel ما اتحملتش');
          if (x === 'bank') { const r = T.exportBank(rows, E0, month); ui.toast('تم تصدير ' + r.count + ' موظف' + (r.missing ? ' (ناقص IBAN: ' + r.missing + ')' : '')); }
          if (x === 'acc') { T.exportAccountant(rows, month); ui.toast('تم تصدير ملف المحاسب'); }
          if (x === 'csv') ui.csv('payroll-' + month + '.csv', [['الموظف', 'القسم', 'الإجمالي', 'التأمينات', 'الضريبة', 'الخصومات', 'الصافي']].concat(rows.map(r => [r.name, r.dept, r.calc.gross, r.calc.insurance, r.calc.tax, r.calc.deductions, r.calc.net])));
          if (x === 'slips') { m.close(); T.printSlips(rows, month, company, 'قسايم شهر ' + month); }
        };
      }
      else if (a === 's-review') setStatus('review');
      else if (a === 's-draft') setStatus('draft');
      else if (a === 's-paid') { if (confirm('تسجيل أن الرواتب اتصرفت؟')) setStatus('paid'); }
      else if (a === 's-reopen') { const why = prompt('سبب إعادة فتح الشهر (مطلوب):'); if (why && why.trim()) setStatus('draft', { reopenReason: why.trim() }); }
      else if (a === 's-approve') {
        if (!confirm((warn ? 'فيه ' + warn + ' بند في قائمة الفحص محتاج مراجعة.\n' : '') + 'اعتماد شهر ' + month + '؟ هتتثبت الأرقام ويتقفل الشهر، وإعادة الفتح للمدير بسبب مكتوب.')) return;
        b.disabled = true;
        try {
          if (run) await store.update('runs', run.id, runBody({ status: 'review', rulesSnapshot: rules, stateSnapshot: state })); else await store.create('runs', runBody({ status: 'review', rulesSnapshot: rules, stateSnapshot: state }));
          const cur = (await store.list('runs')).find(r => r.month === month);
          for (const l of (await store.list('lines')).filter(l => l.runId === cur.id)) await store.remove('lines', l.id);
          await store.createMany('lines', rows.map(r => ({ runId: cur.id, empId: r.id, net: r.calc.net, data: { name: r.name, title: r.title, dept: r.dept, calc: r.calc } })));
          await store.update('runs', cur.id, { status: 'approved', approvedAt: new Date().toISOString(), approvedBy: HR.user.email || HR.user.name });
          ui.toast('تم اعتماد الشهر'); HR.refresh();
        } catch (err) { b.disabled = false; ui.toast('تعذر الاعتماد: ' + err.message); }
      } else if (a === 'slip') { T.printSlips([rows.find(x => x.id === st.pexp)], month, company, 'قسيمة الراتب'); }
    };
  }
};
