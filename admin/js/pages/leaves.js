HR.pages.leaves = {
  title: 'الإجازات', icon: 'calendar',
  async render(root) {
    const { store, ui, state: st } = HR, L = HR.leaves, esc = ui.esc, today = ui.today(), isAdmin = HR.user.role === 'admin';
    st.lview = st.lview || 'req';
    const [E, LV, rules, cfg] = await Promise.all([store.list('employees'), store.list('leaves'), L.load(), HR.payroll.load()]);
    if (st.lview === 'rules') return HR.leavesRules(root, rules);
    const pay = cfg.rules, emps = E.filter(e => e.status !== 'terminated'), emp = id => E.find(e => e.id === id) || { name: 'محذوف' };
    const tcol = n => (L.type(rules, n) || {}).color || '#5b738b';
    const tchip = n => '<span class="tag" style="background:' + tcol(n) + '22;color:' + tcol(n) + '">' + esc(n) + '</span>';
    const pending = LV.filter(l => l.status === 'معلقة').length;
    const V = [['req', 'الطلبات' + (pending ? ' (' + pending + ')' : '')], ['bal', 'الأرصدة'], ['cal', 'تقويم الفريق'], ['rules', 'القواعد']];
    let body = '';

    if (st.lview === 'req') {
      const fs = st.lfs || '', ft = st.lft || '', fq = st.lfq || '';
      const rows = LV.slice().reverse().filter(l => (!fs || l.status === fs) && (!ft || l.type === ft) && (!fq || emp(l.empId).name.includes(fq)));
      body = '<div class="card"><div class="tools" style="margin-bottom:12px"><input id="fq" placeholder="بحث باسم موظف" value="' + esc(fq) + '"><select id="fs"><option value="">كل الحالات</option>' + ['معلقة', 'معتمدة', 'مرفوضة'].map(x => '<option' + (x === fs ? ' selected' : '') + '>' + x + '</option>').join('') + '</select><select id="ft"><option value="">كل الأنواع</option>' + rules.types.map(t => '<option' + (t.name === ft ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('') + '</select></div><div class="tw"><table><tr><th>الموظف</th><th>النوع</th><th>من</th><th>إلى</th><th>الأيام</th><th>الحالة</th><th>القرار</th><th></th></tr>' +
        rows.map(l => '<tr data-id="' + l.id + '"><td>' + ui.who(emp(l.empId)) + '</td><td>' + tchip(l.type) + '</td><td>' + l.from + '</td><td>' + l.to + '</td><td>' + l.days + '</td><td>' + ui.tag(l.status, { 'معتمدة': 'ok', 'مرفوضة': 'da', 'معلقة': 'wa' }[l.status]) + '</td><td style="white-space:normal;min-width:140px;font-size:13px;color:var(--mu)">' + esc(l.status === 'مرفوضة' && l.rejectReason ? 'سبب الرفض: ' + l.rejectReason : (l.decidedBy ? l.decidedBy : '')) + '</td><td>' +
          (l.status === 'معلقة' ? '<button class="btn sm" data-a="ok">اعتماد</button> <button class="btn danger sm" data-a="no">رفض</button>' : '') + '</td></tr>').join('') + '</table>' + (rows.length ? '' : '<div class="em">لا توجد طلبات مطابقة</div>') + '</div></div>';
    }
    if (st.lview === 'bal') {
      body = '<div class="card tw"><h3>أرصدة السنة الحالية</h3><table><tr><th>الموظف</th>' + rules.types.map(t => '<th>' + tchip(t.name) + '</th>').join('') + '</tr>' + emps.map(e => '<tr><td>' + ui.who(e) + '</td>' + rules.types.map(t => {
        const b = L.balance(e, t.name, today, LV, rules, pay);
        if (b.unlimited) return '<td>' + b.used + ' يوم <small style="color:var(--mu)">(بدون حد)</small></td>';
        const low = b.remaining <= 3;
        return '<td><div style="min-width:120px"><b>' + b.used + '</b> / ' + b.total + ' ' + (low ? ui.tag('متبقي ' + b.remaining, 'wa') : '') + (b.pending ? ' <small style="color:var(--mu)">+' + b.pending + ' معلق</small>' : '') + '<div class="pb"><i style="width:' + Math.min(100, b.used / b.total * 100) + '%;background:' + t.color + '"></i></div></div></td>';
      }).join('') + '</tr>').join('') + '</table></div>';
    }
    if (st.lview === 'cal') {
      const month = st.lmonth || today.slice(0, 7), y = +month.slice(0, 4), mo = +month.slice(5, 7), nd = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      const days = Array.from({ length: nd }, (_, i) => month + '-' + String(i + 1).padStart(2, '0'));
      const dept = st.lcd || '', depts = [...new Set(emps.map(e => e.dept).filter(Boolean))];
      const list = emps.filter(e => !dept || e.dept === dept).sort((a, b) => (a.dept || '').localeCompare(b.dept || '', 'ar') || a.name.localeCompare(b.name, 'ar'));
      const hol = {}; (pay.holidays || []).forEach(h => { hol[h.date] = h.name || 'عطلة'; });
      const wk = d => (pay.weekend || [5, 6]).indexOf(new Date(d + 'T00:00:00Z').getUTCDay()) > -1;
      const gl = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
      body = '<div class="card"><div class="tools" style="margin-bottom:12px"><input type="month" id="cm" value="' + month + '"><select id="cd"><option value="">كل الأقسام</option>' + depts.map(x => '<option' + (x === dept ? ' selected' : '') + '>' + esc(x) + '</option>').join('') + '</select>' +
        rules.types.map(t => '<span class="tag" style="background:' + t.color + '22;color:' + t.color + '">' + esc(t.name) + '</span>').join('') + '<span class="tag mu">المعلق: مقلّم</span></div><div class="tw"><table class="cal"><tr><th>الموظف</th>' + days.map(d => '<th class="' + (wk(d) ? 'wk' : '') + '">' + +d.slice(8) + '<small>' + gl[new Date(d + 'T00:00:00Z').getUTCDay()] + '</small></th>').join('') + '</tr>' +
        list.map(e => '<tr><td class="nm">' + esc(e.name) + '</td>' + days.map(d => {
          const l = LV.find(x => x.empId === e.id && x.status !== 'مرفوضة' && x.from <= d && x.to >= d);
          if (l) return '<td class="lv' + (l.status === 'معلقة' ? ' pd' : '') + '" style="--c:' + tcol(l.type) + '" title="' + esc(l.type + ' - ' + l.status) + '"></td>';
          return '<td class="' + (hol[d] ? 'hd' : wk(d) ? 'wk' : '') + '"' + (hol[d] ? ' title="' + esc(hol[d]) + '"' : '') + '></td>';
        }).join('') + '</tr>').join('') +
        '<tr class="sum"><td class="nm">في إجازة</td>' + days.map(d => { const n = list.filter(e => LV.some(x => x.empId === e.id && x.status !== 'مرفوضة' && x.from <= d && x.to >= d)).length; return '<td>' + (n || '') + '</td>'; }).join('') + '</tr></table></div></div>';
    }

    root.innerHTML = ui.head('الإجازات', 'الطلبات والأرصدة وتقويم الفريق، والقواعد قابلة للضبط', '<button class="btn" data-a="add">+ طلب إجازة</button>') +
      '<div class="pt noprint">' + V.map(v => '<button data-v="' + v[0] + '" class="' + (st.lview === v[0] ? 'on' : '') + '">' + v[1] + '</button>').join('') + '</div>' + body;

    const refreshKeep = (id, key) => { const el = root.querySelector(id); el.oninput = ui.debounce(e => { st[key] = e.target.value; HR.refresh().then(() => { const i = document.querySelector(id); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); }); };
    const sel = (id, key) => { const el = root.querySelector(id); if (el) el.onchange = e => { st[key] = e.target.value; HR.refresh(); }; };
    if (st.lview === 'req') { refreshKeep('#fq', 'lfq'); sel('#fs', 'lfs'); sel('#ft', 'lft'); }
    if (st.lview === 'cal') { sel('#cm', 'lmonth'); sel('#cd', 'lcd'); }

    async function requestModal() {
      const m = ui.modal('طلب إجازة', '<form id="rq"><label>الموظف<select name="empId">' + emps.map(e => '<option value="' + e.id + '">' + esc(e.name) + '</option>').join('') + '</select></label><label>النوع<select name="type">' + rules.types.map(t => '<option>' + esc(t.name) + '</option>').join('') + '</select></label><label>من<input type="date" name="from" value="' + today + '" required></label><label>إلى<input type="date" name="to" value="' + today + '" required></label><label>ملاحظة<input name="note"></label>' + (isAdmin ? '<label class="ck" style="display:flex;gap:6px;align-items:center;color:var(--tx)"><input type="checkbox" name="ov" style="width:auto"> تجاوز الأخطاء (مدير)</label>' : '') + '<div id="inf"></div><div class="acts"><button class="btn" type="submit">إرسال الطلب</button><button class="btn ghost" type="button" data-x>إلغاء</button></div></form>');
      const f = m.el.querySelector('#rq'), inf = m.el.querySelector('#inf');
      const check = () => {
        const el = f.elements, o = { empId: el.empId.value, type: el.type.value, from: el.from.value, to: el.to.value }, e = emps.find(x => x.id === o.empId);
        const v = L.validate(o, { emp: e, rules, pay, leaves: LV, emps, today }), b = e && L.balance(e, o.type, o.from || today, LV, rules, pay);
        inf.innerHTML = '<div class="al ok" style="display:block">' + v.days + ' يوم' + (b && !b.unlimited ? ' | المتاح ' + Math.max(0, Math.round(b.available * 100) / 100) + ' من ' + b.total : '') + '</div>' + v.errors.map(x => '<div class="al da">' + esc(x) + '</div>').join('') + v.warnings.map(x => '<div class="al wa">' + esc(x) + '</div>').join('');
        return { o, v };
      };
      f.addEventListener('input', check); f.addEventListener('change', check); check();
      m.el.querySelector('[data-x]').onclick = m.close;
      f.onsubmit = async ev => {
        ev.preventDefault(); const { o, v } = check();
        if (v.errors.length && !(isAdmin && f.elements.ov && f.elements.ov.checked)) return ui.toast('صحّح الأخطاء الأول');
        const t = L.type(rules, o.type), auto = !t.approval;
        await store.create('leaves', Object.assign(o, { days: v.days || 1, note: f.elements.note.value, status: auto ? 'معتمدة' : 'معلقة', decidedBy: auto ? 'تلقائي (بدون موافقة)' : '', decidedAt: auto ? new Date().toISOString() : '' }));
        m.close(); ui.toast(auto ? 'تم تسجيل الإجازة' : 'تم إرسال الطلب'); HR.refresh();
      };
    }

    root.onclick = async e => {
      const vb = e.target.closest('[data-v]'); if (vb) { st.lview = vb.dataset.v; HR.refresh(); return; }
      const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, id = b.closest('tr') && b.closest('tr').dataset.id;
      if (a === 'add') return requestModal();
      const l = LV.find(x => x.id === id), by = HR.user.email || HR.user.name;
      if (a === 'ok') {
        const v = L.validate(l, { emp: emp(l.empId), rules, pay, leaves: LV.filter(x => x.id !== id), emps, today: l.from });
        const issues = v.errors.concat(v.warnings);
        if (issues.length && !confirm('ملاحظات على الطلب:\n- ' + issues.join('\n- ') + '\n\nتعتمد برضه؟')) return;
        await store.update('leaves', id, { status: 'معتمدة', decidedBy: by, decidedAt: new Date().toISOString(), rejectReason: '' }); ui.toast('تم الاعتماد'); HR.refresh();
      } else if (a === 'no') {
        const why = prompt('سبب الرفض (مطلوب):'); if (!why || !why.trim()) return;
        await store.update('leaves', id, { status: 'مرفوضة', rejectReason: why.trim(), decidedBy: by, decidedAt: new Date().toISOString() }); ui.toast('تم الرفض'); HR.refresh();
      }
    };
  }
};
