HR.pages.recruitment = {
  title: 'التوظيف', icon: 'userplus',
  async render(root) {
    const { store, ui } = HR;
    const ST = ['تقديم', 'مقابلة', 'عرض وظيفي', 'تم التعيين'];
    const COLORS = ['#6b7280', '#f59e0b', '#3b82f6', '#22c55e'];
    const C = await store.list('candidates');

    root.innerHTML =
      ui.head('التوظيف', 'تابع المرشحين من التقديم حتى التعيين',
        '<button class="btn" data-a="add">+ مرشح جديد</button>'
      ) +

      /* Stats */
      '<div class="kpi-row">' +
        ST.map((s, i) =>
          '<div class="kpi-card" style="--kc:' + COLORS[i] + '">' +
            '<div class="kpi-val" style="color:' + COLORS[i] + '">' + C.filter(c => c.stage === i).length + '</div>' +
            '<div class="kpi-lbl">' + s + '</div>' +
          '</div>'
        ).join('') +
      '</div>' +

      /* Kanban board */
      '<div class="board">' +
        ST.map((s, i) =>
          '<div class="col">' +
            '<div class="col-head" style="--cc:' + COLORS[i] + '">' +
              '<span>' + s + '</span>' +
              '<span class="col-count">' + C.filter(c => c.stage === i).length + '</span>' +
            '</div>' +
            '<div class="col-body">' +
              C.filter(c => c.stage === i).map(c =>
                '<div class="cd" data-id="' + c.id + '">' +
                  '<div class="cd-name">' + ui.esc(c.name) + '</div>' +
                  '<div class="cd-role">' + ui.icon('grid') + ui.esc(c.role || '') + '</div>' +
                  '<div class="cd-acts">' +
                    (i > 0 ? '<button class="btn ghost sm" data-a="prev">← رجوع</button>' : '') +
                    (i < 3
                      ? '<button class="btn sm" data-a="next">التالي →</button>'
                      : '<button class="btn sm" data-a="hire">إضافة للموظفين</button>') +
                    '<button class="btn danger sm" data-a="del">حذف</button>' +
                  '</div>' +
                '</div>'
              ).join('') +
              (C.filter(c => c.stage === i).length === 0
                ? '<div class="col-empty">لا يوجد مرشحون</div>'
                : '') +
            '</div>' +
          '</div>'
        ).join('') +
      '</div>';

    root.onclick = async e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a;
      const card = b.closest('.cd'), id = card && card.dataset.id;
      const c = C.find(x => x.id === id);

      if (a === 'add') {
        const o = await ui.form('مرشح جديد', [
          { n: 'name', l: 'الاسم', req: 1 },
          { n: 'role', l: 'الوظيفة المتقدم لها', req: 1 },
          { n: 'phone', l: 'الموبايل', t: 'tel' }
        ]);
        if (o) { o.stage = 0; await store.create('candidates', o); HR.refresh(); }
      }
      else if (a === 'next' || a === 'prev') {
        await store.update('candidates', id, { stage: c.stage + (a === 'next' ? 1 : -1) });
        HR.refresh();
      }
      else if (a === 'del') {
        if (!confirm('حذف المرشح؟')) return;
        await store.remove('candidates', id); HR.refresh();
      }
      else if (a === 'hire') {
        const o = await ui.form('بيانات الموظف الجديد', HR.empFields, {
          name: c.name, title: c.role, status: 'active', allow: 0, hire: ui.today()
        });
        if (o) {
          o.salary = +o.salary; o.allow = +o.allow || 0;
          await store.create('employees', o);
          await store.remove('candidates', id);
          ui.toast('✅ تمت الإضافة لسجل الموظفين');
          HR.refresh();
        }
      }
    };
  }
};
