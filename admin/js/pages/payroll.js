HR.pages.payroll = {
  title: 'الرواتب', icon: 'wallet',
  async render(root) {
    const { store, ui, state: st } = HR, P = HR.payroll, esc = ui.esc;
    if (st.pview === 'rules') return HR.payrollRules(root);
    st.pmonth = st.pmonth || ui.today().slice(0, 7);
    const month = st.pmonth, isAdmin = HR.user.role === 'admin';

    const [E0, A0, L0, ADJ, RUNS, LINES, LOANS, cfg, LRULES] = await Promise.all([
      store.list('employees'), store.list('attendance'), store.list('leaves'),
      store.list('payroll'),   store.list('runs'),       store.list('lines'),
      store.list('loans'),     P.load(),                  HR.leaves.load()
    ]);
    const T = HR.payrollTools;
    const { rules, state } = cfg, per = P.period(month, rules), today = ui.today();
    const run    = RUNS.find(r => r.month === month) || null;
    const status = run ? run.status : 'draft';
    const locked = status === 'approved' || status === 'paid';

    let rows;
    if (locked) {
      rows = LINES.filter(l => l.runId === run.id).map(l => ({
        id: l.empId, name: l.data.name, title: l.data.title,
        dept: l.data.dept, calc: l.data.calc, adj: null
      }));
    }
    const unpaidTypes = HR.leaves.unpaidTypes(LRULES);
    if (!locked) {
      rows = E0.filter(e =>
        (!e.hire || e.hire <= per.end) &&
        (e.status !== 'terminated' || (e.endDate && e.endDate >= per.start))
      ).map(e => {
        const adj = ADJ.find(a => a.empId === e.id && a.month === month);
        return {
          id: e.id, name: e.name, title: e.title, dept: e.dept, photo: e.photo, adj,
          calc: P.calc(e, {
            rules, state, adj,
            att:    A0.filter(a => a.empId === e.id && a.date >= per.start && a.date <= per.end),
            leaves: L0.filter(l => l.empId === e.id),
            loans:  LOANS.filter(l => l.empId === e.id),
            unpaidTypes, month, period: per, today
          })
        };
      });
    }
    rows.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));

    const sum = k => rows.reduce((s, r) => s + r.calc[k], 0);
    const tot = { net: sum('net'), cost: sum('cost'), ded: sum('deductions'), gross: sum('gross') };

    const STEPS = [['draft','مسودة'], ['review','مراجعة'], ['approved','معتمد'], ['paid','مصروف']];
    const ci = STEPS.findIndex(s => s[0] === status);
    const btn = (a, t, c) => '<button class="btn ' + (c || '') + '" data-a="' + a + '">' + t + '</button>';

    let acts = '';
    if (status === 'draft')  acts = btn('s-review', 'إرسال للمراجعة');
    else if (status === 'review') acts = btn('s-draft', 'رجوع لمسودة', 'ghost') + (isAdmin ? btn('s-approve', 'اعتماد الشهر') : '<span class="mu" style="font-size:13px">الاعتماد للمدير فقط</span>');
    else if (isAdmin) acts = (status === 'approved' ? btn('s-paid', 'تسجيل الصرف') : '') + btn('s-reopen', 'إعادة فتح', 'danger');

    const prevRun  = RUNS.filter(r => (r.status === 'approved' || r.status === 'paid') && r.month < month)
                         .sort((a, b) => a.month < b.month ? 1 : -1)[0];
    const prevRows = prevRun ? LINES.filter(l => l.runId === prevRun.id).map(l => ({ id: l.empId, name: l.data.name, calc: l.data.calc })) : [];
    const thr  = st.pthr == null ? 10 : st.pthr;
    const cmp  = prevRun ? T.compare(rows, prevRows, thr) : [];
    const chk  = locked ? [] : T.checklist({ rows, L0, A0, E0, per, rules });
    const warn = chk.filter(x => !x.ok).length;
    const exp  = st.pexp;

    /* Status badge color */
    const statusColor = { draft: '#6b7280', review: '#f59e0b', approved: '#22c55e', paid: '#2563eb' };

    root.innerHTML =
      ui.head('الرواتب', 'فترة الحساب: ' + per.start + ' إلى ' + per.end,
        '<input type="month" id="mo" value="' + month + '">' +
        '<button class="btn ghost" data-a="rules">⚙️ قواعد الرواتب</button>' +
        '<button class="btn ghost" data-a="loans">💳 السلف</button>' +
        '<button class="btn ghost" data-a="exp">📤 تصدير وطباعة</button>' +
        acts
      ) +

      /* ── Payroll Hero ── */
      '<div class="pr-hero">' +
        /* Summary card */
        '<div class="pr-summary">' +
          '<div class="pr-status" style="background:' + statusColor[status] + '15;border-color:' + statusColor[status] + '40">' +
            '<span class="pr-status-dot" style="background:' + statusColor[status] + '"></span>' +
            STEPS.find(s => s[0] === status)[1] +
          '</div>' +
          '<div class="pr-net">' +
            '<span>إجمالي صافي الرواتب</span>' +
            '<b>' + ui.money(tot.net) + '</b>' +
            '<small>تكلفة الشركة شاملة التأمينات: ' + ui.money(tot.cost) + '</small>' +
          '</div>' +
          '<div class="pr-mini-row">' +
            '<div><span>الموظفون</span><b>' + rows.length + '</b></div>' +
            '<div><span>الإجمالي</span><b>' + ui.money(tot.gross) + '</b></div>' +
            '<div><span>الخصومات</span><b>' + ui.money(tot.ded) + '</b></div>' +
          '</div>' +
        '</div>' +

        /* Workflow stepper */
        '<div class="pr-stepper">' +
          STEPS.map((s, i) =>
            '<div class="pr-step' + (i < ci ? ' done' : i === ci ? ' cur' : '') + '">' +
              '<div class="pr-step-dot">' + (i < ci ? '✓' : i + 1) + '</div>' +
              '<span>' + s[1] + '</span>' +
            '</div>' + (i < 3 ? '<div class="pr-step-line' + (i < ci ? ' done' : '') + '"></div>' : '')
          ).join('') +
        '</div>' +
      '</div>' +

      /* Lock bar */
      (locked
        ? '<div class="lockbar">🔒 الشهر ' + (status === 'paid' ? 'مصروف' : 'معتمد') +
          ' ومقفول. الأرقام لقطة ثابتة وقت الاعتماد' +
          (run.approvedBy ? ' بواسطة ' + esc(run.approvedBy) : '') +
          '. تغيير الراتب أو القواعد لن يغيّرها.' +
          '</div>'
        : '') +

      /* Checklist */
      (locked ? '' :
        '<div class="card">' +
          '<h3>قائمة الفحص قبل الاعتماد ' +
            (warn ? ui.tag(warn + ' تحتاج مراجعة', 'wa') : ui.tag('كله تمام ✓', 'ok')) +
          '</h3>' +
          chk.map(x =>
            '<div class="al ' + (x.ok ? 'ok' : 'wa') + '">' +
              '<span>' + (x.ok ? '✓' : '!') + '</span>' +
              '<div>' + esc(x.text) +
                (!x.ok ? ': <b>' + x.names.length + '</b>' +
                  '<small style="display:block;font-weight:400">' +
                    esc(x.names.slice(0, 6).join('، ')) + (x.names.length > 6 ? ' ...' : '') +
                  '</small>' : '') +
              '</div>' +
            '</div>'
          ).join('') +
        '</div>') +

      /* Month comparison */
      '<div class="card">' +
        '<h3>مقارنة بالشهر السابق ' +
          (prevRun ? '(' + prevRun.month + ')' : '') +
          (prevRun ? '<span style="font-weight:400;font-size:13px">التغيير أكبر من <input type="number" id="thr" min="0" style="width:56px;padding:3px 8px;margin:0 4px" value="' + thr + '">%</span>' : '') +
        '</h3>' +
        (!prevRun
          ? '<div class="em">مفيش شهر معتمد سابق للمقارنة. بعد اعتماد أول شهر هتظهر هنا الفروقات.</div>'
          : cmp.length
            ? '<div class="tw"><table>' +
                '<tr><th>الموظف</th><th>الصافي السابق</th><th>الصافي الحالي</th><th>التغيير</th><th>السبب</th></tr>' +
                cmp.map(x =>
                  '<tr><td>' + esc(x.name) + '</td>' +
                  (x.kind === 'chg'
                    ? '<td>' + ui.money(x.prev) + '</td><td>' + ui.money(x.net) + '</td>' +
                      '<td>' + ui.tag((x.diff > 0 ? '+' : '−') + Math.abs(Math.round(x.pct)) + '%', x.diff > 0 ? 'ok' : 'da') + '</td>' +
                      '<td style="white-space:normal">' + esc(x.reasons.map(r => r.k + ' ' + (r.d > 0 ? '+' : '−') + Math.round(Math.abs(r.d))).join(' | ')) + '</td>'
                    : x.kind === 'new'
                      ? '<td>—</td><td>' + ui.money(x.net) + '</td><td>' + ui.tag('جديد', 'wa') + '</td><td>غير موجود في الشهر السابق</td>'
                      : '<td>' + ui.money(x.prev) + '</td><td>—</td><td>' + ui.tag('غير موجود', 'mu') + '</td><td>كان في الشهر السابق ومش في الحالي</td>') +
                  '</tr>'
                ).join('') +
              '</table></div>'
            : '<div class="em">مفيش فروقات أكبر من ' + thr + '%. كل الأرقام قريبة من الشهر السابق.</div>'
        ) +
      '</div>' +

      /* Dept chart */
      '<div class="card">' +
        '<h3>تكلفة كل قسم</h3>' +
        '<div class="cv" style="height:' + (60 + Object.keys(rows.reduce((o, r) => (o[r.dept || '—'] = 1, o), {})).length * 38) + 'px">' +
          '<canvas id="pc"></canvas>' +
        '</div>' +
      '</div>' +

      /* Rows table */
      '<div class="card">' +
        '<h3>تفاصيل الموظفين (' + rows.length + ')</h3>' +
        '<div class="tw"><table>' +
          '<tr><th>الموظف</th><th>القسم</th><th>الإجمالي</th><th>الخصومات</th><th>الصافي</th><th></th></tr>' +
          rows.map(r => {
            const c = r.calc, open = exp === r.id;
            let h = '<tr class="pr-row' + (open ? ' on' : '') + '" data-id="' + r.id + '">' +
              '<td>' + ui.who({ name: r.name, title: r.title, photo: r.photo }) + '</td>' +
              '<td>' + esc(r.dept || '—') + '</td>' +
              '<td>' + ui.money(c.gross) + '</td>' +
              '<td>' + ui.money(c.deductions) + '</td>' +
              '<td class="net"><b>' + ui.money(c.net) + '</b></td>' +
              '<td>' + (c.flags.length ? ui.tag('!', 'wa') + ' ' : '') + (open ? '▲' : '▼') + '</td>' +
            '</tr>';
            if (open) {
              h += '<tr class="pr-detail"><td colspan="6">' +
                '<div class="slip-wrap">' +
                  '<div class="slip-col">' +
                    '<b>المكوّنات الإضافية</b>' +
                    '<table class="slip">' +
                      (c.items || []).filter(x => x.v > 0).map(x => '<tr><td>' + esc(x.k) + '</td><td style="text-align:left">' + ui.money(x.v) + '</td></tr>').join('') +
                    '</table>' +
                  '</div>' +
                  '<div class="slip-col">' +
                    '<b>الخصومات</b>' +
                    '<table class="slip">' +
                      (c.items || []).filter(x => x.v < 0).map(x => '<tr><td>' + esc(x.k) + '</td><td style="text-align:left;color:var(--da)">' + ui.money(Math.abs(x.v)) + '</td></tr>').join('') +
                    '</table>' +
                  '</div>' +
                '</div>' +
                (c.flags.length ? '<div class="al wa" style="margin-top:10px"><span>!</span><div>' + esc(c.flags.join(' | ')) + '</div></div>' : '') +
                (!locked
                  ? '<div style="margin-top:10px;display:flex;gap:8px">' +
                      '<button class="btn ghost sm" data-a="adj">تعديل يدوي</button>' +
                      '<button class="btn ghost sm" data-a="slip">طباعة قسيمة</button>' +
                    '</div>'
                  : '<div style="margin-top:10px"><button class="btn ghost sm" data-a="slip">طباعة قسيمة</button></div>') +
              '</td></tr>';
            }
            return h;
          }).join('') +
        '</table></div>' +
      '</div>';

    /* ── Chart ── */
    const deptMap = {};
    rows.forEach(r => { const d = r.dept || '—'; deptMap[d] = (deptMap[d] || 0) + r.calc.cost; });
    const depts = Object.keys(deptMap), vals = depts.map(d => deptMap[d]);
    const colors = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];
    if (window.Chart && document.querySelector('#pc')) {
      new Chart(document.querySelector('#pc'), {
        type: 'bar',
        data: {
          labels: depts,
          datasets: [{ data: vals, backgroundColor: colors.slice(0, depts.length), borderRadius: 8 }]
        },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { callback: v => ui.money(v) } },
            y: { ticks: { color: getComputedStyle(document.body).getPropertyValue('--tx') } }
          }
        }
      });
    }

    /* ── Events ── */
    root.querySelector('#mo').onchange = e => { st.pmonth = e.target.value; HR.refresh(); };
    root.querySelector('#thr') && (root.querySelector('#thr').onchange = e => { st.pthr = +e.target.value; HR.refresh(); });

    root.onclick = async e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a, id = (b.closest('[data-id]') || {}).dataset && b.closest('[data-id]').dataset.id;

      if (a === 'rules') { st.pview = 'rules'; HR.refresh(); return; }
      if (a === 'loans') { HR.showLoans(); return; }
      if (a === 'exp')   { HR.exportPayroll(rows, per, rules); return; }

      if (a === 'adj') {
        const r = rows.find(x => x.id === id), c = r.calc;
        const adj = r.adj || {};
        const o = await ui.form('تعديل يدوي - ' + r.name, [
          { n: 'bonus',     l: 'مكافأة إضافية',   t: 'number' },
          { n: 'deduction', l: 'خصم إضافي',        t: 'number' },
          { n: 'note',      l: 'سبب التعديل' }
        ], adj);
        if (!o) return;
        o.empId = id; o.month = month;
        const ex = ADJ.find(x => x.empId === id && x.month === month);
        if (ex) await store.update('payroll', ex.id, o);
        else    await store.create('payroll', o);
        ui.toast('✅ تم حفظ التعديل'); HR.refresh();
      }

      if (a === 'slip') {
        const r = rows.find(x => x.id === id);
        HR.printSlip(r, per, rules);
      }

      /* Row expand */
      const row = b.closest('.pr-row');
      if (row && !b.dataset.a.startsWith('s-')) {
        st.pexp = st.pexp === id ? null : id; HR.refresh(); return;
      }

      /* Workflow transitions */
      if (a.startsWith('s-')) {
        const map = { 'draft': 'مسودة', 'review': 'مراجعة', 'approved': 'معتمد', 'paid': 'مصروف' };
        const ns = { 's-review': 'review', 's-draft': 'draft', 's-approve': 'approved', 's-paid': 'paid', 's-reopen': 'draft' }[a];
        if (!ns) return;
        if (ns === 'draft' && locked && !confirm('إعادة فتح الشهر ستحذف الأرقام المحفوظة. متأكد؟')) return;
        if (ns === 'approved' && warn) {
          if (!confirm('في ' + warn + ' تحذير في قائمة الفحص. تريد تكمل الاعتماد على أي حال؟')) return;
        }
        const data = { status: ns };
        if (ns === 'approved') {
          data.approvedBy = HR.user.email; data.approvedAt = new Date().toISOString();
          /* Save snapshot */
          let rid = run ? run.id : null;
          if (!rid) { const nr = await store.create('runs', { month, status: ns, approvedBy: data.approvedBy, approvedAt: data.approvedAt }); rid = nr.id; }
          else await store.update('runs', rid, data);
          await Promise.all(rows.map(r => store.create('lines', { runId: rid, empId: r.id, data: { name: r.name, title: r.title, dept: r.dept, calc: r.calc } })));
          ui.toast('✅ تم الاعتماد وحفظ الأرقام'); HR.refresh(); return;
        }
        if (run) await store.update('runs', run.id, data);
        else await store.create('runs', { month, ...data });
        ui.toast('تم تحديث حالة الشهر'); HR.refresh();
      }
    };
  }
};
