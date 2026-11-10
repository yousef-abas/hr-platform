HR.pages.dashboard = {
  title: 'لوحة التحكم', icon: 'grid',
  async render(root) {
    const { store, ui } = HR, esc = ui.esc;
    const [E, A, L, C, D] = await Promise.all([
      store.list('employees'), store.list('attendance'),
      store.list('leaves'),    store.list('candidates'),
      store.list('documents')
    ]);

    const act  = E.filter(e => e.status !== 'terminated');
    const td   = ui.today();
    const dl   = d => Math.round((new Date(d) - new Date(td)) / 864e5);

    /* ── Stats ── */
    const present = A.filter(a => a.date === td && a.in).length;
    const pend    = L.filter(l => l.status === 'معلقة');
    const away    = L.filter(l => l.status === 'معتمدة' && l.from <= td && l.to >= td);
    const total   = act.reduce((s, e) => s + e.salary + (e.allow || 0), 0);
    const pct     = act.length ? Math.round(present / act.length * 100) : 0;
    const nm      = id => (E.find(e => e.id === id) || { name: 'محذوف' }).name;

    /* ── Alerts ── */
    const expContracts  = act.filter(e => e.contractEnd  && dl(e.contractEnd)  >= 0 && dl(e.contractEnd)  <= 60).sort((a,b) => a.contractEnd  > b.contractEnd  ? 1 : -1);
    const expProbation  = act.filter(e => e.probationEnd && dl(e.probationEnd) >= 0 && dl(e.probationEnd) <= 14).sort((a,b) => a.probationEnd > b.probationEnd ? 1 : -1);
    const expDocs       = D.filter(d => d.expiry && dl(d.expiry) >= 0 && dl(d.expiry) <= 30).sort((a,b) => a.expiry > b.expiry ? 1 : -1);
    const expiredDocs   = D.filter(d => d.expiry && dl(d.expiry) < 0);
    const totalAlerts   = expContracts.length + expProbation.length + expDocs.length + expiredDocs.length + pend.length;

    /* ── Greeting ── */
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'صباح الخير' : hour < 18 ? 'مساء الخير' : 'مساء النور';

    /* ── KPI cards ── */
    const stats = [
      { icon: 'users',    color: '#c9933a', bg: '#fdf6e7', value: act.length,     label: 'الموظفون النشطون',    sub: 'من إجمالي ' + E.length + ' في السجل',     bar: 100 },
      { icon: 'clock',    color: pct>=80?'#16a34a':'#d97706', bg: pct>=80?'#f0fdf4':'#fffbeb', value: pct+'%', label: 'نسبة الحضور اليوم', sub: present + ' من ' + act.length + ' موظف', bar: pct },
      { icon: 'calendar', color: pend.length?'#d97706':'#16a34a', bg: pend.length?'#fffbeb':'#f0fdf4', value: pend.length, label: 'طلبات معلقة', sub: away.length + ' في إجازة اليوم', bar: Math.min(100, pend.length * 20) },
      { icon: 'wallet',   color: '#7c3aed', bg: '#f5f3ff', value: ui.money(total), label: 'الرواتب الشهرية',   sub: C.length + ' مرشح في التوظيف',              bar: 100 },
    ];

    /* ── Quick actions ── */
    const qa = [
      { href:'#attendance',  icon:'clock',    label:'تسجيل حضور',    color:'#c9933a', bg:'#fdf6e7' },
      { href:'#leaves',      icon:'calendar', label:'طلب إجازة',     color:'#16a34a', bg:'#f0fdf4' },
      { href:'#employees',   icon:'users',    label:'الموظفون',       color:'#7c3aed', bg:'#f5f3ff' },
      { href:'#payroll',     icon:'wallet',   label:'الرواتب',        color:'#d97706', bg:'#fffbeb' },
      { href:'#recruitment', icon:'userplus', label:'مرشح جديد',     color:'#0891b2', bg:'#ecfeff' },
      { href:'#performance', icon:'star',     label:'تقييم أداء',    color:'#dc2626', bg:'#fef2f2' },
    ];

    root.innerHTML =
      /* Hero */
      '<div class="hero">' +
        '<div>' +
          '<h2>' + greeting + '، ' + esc(HR.user.name) + ' 👋</h2>' +
          '<p>' + new Date().toLocaleDateString('ar-EG', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) + '</p>' +
          '<div class="hero-meta">' +
            '<span>👥 ' + present + ' موظف حاضر</span>' +
            (pend.length  ? '<span>🔔 ' + pend.length  + ' طلب ينتظر الرد</span>'          : '<span>✅ لا توجد طلبات معلقة</span>') +
            (totalAlerts  ? '<span>⚠️ ' + totalAlerts + ' تنبيه يحتاج متابعة</span>'        : '<span>✅ لا توجد تنبيهات</span>') +
          '</div>' +
        '</div>' +
        '<div class="hb">' +
          (pend.length    ? '<a href="#leaves" class="btn light">📋 مراجعة الطلبات</a>'     : '') +
          (totalAlerts    ? '<a href="#alerts-sec" class="btn light">⚠️ عرض التنبيهات</a>'  : '') +
        '</div>' +
      '</div>' +

      /* KPI */
      '<div class="stats">' +
        stats.map((s,i) =>
          '<div class="card stat-card" style="--clr:' + s.color + ';--clr-bg:' + s.bg + ';animation-delay:' + (i*.07) + 's">' +
            '<div class="stat-icon">' + ui.icon(s.icon) + '</div>' +
            '<div class="stat-label">' + s.label + '</div>' +
            '<div class="stat-value">' + esc(String(s.value)) + '</div>' +
            '<div class="stat-sub">' + s.sub + '</div>' +
            '<div class="stat-bar"><i style="width:' + s.bar + '%;background:' + s.color + '"></i></div>' +
          '</div>'
        ).join('') +
      '</div>' +

      /* Quick actions */
      '<div class="sec">إجراءات سريعة</div>' +
      '<div class="qa">' +
        qa.map(q =>
          '<a class="qt" href="' + q.href + '">' +
            '<div class="qt-icon" style="background:' + q.bg + ';color:' + q.color + '">' + ui.icon(q.icon) + '</div>' +
            q.label +
          '</a>'
        ).join('') +
      '</div>' +

      /* ── Alerts Section ── */
      (totalAlerts ? '<div class="sec" id="alerts-sec">⚠️ تنبيهات تحتاج متابعة <span class="tag da">' + totalAlerts + '</span></div>' +
        '<div class="alerts-grid">' +

          /* طلبات معلقة */
          (pend.length ? '<div class="card alert-card">' +
            '<div class="alert-head wa">🔔 طلبات إجازة معلقة <span class="tag wa">' + pend.length + '</span></div>' +
            '<div class="rows">' +
              pend.map(l =>
                '<div data-id="' + l.id + '">' +
                  '<span>' + esc(nm(l.empId)) + '<br><small>' + l.type + ' · ' + l.days + ' يوم · ' + l.from + '</small></span>' +
                  '<span style="display:flex;gap:6px">' +
                    '<button class="btn sm" data-a="ok">اعتماد</button>' +
                    '<button class="btn danger sm" data-a="no">رفض</button>' +
                  '</span>' +
                '</div>'
              ).join('') +
            '</div>' +
          '</div>' : '') +

          /* عقود منتهية */
          (expContracts.length ? '<div class="card alert-card">' +
            '<div class="alert-head wa">📄 عقود تنتهي خلال 60 يوم <span class="tag wa">' + expContracts.length + '</span></div>' +
            '<div class="rows">' +
              expContracts.map(e =>
                '<div>' +
                  '<span><a href="#profile-' + e.id + '" style="color:var(--ac);font-weight:700">' + esc(e.name) + '</a>' +
                  '<br><small>' + esc(e.title||'') + (e.dept?' · '+esc(e.dept):'') + '</small></span>' +
                  '<span class="' + (dl(e.contractEnd)<=14?'c-da':'c-wa') + '" style="font-size:13px;font-weight:700;text-align:left">' +
                    e.contractEnd + '<br><small>بعد ' + dl(e.contractEnd) + ' يوم</small>' +
                  '</span>' +
                '</div>'
              ).join('') +
            '</div>' +
          '</div>' : '') +

          /* فترات تجربة */
          (expProbation.length ? '<div class="card alert-card">' +
            '<div class="alert-head wa">🧪 فترات تجربة تنتهي قريباً <span class="tag wa">' + expProbation.length + '</span></div>' +
            '<div class="rows">' +
              expProbation.map(e =>
                '<div>' +
                  '<span><a href="#profile-' + e.id + '" style="color:var(--ac);font-weight:700">' + esc(e.name) + '</a>' +
                  '<br><small>' + esc(e.title||'') + '</small></span>' +
                  '<span class="c-wa" style="font-size:13px;font-weight:700;text-align:left">' +
                    e.probationEnd + '<br><small>بعد ' + dl(e.probationEnd) + ' يوم</small>' +
                  '</span>' +
                '</div>'
              ).join('') +
            '</div>' +
          '</div>' : '') +

          /* وثائق منتهية أو قاربت */
          (expDocs.length || expiredDocs.length ? '<div class="card alert-card">' +
            '<div class="alert-head da">📎 وثائق منتهية أو تنتهي قريباً <span class="tag da">' + (expDocs.length + expiredDocs.length) + '</span></div>' +
            '<div class="rows">' +
              expiredDocs.map(d =>
                '<div>' +
                  '<span><a href="#profile-' + d.empId + '" style="color:var(--ac);font-weight:700">' + esc(nm(d.empId)) + '</a>' +
                  '<br><small>' + esc(d.type) + '</small></span>' +
                  '<span class="c-da" style="font-size:12px;font-weight:700">منتهية<br><small>' + d.expiry + '</small></span>' +
                '</div>'
              ).join('') +
              expDocs.map(d =>
                '<div>' +
                  '<span><a href="#profile-' + d.empId + '" style="color:var(--ac);font-weight:700">' + esc(nm(d.empId)) + '</a>' +
                  '<br><small>' + esc(d.type) + '</small></span>' +
                  '<span class="c-wa" style="font-size:12px;font-weight:700">بعد ' + dl(d.expiry) + ' يوم<br><small>' + d.expiry + '</small></span>' +
                '</div>'
              ).join('') +
            '</div>' +
          '</div>' : '') +

        '</div>'
      : '') +

      /* موظفون في إجازة اليوم */
      (away.length ? '<div class="sec">في إجازة اليوم</div>' +
        '<div class="card"><div class="rows">' +
          away.map(l =>
            '<div>' +
              '<span>' + esc(nm(l.empId)) + '</span>' +
              '<span>' + ui.tag(l.type, 'wa') + ' حتى ' + l.to + '</span>' +
            '</div>'
          ).join('') +
        '</div></div>'
      : '') +

      /* Charts */
      '<div class="sec">تحليلات</div>' +
      '<div class="g2">' +
        '<div class="card"><h3>الموظفون حسب القسم</h3><div class="cv"><canvas id="c1"></canvas></div></div>' +
        '<div class="card"><h3>الحضور في آخر 7 أيام</h3><div class="cv"><canvas id="c2"></canvas></div></div>' +
      '</div>';

    /* ── Events ── */
    root.onclick = async e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const lid = b.closest('[data-id]').dataset.id;
      if (b.dataset.a === 'no') {
        const reason = await ui.prompt('سبب الرفض (مطلوب):');
        if (!reason || !reason.trim()) return ui.toast('الرفض يستلزم سبباً مكتوباً');
        await store.update('leaves', lid, { status:'مرفوضة', rejectReason:reason.trim(), decidedBy:HR.user.name, decidedAt:new Date().toISOString() });
        ui.toast('تم الرفض');
      } else {
        await store.update('leaves', lid, { status:'معتمدة', decidedBy:HR.user.name, decidedAt:new Date().toISOString() });
        ui.toast('تم الاعتماد ✅');
      }
      HR.refresh();
    };

    /* ── Charts ── */
    if (!window.Chart) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? '#1e2d3d' : '#f1f5f9';
    const textColor = isDark ? '#94a3b8' : '#5a6a7e';
    Chart.defaults.font.family = 'Cairo';
    Chart.defaults.color = textColor;

    const depts = {};
    act.forEach(e => depts[e.dept||'غير محدد'] = (depts[e.dept||'غير محدد']||0)+1);
    const palette = ['#c9933a','#7c3aed','#0891b2','#16a34a','#d97706','#dc2626','#64748b'];
    new Chart(root.querySelector('#c1'), {
      type: 'doughnut',
      data: { labels: Object.keys(depts), datasets:[{ data:Object.values(depts), backgroundColor:palette, borderWidth:2, borderColor:isDark?'#111827':'#fff' }] },
      options: { maintainAspectRatio:false, cutout:'68%', plugins:{ legend:{ position:'right', labels:{ padding:12, font:{ size:12, weight:'700' } } } } }
    });

    const lab=[], val=[];
    for (let i=6; i>=0; i--) {
      const x = new Date(); x.setDate(x.getDate()-i);
      const s = ui.iso(x); lab.push(s.slice(5)); val.push(A.filter(a=>a.date===s&&a.in).length);
    }
    new Chart(root.querySelector('#c2'), {
      type: 'bar',
      data: { labels:lab, datasets:[{ data:val, backgroundColor: ctx => {
        const g = ctx.chart.ctx.createLinearGradient(0,0,0,220);
        g.addColorStop(0,'#c9933a'); g.addColorStop(1,'#c9933a30'); return g;
      }, borderRadius:10, maxBarThickness:40 }] },
      options: { maintainAspectRatio:false, scales:{
        y:{ beginAtZero:true, ticks:{precision:0,color:textColor}, grid:{color:gridColor}, border:{display:false} },
        x:{ grid:{display:false}, ticks:{color:textColor} }
      }, plugins:{legend:{display:false}} }
    });
  }
};
