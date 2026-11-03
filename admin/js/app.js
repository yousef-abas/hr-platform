(function () {
  const H = window.HR, ui = H.ui;
  const root = document.getElementById('root'), top = document.getElementById('top'), tabs = document.getElementById('tabs');
  const keys = ['dashboard', 'employees', 'attendance', 'leaves', 'payroll', 'recruitment', 'performance'];
  top.innerHTML = '<a class="brand" href="#dashboard"><i>HR</i><b>نظام الموارد البشرية</b></a><div class="sp"></div>' +
    '<div class="srch">' + ui.icon('search') + '<input id="sr" placeholder="ابحث عن موظف" autocomplete="off"><div id="sres"></div></div><div class="sp"></div>' +
    '<div class="me"><span class="av" style="background:#0070f2">م</span><div><b>مدير النظام</b><small>صلاحيات كاملة</small></div></div>';
  tabs.innerHTML = keys.map(k => '<a href="#' + k + '" data-k="' + k + '">' + ui.icon(H.pages[k].icon) + H.pages[k].title + '</a>').join('');
  const sr = document.getElementById('sr'), res = document.getElementById('sres');
  sr.oninput = async () => {
    const v = sr.value.trim(); if (!v) { res.style.display = 'none'; return; }
    const E = (await H.store.list('employees')).filter(e => (e.name + e.title + e.dept).includes(v)).slice(0, 6);
    res.innerHTML = E.length ? E.map(e => '<div data-n="' + ui.esc(e.name) + '">' + ui.who(e) + '</div>').join('') : '<div>لا توجد نتائج</div>';
    res.style.display = 'block';
  };
  res.onmousedown = e => {
    const d = e.target.closest('[data-n]'); if (!d) return;
    H.state.q = d.dataset.n; sr.value = ''; res.style.display = 'none';
    if (location.hash === '#employees') H.refresh(); else location.hash = 'employees';
  };
  sr.onblur = () => setTimeout(() => res.style.display = 'none', 150);
  async function go() {
    const h = location.hash.slice(1), pm = /^profile-([a-z0-9]+)$/.exec(h);
    const k = pm ? 'employees' : (keys.indexOf(h) > -1 ? h : keys[0]);
    tabs.querySelectorAll('a').forEach(a => { const on = a.dataset.k === k; a.classList.toggle('on', on); });
    const sec = document.createElement('section');
    root.replaceChildren(sec);
    try { await (pm ? H.pages.profile.render(sec, pm[1]) : H.pages[k].render(sec)); } catch (e) { sec.innerHTML = '<div class="card em">تعذر تحميل الصفحة: ' + ui.esc(e.message) + '</div>'; }
  }
  H.refresh = async function () { const y = window.scrollY; await go(); window.scrollTo(0, y); };
  window.addEventListener('hashchange', () => window.scrollTo(0, 0));
  window.addEventListener('hashchange', go);
  go();
  const sp = document.getElementById('splash');
  requestAnimationFrame(() => sp.classList.add('open'));
  setTimeout(() => sp.remove(), 2000);
})();
