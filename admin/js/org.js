/* ─────────────────────────────────────────────────────────────────────
   org.js — الهيكل التنظيمي + صلاحيات المدير
   ───────────────────────────────────────────────────────────────────── */

HR.org = {

  /* ── هل المستخدم الحالي مدير؟ ── */
  isManager() { return HR.user.role === 'manager'; },
  isHR()      { return HR.user.role === 'admin' || HR.user.role === 'hr'; },

  /* ── موظفو المدير الحالي ── */
  async myTeam(allEmps) {
    if (this.isHR()) return allEmps; // HR يشوف الكل
    const me = allEmps.find(e => e.id === HR.user.employeeId);
    if (!me) return [];
    return allEmps.filter(e => e.managerId === me.id);
  },

  /* ── إجازات الفريق المعلقة عند المدير ── */
  teamPendingLeaves(leaves, teamIds) {
    return leaves.filter(l =>
      teamIds.includes(l.empId) &&
      l.status === 'معلقة'
    );
  },

  /* ── شجرة الهيكل التنظيمي ── */
  buildTree(emps) {
    const roots = emps.filter(e => !e.managerId || !emps.find(x => x.id === e.managerId));
    const children = id => emps.filter(e => e.managerId === id);
    const node = e => ({ emp: e, children: children(e.id).map(node) });
    return roots.map(node);
  },

  /* ── عرض شجرة الهيكل التنظيمي ── */
  renderTree(emps) {
    const ui = HR.ui;
    const tree = this.buildTree(emps.filter(e => e.status !== 'terminated'));

    const nodeHtml = (n, depth) => {
      const e = n.emp;
      const hasChildren = n.children.length > 0;
      const col = ['#2563eb','#7c3aed','#0891b2','#16a34a','#d97706'][depth % 5];
      return `
        <div class="org-node" style="--depth:${depth};--col:${col}">
          <div class="org-card" data-id="${ui.esc(e.id)}">
            ${e.photo
              ? `<img class="av lazy-photo" data-photo="${ui.esc(e.photo)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover">`
              : `<span class="org-av" style="background:${col}">${(e.name||'?').trim()[0]}</span>`
            }
            <div class="org-info">
              <b>${ui.esc(e.name)}</b>
              <small>${ui.esc(e.title||'')}${e.dept ? ' · ' + ui.esc(e.dept) : ''}</small>
            </div>
            ${hasChildren ? `<span class="org-count">${n.children.length}</span>` : ''}
          </div>
          ${hasChildren ? `<div class="org-children">${n.children.map(c => nodeHtml(c, depth+1)).join('')}</div>` : ''}
        </div>`;
    };

    if (!tree.length) return '<div class="em" style="padding:32px;text-align:center">لا يوجد هيكل تنظيمي — عيّن مديرين للموظفين أولاً</div>';
    return '<div class="org-tree">' + tree.map(n => nodeHtml(n, 0)).join('') + '</div>';
  },

  /* ── صفحة الهيكل التنظيمي ── */
  async showOrgChart() {
    const { store, ui } = HR;
    const E = await store.list('employees');
    const m = ui.modal('🏢 الهيكل التنظيمي', `
      <div style="overflow:auto;max-height:70vh">
        ${this.renderTree(E)}
      </div>
    `);
    // lazy photos
    m.el.querySelectorAll('img.lazy-photo').forEach(async img => {
      const ref = img.dataset.photo;
      if (!ref) return;
      if (ref.startsWith('data:') || ref.startsWith('http')) { img.src = ref; return; }
      try { const url = HR.files.photoUrl ? await HR.files.photoUrl(ref) : ref; if (url) img.src = url; } catch(_) {}
    });
  }
};

/* ─────────────────────────────────────────────────────────────────────
   صفحة الموافقة للمدير — يشوف طلبات فريقه
   ───────────────────────────────────────────────────────────────────── */
