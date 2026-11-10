/* شاشة قواعد الرواتب: كل بند قابل للتعديل، مع معاينة حية على موظف حقيقي */
HR.payrollRules = async function (root) {
  const { store, ui, state: st } = HR, P = HR.payroll, esc = ui.esc, isAdmin = HR.user.role === 'admin' || HR.user.role === 'hr';
  const month = st.pmonth || ui.today().slice(0, 7);
  const [E0, A0, L0, ADJ, LOANS, cfg, LRULES] = await Promise.all([store.list('employees'), store.list('attendance'), store.list('leaves'), store.list('payroll'), store.list('loans'), P.load(), HR.leaves.load()]);
  const W = { rules: JSON.parse(JSON.stringify(cfg.rules)), state: JSON.parse(JSON.stringify(cfg.state)) };
  const emps = E0.filter(e => e.status !== 'terminated'), unpaidTypes = HR.leaves.unpaidTypes(LRULES);
  let unlocked = false, pv = emps.length ? emps[0].id : '';
  const get = p => p.split('.').reduce((o, k) => o == null ? o : o[k], W);
  const set = (p, v) => { const k = p.split('.'), last = k.pop(); k.reduce((o, x) => o[x], W)[last] = v; };
  const dis = (locked) => (!isAdmin || locked) ? ' disabled' : '';
  const num = (p, l, o) => '<label>' + l + '<input type="number" step="any" data-p="' + p + '" data-t="' + ((o && o.blank) ? 'nn' : 'n') + '" value="' + esc(get(p) == null ? '' : get(p)) + '"' + dis(o && o.lock) + '></label>';
  const txt = (p, l, o) => '<label>' + l + '<input type="' + ((o && o.type) || 'text') + '" data-p="' + p + '" data-t="s" value="' + esc(get(p) || '') + '"' + dis(o && o.lock) + '></label>';
  const chk = (p, l, o) => '<label class="ck"><input type="checkbox" data-p="' + p + '" data-t="b"' + (get(p) ? ' checked' : '') + dis(o && o.lock) + '>' + l + '</label>';
  const sel = (p, l, opts, o) => '<label>' + l + '<select data-p="' + p + '" data-t="' + ((o && o.t) || 's') + '"' + dis(o && o.lock) + '>' + opts.map(x => '<option value="' + x[0] + '"' + (String(get(p)) === String(x[0]) ? ' selected' : '') + '>' + x[1] + '</option>').join('') + '</select></label>';
  const del = (arr, i, lock) => (!isAdmin || lock) ? '' : '<button class="btn danger sm" data-del="' + arr + ':' + i + '">حذف</button>';
  const add = (arr, t, lock) => (!isAdmin || lock) ? '' : '<button class="btn ghost sm" data-add="' + arr + '">' + t + '</button>';

  const totals = (rules, state) => { const per = P.period(month, rules); return emps.reduce((o, e) => { const c = P.calc(e, { rules, state, adj: ADJ.find(a => a.empId === e.id && a.month === month), att: A0.filter(a => a.empId === e.id && a.date >= per.start && a.date <= per.end), leaves: L0.filter(l => l.empId === e.id), loans: LOANS.filter(l => l.empId === e.id), unpaidTypes, month, period: per, today: ui.today() }); o.net += c.net; o.cost += c.cost; return o; }, { net: 0, cost: 0 }); };
  const base = totals(cfg.rules, cfg.state);
  function whatIf() {
    const now = totals(W.rules, W.state), dn = Math.round(now.net - base.net), dc = Math.round(now.cost - base.cost);
    return '<div class="al ' + (dc > 0 ? 'wa' : 'ok') + '" style="display:block"><b>الأثر على الشركة كلها (' + emps.length + ' موظف):</b><div style="font-weight:400;margin-top:4px">صافي الرواتب: ' + ui.money(base.net) + ' ← ' + ui.money(now.net) + ' (' + (dn >= 0 ? '+' : '−') + ui.money(Math.abs(dn)) + ')<br>تكلفة الشركة: ' + ui.money(base.cost) + ' ← ' + ui.money(now.cost) + ' (' + (dc >= 0 ? '+' : '−') + ui.money(Math.abs(dc)) + ')</div></div>';
  }
  function pvHtml() {
    const e = emps.find(x => x.id === pv); if (!e) return '<div class="em">أضف موظفين لتجربة القواعد عليهم</div>';
    const per = P.period(month, W.rules);
    const c = P.calc(e, { rules: W.rules, state: W.state, adj: ADJ.find(a => a.empId === e.id && a.month === month), att: A0.filter(a => a.empId === e.id && a.date >= per.start && a.date <= per.end), leaves: L0.filter(l => l.empId === e.id), loans: LOANS.filter(l => l.empId === e.id), unpaidTypes, month, period: per, today: ui.today() });
    const ln = t => c.lines.filter(l => l.t === t).map(l => '<div class="ln"><span>' + esc(l.label) + (l.note ? '<small>' + esc(l.note) + '</small>' : '') + '</span><b>' + ui.money(l.amount) + '</b></div>').join('') || '<div class="em" style="padding:4px">لا يوجد</div>';
    return whatIf() + '<div class="bd" style="grid-template-columns:1fr"><div><h4>المستحقات</h4>' + ln('earn') + '</div><div><h4>الخصومات</h4>' + ln('ded') + '</div></div><div class="ln tot" style="display:flex;justify-content:space-between;font-size:18px;font-weight:800;border-top:2px solid var(--ln);padding-top:8px;margin-top:8px"><span>الصافي</span><span class="net">' + ui.money(c.net) + '</span></div>' +
      '<div style="color:var(--mu);font-size:12px;margin-top:6px">قيمة اليوم ' + ui.money(c.meta.dayValue) + ' • الفترة ' + per.start + ' إلى ' + per.end + '</div>' + (c.flags.length ? '<div class="al wa" style="margin-top:8px">' + esc(c.flags.join('، ')) + '</div>' : '');
  }
  const drawPv = () => { const el = root.querySelector('#pvb'); if (el) el.innerHTML = pvHtml(); };

  function draw() {
    const R = W.rules, A = R.attendance, items = R.items || [], I = W.state.insurance, T = W.state.tax, L = !unlocked;
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    // [تحسين #4] تحذير واضح لو الضريبة معطّلة أو مفيش شرائح
    const taxWarning = (!T.enabled || !(T.brackets || []).length)
      ? '<div class="al wa" style="margin:0 0 14px"><b>⚠️ ضريبة كسب العمل ' + (!T.enabled ? 'معطّلة' : 'مفعّلة بدون شرائح') + '</b><div style="font-weight:400;margin-top:4px">راجع مع محاسبك وأدخل شرائح الدخل السنوية، ثم فعّل الضريبة. بدونها الرواتب لا تخصم الضريبة.</div></div>'
      : '';

    root.innerHTML = ui.head('قواعد الرواتب', isAdmin ? 'كل بند هنا قابل للتعديل، والنتيجة بتظهر فورًا على اليمين' : 'عرض فقط: تعديل القواعد للمدير', '<button class="btn ghost" data-a="back">رجوع للرواتب</button>') +
      taxWarning +
      '<div class="rl"><div>' +
      '<div class="card rcard"><h3>الدورة والحساب</h3><div class="fg">' + txt('rules.company.name', 'اسم الشركة (يظهر في القسايم)') + num('rules.startDay', 'يوم بداية الشهر (1 = شهر كامل)') + sel('rules.daysBasis', 'أساس أيام الشهر', [['30', '30 يوم ثابتة'], ['actual', 'الأيام الفعلية']], { t: 'days' }) + num('rules.hoursPerDay', 'ساعات اليوم') + sel('rules.dayValueBase', 'قيمة اليوم من', [['basic+allow', 'الأساسي + البدلات'], ['basic', 'الأساسي فقط']]) + sel('rules.rounding', 'التقريب', [['two', 'قرشين'], ['integer', 'لأقرب جنيه'], ['none', 'من غير تقريب']]) + '</div>' +
      '<div class="fg" style="margin-top:14px">' + chk('rules.proration.enabled', 'راتب جزئي للموظف المعيّن أو المنتهية خدمته في نص الشهر') + chk('rules.proration.insurance', 'التأمينات كمان بالتناسب (غير مفعّل = على الأجر كامل)') + '</div><p style="margin:14px 0 6px;color:var(--mu);font-size:13px">أيام الإجازة الأسبوعية</p><div class="fg">' + days.map((d, i) => '<label class="ck"><input type="checkbox" data-wk="' + i + '"' + (R.weekend.indexOf(i) > -1 ? ' checked' : '') + dis() + '>' + d + '</label>').join('') + '</div></div>' +
      '<div class="card rcard"><h3>بنود الراتب الإضافية <span>' + add('rules.items', '+ بند') + '</span></h3><p style="color:var(--mu);font-size:13px;margin-top:-6px">أي بدل أو عمولة أو خصم يتطبق على كل الموظفين (أو قسم معين).</p>' +
      (items.length ? items.map((it, i) => { const q = 'rules.items.' + i; return '<div class="rrow">' + txt(q + '.name', 'اسم البند') + sel(q + '.kind', 'النوع', [['earn', 'مستحق'], ['ded', 'خصم']]) + sel(q + '.calc', 'طريقة الحساب', [['fixed', 'مبلغ ثابت'], ['pctBasic', '% من الأساسي'], ['pctGross', '% من الإجمالي']]) + num(q + '.value', 'القيمة') + txt(q + '.dept', 'القسم (اختياري)') + chk(q + '.insurable', 'داخل في الأجر التأميني') + chk(q + '.active', 'مفعّل') + del('rules.items', i) + '</div>'; }).join('') : '<div class="em">لا توجد بنود إضافية</div>') + '</div>' +
      '<div class="card rcard"><h3>الأوفر تايم</h3><div class="fg">' + chk('rules.overtime.enabled', 'احتساب الأوفر تايم') + sel('rules.overtime.base', 'قيمة الساعة من', [['basic', 'الأساسي'], ['basic+allow', 'الأساسي + البدلات']]) + num('rules.overtime.rates.normal', 'معامل النهاري') + num('rules.overtime.rates.night', 'معامل الليلي') + num('rules.overtime.rates.rest', 'معامل الراحة الأسبوعية') + num('rules.overtime.rates.holiday', 'معامل العطلة الرسمية') + '</div><p style="color:var(--mu);font-size:12px">قيمة الساعة = الراتب ÷ أيام الشهر ÷ ساعات اليوم، ثم × المعامل. المعاملات الافتراضية للتجربة، اضبطها حسب سياسة شركتك.</p></div>' +
      '<div class="card rcard"><h3>الحضور والغياب والتأخير</h3><div class="fg">' + chk('rules.attendance.auto', 'احسب من سجل الحضور تلقائيًا') + txt('rules.attendance.shiftStart', 'بداية الدوام', { type: 'time' }) + num('rules.attendance.graceMin', 'فترة السماح (دقيقة)') + sel('rules.attendance.lateMode', 'طريقة خصم التأخير', [['tiers', 'شرائح'], ['perMinute', 'بالدقيقة'], ['off', 'بدون خصم']]) + num('rules.attendance.absenceFactor', 'معامل خصم يوم الغياب') + num('rules.attendance.perMinuteFactor', 'معامل خصم الدقيقة') + chk('rules.attendance.unpaidLeaveDeduct', 'اخصم الإجازة بدون مرتب') + '</div>' +
      (A.lateMode === 'tiers' ? '<p style="margin:14px 0 6px;color:var(--mu);font-size:13px">شرائح التأخير (بالدقايق من بداية الدوام) <span>' + add('rules.attendance.tiers', '+ شريحة') + '</span></p>' + (A.tiers || []).map((t, i) => '<div class="rrow">' + num('rules.attendance.tiers.' + i + '.from', 'من دقيقة') + num('rules.attendance.tiers.' + i + '.to', 'إلى دقيقة') + num('rules.attendance.tiers.' + i + '.days', 'خصم (يوم)') + del('rules.attendance.tiers', i) + '</div>').join('') : '') + '</div>' +
      '<div class="card rcard"><h3>العطلات الرسمية <span>' + add('rules.holidays', '+ عطلة') + '</span></h3>' + ((R.holidays || []).length ? R.holidays.map((h, i) => '<div class="rrow">' + txt('rules.holidays.' + i + '.date', 'التاريخ', { type: 'date' }) + txt('rules.holidays.' + i + '.name', 'الاسم') + del('rules.holidays', i) + '</div>').join('') : '<div class="em">لا توجد عطلات مسجلة</div>') + '</div>' +
      '<div class="card rcard lockcard' + (unlocked ? ' open' : '') + '"><h3>الثوابت الرسمية (تأمينات وضريبة) <span>' + (isAdmin ? (unlocked ? '<button class="btn ghost sm" data-a="lock">قفل</button> <button class="btn danger sm" data-a="official">استرجاع القيم الرسمية</button>' : '<button class="btn ghost sm" data-a="unlock">فتح للتعديل</button>') : '') + '</span></h3>' +
      '<p style="color:var(--mu);font-size:13px;margin-top:-6px">' + (unlocked ? 'مفتوحة للتعديل. أي تغيير هنا بيتسجل باسمك في سجل التعديلات.' : 'مقفولة لحمايتها من التعديل بالغلط. افتحها لما يتغير رقم رسمي.') + '</p>' +
      '<div class="fg">' + chk('state.insurance.enabled', 'احتساب التأمينات', { lock: L }) + num('state.insurance.employeeRate', 'حصة الموظف %', { lock: L }) + num('state.insurance.employerRate', 'حصة صاحب العمل %', { lock: L }) + num('state.insurance.minWage', 'الحد الأدنى للأجر التأميني', { lock: L }) + num('state.insurance.maxWage', 'الحد الأقصى للأجر التأميني', { lock: L }) + chk('state.insurance.includeAllowances', 'البدلات داخل في الأجر التأميني', { lock: L }) + txt('state.insurance.effectiveFrom', 'ساري من', { type: 'date', lock: L }) + '</div>' +
      '<p style="color:var(--mu);font-size:12px">' + esc(I.source || '') + '</p><hr style="border:0;border-top:1px solid var(--ln);margin:14px 0">' +
      '<div class="fg">' + chk('state.tax.enabled', 'احتساب ضريبة كسب العمل', { lock: L }) + num('state.tax.personalExemptionAnnual', 'الإعفاء الشخصي (سنوي)', { lock: L }) + '</div>' +
      '<p style="margin:12px 0 6px;color:var(--mu);font-size:13px">شرائح الضريبة السنوية <span>' + add('state.tax.brackets', '+ شريحة', L) + '</span></p>' +
      ((T.brackets || []).length ? T.brackets.map((b, i) => '<div class="rrow">' + num('state.tax.brackets.' + i + '.from', 'من (سنويًا)', { lock: L }) + num('state.tax.brackets.' + i + '.to', 'إلى (فاضي = بلا حد)', { lock: L, blank: 1 }) + num('state.tax.brackets.' + i + '.rate', 'النسبة %', { lock: L }) + del('state.tax.brackets', i, L) + '</div>').join('') : '<div class="em" style="padding:8px">لا توجد شرائح. أدخلها من المحاسب ثم فعّل الضريبة.</div>') +
      '<p style="color:var(--wa);font-size:12px">' + esc(T.note || '') + '</p></div>' +
      (isAdmin ? '<div class="savebar"><button class="btn ghost" data-a="back">إلغاء</button><button class="btn" data-a="save">حفظ القواعد</button></div>' : '') + '</div>' +
      '<div class="pv"><div class="card"><h3>جرّب على موظف</h3><label style="font-size:12px;color:var(--mu);display:block;margin-bottom:10px">الموظف<select id="pvs" style="width:100%;margin-top:2px">' + emps.map(e => '<option value="' + e.id + '"' + (e.id === pv ? ' selected' : '') + '>' + esc(e.name) + '</option>').join('') + '</select></label><div id="pvb"></div><p style="color:var(--mu);font-size:12px">النتيجة محسوبة بالقواعد اللي قدامك (حتى لو لسه ما اتحفظتش) على شهر ' + month + '.</p></div></div></div>';
    drawPv();
  }

  const conv = (el) => {
    const t = el.dataset.t;
    if (t === 'b') return el.checked;
    if (t === 'n') return el.value === '' ? 0 : Number(el.value);
    if (t === 'nn') return el.value === '' ? '' : Number(el.value);
    if (t === 'days') return el.value === 'actual' ? 'actual' : Number(el.value);
    return el.value;
  };
  root.oninput = root.onchange = e => {
    const el = e.target;
    if (el.id === 'pvs') { pv = el.value; drawPv(); return; }
    if (el.dataset.wk !== undefined) { const d = +el.dataset.wk, w = W.rules.weekend; const i = w.indexOf(d); if (el.checked && i < 0) w.push(d); if (!el.checked && i > -1) w.splice(i, 1); drawPv(); return; }
    if (!el.dataset.p) return;
    set(el.dataset.p, conv(el)); drawPv();
    if (e.type === 'change' && el.dataset.p === 'rules.attendance.lateMode') draw();
    // إعادة رسم التحذير لو غيّر حالة الضريبة
    if (e.type === 'change' && el.dataset.p === 'state.tax.enabled') draw();
  };
  root.onclick = async e => {
    const b = e.target.closest('[data-a],[data-add],[data-del]'); if (!b) return;
    if (b.dataset.add) {
      const arr = get(b.dataset.add) || []; const name = b.dataset.add;
      arr.push(name === 'rules.items' ? { name: '', kind: 'earn', calc: 'fixed', value: 0, insurable: false, active: true, dept: '' } : name === 'rules.attendance.tiers' ? { from: 0, to: 0, days: 0 } : name === 'rules.holidays' ? { date: '', name: '' } : { from: 0, to: '', rate: 0 });
      set(name, arr); draw(); return;
    }
    if (b.dataset.del) { const [name, i] = b.dataset.del.split(':'); get(name).splice(+i, 1); draw(); return; }
    const a = b.dataset.a;
    if (a === 'back') { st.pview = 'run'; HR.refresh(); }
    else if (a === 'unlock') { if (confirm('دي ثوابت رسمية (تأمينات وضريبة). عدّلها بس لو الرقم الرسمي اتغير. التعديل بيتسجل باسمك. تفتح؟')) { unlocked = true; draw(); } }
    else if (a === 'lock') { unlocked = false; draw(); }
    else if (a === 'official') { if (confirm('استرجاع القيم الرسمية الافتراضية؟ هتضيع تعديلاتك على التأمينات والضريبة.')) { W.state = JSON.parse(JSON.stringify(P.DEFAULT_STATE)); draw(); } }
    else if (a === 'save') {
      b.disabled = true;
      try { await P.save('rules', W.rules); await P.save('state', W.state); ui.toast('تم حفظ القواعد'); st.pview = 'run'; HR.refresh(); }
      catch (err) { b.disabled = false; ui.toast('تعذر الحفظ: ' + err.message); }
    }
  };
  draw();
};
