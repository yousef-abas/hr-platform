(function () {
  const H = window.HR;
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => Math.round(n || 0).toLocaleString('ar-EG') + ' ج.م';
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const today = () => iso(new Date());
  const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5) + 1;
  const tag = (t, c) => '<span class="tag ' + c + '">' + esc(t) + '</span>';
  const COL = ['#0070f2', '#0e9f9a', '#d9822b', '#c2417a', '#2f7de1', '#5a8f29'];
  const IC = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.7a3.5 3.5 0 010 6.6M18 14.8c2 .6 3.2 2.3 3.5 5.2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/>',
    userplus: '<circle cx="10" cy="8" r="3.5"/><path d="M3 20c.6-3.6 3.2-5.5 7-5.5M18 14v6M15 17h6"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    shield: '<path d="M12 3l8 3v6c0 4.500-3.400 8-8 9-4.600-1-8-4.500-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    home: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.6-4 3.8-6 8-6s7.400 2 8 6"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.500 4.500"/>'
  };
  const icon = n => '<svg class="ic" viewBox="0 0 24 24">' + (IC[n] || '') + '</svg>';
  const stars = n => { n = Math.round(n); return '<span class="star">' + '★'.repeat(n) + '☆'.repeat(5 - n) + '</span>'; };
  function drawer(html) {
    const o = document.createElement('div'); o.className = 'dr';
    o.innerHTML = '<div class="dp">' + html + '</div>';
    const close = () => o.remove();
    o.addEventListener('mousedown', e => { if (e.target === o) close(); });
    document.body.append(o);
    return { el: o.querySelector('.dp'), close };
  }
  function who(e) {
    const c = COL[(e.name || '').length % COL.length];
    const av = e.photo ? '<img class="av" alt="" src="' + e.photo + '">' : '<span class="av" style="background:' + c + '">' + esc((e.name || '؟').trim()[0]) + '</span>';
    return '<div class="who">' + av + '<div>' + esc(e.name) + '<small>' + esc(e.title || '') + '</small></div></div>';
  }
  function head(h, sub, tools) {
    return '<header class="ph"><div><div class="bc"><a href="#dashboard">الرئيسية</a> › ' + h + '</div><h1>' + h + '</h1><p>' + sub + '</p></div><div class="tools">' + (tools || '') + '</div></header>';
  }
  function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.append(t); setTimeout(() => t.remove(), 2200); }
  function modal(title, html, wide) {
    const o = document.createElement('div'); o.className = 'mo';
    o.innerHTML = '<div class="md"' + (wide ? ' style="width:min(980px,100%)"' : '') + '><h3>' + title + '</h3><div class="mb">' + html + '</div></div>';
    const close = () => o.remove();
    o.addEventListener('mousedown', e => { if (e.target === o) close(); });
    document.body.append(o);
    return { el: o.querySelector('.mb'), close };
  }
  function form(title, fields, vals) {
    vals = vals || {};
    return new Promise(res => {
      const html = '<form>' + fields.map(f => '<label>' + f.l + (f.opts
        ? '<select name="' + f.n + '">' + f.opts.map(o => { const a = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(a[0]) + '"' + (String(vals[f.n] == null ? '' : vals[f.n]) === String(a[0]) ? ' selected' : '') + '>' + esc(a[1]) + '</option>'; }).join('') + '</select>'
        : '<input name="' + f.n + '" type="' + (f.t || 'text') + '" value="' + esc(vals[f.n] == null ? '' : vals[f.n]) + '"' + (f.req ? ' required' : '') + '>') + '</label>').join('')
        + '<div class="acts"><button class="btn" type="submit">حفظ</button><button class="btn ghost" type="button" data-x>إلغاء</button></div></form>';
      const m = modal(title, html);
      m.el.querySelector('[data-x]').onclick = () => { m.close(); res(null); };
      m.el.querySelector('form').onsubmit = e => { e.preventDefault(); const o = {}; new FormData(e.target).forEach((v, k) => o[k] = v); m.close(); res(o); };
    });
  }
  function csv(name, rows) {
    const t = '\ufeff' + rows.map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click();
  }
  const GOV = { '01': 'القاهرة', '02': 'الإسكندرية', '03': 'بورسعيد', '04': 'السويس', '11': 'دمياط', '12': 'الدقهلية', '13': 'الشرقية', '14': 'القليوبية', '15': 'كفر الشيخ', '16': 'الغربية', '17': 'المنوفية', '18': 'البحيرة', '19': 'الإسماعيلية', '21': 'الجيزة', '22': 'بني سويف', '23': 'الفيوم', '24': 'المنيا', '25': 'أسيوط', '26': 'سوهاج', '27': 'قنا', '28': 'أسوان', '29': 'الأقصر', '31': 'البحر الأحمر', '32': 'الوادي الجديد', '33': 'مطروح', '34': 'شمال سيناء', '35': 'جنوب سيناء', '88': 'خارج الجمهورية' };
  function nid(n) {
    n = String(n || '').replace(/\D/g, ''); if (n.length !== 14) return null;
    const c = n[0] === '2' ? 1900 : n[0] === '3' ? 2000 : 0; if (!c) return null;
    return { birth: (c + +n.slice(1, 3)) + '-' + n.slice(3, 5) + '-' + n.slice(5, 7), gender: (+n[12]) % 2 ? 'ذكر' : 'أنثى', gov: GOV[n.slice(7, 9)] || '' };
  }
  const color = e => COL[(e.name || '').length % COL.length];
  const debounce = (fn, ms) => { let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(() => fn.apply(c, a), ms || 250); }; };
  H.ui = { esc, money, today, days, tag, who, head, toast, modal, form, csv, icon, stars, drawer, color, nid, debounce, iso };
})();
