(function () {
  const H = window.HR, ui = H.ui, A = H.api, esc = ui.esc, L = H.leaves;
  const view = document.getElementById('view'), nav = document.getElementById('nav');
  let CFG, ME, RULES, timer;
  const screen = html => { clearInterval(timer); nav.style.display = 'none'; view.innerHTML = html; window.scrollTo(0, 0); };
  const brand = '<div class="brand"><i>HR</i><b>CLEO HR</b></div>';
  const fatal = (title, msg, out) => screen('<div class="auth card">' + brand + '<h2>' + title + '</h2><p class="lm err">' + esc(msg) + '</p>' + (out ? '<button class="btn" id="lo">تسجيل الخروج</button>' : '<button class="btn" onclick="location.reload()">إعادة المحاولة</button>') + '</div>') || (out && (view.querySelector('#lo').onclick = () => H.mode === 'local' ? location.reload() : H.auth.logout()));
  const DOCS = { id: 'صورة البطاقة', birth: 'شهادة الميلاد', edu: 'المؤهل الدراسي', crim: 'الفيش الجنائي', mil: 'موقف التجنيد', contract: 'عقد العمل', med: 'الكشف الطبي', photo: 'صور شخصية' };
  const hm = () => new Date().toTimeString().slice(0, 5);
  const mins = t => { const a = String(t || '').split(':'); return a.length < 2 ? 0 : +a[0] * 60 + +a[1]; };
  const dur = m => { m = Math.max(0, Math.round(m)); return Math.floor(m / 60) + ' س ' + (m % 60) + ' د'; };

  /* ── Dark mode ── */
  const savedTheme = localStorage.getItem('hr-emp-theme') || 'light';
  if (savedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

  /* ── Offline banner ── */
  (function setupOffline() {
    let bar = document.getElementById('offline-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'offline-bar';
      bar.textContent = '⚠️ لا يوجد اتصال بالإنترنت — بعض الميزات قد لا تعمل';
      document.body.prepend(bar);
    }
    const update = () => bar.classList.toggle('show', !navigator.onLine);
    window.addEventListener('online',  update);
    window.addEventListener('offline', update);
    update();
  })();


  /* ── [A] Push Notifications ── */
  const PUSH_PUBLIC_KEY = ''; /* أضف VAPID public key هنا */

  async function registerPush() {
    if (!('PushManager' in window) || !navigator.serviceWorker) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) return;
      if (Notification.permission === 'denied') return;
      if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return;
      }
      if (!PUSH_PUBLIC_KEY) return;
      const appSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8(PUSH_PUBLIC_KEY)
      });
      await H.api.savePushSub(ME.id, JSON.parse(JSON.stringify(appSub)));
    } catch (_) {}
  }

  function urlBase64ToUint8(b64) {
    const pad = '='.repeat((4 - b64.length % 4) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  /* ── [B] Offline IndexedDB cache ── */
  const IDB_NAME = 'cleo-offline', IDB_VER = 1;
  let _idb = null;

  function openIDB() {
    if (_idb) return Promise.resolve(_idb);
    return new Promise(function(res, rej) {
      const req = indexedDB.open(IDB_NAME, IDB_VER);
      req.onupgradeneeded = function(e) {
        const db = e.target.result;
        ['attendance','leaves','slips','requests'].forEach(function(s) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
        });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
      };
      req.onsuccess = function(e) { _idb = e.target.result; res(_idb); };
      req.onerror   = function(e) { rej(e.target.error); };
    });
  }

  async function idbSave(storeName, items) {
    try {
      const db = await openIDB();
      return new Promise(function(res, rej) {
        const tx = db.transaction(storeName, 'readwrite');
        const s  = tx.objectStore(storeName);
        s.clear();
        items.forEach(function(i) { s.put(i); });
        tx.oncomplete = res; tx.onerror = function(e) { rej(e.target.error); };
      });
    } catch (_) {}
  }

  async function idbLoad(storeName) {
    try {
      const db = await openIDB();
      return new Promise(function(res, rej) {
        const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
        req.onsuccess = function(e) { res(e.target.result || []); };
        req.onerror   = function(e) { rej(e.target.error); };
      });
    } catch (_) { return []; }
  }

  async function idbSetMeta(key, val) {
    try { const db = await openIDB(); const tx = db.transaction('meta','readwrite'); tx.objectStore('meta').put({ k: key, v: val }); } catch (_) {}
  }
  /* ── [تحسين #7] Badge cache — مرة كل دقيقة بدل كل navigation ── */
  let _badgeCache = null, _badgeAt = 0;
  async function getBadges() {
    if (_badgeCache && Date.now() - _badgeAt < 60000) return _badgeCache;
    try {
      const [lv, rq] = await Promise.all([A.leaves(ME.id), A.myRequests(ME.id)]);
      _badgeCache = {
        leaves: lv.filter(l => l.status === 'معلقة').length,
        reqs:   rq.filter(r => r.status === 'معلقة').length
      };
      _badgeAt = Date.now();
    } catch (_) { _badgeCache = _badgeCache || { leaves: 0, reqs: 0 }; }
    return _badgeCache;
  }
  function invalidateBadges() { _badgeCache = null; }

  /* ── [تحسين #8] Config cache في sessionStorage ── */
  function loadCachedConfig() {
    try {
      const raw = sessionStorage.getItem('hr-cfg');
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > 5 * 60 * 1000) return null; /* منتهي بعد 5 دقايق */
      return data;
    } catch (_) { return null; }
  }
  function saveCachedConfig(cfg) {
    try { sessionStorage.setItem('hr-cfg', JSON.stringify({ ts: Date.now(), data: cfg })); } catch (_) {}
  }

  /* ── [تحسين #1] Skeleton loader ── */
  const SKEL = '<div class="skel-card"></div><div class="skel-card"></div><div class="skel-card sm"></div>';
  function showSkeleton() { view.innerHTML = '<div class="skel-wrap">' + SKEL + '</div>'; }

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

  /* ── منع إطفاء الشاشة أثناء تسجيل الحضور ── */
  let wakeLock = null;
  async function acquireWakeLock() {
    if ('wakeLock' in navigator) {
      try { wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}
    }
  }
  function releaseWakeLock() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }

  /* ── [تحسين #2] Pull-to-refresh ── */
  (function setupPullToRefresh() {
    let startY = 0, pulling = false;
    document.addEventListener('touchstart', e => { startY = e.touches[0].clientY; pulling = window.scrollY === 0; }, { passive: true });
    document.addEventListener('touchend', e => {
      if (!pulling) return;
      const dy = e.changedTouches[0].clientY - startY;
      if (dy > 80) { invalidateBadges(); go(); ui.toast('🔄 جاري التحديث...'); }
      pulling = false;
    }, { passive: true });
  })();

  /* ── الرئيسية ── */
  async function home() {
    showSkeleton();
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

    /* [J] تذكير الانصراف — لو الساعة 6+ والموظف سجل حضور بس ما سجلش انصراف */
    if (new Date().getHours() >= 18 && rec.in && !rec.out) {
      setTimeout(() => ui.toast('⏰ لسه ما سجلتش انصرافك — اضغط "انصراف" دلوقتي'), 1500);
    }

    /* [تحسين #5] تذكير الحضور */
    const reminderHtml = (hour >= 8 && hour < 10 && state === 'in')
      ? '<div class="remind-bar">⏰ لسه ما سجلتش حضورك — اضغط التسجيل دلوقتي</div>'
      : '';

    const typeIcon = { general:'📢', holiday:'🎉', urgent:'🚨', event:'📅' };
    const annHtml = ann.length
      ? ann.map(a => '<div class="ann-bar' + (a.type==='urgent'?' urgent':'') + '">' +
          (typeIcon[a.type]||'📢') + ' <b>' + esc(a.title) + '</b>' +
          (a.body ? ' — ' + esc(a.body.slice(0,80)) : '') +
        '</div>').join('')
      : '';

    view.innerHTML =
      annHtml +
      reminderHtml +
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

      /* [تحسين #4] Mini attendance calendar */
      '<section class="card"><h3 style="margin:0 0 10px">الشهر ده</h3><div class="att-cal" id="att-cal">' +
        (function() {
          const days = new Date(mo.slice(0,4), mo.slice(5,7), 0).getDate();
          let html = '';
          for (let d = 1; d <= days; d++) {
            const ds = mo + '-' + String(d).padStart(2,'0');
            const a  = att.find(x => x.date === ds);
            const cls = ds > td ? 'future' : a && a.in ? 'present' : 'absent';
            html += '<span class="cal-dot ' + cls + '" title="' + ds + '">' + d + '</span>';
          }
          return html;
        })() +
      '</div></section>' +

      /* Stats */
      '<section class="grid2">' +
        '<div class="card stat">' +
          '<div class="stat-ic" style="background:#2a1a0a;color:#c9933a">' + ui.icon('clock') + '</div>' +
          '<span>أيام حضوري هذا الشهر</span><b>' + present + '</b>' +
        '</div>' +
        '<div class="card stat">' +
          '<div class="stat-ic" style="background:#052e16;color:#4ade80">' + ui.icon('calendar') + '</div>' +
          '<span>رصيد ' + esc(mt ? mt.name : 'الإجازة') + '</span>' +
          '<b>' + (mb && !mb.unlimited ? mb.remaining : '—') + '</b>' +
        '</div>' +
        '<div class="card stat">' +
          '<div class="stat-ic" style="background:#2a1500;color:#e8b87a">' + ui.icon('list') + '</div>' +
          '<span>طلبات معلقة</span><b>' + pend + '</b>' +
        '</div>' +
        '<a class="card stat lnk" href="#slips">' +
          '<div class="stat-ic" style="background:#1a0a3e;color:#c084fc">' + ui.icon('wallet') + '</div>' +
          '<span>قسيمة الراتب</span><b>عرض ›</b>' +
        '</a>' +
      '</section>';

    clearInterval(timer);
    timer = setInterval(() => {
      const c = document.getElementById('clk'); if (c) c.textContent = hm();
      const e = document.getElementById('el'); if (e && rec.in) e.textContent = dur(mins(hm()) - mins(rec.in));
    }, 1000);

    view.querySelectorAll('[data-pos]').forEach(b => { b.onclick = () => { H.state.demoPos = b.dataset.pos; home(); }; });
    const pb = view.querySelector('#pb');
    if (pb) pb.onclick = () => {
      navigator.vibrate && navigator.vibrate(80);
      punch(pb.dataset.k, restricted);
    };
  }

  async function punch(kind, restricted) {
    const btn = view.querySelector('#pb'), msg = view.querySelector('#pm');
    btn.disabled = true; msg.className = 'pm'; msg.textContent = restricted ? 'جاري تحديد موقعك...' : 'جاري التسجيل...';
    if (restricted) await acquireWakeLock();
    try {
      const pos = restricted ? await getPos() : {}; msg.textContent = 'جاري التسجيل...';
      const r = await (kind === 'in' ? A.checkIn(pos) : A.checkOut(pos));
      navigator.vibrate && navigator.vibrate([80, 40, 80]);
      ui.toast((kind === 'in' ? '✅ تم تسجيل الحضور ' : '👋 تم تسجيل الانصراف ') + r.time + (r.site ? ' • ' + r.site : ''));
      releaseWakeLock();
      invalidateBadges();
      go();
    } catch (e) { btn.disabled = false; msg.className = 'pm err'; msg.textContent = e.message; releaseWakeLock(); }
  }

  /* ── الإجازات ── */
  async function leaves() {
    showSkeleton();
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
        try { await A.cancelLeave(b.dataset.c); invalidateBadges(); ui.toast('تم إلغاء الطلب'); leaves(); }
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
        invalidateBadges(); m.close(); ui.toast('✅ تم إرسال الطلب'); leaves();
      } catch (e) { btn.disabled = false; ui.toast(e.message); }
    };
  }

  /* ── [تحسين #6] القسايم — عرض محسّن PDF-style ── */
  async function slips() {
    showSkeleton();
    let rows;
    try {
      rows = await A.payslips();
      idbSave('slips', rows.map((r,i) => Object.assign({id: r.month||String(i)}, r)));
    } catch (_) {
      rows = navigator.onLine ? [] : await idbLoad('slips');
    }
    view.innerHTML = '<h2 class="pt">قسايم الرواتب</h2>' +
      (rows.length
        ? rows.map((p, i) => {
            const c = p.data.calc || {};
            return '<div class="card slip-card" data-i="' + i + '">' +
              '<div class="slip-head">' +
                '<div>' +
                  '<b>' + p.month + '</b>' +
                  '<span class="tag ' + (p.status === 'paid' ? 'ok' : 'wa') + '">' + (p.status === 'paid' ? 'مصروف' : 'معتمد') + '</span>' +
                '</div>' +
                '<div class="slip-net">' + ui.money(c.net) + '</div>' +
              '</div>' +
              '<div class="slip-rows">' +
                '<div class="slip-row"><span>الراتب الأساسي</span><b>' + ui.money(c.base) + '</b></div>' +
                (c.allowances ? '<div class="slip-row"><span>البدلات</span><b>+ ' + ui.money(c.allowances) + '</b></div>' : '') +
                (c.bonus ? '<div class="slip-row ok"><span>المكافأة</span><b>+ ' + ui.money(c.bonus) + '</b></div>' : '') +
                (c.ot ? '<div class="slip-row ok"><span>أوفر تايم</span><b>+ ' + ui.money(c.ot) + '</b></div>' : '') +
                (c.deductions ? '<div class="slip-row da"><span>الخصومات</span><b>- ' + ui.money(c.deductions) + '</b></div>' : '') +
                (c.loan_deduct ? '<div class="slip-row da"><span>قسط السلفة</span><b>- ' + ui.money(c.loan_deduct) + '</b></div>' : '') +
                '<div class="slip-row total"><span>الصافي</span><b>' + ui.money(c.net) + '</b></div>' +
              '</div>' +
              '<button class="btn ghost block" style="margin-top:8px" data-print="' + i + '">🖨️ طباعة القسيمة</button>' +
            '</div>';
          }).join('')
        : '<div class="card em">لسه مفيش قسايم معتمدة. القسيمة بتظهر هنا بعد ما الموارد البشرية تعتمد الشهر.</div>');

    view.querySelectorAll('[data-print]').forEach(b => {
      b.onclick = () => {
        const p = rows[+b.dataset.print];
        H.payrollTools.printSlips([{ name: ME.name, dept: ME.dept, title: ME.title, calc: p.data.calc }], p.month, CFG.company, 'قسيمة راتب ' + p.month);
      };
    });
  }

  /* ── الفريق (للمدير المباشر) ── */
  async function team() {
    showSkeleton();
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
        if (b.dataset.a === 'no') {
          why = await new Promise(res => {
            const mo = document.createElement('div'); mo.className = 'mo';
            mo.innerHTML = '<div class="md"><h3>سبب الرفض</h3><div class="mb"><label style="display:block;margin-bottom:8px;font-weight:600">اكتب سبب الرفض</label><textarea id="rej-why" rows="3" style="width:100%;padding:8px 12px;border-radius:8px;border:1.5px solid var(--ln);font:inherit;background:var(--sf);color:var(--tx)" placeholder="مثال: لا يوجد تغطية كافية..."></textarea><div class="acts" style="margin-top:12px"><button class="btn danger" id="rej-ok">تأكيد الرفض</button><button class="btn ghost" id="rej-no">إلغاء</button></div></div></div>';
            document.body.appendChild(mo);
            mo.querySelector('#rej-ok').onclick = () => { const v = mo.querySelector('#rej-why').value.trim(); if (!v) { mo.querySelector('#rej-why').style.border = '1.5px solid #ef4444'; return; } mo.remove(); res(v); };
            mo.querySelector('#rej-no').onclick = () => { mo.remove(); res(null); };
            mo.addEventListener('mousedown', e => { if (e.target === mo) { mo.remove(); res(null); } });
            setTimeout(() => mo.querySelector('#rej-why').focus(), 100);
          });
          if (!why || !why.trim()) return;
        }
        b.disabled = true;
        try {
          await A.decide(id, b.dataset.a === 'ok', why);
          ui.toast(b.dataset.a === 'ok' ? '✅ تمت الموافقة، الطلب راح للموارد البشرية' : 'تم الرفض');
          invalidateBadges();
          team();
        } catch (e) { b.disabled = false; ui.toast(e.message); }
      };
    });
  }

  /* ── حسابي ── */
  async function me() {
    showSkeleton();
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
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    /* تحويل مسار الصورة لـ signed URL */
    let photoSrc = null;
    if (e.photo) {
      photoSrc = H.files && H.files.photoUrl
        ? await H.files.photoUrl(e.photo).catch(() => null)
        : e.photo;
    }
    const avtHtml = photoSrc
      ? '<img src="' + photoSrc + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block">'
      : esc(initials);

    view.innerHTML = '<h2 class="pt">حسابي</h2>' +
      '<section class="card prof">' +
        '<div class="avt">' + avtHtml + '</div>' +
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

  /* ── الطلبات ── */
  async function requests() {
    showSkeleton();
    const td = ui.today();
    const reqs = await A.myRequests(ME.id);
    const tab  = H.state.reqTab || 'loan';

    const tabs = [
      { k: 'loan',     ic: '💰', label: 'سلفة' },
      { k: 'overtime', ic: '⏰', label: 'أوفر تايم' },
      { k: 'change',   ic: '📝', label: 'تغيير بيانات' },
    ];
    const rows = reqs.filter(r => r.type === tab);

    const stTag = s => ({
      'معلقة':       '<span class="tag wa">' + s + '</span>',
      'موافق عليها': '<span class="tag ok">' + s + '</span>',
      'مرفوضة':      '<span class="tag da">' + s + '</span>',
    }[s] || '<span class="tag">' + s + '</span>');

    const rowHtml = r => {
      if (tab === 'loan') return (
        '<div class="req">' +
          '<div>' +
            '<b>' + ui.money(r.amount) + '</b>' +
            '<small>على ' + (r.months || '—') + ' شهر · قسط ' + ui.money(Math.round((r.amount||0)/(r.months||1))) + '</small>' +
            (r.reason ? '<small>' + esc(r.reason) + '</small>' : '') +
            (r.hrNote ? '<small class="errt">HR: ' + esc(r.hrNote) + '</small>' : '') +
          '</div>' +
          '<div class="side">' + stTag(r.status) + '</div>' +
        '</div>'
      );
      if (tab === 'overtime') return (
        '<div class="req">' +
          '<div>' +
            '<b>' + (r.hours || 0) + ' ساعة</b>' +
            '<small>' + (r.date || '') + '</small>' +
            (r.note ? '<small>' + esc(r.note) + '</small>' : '') +
            (r.hrNote ? '<small class="errt">HR: ' + esc(r.hrNote) + '</small>' : '') +
          '</div>' +
          '<div class="side">' + stTag(r.status) + '</div>' +
        '</div>'
      );
      if (tab === 'change') {
        const fl = { phone: 'الهاتف', bank: 'البنك', email: 'الإيميل', address: 'العنوان', other: 'أخرى' };
        return (
          '<div class="req">' +
            '<div>' +
              '<b>' + (fl[r.field] || r.field || '') + '</b>' +
              '<small>' + esc(r.newValue || '') + '</small>' +
              (r.hrNote ? '<small class="errt">HR: ' + esc(r.hrNote) + '</small>' : '') +
            '</div>' +
            '<div class="side">' + stTag(r.status) + '</div>' +
          '</div>'
        );
      }
      return '';
    };

    const btnLabel = { loan: '+ طلب سلفة', overtime: '+ أوفر تايم', change: '+ تغيير بيانات' };

    view.innerHTML =
      '<h2 class="pt">طلباتي</h2>' +
      '<div class="seg">' +
        tabs.map(t =>
          '<button class="seg-btn' + (t.k === tab ? ' on' : '') + '" data-t="' + t.k + '">' +
            t.ic + ' ' + t.label +
          '</button>'
        ).join('') +
      '</div>' +
      '<button class="btn block" id="new-req" style="margin:12px 0">' + btnLabel[tab] + '</button>' +
      '<section class="card">' +
        (rows.length
          ? rows.map(rowHtml).join('')
          : '<p class="mu" style="text-align:center;padding:16px">لا توجد طلبات</p>') +
      '</section>';

    view.querySelectorAll('[data-t]').forEach(b => {
      b.onclick = () => { H.state.reqTab = b.dataset.t; requests(); };
    });

    view.querySelector('#new-req').onclick = async () => {
      if (tab === 'loan') {
        const o = await ui.form('💰 طلب سلفة', [
          { n: 'amount', l: 'المبلغ المطلوب',   t: 'number', req: 1 },
          { n: 'months', l: 'السداد على (شهور)', t: 'number', req: 1 },
          { n: 'reason', l: 'سبب الطلب',        req: 1 }
        ]);
        if (!o) return;
        if (+o.amount <= 0 || +o.months <= 0) return ui.toast('تحقق من المبلغ وعدد الأشهر');
        await A.createRequest({ type: 'loan', empId: ME.id, amount: +o.amount, months: +o.months, reason: o.reason });
        invalidateBadges(); ui.toast('✅ تم رفع طلب السلفة'); requests();
      } else if (tab === 'overtime') {
        const o = await ui.form('⏰ أوفر تايم', [
          { n: 'date',  l: 'التاريخ',       t: 'date',   req: 1 },
          { n: 'hours', l: 'عدد الساعات',   t: 'number', req: 1 },
          { n: 'note',  l: 'السبب / التفاصيل', req: 1 }
        ], { date: td });
        if (!o) return;
        if (+o.hours <= 0) return ui.toast('عدد الساعات لازم يكون أكبر من صفر');
        await A.createRequest({ type: 'overtime', empId: ME.id, date: o.date, hours: +o.hours, note: o.note });
        invalidateBadges(); ui.toast('✅ تم رفع طلب الأوفر تايم'); requests();
      } else if (tab === 'change') {
        const o = await ui.form('📝 تغيير بيانات', [
          { n: 'field', l: 'الحقل', opts: [
            ['phone','الهاتف'], ['bank','الحساب البنكي'],
            ['email','الإيميل'], ['address','العنوان'], ['other','أخرى']
          ], req: 1 },
          { n: 'newValue', l: 'القيمة الجديدة', req: 1 },
          { n: 'note',     l: 'ملاحظات' }
        ]);
        if (!o) return;
        await A.createRequest({ type: 'change', empId: ME.id, field: o.field, newValue: o.newValue, note: o.note });
        invalidateBadges(); ui.toast('✅ تم رفع طلب تغيير البيانات'); requests();
      }
    };
  }


  /* ── [H] صفحة الإشعارات ── */
  async function inbox() {
    showSkeleton();
    let msgs = [];
    try { msgs = await A.inbox(); } catch (_) { msgs = []; }

    const unread = msgs.filter(m => !m.read).length;
    const icon = t => t === 'payroll' ? '💰' : t === 'leave' ? '🏖️' : t === 'system' ? '⚙️' : '📬';
    const color = t => t === 'payroll' ? '#c9933a' : t === 'leave' ? '#16a34a' : '#7c3aed';

    view.innerHTML =
      '<h2 class="pt">الإشعارات' + (unread ? ' <span class="nav-badge" style="position:static;margin-right:6px">' + unread + '</span>' : '') + '</h2>' +
      (msgs.length === 0
        ? '<section class="card"><p class="mu" style="text-align:center;padding:24px">لا توجد إشعارات</p></section>'
        : msgs.map(m =>
            '<div class="req notif-item' + (m.read ? '' : ' notif-unread') + '" data-id="' + m.id + '" data-url="' + esc(m.url||'#') + '">' +
              '<div class="notif-ic" style="background:' + color(m.type) + '15;color:' + color(m.type) + '">' + icon(m.type) + '</div>' +
              '<div>' +
                '<b>' + esc(m.title) + '</b>' +
                '<small>' + esc(m.body || '') + '</small>' +
                '<small class="mu">' + (m.createdAt||m.created_at||'').slice(0,10) + '</small>' +
              '</div>' +
            '</div>'
          ).join(''));

    /* تحديد كمقروء + انتقال */
    view.querySelectorAll('.notif-item').forEach(el => {
      el.onclick = async () => {
        const id = el.dataset.id, url = el.dataset.url;
        if (!el.classList.contains('notif-unread')) { if (url && url !== '#') { location.hash = url.replace('#',''); } return; }
        el.classList.remove('notif-unread');
        try { await A.markRead(id); invalidateBadges(); } catch (_) {}
        if (url && url !== '#') location.hash = url.replace('#','');
      };
    });
  }
  /* ── Nav مع badge cache ── */
  const TABS = () => [
    ['home',     'الرئيسية', 'home'],
    ['leaves',   'الإجازات', 'calendar'],
    ['requests', 'الطلبات',  'list'],
    ['slips',    'القسايم',  'wallet'],
    ['inbox',    'إشعاراتي', 'bell'],
  ].concat(ME.isManager ? [['team', 'الفريق', 'users']] : [])
   .concat([['me', 'حسابي', 'user']]);

  const PAGES = { home, leaves, requests, slips, inbox, team, me };

  async function go() {
    const h = location.hash.slice(1), k = TABS().some(t => t[0] === h) ? h : 'home';
    nav.style.display = 'flex';

    /* [تحسين #7] badge من cache — مرة كل دقيقة */
    const badges = await getBadges();

    nav.innerHTML = TABS().map(t => {
      let badge = '';
      if (t[0] === 'leaves'   && badges.leaves) badge = '<span class="nav-badge">' + badges.leaves + '</span>';
      if (t[0] === 'requests' && badges.reqs)   badge = '<span class="nav-badge">' + badges.reqs + '</span>';
      if (t[0] === 'inbox' && CFG && CFG.inboxUnread) badge = '<span class="nav-badge">' + CFG.inboxUnread + '</span>';
      return '<a href="#' + t[0] + '" class="' + (t[0] === k ? 'on' : '') + '">' +
        ui.icon(t[2]) + badge + '<span>' + t[1] + '</span>' +
      '</a>';
    }).join('');

    clearInterval(timer);
    try { await PAGES[k](); }
    catch (e) { view.innerHTML = '<div class="card em err">تعذر تحميل الصفحة: ' + esc(e.message) + '</div>'; }
  }

  window.addEventListener('error', ev => {
    try {
      H.api && H.api.logError && H.api.logError('employee-app', ev.message || '', ev.error ? ev.error.stack : '', location.href);
    } catch (_) {}
  });

  window.addEventListener('unhandledrejection', e => {
    try {
      H.api && H.api.logError && H.api.logError('employee-app', (e.reason && e.reason.message) || String(e.reason), '', location.href);
    } catch (_) {}
    ui.toast((e.reason && e.reason.message) || 'حصل خطأ');
  });

  (async function boot() {
    await gate();

    /* [تحسين #8] جرّب الـ cache الأول */
    CFG = loadCachedConfig();
    if (!CFG) {
      try { CFG = await A.config(); saveCachedConfig(CFG); }
      catch (e) { return fatal('تعذر تحميل بياناتك', e.message, true); }
    }

    /* [G] version check */
    const APP_VERSION = '1.4';
    if (CFG.version && CFG.version !== APP_VERSION) {
      const cached = loadCachedConfig();
      if (cached && cached.version !== CFG.version) {
        sessionStorage.removeItem('hr-cfg');
        ui.toast('🔄 يوجد تحديث — سيتم التحديث تلقائياً');
        setTimeout(() => location.reload(true), 1500);
        return;
      }
    }

    /* inbox badge — عرض في الـ nav */
    if (CFG.inboxUnread > 0) {
      setTimeout(() => ui.toast('📬 لديك ' + CFG.inboxUnread + ' إشعار غير مقروء'), 2000);
    }

    ME = CFG.me;
    if (!ME) return fatal('حسابك مش مربوط بملف موظف', 'كلّم الموارد البشرية عشان يربطوا حسابك بملفك الوظيفي.', true);
    if (ME.status === 'terminated') return fatal('الخدمة منتهية', 'ما عادش ينفع تستخدم التطبيق.', true);
    RULES = H.payroll.merge(L.DEFAULT, CFG.leaves);
    window.addEventListener('hashchange', go);
    go();
    if (ME && !H.user.demo) registerPush();
  })();
})();


