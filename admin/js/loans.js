/* ─────────────────────────────────────────────────────────────────────
   loans.js — إدارة السلف
   الحقول: empId, amount, remaining, installment, startMonth, note, status
   ───────────────────────────────────────────────────────────────────── */
HR.showLoans = async function () {
  const { store, ui } = HR;
  const esc = ui.esc;

  const [LOANS, EMP] = await Promise.all([
    store.list('loans'),
    store.list('employees')
  ]);

  const empName = id => (EMP.find(e => e.id === id) || {}).name || '—';
  const ST = {
    active:    ['نشط',     'ok'],
    paid:      ['مسدّد',   'mu'],
    cancelled: ['ملغي',    'da']
  };

  /* ── بناء المحتوى ── */
  function renderTable(loans) {
    if (!loans.length) return '<div class="em" style="padding:24px;text-align:center">لا توجد سلف مسجّلة</div>';
    return `
      <div class="tw" style="overflow-x:auto">
        <table>
          <tr>
            <th>الموظف</th><th>المبلغ الكلي</th><th>المتبقي</th>
            <th>القسط الشهري</th><th>بداية السداد</th><th>الحالة</th><th>ملاحظات</th><th></th>
          </tr>
          ${loans.map(l => `
            <tr data-id="${esc(l.id)}">
              <td>${esc(empName(l.empId))}</td>
              <td>${ui.money(l.amount)}</td>
              <td class="${l.remaining > 0 ? 'c-wa' : ''}">${ui.money(l.remaining ?? l.amount)}</td>
              <td>${ui.money(l.installment)}</td>
              <td>${esc(l.startMonth || '—')}</td>
              <td>${ui.tag(...(ST[l.status] || ST.active))}</td>
              <td style="color:var(--mu);font-size:12px">${esc(l.note || '')}</td>
              <td style="white-space:nowrap">
                <button class="btn ghost sm" data-a="edit" data-id="${esc(l.id)}">تعديل</button>
                ${l.status === 'active' ? `<button class="btn ghost sm" data-a="pay" data-id="${esc(l.id)}">تسجيل دفعة</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </table>
      </div>`;
  }

  const m = ui.modal('💳 السلف والاقتطاعات', `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" id="ln-add">+ سلفة جديدة</button>
          <select id="ln-filter" class="btn ghost" style="cursor:pointer">
            <option value="">كل السلف</option>
            <option value="active">النشطة فقط</option>
            <option value="paid">المسدّدة</option>
          </select>
        </div>
        <div style="font-size:13px;color:var(--mu)">
          إجمالي المتبقي: <b style="color:var(--tx)">${ui.money(LOANS.filter(l => l.status !== 'paid' && l.status !== 'cancelled').reduce((s, l) => s + (l.remaining ?? l.amount), 0))}</b>
        </div>
      </div>
      <div id="ln-table">${renderTable(LOANS)}</div>
    </div>
  `);

  /* فلتر */
  m.el.querySelector('#ln-filter').onchange = function () {
    const v = this.value;
    const filtered = v ? LOANS.filter(l => l.status === v) : LOANS;
    m.el.querySelector('#ln-table').innerHTML = renderTable(filtered);
    bindActions();
  };

  /* ── إضافة سلفة جديدة ── */
  m.el.querySelector('#ln-add').onclick = async () => {
    const empOpts = EMP
      .filter(e => e.status === 'active')
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'))
      .map(e => ({ v: e.id, l: e.name }));

    const o = await ui.form('سلفة جديدة', [
      { n: 'empId',       l: 'الموظف',           opts: empOpts, req: 1 },
      { n: 'amount',      l: 'المبلغ الكلي',      t: 'number',  req: 1 },
      { n: 'installment', l: 'القسط الشهري',      t: 'number',  req: 1 },
      { n: 'startMonth',  l: 'بداية السداد',       t: 'month' },
      { n: 'note',        l: 'ملاحظات' }
    ]);
    if (!o) return;

    o.amount      = +o.amount;
    o.installment = +o.installment;
    o.remaining   = o.amount;
    o.status      = 'active';
    if (!o.startMonth) o.startMonth = ui.today().slice(0, 7);

    await store.create('loans', o);
    ui.toast('✅ تم إضافة السلفة');
    m.close();
    HR.showLoans();
  };

  /* ── أحداث الجدول ── */
  function bindActions() {
    m.el.querySelectorAll('[data-a]').forEach(btn => {
      btn.onclick = async () => {
        const a = btn.dataset.a;
        const id = btn.dataset.id;
        const loan = LOANS.find(l => l.id === id);
        if (!loan) return;

        if (a === 'edit') {
          const empOpts = EMP
            .filter(e => e.status === 'active')
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'))
            .map(e => ({ v: e.id, l: e.name }));

          const o = await ui.form('تعديل السلفة', [
            { n: 'empId',       l: 'الموظف',          opts: empOpts, req: 1 },
            { n: 'amount',      l: 'المبلغ الكلي',     t: 'number',  req: 1 },
            { n: 'installment', l: 'القسط الشهري',     t: 'number',  req: 1 },
            { n: 'remaining',   l: 'المبلغ المتبقي',   t: 'number',  req: 1 },
            { n: 'startMonth',  l: 'بداية السداد',      t: 'month' },
            { n: 'status',      l: 'الحالة', opts: [['active','نشط'],['paid','مسدّد'],['cancelled','ملغي']] },
            { n: 'note',        l: 'ملاحظات' }
          ], {
            ...loan,
            amount:      loan.amount,
            installment: loan.installment,
            remaining:   loan.remaining ?? loan.amount
          });
          if (!o) return;
          o.amount      = +o.amount;
          o.installment = +o.installment;
          o.remaining   = +o.remaining;
          await store.update('loans', id, o);
          ui.toast('✅ تم التحديث');
          m.close();
          HR.showLoans();
        }

        if (a === 'pay') {
          const max = loan.remaining ?? loan.amount;
          const o = await ui.form('تسجيل دفعة — ' + empName(loan.empId), [
            { n: 'amount', l: 'مبلغ الدفعة (أقصى: ' + ui.money(max) + ')', t: 'number', req: 1 },
            { n: 'note',   l: 'ملاحظات' }
          ], { amount: loan.installment });
          if (!o) return;
          const paid = +o.amount;
          if (paid <= 0 || paid > max) return ui.toast('مبلغ غير صحيح');
          const newRemaining = Math.max(0, max - paid);
          const newStatus = newRemaining === 0 ? 'paid' : 'active';
          await store.update('loans', id, { remaining: newRemaining, status: newStatus });
          ui.toast(newStatus === 'paid' ? '✅ تم سداد السلفة كاملاً' : '✅ تم تسجيل الدفعة — المتبقي: ' + ui.money(newRemaining));
          m.close();
          HR.showLoans();
        }
      };
    });
  }

  bindActions();
};
