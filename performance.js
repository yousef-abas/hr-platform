HR.pages.performance = {
  title: 'تقييم الأداء', icon: 'star',
  async render(root) {
    const { store, ui } = HR;
    const E = (await store.list('employees')).filter(e => e.status !== 'terminated');
    const R = (await store.list('reviews')).reverse();
    const nm = id => (E.find(e => e.id === id) || { name: 'محذوف' }).name;
    const avgAll = R.length ? (R.reduce((s, r) => s + r.avg, 0) / R.length).toFixed(1) : '—';
    const rank = E.map(e => { const r = R.filter(x => x.empId === e.id); return { e, n: r.length, a: r.length ? r.reduce((s, x) => s + x.avg, 0) / r.length : 0 }; }).filter(x => x.n).sort((a, b) => b.a - a.a);
    root.innerHTML = ui.head('تقييم الأداء', 'قيّم الموظفين على أربعة محاور وتابع الترتيب', '<button class="btn" data-a="add">+ تقييم جديد</button>') +
      '<div class="stats"><div class="card stat"><span class="chip k4">' + ui.icon('star') + '</span><div><span>متوسط التقييم</span><b>' + avgAll + ' / 5</b><small>' + R.length + ' تقييم</small></div></div></div>' +
      '<div class="g2"><div class="card"><h3>ترتيب الموظفين</h3><div class="rows">' + (rank.length ? rank.map((x, i) => '<div><span>' + (i + 1) + '. ' + ui.esc(x.e.name) + '</span><span>' + ui.stars(x.a) + ' ' + x.a.toFixed(1) + '</span></div>').join('') : '<div class="em">لا توجد تقييمات بعد</div>') + '</div></div>' +
      '<div class="card tw"><h3>آخر التقييمات</h3><table><tr><th>الموظف</th><th>الفترة</th><th>الجودة</th><th>التعاون</th><th>الالتزام</th><th>المبادرة</th><th>المتوسط</th><th></th></tr>' +
      R.map(r => '<tr data-id="' + r.id + '"><td>' + ui.esc(nm(r.empId)) + '</td><td>' + r.period + '</td><td>' + r.q + '</td><td>' + r.t + '</td><td>' + r.p + '</td><td>' + r.i + '</td><td><b>' + r.avg.toFixed(1) + '</b></td><td><button class="btn danger sm" data-a="del">حذف</button></td></tr>').join('') + '</table>' + (R.length ? '' : '<div class="em">ابدأ بإضافة أول تقييم</div>') + '</div></div>';
    const sc = [1, 2, 3, 4, 5].map(n => [n, n + ' / 5']).reverse();
    root.onclick = async e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'del') { await store.remove('reviews', b.closest('tr').dataset.id); HR.refresh(); return; }
      const o = await ui.form('تقييم جديد', [{ n: 'empId', l: 'الموظف', opts: E.map(x => [x.id, x.name]) }, { n: 'period', l: 'الفترة', t: 'month', req: 1 },
        { n: 'q', l: 'جودة العمل', opts: sc }, { n: 't', l: 'التعاون', opts: sc }, { n: 'p', l: 'الالتزام بالمواعيد', opts: sc }, { n: 'i', l: 'المبادرة', opts: sc }, { n: 'note', l: 'ملاحظات' }], { period: ui.today().slice(0, 7), q: 4, t: 4, p: 4, i: 4 });
      if (!o) return;
      ['q', 't', 'p', 'i'].forEach(k => o[k] = +o[k]); o.avg = (o.q + o.t + o.p + o.i) / 4;
      await store.create('reviews', o); ui.toast('تم حفظ التقييم'); HR.refresh();
    };
  }
};
