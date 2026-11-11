HR.pages.attendance = {
  title: 'الحضور', icon: 'clock',
  async render(root) {
    const { store, ui, state: st } = HR, esc = ui.esc;
    st.date = st.date || ui.today();
    const E = (await store.list('employees')).filter(e => e.status !== 'terminated');
    const month = st.date.slice(0, 7);

    let A;
    if (store.query) {
      const lastDay = new Date(+month.slice(0,4), +month.slice(5,7), 0).getDate();
      A = await store.query('attendance', q => q.gte('date', month + '-01').lte('date', month + '-' + String(lastDay).padStart(2,'0')));
    } else {
      A = (await store.list('attendance')).filter(a => a.date.startsWith(month));
    }

    /* [L] فلتر متقدم */
    st.attFilter = st.attFilter || 'all'; // all | late | absent | present
    st.attDept   = st.attDept   || '';

    const depts = [...new Set(E.map(e => e.dept).filter(Boolean))].sort();
    const EF = E.filter(e =>
      (!st.attDept || e.dept === st.attDept)
    );

    const rec    = id => A.find(a => a.empId === id && a.date === st.date) || {};
    const todayA = E.map(e => rec(e.id));
    const nPresent = todayA.filter(r => r.in).length;
    const nLate    = todayA.filter(r => r.in && r.in > '09:30').length;
    const nAbsent  = todayA.filter(r => !r.in).length;
    const mins = t => { const a = String(t || '').split(':'); return +a[0] * 60 + +a[1]; };
    const dur  = (i, o) => { if (!i || !o) return '—'; const m = mins(o) - mins(i); return Math.floor(m/60) + 'س ' + (m%60) + 'د'; };

    root.innerHTML =
      ui.head('الحضور والانصراف', 'سجل اليوم وملخص الشهر',
        '<input type="date" id="dt" value="' + st.date + '">' +
        '<select id="att-dept"><option value="">كل الأقسام</option>' +
          depts.map(d => '<option value="' + ui.esc(d) + '"' + (d === st.attDept ? ' selected' : '') + '>' + ui.esc(d) + '</option>').join('') +
        '</select>' +
        '<select id="att-filter">' +
          '<option value="all"'     + (st.attFilter==='all'     ? ' selected':'')+'>الكل</option>' +
          '<option value="present"' + (st.attFilter==='present' ? ' selected':'')+'>الحاضرون</option>' +
          '<option value="late"'    + (st.attFilter==='late'    ? ' selected':'')+'>المتأخرون</option>' +
          '<option value="absent"'  + (st.attFilter==='absent'  ? ' selected':'')+'>الغائبون</option>' +
        '</select>' +
        '<button class="btn ghost" data-a="abs-report">📊 تقرير الغياب</button>' +
        '<button class="btn ghost" data-a="geo">📍 مواقع العمل</button>'
      ) +

      /* KPI */
      '<div class="kpi-row">' +
        '<div class="kpi-card" style="--kc:#22c55e">' +
          '<div class="kpi-ic" style="background:#f0fdf4;color:#16a34a">' + ui.icon('check') + '</div>' +
          '<div class="kpi-val">' + nPresent + '</div><div class="kpi-lbl">حاضر</div>' +
        '</div>' +
        '<div class="kpi-card" style="--kc:#f59e0b">' +
          '<div class="kpi-ic" style="background:#fffbeb;color:#d97706">' + ui.icon('clock') + '</div>' +
          '<div class="kpi-val">' + nLate + '</div><div class="kpi-lbl">متأخر</div>' +
        '</div>' +
        '<div class="kpi-card" style="--kc:#dc2626">' +
          '<div class="kpi-ic" style="background:#fef2f2;color:#dc2626">' + ui.icon('x') + '</div>' +
          '<div class="kpi-val">' + nAbsent + '</div><div class="kpi-lbl">غائب</div>' +
        '</div>' +
        '<div class="kpi-card" style="--kc:#c9933a">' +
          '<div class="kpi-ic" style="background:#fdf6e7;color:#c9933a">' + ui.icon('users') + '</div>' +
          '<div class="kpi-val">' + E.length + '</div><div class="kpi-lbl">إجمالي الموظفين</div>' +
        '</div>' +
      '</div>' +

      /* Daily table */
      '<div class="card">' +
        '<h3>سجل يوم ' + st.date + '</h3>' +
        '<div class="tw"><table>' +
          '<tr><th>الموظف</th><th>الحضور</th><th>الانصراف</th><th>المدة</th><th>الحالة</th><th></th></tr>' +
          EF.filter(e => {
            const r = rec(e.id);
            if (st.attFilter === 'present') return !!r.in;
            if (st.attFilter === 'absent')  return !r.in;
            if (st.attFilter === 'late')    return r.in && r.in > '09:30';
            return true;
          }).map(e => {
            const r = rec(e.id);
            const s = !r.in
              ? ui.tag('لم يسجل', 'da')
              : r.in > '09:30' ? ui.tag('متأخر', 'wa') : ui.tag('في الموعد', 'ok');
            const btn = !r.in ? 'تسجيل حضور' : !r.out ? 'تسجيل انصراف' : '';
            const appBadge = r.source === 'app'
              ? '<small style="color:var(--mu)">📱 من التطبيق' +
                  (r.inSite ? ' • ' + esc(r.inSite) : '') +
                  (r.inDist != null && r.inDist !== '' ? ' • ' + Math.round(r.inDist) + 'م' : '') +
                '</small>'
              : '';
            return '<tr data-id="' + e.id + '">' +
              '<td>' + ui.who(e) + appBadge + '</td>' +
              '<td><input type="time" data-f="in"  value="' + (r.in  || '') + '"' + (r.source === 'app' ? ' title="مسجل من التطبيق"' : '') + '></td>' +
              '<td><input type="time" data-f="out" value="' + (r.out || '') + '"></td>' +
              '<td><span class="dur-badge">' + dur(r.in, r.out) + '</span></td>' +
              '<td>' + s + '</td>' +
              '<td>' + (btn ? '<button class="btn sm" data-a="now">' + btn + '</button>' : '') + '</td>' +
            '</tr>';
          }).join('') +
        '</table></div>' +
      '</div>' +

      /* Monthly summary */
      '<div class="card">' +
        '<h3>ملخص شهر ' + month + '</h3>' +
        '<div class="tw"><table>' +
          '<tr><th>الموظف</th><th>أيام الحضور</th><th>مرات التأخير</th><th>متوسط المدة</th></tr>' +
          EF.map(e => {
            const m = A.filter(a => a.empId === e.id && a.in);
            const late = m.filter(a => a.in > '09:30').length;
            const avgMins = m.filter(a => a.out).length
              ? m.filter(a => a.out).reduce((s, a) => s + (mins(a.out) - mins(a.in)), 0) / m.filter(a => a.out).length
              : null;
            const avgDur = avgMins ? Math.floor(avgMins/60) + 'س ' + Math.round(avgMins%60) + 'د' : '—';
            return '<tr>' +
              '<td>' + esc(e.name) + '</td>' +
              '<td><b>' + m.length + '</b></td>' +
              '<td>' + (late ? '<span style="color:var(--wa)">' + late + '</span>' : '0') + '</td>' +
              '<td>' + avgDur + '</td>' +
            '</tr>';
          }).join('') +
        '</table></div>' +
      '</div>';

    /* ── Actions ── */
    const put = async (empId, f, v) => {
      const r = A.find(a => a.empId === empId && a.date === st.date);
      if (r) await store.update('attendance', r.id, { [f]: v });
      else await store.create('attendance', { empId, date: st.date, in: '', out: '', [f]: v });
      HR.refresh();
    };


  /* ── [D] تقرير الغياب المتكرر ── */
  async function showAbsenceReport(root, E, A_all) {
    const { ui } = HR, esc = ui.esc;
    const today = ui.today();
    const thisMonth = today.slice(0, 7);

    /* احسب أيام الغياب لكل موظف في الشهر الحالي */
    const workdays = [];
    const y = +thisMonth.slice(0,4), m = +thisMonth.slice(5,7);
    const daysInMonth = new Date(y, m, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = thisMonth + '-' + String(d).padStart(2,'0');
      if (dt > today) break;
      const dow = new Date(dt).getDay(); /* 5=Fri, 6=Sat */
      if (dow !== 5 && dow !== 6) workdays.push(dt);
    }

    const monthA = A_all.filter(a => a.date && a.date.startsWith(thisMonth));

    const rows = E.map(e => {
      const present = workdays.filter(d => monthA.some(a => a.empId === e.id && a.in && a.date === d)).length;
      const absent  = workdays.length - present;
      const lateArr = monthA.filter(a => a.empId === e.id && a.in && a.in > '09:30');
      return { e, present, absent, late: lateArr.length, pct: workdays.length ? Math.round(present / workdays.length * 100) : 100 };
    }).sort((a, b) => b.absent - a.absent);

    const color = p => p >= 90 ? '#16a34a' : p >= 75 ? '#d97706' : '#dc2626';

    const m2 = ui.modal('تقرير الغياب — ' + thisMonth,
      '<div style="overflow:auto;max-height:65vh">' +
      '<table class="tbl" style="width:100%;border-collapse:collapse">' +
      '<thead><tr>' +
        '<th>الموظف</th><th>القسم</th>' +
        '<th>أيام حضور</th><th>أيام غياب</th><th>تأخير</th><th>نسبة الحضور</th>' +
      '</tr></thead><tbody>' +
      rows.map(r =>
        '<tr style="border-bottom:1px solid var(--bo)">' +
          '<td style="padding:8px 12px"><b>' + esc(r.e.name) + '</b></td>' +
          '<td style="padding:8px 12px;color:var(--mu)">' + esc(r.e.dept || '—') + '</td>' +
          '<td style="padding:8px 12px;text-align:center">' + r.present + '</td>' +
          '<td style="padding:8px 12px;text-align:center;font-weight:' + (r.absent > 3 ? '700' : '400') + ';color:' + (r.absent > 3 ? '#dc2626' : 'inherit') + '">' + r.absent + '</td>' +
          '<td style="padding:8px 12px;text-align:center;color:' + (r.late > 2 ? '#d97706' : 'inherit') + '">' + r.late + '</td>' +
          '<td style="padding:8px 12px">' +
            '<div style="display:flex;align-items:center;gap:8px">' +
              '<div style="flex:1;height:6px;background:var(--bo);border-radius:3px"><div style="width:' + r.pct + '%;height:6px;background:' + color(r.pct) + ';border-radius:3px"></div></div>' +
              '<span style="color:' + color(r.pct) + ';font-weight:700;font-size:13px;min-width:36px">' + r.pct + '%</span>' +
            '</div>' +
          '</td>' +
        '</tr>'
      ).join('') +
      '</tbody></table>' +
      (rows.filter(r => r.absent > 3).length
        ? '<div class="al da" style="margin-top:12px">⚠️ ' + rows.filter(r => r.absent > 3).length + ' موظف تجاوز 3 أيام غياب هذا الشهر</div>'
        : '<div class="al ok" style="margin-top:12px">✅ لا يوجد موظفون تجاوزوا حد الغياب هذا الشهر</div>') +
      '</div>' +
      '<div class="acts" style="margin-top:16px"><button class="btn" id="exp-abs">تصدير CSV</button><button class="btn ghost" id="cl-abs">إغلاق</button></div>',
      true
    );

    m2.el.querySelector('#cl-abs').onclick = m2.close;
    m2.el.querySelector('#exp-abs').onclick = () => {
      ui.csv('absence-report-' + thisMonth + '.csv',
        [['الموظف','القسم','حضور','غياب','تأخير','نسبة الحضور%']].concat(
          rows.map(r => [r.e.name, r.e.dept||'', r.present, r.absent, r.late, r.pct+'%'])
        )
      );
    };
  }
    root.querySelector('#dt').onchange = e => { st.date = e.target.value || ui.today(); HR.refresh(); };
    const deptSel = root.querySelector('#att-dept'); if (deptSel) deptSel.onchange = e => { st.attDept = e.target.value; HR.refresh(); };
    const fltSel  = root.querySelector('#att-filter'); if (fltSel) fltSel.onchange  = e => { st.attFilter = e.target.value; HR.refresh(); };
    root.onchange = e => { const t = e.target; if (t.dataset.f) put(t.closest('tr').dataset.id, t.dataset.f, t.value); };
    root.onclick = e => {
      const bAbs = e.target.closest('[data-a="abs-report"]');
      if (bAbs) { showAbsenceReport(root, E, A); return; }
      const b = e.target.closest('[data-a="now"]'); if (!b) return;
      const id = b.closest('tr').dataset.id, r = rec(id), n = new Date().toTimeString().slice(0, 5);
      put(id, r.in ? 'out' : 'in', n);
    };

    /* Geo modal — unchanged logic, improved styling */
    root.querySelector('[data-a="geo"]').onclick = async () => {
      const rows = await store.list('settings'), cur = (rows.find(x => x.key === 'geofence') || {}).value || {};
      const G = Object.assign({ enabled: false, maxAccuracy: 100, sites: [] }, cur);
      const isAdmin = HR.user.role === 'admin', d = isAdmin ? '' : ' disabled';
      const m = ui.modal('مواقع العمل وتقييد الحضور', '<div id="gf"></div>', true);
      const box = m.el.querySelector('#gf');
      const draw = () => {
        box.innerHTML =
          '<div class="al wa" style="margin-bottom:12px">لما التقييد يتفعّل، الموظف ما يقدرش يسجل حضور أو انصراف من التطبيق إلا لو موبايله جوه نطاق أحد المواقع. الفحص بيتم على السيرفر.</div>' +
          '<div class="fg">' +
            '<label class="ck"><input type="checkbox" id="ge"' + (G.enabled ? ' checked' : '') + d + '> تفعيل التقييد بالموقع</label>' +
            '<label>أقصى خطأ مسموح في دقة الموقع (متر)<input type="number" id="ga" value="' + G.maxAccuracy + '"' + d + '></label>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;margin:14px 0 8px">' +
            '<h4 style="margin:0">المواقع</h4>' +
            (isAdmin ? '<button class="btn ghost sm" id="gadd">+ موقع</button><button class="btn ghost sm" id="gme">📍 موقعي الحالي</button>' : '') +
          '</div>' +
          (G.sites.length
            ? G.sites.map((x, i) =>
                '<div class="geo-site" data-i="' + i + '">' +
                  '<label>الاسم<input data-k="name" value="' + esc(x.name) + '"' + d + '></label>' +
                  '<label>خط العرض<input type="number" step="any" data-k="lat" value="' + x.lat + '"' + d + '></label>' +
                  '<label>خط الطول<input type="number" step="any" data-k="lng" value="' + x.lng + '"' + d + '></label>' +
                  '<label>النطاق (متر)<input type="number" data-k="radius" value="' + x.radius + '"' + d + '></label>' +
                  (isAdmin ? '<button class="btn danger sm" data-del="' + i + '">حذف</button>' : '') +
                '</div>'
              ).join('')
            : '<div class="em">لا توجد مواقع بعد</div>') +
          '<p class="mu">الموظفون اللي شغلهم من برة (مندوبين مثلًا) تحدد لهم "يسجل الحضور من أي مكان" في ملفهم.</p>' +
          '<div class="acts">' +
            (isAdmin ? '<button class="btn" id="gsv">حفظ</button>' : '') +
            '<button class="btn ghost" id="gcl">إغلاق</button>' +
          '</div>';

        box.querySelector('#gcl').onclick = m.close;
        if (!isAdmin) return;

        const sync = () => {
          G.enabled = box.querySelector('#ge').checked;
          G.maxAccuracy = Number(box.querySelector('#ga').value) || 100;
          box.querySelectorAll('.geo-site').forEach(r => {
            const i = +r.dataset.i;
            r.querySelectorAll('input').forEach(inp => {
              G.sites[i][inp.dataset.k] = inp.dataset.k === 'name' ? inp.value : Number(inp.value);
            });
          });
        };
        box.querySelector('#gadd').onclick = () => { sync(); G.sites.push({ name: 'المقر', lat: 30.0444, lng: 31.2357, radius: 100 }); draw(); };
        box.querySelector('#gme').onclick = () => {
          if (!navigator.geolocation) return ui.toast('المتصفح لا يدعم تحديد الموقع');
          navigator.geolocation.getCurrentPosition(p => {
            sync();
            G.sites.push({ name: 'موقعي', lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6, radius: 100 });
            draw();
          }, () => ui.toast('ما قدرتش أحدد موقعك. اسمح بالموقع للمتصفح أو اكتب الإحداثيات يدويًا'), { enableHighAccuracy: true, timeout: 15000 });
        };
        box.querySelectorAll('[data-del]').forEach(b => { b.onclick = () => { sync(); G.sites.splice(+b.dataset.del, 1); draw(); }; });
        box.querySelector('#gsv').onclick = async () => {
          sync();
          if (G.enabled && !G.sites.length) return ui.toast('أضف موقع واحد على الأقل قبل التفعيل');
          if (G.sites.some(x => !x.name || isNaN(x.lat) || isNaN(x.lng) || !(x.radius > 0))) return ui.toast('راجع بيانات المواقع (الاسم والإحداثيات والنطاق)');
          const ex = rows.find(x => x.key === 'geofence');
          if (ex) await store.update('settings', ex.id, { value: G });
          else await store.create('settings', { key: 'geofence', value: G });
          ui.toast('✅ تم حفظ مواقع العمل'); m.close();
        };
      };
      draw();
    };
  }
};


