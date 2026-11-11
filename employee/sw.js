/* CLEO HR — Service Worker v2 */
const CACHE = 'cleo-emp-v2';
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

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(FILES.map(f => c.add(f))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

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
