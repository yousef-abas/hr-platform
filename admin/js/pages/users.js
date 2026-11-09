HR.pages.users = {
  title: 'المستخدمون', icon: 'shield',
  async render(root) {
    const { store, ui } = HR;

    /* جلب أحدث البيانات دائمًا — لا كاش */
    const [U, E] = await Promise.all([store.list('profiles'), store.list('employees')]);

    const R = [['admin', 'مدير النظام'], ['hr', 'موارد بشرية'], ['employee', 'موظف']];
    const roleColor = { admin: '#dc2626', hr: '#2563eb', employee: '#16a34a' };
    const roleIcon  = { admin: 'shield',  hr: 'users',   employee: 'user' };

    root.innerHTML =
      ui.head('المستخدمون والصلاحيات', 'حدد دور كل حساب وربطه بالموظف',
        '<button class="btn ghost" data-a="refresh">🔄 تحديث</button>'
      ) +

      /* KPI */
      '<div class="kpi-row">' +
        R.map(([k, l]) =>
          '<div class="kpi-card" style="--kc:' + roleColor[k] + '">' +
            '<div class="kpi-ic" style="background:' + roleColor[k] + '15;color:' + roleColor[k] + '">' + ui.icon(roleIcon[k]) + '</div>' +
            '<div class="kpi-val">' + U.filter(u => u.role === k).length + '</div>' +
            '<div class="kpi-lbl">' + l + '</div>' +
          '</div>'
        ).join('') +
      '</div>' +

      /* Users list */
      '<div class="card">' +
        '<h3>الحسابات (' + U.length + ')</h3>' +
        '<div class="user-list">' +
          U.map(u =>
            '<div class="user-row" data-id="' + u.id + '">' +
              '<div class="user-avatar" style="background:' + (roleColor[u.role] || '#6b7280') + '20;color:' + (roleColor[u.role] || '#6b7280') + '">' +
                (u.fullName || u.email || '؟').trim()[0].toUpperCase() +
              '</div>' +
              '<div class="user-info">' +
                '<b>' + ui.esc(u.fullName || u.email || '—') + '</b>' +
                '<small>' + ui.esc(u.email || '') + '</small>' +
              '</div>' +
              '<div class="user-ctrl">' +
                /* Role selector */
                '<select data-f="role" class="sel-sm">' +
                  R.map(r => '<option value="' + r[0] + '"' + (u.role === r[0] ? ' selected' : '') + '>' + r[1] + '</option>').join('') +
                '</select>' +
                /* Employee link — يعرض كل الموظفين النشطين */
                '<select data-f="employeeId" class="sel-sm">' +
                  '<option value="">بدون ربط</option>' +
                  E
                    .filter(e => e.status !== 'terminated')
                    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'))
                    .map(e =>
                      '<option value="' + e.id + '"' + (u.employeeId === e.id ? ' selected' : '') + '>' +
                        ui.esc(e.name) + (e.title ? ' — ' + ui.esc(e.title) : '') +
                      '</option>'
                    ).join('') +
                '</select>' +
              '</div>' +
            '</div>'
          ).join('') +
        '</div>' +
      '</div>' +

      /* How to add */
      '<div class="card">' +
        '<h3>➕ إضافة مستخدم جديد</h3>' +
        '<div class="steps">' +
          '<div class="step"><span class="step-n">1</span><p>افتح Supabase → <b>Authentication → Users → Add user</b></p></div>' +
          '<div class="step"><span class="step-n">2</span><p>اكتب الإيميل والباسورد وفعّل <b>Auto Confirm User</b></p></div>' +
          '<div class="step"><span class="step-n">3</span><p>ارجع هنا واضغط <b>تحديث</b>، هيظهر الحساب في القائمة — حدد دوره وربطه بالموظف</p></div>' +
        '</div>' +
        '<div class="al wa" style="margin-top:12px">' +
          '<span>!</span>' +
          '<div>لو أضفت موظف جديد من صفحة الموظفين وعايز تربطه بحساب، اضغط <b>تحديث</b> الأول عشان يظهر اسمه في القائمة.</div>' +
        '</div>' +
      '</div>';

    /* ── Events ── */
    root.querySelector('[data-a="refresh"]').onclick = () => HR.refresh();

    root.onchange = async e => {
      const t = e.target; if (!t.dataset.f) return;
      const id = t.closest('[data-id]').dataset.id;
      const u = U.find(x => x.id === id);
      if (t.dataset.f === 'role' && u.id === (HR.user && HR.user.id) && t.value !== 'admin') {
        if (!confirm('هتشيل صلاحية المدير من حسابك أنت. متأكد؟')) { t.value = u.role; return; }
      }
      await store.update('profiles', id, { [t.dataset.f]: t.value || null });
      ui.toast('✅ تم الحفظ');
    };
  }
};
