/* ─────────────────────────────────────────────────────────────────────
   pdf-export.js  —  تصدير PDF بدون مكتبات خارجية (print-based)
   يستخدم نافذة طباعة مخصصة بـ CSS عشان يطبع كـ PDF
   ───────────────────────────────────────────────────────────────────── */

HR.pdf = {

  /* ── كشف راتب موظف واحد ── */
  slip(emp, calc, month, rules) {
    const ui = HR.ui;
    const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>كشف راتب — ${ui.esc(emp.name)} — ${month}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Cairo', sans-serif; color: #1e293b; background: #fff; padding: 32px; font-size: 13px; direction: rtl; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #c9933a; }
  .logo { font-size: 22px; font-weight: 900; color: #c9933a; }
  .logo span { color: #1e293b; }
  .meta { text-align: left; color: #64748b; font-size: 12px; }
  .meta b { color: #1e293b; font-size: 14px; display: block; margin-bottom: 4px; }
  .emp-card { background: #f8fafc; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .emp-card .field label { font-size: 11px; color: #64748b; display: block; margin-bottom: 2px; }
  .emp-card .field b { font-size: 13px; font-weight: 700; }
  .section { margin-bottom: 16px; }
  .section h3 { font-size: 13px; font-weight: 800; color: #c9933a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  table td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
  table td:last-child { text-align: left; font-weight: 700; }
  table tr.total td { background: #f8fafc; font-weight: 800; border-top: 2px solid #e2e8f0; }
  table tr.net td { background: #fdf6e7; color: #c9933a; font-weight: 900; font-size: 15px; border-top: 2px solid #c9933a; }
  table tr.deduct td { color: #dc2626; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; color: #94a3b8; font-size: 11px; }
  .sign-box { text-align: center; }
  .sign-box .line { width: 160px; border-bottom: 1px solid #94a3b8; margin: 40px auto 6px; }
  .signs { display: flex; justify-content: space-around; margin-top: 40px; }
  @media print {
    body { padding: 16px; }
    @page { size: A4; margin: 10mm; }
  }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">HR <span>نظام الموارد البشرية</span></div>
    <div style="color:#64748b;font-size:12px;margin-top:4px">كشف الراتب الشهري</div>
  </div>
  <div class="meta">
    <b>الشهر: ${month}</b>
    تاريخ الإصدار: ${new Date().toLocaleDateString('ar-EG')}<br>
    رقم المستند: SLP-${month.replace('-','')}-${emp.id.slice(-4).toUpperCase()}
  </div>
</div>

<div class="emp-card">
  <div class="field"><label>الاسم الكامل</label><b>${ui.esc(emp.name)}</b></div>
  <div class="field"><label>الوظيفة</label><b>${ui.esc(emp.title||'—')}</b></div>
  <div class="field"><label>القسم</label><b>${ui.esc(emp.dept||'—')}</b></div>
  <div class="field"><label>تاريخ التعيين</label><b>${emp.hire||'—'}</b></div>
  <div class="field"><label>البنك</label><b>${ui.esc(emp.bank||'—')}</b></div>
  <div class="field"><label>رقم التأمين</label><b>${ui.esc(emp.insuranceNo||'—')}</b></div>
</div>

<div class="section">
  <h3>المستحقات</h3>
  <table>
    <tr><td>الراتب الأساسي</td><td>${ui.money(calc.basic ?? emp.salary)}</td></tr>
    <tr><td>البدلات</td><td>${ui.money(calc.allowTotal ?? emp.allow)}</td></tr>
    ${calc.bonus ? `<tr><td>مكافأة</td><td>${ui.money(calc.bonus)}</td></tr>` : ''}
    ${calc.otPay ? `<tr><td>أوفر تايم</td><td>${ui.money(calc.otPay)}</td></tr>` : ''}
    <tr class="total"><td>إجمالي المستحقات</td><td>${ui.money(calc.gross)}</td></tr>
  </table>
</div>

<div class="section">
  <h3>الخصومات</h3>
  <table>
    ${calc.insTax  ? `<tr class="deduct"><td>تأمينات اجتماعية (الموظف ${rules?.insEmployee ?? 11}%)</td><td>- ${ui.money(calc.insTax)}</td></tr>` : ''}
    ${calc.insCo   ? `<tr class="deduct"><td>تأمينات (صاحب العمل ${rules?.insCompany ?? 18}%)</td><td>- ${ui.money(calc.insCo)}</td></tr>` : ''}
    ${calc.tax     ? `<tr class="deduct"><td>ضريبة دخل</td><td>- ${ui.money(calc.tax)}</td></tr>` : ''}
    ${calc.absDed  ? `<tr class="deduct"><td>خصم غياب (${calc.absDays ?? ''} يوم)</td><td>- ${ui.money(calc.absDed)}</td></tr>` : ''}
    ${calc.loan    ? `<tr class="deduct"><td>قسط سلفة</td><td>- ${ui.money(calc.loan)}</td></tr>` : ''}
    ${calc.penalty ? `<tr class="deduct"><td>جزاءات</td><td>- ${ui.money(calc.penalty)}</td></tr>` : ''}
    <tr class="total"><td>إجمالي الخصومات</td><td>- ${ui.money(calc.deductions)}</td></tr>
  </table>
</div>

<div class="section">
  <table>
    <tr class="net"><td>💰 صافي الراتب</td><td>${ui.money(calc.net)}</td></tr>
  </table>
</div>

<div class="signs">
  <div class="sign-box"><div class="line"></div><div>توقيع الموظف</div></div>
  <div class="sign-box"><div class="line"></div><div>مدير الموارد البشرية</div></div>
  <div class="sign-box"><div class="line"></div><div>المدير العام</div></div>
</div>

<div class="footer">
  <span>نظام الموارد البشرية — وثيقة سرية</span>
  <span>تم الإصدار: ${new Date().toLocaleString('ar-EG')}</span>
</div>
</body>
</html>`;
    this._print(html, `كشف-راتب-${emp.name}-${month}`);
  },

  /* ── تقرير الحضور ── */
  attendance(empName, month, rows) {
    const ui = HR.ui;
    const present = rows.filter(r => r.in).length;
    const late    = rows.filter(r => r.in && r.in > '09:30').length;
    const absent  = rows.filter(r => !r.in).length;
    const mins = t => { const a = String(t||'').split(':'); return +a[0]*60 + +a[1]; };
    const dur  = (i, o) => { if (!i||!o) return '—'; const m = mins(o)-mins(i); return Math.floor(m/60)+'س '+(m%60)+'د'; };

    const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>تقرير الحضور — ${ui.esc(empName)} — ${month}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Cairo',sans-serif; color:#1e293b; background:#fff; padding:32px; font-size:13px; direction:rtl; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; padding-bottom:16px; border-bottom:3px solid #c9933a; }
  .logo { font-size:22px; font-weight:900; color:#c9933a; }
  .kpi-row { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
  .kpi { background:#f8fafc; border-radius:10px; padding:12px 16px; text-align:center; }
  .kpi b { font-size:24px; font-weight:900; display:block; }
  .kpi span { font-size:11px; color:#64748b; }
  .kpi.ok b { color:#16a34a; } .kpi.wa b { color:#d97706; } .kpi.da b { color:#dc2626; }
  table { width:100%; border-collapse:collapse; }
  th { background:#f1f5f9; padding:8px 10px; font-size:12px; font-weight:700; text-align:right; }
  td { padding:7px 10px; border-bottom:1px solid #f1f5f9; font-size:13px; }
  .tag { display:inline-block; padding:2px 8px; border-radius:20px; font-size:11px; font-weight:700; }
  .tag.ok { background:#f0fdf4; color:#16a34a; } .tag.wa { background:#fffbeb; color:#d97706; } .tag.da { background:#fef2f2; color:#dc2626; }
  @media print { body{padding:16px;} @page{size:A4;margin:10mm;} }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">HR <span style="color:#1e293b;font-size:16px">نظام الموارد البشرية</span></div>
    <div style="color:#64748b;font-size:13px;margin-top:4px">تقرير الحضور والانصراف</div>
  </div>
  <div style="text-align:left;color:#64748b;font-size:12px">
    <b style="color:#1e293b;font-size:14px">${ui.esc(empName)}</b><br>
    الشهر: ${month}<br>
    تاريخ الإصدار: ${new Date().toLocaleDateString('ar-EG')}
  </div>
</div>

<div class="kpi-row">
  <div class="kpi ok"><b>${present}</b><span>حاضر</span></div>
  <div class="kpi wa"><b>${late}</b><span>متأخر</span></div>
  <div class="kpi da"><b>${absent}</b><span>غائب</span></div>
  <div class="kpi"><b>${rows.length}</b><span>إجمالي أيام العمل</span></div>
</div>

<table>
  <tr><th>التاريخ</th><th>الحضور</th><th>الانصراف</th><th>المدة</th><th>الحالة</th></tr>
  ${rows.sort((a,b) => a.date > b.date ? 1 : -1).map(r => `
  <tr>
    <td>${r.date}</td>
    <td>${r.in || '—'}</td>
    <td>${r.out || '—'}</td>
    <td>${dur(r.in, r.out)}</td>
    <td>${!r.in ? '<span class="tag da">غائب</span>' : r.in > '09:30' ? '<span class="tag wa">متأخر</span>' : '<span class="tag ok">في الموعد</span>'}</td>
  </tr>`).join('')}
</table>

<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;color:#94a3b8;font-size:11px">
  <span>نظام الموارد البشرية — وثيقة سرية</span>
  <span>تم الإصدار: ${new Date().toLocaleString('ar-EG')}</span>
</div>
</body>
</html>`;
    this._print(html, `حضور-${empName}-${month}`);
  },

  /* ── كشف رواتب شهري (كل الموظفين) ── */
  payrollSummary(rows, month) {
    const ui = HR.ui;
    const total = rows.reduce((s,r) => s + r.calc.net, 0);
    const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>كشف رواتب ${month}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Cairo',sans-serif; color:#1e293b; background:#fff; padding:32px; font-size:12px; direction:rtl; }
  .header { display:flex; justify-content:space-between; margin-bottom:20px; padding-bottom:12px; border-bottom:3px solid #c9933a; }
  .logo { font-size:20px; font-weight:900; color:#c9933a; }
  table { width:100%; border-collapse:collapse; }
  th { background:#1e3a5f; color:#fff; padding:8px 10px; font-size:11px; text-align:right; }
  td { padding:7px 10px; border-bottom:1px solid #f1f5f9; font-size:12px; }
  tr:nth-child(even) td { background:#f8fafc; }
  .total-row td { background:#fdf6e7 !important; font-weight:900; color:#c9933a; font-size:13px; border-top:2px solid #c9933a; }
  @media print { body{padding:12px;} @page{size:A4 landscape;margin:8mm;} }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">HR <span style="color:#1e293b">نظام الموارد البشرية</span></div>
    <div style="color:#64748b;font-size:12px">كشف الرواتب الشهري — ${month}</div>
  </div>
  <div style="text-align:left;color:#64748b;font-size:11px">
    عدد الموظفين: ${rows.length}<br>
    تاريخ الإصدار: ${new Date().toLocaleDateString('ar-EG')}
  </div>
</div>
<table>
  <tr><th>#</th><th>الاسم</th><th>الوظيفة</th><th>القسم</th><th>الراتب الأساسي</th><th>البدلات</th><th>إجمالي</th><th>الخصومات</th><th>الصافي</th></tr>
  ${rows.map((r,i) => `
  <tr>
    <td>${i+1}</td>
    <td>${ui.esc(r.name)}</td>
    <td>${ui.esc(r.title||'—')}</td>
    <td>${ui.esc(r.dept||'—')}</td>
    <td>${ui.money(r.calc.basic ?? 0)}</td>
    <td>${ui.money(r.calc.allowTotal ?? 0)}</td>
    <td>${ui.money(r.calc.gross)}</td>
    <td>${ui.money(r.calc.deductions)}</td>
    <td>${ui.money(r.calc.net)}</td>
  </tr>`).join('')}
  <tr class="total-row">
    <td colspan="8" style="text-align:right">إجمالي صافي الرواتب</td>
    <td>${ui.money(total)}</td>
  </tr>
</table>
</body>
</html>`;
    this._print(html, `كشف-رواتب-${month}`);
  },

  /* ── helper: فتح نافذة طباعة ── */
  _print(html, filename) {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { HR.ui.toast('افتح النوافذ المنبثقة في المتصفح'); return; }
    w.document.write(html);
    w.document.close();
    w.onload = () => {
      setTimeout(() => {
        w.document.title = filename;
        w.print();
      }, 600);
    };
  }
};
