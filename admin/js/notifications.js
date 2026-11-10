/* ─────────────────────────────────────────────────────────────────────
   notifications.js — نظام الإشعارات الداخلية
   ───────────────────────────────────────────────────────────────────── */
HR.notifications = {

  _panel: null,
  _count: 0,

  /* جلب الإشعارات حسب الـ role */
  async fetch() {
    const { store, user } = HR;
    const role = user.role;
    const today = HR.ui.today();
    const items = [];

    try {
      const [leaves, emps] = await Promise.all([
        store.list('leaves'),
        store.list('employees'),
      ]);

      const empById = id => (emps.find(e => e.id === id) || { name: '—' });

      if (role === 'admin' || role === 'hr') {
        /* إجازات في انتظار HR */
        leaves.filter(l => l.status === 'معلقة HR').forEach(l => {
          items.push({
            icon: '🏖️',
            color: '#d97706',
            title: 'طلب إجازة ينتظر موافقتك',
            body: empById(l.empId).name + ' · ' + l.type + ' · ' + l.days + ' أيام',
            href: '#leaves',
            time: l.createdAt || ''
          });
        });

        /* إجازات معلقة عند المدير (تأخر) */
        leaves.filter(l => l.status === 'معلقة').forEach(l => {
          items.push({
            icon: '⏳',
            color: '#7c3aed',
            title: 'طلب معلق عند المدير',
            body: empById(l.empId).name + ' · ' + l.type,
            href: '#leaves',
            time: l.createdAt || ''
          });
        });

        /* موظفون تنتهي عقودهم خلال 30 يوم */
        emps.filter(e => e.contractEnd && e.status !== 'terminated').forEach(e => {
          const diff = Math.ceil((new Date(e.contractEnd) - new Date(today)) / 86400000);
          if (diff >= 0 && diff <= 30) {
            items.push({
              icon: '📋',
              color: '#ef4444',
              title: 'عقد ينتهي قريباً',
              body: e.name + ' · بعد ' + diff + ' يوم (' + e.contractEnd + ')',
              href: '#employees',
              time: ''
            });
          }
        });

      } else if (role === 'manager') {
        /* إجازات فريقه المعلقة */
        const me = emps.find(e => e.id === user.employeeId);
        if (me) {
          const teamIds = emps.filter(e => e.managerId === me.id && e.id !== me.id).map(e => e.id);
          leaves.filter(l => teamIds.includes(l.empId) && l.status === 'معلقة').forEach(l => {
            items.push({
              icon: '🏖️',
              color: '#d97706',
              title: 'طلب إجازة ينتظر موافقتك',
              body: empById(l.empId).name + ' · ' + l.type + ' · ' + l.days + ' أيام',
              href: '#manager',
              time: l.createdAt || ''
            });
          });
        }

      } else if (role === 'employee') {
        /* تحديثات طلبات الموظف نفسه */
        const myId = user.employeeId;
        leaves.filter(l => l.empId === myId).forEach(l => {
          if (l.status === 'موافق عليها') {
            items.push({
              icon: '✅',
              color: '#16a34a',
              title: 'تمت الموافقة على طلبك',
              body: l.type + ' · ' + l.from + ' → ' + l.to,
              href: '#employee',
              time: l.mgrAt || l.decidedAt || ''
            });
          } else if (l.status === 'مرفوضة') {
            items.push({
              icon: '❌',
              color: '#ef4444',
              title: 'تم رفض طلبك',
              body: l.type + (l.rejectReason ? ' · ' + l.rejectReason : ''),
              href: '#employee',
              time: l.mgrAt || l.decidedAt || ''
            });
          }
        });
      }

    } catch (_) {}

    /* ترتيب بالأحدث */
    items.sort((a, b) => (b.time || '') > (a.time || '') ? 1 : -1);
    return items;
  },

  /* تحديث الـ badge */
  async updateBadge() {
    const items = await this.fetch();
    this._count = items.length;
    const badge = document.getElementById('notif-badge');
    if (badge) {
      badge.textContent = this._count || '';
      badge.style.display = this._count ? 'flex' : 'none';
    }
    return items;
  },

  /* فتح/إغلاق الـ panel */
  async toggle(anchor) {
    if (this._panel) { this._panel.remove(); this._panel = null; return; }

    const items = await this.updateBadge();
    const ui = HR.ui;

    const panel = document.createElement('div');
    panel.id = 'notif-panel';
    panel.innerHTML =
      '<div class="np-head">' +
        '<b>🔔 الإشعارات</b>' +
        (items.length ? '<span class="np-count">' + items.length + '</span>' : '') +
        '<button class="np-close" id="np-close">✕</button>' +
      '</div>' +
      '<div class="np-body">' +
        (items.length
          ? items.map(it =>
              '<a class="np-item" href="' + it.href + '">' +
                '<div class="np-ic" style="background:' + it.color + '20;color:' + it.color + '">' + it.icon + '</div>' +
                '<div class="np-info">' +
                  '<b>' + ui.esc(it.title) + '</b>' +
                  '<span>' + ui.esc(it.body) + '</span>' +
                  (it.time ? '<small>' + it.time.slice(0, 10) + '</small>' : '') +
                '</div>' +
              '</a>'
            ).join('')
          : '<div class="np-empty">✅ لا توجد إشعارات جديدة</div>') +
      '</div>';

    document.body.appendChild(panel);
    this._panel = panel;

    /* موضع الـ panel تحت الزر */
    const rect = anchor.getBoundingClientRect();
    panel.style.top  = (rect.bottom + 8) + 'px';
    panel.style.left = Math.max(8, rect.right - 320) + 'px';

    panel.querySelector('#np-close').onclick = () => { panel.remove(); this._panel = null; };

    /* إغلاق عند الضغط خارجه */
    setTimeout(() => {
      document.addEventListener('click', e => {
        if (this._panel && !this._panel.contains(e.target) && e.target.id !== 'notif-btn') {
          this._panel.remove(); this._panel = null;
        }
      }, { once: true });
    }, 50);

    /* إغلاق عند الانتقال لصفحة */
    panel.querySelectorAll('a').forEach(a => {
      a.onclick = () => { panel.remove(); this._panel = null; };
    });
  },

  /* تهيئة الزر في الـ topbar */
  init() {
    const top = document.getElementById('top');
    if (!top) return;

    const btn = document.createElement('button');
    btn.id = 'notif-btn';
    btn.className = 'icon-btn';
    btn.setAttribute('title', 'الإشعارات');
    btn.innerHTML =
      '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' +
        '<path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>' +
      '</svg>' +
      '<span id="notif-badge" style="display:none;position:absolute;top:4px;right:4px;background:#ef4444;color:#fff;border-radius:999px;font-size:10px;font-weight:800;min-width:16px;height:16px;padding:0 4px;align-items:center;justify-content:center;"></span>';
    btn.style.position = 'relative';

    btn.onclick = () => this.toggle(btn);

    /* نضيفه قبل آخر عنصر في الـ topbar */
    top.appendChild(btn);

    /* تحديث أولي + كل دقيقة */
    this.updateBadge();
    setInterval(() => this.updateBadge(), 60000);
  }
};
