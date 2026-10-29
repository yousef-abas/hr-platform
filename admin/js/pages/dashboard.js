HR.pages.dashboard = {
  title: 'الرئيسية', icon: 'grid',
  async render(root) {
    const { store, ui } = HR;
    const [E, A, L, C] = await Promise.all(['employees', 'attendance', 'leaves', 'candidates'].map(t => store.list(t)));
    const act = E.filter(e => e.status !== 'terminated');
    const td = ui.today();
    const present = A.filter(a => a.date === td && a.in).length;
    const pend = L.filter(l => l.status === 'معلقة');
    const total = act.reduce((s, e) => s + e.salary + (e.allow || 0), 0);
    const stats = [['الموظفون', act.length], ['حاضرون اليوم', present + ' من ' + act.length], ['إجازات معلقة', pend.length], ['مرشحون في التوظيف', C.length], ['إجمالي الرواتب الشهرية', ui.money(total)]];
    root.innerHTML = ui.head('الرئيسية', 'نظرة سريعة على الشركة اليوم') +
      '<div class="stats">' + stats.map(s => '<div class="card stat"><span>' + s[0] + '</span><b>' + s[1] + '</b></div>').join('') + '</div>' +
      '<div class="card"><h3>الموظفون حسب القسم</h3><div class="cv"><canvas id="c1"></canvas></div></div>' +
      '<div class="card"><h3>الحضور في آخر 7 أيام</h3><div class="cv"><canvas id="c2"></canvas></div></div>' +
      '<div class="card"><h3>طلبات تحتاج قرارًا</h3>' + (pend.length ? '<table>' + pend.map(l => {
        const e = E.find(x => x.id === l.empId) || { name: 'محذوف' };
        return '<tr><td>' + ui.esc(e.name) + '</td><td>' + l.type + '</td><td>' + l.from + ' إلى ' + l.to + '</td><td>' + l.days + ' يوم</td></tr>';
      }).join('') + '</table>' : '<div class="em">لا توجد طلبات معلقة</div>') + '</div>';
    if (!window.Chart) return;
    const d = {}; act.forEach(e => d[e.dept] = (d[e.dept] || 0) + 1);
    new Chart(root.querySelector('#c1'), { type: 'doughnut', data: { labels: Object.keys(d), datasets: [{ data: Object.values(d), backgroundColor: ['#4f46e5', '#0e9f9a', '#d9822b', '#c2417a', '#2f7de1'] }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { family: 'Cairo' } } } } } });
    const lab = [], val = [];
    for (let i = 6; i >= 0; i--) { const x = new Date(); x.setDate(x.getDate() - i); const s = x.toISOString().slice(0, 10); lab.push(s.slice(5)); val.push(A.filter(a => a.date === s && a.in).length); }
    new Chart(root.querySelector('#c2'), { type: 'bar', data: { labels: lab, datasets: [{ label: 'عدد الحاضرين', data: val, backgroundColor: '#4f46e5', borderRadius: 6 }] }, options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } } });
  }
};
