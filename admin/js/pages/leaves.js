HR.pages.leaves = {
  title: 'الإجازات', icon: 'calendar',
  async render(root) {
    const { store, ui, state: st } = HR, L = HR.leaves, esc = ui.esc;
    const today = ui.today(), isAdmin = HR.user.role === 'admin';
    st.lview = st.lview || 'req';
    const [E, LV, rules, cfg] = await Promise.all([
      store.list('employees'), store.list('leaves'), L.load(), HR.payroll.load()
    ]);
    if (st.lview === 'rules') return HR.leavesRules(root, rules);

    const pay = cfg.rules;
    const emps = E.filter(e => e.status !== 'terminated');
    const emp  = id => E.find(e => e.id === id) || { name: 'محذوف' };
    const tcol  = n => (L.type(rules, n) || {}).color || '#5b738b';
    const tchip = n => '<span class="tag" style="background:' + tcol(n) + '22;color:' + tcol(n) + '">' + esc(n) + '</span>';
    const pending   = LV.filter(l => l.status === 'معلقة' || l.status === 'معلقة HR').length;
    const hrPending = LV.filter(l => l.status === 'معلقة HR').length;
    const approved  = LV.filter(l => l.status === 'موافق عليها').length;
    const rejected  = LV.filter(l => l.status === 'مرفوضة').length;
    const totalDays = LV.filter(l => l.status === 'موافق عليها').reduce((s, l) => s + (l.days || 0), 0);


    const VIEWS = [
      ['req',   'الطلبات' + (pending ? ' <span class="nb" style="position:static;margin-right:4px">' + pending + '</span>' : '')],
      ['bal',   'الأرصدة'],
      ['cal',   'تقويم الفريق'],
      ['rules', 'القواعد']
    ];

    /* ── Build active view body ── */
    let body = '';

    /* ========== REQUESTS ========== */
    if (st.lview === 'req') {
      const fs = st.lfs || '', ft = st.lft || '', fq = st.lfq || '';
      const rows = LV.slice().reverse().filter(l =>
        (!fs || l.status === fs) &&
        (!ft || l.type === ft) &&
        (!fq || emp(l.empId).name.includes(fq))
      );
      body =
        /* KPI */
        '<div class="kpi-row">' +
          '<div class="kpi-card" style="--kc:#f59e0b">' +
            '<div class="kpi-ic" style="background:#fffbeb;color:#d97706">' + ui.icon('clock') + '</div>' +
            '<div class="kpi-val">' + pending + '</div><div class="kpi-lbl">معلقة</div>' +
          '</div>' +
          '<div class="kpi-card" style="--kc:#22c55e">' +
            '<div class="kpi-ic" style="background:#f0fdf4;color:#16a34a">' + ui.icon('check') + '</div>' +
            '<div class="kpi-val">' + approved + '</div><div class="kpi-lbl">معتمدة</div>' +
          '</div>' +
          '<div class="kpi-card" style="--kc:#dc2626">' +
            '<div class="kpi-ic" style="background:#fef2f2;color:#dc2626">' + ui.icon('x') + '</div>' +
            '<div class="kpi-val">' + rejected + '</div><div class="kpi-lbl">مرفوضة</div>' +
          '</div>' +
          '<div class="kpi-card" style="--kc:#c9933a">' +
            '<div class="kpi-ic" style="background:#fdf6e7;color:#c9933a">' + ui.icon('calendar') + '</div>' +
            '<div class="kpi-val">' + totalDays + '</div><div class="kpi-lbl">يوم مستخدم هذا العام</div>' +
          '</div>' +
        '</div>' +

        /* Filters + table */
        '<div class="card">' +
          '<div class="tools" style="margin-bottom:14px">' +
            '<input id="fq" placeholder="بحث باسم موظف" value="' + esc(fq) + '">' +
            '<select id="fs">' +
              '<option value="">كل الحالات</option>' +
              ['معلقة', 'معتمدة', 'مرفوضة'].map(x => '<option' + (x === fs ? ' selected' : '') + '>' + x + '</option>').join('') +
            '</select>' +
            '<select id="ft">' +
              '<option value="">كل الأنواع</option>' +
              rules.types.map(t => '<option' + (t.name === ft ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('') +
            '</select>' +
          '</div>' +
          '<div class="tw"><table>' +
            '<tr><th>الموظف</th><th>النوع</th><th>من</th><th>إلى</th><th>الأيام</th><th>الحالة</th><th>القرار</th><th></th></tr>' +
            rows.map(l => {
              const e = emp(l.empId);
              const decision = (l.mgrStatus ? 'المدير: ' + l.mgrStatus + (l.mgrBy ? ' (' + l.mgrBy + ')' : '') + ' ' : '') +
                (l.status === 'مرفوضة' && l.rejectReason ? 'سبب الرفض: ' + l.rejectReason : (l.decidedBy ? '• ' + l.decidedBy : ''));
              return '<tr data-id="' + l.id + '">' +
                '<td>' + ui.who(e) + '</td>' +
                '<td>' + tchip(l.type) + '</td>' +
                '<td>' + l.from + '</td>' +
                '<td>' + l.to + '</td>' +
                '<td>' + ui.tag(l.status, {'موافق عليها':'ok','مرفوضة':'da','معلقة':'wa','معلقة HR':'wa'}[l.status]) + '</td>' +
                '<td style="white-space:normal;min-width:140px;font-size:13px;color:var(--mu)">' + esc(decision) + '</td>' +
                '<td>' + (l.status === 'معلقة HR'
                  ? '<div style="display:flex;gap:6px"><button class="btn sm" data-a="ok">موافقة HR</button><button class="btn danger sm" data-a="no">رفض</button></div>'
                  : l.status === 'معلقة'
                  ? '<span style="font-size:12px;color:var(--mu)">في انتظار المدير</span>'
                  : '') + '</td>' +
              '</tr>';
            }).join('') +
          '</table>' + (rows.length ? '' : '<div class="em">لا توجد طلبات مطابقة</div>') + '</div>' +
        '</div>';
    }

    /* ========== BALANCES ========== */
    if (st.lview === 'bal') {
      body =
        '<div class="card">' +
          '<h3>أرصدة السنة الحالية</h3>' +
          '<div class="bal-legend">' +
            rules.types.map(t =>
              '<span class="bal-type" style="--tc:' + t.color + '">' + esc(t.name) + '</span>'
            ).join('') +
          '</div>' +
          '<div class="bal-grid">' +
            emps.map(e =>
              '<div class="bal-card">' +
                '<div class="bal-who">' + ui.who(e) + '</div>' +
                '<div class="bal-bars">' +
                  rules.types.map(t => {
                    const b = L.balance(e, t.name, today, LV, rules, pay);
                    if (b.unlimited) return '<div class="bal-row"><span>' + esc(t.name) + '</span><span class="mu">' + b.used + ' يوم (بدون حد)</span></div>';
                    const pct = Math.min(100, b.used / b.total * 100);
                    const low = b.remaining <= 3;
                    return '<div class="bal-row">' +
                      '<span style="color:' + t.color + '">' + esc(t.name) + '</span>' +
                      '<div class="bal-bar-wrap">' +
                        '<div class="bal-fill" style="width:' + pct + '%;background:' + t.color + '"></div>' +
                      '</div>' +
                      '<span class="bal-nums">' +
                        '<b>' + b.used + '</b>/' + b.total +
                        (low ? ' ' + ui.tag('متبقي ' + b.remaining, 'wa') : '') +
                        (b.pending ? ' <small class="mu">+' + b.pending + ' معلق</small>' : '') +
                      '</span>' +
                    '</div>';
                  }).join('') +
                '</div>' +
              '</div>'
            ).join('') +
          '</div>' +
        '</div>';
    }

    /* ========== CALENDAR ========== */
    if (st.lview === 'cal') {
      const month = st.lmonth || today.slice(0, 7);
      const y = +month.slice(0, 4), mo = +month.slice(5, 7);
      const nd   = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      const days = Array.from({ length: nd }, (_, i) => month + '-' + String(i + 1).padStart(2, '0'));
      const dept = st.lcd || '';
      const depts = [...new Set(emps.map(e => e.dept).filter(Boolean))];
      const list = emps.filter(e => !dept || e.dept === dept)
        .sort((a, b) => (a.dept || '').localeCompare(b.dept || '', 'ar') || a.name.localeCompare(b.name, 'ar'));
      const hol = {};
      (pay.holidays || []).forEach(h => { hol[h.date] = h.name || 'عطلة'; });
      const wk = d => (pay.weekend || [5, 6]).indexOf(new Date(d + 'T00:00:00Z').getUTCDay()) > -1;
      const gl = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];

      body =
        '<div class="card">' +
          '<div class="tools" style="margin-bottom:14px">' +
            '<input type="month" id="cm" value="' + month + '">' +
            '<select id="cd">' +
              '<option value="">كل الأقسام</option>' +
              depts.map(x => '<option' + (x === dept ? ' selected' : '') + '>' + esc(x) + '</option>').join('') +
            '</select>' +
            '<div class="cal-legend">' +
              rules.types.map(t => '<span style="background:' + t.color + '22;color:' + t.color + ';padding:3px 10px;border-radius:20px;font-size:12px">' + esc(t.name) + '</span>').join('') +
              '<span class="tag mu">المعلق: مقلّم</span>' +
            '</div>' +
          '</div>' +
          '<div class="tw"><table class="cal">' +
            '<tr><th>الموظف</th>' +
              days.map(d => '<th class="' + (wk(d) ? 'wk' : '') + '">' + +d.slice(8) + '<small>' + gl[new Date(d + 'T00:00:00Z').getUTCDay()] + '</small></th>').join('') +
            '</tr>' +
            list.map(e =>
              '<tr><td class="nm">' + esc(e.name) + '</td>' +
                days.map(d => {
                  const l = LV.find(x => x.empId === e.id && x.status !== 'مرفوضة' && x.from <= d && x.to >= d);
                  if (l) return '<td class="lv' + (l.status === 'معلقة' ? ' pd' : '') + '" style="--c:' + tcol(l.type) + '" title="' + esc(l.type + ' - ' + l.status) + '"></td>';
                  return '<td class="' + (hol[d] ? 'hd' : wk(d) ? 'wk' : '') + '"' + (hol[d] ? ' title="' + esc(hol[d]) + '"' : '') + '></td>';
                }).join('') +
              '</tr>'
            ).join('') +
            '<tr class="sum"><td class="nm">في إجازة</td>' +
              days.map(d => {
                const n = list.filter(e => LV.some(x => x.empId === e.id && x.status !== 'مرفوضة' && x.from <= d && x.to >= d)).length;
                return '<td>' + (n ? '<b style="color:var(--ac)">' + n + '</b>' : '') + '</td>';
              }).join('') +
            '</tr>' +
          '</table></div>' +
        '</div>';
    }

    /* ── Render ── */
    root.innerHTML =
      ui.head('الإجازات', 'الطلبات والأرصدة وتقويم الفريق، والقواعد قابلة للضبط',
        '<button class="btn" data-a="add">+ طلب إجازة</button>'
      ) +
      '<div class="tab-bar noprint">' +
        VIEWS.map(v => '<button data-v="' + v[0] + '" class="' + (st.lview === v[0] ? 'on' : '') + '">' + v[1] + '</button>').join('') +
      '</div>' +
      body;

    /* ── Event wiring ── */
    root.querySelector('#fq') && (root.querySelector('#fq').oninput = ui.debounce(e => { st.lfq = e.target.value; HR.refresh(); }));
    root.querySelector('#fs') && (root.querySelector('#fs').onchange = e => { st.lfs = e.target.value; HR.refresh(); });
    root.querySelector('#ft') && (root.querySelector('#ft').onchange = e => { st.lft = e.target.value; HR.refresh(); });
    root.querySelector('#cm') && (root.querySelector('#cm').onchange = e => { st.lmonth = e.target.value; HR.refresh(); });
    root.querySelector('#cd') && (root.querySelector('#cd').onchange = e => { st.lcd = e.target.value; HR.refresh(); });

    root.onclick = async e => {
      const b = e.target.closest('[data-v]');
      if (b) { st.lview = b.dataset.v; HR.refresh(); return; }

      const btn = e.target.closest('[data-a]'); if (!btn) return;
      const a = btn.dataset.a;
      const id = btn.closest('[data-id]') && btn.closest('[data-id]').dataset.id;

      if (a === 'add') {
        const o = await ui.form('طلب إجازة', [
          { n: 'empId', l: 'الموظف', opts: emps.map(x => [x.id, x.name]) },
          { n: 'type',  l: 'النوع',  opts: rules.types.map(t => [t.name, t.name]) },
          { n: 'from',  l: 'من',     t: 'date', req: 1 },
          { n: 'to',    l: 'إلى',    t: 'date', req: 1 },
          { n: 'note',  l: 'ملاحظات' }
        ], { from: today, to: today });
        if (!o) return;
        o.status = 'معلقة';
        await store.create('leaves', o);
        ui.toast('تم رفع طلب الإجازة');
        HR.refresh();
      }
      else if (a === 'ok') {
        const l = LV.find(x => x.id === id);
        const bal = L.balance(emp(l.empId), l.type, today, LV, rules, pay);
        if (!bal.unlimited && l.days > bal.remaining + (bal.pending || 0)) {
          if (!confirm('الرصيد المتبقي أقل من الأيام المطلوبة. تأكيد؟')) return;
        }
        await store.update('leaves', id, {
          status: 'موافق عليها',
          decidedBy: HR.user.email,
          decidedAt: new Date().toISOString()
        });
        ui.toast('✅ تمت الموافقة النهائية');
        HR.refresh();
      }
      else if (a === 'no') {
        const reason = await ui.prompt('سبب الرفض (اختياري)');
        if (reason === null) return;
        await store.update('leaves', id, {
          status: 'مرفوضة',
          rejectReason: reason,
          decidedBy: HR.user.email
        });
        ui.toast('تم الرفض');
        HR.refresh();
      }
    };
  }
};
