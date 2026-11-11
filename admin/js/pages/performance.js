HR.pages.performance = {
  title: 'تقييم الأداء', icon: 'star',
  async render(root) {
    const { store, ui } = HR;
    const E = (await store.list('employees')).filter(e => e.status !== 'terminated');
    const R = (await store.list('reviews')).reverse();
    const nm = id => (E.find(e => e.id === id) || { name: 'محذوف' }).name;
    const avgAll = R.length ? (R.reduce((s, r) => s + r.avg, 0) / R.length).toFixed(1) : '—';
    const rank = E.map(e => {
      const r = R.filter(x => x.empId === e.id);
      return { e, n: r.length, a: r.length ? r.reduce((s, x) => s + x.avg, 0) / r.length : 0 };
    }).filter(x => x.n).sort((a, b) => b.a - a.a);

    const scoreBar = (val, max = 5) => {
      const pct = (val / max) * 100;
      const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
      return '<div class="score-bar"><div class="score-fill" style="width:' + pct + '%;background:' + color + '"></div></div>';
    };
    const medal = i => ['🥇', '🥈', '🥉'][i] || (i + 1) + '.';

    root.innerHTML =
      ui.head('تقييم الأداء', 'قيّم الموظفين على أربعة محاور وتابع الترتيب',
        '<button class="btn ghost" data-a="compare">📊 مقارنة موظف</button>' +
        '<button class="btn" data-a="add">+ تقييم جديد</button>'
      ) +

      /* KPI */
      '<div class="kpi-row">' +
        '<div class="kpi-card" style="--kc:#f59e0b">' +
          '<div class="kpi-ic" style="background:#fffbeb;color:#d97706">' + ui.icon('star') + '</div>' +
          '<div class="kpi-val">' + avgAll + '</div><div class="kpi-lbl">متوسط التقييم</div>' +
        '</div>' +
        '<div class="kpi-card" style="--kc:#c9933a">' +
          '<div class="kpi-ic" style="background:#fdf6e7;color:#c9933a">' + ui.icon('list') + '</div>' +
          '<div class="kpi-val">' + R.length + '</div><div class="kpi-lbl">إجمالي التقييمات</div>' +
        '</div>' +
        '<div class="kpi-card" style="--kc:#22c55e">' +
          '<div class="kpi-ic" style="background:#f0fdf4;color:#16a34a">' + ui.icon('users') + '</div>' +
          '<div class="kpi-val">' + rank.length + '</div><div class="kpi-lbl">موظف تم تقييمه</div>' +
        '</div>' +
      '</div>' +

      '<div class="g2">' +
        /* Leaderboard */
        '<div class="card">' +
          '<h3>🏆 ترتيب الموظفين</h3>' +
          '<div class="rank-list">' +
            (rank.length
              ? rank.map((x, i) =>
                  '<div class="rank-row">' +
                    '<span class="rank-medal">' + medal(i) + '</span>' +
                    '<div class="rank-info">' +
                      '<b>' + ui.esc(x.e.name) + '</b>' +
                      '<small>' + ui.esc(x.e.title || '') + ' • ' + x.n + ' تقييم</small>' +
                    '</div>' +
                    '<div class="rank-score">' +
                      '<b>' + x.a.toFixed(1) + '</b>' +
                      scoreBar(x.a) +
                    '</div>' +
                  '</div>'
                ).join('')
              : '<div class="em">لا توجد تقييمات بعد</div>') +
          '</div>' +
        '</div>' +

        /* Reviews table */
        '<div class="card">' +
          '<h3>آخر التقييمات</h3>' +
          (R.length
            ? '<div class="review-list">' +
                R.slice(0, 20).map(r =>
                  '<div class="review-row" data-id="' + r.id + '">' +
                    '<div class="review-head">' +
                      '<b>' + ui.esc(nm(r.empId)) + '</b>' +
                      '<span class="tag mu">' + r.period + '</span>' +
                    '</div>' +
                    '<div class="review-scores">' +
                      '<span title="جودة العمل">جودة: <b>' + r.q + '</b></span>' +
                      '<span title="التعاون">تعاون: <b>' + r.t + '</b></span>' +
                      '<span title="الالتزام">التزام: <b>' + r.p + '</b></span>' +
                      '<span title="المبادرة">مبادرة: <b>' + r.i + '</b></span>' +
                    '</div>' +
                    '<div class="review-foot">' +
                      ui.stars(r.avg) + ' <b>' + r.avg.toFixed(1) + ' / 5</b>' +
                      '<button class="btn danger sm" data-a="del">حذف</button>' +
                    '</div>' +
                  '</div>'
                ).join('') +
              '</div>'
            : '<div class="em">ابدأ بإضافة أول تقييم</div>') +
        '</div>' +
      '</div>';

    const sc = [5, 4, 3, 2, 1].map(n => [n, n + ' / 5']);
    root.onclick = async e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'compare') { HR.pages.performance.showCompare(E, R, ui); return; }
      if (b.dataset.a === 'del') {
        if (!confirm('حذف التقييم؟')) return;
        await store.remove('reviews', b.closest('[data-id]').dataset.id);
        HR.refresh(); return;
      }
      const o = await ui.form('تقييم جديد', [
        { n: 'empId',  l: 'الموظف',              opts: E.map(x => [x.id, x.name]) },
        { n: 'period', l: 'الفترة',              t: 'month', req: 1 },
        { n: 'q',      l: 'جودة العمل (1-5)',    opts: sc },
        { n: 't',      l: 'التعاون (1-5)',       opts: sc },
        { n: 'p',      l: 'الالتزام بالمواعيد', opts: sc },
        { n: 'i',      l: 'المبادرة (1-5)',      opts: sc },
        { n: 'note',   l: 'ملاحظات' }
      ], { period: ui.today().slice(0, 7), q: 4, t: 4, p: 4, i: 4 });
      if (!o) return;
      ['q', 't', 'p', 'i'].forEach(k => o[k] = +o[k]);
      o.avg = (o.q + o.t + o.p + o.i) / 4;
      await store.create('reviews', o);
      ui.toast('✅ تم حفظ التقييم');
      HR.refresh();
    };
  },

