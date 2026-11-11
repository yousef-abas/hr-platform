HR.docTypes = [
  { k: 'id', l: 'صورة البطاقة', x: 1 }, { k: 'birth', l: 'شهادة الميلاد' }, { k: 'edu', l: 'المؤهل الدراسي' }, { k: 'crim', l: 'الفيش الجنائي', x: 1 },
  { k: 'mil', l: 'موقف التجنيد' }, { k: 'contract', l: 'عقد العمل', x: 1 }, { k: 'med', l: 'الكشف الطبي', x: 1 }, { k: 'photo', l: 'صور شخصية' }
];
HR.pages.profile = {
  title: 'ملف الموظف', icon: 'users',
  async render(root, id) {
    const { store, ui, state: st } = HR, esc = ui.esc;
    const tab = st.ptab || 'ov';

    // [تحسين #2] Lazy loading: بيانات ثابتة دايماً + بيانات التبويب فقط
    // البيانات المشتركة (بتتحمل دايماً)
    const [E, D0, T0, LRU, PCF] = await Promise.all([
      store.list('employees'),
      store.list('documents'),
      store.list('timeline'),
      HR.leaves.load(),
      HR.payroll.load()
    ]);
    const e = E.find(x => x.id === id);
    if (!e) { root.innerHTML = '<div class="card em">الموظف غير موجود. <a href="#employees" style="color:var(--ac)">رجوع للقائمة</a></div>'; return; }

    const D = D0.filter(x => x.empId === id);
    const T = T0.filter(x => x.empId === id);
    const td = ui.today(), mgr = E.find(x => x.id === e.managerId);

    // [تحسين #2] تحميل بيانات التبويب فقط
    let A = [], L = [], R = [], P = [], RUNS = [], LINES = [];
    if (tab === 'at' || tab === 'ov') {
      A = (await store.list('attendance')).filter(x => x.empId === id);
    }
    if (tab === 'lv' || tab === 'ov') {
      L = (await store.list('leaves')).filter(x => x.empId === id);
    }
    if (tab === 'pf') {
      R = (await store.list('reviews')).filter(x => x.empId === id);
    }
    if (tab === 'py') {
      RUNS = await store.list('runs');
      LINES = (await store.list('lines')).filter(x => x.empId === id);
    }
    // نظرة عامة: نحتاج كل الإجازات للرصيد
    let L0_all = tab === 'ov' ? await store.list('leaves') : [];

    const dl = d => Math.round((new Date(d) - new Date(td)) / 864e5);
    const mo = td.slice(0, 7);
    let wd = 0; for (let i = 1; i <= +td.slice(8); i++) { const g = new Date(mo + '-' + String(i).padStart(2, '0')).getUTCDay(); if (g !== 5 && g !== 6) wd++; }
    const pr = A.filter(a => a.date.startsWith(mo) && a.in), late = pr.filter(a => a.in > '09:30').length;
    const apct = wd ? Math.min(100, Math.round(pr.length / wd * 100)) : null;
    const avg = R.length ? R.reduce((s, r) => s + r.avg, 0) / R.length : 0;
    const upTo = e.endDate && e.endDate < td ? e.endDate : td;
    const mainT = LRU.types.find(t => t.name === 'سنوية') || LRU.types.find(t => t.paid && t.quota > 0);
    const mb = mainT ? HR.leaves.balance(e, mainT.name, td, tab === 'ov' ? L0_all : L, LRU, PCF.rules) : null;
    const m = Math.max(0, Math.floor((new Date(upTo) - new Date(e.hire)) / 2629800000));
    const pl = (n, a, b, c, d) => n === 1 ? a : n === 2 ? b : n <= 10 ? n + ' ' + c : n + ' ' + d;
    const yy = Math.floor(m / 12), mm = m % 12;
    const tenure = [yy ? pl(yy, 'سنة', 'سنتان', 'سنوات', 'سنة') : '', mm ? pl(mm, 'شهر', 'شهران', 'شهور', 'شهرًا') : ''].filter(Boolean).join(' و') || 'أقل من شهر';
    const dst = t => {
      const d = D.find(x => x.type === t.k);
      if (!d || !d.received) return ['ناقص', 'da', d];
      if (d.expiry) { const x = dl(d.expiry); if (x < 0) return ['منتهي', 'da', d]; if (x <= 30) return ['ينتهي خلال ' + x + ' يوم', 'wa', d]; }
      return ['مستلم', 'ok', d];
    };
    const ds = HR.docTypes.map(t => ({ t, s: dst(t) }));
    const bad = ds.filter(x => x.s[1] === 'da').length;
    const pf = ['photo', 'nid', 'phone', 'email', 'address', 'marital', 'military', 'emergName', 'emergPhone', 'contractType', 'insuranceNo', 'iban'];
    const comp = Math.round((pf.filter(k => e[k]).length + ds.filter(x => x.s[1] !== 'da').length) / (pf.length + ds.length) * 100);
    const S = { active: ['نشط', 'ok'], leave: ['في إجازة', 'wa'], terminated: ['منتهي الخدمة', 'mu'] }[e.status] || ['نشط', 'ok'];
    const kv = a => '<div class="kv2">' + a.map(r => '<div><span>' + r[0] + '</span><b>' + (r[1] ? esc(r[1]) : '—') + '</b></div>').join('') + '</div>';

    const al = [];
    if (e.probationEnd && dl(e.probationEnd) >= 0 && dl(e.probationEnd) <= 30) al.push(['wa', 'تنتهي فترة التجربة بعد ' + dl(e.probationEnd) + ' يوم']);
    if (e.contractEnd) { const x = dl(e.contractEnd); if (x < 0) al.push(['da', 'العقد منتهي منذ ' + (-x) + ' يوم']); else if (x <= 60) al.push(['wa', 'ينتهي العقد بعد ' + x + ' يوم، جهّز التجديد']); }
    if (bad) al.push(['da', bad + ' مستند ناقص أو منتهي']);
    const soon = ds.filter(x => x.s[1] === 'wa'); soon.forEach(x => al.push(['wa', x.t.l + ': ' + x.s[0]]));
    if (late >= 3) al.push(['wa', 'تأخر ' + late + ' مرات هذا الشهر']);

    /* فريق هذا الموظف لو كان مديراً */
    const myTeam = E.filter(x => x.managerId === e.id && x.id !== e.id && x.status !== 'terminated');
    const isManager = myTeam.length > 0;

    const tabs = [
      ['ov', 'عامة'],
      ['pe', 'البيانات الشخصية'],
      ['jb', 'الوظيفة والعقد'],
      ...(isManager ? [['tm', '👥 فريقي (' + myTeam.length + ')']] : []),
      ['dc', 'المستندات'],
      ['at', 'الحضور'],
      ['lv', 'الإجازات'],
      ['py', 'الرواتب'],
      ['pf', 'الأداء'],
      ['tl', 'السجل']
    ];
    const V = {
      ov: () => '<div class="card"><h3>تنبيهات</h3>' + (al.length ? al.map(x => '<div class="al ' + x[0] + '">' + esc(x[1]) + '</div>').join('') : '<div class="al ok">لا توجد تنبيهات على هذا الموظف</div>') + '</div>' +
        '<div class="g2"><div class="card"><h3>الحضور آخر 6 شهور (أيام)</h3><div class="cv"><canvas id="c1"></canvas></div></div><div class="card"><h3>التقييم مقابل متوسط القسم</h3><div class="cv"><canvas id="c2"></canvas></div></div></div>' +
        '<div class="card"><h3>استخدام الإجازات (أيام)</h3><div class="cv" style="height:200px"><canvas id="c3"></canvas></div></div>',
      pe: () => '<div class="card"><div class="ph" style="margin-bottom:12px"><h3 style="margin:0">البيانات الشخصية</h3><button class="btn ghost sm" data-a="edp">تعديل</button></div>' + kv([['الرقم القومي', e.nid], ['تاريخ الميلاد', e.birth], ['النوع', e.gender], ['محافظة الميلاد', e.gov], ['الحالة الاجتماعية', e.marital], ['موقف التجنيد', e.military], ['الموبايل', e.phone], ['الإيميل', e.email], ['العنوان', e.address]]) + '<h3 style="margin:22px 0 12px">جهة اتصال للطوارئ</h3>' + kv([['الاسم', e.emergName], ['الموبايل', e.emergPhone], ['صلة القرابة', e.emergRel]]) + '</div>',
      jb: () => '<div class="card"><div class="ph" style="margin-bottom:12px"><h3 style="margin:0">الوظيفة والعقد</h3><button class="btn ghost sm" data-a="edj">تعديل</button></div>' + kv([['المسمى الوظيفي', e.title], ['القسم', e.dept], ['المدير المباشر', mgr && mgr.name], ['تاريخ التعيين', e.hire], ['نوع العقد', e.contractType], ['نهاية العقد', e.contractEnd], ['نهاية فترة التجربة', e.probationEnd], ['الراتب الأساسي', ui.money(e.salary)], ['البدلات', ui.money(e.allow)], ['رقم التأمينات', e.insuranceNo], ['البنك', e.bank], ['رقم الحساب (IBAN)', e.iban]]) + '</div>',
      dc: () => '<div class="card tw"><h3>المستندات المطلوبة (' + ds.filter(x => x.s[1] !== 'da').length + ' من ' + ds.length + ')</h3><table><tr><th>المستند</th><th>الحالة</th><th>تاريخ الاستلام</th><th>تاريخ الانتهاء</th><th>الملف</th><th></th></tr>' +
        ds.map(({ t, s }) => { const d = s[2]; return '<tr data-k="' + t.k + '"><td><b>' + t.l + '</b></td><td>' + ui.tag(s[0], s[1]) + '</td><td>' + (d && d.received || '—') + '</td><td>' + (d && d.expiry || (t.x ? '—' : 'لا ينطبق')) + '</td><td>' + (d && d.file ? '<button class="btn ghost sm" data-a="dview">عرض</button>' : '—') + '</td><td><button class="btn sm" data-a="dedit">' + (d && d.received ? 'تعديل' : 'تسجيل استلام') + '</button> <button class="btn ghost sm" data-a="dup">رفع ملف</button>' + (d ? ' <button class="btn danger sm" data-a="ddel">حذف</button>' : '') + '</td></tr>'; }).join('') + '</table><p style="color:var(--mu);font-size:13px">' + HR.files.note + '</p></div>',
      at: () => '<div class="card tw"><h3>آخر سجلات الحضور</h3><table><tr><th>التاريخ</th><th>الحضور</th><th>الانصراف</th><th>الحالة</th></tr>' + A.slice().sort((a, b) => b.date < a.date ? -1 : 1).slice(0, 30).map(a => '<tr><td>' + a.date + '</td><td>' + (a.in || '—') + '</td><td>' + (a.out || '—') + '</td><td>' + (!a.in ? ui.tag('غائب', 'da') : a.in > '09:30' ? ui.tag('متأخر', 'wa') : ui.tag('في الموعد', 'ok')) + '</td></tr>').join('') + '</table>' + (A.length ? '' : '<div class="em">لا توجد سجلات</div>') + '</div>',
      lv: () => '<div class="card"><h3>أرصدة السنة الحالية</h3>' + LRU.types.map(t => { const b = HR.leaves.balance(e, t.name, td, L, LRU, PCF.rules); return b.unlimited ? '<div class="bal"><span>' + esc(t.name) + '</span><span>استخدم ' + b.used + ' يوم (بدون حد)</span></div>' : '<div class="bal"><span>' + esc(t.name) + '</span><div class="pb"><i style="width:' + Math.min(100, b.used / b.total * 100) + '%;background:' + t.color + '"></i></div><span>' + b.remaining + ' متبقي من ' + b.total + (b.carry ? ' (فيها ' + b.carry + ' مرحّلة)' : '') + '</span></div>'; }).join('') + '</div><div class="card tw"><h3>الطلبات</h3><table><tr><th>النوع</th><th>من</th><th>إلى</th><th>الأيام</th><th>الحالة</th><th>القرار</th></tr>' + L.slice().reverse().map(l => '<tr><td>' + esc(l.type) + '</td><td>' + l.from + '</td><td>' + l.to + '</td><td>' + l.days + '</td><td>' + ui.tag(l.status, { 'معتمدة': 'ok', 'مرفوضة': 'da', 'معلقة': 'wa' }[l.status]) + '</td><td style="white-space:normal;color:var(--mu);font-size:13px">' + esc(l.status === 'مرفوضة' && l.rejectReason ? 'سبب الرفض: ' + l.rejectReason : (l.decidedBy || '')) + '</td></tr>').join('') + '</table>' + (L.length ? '' : '<div class="em">لا توجد طلبات</div>') + '</div>',
      py: () => { const my = LINES.map(l => ({ run: RUNS.find(r => r.id === l.runId), c: (l.data || {}).calc })).filter(x => x.run && x.c).sort((x, y) => y.run.month < x.run.month ? -1 : 1); return '<div class="card"><h3>الراتب الحالي</h3>' + kv([['الأساسي', ui.money(e.salary)], ['البدلات', ui.money(e.allow)], ['مشمول بالتأمينات', e.insured === false ? 'لا' : 'نعم']]) + '<p style="color:var(--mu);font-size:13px">الحساب التفصيلي وقواعده في صفحة <a href="#payroll" style="color:var(--ac)">الرواتب</a>.</p></div><div class="card tw"><h3>الأشهر المعتمدة</h3><table><tr><th>الشهر</th><th>الإجمالي</th><th>الخصومات</th><th>الصافي</th><th>الحالة</th></tr>' + my.map(x => '<tr><td>' + x.run.month + '</td><td>' + ui.money(x.c.gross) + '</td><td>' + ui.money(x.c.deductions) + '</td><td class="net">' + ui.money(x.c.net) + '</td><td>' + ui.tag(x.run.status === 'paid' ? 'مصروف' : 'معتمد', 'ok') + '</td></tr>').join('') + '</table>' + (my.length ? '' : '<div class="em">لا توجد أشهر معتمدة بعد</div>') + '</div>'; },
      pf: () => '<div class="card"><h3>متوسط التقييم</h3>' + (R.length ? '<b style="font-size:28px">' + avg.toFixed(1) + '</b> ' + ui.stars(avg) + ' <span style="color:var(--mu)">(' + R.length + ' تقييم)</span>' : '<div class="em">لا توجد تقييمات. أضف من صفحة <a href="#performance" style="color:var(--ac)">تقييم الأداء</a>.</div>') + '</div>' + (R.length ? '<div class="card tw"><table><tr><th>الفترة</th><th>الجودة</th><th>التعاون</th><th>الالتزام</th><th>المبادرة</th><th>المتوسط</th><th>ملاحظات</th></tr>' + R.map(r => '<tr><td>' + r.period + '</td><td>' + r.q + '</td><td>' + r.t + '</td><td>' + r.p + '</td><td>' + r.i + '</td><td><b>' + r.avg.toFixed(1) + '</b></td><td>' + esc(r.note || '') + '</td></tr>').join('') + '</table></div>' : ''),
      tm: () => {
        const mgr = E.find(x => x.id === e.managerId && x.id !== e.id);
        return '<div class="card">' +
          '<div class="ph" style="margin-bottom:16px">' +
            '<h3 style="margin:0">👥 الفريق المباشر (' + myTeam.length + ' موظف)</h3>' +
            (mgr ? '<span style="font-size:13px;color:var(--mu)">يتبع لـ: <b>' + esc(mgr.name) + '</b></span>' : '') +
          '</div>' +
          '<div class="emp-grid">' +
            myTeam.map(m => {
              const col = ['#c9933a','#7c3aed','#0891b2','#16a34a','#d97706'][m.name.length % 5];
              return '<div class="emp-card" data-id="' + esc(m.id) + '" style="cursor:pointer">' +
                '<div class="emp-card-top">' +
                  '<div class="emp-avatar">' +
                    (m.photo
                      ? '<img data-photo="' + esc(m.photo) + '" class="lazy-photo" alt="">'
                      : '<span style="background:' + col + '">' + (m.name||'?').trim()[0] + '</span>') +
                  '</div>' +
                  ui.tag('نشط', 'ok') +
                '</div>' +
                '<div class="emp-card-body">' +
                  '<b class="emp-name">' + esc(m.name) + '</b>' +
                  '<span class="emp-title">' + esc(m.title || '') + '</span>' +
                  '<span class="emp-dept">' + ui.icon('grid') + esc(m.dept || '') + '</span>' +
                '</div>' +
                '<div class="emp-card-foot">' +
                  '<button class="btn sm" data-a="go-profile">الملف</button>' +
                '</div>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>';
      },
      tl: () => { const it = T.concat([{ id: '', date: e.hire, type: 'تعيين', text: 'الانضمام للوظيفة بوظيفة ' + e.title }]).sort((a, b) => b.date < a.date ? -1 : 1); return '<div class="card"><div class="ph" style="margin-bottom:12px"><h3 style="margin:0">السجل الوظيفي</h3><button class="btn sm" data-a="tadd">+ أضف حدثاً</button></div><div class="tl">' + it.map(x => '<div data-id="' + x.id + '"><b>' + esc(x.type) + '</b> <small>' + x.date + '</small>' + (x.id ? ' <button class="btn danger sm" data-a="tdel">حذف</button>' : '') + '<div>' + esc(x.text) + '</div></div>').join('') + '</div></div>'; }
    };

    // [تحسين #1] الصورة: لو storage path استخدم photoUrl، لو base64 قديم استخدمه مباشرة
    let photoSrc = null;
    if (e.photo) {
      photoSrc = HR.files.photoUrl ? await HR.files.photoUrl(e.photo).catch(() => e.photo) : e.photo;
    }
    const av = photoSrc ? '<img class="av" alt="" src="' + photoSrc + '">' : '<span class="av" style="background:' + ui.color(e) + '">' + esc(e.name.trim()[0]) + '</span>';
    const kp = (l, v, s, c) => '<div class="card kpi"><span>' + l + '</span><b class="' + (c || '') + '" style="font-size:26px">' + v + '</b><small style="margin:0">' + s + '</small></div>';
    root.innerHTML =
      '<div class="bc" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center"><span><a href="#dashboard">الرئيسية</a> › <a href="#employees">الموظفون</a> › ' + esc(e.name) + '</span><button class="btn ghost sm" data-a="pdf-profile">📄 تصدير PDF</button></div>' +
      '<div class="card pc"><div class="pav">' + av + '<button class="btn ghost sm" data-a="photo">تغيير الصورة</button></div>' +
      '<div class="pi"><h1>' + esc(e.name) + '</h1><p>' + esc(e.title) + ' • ' + esc(e.dept) + '</p><div class="tg">' + ui.tag(S[0], S[1]) + (e.contractType ? ui.tag(e.contractType, 'mu') : '') + (bad ? ui.tag(bad + ' مستند ناقص', 'da') : '') + '</div><div class="meta"><span>مدة الخدمة: ' + tenure + '</span><span>التعيين: ' + e.hire + '</span>' + (mgr ? '<span>المدير: ' + esc(mgr.name) + '</span>' : '') + (e.phone ? '<span>' + esc(e.phone) + '</span>' : '') + (e.status === 'terminated' && e.endDate ? '<span style="color:var(--da)">انتهت الخدمة: ' + e.endDate + (e.endReason ? ' (' + esc(e.endReason) + ')' : '') + '</span>' : '') + '</div></div>' +
      '<div class="pcm"><span style="color:var(--mu);font-size:13px">اكتمال الملف ' + comp + '%</span><div class="pb"><i style="width:' + comp + '%"></i></div><div class="acts noprint"><button class="btn ghost sm" data-a="edj">تعديل</button><button class="btn ghost sm" data-a="print">طباعة</button>' + (e.status === 'terminated' ? '<button class="btn ghost sm" data-a="react">إعادة تفعيل</button>' : '<button class="btn danger sm" data-a="term">إنهاء الخدمة</button>') + (HR.user.role === 'admin' ? '<button class="btn danger sm" data-a="purge">حذف نهائي</button>' : '') + '</div></div></div>' +
      '<div class="stats">' + kp('الحضور هذا الشهر', apct == null ? '—' : apct + '%', pr.length + ' يوم من ' + wd, apct != null && apct < 80 ? 'c-wa' : 'c-ok') + kp('مرات التأخير', late, 'هذا الشهر', late >= 3 ? 'c-wa' : '') + kp('رصيد الإجازة', mb && !mb.unlimited ? mb.remaining + ' يوم' : '—', mb ? 'استخدم ' + mb.used + ' من ' + (mb.unlimited ? 'بدون حد' : mb.total) : '') + kp('تقييم الأداء', R.length ? avg.toFixed(1) + ' / 5' : '—', R.length + ' تقييم') + kp('الراتب', ui.money(e.salary + (e.allow || 0)), 'أساسي + بدلات') + '</div>' +
      '<div class="pt noprint">' + tabs.map(t => '<button data-t="' + t[0] + '" class="' + (t[0] === tab ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div>' + V[tab]();

    if (tab === 'ov' && window.Chart) {
      Chart.defaults.font.family = 'Cairo';
      const lab = [], val = [];
      for (let i = 5; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); const k = ui.iso(d).slice(0, 7); lab.push(k); val.push(A.filter(a => a.date.startsWith(k) && a.in).length); }
      new Chart(root.querySelector('#c1'), { type: 'bar', data: { labels: lab, datasets: [{ data: val, backgroundColor: '#0070f2', borderRadius: 8, maxBarThickness: 36 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } } });
      // للأداء: نجيب بيانات القسم فقط اللي نحتاجها
      const R0_dept = (await store.list('reviews')).filter(r => (E.find(x => x.id === r.empId) || {}).dept === e.dept);
      const myR = R0_dept.filter(r => r.empId === id);
      const per = [...new Set(R0_dept.map(r => r.period))].sort();
      new Chart(root.querySelector('#c2'), { type: 'line', data: { labels: per, datasets: [{ label: e.name, data: per.map(p => (myR.find(r => r.period === p) || {}).avg), borderColor: '#0070f2', tension: .3 }, { label: 'متوسط القسم', data: per.map(p => { const x = R0_dept.filter(r => r.period === p); return x.length ? x.reduce((s, r) => s + r.avg, 0) / x.length : null; }), borderColor: '#9aa8b8', borderDash: [5, 4], tension: .3 }] }, options: { maintainAspectRatio: false, scales: { y: { min: 0, max: 5 } } } });
      const lt = {}; L.filter(l => l.status === 'معتمدة').forEach(l => lt[l.type] = (lt[l.type] || 0) + l.days);
      new Chart(root.querySelector('#c3'), { type: 'bar', data: { labels: Object.keys(lt), datasets: [{ data: Object.values(lt), backgroundColor: '#0e9f9a', borderRadius: 8, maxBarThickness: 40 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } } });
    }

    const PF = [{ n: 'nid', l: 'الرقم القومي (14 رقم)' }, { n: 'phone', l: 'الموبايل', t: 'tel' }, { n: 'email', l: 'الإيميل', t: 'email' }, { n: 'address', l: 'العنوان' },
      { n: 'marital', l: 'الحالة الاجتماعية', opts: ['', 'أعزب', 'متزوج', 'مطلق', 'أرمل'] }, { n: 'military', l: 'موقف التجنيد', opts: ['', 'أدى الخدمة', 'معفي', 'مؤجل', 'لا ينطبق'] },
      { n: 'emergName', l: 'جهة اتصال للطوارئ' }, { n: 'emergPhone', l: 'موبايل الطوارئ', t: 'tel' }, { n: 'emergRel', l: 'صلة القرابة' }];
    const JF = [{ n: 'title', l: 'المسمى الوظيفي', req: 1 }, { n: 'dept', l: 'القسم', req: 1 }, { n: 'managerId', l: 'المدير المباشر', opts: [['', 'بدون']].concat(E.filter(x => x.id !== id).map(x => [x.id, x.name])) },
      { n: 'status', l: 'الحالة', opts: [['active', 'نشط'], ['leave', 'في إجازة'], ['terminated', 'منتهي الخدمة']] }, { n: 'hire', l: 'تاريخ التعيين', t: 'date', req: 1 },
      { n: 'contractType', l: 'نوع العقد', opts: ['', 'دائم', 'محدد المدة', 'تحت التجربة', 'مؤقت'] }, { n: 'contractEnd', l: 'نهاية العقد', t: 'date' }, { n: 'probationEnd', l: 'نهاية فترة التجربة', t: 'date' },
      { n: 'salary', l: 'الراتب الأساسي', t: 'number', req: 1 }, { n: 'allow', l: 'البدلات', t: 'number' }, { n: 'remoteOk', l: 'يسجل الحضور من أي مكان (بدون تقييد بموقع)', opts: [['false', 'لا'], ['true', 'نعم']] }, { n: 'insured', l: 'مشمول بالتأمينات', opts: [['true', 'نعم'], ['false', 'لا']] }, { n: 'insuranceNo', l: 'رقم التأمينات' }, { n: 'bank', l: 'البنك' }, { n: 'iban', l: 'رقم الحساب (IBAN)' }];
    const save = async (o, msg) => { await store.update('employees', id, HR.fixEmp(Object.assign({}, e, o))); ui.toast(msg || 'تم الحفظ'); HR.refresh(); };
    const read = f => new Promise(r => { const x = new FileReader(); x.onload = () => r(x.result); x.readAsDataURL(f); });
    const pick = (accept, cb) => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => i.files[0] && cb(i.files[0]); i.click(); };
    const putDoc = async (k, patch) => { const d = D.find(x => x.type === k); if (d) await store.update('documents', d.id, patch); else await store.create('documents', Object.assign({ empId: id, type: k, received: '', expiry: '' }, patch)); HR.refresh(); };

    root.onclick = async ev => {
      const b = ev.target.closest('[data-a],[data-t]'); if (!b) return;
      if (b.dataset.t) { st.ptab = b.dataset.t; HR.refresh(); return; }
      const a = b.dataset.a, tr = b.closest('tr') || b.closest('[data-id]'), k = tr && tr.dataset.k, dt = HR.docTypes.find(x => x.k === k);
      if (a === 'go-profile') { location.hash = 'profile-' + btn.closest('[data-id]').dataset.id; return; }
      if (a === 'print') window.print();
      else if (a === 'photo') pick('image/*', async f => {
        const img = new Image();
        img.onload = async () => {
          const s = Math.min(img.width, img.height), c = document.createElement('canvas');
          c.width = c.height = 240; c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 240, 240);
          c.toBlob(async blob => {
            let photoVal;
            // [تحسين #1] لو Supabase متصل: ارفع على storage
            if (HR.mode === 'supabase' && HR.files.uploadPhoto) {
              ui.toast('جاري رفع الصورة...');
              try { photoVal = await HR.files.uploadPhoto(id, blob); }
              catch (err) { ui.toast('تعذر رفع الصورة: ' + err.message); return; }
            } else {
              // وضع تجريبي: base64 (لا ينصح به في production)
              photoVal = c.toDataURL('image/jpeg', .82);
            }
            await store.update('employees', id, { photo: photoVal });
            ui.toast('تم تحديث الصورة'); HR.refresh();
          }, 'image/jpeg', 0.82);
        };
        img.src = URL.createObjectURL(f);
      });
      else if (a === 'term') {
        const o = await ui.form('إنهاء الخدمة: ' + e.name, [{ n: 'endDate', l: 'آخر يوم عمل', t: 'date', req: 1 }, { n: 'endReason', l: 'السبب', opts: ['استقالة', 'انتهاء العقد', 'إنهاء من الشركة', 'تقاعد', 'أخرى'] }, { n: 'note', l: 'ملاحظات' }], { endDate: td });
        if (!o) return; if (e.hire && o.endDate < e.hire) return ui.toast('آخر يوم عمل قبل تاريخ التعيين');
        await store.update('employees', id, { status: 'terminated', endDate: o.endDate, endReason: o.endReason });
        await store.create('timeline', { empId: id, date: o.endDate, type: 'إنهاء خدمة', text: o.endReason + (o.note ? ' - ' + o.note : '') });
        ui.toast('تم إنهاء الخدمة وحفظ الملف'); HR.refresh();
      }
      else if (a === 'react') { if (!confirm('إعادة تفعيل ' + e.name + '؟')) return; await store.update('employees', id, { status: 'active', endDate: '', endReason: '' }); await store.create('timeline', { empId: id, date: td, type: 'ملاحظة', text: 'إعادة تفعيل الموظف' }); ui.toast('تمت إعادة التفعيل'); HR.refresh(); }
      else if (a === 'purge') { const t = prompt('حذف نهائي بيمسح كل بيانات ' + e.name + ' (حضور وإجازات ومستندات وسجل) ولا يمكن التراجع.\nاكتب اسم الموظف للتأكيد:'); if (t !== e.name) return t === null ? 0 : ui.toast('الاسم غير مطابق، لم يتم الحذف'); await store.remove('employees', id); ui.toast('تم الحذف'); location.hash = 'employees'; }
      else if (a === 'edp') { const o = await ui.form('تعديل البيانات الشخصية', PF, e); if (o) save(o); }
      else if (a === 'edj') { const o = await ui.form('تعديل بيانات الوظيفة', JF, e); if (o) save(o); }
      else if (a === 'dedit') { const d = D.find(x => x.type === k) || {}; const f = [{ n: 'received', l: 'تاريخ الاستلام', t: 'date', req: 1 }]; if (dt.x) f.push({ n: 'expiry', l: 'تاريخ الانتهاء', t: 'date' }); f.push({ n: 'note', l: 'ملاحظة' }); const o = await ui.form(dt.l, f, Object.assign({ received: td }, d)); if (o) { await putDoc(k, o); ui.toast('تم الحفظ'); } }
      else if (a === 'dup') pick('image/*,application/pdf', async f => { if (['application/pdf', 'image/jpeg', 'image/png'].indexOf(f.type) < 0) return ui.toast('النوع غير مسموح. الملفات المسموحة: PDF أو JPG أو PNG'); if (f.size > HR.files.max) return ui.toast('الملف أكبر من الحد المسموح (' + Math.round(HR.files.max / 1024) + ' كيلوبايت)'); const d = D.find(x => x.type === k); ui.toast('جاري الرفع...'); putDoc(k, { file: await HR.files.upload(id, k, f), fname: f.name, received: (d && d.received) || td }); });
      else if (a === 'dview') { const d = D.find(x => x.type === k); window.open(await HR.files.url(d.file)); }
      else if (a === 'ddel') { if (confirm('حذف سجل هذا المستند؟')) { await store.remove('documents', D.find(x => x.type === k).id); HR.refresh(); } }
      else if (a === 'tadd') { const o = await ui.form('حدث جديد', [{ n: 'date', l: 'التاريخ', t: 'date', req: 1 }, { n: 'type', l: 'النوع', opts: ['ترقية', 'تغيير راتب', 'إنذار', 'دورة تدريبية', 'ملاحظة', 'أخرى'] }, { n: 'text', l: 'التفاصيل', req: 1 }], { date: td }); if (o) { o.empId = id; await store.create('timeline', o); HR.refresh(); } }
      else if (a === 'tdel') { await store.remove('timeline', tr.dataset.id); HR.refresh(); }
    };
  }
};
