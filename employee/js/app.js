(function () {
  const H = window.HR, ui = H.ui, A = H.api, esc = ui.esc, L = H.leaves;
  const view = document.getElementById('view'), nav = document.getElementById('nav');
  let CFG, ME, RULES, timer;
  const screen = html => { clearInterval(timer); nav.style.display = 'none'; view.innerHTML = html; window.scrollTo(0, 0); };
  const brand = '<div class="brand"><i>HR</i><b>تطبيق الموظفين</b></div>';
  const fatal = (title, msg, out) => screen('<div class="auth card">' + brand + '<h2>' + title + '</h2><p class="lm err">' + esc(msg) + '</p>' + (out ? '<button class="btn" id="lo">تسجيل الخروج</button>' : '<button class="btn" onclick="location.reload()">إعادة المحاولة</button>') + '</div>') || (out && (view.querySelector('#lo').onclick = () => H.mode === 'local' ? location.reload() : H.auth.logout()));
  const DOCS = { id: 'صورة البطاقة', birth: 'شهادة الميلاد', edu: 'المؤهل الدراسي', crim: 'الفيش الجنائي', mil: 'موقف التجنيد', contract: 'عقد العمل', med: 'الكشف الطبي', photo: 'صور شخصية' };
  const hm = () => new Date().toTimeString().slice(0, 5);
  const mins = t => { const a = String(t || '').split(':'); return a.length < 2 ? 0 : +a[0] * 60 + +a[1]; };
  const dur = m => { m = Math.max(0, Math.round(m)); return Math.floor(m / 60) + ' س ' + (m % 60) + ' د'; };

  /* ── Dark mode ── */
  const savedTheme = localStorage.getItem('hr-emp-theme') || 'light';
  if (savedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

  /* ── الدخول ── */
  function login() {
    return new Promise(res => {
      screen('<form class="auth card">' + brand + '<h2>تسجيل الدخول</h2><p class="lm">ادخل بحسابك اللي استلمته من الموارد البشرية</p><label>الإيميل<input type="email" name="e" required autocomplete="username"></label><label>كلمة المرور<input type="password" name="p" required autocomplete="current-password"></label><button class="btn block">دخول</button></form>');
      const f = view.querySelector('form'), m = view.querySelector('.lm');
      f.onsubmit = async ev => { ev.preventDefault(); const b = f.querySelector('button'); b.disabled = true; try { await H.auth.login(f.elements.e.value.trim(), f.elements.p.value); res(); } catch (e) { m.className = 'lm err'; m.textContent = e.message; b.disabled = false; } };
    });
  }
  function pickDemo() {
    return new Promise(res => {
      const list = H.store.db.employees.filter(e => e.status !== 'terminated');
      screen('<form class="auth card">' + brand + '<h2>وضع تجريبي</h2><p class="lm">اختر موظف تجرّب التطبيق بحسابه. البيانات في المتصفح بس ومفيش تخزين حقيقي.</p><label>الموظف<select name="e">' + list.map(e => '<option value="' + e.id + '">' + esc(e.name) + ' - ' + esc(e.title || '') + '</option>').join('') + '</select></label><button class="btn block">ابدأ التجربة</button></form>');
      view.querySelector('form').onsubmit = ev => { ev.preventDefault(); H.state.demoEmp = ev.target.elements.e.value; H.user = { id: 'demo', email: 'demo', name: 'تجربة', role: 'employee', demo: true }; res(); };
    });
  }
  async function gate() {
    if (H.mode === 'error') { try { await H.auth.ready(); } catch (e) { fatal('تعذر تشغيل التطبيق', e.message); await new Promise(() => {}); } }
    if (H.mode === 'local') { await pickDemo(); return; }
    try { await H.auth.ready(); } catch (e) { /* مفيش جلسة */ }
    while (!H.user) await login();
  }

  /* ── الموقع ── */
  function getPos() {
    if (H.mode === 'local') return Promise.resolve(A.demoPos(H.state.demoPos || 'inside'));
    return new Promise((ok, no) => {
      if (!navigator.geolocation) return no(new Error('المتصفح لا يدعم تحديد الموقع'));
      navigator.geolocation.getCurrentPosition(
        p => ok({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
        e => no(new Error(e.code === 1 ? 'اسمح للتطبيق بالوصول للموقع من إعدادات المتصفح' : e.code === 3 ? 'انتهت مهلة تحديد الموقع، أعد المحاولة' : 'تعذر تحديد موقعك')),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    });
  }

  /* ── الرئيسية ── */
  async function home() {
    const td = ui.today(), mo = td.slice(0, 7), rg = A.monthRange(mo);
    const [att, lv] = await Promise.all([A.attendance(ME.id, rg.from, rg.to), A.leaves(ME.id)]);
    const rec = att.find(a => a.date === td) || { in: '', out: '' }, present = att.filter(a => a.in).length;
    const mt = RULES.types.find(t => t.name === 'سنوية') || RULES.types.find(t => t.paid && t.quota > 0);
    const mb = mt ? L.balance(ME, mt.name, td, lv, RULES, CFG.pay) : null;
    const pend = lv.filter(l => l.status === 'معلقة').length;
    const hour = new Date().getHours();
    const g = hour < 12 ? 'صباح الخير' : hour < 18 ? 'مساء الخير' : 'مساء النور';
    const restricted = CFG.geo.enabled && !ME.remote;
    const state = !rec.in ? 'in' : !rec.out ? 'out' : 'done';
    const initials = (ME.name || 'م').trim()[0];

    view.innerHTML =
      /* Hero */
      '<section class="hero">' +
        '<div>' +
          '<small>' + g + ' 👋</small>' +
          '<h1>' + esc(ME.name) + '</h1>' +
          '<p>' + esc(ME.title || '') + (ME.dept ? ' • ' + esc(ME.dept) : '') + '</p>' +
          '<span class="hero-badge">' + new Date().toLocaleDateString('ar-EG',{weekday:'long',day:'numeric',month:'long'}) + '</span>' +
        '</div>' +
        '<div class="clk" id="clk">' + hm() + '</div>' +
      '</section>' +

      /* Punch card */
      '<section class="card punch ' + state + '">' +
        (state === 'in'
          ? '<p class="st">لسه ما سجلتش حضورك النهاردة</p>' +
            '<button class="pbtn go" id="pb" data-k="in">تسجيل<br>حضور</button>'
          : state === 'out'
          ? '<p class="st">حاضر منذ <b>' + rec.in + '</b> • <span id="el">' + dur(mins(hm()) - mins(rec.in)) + '</span></p>' +
            '<button class="pbtn stop" id="pb" data-k="out">تسجيل<br>انصراف</button>'
          : '<div class="done">✓</div>' +
            '<p class="st">حضرت <b>' + rec.in + '</b> وانصرفت <b>' + rec.out + '</b><br>مدة العمل ' + dur(mins(rec.out) - mins(rec.in)) + '</p>') +
        '<p class="pm" id="pm">' +
          (state === 'done' ? '' : restricted ? '📍 التسجيل مقيّد بموقع العمل.' : '🌐 التسجيل من أي مكان.') +
        '</p>' +
      '</section>' +

      /* Demo pos switcher */
      (H.mode === 'local'
        ? '<section class="card demo"><b>تجربة الموقع:</b> أنا <button class="chip' + ((H.state.demoPos || 'inside') === 'inside' ? ' on' : '') + '" data-pos="inside">جوه الشركة</button><button class="chip' + (H.state.demoPos === 'outside' ? ' on' : '') + '" data-pos="outside">برة الشركة</button></section>'
        : '') +

      /* Stats */
      '<section class="grid2">' +
        '<div class="card stat">' +
          '<div class="stat-ic" style="background:#eff6ff;color:#2563eb">' + ui.icon('clock') + '</div>' +
          '<span>أيام حضوري هذا الشهر</span><b>' + present + '</b>' +
        '</div>' +
        '<div class="card stat">' +
          '<div class="stat-ic" style="background:#f0fdf4;color:#16a34a">' + ui.icon('calendar') + '</div>' +
          '<span>رصيد ' + esc(mt ? mt.name : 'الإجازة') + '</span>' +
          '<b>' + (mb && !mb.unlimited ? mb.remaining : '—') + '</b>' +
        '</div>' +
        '<div class="card stat">' +
          '<div class="stat-ic" style="background:#fffbeb;color:#d97706">' + ui.icon('list') + '</div>' +
          '<span>طلبات معلقة</span><b>' + pend + '</b>' +
        '</div>' +
        '<a class="card stat lnk" href="#slips">' +
          '<div class="stat-ic" style="background:#f5f3ff;color:#7c3aed">' + ui.icon('wallet') + '</div>' +
          '<span>قسيمة الراتب</span><b>عرض ›</b>' +
        '</a>' +
      '</section>';

    clearInterval(timer);
    timer = setInterval(() => {
      const c = document.getElementById('clk'); if (c) c.textContent = hm();
      const e = document.getElementById('el'); if (e && rec.in) e.textContent = dur(mins(hm()) - mins(rec.in));
    }, 20000);

    view.querySelectorAll('[data-pos]').forEach(b => { b.onclick = () => { H.state.demoPos = b.dataset.pos; home(); }; });
    const pb = view.querySelector('#pb'); if (pb) pb.onclick = () => punch(pb.dataset.k, restricted);
  }

  async function punch(kind, restricted) {
    const btn = view.querySelector('#pb'), msg = view.querySelector('#pm');
    btn.disabled = true; msg.className = 'pm'; msg.textContent = restricted ? 'جاري تحديد موقعك...' : 'جاري التسجيل...';
    try {
      const pos = restricted ? await getPos() : {}; msg.textContent = 'جاري التسجيل...';
      const r = await (kind === 'in' ? A.checkIn(pos) : A.checkOut(pos));
      ui.toast((kind === 'in' ? '✅ تم تسجيل الحضور ' : '👋 تم تسجيل الانصراف ') + r.time + (r.site ? ' • ' + r.site : ''));
      go();
    } catch (e) { btn.disabled = false; msg.className = 'pm err'; msg.textContent = e.message; }
  }

  /* ── الإجازات ── */
  async function leaves() {
    const td = ui.today(), lv = await A.leaves(ME.id), tc = n => (L.type(RULES, n) || {}).color || '#5b738b';
    view.innerHTML = '<h2 class="pt">إجازاتي</h2>' +
      '<section class="card"><h3>أرصدتي</h3>' +
        RULES.types.map(t => {
          const b = L.balance(ME, t.name, td, lv, RULES, CFG.pay);
          return b.unlimited
            ? '<div class="bal"><b>' + esc(t.name) + '</b><span>استخدمت ' + b.used + ' يوم</span></div>'
            : '<div class="bal"><b>' + esc(t.name) + '</b><div class="pb"><i style="width:' + Math.min(100, b.used / b.total * 100) + '%;background:' + t.color + '"></i></div><span>' + b.remaining + ' / ' + b.total + '</span></div>';
        }).join('') +
      '</section>' +
      '<button class="btn block" id="nw">+ طلب إجازة جديد</button>' +
      '<section class="card"><h3>طلباتي</h3>' +
        (lv.length
          ? lv.map(l =>
              '<div class="req"><div>' +
                '<span class="tag" style="background:' + tc(l.type) + '22;color:' + tc(l.type) + '">' + esc(l.type) + '</span> <b>' + l.days + ' يوم</b>' +
                '<small>' + l.from + (l.to !== l.from ? ' إلى ' + l.to : '') + '</small>' +
                (l.mgrStatus ? '<small>المدير: ' + esc(l.mgrStatus) + (l.mgrBy ? ' (' + esc(l.mgrBy) + ')' : '') + '</small>' : '') +
                (l.status === 'مرفوضة' && l.rejectReason ? '<small class="errt">السبب: ' + esc(l.rejectReason) + '</small>' : '') +
              '</div><div class="side">' +
                ui.tag(l.status, { 'معتمدة': 'ok', 'مرفوضة': 'da', 'معلقة': 'wa' }[l.status]) +
                (l.status === 'معلقة' ? '<button class="lnkb" data-c="' + l.id + '">إلغاء</button>' : '') +
              '</div></div>')
          .join('')
          : '<div class="em">لا توجد طلبات</div>') +
      '</section>';

    view.querySelectorAll('[data-c]').forEach(b => {
      b.onclick = async () => {
        if (!confirm('إلغاء الطلب؟')) return;
        try { await A.cancelLeave(b.dataset.c); ui.toast('تم إلغاء الطلب'); leaves(); }
        catch (e) { ui.toast(e.message); }
      };
    });
    view.querySelector('#nw').onclick = () => requestModal(lv);
  }

  function requestModal(lv) {
    const td = ui.today(), vr = Object.assign({}, RULES, { maxDeptOffPct: 0 });
    const m = ui.modal('طلب إجازة',
      '<form id="rq">' +
        '<label>النوع<select name="type">' + RULES.types.map(t => '<option>' + esc(t.name) + '</option>').join('') + '</select></label>' +
        '<label>من<input type="date" name="from" value="' + td + '" required></label>' +
        '<label>إلى<input type="date" name="to" value="' + td + '" required></label>' +
        '<label>ملاحظة (اختياري)<input name="note"></label>' +
        '<div id="inf"></div>' +
        '<p class="mu">الطلب بيروح لمديرك المباشر وبعدها للموارد البشرية.</p>' +
        '<div class="acts"><button class="btn" type="submit">إرسال الطلب</button><button class="btn ghost" type="button" data-x>إلغاء</button></div>' +
      '</form>');
    const f = m.el.querySelector('#rq'), inf = m.el.querySelector('#inf');
    const check = () => {
      const el = f.elements, o = { type: el.type.value, from: el.from.value, to: el.to.value };
      const v = L.validate(o, { emp: ME, rules: vr, pay: CFG.pay, leaves: lv, emps: [ME], today: td });
      const b = L.balance(ME, o.type, o.from || td, lv, RULES, CFG.pay);
      inf.innerHTML = '<div class="al ok">' + v.days + ' يوم' + (b && !b.unlimited ? ' | المتاح ' + Math.max(0, Math.round(b.available * 100) / 100) + ' من ' + b.total : '') + '</div>' +
        v.errors.map(x => '<div class="al da">' + esc(x) + '</div>').join('');
      return { o, v };
    };
    f.addEventListener('input', check); f.addEventListener('change', check); check();
    m.el.querySelector('[data-x]').onclick = m.close;
    f.onsubmit = async ev => {
      ev.preventDefault(); const { o, v } = check();
      if (v.errors.length) return ui.toast('صحّح الأخطاء الأول');
      const btn = f.querySelector('button'); btn.disabled = true;
      try {
        await A.createLeave(Object.assign(o, { empId: ME.id, days: v.days || 1, note: f.elements.note.value }));
        m.close(); ui.toast('✅ تم إرسال الطلب'); leaves();
      } catch (e) { btn.disabled = false; ui.toast(e.message); }
    };
  }

  /* ── القسايم ── */
  async function slips() {
    const rows = await A.payslips();
    view.innerHTML = '<h2 class="pt">قسايم الرواتب</h2>' +
      (rows.length
        ? rows.map((p, i) =>
            '<button class="card slip-row" data-i="' + i + '">' +
              '<div><b>' + p.month + '</b><small>' + (p.status === 'paid' ? 'مصروف' : 'معتمد') + '</small></div>' +
              '<span class="net">' + ui.money(p.data.calc.net) + '</span>' +
            '</button>').join('')
        : '<div class="card em">لسه مفيش قسايم معتمدة. القسيمة بتظهر هنا بعد ما الموارد البشرية تعتمد الشهر.</div>');
    view.querySelectorAll('[data-i]').forEach(b => {
      b.onclick = () => {
        const p = rows[+b.dataset.i];
        H.payrollTools.printSlips([{ name: ME.name, dept: ME.dept, title: ME.title, calc: p.data.calc }], p.month, CFG.company, 'قسيمة راتب ' + p.month);
      };
    });
  }

  /* ── الفريق (للمدير المباشر) ── */
  async function team() {
    const td = ui.today(), dir = await A.team(), ids = dir.map(x => x.id);
    const [lv, att] = await Promise.all([A.teamLeaves(ids), A.teamAttendance(ids, td)]);
    const nm = id => (dir.find(x => x.id === id) || { name: '؟' }).name;
    const stat = m => {
      if (lv.some(l => l.empId === m.id && l.status === 'معتمدة' && l.from <= td && l.to >= td)) return ui.tag('في إجازة', 'wa');
      const r = att.find(a => a.empId === m.id);
      return r && r.in ? ui.tag(r.out ? 'انصرف ' + r.out : 'حاضر ' + r.in, 'ok') : ui.tag('لم يسجل', 'mu');
    };
    const pend = lv.filter(l => l.status === 'معلقة' && l.mgrStatus !== 'موافق');
    const wait  = lv.filter(l => l.status === 'معلقة' && l.mgrStatus === 'موافق');

    view.innerHTML = '<h2 class="pt">فريقي (' + dir.length + ')</h2>' +
      '<section class="card"><h3>النهاردة</h3>' +
        (dir.length
          ? dir.map(m => '<div class="req"><div><b>' + esc(m.name) + '</b><small>' + esc(m.title || '') + '</small></div><div class="side">' + stat(m) + '</div></div>').join('')
          : '<div class="em">مفيش موظفين تابعين لك</div>') +
      '</section>' +
      '<section class="card"><h3>طلبات تنتظر قرارك (' + pend.length + ')</h3>' +
        (pend.length
          ? pend.map(l =>
              '<div class="req" data-id="' + l.id + '">' +
                '<div><b>' + esc(nm(l.empId)) + '</b> <span class="tag mu">' + esc(l.type) + '</span>' +
                '<small>' + l.from + (l.to !== l.from ? ' إلى ' + l.to : '') + ' • ' + l.days + ' يوم' + (l.note ? ' • ' + esc(l.note) : '') + '</small></div>' +
                '<div class="side"><button class="btn sm" data-a="ok">موافقة</button><button class="btn danger sm" data-a="no">رفض</button></div>' +
              '</div>')
          .join('')
          : '<div class="em">مفيش طلبات معلقة</div>') +
      '</section>' +
      (wait.length
        ? '<section class="card"><h3>وافقت عليها وتنتظر الموارد البشرية</h3>' +
            wait.map(l => '<div class="req"><div><b>' + esc(nm(l.empId)) + '</b><small>' + esc(l.type) + ' • ' + l.from + ' • ' + l.days + ' يوم</small></div></div>').join('') +
          '</section>'
        : '');

    view.querySelectorAll('[data-a]').forEach(b => {
      b.onclick = async () => {
        const id = b.closest('[data-id]').dataset.id; let why = '';
        if (b.dataset.a === 'no') { why = prompt('سبب الرفض (مطلوب):'); if (!why || !why.trim()) return; }
        b.disabled = true;
        try {
          await A.decide(id, b.dataset.a === 'ok', why);
          ui.toast(b.dataset.a === 'ok' ? '✅ تمت الموافقة، الطلب راح للموارد البشرية' : 'تم الرفض');
          team();
        } catch (e) { b.disabled = false; ui.toast(e.message); }
      };
    });
  }

  /* ── حسابي ── */
  async function me() {
    const [e, docs] = await Promise.all([A.employee(ME.id), A.documents(ME.id)]), td = ui.today();
    const st = k => {
      const d = docs.find(x => x.type === k);
      if (!d || !d.received) return ui.tag('ناقص', 'da');
      if (d.expiry && d.expiry < td) return ui.tag('منتهي', 'da');
      if (d.expiry && (new Date(d.expiry) - new Date(td)) / 864e5 <= 30) return ui.tag('ينتهي قريبًا', 'wa');
      return ui.tag('مستلم', 'ok');
    };
    const kv = (a, b) => '<div class="kv"><span>' + a + '</span><b>' + (b ? esc(b) : '—') + '</b></div>';
    const initials = (e.name || 'م').trim()[0];

    // dark mode toggle
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    view.innerHTML = '<h2 class="pt">حسابي</h2>' +
      '<section class="card prof">' +
        '<div class="avt">' + (e.photo ? '<img src="' + e.photo + '" alt="">' : esc(initials)) + '</div>' +
        '<h3>' + esc(e.name) + '</h3>' +
        '<p>' + esc(e.title || '') + (e.dept ? ' • ' + esc(e.dept) : '') + '</p>' +
      '</section>' +
      '<section class="card"><h3>بياناتي</h3>' +
        kv('تاريخ التعيين', e.hire) + kv('الموبايل', e.phone) + kv('الإيميل', e.email) +
        kv('العنوان', e.address) + kv('رقم التأمينات', e.insuranceNo) +
        '<p class="mu">لتعديل أي بيانات كلّم الموارد البشرية.</p>' +
      '</section>' +
      '<section class="card"><h3>مستنداتي عند الشركة</h3>' +
        Object.keys(DOCS).map(k => '<div class="req"><div><b>' + DOCS[k] + '</b></div><div class="side">' + st(k) + '</div></div>').join('') +
      '</section>' +
      '<section class="card">' +
        '<button class="btn ghost block" id="tm" style="margin-bottom:8px">' +
          (isDark ? '☀️ الوضع النهاري' : '🌙 الوضع الليلي') +
        '</button>' +
        '<button class="btn danger block" id="lo2">تسجيل الخروج</button>' +
      '</section>';

    view.querySelector('#tm').onclick = () => {
      const d = document.documentElement.getAttribute('data-theme') === 'dark';
      document.documentElement.setAttribute('data-theme', d ? 'light' : 'dark');
      localStorage.setItem('hr-emp-theme', d ? 'light' : 'dark');
      me();
    };
    view.querySelector('#lo2').onclick = () => H.mode === 'local' ? location.reload() : H.auth.logout();
  }

  /* ── التنقل ── */
  const TABS = () => [
    ['home',   'الرئيسية', 'home'],
    ['leaves', 'الإجازات', 'calendar'],
    ['slips',  'القسايم',  'wallet'],
  ].concat(ME.isManager ? [['team', 'الفريق', 'users']] : [])
   .concat([['me', 'حسابي', 'user']]);

  const PAGES = { home, leaves, slips, team, me };

  async function go() {
    const h = location.hash.slice(1), k = TABS().some(t => t[0] === h) ? h : 'home';
    nav.style.display = 'flex';
    nav.innerHTML = TABS().map(t =>
      '<a href="#' + t[0] + '" class="' + (t[0] === k ? 'on' : '') + '">' +
        ui.icon(t[2]) + '<span>' + t[1] + '</span>' +
      '</a>'
    ).join('');
    clearInterval(timer);
    try { await PAGES[k](); }
    catch (e) { view.innerHTML = '<div class="card em err">تعذر تحميل الصفحة: ' + esc(e.message) + '</div>'; }
  }

  window.addEventListener('unhandledrejection', e => ui.toast((e.reason && e.reason.message) || 'حصل خطأ'));

  (async function boot() {
    await gate();
    try { CFG = await A.config(); } catch (e) { return fatal('تعذر تحميل بياناتك', e.message, true); }
    ME = CFG.me;
    if (!ME) return fatal('حسابك مش مربوط بملف موظف', 'كلّم الموارد البشرية عشان يربطوا حسابك بملفك الوظيفي.', true);
    if (ME.status === 'terminated') return fatal('الخدمة منتهية', 'ما عادش ينفع تستخدم التطبيق.', true);
    RULES = H.payroll.merge(L.DEFAULT, CFG.leaves);
    window.addEventListener('hashchange', go);
    go();
  })();
})();
