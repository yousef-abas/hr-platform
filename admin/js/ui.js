(function () {
  const H = window.HR;
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => Math.round(n || 0).toLocaleString('ar-EG') + ' ج.م';
  const today = () => new Date().toISOString().slice(0, 10);
  const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5) + 1;
  const tag = (t, c) => '<span class="tag ' + c + '">' + esc(t) + '</span>';
  const COL = ['#4f46e5', '#0e9f9a', '#d9822b', '#c2417a', '#2f7de1', '#5a8f29'];
  function who(e) {
    const c = COL[(e.name || '').length % COL.length];
    return '<div class="who"><span class="av" style="background:' + c + '">' + esc((e.name || '؟').trim()[0]) + '</span><div>' + esc(e.name) + '<small>' + esc(e.title || '') + '</small></div></div>';
  }
  function head(h, sub, tools) {
    return '<header class="ph"><div><h1>' + h + '</h1><p>' + sub + '</p></div><div class="tools">' + (tools || '') + '</div></header>';
  }
  function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.append(t); setTimeout(() => t.remove(), 2200); }
  function modal(title, html) {
    const o = document.createElement('div'); o.className = 'mo';
    o.innerHTML = '<div class="md"><h3>' + title + '</h3><div class="mb">' + html + '</div></div>';
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
  H.ui = { esc, money, today, days, tag, who, head, toast, modal, form, csv };
})();
