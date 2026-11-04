/* MUSI OPS Sim – service worker: semua file disimpan di perangkat supaya simulator berjalan offline.
   Saat file di-update, naikkan VERSION.
   Strategi (mulai v3.5): saat online file selalu diambil dari server (network-first) lalu salinannya diperbarui,
   sehingga versi lama dan baru tidak tercampur; saat offline dipakai salinan di perangkat. */
const VERSION = 'musi-ops-sim-v3.6';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/hmi.css',
  './js/plant-engine.js',
  './js/station-engine.js',
  './js/hmi.js',
  './js/ops-static.js',
  './js/hmi-ss.js',
  './js/hmi-jz.js',
  './js/hmi-force.js',
  './js/guide-data.js',
  './js/hmi-guide.js',
  './js/pwa.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-64.png',
];

// install: unduh tiap file langsung dari server (lewati cache HTTP browser);
// satu file yang gagal tidak membatalkan seluruh pembaruan
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.allSettled(FILES.map((f) =>
        fetch(new Request(f, { cache: 'reload' })).then((res) => (res.ok ? c.put(f, res) : null)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// network-first untuk semua file aplikasi; salinan di perangkat hanya untuk offline
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const key = req.mode === 'navigate' ? './index.html' : req;
  e.respondWith(
    fetch(req.mode === 'navigate' ? req.url : req, { cache: 'no-cache' }).then((res) => {
      if (!res.ok) return caches.match(key, { ignoreSearch: true }).then((hit) => hit || res);
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(key, copy));
      return res;
    }).catch(() => caches.match(key, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html')))
  );
});
