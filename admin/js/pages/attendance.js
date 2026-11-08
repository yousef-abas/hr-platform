HR.pages.attendance = {
  title: 'الحضور', icon: 'clock',
  async render(root) {
    const { store, ui, state: st } = HR, esc = ui.esc;
    st.date = st.date || ui.today();
    const E = (await store.list('employees')).filter(e => e.status !== 'terminated');
    const A = await store.list('attendance');
    const rec = id => A.find(a => a.empId === id && a.date === st.date) || {};
    const month = st.date.slice(0, 7);
    root.innerHTML = ui.head('الحضور والانصراف', 'سجل اليوم وملخص الشهر', '<input type="date" id="dt" value="' + st.date + '"><button class="btn ghost" data-a="geo">مواقع العمل</button>') +
      '<div class="card tw"><h3>سجل يوم ' + st.date + '</h3><table><tr><th>الموظف</th><th>الحضور</th><th>الانصراف</th><th>الحالة</th><th></th></tr>' +
      E.map(e => {
        const r = rec(e.id);
        const s = !r.in ? ui.tag('لم يسجل', 'da') : r.in > '09:30' ? ui.tag('متأخر', 'wa') : ui.tag('في الموعد', 'ok');
        const btn = !r.in ? 'تسجيل حضور' : !r.out ? 'تسجيل انصراف' : '';
        return '<tr data-id="' + e.id + '"><td>' + ui.who(e) + (r.source === 'app' ? '<small style="color:var(--mu)">من التطبيق' + (r.inSite ? ' • ' + esc(r.inSite) : '') + (r.inDist !== '' && r.inDist != null ? ' • ' + Math.round(r.inDist) + ' م' : '') + '</small>' : '') + '</td><td><input type="time" data-f="in" value="' + (r.in || '') + '"></td><td><input type="time" data-f="out" value="' + (r.out || '') + '"></td><td>' + s + '</td><td>' + (btn ? '<button class="btn sm" data-a="now">' + btn + '</button>' : '') + '</td></tr>';
      }).join('') + '</table></div>' +
      '<div class="card tw"><h3>ملخص شهر ' + month + '</h3><table><tr><th>الموظف</th><th>أيام الحضور</th><th>مرات التأخير</th></tr>' +
      E.map(e => { const m = A.filter(a => a.empId === e.id && a.date.startsWith(month) && a.in); return '<tr><td>' + ui.esc(e.name) + '</td><td>' + m.length + '</td><td>' + m.filter(a => a.in > '09:30').length + '</td></tr>'; }).join('') + '</table></div>';
    const put = async (empId, f, v) => {
      const r = A.find(a => a.empId === empId && a.date === st.date);
      if (r) await store.update('attendance', r.id, { [f]: v }); else await store.create('attendance', { empId, date: st.date, in: '', out: '', [f]: v });
      HR.refresh();
    };
    root.querySelector('[data-a="geo"]').onclick = async () => {
      const rows = await store.list('settings'), cur = (rows.find(x => x.key === 'geofence') || {}).value || {};
      const G = Object.assign({ enabled: false, maxAccuracy: 100, sites: [] }, cur), isAdmin = HR.user.role === 'admin', d = isAdmin ? '' : ' disabled';
      const m = ui.modal('مواقع العمل وتقييد الحضور', '<div id="gf"></div>', true), box = m.el.querySelector('#gf');
      const draw = () => {
        box.innerHTML = '<p style="color:var(--mu);margin-top:0">لما التقييد يتفعل، الموظف مايقدرش يسجّل حضور أو انصراف من التطبيق إلا لو موبايله جوه نطاق أحد المواقع. الفحص بيتم على السيرفر. الموقع من الموبايل رادع مش دليل قاطع، لأن تطبيقات تزييف الموقع موجودة.</p>' +
          '<div class="fg"><label class="ck"><input type="checkbox" id="ge"' + (G.enabled ? ' checked' : '') + d + '> تفعيل التقييد بالموقع</label><label>أقصى خطأ مسموح في دقة الموقع (متر)<input type="number" id="ga" value="' + G.maxAccuracy + '"' + d + '></label></div>' +
          '<h4 style="margin:14px 0 6px">المواقع ' + (isAdmin ? '<button class="btn ghost sm" id="gadd">+ موقع</button> <button class="btn ghost sm" id="gme">أضف موقعي الحالي</button>' : '') + '</h4>' +
          (G.sites.length ? G.sites.map((x, i) => '<div class="rrow" data-i="' + i + '"><label>الاسم<input data-k="name" value="' + esc(x.name) + '"' + d + '></label><label>خط العرض<input type="number" step="any" data-k="lat" value="' + x.lat + '"' + d + '></label><label>خط الطول<input type="number" step="any" data-k="lng" value="' + x.lng + '"' + d + '></label><label>النطاق (متر)<input type="number" data-k="radius" value="' + x.radius + '"' + d + '></label>' + (isAdmin ? '<button class="btn danger sm" data-del="' + i + '">حذف</button>' : '') + '</div>').join('') : '<div class="em">لا توجد مواقع بعد</div>') +
          '<p style="color:var(--mu);font-size:12px">الموظفين اللي شغلهم من بره (مندوبين مثلًا) تحدد لهم "يسجل الحضور من أي مكان" في ملفهم.</p>' +
          '<div class="acts">' + (isAdmin ? '<button class="btn" id="gsv">حفظ</button>' : '') + '<button class="btn ghost" id="gcl">إغلاق</button></div>';
        box.querySelector('#gcl').onclick = m.close;
        if (!isAdmin) return;
        const sync = () => { G.enabled = box.querySelector('#ge').checked; G.maxAccuracy = Number(box.querySelector('#ga').value) || 100; box.querySelectorAll('.rrow').forEach(r => { const i = +r.dataset.i; r.querySelectorAll('input').forEach(inp => { G.sites[i][inp.dataset.k] = inp.dataset.k === 'name' ? inp.value : Number(inp.value); }); }); };
        box.querySelector('#gadd').onclick = () => { sync(); G.sites.push({ name: 'المقر', lat: 30.0444, lng: 31.2357, radius: 100 }); draw(); };
        box.querySelector('#gme').onclick = () => { if (!navigator.geolocation) return ui.toast('المتصفح لا يدعم تحديد الموقع'); navigator.geolocation.getCurrentPosition(p => { sync(); G.sites.push({ name: 'موقعي', lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6, radius: 100 }); draw(); }, () => ui.toast('ما قدرتش أحدد موقعك. اسمح بالموقع للمتصفح أو اكتب الإحداثيات يدويًا'), { enableHighAccuracy: true, timeout: 15000 }); };
        box.querySelectorAll('[data-del]').forEach(b => { b.onclick = () => { sync(); G.sites.splice(+b.dataset.del, 1); draw(); }; });
        box.querySelector('#gsv').onclick = async () => {
          sync(); if (G.enabled && !G.sites.length) return ui.toast('أضف موقع واحد على الأقل قبل التفعيل');
          if (G.sites.some(x => !x.name || isNaN(x.lat) || isNaN(x.lng) || !(x.radius > 0))) return ui.toast('راجع بيانات المواقع (الاسم والإحداثيات والنطاق)');
          const ex = rows.find(x => x.key === 'geofence'); if (ex) await store.update('settings', ex.id, { value: G }); else await store.create('settings', { key: 'geofence', value: G });
          ui.toast('تم حفظ مواقع العمل'); m.close();
        };
      };
      draw();
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
