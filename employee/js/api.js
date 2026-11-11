/* واجهة بيانات التطبيق: Supabase الحقيقي أو وضع تجريبي محلي */
(function () {
  const H = window.HR, A = H.api = {}, ui = H.ui, pad = n => String(n).padStart(2, '0');
  A.monthRange = m => { const y = +m.slice(0, 4), mo = +m.slice(5, 7); return { from: m + '-01', to: m + '-' + pad(new Date(Date.UTC(y, mo, 0)).getUTCDate()) }; };
  const err = e => { if (e) throw new Error(e.message || 'تعذر الاتصال بالخادم'); };

  if (H.mode === 'supabase') {
    const sb = H.sb, map = H.map;
    const rpc = async (fn, args) => { const r = await sb.rpc(fn, args || {}); err(r.error); return r.data; };
    A.config       = () => rpc('app_config');
    A.checkIn      = p => rpc('check_in',  { p_lat: p.lat == null ? null : p.lat, p_lng: p.lng == null ? null : p.lng, p_acc: p.acc == null ? null : p.acc });
    A.checkOut     = p => rpc('check_out', { p_lat: p.lat == null ? null : p.lat, p_lng: p.lng == null ? null : p.lng, p_acc: p.acc == null ? null : p.acc });
    A.attendance   = async (id, from, to) => { const r = await sb.from('attendance').select('emp_id,date,check_in,check_out,in_site,in_dist,source').eq('emp_id', id).gte('date', from).lte('date', to).order('date'); err(r.error); return r.data.map(x => ({ empId: x.emp_id, date: x.date, in: x.check_in || '', out: x.check_out || '', site: x.in_site, dist: x.in_dist, source: x.source })); };
    A.leaves       = async id => { const r = await sb.from('leaves').select('*').eq('emp_id', id).order('created_at', { ascending: false }); err(r.error); return r.data.map(x => map.fromDb('leaves', x)); };
    A.createLeave  = async o => { const r = await sb.from('leaves').insert(map.toDb('leaves', Object.assign({}, o, { status: 'معلقة' }))).select().single(); err(r.error); return map.fromDb('leaves', r.data); };
    A.cancelLeave  = async id => { const r = await sb.from('leaves').delete().eq('id', id).select(); err(r.error); if (!r.data || !r.data.length) throw new Error('ما ينفعش تلغي الطلب ده'); };
    A.payslips     = () => rpc('my_payslips');
    A.team         = () => rpc('team_directory');
    A.teamLeaves   = async ids => { if (!ids.length) return []; const r = await sb.from('leaves').select('*').in('emp_id', ids).order('created_at', { ascending: false }); err(r.error); return r.data.map(x => map.fromDb('leaves', x)); };
    A.teamAttendance = async (ids, date) => { if (!ids.length) return []; const r = await sb.from('attendance').select('emp_id,check_in,check_out').in('emp_id', ids).eq('date', date); err(r.error); return r.data.map(x => ({ empId: x.emp_id, in: x.check_in || '', out: x.check_out || '' })); };
    A.decide       = (id, ok, why) => rpc('manager_decide_leave', { p_id: id, p_approve: ok, p_reason: why || null });
    A.documents    = async id => { const r = await sb.from('documents').select('type,received,expiry,file,fname').eq('emp_id', id); err(r.error); return r.data; };
    A.employee     = async id => { const r = await sb.from('employees').select('*').eq('id', id).single(); err(r.error); return map.fromDb('employees', r.data); };

    /* ── الطلبات ── */
    A.myRequests   = async id => { const r = await sb.from('requests').select('*').eq('emp_id', id).order('created_at', { ascending: false }); err(r.error); return r.data.map(x => ({ id: x.id, type: x.type, status: x.status, amount: x.amount, months: x.months, remaining: x.remaining, reason: x.reason, date: x.date, hours: x.hours, field: x.field, newValue: x.new_value, note: x.note, hrNote: x.hr_note, createdAt: x.created_at })); };

    /* ── [A] Push subscription ── */
    /* ── [F] Error logging + [E] Inbox ── */
    A.announcements = async () => { const r = await sb.from('announcements').select('*').eq('active', true).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(5); err(r.error); return r.data || []; };
    A.logError = async (ctx, msg, stack, url) => {
      try {
        const empId = window.HR && window.HR.user ? window.HR.user.employeeId : null;
        await sb.from('error_logs').insert({ emp_id: empId, context: ctx, message: (msg||'').slice(0,500), stack: (stack||'').slice(0,2000), url: (url||'').slice(0,300) });
      } catch (_) {}
    };
    A.inbox = async () => { const r = await sb.from('inbox').select('*').order('created_at', { ascending: false }).limit(50); err(r.error); return r.data; };
    A.markRead = async id => { await sb.from('inbox').update({ read: true }).eq('id', id); };

    A.savePushSub  = async (empId, sub) => { try { await sb.from('push_subscriptions').upsert({ emp_id: empId, subscription: sub, updated_at: new Date().toISOString() }, { onConflict: 'emp_id' }); } catch (_) {} };
    A.sendPushToSelf = async (title, body, url) => { try { await sb.rpc('notify_employee', { p_emp_id: ME ? ME.id : null, p_title: title, p_body: body, p_url: url || './' }); } catch (_) {} };
    A.createRequest = async o => { const r = await sb.from('requests').insert({ emp_id: o.empId, type: o.type, status: 'معلقة', amount: o.amount || null, months: o.months || null, remaining: o.amount || null, reason: o.reason || null, date: o.date || null, hours: o.hours || null, field: o.field || null, new_value: o.newValue || null, note: o.note || null, created_at: new Date().toISOString() }).select().single(); err(r.error); return r.data; };

  } else {
    /* ---------- وضع تجريبي: بيانات في المتصفح + موقع مُحاكى ---------- */
    const S = () => H.store.db, me = () => S().employees.find(e => e.id === H.state.demoEmp), save = () => H.store.save();
    const SITE = { name: 'مقر الشركة (تجربة)', lat: 30.0444, lng: 31.2357, radius: 150 };
    const hm = () => new Date().toTimeString().slice(0, 5);
    const hav = (a, b, c, d) => { const R = 6371000, r = x => x * Math.PI / 180, h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
    const geo = p => {
      if (me().remoteOk) return { site: null, dist: null };
      if (p.lat == null) throw new Error('لازم تفعّل تحديد الموقع في الموبايل');
      if (p.acc != null && p.acc > 100) throw new Error('دقة الموقع ضعيفة (' + Math.round(p.acc) + ' متر). اقترب من مكان مفتوح وأعد المحاولة');
      const d = hav(p.lat, p.lng, SITE.lat, SITE.lng);
      if (d > SITE.radius) throw new Error('أنت خارج نطاق العمل. أقرب موقع (' + SITE.name + ') على بعد ' + Math.round(d) + ' متر');
      return { site: SITE.name, dist: Math.round(d * 10) / 10 };
    };
    A.demoPos    = kind => kind === 'outside' ? { lat: 30.07, lng: 31.28, acc: 15 } : { lat: 30.0446, lng: 31.2358, acc: 12 };
    A.config     = async () => { const e = me(), lv = S().settings.find(r => r.key === 'leaves'); return { leaves: lv ? lv.value : null, pay: { weekend: [5, 6], holidays: [] }, company: { name: 'شركة تجريبية' }, geo: { enabled: true }, me: { id: e.id, name: e.name, title: e.title, dept: e.dept, hire: e.hire, status: e.status, remote: !!e.remoteOk, isManager: S().employees.some(x => x.managerId === e.id && x.status !== 'terminated') } }; };
    A.attendance = async (id, from, to) => S().attendance.filter(a => a.empId === id && a.date >= from && a.date <= to).map(a => ({ empId: a.empId, date: a.date, in: a.in || '', out: a.out || '', site: a.inSite, dist: a.inDist, source: a.source }));
    A.checkIn    = async p => { const d = ui.today(), t = hm(), r = S().attendance.find(a => a.empId === me().id && a.date === d); if (r && r.in) throw new Error('سجّلت حضورك النهارده الساعة ' + r.in); const g = geo(p); if (r) Object.assign(r, { in: t, source: 'app', inSite: g.site, inDist: g.dist }); else S().attendance.push({ id: 'a' + Math.random().toString(36).slice(2, 8), empId: me().id, date: d, in: t, out: '', source: 'app', inSite: g.site, inDist: g.dist }); save(); return { time: t, site: g.site, dist: g.dist }; };
    A.checkOut   = async p => { const d = ui.today(), t = hm(), r = S().attendance.find(a => a.empId === me().id && a.date === d); if (!r || !r.in) throw new Error('لازم تسجل الحضور الأول'); if (r.out) throw new Error('سجّلت انصرافك النهارده الساعة ' + r.out); if (t < r.in) throw new Error('وقت الانصراف قبل الحضور'); const g = geo(p); r.out = t; save(); return { time: t, site: g.site, dist: g.dist }; };
    A.leaves     = async id => S().leaves.filter(l => l.empId === id).slice().reverse();
    A.createLeave  = async o => { const l = Object.assign({ id: 'l' + Math.random().toString(36).slice(2, 8), status: 'معلقة', mgrStatus: '' }, o); S().leaves.push(l); save(); return l; };
    A.cancelLeave  = async id => { const l = S().leaves.find(x => x.id === id); if (!l || l.status !== 'معلقة') throw new Error('ما ينفعش تلغي الطلب ده'); S().leaves = S().leaves.filter(x => x.id !== id); save(); };
    A.payslips   = async () => S().runs.filter(r => r.status === 'approved' || r.status === 'paid').map(r => { const l = S().lines.find(x => x.runId === r.id && x.empId === me().id); return l ? { month: r.month, status: r.status, data: l.data } : null; }).filter(Boolean).sort((a, b) => a.month < b.month ? 1 : -1);
    const reports = () => S().employees.filter(e => e.managerId === me().id && e.status !== 'terminated');
    A.team         = async () => reports().map(e => ({ id: e.id, name: e.name, title: e.title, dept: e.dept }));
    A.teamLeaves   = async ids => S().leaves.filter(l => ids.indexOf(l.empId) > -1).slice().reverse();
    A.teamAttendance = async (ids, date) => S().attendance.filter(a => ids.indexOf(a.empId) > -1 && a.date === date).map(a => ({ empId: a.empId, in: a.in || '', out: a.out || '' }));
    A.decide       = async (id, ok, why) => { const l = S().leaves.find(x => x.id === id); if (!l || l.status !== 'معلقة' || !reports().some(e => e.id === l.empId)) throw new Error('مش مسموح لك بالقرار على الطلب ده'); if (ok) Object.assign(l, { mgrStatus: 'موافق', mgrBy: me().name }); else { if (!why || !why.trim()) throw new Error('سبب الرفض مطلوب'); Object.assign(l, { status: 'مرفوضة', rejectReason: why, mgrStatus: 'مرفوض', mgrBy: me().name, decidedBy: me().name }); } save(); };
    A.documents    = async id => (S().documents || []).filter(d => d.empId === id).map(d => ({ type: d.type, received: d.received, expiry: d.expiry, file: d.file, fname: d.fname }));
    A.employee     = async id => S().employees.find(e => e.id === id);

    /* ── الطلبات (تجريبي) ── */
    if (!S().requests) S().requests = [];
    A.myRequests    = async id => (S().requests || []).filter(r => r.empId === id).slice().reverse();
    A.announcements = async () => []; /* تجريبي */
    A.logError = async () => {}; /* تجريبي */
    A.inbox    = async () => []; /* تجريبي */
    A.markRead = async () => {}; /* تجريبي */
    A.savePushSub  = async () => {}; /* تجريبي — لا يرسل push حقيقي */
    A.createRequest = async o => { const r = Object.assign({ id: 'r' + Math.random().toString(36).slice(2, 8), status: 'معلقة', createdAt: new Date().toISOString() }, o); S().requests.push(r); save(); return r; };
  }
})();


