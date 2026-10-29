HR.pages.attendance = {
  title: 'الحضور', icon: 'clock',
  async render(root) {
    const { store, ui, state: st } = HR;
    st.date = st.date || ui.today();
    const E = (await store.list('employees')).filter(e => e.status !== 'terminated');
    const A = await store.list('attendance');
    const rec = id => A.find(a => a.empId === id && a.date === st.date) || {};
    const month = st.date.slice(0, 7);
    root.innerHTML = ui.head('الحضور والانصراف', 'سجل اليوم وملخص الشهر', '<input type="date" id="dt" value="' + st.date + '">') +
      '<div class="card tw"><h3>سجل يوم ' + st.date + '</h3><table><tr><th>الموظف</th><th>الحضور</th><th>الانصراف</th><th>الحالة</th><th></th></tr>' +
      E.map(e => {
        const r = rec(e.id);
        const s = !r.in ? ui.tag('لم يسجل', 'da') : r.in > '09:30' ? ui.tag('متأخر', 'wa') : ui.tag('في الموعد', 'ok');
        const btn = !r.in ? 'تسجيل حضور' : !r.out ? 'تسجيل انصراف' : '';
        return '<tr data-id="' + e.id + '"><td>' + ui.who(e) + '</td><td><input type="time" data-f="in" value="' + (r.in || '') + '"></td><td><input type="time" data-f="out" value="' + (r.out || '') + '"></td><td>' + s + '</td><td>' + (btn ? '<button class="btn sm" data-a="now">' + btn + '</button>' : '') + '</td></tr>';
      }).join('') + '</table></div>' +
      '<div class="card tw"><h3>ملخص شهر ' + month + '</h3><table><tr><th>الموظف</th><th>أيام الحضور</th><th>مرات التأخير</th></tr>' +
      E.map(e => { const m = A.filter(a => a.empId === e.id && a.date.startsWith(month) && a.in); return '<tr><td>' + ui.esc(e.name) + '</td><td>' + m.length + '</td><td>' + m.filter(a => a.in > '09:30').length + '</td></tr>'; }).join('') + '</table></div>';
    const put = async (empId, f, v) => {
      const r = A.find(a => a.empId === empId && a.date === st.date);
      if (r) await store.update('attendance', r.id, { [f]: v }); else await store.create('attendance', { empId, date: st.date, in: '', out: '', [f]: v });
      HR.refresh();
    };
    root.querySelector('#dt').onchange = e => { st.date = e.target.value || ui.today(); HR.refresh(); };
    root.onchange = e => { const t = e.target; if (t.dataset.f) put(t.closest('tr').dataset.id, t.dataset.f, t.value); };
    root.onclick = e => {
      const b = e.target.closest('[data-a="now"]'); if (!b) return;
      const id = b.closest('tr').dataset.id, r = rec(id), n = new Date().toTimeString().slice(0, 5);
      put(id, r.in ? 'out' : 'in', n);
    };
  }
};
