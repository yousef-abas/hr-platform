HR.pages.announcements = {
  title: 'الإعلانات', icon: 'megaphone',
  async render(root) {
    const { store, ui } = HR, esc = ui.esc;
    const isAdmin = HR.user.role === 'admin' || HR.user.role === 'hr';
    const ann = (await store.list('announcements')).sort((a,b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.createdAt||b.created_at||'') > (a.createdAt||a.created_at||'') ? 1 : -1;
    });

    const typeIcon = { general:'📢', holiday:'🎉', urgent:'🚨', event:'📅' };
    const typeColor = { general:'#c9933a', holiday:'#16a34a', urgent:'#ef4444', event:'#7c3aed' };

    root.innerHTML =
      ui.head('الإعلانات الداخلية', ann.length + ' إعلان',
        isAdmin ? '<button class="btn" data-a="add">+ إعلان جديد</button>' : ''
      ) +
      (ann.length === 0
        ? '<div class="al ok">لا توجد إعلانات حالياً</div>'
        : ann.map(a => {
            const c = typeColor[a.type] || '#c9933a';
            const ic = typeIcon[a.type] || '📢';
            return '<div class="card" style="border-right:4px solid ' + c + ';margin-bottom:12px" data-id="' + a.id + '">' +
              '<div style="display:flex;justify-content:space-between;align-items:start">' +
                '<div>' +
                  '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">' +
                    '<span style="font-size:18px">' + ic + '</span>' +
                    '<b style="font-size:15px">' + esc(a.title) + '</b>' +
                    (a.pinned ? '<span style="color:#f59e0b;font-size:12px">📌 مثبت</span>' : '') +
                  '</div>' +
                  (a.body ? '<p style="color:var(--mu);margin:4px 0 8px">' + esc(a.body) + '</p>' : '') +
                  '<small class="mu">' + (a.createdAt||a.created_at||'').slice(0,10) +
                    (a.expiresAt ? ' — ينتهي ' + a.expiresAt : '') +
                  '</small>' +
                '</div>' +
                (isAdmin
                  ? '<div style="display:flex;gap:6px">' +
                      '<button class="btn ghost sm" data-a="pin" data-id="' + a.id + '">' + (a.pinned ? '📌 إلغاء التثبيت' : '📌 تثبيت') + '</button>' +
                      '<button class="btn ghost sm" data-a="edit" data-id="' + a.id + '">تعديل</button>' +
                      '<button class="btn danger sm" data-a="del" data-id="' + a.id + '">حذف</button>' +
                    '</div>'
                  : '') +
              '</div>' +
            '</div>';
          }).join(''));

    if (!isAdmin) return;
    const fields = [
      { n: 'title', l: 'عنوان الإعلان', req: 1 },
      { n: 'body',  l: 'التفاصيل', t: 'textarea' },
      { n: 'type',  l: 'النوع', opts: [['general','عام'],['holiday','إجازة/عطلة'],['urgent','عاجل'],['event','فعالية']] },
      { n: 'expiresAt', l: 'تاريخ الانتهاء (اختياري)', t: 'date' }
    ];

    root.onclick = async e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const id = b.dataset.id, a = b.dataset.a;
      const cur = ann.find(x => x.id === id);
      if (a === 'add') {
        const o = await ui.form('إعلان جديد', fields);
        if (!o) return;
        o.active = true; o.pinned = false; o.createdBy = HR.user.name;
        await store.create('announcements', o); ui.toast('✅ تم نشر الإعلان'); HR.refresh();
      }
      if (a === 'edit') {
        const o = await ui.form('تعديل الإعلان', fields, cur);
        if (!o) return;
        await store.update('announcements', id, o); ui.toast('✅ تم التعديل'); HR.refresh();
      }
      if (a === 'pin') {
        await store.update('announcements', id, { pinned: !cur.pinned }); HR.refresh();
      }
      if (a === 'del') {
        if (!confirm('حذف الإعلان؟')) return;
        await store.remove('announcements', id); ui.toast('تم الحذف'); HR.refresh();
      }
    };
  }
};
