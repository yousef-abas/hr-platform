HR.pages.users = {
  title: 'المستخدمون', icon: 'shield',
  async render(root) {
    const { store, ui } = HR;

    const [U, E] = await Promise.all([store.list('profiles'), store.list('employees')]);

    /* الأقسام من الموظفين */
    const depts = [...new Set(E.map(e => e.dept).filter(Boolean))].sort((a,b) => a.localeCompare(b,'ar'));

    const R = [
      ['admin',      'مدير النظام'],
      ['hr',         'موارد بشرية'],
      ['manager',    'مدير قسم'],
      ['supervisor', 'مشرف'],
      ['employee',   'موظف'],
    ];
    const roleColor = {
      admin:      '#dc2626',
      hr:         '#2563eb',
      manager:    '#8b5cf6',
      supervisor: '#f59e0b',
      employee:   '#16a34a',
    };
    const roleIcon = {
      admin:      'shield',
      hr:         'users',
      manager:    'org',
      supervisor: 'star',
      employee:   'user',
    };

    /* الأدوار التي تحتاج تحديد قسم */
    const NEEDS_DEPT = ['manager', 'supervisor'];

    root.innerHTML =
      ui.head('المستخدمون والصلاحيات', 'حدد دور كل حساب وأربطه بالموظف',
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

      /* جدول الصلاحيات */
      '<div class="card">' +
        '<h3>الحسابات (' + U.length + ')</h3>' +
        '<div class="user-list">' +
          U.map(u => {
            const needsDept = NEEDS_DEPT.includes(u.role);
            return (
              '<div class="user-row" data-id="' + u.id + '">' +

                /* أفاتار */
                '<div class="user-avatar" style="background:' + (roleColor[u.role] || '#6b7280') + '20;color:' + (roleColor[u.role] || '#6b7280') + '">' +
                  (u.fullName || u.email || '؟').trim()[0].toUpperCase() +
                '</div>' +

                /* اسم + إيميل */
                '<div class="user-info">' +
                  '<b>' + ui.esc(u.fullName || u.email || '—') + '</b>' +
                  '<small>' + ui.esc(u.email || '') + (u.managedDept ? ' · <span style="color:#8b5cf6">📂 ' + ui.esc(u.managedDept) + '</span>' : '') + '</small>' +
                '</div>' +

                '<div class="user-ctrl">' +

                  /* الدور */
                  '<select data-f="role" class="sel-sm" title="الدور">' +
                    R.map(r =>
                      '<option value="' + r[0] + '"' + (u.role === r[0] ? ' selected' : '') + '>' + r[1] + '</option>'
                    ).join('') +
                  '</select>' +

                  /* القسم — يظهر للمدير والمشرف فقط */
                  '<select data-f="managedDept" class="sel-sm dept-sel" style="' + (needsDept ? '' : 'display:none') + '" title="القسم المسؤول عنه">' +
                    '<option value="">— القسم —</option>' +
                    depts.map(d =>
                      '<option value="' + ui.esc(d) + '"' + (u.managedDept === d ? ' selected' : '') + '>' + ui.esc(d) + '</option>'
                    ).join('') +
                  '</select>' +

                  /* ربط بموظف */
                  '<select data-f="employeeId" class="sel-sm" title="الموظف المرتبط">' +
                    '<option value="">بدون ربط</option>' +
                    E
                      .filter(e => e.status !== 'terminated')
                      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'))
                      .map(e =>
                        '<option value="' + e.id + '"' + (u.employeeId === e.id ? ' selected' : '') + '>' +
                          ui.esc(e.name) + (e.dept ? ' · ' + ui.esc(e.dept) : '') +
                        '</option>'
                      ).join('') +
                  '</select>' +

                '</div>' +
              '</div>'
            );
          }).join('') +
        '</div>' +
      '</div>' +

      /* شرح الصلاحيات */
      '<div class="card">' +
        '<h3>🔐 شرح الصلاحيات</h3>' +
        '<div style="display:grid;gap:10px;margin-top:4px">' +
          [
            ['#dc2626', 'مدير النظام', 'وصول كامل لكل شيء — الرواتب، الموظفين، الإعدادات، المستخدمين'],
            ['#2563eb', 'موارد بشرية', 'نفس المدير ماعدا إدارة المستخدمين والإعدادات الحساسة'],
            ['#8b5cf6', 'مدير قسم',    'يرى فريقه فقط — يوافق على الإجازات والطلبات — يرى تقاريرهم'],
            ['#f59e0b', 'مشرف',        'يرى فريقه — يتابع الحضور والطلبات — بدون موافقة نهائية'],
            ['#16a34a', 'موظف',        'بوابته الشخصية فقط — طلباته وإجازاته وراتبه'],
          ].map(([c, l, d]) =>
            '<div style="display:flex;gap:12px;align-items:flex-start">' +
              '<span style="min-width:10px;height:10px;border-radius:50%;background:' + c + ';margin-top:5px;display:block"></span>' +
              '<div><b>' + l + '</b><br><span class="mu" style="font-size:13px">' + d + '</span></div>' +
            '</div>'
          ).join('') +
        '</div>' +
      '</div>' +

      /* كيف تضيف مستخدم */
      '<div class="card">' +
        '<h3>➕ إضافة مستخدم جديد</h3>' +
        '<div class="steps">' +
          '<div class="step"><span class="step-n">1</span><p>افتح Supabase ← <b>Authentication ← Users ← Add user</b></p></div>' +
          '<div class="step"><span class="step-n">2</span><p>أضف الإيميل والباسورد وفعّل <b>Auto Confirm User</b></p></div>' +
          '<div class="step"><span class="step-n">3</span><p>ارجع هنا واضغط <b>تحديث</b>، ثم حدد الدور والقسم والموظف المرتبط</p></div>' +
        '</div>' +
      '</div>';

    /* ── Events ── */
    root.querySelector('[data-a="refresh"]').onclick = () => HR.refresh();

    root.onchange = async e => {
      const t = e.target; if (!t.dataset.f) return;
      const row = t.closest('[data-id]');
      const id  = row.dataset.id;
      const u   = U.find(x => x.id === id);

      /* تحذير لو المدير يغير صلاحيته */
      if (t.dataset.f === 'role' && u.id === (HR.user && HR.user.id) && t.value !== 'admin') {
        if (!confirm('تغيير صلاحية المدير من حسابك الحالي. متأكد؟')) { t.value = u.role; return; }
      }

      /* إظهار / إخفاء خانة القسم */
      if (t.dataset.f === 'role') {
        const deptSel = row.querySelector('.dept-sel');
        const needsDept = NEEDS_DEPT.includes(t.value);
        if (deptSel) deptSel.style.display = needsDept ? '' : 'none';
        if (!needsDept) {
          await store.update('profiles', id, { role: t.value, managedDept: null });
          ui.toast('✅ تم الحفظ');
          return;
        }
      }

      await store.update('profiles', id, { [t.dataset.f]: t.value || null });
      ui.toast('✅ تم الحفظ');
    };
  }
};
