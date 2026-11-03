HR.pages.audit = {
  title: 'سجل التعديلات', icon: 'list',
  async render(root) {
    const { store, ui, state: st } = HR, esc = ui.esc;
    if (HR.mode !== 'supabase') { root.innerHTML = ui.head('سجل التعديلات', 'مين غيّر إيه ومتى', '') + '<div class="card em">سجل التعديلات بيشتغل مع قاعدة البيانات الحقيقية فقط (مش في الوضع التجريبي).</div>'; return; }
    const [L, E] = await Promise.all([store.audit(400), store.list('employees')]);
    const TB = { employees: 'الموظفون', attendance: 'الحضور', leaves: 'الإجازات', payroll_adjustments: 'الرواتب', reviews: 'التقييمات', documents: 'المستندات', timeline: 'السجل الوظيفي', candidates: 'المرشحون', profiles: 'المستخدمون' };
    const F = { name: 'الاسم', title: 'الوظيفة', dept: 'القسم', salary: 'الراتب', allowances: 'البدلات', status: 'الحالة', role: 'الدور', employee_id: 'الموظف المربوط', hire: 'تاريخ التعيين', phone: 'الموبايل', email: 'الإيميل', nid: 'الرقم القومي', contract_type: 'نوع العقد', contract_end: 'نهاية العقد', manager_id: 'المدير', bank: 'البنك', iban: 'IBAN', bonus: 'مكافأة', absent: 'أيام غياب', other: 'خصومات أخرى', received: 'تاريخ الاستلام', expiry: 'تاريخ الانتهاء', check_in: 'الحضور', check_out: 'الانصراف', from_date: 'من', to_date: 'إلى', avg: 'المتوسط', stage: 'المرحلة' };
    const A = { INSERT: ['إضافة', 'ok'], UPDATE: ['تعديل', 'wa'], DELETE: ['حذف', 'da'] };
    const nm = id => (E.find(e => e.id === id) || {}).name;
    const who = r => { const d = r.new_data || r.old_data || {}; return r.table_name === 'employees' ? (d.name || nm(r.row_id)) : r.table_name === 'profiles' ? d.email : nm(d.emp_id) || d.name || ''; };
    const v = x => x === null || x === '' || x === undefined ? 'فاضي' : String(x).slice(0, 40);
    const tf = st.atb || '', q = st.aq || '';
    const rows = L.filter(r => (!tf || r.table_name === tf) && (!q || (who(r) + (r.user_email || '')).includes(q)));
    root.innerHTML = ui.head('سجل التعديلات', 'آخر ' + L.length + ' عملية، بتتسجل تلقائيًا من قاعدة البيانات ومش ممكن تتعدل',
      '<input id="aq" placeholder="بحث باسم أو مستخدم" value="' + esc(q) + '"><select id="atb"><option value="">كل الأقسام</option>' + Object.keys(TB).map(k => '<option value="' + k + '"' + (k === tf ? ' selected' : '') + '>' + TB[k] + '</option>').join('') + '</select>') +
      '<div class="card tw"><table><tr><th>الوقت</th><th>بواسطة</th><th>العملية</th><th>القسم</th><th>السجل</th><th>التفاصيل</th></tr>' + rows.map(r => {
        let det = '';
        if (r.action === 'UPDATE') det = Object.keys(r.new_data || {}).filter(k => k !== 'created_at').slice(0, 4).map(k => (F[k] || k) + ': ' + v((r.old_data || {})[k]) + ' ← ' + v(r.new_data[k])).join(' | ');
        else det = r.action === 'INSERT' ? 'سجل جديد' : 'تم الحذف';
        return '<tr><td>' + new Date(r.at).toLocaleString('ar-EG') + '</td><td>' + esc(r.user_email || 'النظام') + '</td><td>' + ui.tag(...A[r.action]) + '</td><td>' + (TB[r.table_name] || r.table_name) + '</td><td>' + esc(who(r) || '—') + '</td><td style="white-space:normal;min-width:260px">' + esc(det) + '</td></tr>';
      }).join('') + '</table>' + (rows.length ? '' : '<div class="em">لا توجد عمليات مطابقة</div>') + '</div>';
    root.querySelector('#atb').onchange = e => { st.atb = e.target.value; HR.refresh(); };
    root.querySelector('#aq').oninput = e => { st.aq = e.target.value; HR.refresh().then(() => { const i = document.querySelector('#aq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); };
  }
};
