/* ─────────────────────────────────────────────────────────────────────
   org.js — الهيكل التنظيمي + Dashboard المدير
   ───────────────────────────────────────────────────────────────────── */

HR.org = {

  isManager() { return HR.user.role === 'manager'; },
  isHR()      { return HR.user.role === 'admin' || HR.user.role === 'hr'; },

  async myTeam(allEmps) {
    if (this.isHR()) return allEmps;
    const me = allEmps.find(e => e.id === HR.user.employeeId);
    if (!me) return [];
    return allEmps.filter(e => e.managerId === me.id && e.id !== me.id);
  },

  buildTree(emps) {
    const active = emps.filter(e => e.status !== 'terminated');
    const roots  = active.filter(e => !e.managerId || !active.find(x => x.id === e.managerId));
    const children = id => active.filter(e => e.managerId === id);
    const node = e => ({ emp: e, children: children(e.id).map(node) });
    return roots.map(node);
  },

  renderTree(emps) {
    const ui   = HR.ui;
    const tree = this.buildTree(emps);
    const COLORS = ['#2563eb','#7c3aed','#0891b2','#16a34a','#d97706'];

    const nodeHtml = (n, depth) => {
      const e   = n.emp;
      const col = COLORS[depth % COLORS.length];
      return (
        '<div class="org-node" style="--depth:' + depth + ';--col:' + col + '">' +
          '<div class="org-card" data-id="' + ui.esc(e.id) + '">' +
            (e.photo
              ? '<img class="lazy-photo" data-photo="' + ui.esc(e.photo) + '" style="width:40px;height:40px;border-radius:50%;object-fit:cover">'
              : '<span class="org-av" style="background:' + col + '">' + (e.name||'?').trim()[0] + '</span>') +
            '<div class="org-info">' +
              '<b>' + ui.esc(e.name) + '</b>' +
              '<small>' + ui.esc(e.title || '') + (e.dept ? ' · ' + ui.esc(e.dept) : '') + '</small>' +
            '</div>' +
            (n.children.length ? '<span class="org-count">' + n.children.length + '</span>' : '') +
          '</div>' +
          (n.children.length
            ? '<div class="org-children">' + n.children.map(c => nodeHtml(c, depth + 1)).join('') + '</div>'
            : '') +
        '</div>'
      );
    };

    if (!tree.length) return '<div class="em" style="padding:32px;text-align:center">لا يوجد هيكل تنظيمي — أضف مديرين للموظفين</div>';
    return '<div class="org-tree">' + tree.map(n => nodeHtml(n, 0)).join('') + '</div>';
  },

  async showOrgChart() {
    const { store, ui } = HR;
    const E = await store.list('employees');
    const m = ui.modal('🏢 الهيكل التنظيمي', '<div style="overflow:auto;max-height:70vh">' + this.renderTree(E) + '</div>');
    m.el.querySelectorAll('img.lazy-photo').forEach(async img => {
      const ref = img.dataset.photo; if (!ref) return;
      if (ref.startsWith('data:') || ref.startsWith('http')) { img.src = ref; return; }
      try { const url = HR.files.photoUrl ? await HR.files.photoUrl(ref) : ref; if (url) img.src = url; } catch(_) {}
    });
  }
};

/* ─────────────────────────────────────────────────────────────────────
   Dashboard المدير
   ───────────────────────────────────────────────────────────────────── */
