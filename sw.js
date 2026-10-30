/* MUSI OPS Sim – service worker: semua file disimpan di perangkat supaya simulator berjalan offline.
   Saat file di-update, naikkan VERSION agar perangkat mengunduh versi baru. */
const VERSION = 'musi-ops-sim-v2.8';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/hmi.css',
  './js/plant-engine.js',
  './js/station-engine.js',
  './js/hmi.js',
  './js/hmi-ss.js',
  './js/pwa.js',
  './img/ivh.png',
  './img/tact.png',
  './img/ovw.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-64.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// cache-first (offline penuh); halaman utama dicoba dari jaringan dulu supaya update cepat terlihat
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        // hanya versi yang sukses (200) yang menggantikan salinan; 404/500 → tetap pakai salinan di perangkat
        if (!res.ok) return caches.match('./index.html').then((hit) => hit || res);
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
