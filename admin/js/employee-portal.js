/* ─────────────────────────────────────────────────────────────────────
   employee-portal.js — بوابة الموظف
   ───────────────────────────────────────────────────────────────────── */
HR.pages.employee = {
  title: 'بوابتي',
  icon: 'users',

  async render(root) {
    const { store, ui } = HR, esc = ui.esc;
    const empId = HR.user.employeeId;

    if (!empId) {
      root.innerHTML =
        '<div class="card" style="text-align:center;padding:32px">' +
          '<div style="font-size:48px;margin-bottom:12px">🔗</div>' +
          '<h3>لم يتم ربط حسابك بموظف</h3>' +
          '<p style="color:var(--mu)">تواصل مع HR لربط حسابك بملفك الوظيفي</p>' +
        '</div>';
      return;
    }

    const [allEmps, allLeaves, allLines, allRuns, allRequests, rules, cfg] = await Promise.all([
      store.list('employees'),
      store.list('leaves'),
      store.list('lines'),
      store.list('runs'),
      store.list('requests').catch(() => []),
      HR.leaves.load(),
      HR.payroll.load()
    ]);

    const e       = allEmps.find(x => x.id === empId);
    if (!e) { root.innerHTML = '<div class="card em">لم يتم العثور على بيانات الموظف</div>'; return; }

    const mgr      = allEmps.find(x => x.id === e.managerId);
    const myLeaves = allLeaves.filter(l => l.empId === empId);
    const myReqs   = allRequests.filter(r => r.empId === empId);
    const pay      = cfg.rules;
    const today    = ui.today();
    const col      = ['#c9933a','#7c3aed','#0891b2','#16a34a','#d97706'][e.name.length % 5];

    /* رصيد الإجازات */
    const balances = rules.types.map(t => {
      const b = HR.leaves.balance(e, t.name, today, allLeaves, rules, pay);
      return { ...b, name: t.name, color: t.color };
    });

    /* آخر راتب */
    const myLines  = allLines.filter(l => l.empId === empId);
    const lastLine = myLines
      .map(l => ({ line: l, run: allRuns.find(r => r.id === l.runId) }))
      .filter(x => x.run && (x.run.status === 'approved' || x.run.status === 'paid'))
      .sort((a, b) => b.run.month > a.run.month ? 1 : -1)[0];

    /* السلف النشطة */
    const myLoans  = myReqs.filter(r => r.type === 'loan' && r.status !== 'مرفوضة');
    const loanLeft = myLoans.reduce((s, r) => s + (r.remaining || 0), 0);

    const statusTag = (s, map) => ui.tag(s, (map || {
      'معلقة': 'wa', 'معلقة HR': 'wa', 'موافق عليها': 'ok', 'مرفوضة': 'da', 'مكتملة': 'mu'
    })[s] || 'mu');

    /* ── UI ── */
    root.innerHTML =

      /* بطاقة الموظف */
      '<div class="card pc">' +
        '<div class="pav">' +
          (e.photo
            ? '<img class="av lazy-photo" data-photo="' + esc(e.photo) + '" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin:0 auto 8px;display:block">'
            : '<span class="av" style="width:80px;height:80px;border-radius:50%;background:' + col + ';display:flex;align-items:center;justify-content:center;color:#fff;font-size:32px;font-weight:900;margin:0 auto 8px">' + e.name.trim()[0] + '</span>') +
        '</div>' +
        '<div class="pi">' +
          '<h1>' + esc(e.name) + '</h1>' +
          '<p>' + esc(e.title || '') + ' · ' + esc(e.dept || '') + '</p>' +
          '<div class="meta">' +
            (mgr ? '<span>المدير: <b>' + esc(mgr.name) + '</b></span>' : '') +
            '<span>تاريخ التعيين: ' + (e.hire || '—') + '</span>' +
            (e.phone ? '<span>' + esc(e.phone) + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +

      /* KPIs */
      '<div class="kpi-row">' +
        balances.slice(0, 2).map(b =>
          '<div class="kpi-card" style="--kc:' + b.color + '">' +
            '<div class="kpi-ic" style="background:' + b.color + '20;color:' + b.color + '">' + ui.icon('calendar') + '</div>' +
            '<div class="kpi-val">' + (b.unlimited ? '∞' : b.remaining) + '</div>' +
            '<div class="kpi-lbl">' + esc(b.name) + ' متبقي</div>' +
          '</div>'
        ).join('') +
        (lastLine
          ? '<div class="kpi-card" style="--kc:#c9933a"><div class="kpi-ic" style="background:#fdf6e7;color:#c9933a">' + ui.icon('wallet') + '</div><div class="kpi-val">' + ui.money(lastLine.line.data.calc.net) + '</div><div class="kpi-lbl">آخر راتب صافي</div></div>'
          : '') +
        (loanLeft > 0
          ? '<div class="kpi-card" style="--kc:#ef4444"><div class="kpi-ic" style="background:#fef2f2;color:#ef4444">' + ui.icon('wallet') + '</div><div class="kpi-val">' + ui.money(loanLeft) + '</div><div class="kpi-lbl">سلف متبقية</div></div>'
          : '') +
      '</div>' +

      /* أزرار الطلبات السريعة */
      '<div class="card">' +
        '<h3 style="margin-bottom:16px">📋 الطلبات السريعة</h3>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<button class="btn" data-a="req-leave">🏖️ طلب إجازة</button>' +
          '<button class="btn ghost" data-a="req-loan">💰 طلب سلفة</button>' +
          '<button class="btn ghost" data-a="req-overtime">⏰ عمل إضافي</button>' +
          '<button class="btn ghost" data-a="req-change">📝 تغيير بيانات</button>' +
        '</div>' +
      '</div>' +

      /* إجازاتي */
      '<div class="card">' +
        '<div class="ph" style="margin-bottom:14px">' +
          '<h3 style="margin:0">🏖️ إجازاتي</h3>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin-bottom:16px">' +
          balances.map(b =>
            '<div style="background:' + b.color + '12;border:1.5px solid ' + b.color + '30;border-radius:10px;padding:12px">' +
              '<div style="font-weight:800;color:' + b.color + ';margin-bottom:4px">' + esc(b.name) + '</div>' +
              (b.unlimited
                ? '<div style="font-size:13px;color:var(--mu)">غير محدود · مستخدم: ' + b.used + ' يوم</div>'
                : '<div style="font-size:13px"><b style="font-size:20px">' + b.remaining + '</b> متبقي من ' + b.total +
                  (b.pending ? ' <span style="color:var(--mu);font-size:11px">(+' + b.pending + ' معلق)</span>' : '') + '</div>') +
            '</div>'
          ).join('') +
        '</div>' +
        (myLeaves.length
          ? '<div class="tw"><table>' +
              '<tr><th>النوع</th><th>من</th><th>إلى</th><th>الأيام</th><th>الحالة</th><th>ملاحظة</th></tr>' +
              myLeaves.slice().reverse().slice(0, 8).map(l =>
                '<tr><td>' + esc(l.type) + '</td><td>' + l.from + '</td><td>' + l.to + '</td>' +
                '<td><b>' + l.days + '</b></td><td>' + statusTag(l.status) + '</td>' +
                '<td style="font-size:12px;color:var(--mu)">' +
                  (l.status === 'مرفوضة' && l.rejectReason ? '❌ ' + esc(l.rejectReason) : '') +
                '</td></tr>'
              ).join('') +
            '</table></div>'
          : '<div class="em" style="padding:12px;text-align:center">لا توجد طلبات إجازة</div>') +
      '</div>' +

      /* طلباتي الأخرى */
      '<div class="card">' +
        '<h3 style="margin-bottom:14px">📋 طلباتي الأخرى</h3>' +
        (myReqs.length
          ? '<div class="tw"><table>' +
              '<tr><th>النوع</th><th>التفاصيل</th><th>التاريخ</th><th>الحالة</th><th>ملاحظة HR</th></tr>' +
              myReqs.slice().reverse().map(r => {
                const typeLabel = { loan: '💰 سلفة', overtime: '⏰ عمل إضافي', change: '📝 تغيير بيانات' }[r.type] || r.type;
                const detail = r.type === 'loan'
                  ? ui.money(r.amount) + (r.months ? ' · ' + r.months + ' شهر' : '')
                  : r.type === 'overtime'
                  ? r.hours + ' ساعة · ' + r.date
                  : r.field + ': ' + esc(r.newValue || '');
                return '<tr><td>' + typeLabel + '</td><td style="font-size:13px">' + detail + '</td>' +
                  '<td style="font-size:12px;color:var(--mu)">' + (r.createdAt || '').slice(0,10) + '</td>' +
                  '<td>' + statusTag(r.status) + '</td>' +
                  '<td style="font-size:12px;color:var(--mu)">' + esc(r.hrNote || '') + '</td></tr>';
              }).join('') +
            '</table></div>'
          : '<div class="em" style="padding:12px;text-align:center">لا توجد طلبات</div>') +
      '</div>' +

      /* الرواتب */
      '<div class="card">' +
        '<h3 style="margin-bottom:14px">💰 الرواتب</h3>' +
        (myLines.length
          ? '<div class="tw"><table>' +
              '<tr><th>الشهر</th><th>الإجمالي</th><th>الخصومات</th><th>الصافي</th><th>الحالة</th></tr>' +
              myLines.map(l => ({ line: l, run: allRuns.find(r => r.id === l.runId) }))
                .filter(x => x.run)
                .sort((a, b) => b.run.month > a.run.month ? 1 : -1)
                .slice(0, 6)
                .map(x =>
                  '<tr><td>' + x.run.month + '</td>' +
                  '<td>' + ui.money(x.line.data.calc.gross) + '</td>' +
                  '<td>' + ui.money(x.line.data.calc.deductions) + '</td>' +
                  '<td><b class="net">' + ui.money(x.line.data.calc.net) + '</b></td>' +
                  '<td>' + ui.tag(x.run.status === 'paid' ? 'مصروف' : 'معتمد', 'ok') + '</td></tr>'
                ).join('') +
            '</table></div>'
          : '<div class="em" style="padding:12px;text-align:center">لا توجد رواتب معتمدة بعد</div>') +
      '</div>';

    /* ── Events ── */
    root.onclick = async ev => {
      const btn = ev.target.closest('[data-a]'); if (!btn) return;
      const a = btn.dataset.a;

      /* ── طلب إجازة ── */
      if (a === 'req-leave') {
        const o = await ui.form('طلب إجازة', [
          { n: 'type', l: 'نوع الإجازة', opts: rules.types.map(t => [t.name, t.name]), req: 1 },
          { n: 'from', l: 'من', t: 'date', req: 1 },
          { n: 'to',   l: 'إلى', t: 'date', req: 1 },
          { n: 'note', l: 'ملاحظات' }
        ], { from: today, to: today });
        if (!o) return;
        if (o.from > o.to) return ui.toast('تاريخ البداية بعد النهاية!');
        o.days   = HR.leaves.workdays(o.from, o.to, pay);
        o.empId  = empId;
        o.status = mgr ? 'معلقة' : 'معلقة HR';
        const bal = HR.leaves.balance(e, o.type, today, allLeaves, rules, pay);
        if (!bal.unlimited && o.days > bal.remaining) {
          if (!confirm('الرصيد المتبقي (' + bal.remaining + ' يوم) أقل من المطلوب (' + o.days + '). تأكيد؟')) return;
        }
        await store.create('leaves', o);
        ui.toast('✅ تم رفع طلب الإجازة' + (mgr ? ' — في انتظار ' + mgr.name : ' — في انتظار HR'));
        HR.refresh();
      }

      /* ── طلب سلفة ── */
      if (a === 'req-loan') {
        const o = await ui.form('💰 طلب سلفة', [
          { n: 'amount', l: 'المبلغ المطلوب',   t: 'number', req: 1 },
          { n: 'months', l: 'السداد على (شهور)', t: 'number', req: 1, placeholder: '12' },
          { n: 'reason', l: 'سبب الطلب',        req: 1 }
        ]);
        if (!o) return;
        if (+o.amount <= 0) return ui.toast('المبلغ يجب أن يكون أكبر من صفر');
        if (+o.months <= 0) return ui.toast('عدد الأشهر يجب أن يكون أكبر من صفر');
        await store.create('requests', {
          type: 'loan', empId, status: 'معلقة',
          amount: +o.amount, months: +o.months,
          remaining: +o.amount,
          reason: o.reason,
          createdAt: new Date().toISOString()
        });
        ui.toast('✅ تم رفع طلب السلفة — في انتظار الموافقة');
        HR.refresh();
      }

      /* ── عمل إضافي ── */
      if (a === 'req-overtime') {
        const o = await ui.form('⏰ طلب عمل إضافي', [
          { n: 'date',  l: 'التاريخ',       t: 'date',   req: 1 },
          { n: 'hours', l: 'عدد الساعات',   t: 'number', req: 1, placeholder: '2' },
          { n: 'note',  l: 'سبب / تفاصيل', req: 1 }
        ], { date: today });
        if (!o) return;
        if (+o.hours <= 0) return ui.toast('عدد الساعات يجب أن يكون أكبر من صفر');
        await store.create('requests', {
          type: 'overtime', empId, status: 'معلقة',
          date: o.date, hours: +o.hours,
          note: o.note,
          createdAt: new Date().toISOString()
        });
        ui.toast('✅ تم رفع طلب العمل الإضافي — في انتظار الموافقة');
        HR.refresh();
      }

      /* ── تغيير بيانات ── */
      if (a === 'req-change') {
        const o = await ui.form('📝 طلب تغيير بيانات', [
          { n: 'field', l: 'الحقل المطلوب تغييره', opts: [
            ['phone',  'رقم الهاتف'],
            ['bank',   'الحساب البنكي'],
            ['email',  'الإيميل'],
            ['address','العنوان'],
            ['other',  'أخرى']
          ], req: 1 },
          { n: 'newValue', l: 'القيمة الجديدة', req: 1 },
          { n: 'note',     l: 'ملاحظات إضافية' }
        ]);
        if (!o) return;
        await store.create('requests', {
          type: 'change', empId, status: 'معلقة',
          field: o.field, newValue: o.newValue,
          note: o.note,
          createdAt: new Date().toISOString()
        });
        ui.toast('✅ تم رفع طلب تغيير البيانات — في انتظار HR');
        HR.refresh();
      }
    };
  }
};