HR.pages.manager = {
  title: 'فريقي',
  icon:  'users',

  async render(root) {
    const { store, ui } = HR, esc = ui.esc;

    const [allEmps, allLeaves, allAttend, rules, cfg] = await Promise.all([
      store.list('employees'),
      store.list('leaves'),
      store.list('attendance'),
      HR.leaves.load(),
      HR.payroll.load()
    ]);

    const me = allEmps.find(e => e.id === HR.user.employeeId);
    if (!me) {
      root.innerHTML =
        '<div class="card" style="text-align:center;padding:32px">' +
          '<div style="font-size:48px;margin-bottom:12px">🔗</div>' +
          '<h3>لم يتم ربط حسابك بموظف</h3>' +
          '<p style="color:var(--mu)">تواصل مع HR لربط حسابك بملفك الوظيفي</p>' +
        '</div>';
      return;
    }

    const team    = allEmps.filter(e => e.managerId === me.id && e.id !== me.id && e.status !== 'terminated');
    const teamIds = team.map(e => e.id);
    const today   = ui.today();

    /* إجازات الفريق */
    const teamLeaves  = allLeaves.filter(l => teamIds.includes(l.empId));
    const pending     = teamLeaves.filter(l => l.status === 'معلقة');
    const onLeaveNow  = teamLeaves.filter(l => l.status === 'موافق عليها' && l.from <= today && l.to >= today);

    /* حضور اليوم */
    const todayAttend = allAttend.filter(a => teamIds.includes(a.empId) && a.date === today);
    const presentIds  = [...new Set(todayAttend.map(a => a.empId))];
    const absentTeam  = team.filter(e => !presentIds.includes(e.id) && !onLeaveNow.find(l => l.empId === e.id));

    const empById = id => allEmps.find(e => e.id === id) || { name: '—' };
    const leaveColor = name => ((HR.leaves.type(rules, name) || {}).color) || '#5b738b';
    const statusClass = { 'موافق عليها': 'ok', 'مرفوضة': 'da', 'معلقة': 'wa', 'معلقة HR': 'wa' };

    /* ── UI ── */
    root.innerHTML =

      /* Header */
      '<div class="ph" style="margin-bottom:20px">' +
        '<div>' +
          '<h2 style="margin:0">👥 ' + esc(me.name) + '</h2>' +
          '<p style="color:var(--mu);margin:4px 0 0">' + esc(me.title || '') + ' · ' + esc(me.dept || '') + '</p>' +
        '</div>' +
        '<button class="btn ghost" data-a="org">🏢 الهيكل التنظيمي</button>' +
      '</div>' +

      /* KPIs */
      '<div class="kpi-row">' +
        '<div class="kpi-card" style="--kc:#2563eb">' +
          '<div class="kpi-ic" style="background:#eff6ff;color:#2563eb">' + ui.icon('users') + '</div>' +
          '<div class="kpi-val">' + team.length + '</div>' +
          '<div class="kpi-lbl">أعضاء الفريق</div>' +
        '</div>' +
        '<div class="kpi-card" style="--kc:#f59e0b">' +
          '<div class="kpi-ic" style="background:#fffbeb;color:#d97706">' + ui.icon('clock') + '</div>' +
          '<div class="kpi-val">' + pending.length + '</div>' +
          '<div class="kpi-lbl">طلبات معلقة</div>' +
        '</div>' +
        '<div class="kpi-card" style="--kc:#22c55e">' +
          '<div class="kpi-ic" style="background:#f0fdf4;color:#16a34a">' + ui.icon('check') + '</div>' +
          '<div class="kpi-val">' + presentIds.length + '</div>' +
          '<div class="kpi-lbl">حاضر اليوم</div>' +
        '</div>' +
        '<div class="kpi-card" style="--kc:#ef4444">' +
          '<div class="kpi-ic" style="background:#fef2f2;color:#ef4444">' + ui.icon('x') + '</div>' +
          '<div class="kpi-val">' + absentTeam.length + '</div>' +
          '<div class="kpi-lbl">غياب اليوم</div>' +
        '</div>' +
      '</div>' +

      /* طلبات معلقة */
      '<div class="card">' +
        '<div class="ph" style="margin-bottom:14px">' +
          '<h3 style="margin:0">🕐 طلبات تحتاج موافقتك' + (pending.length ? ' <span class="badge-count">' + pending.length + '</span>' : '') + '</h3>' +
        '</div>' +
        (pending.length
          ? '<div class="tw"><table>' +
              '<tr><th>الموظف</th><th>النوع</th><th>من</th><th>إلى</th><th>الأيام</th><th>ملاحظة</th><th></th></tr>' +
              pending.map(l =>
                '<tr data-id="' + esc(l.id) + '">' +
                  '<td>' + ui.who(empById(l.empId)) + '</td>' +
                  '<td><span class="tag" style="background:' + leaveColor(l.type) + '22;color:' + leaveColor(l.type) + '">' + esc(l.type) + '</span></td>' +
                  '<td>' + l.from + '</td>' +
                  '<td>' + l.to + '</td>' +
                  '<td><b>' + l.days + '</b></td>' +
                  '<td style="font-size:12px;color:var(--mu)">' + esc(l.note || '') + '</td>' +
                  '<td>' +
                    '<div style="display:flex;gap:6px">' +
                      '<button class="btn sm" data-a="mgr-ok">✓ موافقة</button>' +
                      '<button class="btn danger sm" data-a="mgr-no">✗ رفض</button>' +
                    '</div>' +
                  '</td>' +
                '</tr>'
              ).join('') +
            '</table></div>'
          : '<div class="em" style="padding:20px;text-align:center">✅ لا توجد طلبات معلقة</div>') +
      '</div>' +

      /* حضور + غياب اليوم */
      '<div class="grid-2">' +
        '<div class="card">' +
          '<h3 style="margin-bottom:14px">✅ حاضرون اليوم (' + presentIds.length + ')</h3>' +
          (presentIds.length
            ? presentIds.map(id => {
                const emp = empById(id);
                const rec = todayAttend.filter(a => a.empId === id).sort((a,b) => a.time > b.time ? 1 : -1);
                const inT = rec[0] && rec[0].type === 'in'  ? rec[0].time : '—';
                return '<div class="att-row">' + ui.who(emp) + '<span style="color:var(--mu);font-size:12px">دخول: ' + inT + '</span></div>';
              }).join('')
            : '<div class="em">لا توجد سجلات حضور اليوم</div>') +
        '</div>' +

        '<div class="card">' +
          '<h3 style="margin-bottom:14px">❌ غياب اليوم (' + absentTeam.length + ')</h3>' +
          (absentTeam.length
            ? absentTeam.map(emp =>
                '<div class="att-row">' + ui.who(emp) + '</div>'
              ).join('')
            : '<div class="em">لا غياب 🎉</div>') +
          (onLeaveNow.length
            ? '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--br)">' +
                '<b style="font-size:13px;color:var(--mu)">في إجازة اليوم:</b>' +
                onLeaveNow.map(l =>
                  '<div class="att-row">' + ui.who(empById(l.empId)) + '<span style="font-size:12px;color:var(--mu)">' + esc(l.type) + '</span></div>'
                ).join('') +
              '</div>'
            : '') +
        '</div>' +
      '</div>' +

      /* أعضاء الفريق */
      '<div class="card">' +
        '<h3 style="margin-bottom:14px">👥 أعضاء الفريق</h3>' +
        '<div class="emp-grid">' +
          team.map(emp => {
            const col = ['#2563eb','#7c3aed','#0891b2','#16a34a','#d97706'][emp.name.length % 5];
            const isPresent = presentIds.includes(emp.id);
            const isLeave   = onLeaveNow.find(l => l.empId === emp.id);
            const badge     = isLeave ? 'wa' : isPresent ? 'ok' : 'mu';
            const badgeTxt  = isLeave ? 'إجازة' : isPresent ? 'حاضر' : 'غائب';
            return (
              '<div class="emp-card" data-id="' + esc(emp.id) + '">' +
                '<div class="emp-card-top">' +
                  '<div class="emp-avatar">' +
                    (emp.photo
                      ? '<img data-photo="' + esc(emp.photo) + '" class="lazy-photo" alt="">'
                      : '<span style="background:' + col + '">' + (emp.name||'?').trim()[0] + '</span>') +
                  '</div>' +
                  ui.tag(badgeTxt, badge) +
                '</div>' +
                '<div class="emp-card-body">' +
                  '<b class="emp-name">' + esc(emp.name) + '</b>' +
                  '<span class="emp-title">' + esc(emp.title || '') + '</span>' +
                  '<span class="emp-dept">' + ui.icon('grid') + esc(emp.dept || '') + '</span>' +
                '</div>' +
                '<div class="emp-card-foot">' +
                  '<button class="btn sm" data-a="view">الملف</button>' +
                  '<button class="btn ghost sm" data-a="leaves">الإجازات</button>' +
                '</div>' +
              '</div>'
            );
          }).join('') +
        '</div>' +
      '</div>';

    /* ── Events ── */
    root.onclick = async ev => {
      const btn = ev.target.closest('[data-a]'); if (!btn) return;
      const a   = btn.dataset.a;
      const row = btn.closest('[data-id]');
      const id  = row && row.dataset.id;

      if (a === 'org')    { HR.org.showOrgChart(); return; }
      if (a === 'view')   { location.hash = 'profile-' + id; return; }

      if (a === 'leaves') {
        const emp = empById(id);
        const lv  = teamLeaves.filter(l => l.empId === id);
        HR.ui.modal('إجازات ' + emp.name,
          '<div class="tw"><table>' +
            '<tr><th>النوع</th><th>من</th><th>إلى</th><th>الأيام</th><th>الحالة</th></tr>' +
            (lv.length
              ? lv.map(l =>
                  '<tr><td>' + esc(l.type) + '</td><td>' + l.from + '</td><td>' + l.to + '</td>' +
                  '<td>' + l.days + '</td><td>' + ui.tag(l.status, statusClass[l.status] || 'mu') + '</td></tr>'
                ).join('')
              : '<tr><td colspan="5" style="text-align:center;color:var(--mu)">لا توجد إجازات</td></tr>') +
          '</table></div>'
        );
        return;
      }

      if (a === 'mgr-ok') {
        const lv  = allLeaves.find(l => l.id === id);
        const emp = allEmps.find(e => e.id === lv.empId);
        const bal = HR.leaves.balance(emp, lv.type, today, allLeaves, rules, cfg.rules);
        if (!bal.unlimited && lv.days > bal.remaining) {
          if (!confirm('الرصيد المتبقي (' + bal.remaining + ' يوم) أقل من الأيام المطلوبة (' + lv.days + '). تأكيد؟')) return;
        }
        await store.update('leaves', id, {
          mgrStatus: 'موافق', mgrBy: HR.user.email, mgrAt: new Date().toISOString(),
          status: 'معلقة HR'
        });
        ui.toast('✅ تمت الموافقة — الطلب في انتظار HR');
        HR.refresh();
      }

      if (a === 'mgr-no') {
        const reason = await ui.prompt('سبب الرفض (اختياري)');
        if (reason === null) return;
        await store.update('leaves', id, {
          mgrStatus: 'مرفوض', mgrBy: HR.user.email, mgrAt: new Date().toISOString(),
          status: 'مرفوضة', rejectReason: reason
        });
        ui.toast('تم رفض الطلب');
        HR.refresh();
      }
    };
  }
};
