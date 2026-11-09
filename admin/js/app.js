(function () {
  const H = window.HR, ui = H.ui;

  /* ── صفحات الـ sidebar ── */
  const NAV = [
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
  ];
  const ADMIN_EXTRA = [
    { section: 'الإدارة' },
    { k: 'users', label: 'المستخدمون', icon: 'shield' },
    { k: 'audit', label: 'سجل التعديلات', icon: 'list' },
  ];
  const ROLE = { admin: 'مدير النظام', hr: 'موارد بشرية' };
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

  function start() {
    const allNav = H.user.role === 'admin' ? [...NAV, ...ADMIN_EXTRA] : NAV;
    const keys = allNav.filter(x => x.k).map(x => x.k);

    const nav   = document.getElementById('nav');
    const top   = document.getElementById('top');
    const root  = document.getElementById('root');
    const chip  = document.getElementById('user-chip');
    const thBtn = document.getElementById('theme-btn');

    /* ── Sidebar nav ── */
    nav.innerHTML = allNav.map(x => {
      if (x.section) return '<div class="nav-section">' + x.section + '</div>';
      return '<a href="#' + x.k + '" data-k="' + x.k + '">' + ui.icon(x.icon) + '<span>' + x.label + '</span></a>';
    }).join('');

    /* ── User chip ── */
    const initials = (H.user.name || 'م').trim()[0];
    const avatarColor = AVATAR_COLORS[initials.charCodeAt(0) % AVATAR_COLORS.length];
    chip.innerHTML =
      '<span class="av" style="background:' + avatarColor + ';width:34px;height:34px;font-size:13px">' + ui.esc(initials) + '</span>' +
      '<div><b>' + ui.esc(H.user.name) + '</b><small>' + (ROLE[H.user.role] || '') + '</small></div>';

    /* ── Topbar ── */
    top.innerHTML =
      '<button class="icon-btn" id="menu-btn" title="القائمة">' +
        '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16"/></svg>' +
      '</button>' +
      '<span class="top-title" id="top-title">لوحة التحكم</span>' +
      '<div class="sp"></div>' +
      '<div class="srch">' + ui.icon('search') + '<input id="sr" placeholder="ابحث عن موظف..." autocomplete="off"><div id="sres"></div></div>' +
      '<div class="sp"></div>' +
      (H.mode === 'local' ? '<span class="tag wa mode-badge">وضع تجريبي</span>' : '') +
      (H.user.demo ? '' : '<button class="btn ghost sm" id="lo">خروج</button>');

    /* ── Wire up events ── */
    document.getElementById('lo') && (document.getElementById('lo').onclick = () => H.auth.logout());
    thBtn && (thBtn.onclick = toggleTheme);
    renderThemeBtn();

    document.getElementById('menu-btn').onclick = () => {
      document.getElementById('sidebar').classList.toggle('open');
    };

    /* search */
    const sr = document.getElementById('sr'), res = document.getElementById('sres');
    sr.oninput = ui.debounce(async () => {
      const v = sr.value.trim(); if (!v) { res.style.display = 'none'; return; }
      const E = (await H.store.list('employees')).filter(e => (e.name + e.title + e.dept).includes(v)).slice(0, 6);
      res.innerHTML = E.length
        ? E.map(e => '<div data-n="' + ui.esc(e.name) + '">' + ui.who(e) + '</div>').join('')
        : '<div>لا توجد نتائج</div>';
      res.style.display = 'block';
    }, 250);
    res.onmousedown = e => {
      const d = e.target.closest('[data-n]'); if (!d) return;
      H.state.q = d.dataset.n; sr.value = ''; res.style.display = 'none';
      if (location.hash === '#employees') H.refresh(); else location.hash = 'employees';
    };
    sr.onblur = () => setTimeout(() => res.style.display = 'none', 150);

    /* pending badge */
    async function updateBadge() {
      const L = await H.store.list('leaves').catch(() => []);
      const n = L.filter(l => l.status === 'معلقة').length;
      nav.querySelectorAll('[data-k="leaves"] .nb').forEach(el => el.remove());
      const leavesLink = nav.querySelector('[data-k="leaves"]');
      if (leavesLink && n > 0) leavesLink.insertAdjacentHTML('beforeend', '<span class="nb">' + n + '</span>');
    }
    updateBadge();

    /* ── Router ── */
    async function go() {
      const h = location.hash.slice(1), pm = /^profile-([a-z0-9-]+)$/.exec(h);
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
        sec.innerHTML = '<div class="card em">تعذر تحميل الصفحة: ' + ui.esc(e.message) + '</div>';
      }

      updateBadge();

      /* close sidebar on mobile after nav */
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
