HR.empFields = [
  { n: 'name', l: 'الاسم', req: 1 }, { n: 'nid', l: 'الرقم القومي (14 رقم)' },
  { n: 'title', l: 'الوظيفة', req: 1 }, { n: 'dept', l: 'القسم', req: 1 },
  { n: 'phone', l: 'الموبايل', t: 'tel' }, { n: 'email', l: 'الإيميل', t: 'email' },
  { n: 'salary', l: 'الراتب الأساسي', t: 'number', req: 1 }, { n: 'allow', l: 'البدلات الشهرية', t: 'number' },
  { n: 'hire', l: 'تاريخ التعيين', t: 'date', req: 1 },
  { n: 'status', l: 'الحالة', opts: [['active', 'نشط'], ['leave', 'في إجازة'], ['terminated', 'منتهي خدمته']] }
];
HR.fixEmp = o => {
  o.salary = +o.salary; o.allow = +o.allow || 0;
  if (o.remoteOk !== undefined) o.remoteOk = o.remoteOk === true || o.remoteOk === 'true';
  if (o.insured !== undefined) o.insured = !(o.insured === false || o.insured === 'false');
  const r = o.nid && HR.ui.nid(o.nid); if (r) Object.assign(o, r);
  return o;
};
HR.pages.employees = {
  title: 'الموظفون', icon: 'users',
  async render(root) {
    const { store, ui, state: st } = HR;
    const E = await store.list('employees');
    const q = st.q || '', d = st.dept || '', es = st.es || 'current';
    const depts = [...new Set(E.map(e => e.dept).filter(Boolean))];
    const rows = E.filter(e =>
      (e.name + e.title + e.dept).includes(q) &&
      (!d || e.dept === d) &&
      (es === 'all' || (es === 'ended' ? e.status === 'terminated' : e.status !== 'terminated'))
    );
    const active = E.filter(e => e.status === 'active').length;
    const onLeave = E.filter(e => e.status === 'leave').length;
    const terminated = E.filter(e => e.status === 'terminated').length;
    const S = {
      active:     ['نشط',           'ok'],
      leave:      ['في إجازة',      'wa'],
      terminated: ['منتهي',         'mu']
    };

    root.innerHTML =
      ui.head('الموظفون', E.filter(e => e.status !== 'terminated').length + ' موظف نشط',
        '<input id="q" placeholder="بحث بالاسم أو الوظيفة" value="' + ui.esc(q) + '">' +
        '<select id="d"><option value="">كل الأقسام</option>' +
          depts.map(x => '<option' + (x === d ? ' selected' : '') + '>' + ui.esc(x) + '</option>').join('') +
        '</select>' +
        '<select id="es">' +
          '<option value="current"' + (es === 'current' ? ' selected' : '') + '>العاملون حاليًا</option>' +
          '<option value="ended"'   + (es === 'ended'   ? ' selected' : '') + '>منتهية خدمتهم</option>' +
          '<option value="all"'     + (es === 'all'     ? ' selected' : '') + '>الكل</option>' +
        '</select>' +
        '<button class="btn ghost" data-a="imp">استيراد Excel</button>' +
        '<button class="btn ghost" data-a="csv">تصدير</button>' +
        '<button class="btn" data-a="add">+ موظف جديد</button>'
      ) +

      /* KPI row */
      '<div class="kpi-row">' +
        '<div class="kpi-card" style="--kc:#22c55e">' +
          '<div class="kpi-ic" style="background:#f0fdf4;color:#16a34a">' + ui.icon('users') + '</div>' +
          '<div class="kpi-val">' + active + '</div><div class="kpi-lbl">نشطون</div>' +
        '</div>' +
        '<div class="kpi-card" style="--kc:#f59e0b">' +
          '<div class="kpi-ic" style="background:#fffbeb;color:#d97706">' + ui.icon('calendar') + '</div>' +
          '<div class="kpi-val">' + onLeave + '</div><div class="kpi-lbl">في إجازة</div>' +
        '</div>' +
        '<div class="kpi-card" style="--kc:#6b7280">' +
          '<div class="kpi-ic" style="background:#f9fafb;color:#6b7280">' + ui.icon('x') + '</div>' +
          '<div class="kpi-val">' + terminated + '</div><div class="kpi-lbl">منتهية خدمتهم</div>' +
        '</div>' +
        '<div class="kpi-card" style="--kc:#2563eb">' +
          '<div class="kpi-ic" style="background:#eff6ff;color:#2563eb">' + ui.icon('grid') + '</div>' +
          '<div class="kpi-val">' + depts.length + '</div><div class="kpi-lbl">قسم</div>' +
        '</div>' +
      '</div>' +

      /* Employee cards grid */
      '<div class="emp-grid">' +
        (rows.length ? rows.map(e =>
          '<div class="emp-card" data-id="' + e.id + '">' +
            '<div class="emp-card-top">' +
              '<div class="emp-avatar">' +
                (e.photo
                  ? '<img data-photo="' + ui.esc(e.photo) + '" alt="" class="lazy-photo">'
                  : '<span>' + ui.esc((e.name || 'م').trim()[0]) + '</span>') +
              '</div>' +
              ui.tag(...(S[e.status] || S.active)) +
            '</div>' +
            '<div class="emp-card-body">' +
              '<b class="emp-name">' + ui.esc(e.name) + '</b>' +
              '<span class="emp-title">' + ui.esc(e.title || '') + '</span>' +
              '<span class="emp-dept">' + ui.icon('grid') + ui.esc(e.dept || '') + '</span>' +
              '<span class="emp-hire">' + ui.icon('clock') + (e.hire || '—') + '</span>' +
            '</div>' +
            '<div class="emp-card-foot">' +
              '<button class="btn sm" data-a="view">الملف</button>' +
              '<button class="btn ghost sm" data-a="edit">تعديل</button>' +
            '</div>' +
          '</div>'
        ).join('') : '<div class="em col-span">لا توجد نتائج. جرّب بحثًا آخر أو أضف موظفًا.</div>') +
      '</div>';

    root.querySelector('#q').oninput = ui.debounce(e => {
      st.q = e.target.value;
      HR.refresh().then(() => { const i = document.querySelector('#q'); i && i.focus(); });
    });
    root.querySelector('#es').onchange = e => { st.es = e.target.value; HR.refresh(); };
    root.querySelector('#d').onchange  = e => { st.dept = e.target.value; HR.refresh(); };


    root.onclick = async e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const id = b.closest('[data-id]') && b.closest('[data-id]').dataset.id;
      const a = b.dataset.a;
      if (a === 'view') { location.hash = 'profile-' + id; return; }
      if (a === 'imp')  { HR.importEmployees(); return; }
      if (a === 'add') {
        const o = await ui.form('موظف جديد', HR.empFields, { status: 'active', allow: 0, hire: ui.today() });
        if (o) { await store.create('employees', HR.fixEmp(o)); ui.toast('تمت إضافة الموظف'); HR.refresh(); }
      }
      if (a === 'edit') {
        const cur = E.find(x => x.id === id);
        const o = await ui.form('تعديل بيانات الموظف', HR.empFields, cur);
        if (o) { await store.update('employees', id, HR.fixEmp(o)); ui.toast('تم حفظ التعديل'); HR.refresh(); }
      }
      if (a === 'csv') ui.csv('employees.csv', [['الاسم','الوظيفة','القسم','الموبايل','الراتب','التعيين']].concat(
        rows.map(r => [r.name, r.title, r.dept, r.phone, r.salary, r.hire])
      ));
    };
  }
};
