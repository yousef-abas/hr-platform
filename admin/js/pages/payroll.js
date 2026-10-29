HR.pages.payroll = {
  title: 'الرواتب', icon: 'wallet',
  async render(root) {
    const { store, ui, state: st } = HR, INS = 0.11;
    st.month = st.month || ui.today().slice(0, 7);
    const E = (await store.list('employees')).filter(e => e.status !== 'terminated');
    const P = await store.list('payroll');
    const calc = e => {
      const p = P.find(x => x.empId === e.id && x.month === st.month) || { bonus: 0, absent: 0, other: 0 };
      const gross = e.salary + (e.allow || 0) + p.bonus, ins = e.salary * INS, ab = p.absent * e.salary / 30;
      return { p, gross, ins, ab, net: gross - ins - ab - p.other };
    };
    let T = 0;
    const rows = E.map(e => {
      const c = calc(e); T += c.net;
      const inp = f => '<td><input type="number" min="0" data-f="' + f + '" value="' + (c.p[f] || 0) + '"></td>';
      return '<tr data-id="' + e.id + '"><td>' + ui.who(e) + '</td><td>' + ui.money(e.salary + (e.allow || 0)) + '</td>' + inp('bonus') + inp('absent') + inp('other') + '<td>' + ui.money(c.ins) + '</td><td class="net">' + ui.money(c.net) + '</td><td><button class="btn ghost sm" data-a="slip">قسيمة</button></td></tr>';
    }).join('');
    root.innerHTML = ui.head('الرواتب', 'الصافي = الأساسي + البدلات + المكافأة − التأمينات (11%) − خصم الغياب − خصومات أخرى. الحساب مبسّط ولا يشمل ضريبة الدخل.',
      '<input type="month" id="mo" value="' + st.month + '"><button class="btn ghost" data-a="csv">تصدير</button>') +
      '<div class="card stat"><span>إجمالي الصافي لشهر ' + st.month + '</span><b>' + ui.money(T) + '</b></div>' +
      '<div class="card tw"><table><tr><th>الموظف</th><th>الأساسي + البدلات</th><th>مكافأة</th><th>أيام غياب</th><th>خصومات أخرى</th><th>تأمينات</th><th>الصافي</th><th></th></tr>' + rows + '</table></div>';
    root.querySelector('#mo').onchange = e => { st.month = e.target.value || st.month; HR.refresh(); };
    root.onchange = async e => {
      const t = e.target; if (!t.dataset.f) return;
      const empId = t.closest('tr').dataset.id, r = P.find(x => x.empId === empId && x.month === st.month), v = Math.max(0, +t.value || 0);
      if (r) await store.update('payroll', r.id, { [t.dataset.f]: v }); else await store.create('payroll', { empId, month: st.month, bonus: 0, absent: 0, other: 0, [t.dataset.f]: v });
      HR.refresh();
    };
    root.onclick = e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'csv') return ui.csv('payroll-' + st.month + '.csv', [['الموظف', 'الإجمالي', 'تأمينات', 'خصم غياب', 'الصافي']].concat(E.map(x => { const c = calc(x); return [x.name, c.gross, c.ins, c.ab, c.net]; })));
      const emp = E.find(x => x.id === b.closest('tr').dataset.id), c = calc(emp);
      const m = ui.modal('قسيمة راتب: ' + ui.esc(emp.name), '<p>الشهر: ' + st.month + ' | القسم: ' + ui.esc(emp.dept) + '</p><table class="slip">' +
        [['الراتب الأساسي', emp.salary], ['البدلات', emp.allow || 0], ['المكافأة', c.p.bonus], ['التأمينات', -c.ins], ['خصم الغياب', -c.ab], ['خصومات أخرى', -c.p.other]].map(r => '<tr><td>' + r[0] + '</td><td>' + ui.money(r[1]) + '</td></tr>').join('') +
        '<tr><td><b>الصافي</b></td><td class="net">' + ui.money(c.net) + '</td></tr></table><div class="acts"><button class="btn" id="pr">طباعة</button><button class="btn ghost" id="cl">إغلاق</button></div>');
      m.el.querySelector('#pr').onclick = () => window.print(); m.el.querySelector('#cl').onclick = m.close;
    };
  }
};