/* ── [M] مقارنة أداء موظف بين شهرين ── */
  async showCompare(E, R, ui) {
  const esc = ui.esc;
  const empOpts = E.map(e => [e.id, e.name]);
  const periods = [...new Set(R.map(r => r.period))].sort().reverse();

  const o = await ui.form('مقارنة الأداء', [
    { n: 'empId', l: 'الموظف',     opts: empOpts, req: 1 },
    { n: 'p1',    l: 'الفترة الأولى',  opts: periods.map(p => [p, p]), req: 1 },
    { n: 'p2',    l: 'الفترة الثانية', opts: periods.map(p => [p, p]), req: 1 }
  ]);
  if (!o || o.p1 === o.p2) { if (o) ui.toast('اختر فترتين مختلفتين'); return; }

  const r1 = R.find(r => r.empId === o.empId && r.period === o.p1);
  const r2 = R.find(r => r.empId === o.empId && r.period === o.p2);
  if (!r1 || !r2) { ui.toast('لا توجد تقييمات للفترتين المختارتين'); return; }

  const emp = E.find(e => e.id === o.empId);
  const axes = [['q','جودة العمل'],['t','التعاون'],['p','الالتزام'],['i','المبادرة'],['avg','المتوسط']];
  const diff = v => {
    if (v > 0) return '<span style="color:#16a34a">▲ +' + v.toFixed(1) + '</span>';
    if (v < 0) return '<span style="color:#ef4444">▼ ' + v.toFixed(1) + '</span>';
    return '<span style="color:var(--mu)">= ' + v.toFixed(1) + '</span>';
  };
  const bar = (v, mx) => '<div style="display:inline-block;width:60px;height:6px;background:var(--bo);border-radius:3px;vertical-align:middle;margin:0 4px"><div style="width:' + Math.round(v/mx*100) + '%;height:100%;background:#c9933a;border-radius:3px"></div></div>';

  ui.modal('مقارنة أداء — ' + esc(emp ? emp.name : ''),
    '<div style="overflow:auto">' +
    '<table style="width:100%;border-collapse:collapse;font-size:14px">' +
    '<thead><tr style="border-bottom:2px solid var(--bo)">' +
      '<th style="padding:10px;text-align:right">المحور</th>' +
      '<th style="padding:10px;text-align:center;color:#c9933a">' + o.p1 + '</th>' +
      '<th style="padding:10px;text-align:center;color:#7c3aed">' + o.p2 + '</th>' +
      '<th style="padding:10px;text-align:center">التغيير</th>' +
    '</tr></thead><tbody>' +
    axes.map(([k, l]) =>
      '<tr style="border-bottom:1px solid var(--bo)">' +
        '<td style="padding:10px;font-weight:600">' + l + '</td>' +
        '<td style="padding:10px;text-align:center">' + bar(r1[k], 5) + '<b>' + Number(r1[k]).toFixed(1) + '</b></td>' +
        '<td style="padding:10px;text-align:center">' + bar(r2[k], 5) + '<b>' + Number(r2[k]).toFixed(1) + '</b></td>' +
        '<td style="padding:10px;text-align:center">' + diff(r2[k] - r1[k]) + '</td>' +
      '</tr>'
    ).join('') +
    '</tbody></table></div>' +
    '<div class="acts" style="margin-top:16px"><button class="btn ghost" onclick="this.closest(\'.mo\').remove()">إغلاق</button></div>',
    true
  );
  },

};