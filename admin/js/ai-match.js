/* ════════════════════════════════════════════════════════════
   AI Match — CV × Job matching via OpenAI API (client-side)
   يشتغل لو عندك مفتاح OpenAI في الإعدادات
   لو مفيش مفتاح → يرجع null ويشتغل الـ keyword fallback
   ════════════════════════════════════════════════════════════ */

window.AIMatch = {

  /* ── مفتاح API ── */
  getKey() { return localStorage.getItem('hr_openai_key') || ''; },
  setKey(k) { localStorage.setItem('hr_openai_key', k.trim()); },
  hasKey()  { return !!this.getKey(); },

  /* ── cache بسيط عشان متدفعش مرتين لنفس الطلب ── */
  _cache: {},

  cacheKey(cvText, jobReq) {
    const s = cvText.slice(0, 200) + '|||' + jobReq.slice(0, 200);
    return btoa(unescape(encodeURIComponent(s))).slice(0, 40);
  },

  /* ══════════════════════════════════════════════════════════
     matchAsync(cvText, jobReq)
     → يرجع { pct, label, color, found, missing, source:'ai' }
        أو null لو مفيش مفتاح / حصل error
     ══════════════════════════════════════════════════════════ */
  async matchAsync(cvText, jobReq) {
    if (!this.hasKey()) return null;
    if (!cvText || !jobReq) return null;

    const ck = this.cacheKey(cvText, jobReq);
    if (this._cache[ck]) return this._cache[ck];

    const prompt = `أنت محلل موارد بشرية محترف. قيّم مدى تطابق السيرة الذاتية مع متطلبات الوظيفة.

متطلبات الوظيفة:
${jobReq}

نص السيرة الذاتية:
${cvText.slice(0, 3000)}

أجب بـ JSON فقط بالشكل التالي (بدون أي نص آخر):
{
  "pct": 85,
  "label": "مطابقة قوية",
  "found": ["مهارة 1", "مهارة 2"],
  "missing": ["مهارة 3"]
}

قواعد:
- pct: رقم من 0 إلى 100
- label: "مطابقة قوية" (70-100) | "مطابقة جزئية" (40-69) | "مطابقة ضعيفة" (0-39)
- found: المهارات والخبرات الموجودة في الـ CV
- missing: المتطلبات الغائبة عن الـ CV`;

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + this.getKey(),
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 400,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn('[AIMatch] OpenAI error:', err?.error?.message || res.status);
        return null;
      }

      const data = await res.json();
      const raw  = data.choices?.[0]?.message?.content || '';

      /* استخراج JSON من الرد */
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return null;

      const parsed = JSON.parse(match[0]);
      const pct    = Math.min(100, Math.max(0, Number(parsed.pct) || 0));
      const color  = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';

      const result = {
        pct,
        label:   parsed.label  || (pct >= 70 ? 'مطابقة قوية' : pct >= 40 ? 'مطابقة جزئية' : 'مطابقة ضعيفة'),
        color,
        found:   Array.isArray(parsed.found)   ? parsed.found   : [],
        missing: Array.isArray(parsed.missing) ? parsed.missing : [],
        source:  'ai',
      };

      this._cache[ck] = result;
      return result;

    } catch (e) {
      console.warn('[AIMatch] fetch failed:', e.message);
      return null;
    }
  },

  /* ══════════════════════════════════════════════════════════
     renderResult(result)
     → HTML جاهز للعرض في ملف المرشح
     ══════════════════════════════════════════════════════════ */
  renderResult(r) {
    if (!r) return '';
    const badge = r.source === 'ai'
      ? '<span style="font-size:11px;background:#ede9fe;color:#7c3aed;padding:2px 8px;border-radius:99px;font-weight:700">✨ AI</span>'
      : '<span style="font-size:11px;background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:99px;font-weight:700">🔑 Keywords</span>';

    const foundHtml   = r.found.map(x =>
      '<span class="mtag ok">✓ ' + x + '</span>'
    ).join('');
    const missingHtml = r.missing.map(x =>
      '<span class="mtag miss">✗ ' + x + '</span>'
    ).join('');

    return `
      <div class="cv-match">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <h3 style="margin:0">🎯 تحليل السيرة الذاتية</h3>
          ${badge}
        </div>
        <div style="font-size:28px;font-weight:800;color:${r.color}">${r.pct}%</div>
        <div style="color:${r.color};font-weight:600;margin-bottom:8px">${r.label}</div>
        <div class="match-bar-wrap">
          <div class="match-bar" style="width:${r.pct}%;background:${r.color}"></div>
        </div>
        <div class="match-tags" style="margin-top:12px">
          ${foundHtml}${missingHtml}
        </div>
      </div>`;
  },

  /* ══════════════════════════════════════════════════════════
     settingsHtml() — HTML لصفحة الإعدادات
     ══════════════════════════════════════════════════════════ */
  settingsHtml() {
    const key    = this.getKey();
    const masked = key ? key.slice(0, 7) + '••••••••••••••••' + key.slice(-4) : '';
    return `
      <div class="card" style="max-width:520px">
        <h3 style="margin:0 0 4px">🤖 إعدادات AI — CV Matching</h3>
        <p style="margin:0 0 20px;color:var(--tx2,#6b7280);font-size:14px">
          أضف مفتاح OpenAI وسيستخدمه النظام لتحليل السير الذاتية بدقة أعلى.<br>
          المفتاح محفوظ في المتصفح فقط ولا يُرسل لأي خادم غير OpenAI.
        </p>

        <label class="field">
          <span>مفتاح OpenAI API</span>
          <div style="display:flex;gap:8px">
            <input id="ai-key-input" type="password" placeholder="sk-proj-..." 
              value="${key}" style="flex:1">
            <button class="btn" id="ai-key-save">💾 حفظ</button>
          </div>
          ${masked ? '<div style="font-size:12px;color:#22c55e;margin-top:4px">✅ مفتاح محفوظ: ' + masked + '</div>' : ''}
        </label>

        <div style="margin-top:16px;display:flex;gap:8px;align-items:center">
          <button class="btn ghost" id="ai-key-test">🧪 اختبار الاتصال</button>
          ${key ? '<button class="btn danger ghost" id="ai-key-del">🗑 حذف المفتاح</button>' : ''}
          <span id="ai-test-result" style="font-size:13px"></span>
        </div>

        <div style="margin-top:24px;padding:14px;background:var(--sf,#f8fafc);border-radius:10px;font-size:13px">
          <b>ملاحظات:</b><br>
          • النموذج المستخدم: <b>gpt-4o-mini</b> (اقتصادي وسريع)<br>
          • التكلفة التقريبية: ~0.001$ لكل CV<br>
          • لو مفيش مفتاح: النظام يشتغل بالـ keyword matching تلقائياً<br>
          • المفتاح لا يُشارك مع أي مستخدم آخر
        </div>
      </div>`;
  },

  /* ربط أحداث صفحة الإعدادات */
  bindSettings() {
    const saveBtn = document.getElementById('ai-key-save');
    const testBtn = document.getElementById('ai-key-test');
    const delBtn  = document.getElementById('ai-key-del');
    const result  = document.getElementById('ai-test-result');

    saveBtn?.addEventListener('click', () => {
      const val = document.getElementById('ai-key-input').value.trim();
      if (!val.startsWith('sk-')) {
        result.textContent = '❌ مفتاح غير صحيح — يبدأ بـ sk-';
        result.style.color = '#ef4444';
        return;
      }
      this.setKey(val);
      result.textContent = '✅ تم الحفظ';
      result.style.color = '#22c55e';
      setTimeout(() => location.reload(), 800);
    });

    testBtn?.addEventListener('click', async () => {
      result.textContent = '⏳ جاري الاختبار...';
      result.style.color = '#f59e0b';
      const key = document.getElementById('ai-key-input').value.trim() || this.getKey();
      if (!key) { result.textContent = '❌ لا يوجد مفتاح'; result.style.color = '#ef4444'; return; }
      try {
        const r = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: 'Bearer ' + key }
        });
        if (r.ok) {
          result.textContent = '✅ الاتصال ناجح!';
          result.style.color = '#22c55e';
        } else {
          const e = await r.json().catch(() => ({}));
          result.textContent = '❌ ' + (e?.error?.message || 'خطأ في المفتاح');
          result.style.color = '#ef4444';
        }
      } catch(e) {
        result.textContent = '❌ فشل الاتصال — تحقق من الشبكة';
        result.style.color = '#ef4444';
      }
    });

    delBtn?.addEventListener('click', () => {
      if (!confirm('حذف مفتاح OpenAI؟')) return;
      localStorage.removeItem('hr_openai_key');
      location.reload();
    });
  },
};
