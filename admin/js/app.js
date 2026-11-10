(function () {
  const H = window.HR, ui = H.ui;

  /* ── صفحات الـ sidebar ── */
  const NAV_HR = [
    { section: 'الرئيسية' },
    { k: 'dashboard',   label: 'لوحة التحكم',  icon: 'grid' },
    { section: 'الموارد البشرية' },
    { k: 'employees',   label: 'الموظفون',      icon: 'users' },
    { k: 'attendance',  label: 'الحضور',         icon: 'clock' },
    { k: 'leaves',      label: 'الإجازات',       icon: 'calendar' },
    { k: 'recruitment', label: 'التوظيف',        icon: 'userplus' },
    { k: 'performance', label: 'الأداء',          icon: 'star' },
    { section: 'المالية' },
    { k: 'payroll',     label: 'الرواتب',         icon: 'wallet' },
    { k: 'requests',    label: 'الطلبات',         icon: 'list' },
  ];
  const NAV_MANAGER = [
    { section: 'الرئيسية' },
    { k: 'manager',  label: 'فريقي',    icon: 'users' },
    { k: 'leaves',   label: 'الإجازات', icon: 'calendar' },
  ];
  const NAV_EMPLOYEE = [
    { section: 'بوابتي' },
    { k: 'employee', label: 'بوابتي',   icon: 'users' },
  ];
  const ADMIN_EXTRA = [
    { section: 'الإدارة' },
    { k: 'users', label: 'المستخدمون', icon: 'shield' },
    { k: 'audit', label: 'سجل التعديلات', icon: 'list' },
  ];
  const ROLE = { admin: 'مدير النظام', hr: 'موارد بشرية', manager: 'مدير قسم', employee: 'موظف' };
  const AVATAR_COLORS = ['#2563eb','#7c3aed','#0891b2','#16a34a','#d97706'];

  window.addEventListener('unhandledrejection', e => {
    ui.toast('تعذر تنفيذ العملية: ' + ((e.reason && e.reason.message) || e.reason));
  });

  /* ── Dark mode ── */
  const savedTheme = localStorage.getItem('hr-theme') || 'light';
  if (savedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

  function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('hr-theme', isDark ? 'light' : 'dark');
    renderThemeBtn();
  }
  function renderThemeBtn() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const btn = document.getElementById('theme-btn');
    if (!btn) return;
    const icon = isDark
      ? '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path stroke-linecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    btn.innerHTML = icon + '<span>' + (isDark ? 'الوضع النهاري' : 'الوضع الليلي') + '</span>';
  }

  /* ── البحث العام ── */
  let searchCache = null;
  let searchTimer = null;

  async function getSearchData() {
    if (searchCache) return searchCache;
    const [E, C, L] = await Promise.all([
      H.store.list('employees'),
      H.store.list('candidates'),
      H.store.list('leaves'),
    ]);
    searchCache = { E, C, L };
    setTimeout(() => { searchCache = null; }, 60000); // كاش لمدة دقيقة
    return searchCache;
  }

  function buildSearchBox() {
    const wrap = document.createElement('div');
    wrap.id = 'search-wrap';
    wrap.innerHTML =
      '<div class="search-box">' +
        '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>' +
        '<input id="search-inp" type="text" placeholder="بحث سريع..." autocomplete="off">' +
      '</div>' +
      '<div id="search-results" class="search-results" style="display:none"></div>';

    const inp = wrap.querySelector('#search-inp');
    const res = wrap.querySelector('#search-results');

    inp.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const q = inp.value.trim();
      if (q.length < 2) { res.style.display = 'none'; return; }
      searchTimer = setTimeout(() => doSearch(q, res), 250);
    });

    inp.addEventListener('focus', () => {
      if (inp.value.trim().length >= 2) res.style.display = 'block';
    });

    document.addEventListener('click', e => {
      if (!wrap.contains(e.target)) res.style.display = 'none';
    });

    inp.addEventListener('keydown', e => {
      if (e.key === 'Escape') { res.style.display = 'none'; inp.blur(); }
    });

    return wrap;
  }

  async function doSearch(q, res) {
    const ql = q.toLowerCase();
    const { E, C, L } = await getSearchData();

    const hits = [];

    // موظفين
    E.filter(e =>
      (e.name  || '').toLowerCase().includes(ql) ||
      (e.title || '').toLowerCase().includes(ql) ||
      (e.dept  || '').toLowerCase().includes(ql) ||
      (e.phone || '').includes(q) ||
      (e.email || '').toLowerCase().includes(ql)
    ).slice(0, 5).forEach(e => hits.push({
      type: 'موظف', icon: 'user', label: e.name,
      sub: (e.title||'') + (e.dept ? ' · ' + e.dept : ''),
      href: '#profile-' + e.id,
      color: e.status === 'terminated' ? '#dc2626' : '#2563eb'
    }));

    // مرشحين
    C.filter(c =>
      (c.name  || '').toLowerCase().includes(ql) ||
      (c.role  || '').toLowerCase().includes(ql)
    ).slice(0, 3).forEach(c => hits.push({
      type: 'مرشح', icon: 'userplus', label: c.name,
      sub: c.role || '', href: '#recruitment', color: '#0891b2'
    }));

    // إجازات
    L.filter(l =>
      (l.type || '').toLowerCase().includes(ql) ||
      (l.from || '').includes(q)
    ).slice(0, 2).forEach(l => {
      const emp = (H._empCache || []).find(e => e.id === l.empId);
      hits.push({
        type: 'إجازة', icon: 'calendar', label: emp ? emp.name : 'موظف',
        sub: l.type + ' · ' + l.from, href: '#leaves', color: '#16a34a'
      });
    });

    if (!hits.length) {
      res.innerHTML = '<div class="sr-empty">لا توجد نتائج لـ "' + ui.esc(q) + '"</div>';
    } else {
      res.innerHTML = hits.map(h =>
        '<a class="sr-item" href="' + h.href + '">' +
          '<div class="sr-icon" style="background:' + h.color + '20;color:' + h.color + '">' +
            ui.icon(h.icon) +
          '</div>' +
          '<div class="sr-info">' +
            '<b>' + ui.esc(h.label) + '</b>' +
            (h.sub ? '<small>' + ui.esc(h.sub) + '</small>' : '') +
          '</div>' +
          '<span class="sr-type">' + h.type + '</span>' +
        '</a>'
      ).join('');
    }

    res.style.display = 'block';

    res.querySelectorAll('a').forEach(a => {
      a.onclick = () => {
        res.style.display = 'none';
        document.getElementById('search-inp').value = '';
        searchCache = null;
      };
    });
  }

  function start() {
    const role = H.user.role;
    const allNav = role === 'employee'
      ? NAV_EMPLOYEE
      : role === 'manager'
        ? NAV_MANAGER
        : role === 'admin'
          ? [...NAV_HR, ...ADMIN_EXTRA]
          : NAV_HR; // hr
    const keys   = allNav.filter(n => n.k).map(n => n.k);
    const nav    = document.getElementById('nav');
    const root   = document.getElementById('root');

    /* ── Sidebar nav ── */
    nav.innerHTML = allNav.map(n => {
      if (n.section) return '<div class="nav-sec">' + n.section + '</div>';
      return '<a data-k="' + n.k + '" href="#' + n.k + '">' +
        ui.icon(n.icon) +
        '<span>' + n.label + '</span>' +
        (n.k === 'leaves' ? '<span id="lv-badge" class="badge" style="display:none"></span>' : '') +
      '</a>';
    }).join('');

    /* ── البحث العام في الـ sidebar ── */
    const searchWrap = buildSearchBox();
    nav.parentNode.insertBefore(searchWrap, nav);

    /* ── User chip ── */
    const chip = document.getElementById('user-chip');
    if (chip) {
      const c = AVATAR_COLORS[H.user.name.length % AVATAR_COLORS.length];
      chip.innerHTML =
        '<span class="av" style="width:30px;height:30px;border-radius:50%;background:' + c + ';display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:12px;flex-shrink:0">' +
          (H.user.name||'?').trim()[0] +
        '</span>' +
        '<div style="min-width:0">' +
          '<div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + ui.esc(H.user.name) + '</div>' +
          '<small style="color:var(--mu);font-size:11px">' + (ROLE[H.user.role] || H.user.role) + '</small>' +
        '</div>' +
        '<button class="btn ghost sm" id="logout-btn" style="margin-right:auto;flex-shrink:0">خروج</button>';
      chip.querySelector('#logout-btn').onclick = () => H.auth.logout();

      /* زر Backup */
      const bkBtn = document.createElement('button');
      bkBtn.className = 'btn ghost sm';
      bkBtn.style.cssText = 'width:100%;margin-top:8px;justify-content:center';
      bkBtn.innerHTML = '💾 نسخة احتياطية';
      bkBtn.onclick = () => HR.backup.show();
      chip.parentNode.appendChild(bkBtn);
    }

    /* ── Theme btn ── */
    renderThemeBtn();
    document.getElementById('theme-btn').onclick = toggleTheme;

    /* ── Burger menu (mobile) ── */
    const top = document.getElementById('top');
    if (top) {
      top.innerHTML =
        '<button id="burger">' +
          ui.icon('menu') +
        '</button>' +
        '<span id="top-title"></span>' +
        '<span style="flex:1"></span>';
      document.getElementById('burger').onclick = () => {
        document.getElementById('sidebar').classList.toggle('open');
      };
      /* زر الإشعارات */
      if (HR.notifications) HR.notifications.init();
    }

    /* ── Badge الإجازات ── */
    async function updateBadge() {
      try {
        const L = await H.store.list('leaves');
        const n = L.filter(l => l.status === 'معلقة').length;
        const badge = document.getElementById('lv-badge');
        if (badge) {
          badge.textContent = n || '';
          badge.style.display = n ? 'inline-flex' : 'none';
        }
      } catch (_) {}
    }

    /* ── Router ── */
    async function go() {
      const h = location.hash.slice(1);
      const pm = /^profile-([a-z0-9-]+)$/.exec(h);
      const k = pm ? 'employees' : (keys.indexOf(h) > -1 ? h : keys[0]);
      if (k !== 'payroll') H.state.pview = 'run';
      if (k !== 'leaves')  H.state.lview = 'req';

      /* active link */
      nav.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.k === k));

      /* topbar title */
      const page = H.pages[k];
      const titleEl = document.getElementById('top-title');
      if (titleEl && page) titleEl.textContent = page.title;

      /* render */
      const sec = document.createElement('section');
      root.replaceChildren(sec);
      try {
        await (pm ? H.pages.profile.render(sec, pm[1]) : page.render(sec));
      } catch (e) {
        sec.innerHTML = '<div class="card em">خطأ في تحميل الصفحة: ' + ui.esc(e.message) + '</div>';
        console.error(e);
      }
      updateBadge();

      /* ── Lazy photo resolver (global - يشتغل في كل الصفحات) ── */
      root.querySelectorAll('img.lazy-photo').forEach(async img => {
        const ref = img.dataset.photo;
        if (!ref) return;
        if (ref.startsWith('data:') || ref.startsWith('http')) { img.src = ref; return; }
        try {
          const url = H.files.photoUrl ? await H.files.photoUrl(ref) : ref;
          if (url) img.src = url;
        } catch (_) { img.style.display = 'none'; }
      });


      if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
    }

    H.refresh = async function () { const y = window.scrollY; await go(); window.scrollTo(0, y); };
    window.addEventListener('hashchange', () => { go(); window.scrollTo(0, 0); });
    go();
  }

  /* ── Splash ── */
  const sp = document.getElementById('splash');
  requestAnimationFrame(() => sp.classList.add('open'));
  setTimeout(() => sp.remove(), 1600);
  H.gate().then(start);
})();
