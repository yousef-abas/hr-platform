/* قواعد الإجازات: أنواع وأرصدة وشروط قابلة للضبط */
HR.leavesRules = function (root, cur) {
  const { ui, state: st } = HR, L = HR.leaves, esc = ui.esc, isAdmin = HR.user.role === 'admin';
  const W = JSON.parse(JSON.stringify(cur));
  const get = p => p.split('.').reduce((o, k) => o == null ? o : o[k], W);
  const set = (p, v) => { const k = p.split('.'), last = k.pop(); k.reduce((o, x) => o[x], W)[last] = v; };
  const d = isAdmin ? '' : ' disabled';
  const num = (p, l) => '<label>' + l + '<input type="number" step="any" min="0" data-p="' + p + '" data-t="n" value="' + esc(get(p)) + '"' + d + '></label>';
  const txt = (p, l) => '<label>' + l + '<input data-p="' + p + '" data-t="s" value="' + esc(get(p) || '') + '"' + d + '></label>';
  const col = (p, l) => '<label>' + l + '<input type="color" data-p="' + p + '" data-t="s" value="' + esc(get(p) || '#0070f2') + '"' + d + ' style="padding:2px;height:34px"></label>';
  const chk = (p, l) => '<label class="ck"><input type="checkbox" data-p="' + p + '" data-t="b"' + (get(p) ? ' checked' : '') + d + '>' + l + '</label>';
  const sel = (p, l, o) => '<label>' + l + '<select data-p="' + p + '" data-t="s"' + d + '>' + o.map(x => '<option value="' + x[0] + '"' + (String(get(p)) === String(x[0]) ? ' selected' : '') + '>' + x[1] + '</option>').join('') + '</select></label>';
  const del = (a, i) => isAdmin ? '<button class="btn danger sm" data-del="' + a + ':' + i + '">حذف</button>' : '';
  const MON = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'].map((m, i) => [i + 1, m]);
  function draw() {
    root.innerHTML = ui.head('قواعد الإجازات', isAdmin ? 'عرّف أنواع الإجازات وأرصدتها وشروطها' : 'عرض فقط: تعديل القواعد للمدير', '<button class="btn ghost" data-a="back">رجوع للإجازات</button>') +
      '<div class="card rcard"><h3>عام</h3><div class="fg">' + sel('yearStartMonth', 'السنة بتبدأ من شهر', MON) + sel('countMode', 'طريقة عدّ الأيام', [['calendar', 'كل الأيام (تقويمي)'], ['workdays', 'أيام العمل فقط (يستثني الإجازة الأسبوعية والعطلات)']]) + num('maxDeptOffPct', 'أقصى % من القسم في إجازة معًا (0 = بدون حد)') + chk('requireManager', 'لازم موافقة المدير المباشر قبل الاعتماد النهائي') + '</div></div>' +
      '<div class="card rcard"><h3>زيادة الرصيد السنوي بسنوات الخدمة ' + (isAdmin ? '<button class="btn ghost sm" data-add="annualTenure">+ شريحة</button>' : '') + '</h3>' + ((W.annualTenure || []).length ? W.annualTenure.map((r, i) => '<div class="rrow">' + num('annualTenure.' + i + '.years', 'بعد (سنة خدمة)') + num('annualTenure.' + i + '.days', 'الرصيد يبقى (يوم)') + del('annualTenure', i) + '</div>').join('') : '<div class="em">بدون زيادة</div>') + '<p style="color:var(--mu);font-size:12px">بتنطبق على الأنواع اللي مفعّل عليها "يتأثر بسنوات الخدمة". القيم الافتراضية للتجربة، راجعها مع قانون العمل وسياسة شركتك.</p></div>' +
      '<div class="card rcard"><h3>أنواع الإجازات ' + (isAdmin ? '<button class="btn ghost sm" data-add="types">+ نوع</button>' : '') + '</h3>' + W.types.map((t, i) => { const q = 'types.' + i; return '<div class="rrow" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr))">' + txt(q + '.name', 'الاسم') + num(q + '.quota', 'الرصيد السنوي (0 = بدون حد)') + sel(q + '.accrual', 'استحقاق الرصيد', [['upfront', 'كله من أول السنة'], ['monthly', 'شهريًا']]) + num(q + '.carry', 'أقصى ترحيل للسنة الجاية') + num(q + '.maxConsecutive', 'أقصى أيام متصلة (0 = بدون)') + num(q + '.minNotice', 'أقل إخطار مسبق (يوم)') + col(q + '.color', 'اللون') + chk(q + '.paid', 'مدفوعة الأجر') + chk(q + '.approval', 'تحتاج موافقة') + chk(q + '.tenure', 'يتأثر بسنوات الخدمة') + del('types', i) + '</div>'; }).join('') +
      '<p style="color:var(--mu);font-size:12px">الإجازة غير مدفوعة بتتخصم من الراتب تلقائيًا. تغيير اسم نوع بعد استخدامه ما بيغيّرش الإجازات القديمة. الأرقام الافتراضية للتجربة.</p></div>' +
      (isAdmin ? '<div class="savebar"><button class="btn ghost" data-a="back">إلغاء</button><button class="btn" data-a="save">حفظ القواعد</button></div>' : '');
  }
  root.oninput = root.onchange = e => {
    const el = e.target; if (!el.dataset.p) return;
    set(el.dataset.p, el.dataset.t === 'b' ? el.checked : el.dataset.t === 'n' ? (el.value === '' ? 0 : Number(el.value)) : (el.dataset.p === 'yearStartMonth' ? Number(el.value) : el.value));
  };
  root.onclick = async e => {
    const b = e.target.closest('[data-a],[data-add],[data-del]'); if (!b) return;
    if (b.dataset.add) { const k = b.dataset.add; W[k].push(k === 'types' ? { name: 'نوع جديد', paid: true, quota: 0, accrual: 'upfront', carry: 0, approval: true, maxConsecutive: 0, minNotice: 0, tenure: false, color: '#0e9f9a' } : { years: 10, days: 30 }); draw(); return; }
    if (b.dataset.del) { const [k, i] = b.dataset.del.split(':'); if (k === 'types' && !confirm('حذف نوع الإجازة؟ الإجازات القديمة المسجلة به هتفضل بدون نوع معروف.')) return; W[k].splice(+i, 1); draw(); return; }
    if (b.dataset.a === 'back') { st.lview = 'req'; HR.refresh(); }
    else if (b.dataset.a === 'save') {
      const names = W.types.map(t => t.name.trim()); if (names.some(n => !n) || new Set(names).size !== names.length) return ui.toast('أسماء الأنواع لازم تكون مكتوبة وغير مكررة');
      W.types.forEach(t => { t.name = t.name.trim(); });
      b.disabled = true; try { await L.save(W); ui.toast('تم حفظ قواعد الإجازات'); st.lview = 'req'; HR.refresh(); } catch (err) { b.disabled = false; ui.toast('تعذر الحفظ: ' + err.message); }
    }
  };
  draw();
};
