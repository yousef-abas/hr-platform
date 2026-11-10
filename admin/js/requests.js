/* ─────────────────────────────────────────────────────────────────────
   requests.js — إدارة الطلبات (سلف · أوفر تايم · تغيير بيانات)
   لـ HR / Admin فقط
   ───────────────────────────────────────────────────────────────────── */
HR.pages.requests = {
  title: 'الطلبات',
  icon:  'list',

  async render(root) {

    const empById  = id => allEmps.find(e => e.id === id) || { name: '—' };
    const tab      = HR.state.reqTab || 'loan';
    const myRole   = HR.user.role;
    const myDept   = HR.user.managedDept;

    /* فلترة حسب الدور — HR/Admin يشوف الكل، مدير/مشرف يشوف قسمه بس */
    const visibleEmps = (myRole === 'manager' || myRole === 'supervisor') && myDept
      ? allEmps.filter(e => e.dept === myDept)
      : allEmps;
    const visibleIds  = new Set(visibleEmps.map(e => e.id));


    /* فلتر الطلبات للأدوار المقيدة */
    const myReqs = allReqs.filter(r => visibleIds.has(r.empId));

    const tabs = [
      { k: 'loan',     label: '💰 سلف',           count: myReqs.filter(r => r.type === 'loan'     && r.status === 'معلقة').length },
      { k: 'overtime', label: '⏰ عمل إضافي',      count: myReqs.filter(r => r.type === 'overtime' && r.status === 'معلقة').length },
      { k: 'change',   label: '📝 تغيير بيانات',   count: myReqs.filter(r => r.type === 'change'   && r.status === 'معلقة').length },
    ];

    const rows = myReqs.filter(r => r.type === tab).sort((a, b) => (b.createdAt || '') > (a.createdAt || '') ? 1 : -1);


    const statusTag = s => ui.tag(s, { 'معلقة': 'wa', 'موافق عليها': 'ok', 'مرفوضة': 'da', 'مكتملة': 'mu' }[s] || 'mu');

    const tableBody = () => {
      if (!rows.length) return '<tr><td colspan="8" style="text-align:center;color:var(--mu);padding:20px">لا توجد طلبات</td></tr>';

      if (tab === 'loan') return rows.map(r =>
        '<tr data-id="' + esc(r.id) + '">' +
          '<td>' + ui.who(empById(r.empId)) + '</td>' +
          '<td><b>' + ui.money(r.amount) + '</b></td>' +
          '<td>' + (r.months || '—') + ' شهر</td>' +
          '<td>' + ui.money(Math.round((r.amount||0) / (r.months||1))) + '/شهر</td>' +
          '<td style="font-size:12px;max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(r.reason || '') + '</td>' +
          '<td style="font-size:12px;color:var(--mu)">' + (r.createdAt || '').slice(0,10) + '</td>' +
          '<td>' + statusTag(r.status) + '</td>' +
          '<td>' + (r.status === 'معلقة'
            ? '<div style="display:flex;gap:6px"><button class="btn sm" data-a="ok">✓ موافقة</button><button class="btn danger sm" data-a="no">✗ رفض</button></div>'
            : '') +
          '</td>' +
        '</tr>'
      ).join('');

      if (tab === 'overtime') return rows.map(r =>
        '<tr data-id="' + esc(r.id) + '">' +
          '<td>' + ui.who(empById(r.empId)) + '</td>' +
          '<td>' + (r.date || '') + '</td>' +
          '<td><b>' + (r.hours || 0) + '</b> ساعة</td>' +
          '<td style="font-size:12px;max-width:160px">' + esc(r.note || '') + '</td>' +
          '<td style="font-size:12px;color:var(--mu)">' + (r.createdAt || '').slice(0,10) + '</td>' +
          '<td>' + statusTag(r.status) + '</td>' +
          '<td>' + (r.status === 'معلقة'
            ? '<div style="display:flex;gap:6px"><button class="btn sm" data-a="ok">✓ موافقة</button><button class="btn danger sm" data-a="no">✗ رفض</button></div>'
            : '') +
          '</td>' +
        '</tr>'
      ).join('');

      if (tab === 'change') return rows.map(r => {
        const fieldLabel = { phone: 'الهاتف', bank: 'الحساب البنكي', email: 'الإيميل', address: 'العنوان', other: 'أخرى' }[r.field] || r.field;
        return (
          '<tr data-id="' + esc(r.id) + '">' +
            '<td>' + ui.who(empById(r.empId)) + '</td>' +
            '<td>' + esc(fieldLabel) + '</td>' +
            '<td style="font-size:13px">' + esc(r.newValue || '') + '</td>' +
            '<td style="font-size:12px;color:var(--mu);max-width:120px">' + esc(r.note || '') + '</td>' +
            '<td style="font-size:12px;color:var(--mu)">' + (r.createdAt || '').slice(0,10) + '</td>' +
            '<td>' + statusTag(r.status) + '</td>' +
            '<td>' + (r.status === 'معلقة'
              ? '<div style="display:flex;gap:6px"><button class="btn sm" data-a="ok">✓ موافقة وتطبيق</button><button class="btn danger sm" data-a="no">✗ رفض</button></div>'
              : '') +
            '</td>' +
          '</tr>'
        );
      }).join('');

      return '';
    };

    const colsMap = {
      loan:     '<tr><th>الموظف</th><th>المبلغ</th><th>المدة</th><th>القسط</th><th>السبب</th><th>التاريخ</th><th>الحالة</th><th></th></tr>',
      overtime: '<tr><th>الموظف</th><th>التاريخ</th><th>الساعات</th><th>التفاصيل</th><th>مقدم في</th><th>الحالة</th><th></th></tr>',
      change:   '<tr><th>الموظف</th><th>الحقل</th><th>القيمة الجديدة</th><th>ملاحظات</th><th>مقدم في</th><th>الحالة</th><th></th></tr>',
    };

    root.innerHTML =
      '<div class="ph" style="margin-bottom:20px">' +
        '<div><h2 style="margin:0">📋 الطلبات</h2><p style="color:var(--mu);margin:4px 0 0">طلبات الموظفين — سلف · أوفر تايم · تغيير بيانات</p></div>' +
      '</div>' +

      /* Tabs */
      '<div class="tabs" style="margin-bottom:16px">' +
        tabs.map(t =>
          '<button class="tab' + (t.k === tab ? ' on' : '') + '" data-t="' + t.k + '">' +
            t.label +
            (t.count ? ' <span class="badge-count">' + t.count + '</span>' : '') +
          '</button>'
        ).join('') +
      '</div>' +

      /* Table */
      '<div class="card">' +
        '<div class="tw"><table>' +
          colsMap[tab] +
          tableBody() +
        '</table></div>' +
      '</div>';

    /* Events */
    root.onclick = async ev => {
      const btn = ev.target.closest('[data-t],[data-a]'); if (!btn) return;

      /* تبديل tab */
      if (btn.dataset.t) {
        HR.state.reqTab = btn.dataset.t;
        HR.refresh();
        return;
      }

      const a   = btn.dataset.a;
      const row = btn.closest('[data-id]');
      const id  = row && row.dataset.id;
      const req = allReqs.find(r => r.id === id);
      if (!req) return;

      if (a === 'ok') {
        /* تغيير بيانات — طبّق التغيير على الموظف */
        if (req.type === 'change') {
          const emp = empById(req.empId);
          const fieldMap = { phone: 'phone', bank: 'bankAccount', email: 'email', address: 'address' };
          const dbField  = fieldMap[req.field];
          if (dbField && emp.id) {
            await store.update('employees', emp.id, { [dbField]: req.newValue });
          }
        }
        const note = req.type === 'loan' ? await ui.prompt('ملاحظة (اختياري)') : null;
        if (note === null && req.type === 'loan') return;
        await store.update('requests', id, {
          status:  'موافق عليها',
          hrNote:  note || '',
          hrBy:    HR.user.email,
          hrAt:    new Date().toISOString()
        });
        ui.toast('✅ تمت الموافقة');
        HR.refresh();
      }

      if (a === 'no') {
        const reason = await ui.prompt('سبب الرفض (اختياري)');
        if (reason === null) return;
        await store.update('requests', id, {
          status:  'مرفوضة',
          hrNote:  reason,
          hrBy:    HR.user.email,
          hrAt:    new Date().toISOString()
        });
        ui.toast('تم رفض الطلب');
        HR.refresh();
      }
    };
  }
};
