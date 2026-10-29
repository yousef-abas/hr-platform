HR.empFields = [
  { n: 'name', l: 'الاسم', req: 1 }, { n: 'title', l: 'الوظيفة', req: 1 }, { n: 'dept', l: 'القسم', req: 1 },
  { n: 'phone', l: 'الموبايل', t: 'tel' }, { n: 'email', l: 'الإيميل', t: 'email' },
  { n: 'salary', l: 'الراتب الأساسي', t: 'number', req: 1 }, { n: 'allow', l: 'البدلات الشهرية', t: 'number' },
  { n: 'hire', l: 'تاريخ التعيين', t: 'date', req: 1 },
  { n: 'status', l: 'الحالة', opts: [['active', 'نشط'], ['leave', 'في إجازة'], ['terminated', 'منتهي خدمته']] }
];
HR.pages.employees = {
  title: 'الموظفون', icon: 'users',
  async render(root) {
    const { store, ui, state: st } = HR;
    const E = await store.list('employees');
    const q = st.q || '', d = st.dept || '';
    const depts = [...new Set(E.map(e => e.dept))];
    const rows = E.filter(e => (e.name + e.title + e.dept).includes(q) && (!d || e.dept === d));
    const S = { active: ['نشط', 'ok'], leave: ['في إجازة', 'wa'], terminated: ['منتهي', 'mu'] };
    root.innerHTML = ui.head('الموظفون', E.length + ' في السجل',
      '<input id="q" placeholder="بحث بالاسم أو الوظيفة" value="' + ui.esc(q) + '"><select id="d"><option value="">كل الأقسام</option>' + depts.map(x => '<option' + (x === d ? ' selected' : '') + '>' + ui.esc(x) + '</option>').join('') + '</select><button class="btn ghost" data-a="csv">تصدير</button><button class="btn" data-a="add">+ موظف جديد</button>') +
      '<div class="card tw"><table><tr><th>الموظف</th><th>القسم</th><th>الموبايل</th><th>الراتب</th><th>التعيين</th><th>الحالة</th><th></th></tr>' +
      rows.map(e => '<tr data-id="' + e.id + '"><td>' + ui.who(e) + '</td><td>' + ui.esc(e.dept) + '</td><td>' + ui.esc(e.phone) + '</td><td>' + ui.money(e.salary) + '</td><td>' + e.hire + '</td><td>' + ui.tag(...(S[e.status] || S.active)) + '</td><td><button class="btn ghost sm" data-a="edit">تعديل</button> <button class="btn danger sm" data-a="del">حذف</button></td></tr>').join('') +
      '</table>' + (rows.length ? '' : '<div class="em">لا توجد نتائج. جرّب بحثًا آخر أو أضف موظفًا.</div>') + '</div>';
    const num = o => { o.salary = +o.salary; o.allow = +o.allow || 0; return o; };
    root.querySelector('#q').oninput = e => { st.q = e.target.value; HR.refresh().then(() => { const i = document.querySelector('#q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); };
    root.querySelector('#d').onchange = e => { st.dept = e.target.value; HR.refresh(); };
    root.onclick = async e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const id = b.closest('tr') && b.closest('tr').dataset.id, a = b.dataset.a;
      if (a === 'add') { const o = await ui.form('موظف جديد', HR.empFields, { status: 'active', allow: 0, hire: ui.today() }); if (o) { await store.create('employees', num(o)); ui.toast('تمت إضافة الموظف'); HR.refresh(); } }
      if (a === 'edit') { const cur = E.find(x => x.id === id); const o = await ui.form('تعديل بيانات الموظف', HR.empFields, cur); if (o) { await store.update('employees', id, num(o)); ui.toast('تم حفظ التعديل'); HR.refresh(); } }
      if (a === 'del' && confirm('حذف هذا الموظف نهائيًا؟')) { await store.remove('employees', id); ui.toast('تم الحذف'); HR.refresh(); }
      if (a === 'csv') ui.csv('employees.csv', [['الاسم', 'الوظيفة', 'القسم', 'الموبايل', 'الراتب', 'التعيين']].concat(rows.map(r => [r.name, r.title, r.dept, r.phone, r.salary, r.hire])));
    };
  }
};
