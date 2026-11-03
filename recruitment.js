HR.pages.recruitment = {
  title: 'التوظيف', icon: 'userplus',
  async render(root) {
    const { store, ui } = HR, ST = ['تقديم', 'مقابلة', 'عرض وظيفي', 'تم التعيين'];
    const C = await store.list('candidates');
    root.innerHTML = ui.head('التوظيف', 'تابع المرشحين من التقديم حتى التعيين', '<button class="btn" data-a="add">+ مرشح جديد</button>') +
      '<div class="board">' + ST.map((s, i) => '<div class="col"><h4>' + s + ' (' + C.filter(c => c.stage === i).length + ')</h4>' +
        C.filter(c => c.stage === i).map(c => '<div class="cd" data-id="' + c.id + '"><b>' + ui.esc(c.name) + '</b><small>' + ui.esc(c.role) + '</small>' +
          (i > 0 ? '<button class="btn ghost sm" data-a="prev">رجوع</button> ' : '') + (i < 3 ? '<button class="btn sm" data-a="next">التالي</button> ' : '<button class="btn sm" data-a="hire">إضافة للموظفين</button> ') + '<button class="btn danger sm" data-a="del">حذف</button></div>').join('') + '</div>').join('') + '</div>';
    root.onclick = async e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a, card = b.closest('.cd'), id = card && card.dataset.id, c = C.find(x => x.id === id);
      if (a === 'add') { const o = await ui.form('مرشح جديد', [{ n: 'name', l: 'الاسم', req: 1 }, { n: 'role', l: 'الوظيفة المتقدم لها', req: 1 }]); if (o) { o.stage = 0; await store.create('candidates', o); HR.refresh(); } }
      else if (a === 'next' || a === 'prev') { await store.update('candidates', id, { stage: c.stage + (a === 'next' ? 1 : -1) }); HR.refresh(); }
      else if (a === 'del') { await store.remove('candidates', id); HR.refresh(); }
      else if (a === 'hire') {
        const o = await ui.form('بيانات الموظف الجديد', HR.empFields, { name: c.name, title: c.role, status: 'active', allow: 0, hire: ui.today() });
        if (o) { o.salary = +o.salary; o.allow = +o.allow || 0; await store.create('employees', o); await store.remove('candidates', id); ui.toast('تمت الإضافة لسجل الموظفين'); HR.refresh(); }
      }
    };
  }
};
