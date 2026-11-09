(function () {
  const H = window.HR;
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => Math.round(n || 0).toLocaleString('ar-EG') + ' ج.م';
  const iso   = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const today = () => iso(new Date());
  const days  = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5) + 1;
  const tag   = (t, c) => '<span class="tag ' + c + '">' + esc(t) + '</span>';
  const COL   = ['#0070f2', '#0e9f9a', '#d9822b', '#c2417a', '#2f7de1', '#5a8f29'];

  /* ── Icons ── */
  const IC = {
    grid:     '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    users:    '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.7a3.5 3.5 0 010 6.6M18 14.8c2 .6 3.2 2.3 3.5 5.2"/>',
    clock:    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    wallet:   '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/>',
    userplus: '<circle cx="10" cy="8" r="3.5"/><path d="M3 20c.6-3.6 3.2-5.5 7-5.5M18 14v6M15 17h6"/>',
    star:     '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    menu:     '<path d="M4 7h16M4 12h16M4 17h16"/>',
    shield:   '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    list:     '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    home:     '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
    user:     '<circle cx="12" cy="8" r="4"/><path d="M4 21c.6-4 3.8-6 8-6s7.4 2 8 6"/>',
    upload:   '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    search:   '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    /* ✅ المفقودة اللي بتسبب خطأ الحضور */
    check:    '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>',
    x:        '<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>',
    /* إضافات للصفحات الجديدة */
    'check-circle': '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    alert:    '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3m0 3h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>',
  };
  const icon = n => '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + (IC[n] || '') + '</svg>';
  const stars = n => { n = Math.round(n); return '<span class="star">' + '★'.repeat(n) + '☆'.repeat(5 - n) + '</span>'; };

  /* ── Debounce ── */
  function debounce(fn, ms) {
    ms = ms || 300;
    let t;
    return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
  }

  /* ── Prompt (missing in original) ── */
  function prompt(label) {
    return new Promise(res => {
      const m = modal('إدخال', '<div style="padding:4px 0"><label style="display:block;margin-bottom:8px;font-weight:600">' + esc(label) + '</label><input id="pr-inp" style="width:100%;padding:8px 12px;border-radius:8px;border:1.5px solid var(--ln);font:inherit;background:var(--sf);color:var(--tx)"></div><div class="acts" style="margin-top:12px"><button class="btn" id="pr-ok">موافق</button><button class="btn ghost" id="pr-no">إلغاء</button></div>');
      m.el.querySelector('#pr-ok').onclick = () => { res(m.el.querySelector('#pr-inp').value); m.close(); };
      m.el.querySelector('#pr-no').onclick = () => { res(null); m.close(); };
    });
  }

  /* ── Drawer ── */
  function drawer(html) {
    const o = document.createElement('div'); o.className = 'dr';
    o.innerHTML = '<div class="dp">' + html + '</div>';
    const close = () => o.remove();
    o.addEventListener('mousedown', e => { if (e.target === o) close(); });
    document.body.append(o);
    return { el: o.querySelector('.dp'), close };
  }

  /* ── who() - avatar + name + title ── */
  function who(e) {
    const c = COL[(e.name || '').length % COL.length];
    const av = e.photo
      ? '<img class="av lazy-photo" data-photo="' + esc(e.photo) + '" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0">'
      : '<span class="av" style="width:32px;height:32px;border-radius:50%;background:' + c + ';display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px;flex-shrink:0">' + esc((e.name || '؟').trim()[0]) + '</span>';
    return '<div class="who" style="display:flex;align-items:center;gap:8px">' + av +
      '<div style="min-width:0"><div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(e.name || '') + '</div>' +
      (e.title ? '<small style="color:var(--mu);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(e.title) + '</small>' : '') +
      '</div></div>';
  }


  /* ── head() ── */
  function head(h, sub, tools) {
    return '<header class="ph"><div><div class="bc"><a href="#dashboard">الرئيسية</a> › ' + h + '</div><h1>' + h + '</h1><p>' + sub + '</p></div><div class="tools">' + (tools || '') + '</div></header>';
  }

  /* ── toast ── */
  function toast(m) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = m;
    document.body.append(t); setTimeout(() => t.remove(), 2400);
  }

  /* ── modal ── */
  function modal(title, html, wide) {
    const o = document.createElement('div'); o.className = 'mo';
    o.innerHTML = '<div class="md"' + (wide ? ' style="width:min(980px,100%)"' : '') + '><h3>' + title + '</h3><div class="mb">' + html + '</div></div>';
    const close = () => o.remove();
    o.addEventListener('mousedown', e => { if (e.target === o) close(); });
    document.body.append(o);
    return { el: o.querySelector('.mb'), close };
  }

  /* ── form ── */
  function form(title, fields, vals) {
    vals = vals || {};
    return new Promise(res => {
      const html = '<form>' + fields.map(f => '<label>' + f.l +
        (f.opts
          ? '<select name="' + f.n + '">' +
              f.opts.map(o => { const a = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(a[0]) + '"' + (String(vals[f.n] == null ? '' : vals[f.n]) === String(a[0]) ? ' selected' : '') + '>' + esc(a[1]) + '</option>'; }).join('') +
            '</select>'
          : '<input name="' + f.n + '" type="' + (f.t || 'text') + '" value="' + esc(vals[f.n] == null ? '' : vals[f.n]) + '"' + (f.req ? ' required' : '') + '>') +
        '</label>').join('') +
        '<div class="acts"><button class="btn" type="submit">حفظ</button><button class="btn ghost" type="button" data-x>إلغاء</button></div></form>';
      const m = modal(title, html);
      m.el.querySelector('[data-x]').onclick = () => { m.close(); res(null); };
      m.el.querySelector('form').onsubmit = e => {
        e.preventDefault();
        const o = {};
        new FormData(e.target).forEach((v, k) => o[k] = v);
        m.close(); res(o);
      };
    });
  }

  /* ── csv export ── */
  function csv(name, rows) {
    const content = rows.map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' }));
    a.download = name; a.click();
  }

  /* ── nid (Egyptian national ID parser) ── */
  function nid(v) {
    if (!v || String(v).replace(/\D/g, '').length !== 14) return null;
    const s = String(v).replace(/\D/g, '');
    const century = s[0] === '2' ? '19' : '20';
    const birth = century + s.slice(1, 3) + '-' + s.slice(3, 5) + '-' + s.slice(5, 7);
    const genderDigit = +s[12];
    return { birth, gender: genderDigit % 2 !== 0 ? 'ذكر' : 'أنثى' };
  }

  /* ui.color(e) — لون avatar بناءً على الاسم */
  const color = e => COL[(e && e.name ? e.name : '').length % COL.length];

  /* تأكد إن H.ui موجود قبل الـ assign — لو مش موجود نعمله */
  if (!H.ui) H.ui = {};
  Object.assign(H.ui, { esc, money, iso, today, days, tag, icon, stars, who, head, toast, modal, form, drawer, csv, nid, debounce, prompt, color });
})();
