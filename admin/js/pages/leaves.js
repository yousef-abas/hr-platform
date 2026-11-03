HR.pages.leaves = {
  title: 'الإجازات', icon: 'calendar',
  async render(root) {
    const { store, ui } = HR, QUOTA = 21;
    const E = (await store.list('employees')).filter(e => e.status !== 'terminated');
    const L = (await store.list('leaves')).reverse();
    const name = id => (E.find(e => e.id === id) || { name: 'محذوف' }).name;
    const used = id => L.filter(l => l.empId === id && l.type === 'سنوية' && l.status === 'معتمدة').reduce((s, l) => s + l.days, 0);
    const C = { 'معلقة': 'wa', 'معتمدة': 'ok', 'مرفوضة': 'da' };
    root.innerHTML = ui.head('الإجازات', 'الطلبات والأرصدة', '<button class="btn" data-a="add">+ طلب إجازة</button>') +
      '<div class="card"><h3>رصيد الإجازة السنوية (' + QUOTA + ' يوم)</h3>' + E.map(e => { const u = used(e.id); return '<div class="bal"><span>' + ui.esc(e.name) + '</span><div class="pb"><i style="width:' + Math.min(100, u / QUOTA * 100) + '%"></i></div><span>' + (QUOTA - u) + ' متبقي</span></div>'; }).join('') + '</div>' +
      '<div class="card tw"><h3>الطلبات</h3><table><tr><th>الموظف</th><th>النوع</th><th>من</th><th>إلى</th><th>الأيام</th><th>الحالة</th><th></th></tr>' +
      L.map(l => '<tr data-id="' + l.id + '"><td>' + ui.esc(name(l.empId)) + '</td><td>' + l.type + '</td><td>' + l.from + '</td><td>' + l.to + '</td><td>' + l.days + '</td><td>' + ui.tag(l.status, C[l.status]) + '</td><td>' + (l.status === 'معلقة' ? '<button class="btn sm" data-a="ok">اعتماد</button> <button class="btn danger sm" data-a="no">رفض</button>' : '') + '</td></tr>').join('') +
      '</table>' + (L.length ? '' : '<div class="em">لا توجد طلبات بعد</div>') + '</div>';
    root.onclick = async e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a, id = b.closest('tr') && b.closest('tr').dataset.id;
      if (a === 'add') {
        const o = await ui.form('طلب إجازة', [
          { n: 'empId', l: 'الموظف', opts: E.map(x => [x.id, x.name]) }, { n: 'type', l: 'النوع', opts: ['سنوية', 'مرضية', 'عارضة', 'بدون مرتب'] },
          { n: 'from', l: 'من', t: 'date', req: 1 }, { n: 'to', l: 'إلى', t: 'date', req: 1 }, { n: 'note', l: 'ملاحظة' }], { from: ui.today(), to: ui.today() });
        if (!o) return;
        if (o.to < o.from) return ui.toast('تاريخ النهاية قبل البداية');
        o.days = ui.days(o.from, o.to); o.status = 'معلقة';
        await store.create('leaves', o); ui.toast('تم إرسال الطلب'); HR.refresh();
      } else { await store.update('leaves', id, { status: a === 'ok' ? 'معتمدة' : 'مرفوضة' }); ui.toast(a === 'ok' ? 'تم الاعتماد' : 'تم الرفض'); HR.refresh(); }
    };
  }
};
