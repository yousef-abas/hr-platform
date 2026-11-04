HR.pages.dashboard = {
  title: 'الرئيسية', icon: 'grid',
  async render(root) {
    const { store, ui } = HR;
    const [E, A, L, C] = await Promise.all(['employees', 'attendance', 'leaves', 'candidates'].map(t => store.list(t)));
    const act = E.filter(e => e.status !== 'terminated'), td = ui.today();
    const present = A.filter(a => a.date === td && a.in).length;
    const pend = L.filter(l => l.status === 'معلقة');
    const away = L.filter(l => l.status === 'معتمدة' && l.from <= td && l.to >= td);
    const total = act.reduce((s, e) => s + e.salary + (e.allow || 0), 0);
    const nm = id => (E.find(e => e.id === id) || { name: 'محذوف' }).name;
    const g = new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير';
    const pct = act.length ? Math.round(present / act.length * 100) : 0;
    const kp = [['c-ac', act.length, 'الموظفون النشطون', 'من إجمالي ' + E.length + ' في السجل', 100], [pct >= 80 ? 'c-ok' : 'c-wa', pct + '%', 'حضور اليوم', present + ' من ' + act.length + ' موظف', pct], [pend.length ? 'c-wa' : 'c-ok', pend.length, 'طلبات معلقة', away.length + ' في إجازة اليوم', Math.min(100, pend.length * 20)], ['c-ac', ui.money(total), 'الرواتب الشهرية', C.length + ' مرشح في التوظيف', 100]];
    const qa = [['#attendance', 'clock', 'سجل الحضور'], ['#leaves', 'calendar', 'طلب إجازة'], ['#employees', 'users', 'الموظفون'], ['#payroll', 'wallet', 'قسائم الرواتب'], ['#recruitment', 'userplus', 'مرشح جديد'], ['#performance', 'star', 'تقييم أداء']];
    root.innerHTML =
      '<div class="hero"><div><h2>' + g + '، ' + ui.esc(HR.user.name) + '</h2><p>' + new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '</p></div><div class="hb"><span class="btn light">' + (pend.length ? pend.length + ' مهمة تنتظر قرارك' : 'لا توجد مهام معلقة') + '</span></div></div>' +
      '<div class="sec">إجراءات سريعة</div><div class="qa">' + qa.map(q => '<a class="qt" href="' + q[0] + '"><span>' + ui.icon(q[1]) + '</span>' + q[2] + '</a>').join('') + '</div>' +
      '<div class="sec">مهامك اليوم</div><div class="g2"><div class="card"><h3>طلبات تحتاج قرارك</h3><div class="rows">' + (pend.length ? pend.map(l => '<div data-id="' + l.id + '"><span>' + ui.esc(nm(l.empId)) + '<br><small style="color:var(--mu)">' + l.type + ' • ' + l.days + ' يوم • ' + l.from + '</small></span><span><button class="btn sm" data-a="ok">اعتماد</button> <button class="btn danger sm" data-a="no">رفض</button></span></div>').join('') : '<div class="em">لا توجد طلبات معلقة</div>') + '</div></div>' +
      '<div class="card"><h3>في إجازة اليوم</h3><div class="rows">' + (away.length ? away.map(l => '<div><span>' + ui.esc(nm(l.empId)) + '</span><span>' + ui.tag(l.type, 'wa') + ' حتى ' + l.to + '</span></div>').join('') : '<div class="em">الكل موجود النهاردة</div>') + '</div></div></div>' +
      '<div class="sec">مؤشرات</div><div class="stats">' + kp.map(k => '<div class="card kpi"><span>' + k[2] + '</span><b class="' + k[0] + '">' + k[1] + '</b><small>' + k[3] + '</small><div class="pb"><i style="width:' + k[4] + '%"></i></div></div>').join('') + '</div>' +
      '<div class="sec">تحليلات</div><div class="g2"><div class="card"><h3>الموظفون حسب القسم</h3><div class="cv"><canvas id="c1"></canvas></div></div><div class="card"><h3>الحضور في آخر 7 أيام</h3><div class="cv"><canvas id="c2"></canvas></div></div></div>';
    root.onclick = async e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      await store.update('leaves', b.closest('[data-id]').dataset.id, { status: b.dataset.a === 'ok' ? 'معتمدة' : 'مرفوضة' });
      ui.toast(b.dataset.a === 'ok' ? 'تم الاعتماد' : 'تم الرفض'); HR.refresh();
    };
    if (!window.Chart) return;
    Chart.defaults.font.family = 'Cairo';
    const d = {}; act.forEach(e => d[e.dept] = (d[e.dept] || 0) + 1);
    new Chart(root.querySelector('#c1'), { type: 'doughnut', data: { labels: Object.keys(d), datasets: [{ data: Object.values(d), backgroundColor: ['#0070f2', '#0e9f9a', '#c35500', '#a9306f', '#5b738b'], borderWidth: 0 }] }, options: { maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right' } } } });
    const lab = [], val = [];
    for (let i = 6; i >= 0; i--) { const x = new Date(); x.setDate(x.getDate() - i); const s = ui.iso(x); lab.push(s.slice(5)); val.push(A.filter(a => a.date === s && a.in).length); }
    new Chart(root.querySelector('#c2'), { type: 'bar', data: { labels: lab, datasets: [{ data: val, backgroundColor: '#0070f2', borderRadius: 8, maxBarThickness: 36 }] }, options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eef0f6' } }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } } });
  }
};
