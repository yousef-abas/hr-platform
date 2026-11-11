HR.pages.errors = {
  title: 'سجل الأخطاء', icon: 'list',
  async render(root) {
    const { store, ui } = HR, esc = ui.esc;
    if (HR.user.role !== 'admin' && HR.user.role !== 'hr') {
      root.innerHTML = '<div class="al da">غير مسموح بعرض هذه الصفحة</div>'; return;
    }

    const logs = await store.list('error_logs');
    logs.sort((a, b) => (b.createdAt || b.created_at || '') > (a.createdAt || a.created_at || '') ? 1 : -1);

    root.innerHTML =
      ui.head('سجل الأخطاء', logs.length + ' خطأ مسجّل',
        '<button class="btn ghost" data-a="clear">🗑️ مسح الكل</button>'
      ) +
      (logs.length === 0
        ? '<div class="al ok">✅ لا توجد أخطاء مسجّلة — النظام يعمل بشكل سليم</div>'
        : '<div class="card" style="overflow:auto">' +
          '<table class="tbl" style="width:100%;border-collapse:collapse;font-size:13px">' +
          '<thead><tr>' +
            '<th style="padding:10px">الوقت</th>' +
            '<th>السياق</th>' +
            '<th>الرسالة</th>' +
            '<th>التفاصيل</th>' +
          '</tr></thead><tbody>' +
          logs.slice(0, 100).map((l, i) => {
            const ts = (l.createdAt || l.created_at || '').slice(0, 16).replace('T', ' ');
            const ctx = l.context || '—';
            const ctxColor = ctx.includes('admin') ? '#7c3aed' : '#c9933a';
            return '<tr style="border-bottom:1px solid var(--bo);vertical-align:top">' +
              '<td style="padding:8px 12px;white-space:nowrap;color:var(--mu)">' + esc(ts) + '</td>' +
              '<td style="padding:8px 12px"><span class="tag" style="background:' + ctxColor + '20;color:' + ctxColor + ';border:1px solid ' + ctxColor + '30">' + esc(ctx) + '</span></td>' +
              '<td style="padding:8px 12px;max-width:300px;word-break:break-word">' + esc((l.message || '').slice(0, 150)) + '</td>' +
              '<td style="padding:8px 12px">' +
                (l.stack
                  ? '<button class="btn ghost sm" data-stack="' + i + '">عرض</button>'
                  : '<span class="mu">—</span>') +
              '</td>' +
            '</tr>' +
            (l.stack
              ? '<tr id="stack-' + i + '" style="display:none"><td colspan="4" style="padding:8px 12px;background:var(--su)"><pre style="margin:0;font-size:11px;white-space:pre-wrap;color:var(--mu)">' + esc((l.stack||'').slice(0,1000)) + '</pre></td></tr>'
              : '');
          }).join('') +
          '</tbody></table>' +
          '</div>');

    root.onclick = async e => {
      const b = e.target.closest('[data-a]');
      const s = e.target.closest('[data-stack]');
      if (s) {
        const row = root.querySelector('#stack-' + s.dataset.stack);
        if (row) row.style.display = row.style.display === 'none' ? '' : 'none';
        return;
      }
      if (!b) return;
      if (b.dataset.a === 'clear') {
        if (!confirm('هتمسح كل سجل الأخطاء. متأكد؟')) return;
        await Promise.all(logs.map(l => store.delete('error_logs', l.id).catch(() => {})));
        ui.toast('✅ تم مسح السجل'); HR.refresh();
      }
    };
  }
};
