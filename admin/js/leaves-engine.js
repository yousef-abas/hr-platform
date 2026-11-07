/* محرك الإجازات: أنواع وأرصدة وقواعد قابلة للضبط (دوال نقية) */
(function () {
  const H = window.HR, L = H.leaves = {};
  L.DEFAULT = {
    yearStartMonth: 1,                 // 1 = سنة ميلادية
    countMode: 'calendar',             // calendar | workdays (يستثني الإجازة الأسبوعية والعطلات)
    maxDeptOffPct: 0,                  // أقصى % من القسم في إجازة في نفس اليوم (0 = بدون حد)
    annualTenure: [{ years: 10, days: 30 }],
    types: [
      { name: 'سنوية', paid: true, quota: 21, accrual: 'upfront', carry: 0, approval: true, maxConsecutive: 0, minNotice: 0, tenure: true, color: '#0070f2' },
      { name: 'عارضة', paid: true, quota: 6, accrual: 'upfront', carry: 0, approval: true, maxConsecutive: 2, minNotice: 0, tenure: false, color: '#c35500' },
      { name: 'مرضية', paid: true, quota: 15, accrual: 'upfront', carry: 0, approval: true, maxConsecutive: 0, minNotice: 0, tenure: false, color: '#a9306f' },
      { name: 'بدون مرتب', paid: false, quota: 0, accrual: 'upfront', carry: 0, approval: true, maxConsecutive: 0, minNotice: 0, tenure: false, color: '#5b738b' }
    ]
  };
  const pad = n => String(n).padStart(2, '0');
  const U = s => { const a = s.split('-'); return Date.UTC(+a[0], +a[1] - 1, +a[2]); };
  const S = t => { const d = new Date(t); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
  const dates = (a, b) => { const o = []; for (let t = U(a); t <= U(b); t += 864e5) o.push(S(t)); return o; };

  L.load = async function () {
    const rows = await H.store.list('settings'), r = rows.find(x => x.key === 'leaves');
    return H.payroll.merge(L.DEFAULT, r && r.value);
  };
  L.save = async function (value) {
    const rows = await H.store.list('settings'), r = rows.find(x => x.key === 'leaves');
    return r ? H.store.update('settings', r.id, { value }) : H.store.create('settings', { key: 'leaves', value });
  };
  L.type = (rules, name) => rules.types.find(t => t.name === name);
  L.unpaidTypes = rules => rules.types.filter(t => !t.paid).map(t => t.name);

  /* عدد أيام الإجازة حسب الإعداد (pay = قواعد الرواتب للإجازة الأسبوعية والعطلات) */
  L.count = function (from, to, rules, pay) {
    if (!from || !to || to < from) return 0;
    const all = dates(from, to); if (rules.countMode !== 'workdays') return all.length;
    const hol = {}; ((pay && pay.holidays) || []).forEach(h => { hol[h.date] = 1; });
    return all.filter(d => ((pay && pay.weekend) || [5, 6]).indexOf(new Date(U(d)).getUTCDay()) < 0 && !hol[d]).length;
  };
  L.yearRange = function (date, sm) {
    sm = +sm || 1; const y = +date.slice(0, 4), m = +date.slice(5, 7), sy = m >= sm ? y : y - 1;
    return { start: sy + '-' + pad(sm) + '-01', end: S(Date.UTC(sy + 1, sm - 1, 1) - 864e5) };
  };
  const overlap = (l, a, b, rules, pay) => { const f = l.from > a ? l.from : a, t = l.to < b ? l.to : b; return f > t ? 0 : L.count(f, t, rules, pay); };

  /* رصيد موظف في نوع إجازة */
  L.balance = function (emp, typeName, asOf, leaves, rules, pay) {
    const t = L.type(rules, typeName); if (!t) return null;
    const yr = L.yearRange(asOf, rules.yearStartMonth), mine = leaves.filter(l => l.empId === emp.id && l.type === typeName);
    const used = (a, b, st) => mine.filter(l => l.status === st).reduce((s, l) => s + overlap(l, a, b, rules, pay), 0);
    const yearsOfService = emp.hire ? (U(yr.start) - U(emp.hire)) / (365.25 * 864e5) : 0;
    let quota = Number(t.quota) || 0;
    if (t.tenure) (rules.annualTenure || []).forEach(r => { if (yearsOfService >= Number(r.years) && Number(r.days) > quota) quota = Number(r.days); });
    let carry = 0;
    if (t.carry > 0 && quota > 0) { const py = L.yearRange(S(U(yr.start) - 864e5), rules.yearStartMonth); if (!emp.hire || emp.hire <= py.end) carry = Math.min(Number(t.carry), Math.max(0, quota - used(py.start, py.end, 'معتمدة'))); }
    const usedNow = used(yr.start, yr.end, 'معتمدة'), pending = used(yr.start, yr.end, 'معلقة');
    const unlimited = quota === 0;
    const months = (+asOf.slice(5, 7) - (+rules.yearStartMonth || 1) + 12) % 12 + 1;
    const entitled = t.accrual === 'monthly' ? Math.round(quota / 12 * months * 100) / 100 : quota;
    return { type: t, quota, carry, used: usedNow, pending, unlimited, total: quota + carry, remaining: unlimited ? null : quota + carry - usedNow, available: unlimited ? Infinity : entitled + carry - usedNow - pending, year: yr };
  };

  /* فحص طلب إجازة: أخطاء بتمنع، وتحذيرات بتنبه */
  L.validate = function (req, ctx) {
    const { emp, rules, pay, leaves, emps, today } = ctx, errors = [], warnings = [], t = L.type(rules, req.type);
    const days = L.count(req.from, req.to, rules, pay);
    if (!emp) errors.push('اختر الموظف');
    if (!t) errors.push('نوع الإجازة غير معروف');
    if (!req.from || !req.to) return { days: 0, errors: errors.concat(['حدد التاريخين']), warnings };
    if (req.to < req.from) errors.push('تاريخ النهاية قبل البداية');
    if (!t || !emp) return { days, errors, warnings };
    if (emp.hire && req.from < emp.hire) errors.push('الإجازة قبل تاريخ التعيين');
    if (days === 0 && req.to >= req.from) errors.push('الفترة كلها إجازة أسبوعية أو عطلة، مفيش أيام تتحسب');
    if (t.maxConsecutive > 0 && days > t.maxConsecutive) errors.push('الحد الأقصى للأيام المتصلة في ' + t.name + ' هو ' + t.maxConsecutive);
    if (t.minNotice > 0 && today && (U(req.from) - U(today)) / 864e5 < t.minNotice) errors.push('لازم الطلب قبل الإجازة بـ ' + t.minNotice + ' يوم على الأقل');
    const b = L.balance(emp, t.name, req.from, leaves, rules, pay);
    if (b && !b.unlimited && days > b.available) errors.push('الرصيد المتاح ' + Math.max(0, Math.round(b.available * 100) / 100) + ' يوم والطلب ' + days);
    if (rules.maxDeptOffPct > 0 && emp.dept) {
      const dept = (emps || []).filter(e => e.dept === emp.dept && e.status !== 'terminated'), n = dept.length || 1; let worst = 0;
      dates(req.from, req.to).forEach(d => { const off = leaves.filter(l => l.empId !== emp.id && l.status !== 'مرفوضة' && l.from <= d && l.to >= d && dept.some(e => e.id === l.empId)).length; worst = Math.max(worst, off); });
      const pct = (worst + 1) / n * 100;
      if (pct > rules.maxDeptOffPct) warnings.push('هيبقى ' + Math.round(pct) + '% من قسم ' + emp.dept + ' في إجازة في نفس الوقت (الحد ' + rules.maxDeptOffPct + '%)');
    }
    return { days, errors, warnings };
  };
})();
