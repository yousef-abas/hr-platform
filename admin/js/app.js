(function () {
  const H = window.HR;
  const IC = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.500 6.500-5.500s5.900 1.900 6.500 5.500"/><path d="M16 4.700a3.500 3.500 0 010 6.600M18 14.800c2 .6 3.200 2.300 3.500 5.200"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/>',
    userplus: '<circle cx="10" cy="8" r="3.5"/><path d="M3 20c.6-3.600 3.200-5.500 7-5.500M18 14v6M15 17h6"/>'
  };
  const keys = Object.keys(H.pages), root = document.getElementById('root'), rail = document.getElementById('rail');
  rail.innerHTML = keys.map(k => '<a href="#' + k + '" data-k="' + k + '"><svg viewBox="0 0 24 24">' + IC[H.pages[k].icon] + '</svg>' + H.pages[k].title + '</a>').join('');
  async function go() {
    const k = H.pages[location.hash.slice(1)] ? location.hash.slice(1) : keys[0];
    rail.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.k === k));
    const sec = document.createElement('section');
    root.replaceChildren(sec);
    root.onclick = root.onchange = null;
    try { await H.pages[k].render(sec); } catch (e) { sec.innerHTML = '<div class="card em">تعذر تحميل الصفحة: ' + H.ui.esc(e.message) + '</div>'; }
    sec.addEventListener('click', () => {}, true);
    H.root = sec;
  }
  H.refresh = async function () { const y = window.scrollY; await go(); window.scrollTo(0, y); };
  window.addEventListener('hashchange', go);
  go();
  const sp = document.getElementById('splash');
  requestAnimationFrame(() => sp.classList.add('open'));
  setTimeout(() => sp.remove(), 2000);
})();
