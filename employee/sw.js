/* CLEO HR — Service Worker v3 — Push + Offline IndexedDB */
const CACHE = 'cleo-emp-v3';
const FILES = [
  './', 'index.html',
  'css/app.css', 'css/cleo-emp.css',
  'js/api.js', 'js/app.js',
  'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png',
  '../admin/vendor/supabase.js',
  '../admin/js/config.js',
  '../admin/js/store.js',
  '../admin/js/supabase-store.js',
  '../admin/js/ui.js',
  '../admin/js/payroll-engine.js',
  '../admin/js/leaves-engine.js',
  '../admin/js/pages/payroll-tools.js'
];

/* ── Install ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(FILES.map(f => c.add(f))))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch: network-first with cache fallback ── */
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});

/* ── [A] Push Notifications ── */
self.addEventListener('push', e => {
  let data = { title: 'CLEO HR', body: 'لديك إشعار جديد', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', url: './' };
  try { Object.assign(data, e.data.json()); } catch (_) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:  data.body,
      icon:  data.icon,
      badge: data.badge,
      data:  { url: data.url },
      dir:   'rtl',
      lang:  'ar',
      vibrate: [200, 100, 200],
      requireInteraction: false
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const c = list.find(x => x.url.includes(url));
      if (c) return c.focus();
      return clients.openWindow(url);
    })
  );
});
