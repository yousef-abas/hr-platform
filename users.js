HR.pages.users = {
  title: 'المستخدمون', icon: 'shield',
  async render(root) {
    const { store, ui } = HR;
    const [U, E] = await Promise.all([store.list('profiles'), store.list('employees')]);
    const R = [['admin', 'مدير النظام'], ['hr', 'موارد بشرية'], ['employee', 'موظف']];
    root.innerHTML = ui.head('المستخدمون والصلاحيات', 'حدد دور كل حساب وربطه بالموظف', '') +
      '<div class="card tw"><table><tr><th>الحساب</th><th>الدور</th><th>مربوط بالموظف</th></tr>' + U.map(u => '<tr data-id="' + u.id + '"><td><b>' + ui.esc(u.fullName || u.email) + '</b><br><small style="color:var(--mu)">' + ui.esc(u.email) + '</small></td><td><select data-f="role">' +
        R.map(r => '<option value="' + r[0] + '"' + (u.role === r[0] ? ' selected' : '') + '>' + r[1] + '</option>').join('') + '</select></td><td><select data-f="employeeId"><option value="">بدون</option>' +
        E.map(e => '<option value="' + e.id + '"' + (u.employeeId === e.id ? ' selected' : '') + '>' + ui.esc(e.name) + '</option>').join('') + '</select></td></tr>').join('') + '</table></div>' +
      '<div class="card"><h3>إضافة مستخدم جديد</h3><ol style="line-height:2;margin:0;padding-right:20px"><li>في Supabase افتح <b>Authentication ← Users ← Add user</b>.</li><li>اكتب الإيميل والباسورد وفعّل <b>Auto Confirm User</b>.</li><li>ارجع هنا وحدّث الصفحة، هيظهر الحساب في الجدول، وحدد دوره وربطه بالموظف.</li></ol>' +
      '<p style="color:var(--mu);font-size:13px">إنشاء الحسابات من جوه النظام محتاج مفتاح سري ما ينفعش يتحط في المتصفح، فهيتعمل لاحقًا بشكل آمن. أي حساب جديد دوره "موظف" تلقائيًا ومش بيدخل لوحة الإدارة.</p></div>';
    root.onchange = async e => {
      const t = e.target; if (!t.dataset.f) return;
      const id = t.closest('tr').dataset.id, u = U.find(x => x.id === id);
      if (t.dataset.f === 'role' && u.id === (HR.user && HR.user.id) && t.value !== 'admin' && !confirm('هتشيل صلاحية المدير من حسابك أنت. متأكد؟')) { t.value = u.role; return; }
      await store.update('profiles', id, { [t.dataset.f]: t.value }); ui.toast('تم الحفظ'); HR.refresh();
    };
  }
};
