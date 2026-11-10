(function () {
  const H = window.HR;
  if (!H.auth) {
    H.auth = {
      async ready() { H.user = { name: 'مدير النظام', role: 'admin', demo: true }; },
      async login() {},
      async logout() {},
      async logoutSoft() { H.user = null; }
    };
  }

  const ALLOWED = ['admin', 'hr', 'manager', 'employee'];

  function showLogin(msg) {
    return new Promise(res => {
      const o = document.createElement('div'); o.id = 'login';
      o.innerHTML =
        '<form class="lc">' +
          '<div class="brand"><i>HR</i><b>نظام الموارد البشرية</b></div>' +
          '<h2>تسجيل الدخول</h2>' +
          '<p class="lm">' + (msg || 'أدخل بياناتك للمتابعة') + '</p>' +
          '<label>الإيميل<input type="email" name="e" required autocomplete="username"></label>' +
          '<label>كلمة المرور<input type="password" name="p" required autocomplete="current-password"></label>' +
          '<button class="btn" style="width:100%">دخول</button>' +
        '</form>';
      document.body.append(o);
      const f = o.querySelector('form'), m = o.querySelector('.lm');
      f.onsubmit = async ev => {
        ev.preventDefault();
        const b = f.querySelector('button'); b.disabled = true;
        try {
          await H.auth.login(f.elements.e.value.trim(), f.elements.p.value);
          o.remove(); res();
        } catch (err) {
          m.style.color = 'var(--da)';
          m.textContent = err.message;
          b.disabled = false;
        }
      };
    });
  }

  H.gate = async function () {
    try { await H.auth.ready(); }
    catch (e) {
      H.user = null;
      if (H.mode === 'error') {
        document.body.insertAdjacentHTML('beforeend',
          '<div id="login"><div class="lc">' +
            '<div class="brand"><i>HR</i><b>نظام الموارد البشرية</b></div>' +
            '<h2>خطأ في تشغيل النظام</h2>' +
            '<p class="lm" style="color:var(--da)">' + e.message + '</p>' +
            '<button class="btn" onclick="location.reload()">إعادة المحاولة</button>' +
          '</div></div>');
        await new Promise(() => {});
      }
    }
    let msg = '';
    while (!H.user || ALLOWED.indexOf(H.user.role) < 0) {
      if (H.user) { await H.auth.logoutSoft(); msg = 'هذا الحساب غير مصرح له بالدخول'; }
      await showLogin(msg);
    }
  };
})();
