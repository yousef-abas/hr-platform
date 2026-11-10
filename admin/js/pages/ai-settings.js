/* ════════════════════════════════════════════════════════════
   صفحة إعدادات AI — مفتاح OpenAI + اختبار + نموذج
   ════════════════════════════════════════════════════════════ */
HR.pages['ai-settings'] = {
  title: 'إعدادات AI',
  icon:  'sparkle',

  async render(root) {
    root.innerHTML = `
      <div class="page-header">
        <h1>🤖 إعدادات الذكاء الاصطناعي</h1>
        <p class="mu">ضبط مفتاح OpenAI لتحليل السير الذاتية بدقة أعلى</p>
      </div>

      <div style="max-width:600px">

        <!-- ── مفتاح API ── -->
        <div class="card" style="margin-bottom:16px">
          <h3 style="margin:0 0 4px">🔑 مفتاح OpenAI API</h3>
          <p class="mu" style="font-size:13px;margin-bottom:16px">
            المفتاح محفوظ في المتصفح فقط ولا يُرسل لأي خادم غير OpenAI مباشرة.
          </p>

          <label class="field" style="margin-bottom:12px">
            <span>المفتاح</span>
            <div style="display:flex;gap:8px">
              <input id="ai-key-input" type="password" placeholder="sk-proj-..."
                style="flex:1" autocomplete="off">
              <button class="btn" id="ai-key-save">💾 حفظ</button>
            </div>
          </label>

          <div id="ai-key-status" style="margin-bottom:12px;font-size:13px"></div>

          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn ghost" id="ai-key-test">🧪 اختبار الاتصال</button>
            <button class="btn ghost" id="ai-key-show">👁 عرض المفتاح</button>
            <button class="btn danger ghost" id="ai-key-del">🗑 حذف</button>
          </div>
          <div id="ai-test-result" style="margin-top:10px;font-size:13px;font-weight:600"></div>
        </div>

        <!-- ── الحالة الحالية ── -->
        <div class="card" style="margin-bottom:16px">
          <h3 style="margin:0 0 12px">📊 الحالة الحالية</h3>
          <div id="ai-status-box"></div>
        </div>

        <!-- ── تجربة مباشرة ── -->
        <div class="card">
          <h3 style="margin:0 0 8px">🧪 تجربة مباشرة</h3>
          <p class="mu" style="font-size:13px;margin-bottom:12px">اضغط لتحليل CV تجريبي وتشوف النتيجة فوراً</p>
          <button class="btn" id="ai-demo-btn">▶️ تشغيل مثال</button>
          <div id="ai-demo-result" style="margin-top:16px"></div>
        </div>

      </div>`;

    /* ── تحديث حالة المفتاح ── */
    function refreshStatus() {
      const key = window.AIMatch ? AIMatch.getKey() : '';
      const statusEl = document.getElementById('ai-key-status');
      const boxEl    = document.getElementById('ai-status-box');

      if (key) {
        const masked = key.slice(0, 7) + '••••••••••••••••' + key.slice(-4);
        statusEl.innerHTML = `<span style="color:#22c55e">✅ مفتاح محفوظ: ${masked}</span>`;
        boxEl.innerHTML = `
          <div class="kv"><span>الوضع</span><b>✨ AI (GPT-4o mini)</b></div>
          <div class="kv"><span>الحالة</span><b style="color:#22c55e">✅ مفعّل</b></div>
          <div class="kv"><span>النموذج</span><b>gpt-4o-mini</b></div>
          <div class="kv"><span>التكلفة التقريبية</span><b>~$0.001 لكل تحليل</b></div>`;
      } else {
        statusEl.innerHTML = `<span style="color:#f59e0b">⚠️ لا يوجد مفتاح محفوظ</span>`;
        boxEl.innerHTML = `
          <div class="kv"><span>الوضع</span><b>🔑 Keyword Matching (بدون AI)</b></div>
          <div class="kv"><span>الحالة</span><b style="color:#f59e0b">⚠️ يعمل بدون مفتاح</b></div>`;
      }
    }
    refreshStatus();

    /* ── حفظ ── */
    document.getElementById('ai-key-save').addEventListener('click', () => {
      const val = document.getElementById('ai-key-input').value.trim();
      const res = document.getElementById('ai-test-result');
      if (!val) { res.innerHTML = '<span style="color:#ef4444">❌ أدخل المفتاح أولاً</span>'; return; }
      if (!val.startsWith('sk-')) { res.innerHTML = '<span style="color:#ef4444">❌ المفتاح غير صحيح — يجب أن يبدأ بـ sk-</span>'; return; }
      AIMatch.setKey(val);
      document.getElementById('ai-key-input').value = '';
      res.innerHTML = '<span style="color:#22c55e">✅ تم الحفظ بنجاح!</span>';
      refreshStatus();
    });

    /* ── عرض / إخفاء ── */
    document.getElementById('ai-key-show').addEventListener('click', () => {
      const inp = document.getElementById('ai-key-input');
      const key = AIMatch.getKey();
      if (!key) { document.getElementById('ai-test-result').innerHTML = '<span style="color:#f59e0b">⚠️ لا يوجد مفتاح محفوظ</span>'; return; }
      inp.type   = inp.type === 'password' ? 'text' : 'password';
      inp.value  = inp.type === 'text' ? key : '';
    });

    /* ── حذف ── */
    document.getElementById('ai-key-del').addEventListener('click', () => {
      if (!AIMatch.getKey()) { document.getElementById('ai-test-result').innerHTML = '<span style="color:#f59e0b">⚠️ لا يوجد مفتاح محفوظ</span>'; return; }
      if (!confirm('حذف مفتاح OpenAI؟')) return;
      localStorage.removeItem('hr_openai_key');
      document.getElementById('ai-key-input').value = '';
      document.getElementById('ai-test-result').innerHTML = '<span style="color:#22c55e">✅ تم الحذف</span>';
      refreshStatus();
    });

    /* ── اختبار الاتصال ── */
    document.getElementById('ai-key-test').addEventListener('click', async () => {
      const res = document.getElementById('ai-test-result');
      const key = document.getElementById('ai-key-input').value.trim() || AIMatch.getKey();
      if (!key) { res.innerHTML = '<span style="color:#ef4444">❌ لا يوجد مفتاح — أدخله أو احفظه أولاً</span>'; return; }

      res.innerHTML = '<span style="color:#f59e0b">⏳ جاري الاختبار...</span>';
      try {
        const r = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': 'Bearer ' + key }
        });
        if (r.ok) {
          res.innerHTML = '<span style="color:#22c55e">✅ الاتصال ناجح! المفتاح صحيح وشغّال ✓</span>';
        } else {
          const e = await r.json().catch(() => ({}));
          const msg = e?.error?.message || ('HTTP ' + r.status);
          res.innerHTML = `<span style="color:#ef4444">❌ خطأ: ${msg}</span>`;
        }
      } catch (e) {
        res.innerHTML = `<span style="color:#ef4444">❌ فشل الاتصال — تأكد من الشبكة (${e.message})</span>`;
      }
    });

    /* ── Demo ── */
    document.getElementById('ai-demo-btn').addEventListener('click', async () => {
      const btn = document.getElementById('ai-demo-btn');
      const out = document.getElementById('ai-demo-result');

      const key = AIMatch.getKey();
      if (!key) {
        out.innerHTML = `<div class="card" style="color:#f59e0b;text-align:center">
          ⚠️ احفظ مفتاح OpenAI أعلاه أولاً، ثم اضغط مجدداً
        </div>`;
        return;
      }

      btn.disabled = true;
      btn.textContent = '⏳ جاري التحليل بـ AI...';
      out.innerHTML = '';

      const demoCV = `أحمد محمد علي
خبرة 5 سنوات في مجال المبيعات والتسويق
المهارات: Excel, PowerPoint, CRM, Salesforce, تواصل مع العملاء
اللغات: العربية (أصلية), الإنجليزية (ممتازة)
الشهادة: بكالوريوس إدارة أعمال 2019`;

      const demoReq = `مطلوب مندوب مبيعات:
- خبرة 3 سنوات على الأقل في المبيعات
- إجادة Excel وCRM
- اللغة الإنجليزية
- مهارات التواصل مع العملاء
- SAP ميزة إضافية
- شهادة جامعية`;

      const result = await AIMatch.matchAsync(demoCV, demoReq);

      if (result) {
        out.innerHTML = `<div class="card">${AIMatch.renderResult(result)}</div>`;
      } else {
        out.innerHTML = `<div class="card" style="color:#ef4444">
          ❌ فشل التحليل — تحقق من صحة المفتاح باستخدام "اختبار الاتصال" أعلاه
        </div>`;
      }

      btn.disabled = false;
      btn.textContent = '▶️ تشغيل مثال';
    });
  },
};
