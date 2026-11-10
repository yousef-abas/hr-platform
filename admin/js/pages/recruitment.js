/* ════════════════════════════════════════════════════════
   نظام ATS — التوظيف الكامل
   المراحل: وظائف · pipeline · مقابلات · عرض · تعيين
   ════════════════════════════════════════════════════════ */
HR.pages.recruitment = {
  title: 'التوظيف', icon: 'userplus',

  async render(root) {
    const { store, ui } = HR;
    const esc = ui.esc;

    /* ── migrate: stage رقم → نص (بيانات قديمة localStorage) ── */
    if (HR.mode === 'local') {
      const MAP = { 0: 'applied', 1: 'screening', 2: 'interview', 3: 'offer', 4: 'hired' };
      const db = HR.store.db;
      let changed = false;
      (db.candidates || []).forEach(c => {
        if (typeof c.stage === 'number') { c.stage = MAP[c.stage] || 'applied'; changed = true; }
      });
      if (changed) HR.store.save();
      if (!db.ats_jobs)       { db.ats_jobs = [];       HR.store.save(); }
      if (!db.ats_interviews) { db.ats_interviews = []; HR.store.save(); }
    }

    const isAdmin = HR.user.role === 'admin' || HR.user.role === 'hr';

    /* ── ثوابت Pipeline ── */
    const STAGES = [
      { k: 'applied',    l: 'تقديم',         c: '#6b7280' },
      { k: 'screening',  l: 'فرز أولي',       c: '#f59e0b' },
      { k: 'interview',  l: 'مقابلة',         c: '#e8b87a' },
      { k: 'offer',      l: 'عرض وظيفي',      c: '#8b5cf6' },
      { k: 'hired',      l: 'تم التعيين ✓',   c: '#22c55e' },
      { k: 'rejected',   l: 'مرفوض',          c: '#ef4444' },
    ];
    const ACTIVE_STAGES = STAGES.slice(0, 4); // بدون hired/rejected في الكانبان

    const JOB_STATUS = { open: 'مفتوحة', hold: 'متوقفة', closed: 'مغلقة' };

    /* state */
    const st = HR.state.ats = HR.state.ats || { view: 'pipeline', jobFilter: '' };

    /* ── تحميل البيانات ── */
    let [CANDS, JOBS, ITVS] = await Promise.all([
      store.list('candidates'),
      store.list('ats_jobs').catch(() => []),
      store.list('ats_interviews').catch(() => []),
    ]);

    /* ── helpers ── */
    const stageOf  = c  => STAGES.find(s => s.k === (c.stage || 'applied')) || STAGES[0];
    const jobOf    = c  => JOBS.find(j => j.id === c.jobId);
    const itvOf    = id => ITVS.filter(i => i.candidateId === id).sort((a,b) => a.date > b.date ? -1 : 1);
    const candOf   = id => CANDS.find(c => c.id === id);
    const tagHtml  = (l, c) => '<span class="tag" style="background:' + c + '22;color:' + c + '">' + l + '</span>';

    /* ════════════════════════════════════════
       CV Matching Engine — بدون AI بدون API
       ════════════════════════════════════════ */
    function matchCV(cvText, jobReq) {
      if (!cvText || !jobReq) return null;

      // normalize: كل حاجة lowercase، شيل علامات ترقيم
      const norm = t => t.toLowerCase()
        .replace(/[،,،.؛;:!\-_\/\\()\[\]{}]/g, ' ')
        .replace(/\s+/g, ' ').trim();

      const cv  = norm(cvText);
      const req = norm(jobReq);

      // استخرج الكلمات المفتاحية من المتطلبات
      // بيفصل على فراغ أو فاصلة أو سطر جديد
      const keywords = req.split(/[\s,،\n]+/)
        .map(w => w.trim())
        .filter(w => w.length > 2); // تجاهل كلمات قصيرة جداً (في، من، إلى...)

      // دمج bigrams (كلمتين مع بعض) عشان يلاقي "خبرة عملية" كوحدة واحدة
      const bigrams = [];
      for (let i = 0; i < keywords.length - 1; i++) {
        bigrams.push(keywords[i] + ' ' + keywords[i + 1]);
      }
      const allTerms = [...new Set([...bigrams, ...keywords])];

      // فحص كل keyword
      const found = [], missing = [];
      const checked = new Set();

      allTerms.forEach(term => {
        // تجنب تكرار كلمة موجودة بالفعل في bigram
        const words = term.split(' ');
        if (words.length === 1 && allTerms.some(t => t.includes(' ') && t.includes(term) && found.includes(t))) return;
        if (checked.has(term)) return;
        checked.add(term);

        if (cv.includes(term)) found.push(term);
        else missing.push(term);
      });

      // احسب النسبة على الكلمات المنفردة فقط (أدق)
      const singleFound   = found.filter(t => !t.includes(' ')).length;
      const singleMissing = missing.filter(t => !t.includes(' ')).length;
      const total = singleFound + singleMissing;
      const pct   = total === 0 ? 0 : Math.round((singleFound / total) * 100);

      // لون النسبة
      const color = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';
      const label = pct >= 70 ? 'مطابقة قوية ✅' : pct >= 40 ? 'مطابقة جزئية ⚠️' : 'مطابقة ضعيفة ❌';

      return { pct, color, label, found, missing, total };
    }

    /* عرض نتيجة المطابقة HTML */
    function matchHtml(result) {
      if (!result) return '';
      const bar = Math.min(100, result.pct);
      return (
        '<section class="card cv-match" style="margin-bottom:12px">' +
          '<h3>🎯 تحليل السيرة الذاتية</h3>' +

          /* شريط النسبة */
          '<div class="match-bar-wrap">' +
            '<div class="match-bar" style="width:' + bar + '%;background:' + result.color + '"></div>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin:6px 0 12px">' +
            '<b style="font-size:22px;color:' + result.color + '">' + result.pct + '%</b>' +
            '<span style="color:' + result.color + ';font-weight:700">' + result.label + '</span>' +
          '</div>' +

          /* موجود */
          (result.found.filter(t=>!t.includes(' ')).length > 0
            ? '<div class="match-tags">' +
                '<small style="color:var(--mu)">✓ موجود في الـ CV:</small><br>' +
                result.found.filter(t=>!t.includes(' ')).map(t =>
                  '<span class="mtag ok">' + t + '</span>'
                ).join('') +
              '</div>'
            : '') +

          /* مفقود */
          (result.missing.filter(t=>!t.includes(' ')).length > 0
            ? '<div class="match-tags" style="margin-top:8px">' +
                '<small style="color:var(--mu)">✗ غير موجود:</small><br>' +
                result.missing.filter(t=>!t.includes(' ')).slice(0, 15).map(t =>
                  '<span class="mtag miss">' + t + '</span>'
                ).join('') +
              '</div>'
            : '') +

        '</section>'
      );
    }

    /* ── render ── */
    function draw() {
      const v = st.view;
      root.innerHTML =

        /* Header */
        ui.head('نظام التوظيف ATS', 'إدارة الوظائف والمرشحين والمقابلات',
          '<button class="btn ghost" data-a="jobs">🗂 الوظائف</button> ' +
          '<button class="btn ghost" data-a="pipeline">📋 Pipeline</button> ' +
          (isAdmin ? '<button class="btn" data-a="newcand">+ مرشح جديد</button>' : '')
        ) +

        /* KPIs */
        '<div class="kpi-row">' +
          STAGES.slice(0,4).map(s =>
            '<div class="kpi-card" style="--kc:' + s.c + '">' +
              '<div class="kpi-val" style="color:' + s.c + '">' + CANDS.filter(c => (c.stage||'applied') === s.k).length + '</div>' +
              '<div class="kpi-lbl">' + s.l + '</div>' +
            '</div>'
          ).join('') +
          '<div class="kpi-card" style="--kc:#22c55e">' +
            '<div class="kpi-val" style="color:#22c55e">' + CANDS.filter(c => c.stage === 'hired').length + '</div>' +
            '<div class="kpi-lbl">تم تعيينهم</div>' +
          '</div>' +
          '<div class="kpi-card" style="--kc:#6b7280">' +
            '<div class="kpi-val" style="color:#6b7280">' + JOBS.filter(j => j.status === 'open').length + '</div>' +
            '<div class="kpi-lbl">وظائف مفتوحة</div>' +
          '</div>' +
        '</div>' +

        /* Job filter bar */
        '<div class="filter-bar">' +
          '<select id="job-filter">' +
            '<option value="">كل الوظائف</option>' +
            JOBS.map(j => '<option value="' + j.id + '"' + (st.jobFilter === j.id ? ' selected' : '') + '>' + esc(j.title) + (j.dept ? ' — ' + esc(j.dept) : '') + '</option>').join('') +
          '</select>' +
        '</div>' +

        (v === 'pipeline' ? drawPipeline() : drawJobs());

      /* events */
      root.querySelector('#job-filter').onchange = e => { st.jobFilter = e.target.value; draw(); };
      root.onclick = handleClick;
    }

    /* ── Kanban Pipeline ── */
    function drawPipeline() {
      const filtered = st.jobFilter ? CANDS.filter(c => c.jobId === st.jobFilter) : CANDS;
      return (
        '<div class="board">' +
          ACTIVE_STAGES.map(s =>
            '<div class="col">' +
              '<div class="col-head" style="--cc:' + s.c + '">' +
                '<span>' + s.l + '</span>' +
                '<span class="col-count">' + filtered.filter(c => (c.stage||'applied') === s.k).length + '</span>' +
              '</div>' +
              '<div class="col-body">' +
                filtered.filter(c => (c.stage||'applied') === s.k).map(c => candCard(c, s)).join('') +
                (filtered.filter(c => (c.stage||'applied') === s.k).length === 0
                  ? '<div class="col-empty">لا يوجد مرشحون</div>' : '') +
              '</div>' +
            '</div>'
          ).join('') +
        '</div>'
      );
    }

    function candCard(c, s) {
      const job     = jobOf(c);
      const itv     = itvOf(c.id);
      const lastItv = itv[0];
      const match   = job && job.req && c.cvText ? matchCV(c.cvText, job.req) : null;
      return (
        '<div class="cd" data-id="' + c.id + '">' +
          '<div class="cd-name">' + esc(c.name) + '</div>' +
          '<div class="cd-role">' + (job ? '🗂 ' + esc(job.title) : c.role ? '🎯 ' + esc(c.role) : '') + '</div>' +
          (c.phone ? '<div class="cd-info">📞 ' + esc(c.phone) + '</div>' : '') +
          (lastItv ? '<div class="cd-info">🗓 ' + lastItv.date + (lastItv.result ? ' · ' + esc(lastItv.result) : '') + '</div>' : '') +
          /* نسبة المطابقة */
          (match
            ? '<div><span class="cd-match" style="background:' + match.color + '22;color:' + match.color + '">🎯 ' + match.pct + '% — ' + match.label + '</span></div>'
            : (job && job.req && !c.cvText ? '<div><span class="cd-match" style="background:#f3f4f6;color:#6b7280">📄 بدون CV</span></div>' : '')) +
          '<div class="cd-acts">' +
            (s.k !== 'applied'   ? '<button class="btn ghost sm" data-a="prev" data-id="' + c.id + '">← رجوع</button>' : '') +
            (s.k !== 'offer'
              ? '<button class="btn sm" data-a="next" data-id="' + c.id + '">التالي →</button>'
              : '<button class="btn sm" data-a="offer" data-id="' + c.id + '">📄 إرسال عرض</button>') +
            '<button class="btn ghost sm" data-a="profile" data-id="' + c.id + '">ملف</button>' +
            (isAdmin ? '<button class="btn danger sm" data-a="reject" data-id="' + c.id + '">✕</button>' : '') +
          '</div>' +
        '</div>'
      );
    }

    /* ── قائمة الوظائف ── */
    function drawJobs() {
      return (
        '<div style="display:flex;justify-content:space-between;align-items:center;margin:16px 0 8px">' +
          '<h3 style="margin:0">الوظائف المتاحة</h3>' +
          (isAdmin ? '<button class="btn" data-a="newjob">+ وظيفة جديدة</button>' : '') +
        '</div>' +
        '<section class="card" style="padding:0;overflow:hidden">' +
          (JOBS.length === 0
            ? '<p class="mu" style="padding:20px;text-align:center">لا توجد وظائف بعد</p>'
            : JOBS.map(j => jobRow(j)).join('')) +
        '</section>'
      );
    }

    function jobRow(j) {
      const count = CANDS.filter(c => c.jobId === j.id).length;
      const sc = { open: '#22c55e', hold: '#f59e0b', closed: '#ef4444' }[j.status] || '#6b7280';
      return (
        '<div class="att-row" data-jid="' + j.id + '">' +
          '<div>' +
            '<b>' + esc(j.title) + '</b>' +
            '<small>' + (j.dept ? esc(j.dept) + ' · ' : '') + (j.type || '') + (j.salary ? ' · ' + ui.money(j.salary) : '') + '</small>' +
            (j.desc ? '<small style="color:var(--mu)">' + esc(j.desc).slice(0, 80) + (j.desc.length > 80 ? '...' : '') + '</small>' : '') +
          '</div>' +
          '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
            tagHtml(JOB_STATUS[j.status] || j.status, sc) +
            '<span class="badge-count">' + count + ' مرشح</span>' +
            (isAdmin
              ? '<button class="btn ghost sm" data-a="editjob" data-jid="' + j.id + '">تعديل</button>' +
                '<button class="btn ghost sm" data-a="closejob" data-jid="' + j.id + '">' + (j.status === 'open' ? 'إغلاق' : 'فتح') + '</button>'
              : '') +
          '</div>' +
        '</div>'
      );
    }

    /* ── ملف المرشح الكامل ── */
    /* ── ملف المرشح الكامل + CV Matching ── */
    async function showProfile(id) {
      const c = candOf(id); if (!c) return;
      const job   = jobOf(c);
      const itvs  = itvOf(id);
      const sg    = stageOf(c);
      const match = job && job.req ? matchCV(c.cvText || '', job.req) : null;


      const html =
        '<div class="modal-box">' +
          '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px">' +
            '<div>' +
              '<h2 style="margin:0">' + esc(c.name) + '</h2>' +
              '<p style="margin:4px 0;color:var(--mu)">' + (job ? esc(job.title) : esc(c.role||'')) + '</p>' +
              tagHtml(sg.l, sg.c) +
            '</div>' +
            '<button class="btn ghost" data-a="close-modal">✕</button>' +
          '</div>' +

          (match
            ? matchHtml(match)
            : job && job.req && !c.cvText
              ? '<section class="card cv-match" style="margin-bottom:12px;text-align:center">' +
                  '<p class="mu">📄 لم يُضف نص السيرة الذاتية بعد</p>' +
                  (isAdmin ? '<button class="btn ghost sm" data-a="add-cv" data-id="' + id + '">+ إضافة نص الـ CV</button>' : '') +
                '</section>'
              : !job
                ? '<section class="card cv-match" style="margin-bottom:12px;text-align:center">' +
                    '<p class="mu">ربّط المرشح بوظيفة عشان يظهر تحليل الـ CV</p>' +
                  '</section>'
                : '') +

          /* ── البيانات الأساسية ── */
          '<section class="card" style="margin-bottom:12px">' +
            '<div style="display:flex;justify-content:space-between;align-items:center">' +
              '<h3 style="margin:0">البيانات الأساسية</h3>' +
              (isAdmin ? '<button class="btn ghost sm" data-a="add-cv" data-id="' + id + '">' + (c.cvText ? '✏️ تعديل CV' : '+ إضافة CV') + '</button>' : '') +
            '</div>' +
            (c.phone   ? '<div class="kv"><span>الهاتف</span><b>' + esc(c.phone) + '</b></div>' : '') +
            (c.email   ? '<div class="kv"><span>الإيميل</span><b>' + esc(c.email) + '</b></div>' : '') +
            (c.source  ? '<div class="kv"><span>المصدر</span><b>' + esc(c.source) + '</b></div>' : '') +
            (c.cvUrl   ? '<div class="kv"><span>رابط CV</span><a href="' + esc(c.cvUrl) + '" target="_blank" class="btn ghost sm">فتح ↗</a></div>' : '') +
            (c.note    ? '<div class="kv"><span>ملاحظات</span><b>' + esc(c.note) + '</b></div>' : '') +
            (c.cvText  ? '<div class="kv"><span>نص CV</span><span class="mu" style="font-size:11px">' + esc(c.cvText).slice(0,80) + '...</span></div>' : '') +
          '</section>' +

          /* ── المقابلات ── */
          '<section class="card" style="margin-bottom:12px">' +
            '<div style="display:flex;justify-content:space-between;align-items:center">' +
              '<h3 style="margin:0">المقابلات</h3>' +
              (isAdmin ? '<button class="btn ghost sm" data-a="add-itv" data-id="' + id + '">+ مقابلة</button>' : '') +
            '</div>' +
            (itvs.length === 0
              ? '<p class="mu">لا توجد مقابلات مسجلة</p>'
              : itvs.map(i =>
                  '<div class="att-row">' +
                    '<div>' +
                      '<b>' + (i.type || 'مقابلة') + '</b>' +
                      '<small>' + i.date + (i.time ? ' — ' + i.time : '') + (i.interviewer ? ' · مع ' + esc(i.interviewer) : '') + '</small>' +
                      (i.notes ? '<small style="color:var(--mu)">' + esc(i.notes) + '</small>' : '') +
                    '</div>' +
                    '<div>' +
                      (i.result ? tagHtml(i.result, i.result === 'ناجح' ? '#22c55e' : i.result === 'راسب' ? '#ef4444' : '#f59e0b') : '<span class="mu">لم يُحدد</span>') +
                      (isAdmin ? ' <button class="btn ghost sm" data-a="edit-itv" data-iid="' + i.id + '" data-id="' + id + '">تعديل</button>' : '') +
                    '</div>' +
                  '</div>'
                ).join('')) +
          '</section>' +

          /* ── عرض / تعيين ── */
          (isAdmin && c.stage !== 'hired' && c.stage !== 'rejected'
            ? '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
                (c.stage === 'offer'
                  ? '<button class="btn" data-a="hire" data-id="' + id + '">✅ تحويل لموظف</button>'
                  : '') +
                '<button class="btn danger" data-a="reject" data-id="' + id + '">✕ رفض المرشح</button>' +
              '</div>'
            : '') +

        '</div>';

      showModal(html);
    }

    /* ── Modal ── */
    function showModal(html) {
      let ov = document.getElementById('ats-modal');
      if (!ov) { ov = document.createElement('div'); ov.id = 'ats-modal'; ov.className = 'modal-ov'; document.body.appendChild(ov); }
      ov.innerHTML = html;
      ov.style.display = 'flex';
      ov.onclick = async e => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        const a = b.dataset.a, cid = b.dataset.id, iid = b.dataset.iid;
        if (a === 'close-modal') { ov.style.display = 'none'; return; }

        /* ── إضافة / تعديل نص الـ CV ── */
        if (a === 'add-cv') {
          const c = candOf(cid);
          const o = await ui.form('📄 نص السيرة الذاتية', [
            { n: 'cvText', l: 'الصق نص الـ CV كاملاً هنا', t: 'textarea', req: 1 },
          ], { cvText: c.cvText || '' });
          if (!o) return;
          await store.update('candidates', cid, { cvText: o.cvText });
          CANDS = await store.list('candidates');
          ov.style.display = 'none';
          await showProfile(cid);
          draw();
          return;
        }

        if (a === 'add-itv' || a === 'edit-itv') {
          const existing = iid ? ITVS.find(x => x.id === iid) : null;
          const o = await ui.form(a === 'add-itv' ? 'مقابلة جديدة' : 'تعديل المقابلة', [
            { n: 'date',        l: 'التاريخ',        t: 'date',   req: 1 },
            { n: 'time',        l: 'الوقت',          t: 'time' },
            { n: 'type',        l: 'نوع المقابلة',   opts: [['','—'],['هاتفية','هاتفية'],['أونلاين','أونلاين'],['شخصية','شخصية'],['تقنية','تقنية']] },
            { n: 'interviewer', l: 'المحاور' },
            { n: 'result',      l: 'النتيجة',        opts: [['','—'],['ناجح','ناجح'],['راسب','راسب'],['معلق','معلق']] },
            { n: 'notes',       l: 'ملاحظات' },
          ], existing || { date: ui.today() });
          if (!o) return;
          o.candidateId = cid || (existing && existing.candidateId);
          if (existing) await store.update('ats_interviews', iid, o);
          else await store.create('ats_interviews', o);
          ITVS = await store.list('ats_interviews').catch(() => []);
          ov.style.display = 'none';
          await showProfile(cid || existing.candidateId);
          draw();
        }

        if (a === 'hire') { ov.style.display = 'none'; await doHire(cid); }
        if (a === 'reject') {
          if (!confirm('رفض المرشح نهائياً؟')) return;
          await store.update('candidates', cid, { stage: 'rejected' });
          CANDS = await store.list('candidates');
          ov.style.display = 'none';
          draw();
        }
      };
    }

    /* ── تعيين موظف ── */
    async function doHire(id) {
      const c = candOf(id);
      const o = await ui.form('بيانات الموظف الجديد', HR.empFields, {
        name: c.name, title: c.role || (jobOf(c) ? jobOf(c).title : ''),
        status: 'active', allow: 0, hire: ui.today()
      });
      if (!o) return;
      o.salary = +o.salary; o.allow = +o.allow || 0;
      await store.create('employees', o);
      await store.update('candidates', id, { stage: 'hired' });
      CANDS = await store.list('candidates');
      ui.toast('✅ تم تعيين ' + c.name + ' وإضافته لسجل الموظفين');
      draw();
    }

    /* ── onClick handler ── */
    async function handleClick(e) {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a, id = b.dataset.id, jid = b.dataset.jid;

      /* تبديل العرض */
      if (a === 'pipeline') { st.view = 'pipeline'; draw(); return; }
      if (a === 'jobs')     { st.view = 'jobs';     draw(); return; }

      /* مرشح جديد */
      if (a === 'newcand') {
        const o = await ui.form('مرشح جديد', [
          { n: 'name',   l: 'الاسم',                req: 1 },
          { n: 'jobId',  l: 'الوظيفة', opts: [['','— بدون —']].concat(JOBS.filter(j=>j.status==='open').map(j=>[j.id, j.title])) },
          { n: 'role',   l: 'المسمى الوظيفي (إن لم تختر وظيفة)' },
          { n: 'phone',  l: 'الهاتف',   t: 'tel' },
          { n: 'email',  l: 'الإيميل',  t: 'email' },
          { n: 'source', l: 'مصدر التقديم', opts: [['','—'],['LinkedIn','LinkedIn'],['موقع الشركة','موقع الشركة'],['توصية','توصية'],['بوابة توظيف','بوابة توظيف'],['أخرى','أخرى']] },
          { n: 'cvUrl',  l: 'رابط السيرة الذاتية' },
          { n: 'note',   l: 'ملاحظات' },
        ]);
        if (!o) return;
        o.stage = 'applied';
        if (o.jobId && !o.role) { const j = JOBS.find(x => x.id === o.jobId); if (j) o.role = j.title; }
        await store.create('candidates', o);
        CANDS = await store.list('candidates');
        ui.toast('✅ تمت إضافة المرشح');
        draw(); return;
      }

      /* ملف المرشح */
      if (a === 'profile') { await showProfile(id); return; }

      /* تقدم / رجوع في pipeline */
      if (a === 'next' || a === 'prev') {
        const c = candOf(id); if (!c) return;
        const idx = ACTIVE_STAGES.findIndex(s => s.k === (c.stage || 'applied'));
        const nidx = idx + (a === 'next' ? 1 : -1);
        if (nidx < 0 || nidx >= ACTIVE_STAGES.length) return;
        await store.update('candidates', id, { stage: ACTIVE_STAGES[nidx].k });
        CANDS = await store.list('candidates');
        draw(); return;
      }

      /* إرسال عرض */
      if (a === 'offer') {
        const c = candOf(id);
        const o = await ui.form('📄 إرسال عرض وظيفي', [
          { n: 'salary',  l: 'الراتب المقترح', t: 'number', req: 1 },
          { n: 'startDate', l: 'تاريخ بدء العمل', t: 'date', req: 1 },
          { n: 'note',    l: 'ملاحظات العرض' },
        ], { startDate: ui.today() });
        if (!o) return;
        await store.update('candidates', id, { stage: 'offer', offerSalary: +o.salary, offerStart: o.startDate, offerNote: o.note });
        CANDS = await store.list('candidates');
        ui.toast('📄 تم رفع العرض للمرحلة التالية');
        draw(); return;
      }

      /* تعيين */
      if (a === 'hire') { await doHire(id); return; }

      /* رفض */
      if (a === 'reject') {
        if (!confirm('رفض المرشح نهائياً؟')) return;
        await store.update('candidates', id, { stage: 'rejected' });
        CANDS = await store.list('candidates');
        draw(); return;
      }

      /* وظيفة جديدة */
      if (a === 'newjob') {
        const o = await ui.form('وظيفة جديدة', [
          { n: 'title',  l: 'المسمى الوظيفي', req: 1 },
          { n: 'dept',   l: 'القسم' },
          { n: 'type',   l: 'نوع العمل', opts: [['full','دوام كامل'],['part','جزئي'],['contract','عقد'],['intern','تدريب']] },
          { n: 'salary', l: 'الراتب', t: 'number' },
          { n: 'desc',   l: 'وصف الوظيفة' },
          { n: 'req',    l: 'المتطلبات' },
        ]);
        if (!o) return;
        o.status = 'open';
        await store.create('ats_jobs', o);
        JOBS = await store.list('ats_jobs').catch(() => []);
        ui.toast('✅ تم فتح الوظيفة');
        draw(); return;
      }

      /* تعديل وظيفة */
      if (a === 'editjob') {
        const j = JOBS.find(x => x.id === jid); if (!j) return;
        const o = await ui.form('تعديل الوظيفة', [
          { n: 'title',  l: 'المسمى الوظيفي', req: 1 },
          { n: 'dept',   l: 'القسم' },
          { n: 'type',   l: 'نوع العمل', opts: [['full','دوام كامل'],['part','جزئي'],['contract','عقد'],['intern','تدريب']] },
          { n: 'salary', l: 'الراتب', t: 'number' },
          { n: 'desc',   l: 'وصف الوظيفة' },
          { n: 'req',    l: 'المتطلبات' },
        ], j);
        if (!o) return;
        await store.update('ats_jobs', jid, o);
        JOBS = await store.list('ats_jobs').catch(() => []);
        draw(); return;
      }

      /* فتح / إغلاق وظيفة */
      if (a === 'closejob') {
        const j = JOBS.find(x => x.id === jid); if (!j) return;
        await store.update('ats_jobs', jid, { status: j.status === 'open' ? 'closed' : 'open' });
        JOBS = await store.list('ats_jobs').catch(() => []);
        draw(); return;
      }
    }

    draw();
  }
};
