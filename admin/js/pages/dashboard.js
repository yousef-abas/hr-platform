HR.pages.dashboard = {
  title: 'لوحة التحكم', icon: 'grid',
  async render(root) {
    const { store, ui } = HR, esc = ui.esc;
    const [E, A, L, C] = await Promise.all(['employees','attendance','leaves','candidates'].map(t => store.list(t)));
    const act = E.filter(e => e.status !== 'terminated'), td = ui.today();
    const present  = A.filter(a => a.date === td && a.in).length;
    const pend     = L.filter(l => l.status === 'معلقة');
    const away     = L.filter(l => l.status === 'معتمدة' && l.from <= td && l.to >= td);
    const total    = act.reduce((s, e) => s + e.salary + (e.allow || 0), 0);
    const nm = id => (E.find(e => e.id === id) || { name: 'محذوف' }).name;
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'صباح الخير' : hour < 18 ? 'مساء الخير' : 'مساء النور';
    const pct = act.length ? Math.round(present / act.length * 100) : 0;
    const dl = d => Math.round((new Date(d) - new Date(td)) / 864e5);

    // عقود + تجربة منتهية قريباً
    const expiringContracts  = act.filter(e => e.contractEnd  && dl(e.contractEnd)  >= 0 && dl(e.contractEnd)  <= 60).sort((a,b) => a.contractEnd  > b.contractEnd  ? 1 : -1);
    const expiringProbation  = act.filter(e => e.probationEnd && dl(e.probationEnd) >= 0 && dl(e.probationEnd) <= 14).sort((a,b) => a.probationEnd > b.probationEnd ? 1 : -1);

    // KPI config — بالشكل الجديد
    const stats = [
      { icon: 'users',    color: '#2563eb', bg: '#eff6ff',  value: act.length,          label: 'الموظفون النشطون',    sub: 'من إجمالي ' + E.length + ' في السجل',         bar: 100 },
      { icon: 'clock',    color: pct>=80?'#16a34a':'#d97706', bg: pct>=80?'#f0fdf4':'#fffbeb', value: pct+'%', label: 'نسبة الحضور اليوم', sub: present + ' من ' + act.length + ' موظف', bar: pct },
      { icon: 'calendar', color: pend.length?'#d97706':'#16a34a', bg: pend.length?'#fffbeb':'#f0fdf4', value: pend.length, label: 'طلبات معلقة', sub: away.length + ' في إجازة اليوم', bar: Math.min(100, pend.length * 20) },
      { icon: 'wallet',   color: '#7c3aed', bg: '#f5f3ff',  value: ui.money(total),     label: 'الرواتب الشهرية',      sub: C.length + ' مرشح في التوظيف',                 bar: 100 },
    ];

    // إجراءات سريعة
    const qa = [
      { href:'#attendance', icon:'clock',    label:'تسجيل حضور',   color:'#2563eb', bg:'#eff6ff' },
      { href:'#leaves',     icon:'calendar', label:'طلب إجازة',    color:'#16a34a', bg:'#f0fdf4' },
      { href:'#employees',  icon:'users',    label:'الموظفون',      color:'#7c3aed', bg:'#f5f3ff' },
      { href:'#payroll',    icon:'wallet',   label:'قسايم الرواتب', color:'#d97706', bg:'#fffbeb' },
      { href:'#recruitment',icon:'userplus', label:'مرشح جديد',    color:'#0891b2', bg:'#ecfeff' },
      { href:'#performance',icon:'star',     label:'تقييم أداء',   color:'#dc2626', bg:'#fef2f2' },
    ];

    root.innerHTML =
      /* ── Hero ── */
      '<div class="hero">' +
        '<div>' +
          '<h2>' + greeting + '، ' + esc(HR.user.name) + ' 👋</h2>' +
          '<p>' + new Date().toLocaleDateString('ar-EG',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) + '</p>' +
          '<div class="hero-meta">' +
            '<span>🟢 ' + present + ' موظف حاضر</span>' +
            (pend.length ? '<span>🔔 ' + pend.length + ' طلب ينتظر قرارك</span>' : '<span>✅ لا توجد مهام معلقة</span>') +
            (expiringContracts.length ? '<span>⚠️ ' + expiringContracts.length + ' عقد ينتهي قريباً</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="hb">' +
          (pend.length ? '<a href="#leaves" class="btn light">📋 مراجعة الطلبات</a>' : '') +
        '</div>' +
      '</div>' +

      /* ── KPI Stats ── */
      '<div class="stats">' +
        stats.map((s,i) => '<div class="card stat-card" style="--clr:' + s.color + ';--clr-bg:' + s.bg + ';animation-delay:' + (i*.07) + 's">' +
          '<div class="stat-icon">' + ui.icon(s.icon) + '</div>' +
          '<div class="stat-label">' + s.label + '</div>' +
          '<div class="stat-value">' + esc(String(s.value)) + '</div>' +
          '<div class="stat-sub">' + s.sub + '</div>' +
          '<div class="stat-bar"><i style="width:' + s.bar + '%;background:' + s.color + '"></i></div>' +
        '</div>').join('') +
      '</div>' +

      /* ── إجراءات سريعة ── */
      '<div class="sec">إجراءات سريعة</div>' +
      '<div class="qa">' +
        qa.map(q => '<a class="qt" href="' + q.href + '">' +
          '<div class="qt-icon" style="background:' + q.bg + ';color:' + q.color + '">' + ui.icon(q.icon) + '</div>' +
          q.label +
        '</a>').join('') +
      '</div>' +

      /* ── مهام اليوم ── */
      '<div class="sec">مهام اليوم</div>' +
      '<div class="g2">' +
        '<div class="card"><h3>طلبات تحتاج قرارك ' + (pend.length ? '<span class="tag da">' + pend.length + '</span>' : '<span class="tag ok">✓</span>') + '</h3>' +
          '<div class="rows">' +
            (pend.length
              ? pend.map(l => '<div data-id="' + l.id + '">' +
                  '<span>' + esc(nm(l.empId)) + '<br><small>' + l.type + ' • ' + l.days + ' يوم • ' + l.from + '</small></span>' +
                  '<span style="display:flex;gap:6px"><button class="btn sm" data-a="ok">اعتماد</button><button class="btn danger sm" data-a="no">رفض</button></span>' +
                '</div>').join('')
              : '<div class="em">🎉 لا توجد طلبات معلقة</div>') +
          '</div>' +
        '</div>' +

        '<div class="card"><h3>في إجازة اليوم ' + (away.length ? '<span class="tag wa">' + away.length + '</span>' : '') + '</h3>' +
          '<div class="rows">' +
            (away.length
              ? away.map(l => '<div>' +
                  '<span>' + esc(nm(l.empId)) + '</span>' +
                  '<span>' + ui.tag(l.type, 'wa') + ' حتى ' + l.to + '</span>' +
                '</div>').join('')
              : '<div class="em">الكل موجود اليوم 💪</div>') +
          '</div>' +
        '</div>' +
      '</div>' +

      /* ── تنبيهات العقود ── */
      (expiringContracts.length || expiringProbation.length
        ? '<div class="sec">تنبيهات العقود</div><div class="g2">' +
          (expiringContracts.length
            ? '<div class="card"><h3>عقود تنتهي خلال 60 يوم ' + ui.tag(expiringContracts.length,'wa') + '</h3><div class="rows">' +
                expiringContracts.map(e =>
                  '<div><span><a href="#profile-' + e.id + '" style="color:var(--ac);font-weight:700">' + esc(e.name) + '</a>' +
                  '<br><small>' + esc(e.title||'') + (e.dept?' • '+esc(e.dept):'') + '</small></span>' +
                  '<span class="' + (dl(e.contractEnd)<=14?'c-da':'c-wa') + '" style="font-size:13px;font-weight:700;text-align:left">' +
                  e.contractEnd + '<br><small>بعد ' + dl(e.contractEnd) + ' يوم</small></span></div>'
                ).join('') +
              '</div></div>' : '') +
          (expiringProbation.length
            ? '<div class="card"><h3>فترات التجربة تنتهي قريباً ' + ui.tag(expiringProbation.length,'wa') + '</h3><div class="rows">' +
                expiringProbation.map(e =>
                  '<div><span><a href="#profile-' + e.id + '" style="color:var(--ac);font-weight:700">' + esc(e.name) + '</a>' +
                  '<br><small>' + esc(e.title||'') + '</small></span>' +
                  '<span class="c-wa" style="font-size:13px;font-weight:700;text-align:left">' +
                  e.probationEnd + '<br><small>بعد ' + dl(e.probationEnd) + ' يوم</small></span></div>'
                ).join('') +
              '</div></div>' : '') +
        '</div>' : '') +

      /* ── تحليلات ── */
      '<div class="sec">تحليلات</div>' +
      '<div class="g2">' +
        '<div class="card"><h3>الموظفون حسب القسم</h3><div class="cv"><canvas id="c1"></canvas></div></div>' +
        '<div class="card"><h3>الحضور في آخر 7 أيام</h3><div class="cv"><canvas id="c2"></canvas></div></div>' +
      '</div>';

    /* ── أحداث ── */
    root.onclick = async e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const lid = b.closest('[data-id]').dataset.id;
      if (b.dataset.a === 'no') {
        const reason = prompt('سبب الرفض (مطلوب):');
        if (!reason || !reason.trim()) return ui.toast('الرفض يتطلب سبباً مكتوباً');
        await store.update('leaves', lid, { status:'مرفوضة', rejectReason:reason.trim(), decidedBy:HR.user.name, decidedAt:new Date().toISOString() });
        ui.toast('تم الرفض');
      } else {
        await store.update('leaves', lid, { status:'معتمدة', decidedBy:HR.user.name, decidedAt:new Date().toISOString() });
        ui.toast('تم الاعتماد ✓');
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

    // دونات — الأقسام
    const depts = {}; act.forEach(e => depts[e.dept||'غير محدد'] = (depts[e.dept||'غير محدد']||0)+1);
    const palette = ['#2563eb','#7c3aed','#0891b2','#16a34a','#d97706','#dc2626','#64748b'];
    new Chart(root.querySelector('#c1'), {
      type: 'doughnut',
      data: { labels: Object.keys(depts), datasets: [{ data: Object.values(depts), backgroundColor: palette, borderWidth: 2, borderColor: isDark?'#111827':'#fff' }] },
      options: { maintainAspectRatio:false, cutout:'68%', plugins:{ legend:{ position:'right', labels:{ padding:12, font:{ size:12, weight:'700' } } } } }
    });

    // بار — حضور 7 أيام
    const lab=[], val=[];
    for (let i=6; i>=0; i--) {
      const x = new Date(); x.setDate(x.getDate()-i);
      const s = ui.iso(x); lab.push(s.slice(5)); val.push(A.filter(a=>a.date===s&&a.in).length);
    }
    new Chart(root.querySelector('#c2'), {
      type: 'bar',
      data: { labels: lab, datasets:[{ data:val, backgroundColor: ctx => {
        const g = ctx.chart.ctx.createLinearGradient(0,0,0,220);
        g.addColorStop(0,'#2563eb'); g.addColorStop(1,'#2563eb40'); return g;
      }, borderRadius:10, maxBarThickness:40 }] },
      options: { maintainAspectRatio:false, scales:{
        y:{ beginAtZero:true, ticks:{precision:0,color:textColor}, grid:{color:gridColor}, border:{display:false} },
        x:{ grid:{display:false}, ticks:{color:textColor} }
      }, plugins:{legend:{display:false}} }
    });
  }
};
