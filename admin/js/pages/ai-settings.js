/* ════════════════════════════════════════════════════════════
   صفحة إعدادات AI — مفتاح OpenAI + اختبار + نموذج
   ════════════════════════════════════════════════════════════ */
HR.pages['ai-settings'] = {
  title: 'إعدادات AI',
  icon:  'sparkle',

  async render(root) {
    const { ui } = HR;

    root.innerHTML = `
      <div class="page-header">
        <h1>🤖 إعدادات الذكاء الاصطناعي</h1>
        <p class="mu">ضبط مفتاح OpenAI لتحليل السير الذاتية بدقة أعلى</p>
      </div>

      <div style="max-width:600px">
        ${window.AIMatch ? AIMatch.settingsHtml() : '<p class="mu">AIMatch غير محمّل</p>'}

        <div class="card" style="margin-top:16px">
          <h3 style="margin:0 0 12px">📊 حالة الـ CV Matching الحالية</h3>
          <div class="kv">
            <span>الوضع</span>
            <b id="ai-mode-label">${window.AIMatch && AIMatch.hasKey() ? '✨ AI (GPT-4o mini)' : '🔑 Keyword Matching'}</b>
          </div>
          <div class="kv">
            <span>الحالة</span>
            <b style="color:${window.AIMatch && AIMatch.hasKey() ? '#22c55e' : '#f59e0b'}">${window.AIMatch && AIMatch.hasKey() ? '✅ مفعّل' : '⚠️ بدون مفتاح — يعمل بـ Keywords'}</b>
          </div>
          <div class="kv">
            <span>النموذج</span>
            <b>gpt-4o-mini (128K context)</b>
          </div>
          <div class="kv">
            <span>التكلفة التقريبية</span>
            <b>~$0.001 لكل تحليل CV</b>
          </div>
        </div>

        <div class="card" style="margin-top:16px">
          <h3 style="margin:0 0 12px">🧪 اختبار مباشر</h3>
          <p class="mu" style="font-size:13px;margin-bottom:12px">اختبر التحليل بنص CV وهمي وشوف النتيجة فوراً</p>
          <button class="btn" id="ai-demo-btn">▶️ تشغيل مثال تجريبي</button>
          <div id="ai-demo-result" style="margin-top:16px"></div>
        </div>
      </div>`;

    /* ربط أحداث صفحة الإعدادات */
    if (window.AIMatch) AIMatch.bindSettings();

    /* Demo */
    document.getElementById('ai-demo-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('ai-demo-btn');
      const out = document.getElementById('ai-demo-result');
      btn.disabled = true;
      btn.textContent = '⏳ جاري التحليل...';

      const demoCV  = `أحمد محمد، 5 سنوات خبرة في المبيعات، أجيد Excel وPowerPoint، لديّ خبرة في CRM وSalesforce، أعمل مع العملاء وأحقق الأهداف الشهرية، أجيد اللغة الإنجليزية`;
      const demoReq = `مطلوب مندوب مبيعات خبرة 3 سنوات على الأقل، إجادة Excel وCRM، اللغة الإنجليزية، مهارات التواصل، SAP ميزة إضافية`;

      let result = null;
      if (AIMatch.hasKey()) {
        result = await AIMatch.matchAsync(demoCV, demoReq);
      }
      if (!result) {
        /* keyword fallback */
        result = HR.pages.recruitment ? null : null;
        out.innerHTML = `<div class="card" style="text-align:center;color:#f59e0b">
          ⚠️ لا يوجد مفتاح AI — أضف مفتاح OpenAI أعلاه ثم أعد المحاولة<br>
          <small class="mu">بدون مفتاح يعمل النظام بالـ keyword matching في صفحة التوظيف</small>
        </div>`;
        btn.disabled = false;
        btn.textContent = '▶️ تشغيل مثال تجريبي';
        return;
      }

      out.innerHTML = `
        <div class="card">
          <div class="mu" style="font-size:12px;margin-bottom:8px">نتيجة تحليل CV تجريبي:</div>
          ${AIMatch.renderResult(result)}
        </div>`;
      btn.disabled = false;
      btn.textContent = '▶️ تشغيل مثال تجريبي';
    });
  },
};
