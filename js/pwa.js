/* MUSI OPS Sim – dukungan PWA (iPhone/iPad/Android lewat browser).
   Tidak aktif di aplikasi Android (WebView file://), karena di sana service worker tidak dipakai. */
(function () {
  'use strict';
  const isWeb = /^https?:$/.test(location.protocol);

  // 1) service worker → offline
  if (isWeb && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW gagal didaftarkan', e));
    });
  }

  // 2) layar tetap menyala selama simulator dibuka (Screen Wake Lock, iOS 16.4+ / Chrome)
  let lock = null;
  async function keepAwake() {
    try {
      if (!('wakeLock' in navigator) || document.hidden || lock) return;
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } catch (e) { lock = null; }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) keepAwake(); });
  document.addEventListener('pointerdown', keepAwake, { passive: true });

  // 3) penanda mode aplikasi (dibuka dari Home Screen)
  const standalone = window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches);
  if (standalone) document.documentElement.classList.add('pwa');

  // 4) coba kunci landscape (Android Chrome saat layar penuh; iOS tidak mendukung → pakai overlay "putar HP")
  try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* abaikan */ }
})();
