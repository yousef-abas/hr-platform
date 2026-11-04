/* محرك حساب الرواتب: دالة نقية (من غير شاشة) كل قواعدها بتيجي من الإعدادات */
(function () {
  const H = window.HR, P = H.payroll = {};

  /* قواعد الشركة (الأدمن يعدّلها) */
  P.DEFAULT_RULES = {
    startDay: 1,                       // 1 = شهر ميلادي كامل، 26 = من 26 الشهر اللي فات لـ25
    daysBasis: 30,                     // أو 'actual' = الأيام الفعلية
    hoursPerDay: 8,
    dayValueBase: 'basic+allow',       // basic | basic+allow
    rounding: 'two',                   // none | two | integer
    weekend: [5, 6],                   // 0 أحد ... 5 جمعة 6 سبت
    holidays: [],                      // [{date:'2026-10-06', name:'...'}]
    items: [],                         // بنود إضافية على كل الموظفين
    overtime: { enabled: true, base: 'basic', rates: { normal: 1.5, night: 2, rest: 2, holiday: 2 } },
    attendance: { auto: true, shiftStart: '09:00', graceMin: 15, lateMode: 'tiers', tiers: [{ from: 16, to: 60, days: 0.25 }, { from: 61, to: 999, days: 0.5 }], perMinuteFactor: 1, absenceFactor: 1, unpaidLeaveDeduct: true }
  };
  /* الثوابت الرسمية (قابلة للتعديل بس بتأكيد وبتتسجل) */
  P.DEFAULT_STATE = {
    insurance: { enabled: true, employeeRate: 11, employerRate: 18.75, minWage: 2700, maxWage: 16700, includeAllowances: false, effectiveFrom: '2026-01-01', source: 'حدود الأجر التأميني من الهيئة القومية للتأمين الاجتماعي (يناير 2026)' },
    tax: { enabled: false, personalExemptionAnnual: 0, brackets: [], note: 'شرائح الضريبة لم تُراجع بعد. أدخلها من المحاسب ثم فعّلها.' }
  };

  const clone = o => JSON.parse(JSON.stringify(o));
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  P.merge = (d, s) => { const r = clone(d); if (!isObj(s)) return r; Object.keys(s).forEach(k => { r[k] = isObj(d[k]) && isObj(s[k]) ? P.merge(d[k], s[k]) : s[k]; }); return r; };

  /* تواريخ بالنص YYYY-MM-DD (بدون مشاكل توقيت) */
  const pad = n => String(n).padStart(2, '0');
  const U = s => { const a = s.split('-'); return Date.UTC(+a[0], +a[1] - 1, +a[2]); };
  const S = t => { const d = new Date(t); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
  P.dates = (a, b) => { const out = []; for (let t = U(a); t <= U(b); t += 864e5) out.push(S(t)); return out; };
  P.period = (month, rules) => {
    const y = +month.slice(0, 4), m = +month.slice(5, 7), sd = +rules.startDay || 1;
    if (sd <= 1) return { start: month + '-01', end: S(Date.UTC(y, m, 0)) };
    return { start: S(Date.UTC(y, m - 2, sd)), end: S(Date.UTC(y, m - 1, sd - 1)) };
  };
  const mins = hhmm => { const a = String(hhmm || '').split(':'); return a.length < 2 ? null : +a[0] * 60 + +a[1]; };
  const rnd = (n, mode) => mode === 'integer' ? Math.round(n) : mode === 'none' ? n : Math.round(n * 100) / 100;

  const ZERO = { bonus: 0, absent: 0, other: 0, otNormal: 0, otNight: 0, otRest: 0, otHoliday: 0, advance: 0, penalty: 0 };

  /* الحساب: emp موظف، ctx = {rules,state,adj,att:[سجلات حضوره],leaves:[إجازاته],period,today} */
  P.calc = function (emp, ctx) {
    const R = ctx.rules, ST = ctx.state, adj = Object.assign({}, ZERO, ctx.adj || {}), rm = R.rounding;
    const num = v => Number(v) || 0;
    const basic = num(emp.salary), allow = num(emp.allow);
    const per = ctx.period, plen = P.dates(per.start, per.end).length;
    const dBasis = R.daysBasis === 'actual' ? plen : (num(R.daysBasis) || 30);
    const dayBase = R.dayValueBase === 'basic' ? basic : basic + allow;
    const dayValue = dayBase / dBasis;
    const lines = [], add = (t, label, amount, note) => { if (amount) lines.push({ t, label, amount: rnd(amount, rm), note: note || '' }); };

    /* المستحقات */
    add('earn', 'الراتب الأساسي', basic);
    add('earn', 'البدلات', allow);
    let insurableExtra = 0, itemsGross = 0, taxableExtra = 0;
    (R.items || []).filter(i => i.active !== false && (!i.dept || i.dept === emp.dept)).forEach(i => {
      const v = num(i.value);
      const amt = i.calc === 'pctBasic' ? basic * v / 100 : i.calc === 'pctGross' ? (basic + allow + itemsGross) * v / 100 : v;
      if (i.kind === 'ded') { add('ded', i.name || 'خصم', amt, i.calc === 'fixed' ? '' : v + '%'); return; }
      add('earn', i.name || 'بند', amt, i.calc === 'fixed' ? '' : v + '%'); itemsGross += amt;
      if (i.insurable) insurableExtra += amt;
    });
    add('earn', 'مكافأة', num(adj.bonus));

    /* الأوفر تايم */
    const ot = R.overtime || {}; let otTotal = 0; const otH = { normal: num(adj.otNormal), night: num(adj.otNight), rest: num(adj.otRest), holiday: num(adj.otHoliday) };
    if (ot.enabled) {
      const base = ot.base === 'basic+allow' ? basic + allow : basic, hourly = base / dBasis / (num(R.hoursPerDay) || 8);
      [['normal', 'نهاري'], ['night', 'ليلي'], ['rest', 'راحة أسبوعية'], ['holiday', 'عطلة رسمية']].forEach(([k, l]) => {
        if (otH[k] > 0) { const a = otH[k] * hourly * num(ot.rates[k]); otTotal += a; add('earn', 'أوفر تايم ' + l, a, otH[k] + ' ساعة × ' + num(ot.rates[k])); }
      });
    }

    /* الحضور: غياب وتأخير وإجازة بدون مرتب */
    const A = R.attendance || {}; let absentAuto = 0, unpaid = 0, lateDays = 0, lateMin = 0, lateDeductDays = 0, lateMinutesTotal = 0;
    if (A.auto) {
      const attBy = {}; (ctx.att || []).forEach(a => { if (a.in) attBy[a.date] = a; });
      const leaveBy = {}; (ctx.leaves || []).filter(l => l.status === 'معتمدة').forEach(l => P.dates(l.from, l.to).forEach(d => { leaveBy[d] = l; }));
      const hol = {}; (R.holidays || []).forEach(h => { hol[h.date] = 1; });
      const cut = ctx.today && ctx.today < per.end ? ctx.today : per.end, shift = mins(A.shiftStart), grace = num(A.graceMin);
      P.dates(per.start, cut).forEach(d => {
        const wd = new Date(U(d)).getUTCDay();
        if ((R.weekend || []).indexOf(wd) > -1 || hol[d]) return;
        if (emp.hire && d < emp.hire) return;
        const rec = attBy[d];
        if (rec) {
          const late = shift == null || mins(rec.in) == null ? 0 : mins(rec.in) - shift;
          if (late > grace) {
            lateDays++; lateMinutesTotal += late;
            if (A.lateMode === 'tiers') { const t = (A.tiers || []).find(x => late >= num(x.from) && late <= num(x.to)); if (t) lateDeductDays += num(t.days); }
          }
        } else if (leaveBy[d]) { if (leaveBy[d].type === 'بدون مرتب' && A.unpaidLeaveDeduct) unpaid++; }
        else absentAuto++;
      });
    }
    const absentDays = absentAuto + num(adj.absent);

    /* الأجر التأميني */
    const I = ST.insurance || {}; let insurance = 0, employerIns = 0, insWage = 0;
    if (I.enabled && emp.insured !== false) {
      insWage = basic + insurableExtra + (I.includeAllowances ? allow : 0);
      insWage = Math.min(Math.max(insWage, num(I.minWage)), num(I.maxWage) || Infinity);
      insurance = insWage * num(I.employeeRate) / 100; employerIns = insWage * num(I.employerRate) / 100;
    }

    const gross = lines.filter(l => l.t === 'earn').reduce((s, l) => s + l.amount, 0);

    /* ضريبة كسب العمل: شرائح سنوية يدخلها المحاسب */
    let tax = 0; const T = ST.tax || {};
    if (T.enabled && (T.brackets || []).length) {
      const annual = Math.max(0, (gross - insurance) * 12 - num(T.personalExemptionAnnual)); let t = 0;
      T.brackets.forEach(b => { const lo = num(b.from), hi = b.to === '' || b.to == null ? Infinity : num(b.to); if (annual > lo) t += (Math.min(annual, hi) - lo) * num(b.rate) / 100; });
      tax = t / 12;
    }

    /* الخصومات */
    add('ded', 'التأمينات الاجتماعية', insurance, num(I.employeeRate) + '% من ' + Math.round(insWage));
    add('ded', 'ضريبة كسب العمل', tax);
    add('ded', 'خصم الغياب', absentDays * dayValue * num(A.absenceFactor || 1), absentDays + ' يوم' + (absentAuto ? ' (' + absentAuto + ' تلقائي)' : ''));
    add('ded', 'إجازة بدون مرتب', unpaid * dayValue, unpaid + ' يوم');
    if (A.auto && A.lateMode === 'tiers') add('ded', 'خصم التأخير', lateDeductDays * dayValue, lateDays + ' مرات');
    if (A.auto && A.lateMode === 'perMinute') add('ded', 'خصم التأخير', lateMinutesTotal * (dayValue / ((num(R.hoursPerDay) || 8) * 60)) * num(A.perMinuteFactor || 1), lateMinutesTotal + ' دقيقة');
    add('ded', 'سلفة', num(adj.advance)); add('ded', 'جزاء', num(adj.penalty)); add('ded', 'خصومات أخرى', num(adj.other));

    const ded = lines.filter(l => l.t === 'ded').reduce((s, l) => s + l.amount, 0);
    const net = rnd(gross - ded, rm), flags = [];
    if (net < 0) flags.push('الصافي بالسالب');
    if (I.enabled && emp.insured !== false && basic + insurableExtra + (I.includeAllowances ? allow : 0) < num(I.minWage)) flags.push('الأجر أقل من الحد الأدنى للتأمينات');
    if (!basic) flags.push('لا يوجد راتب أساسي');
    return { lines, gross: rnd(gross, rm), deductions: rnd(ded, rm), insurance: rnd(insurance, rm), tax: rnd(tax, rm), net, employerIns: rnd(employerIns, rm), cost: rnd(gross + employerIns, rm), flags,
      meta: { absentDays, absentAuto, lateDays, lateMin: lateMinutesTotal, unpaid, otHours: otH.normal + otH.night + otH.rest + otH.holiday, dayValue: rnd(dayValue, 'two') } };
  };

  /* تحميل وحفظ الإعدادات */
  P.load = async function () {
    const rows = await H.store.list('settings'), g = k => (rows.find(r => r.key === k) || {}).value;
    return { rules: P.merge(P.DEFAULT_RULES, g('rules')), state: P.merge(P.DEFAULT_STATE, g('state')) };
  };
  P.save = async function (key, value) {
    const rows = await H.store.list('settings'), r = rows.find(x => x.key === key);
    return r ? H.store.update('settings', r.id, { value }) : H.store.create('settings', { key, value });
  };
})();