HR.pages.manager = {
  title: 'فريقي',
  icon: 'users',
  async render(root) {
    const { store, ui } = HR, esc = ui.esc;
    const [allEmps, allLeaves, rules, cfg] = await Promise.all([
      store.list('employees'),
      store.list('leaves'),
      HR.leaves.load(),
      HR.payroll.load()
    ]);

    const me = allEmps.find(e => e.id === HR.user.employeeId);
    if (!me) {
      root.innerHTML = '<div class="card em">لم يتم ربط حسابك بموظف — تواصل مع HR</div>';
      return;
    }

    const team = allEmps.filter(e => e.managerId === me.id && e.status !== 'terminated');
    const teamIds = team.map(e => e.id);
    const teamLeaves = allLeaves.filter(l => teamIds.includes(l.empId));
    const pending = teamLeaves.filter(l => l.status === 'معلقة');

    const empName = id => (allEmps.find(e => e.id === id) || {}).name || '—';
    const tcol = n => ((HR.leaves.type(rules, n) || {}).color) || '#5b738b';

    root.innerHTML =
      ui.head('فريقي', me.name + ' · ' + (me.dept || ''),
        '<button class="btn ghost" data-a="org">🏢 الهيكل التنظيمي</button>'
      ) +

      /* KPIs */
      '<div class="kpi-row">' +
        '<div class="kpi-card" style="--kc:#2563eb"><div class="kpi-ic" style="background:#eff6ff;color:#2563eb">' + ui.icon('users') + '</div><div class="kpi-val">' + team.length + '</div><div class="kpi-lbl">أعضاء الفريق</div></div>' +
        '<div class="kpi-card" style="--kc:#f59e0b"><div class="kpi-ic" style="background:#fffbeb;color:#d97706">' + ui.icon('clock') + '</div><div class="kpi-val">' + pending.length + '</div><div class="kpi-lbl">طلبات معلقة</div></div>' +
        '<div class="kpi-card" style="--kc:#22c55e"><div class="kpi-ic" style="background:#f0fdf4;color:#16a34a">' + ui.icon('check') + '</div><div class="kpi-val">' + teamLeaves.filter(l=>l.status==='موافق عليها').length + '</div><div class="kpi-lbl">موافق عليها</div></div>' +
      '</div>' +

      /* الطلبات المعلقة */
      (pending.length ? `
        <div class="card">
          <h3 style="margin-bottom:14px">⏳ طلبات تحتاج موافقتك (${pending.length})</h3>
          <div class="tw"><table>
            <tr><th>الموظف</th><th>النوع</th><th>من</th><th>إلى</th><th>الأيام</th><th>ملاحظات</th><th></th></tr>
            ${pending.map(l => `
              <tr data-id="${esc(l.id)}">
                <td>${ui.who(allEmps.find(e=>e.id===l.empId)||{name:empName(l.empId)})}</td>
                <td><span class="tag" style="background:${tcol(l.type)}22;color:${tcol(l.type)}">${esc(l.type)}</span></td>
                <td>${l.from}</td><td>${l.to}</td>
                <td><b>${l.days}</b></td>
                <td style="font-size:12px;color:var(--mu)">${esc(l.note||'')}</td>
                <td>
                  <div style="display:flex;gap:6px">
                    <button class="btn sm" data-a="mgr-ok">موافق</button>
                    <button class="btn danger sm" data-a="mgr-no">رفض</button>
                  </div>
                </td>
              </tr>`).join('')}
          </table></div>
        </div>` : '<div class="card" style="text-align:center;padding:24px;color:var(--mu)">✅ لا توجد طلبات معلقة</div>') +

      /* أعضاء الفريق */
      '<div class="card">' +
        '<h3 style="margin-bottom:14px">👥 أعضاء الفريق</h3>' +
        '<div class="emp-grid">' +
          team.map(e => `
            <div class="emp-card" data-id="${esc(e.id)}">
              <div class="emp-card-top">
                <div class="emp-avatar">
                  ${e.photo
                    ? `<img data-photo="${esc(e.photo)}" class="lazy-photo" alt="">`
                    : `<span>${(e.name||'?').trim()[0]}</span>`}
                </div>
                ${ui.tag('نشط','ok')}
              </div>
              <div class="emp-card-body">
                <b class="emp-name">${esc(e.name)}</b>
                <span class="emp-title">${esc(e.title||'')}</span>
                <span class="emp-dept">${ui.icon('grid')}${esc(e.dept||'')}</span>
              </div>
              <div class="emp-card-foot">
                <button class="btn sm" data-a="view">الملف</button>
                <button class="btn ghost sm" data-a="leaves">إجازاته</button>
              </div>
            </div>`).join('') +
        '</div>' +
      '</div>';

    /* Events */
    root.onclick = async e => {
      const btn = e.target.closest('[data-a]'); if (!btn) return;
      const a = btn.dataset.a;
      const rowId = btn.closest('[data-id]') && btn.closest('[data-id]').dataset.id;

      if (a === 'org') { HR.org.showOrgChart(); return; }

      if (a === 'view') { location.hash = 'profile-' + rowId; return; }

      if (a === 'leaves') {
        const emp = allEmps.find(x => x.id === rowId);
        const lv  = teamLeaves.filter(l => l.empId === rowId);
        HR.ui.modal('إجازات ' + (emp||{}).name, `
          <div class="tw"><table>
            <tr><th>النوع</th><th>من</th><th>إلى</th><th>الأيام</th><th>الحالة</th></tr>
            ${lv.length
              ? lv.map(l => `<tr>
                  <td>${esc(l.type)}</td><td>${l.from}</td><td>${l.to}</td>
                  <td>${l.days}</td>
                  <td>${ui.tag(l.status, {موافق:'ok','موافق عليها':'ok',مرفوضة:'da',معلقة:'wa','معلقة HR':'wa'}[l.status])}</td>
                </tr>`).join('')
              : '<tr><td colspan="5" style="text-align:center;color:var(--mu)">لا توجد إجازات</td></tr>'}
          </table></div>
        `);
        return;
      }

      if (a === 'mgr-ok') {
        const lv = allLeaves.find(l => l.id === rowId);
        const bal = HR.leaves.balance(allEmps.find(x=>x.id===lv.empId), lv.type, ui.today(), allLeaves, rules, cfg.rules);
        if (!bal.unlimited && lv.days > bal.remaining) {
          if (!confirm('الرصيد المتبقي أقل من الأيام المطلوبة. تأكيد؟')) return;
        }
        await store.update('leaves', rowId, {
          mgrStatus: 'موافق', mgrBy: HR.user.email, mgrAt: new Date().toISOString(),
          status: 'معلقة HR'
        });
        ui.toast('✅ تمت الموافقة — الطلب الآن عند HR');
        HR.refresh();
      }

      if (a === 'mgr-no') {
        const reason = await ui.prompt('سبب الرفض (اختياري)');
        if (reason === null) return;
        await store.update('leaves', rowId, {
          mgrStatus: 'مرفوض', mgrBy: HR.user.email, mgrAt: new Date().toISOString(),
          status: 'مرفوضة', rejectReason: reason
        });
        ui.toast('تم رفض الطلب');
        HR.refresh();
      }
    };
  }
};
