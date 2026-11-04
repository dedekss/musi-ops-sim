/* MUSI HEPP – PANDUAN PENGGUNAAN di dalam aplikasi (mulai v3.4).
   Isi dari window.GUIDE (js/guide-data.js), dibangkitkan dari dokumen "Panduan MUSI OPS Sim".
   Tata letak: daftar isi di kiri, isi bab di kanan, kotak CARI di atas. Berjalan offline. */
(() => {
  'use strict';
  const X = window.HMIX, G = window.GUIDE; if (!X || !G) return;
  const { esc, EXTS, EXTA } = X;
  const st = { sec: 0, q: '', sub: -1 };

  // pisahkan isi bab menjadi blok tingkat atas (h3 / p / ul / ol / table) untuk pencarian
  const BLK = /<(h3|p|ul|ol|table)>[\s\S]*?<\/\1>/g;
  const blocks = G.sec.map((s) => s.h.match(BLK) || []);
  const plain = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // tandai kata cocok hanya di teks (bukan di dalam tag)
  const mark = (h, q) => { if (!q) return h; const re = new RegExp(reEsc(esc(q)), 'gi'); return h.replace(/>([^<]+)</g, (m, t) => '>' + t.replace(re, (w) => `<mark>${w}</mark>`) + '<'); };
  const withIds = (h, si) => { let k = 0; return h.replace(/<h3>/g, () => `<h3 id="gd-${si}-${k++}">`); };

  function search(q) {
    const ql = q.toLowerCase(), res = [];
    blocks.forEach((bl, si) => {
      let head = G.sec[si].t;
      bl.forEach((b) => {
        if (b.startsWith('<h3>')) { head = plain(b).trim(); if (!plain(b).toLowerCase().includes(ql)) return; }
        if (plain(b).toLowerCase().includes(ql)) res.push({ si, head, b });
      });
    });
    return res;
  }

  function draw() {
    const B = (a, l, on) => `<span class="gd-btn${on ? ' on' : ''}" data-a="${a}">${esc(l)}</span>`;
    let toc = '';
    G.sec.forEach((s, i) => {
      toc += `<div class="gd-ch${!st.q && st.sec === i ? ' on' : ''}" data-a="x:gds:${i}">${esc(s.t)}</div>`;
      if (!st.q && st.sec === i) s.sub.forEach((t, k) => { toc += `<div class="gd-sub" data-a="x:gds:${i}:${k}">${esc(t)}</div>`; });
    });
    let body;
    if (st.q) {
      const r = search(st.q);
      body = `<div class="gd-hit">${r.length ? `${r.length} bagian memuat “${esc(st.q)}”` : `Tidak ada bagian yang memuat “${esc(st.q)}”. Coba kata lain, mis. 86-1, 43S-CS, WLC, FORCING.`}</div>`;
      let last = '';
      r.forEach((x) => {
        const lab = `${G.sec[x.si].t}${x.head !== G.sec[x.si].t ? ' › ' + x.head : ''}`;
        if (lab !== last) { body += `<div class="gd-loc" data-a="x:gds:${x.si}">${esc(lab)} ↗</div>`; last = lab; }
        if (!x.b.startsWith('<h3>')) body += mark(x.b, st.q);
      });
    } else body = `<h2>${esc(G.sec[st.sec].t)}</h2>` + withIds(G.sec[st.sec].h, st.sec);
    return `<div class="gd">
      <div class="gd-top"><b>PANDUAN PENGGUNAAN</b><span class="gd-ver">${esc(G.title)}</span>
        <span class="gd-srch"><input id="gdQ" type="search" autocomplete="off" spellcheck="false" placeholder="kata kunci, mis. 86-5" value="${esc(st.q)}">${B('x:gdq', 'CARI', true)}${st.q ? B('x:gdc', 'SEMUA BAB') : ''}</span></div>
      <div class="gd-main"><div class="gd-toc">${toc}<div class="gd-foot">Versi aplikasi ${esc(X.APP_VER)} · panduan ${esc(G.ver)}</div></div>
      <div class="gd-body" id="gdBody">${body}</div></div></div>`;
  }

  const refresh = (scrollTo) => {
    X.render();
    setTimeout(() => {
      const b = document.getElementById('gdBody'); if (!b) return;
      const t = scrollTo ? document.getElementById(scrollTo) : null;
      b.scrollTop = t ? t.offsetTop - b.offsetTop - 4 : 0;
    }, 20);
  };
  EXTS.guide = { no: '00092', title: () => `PANDUAN PENGGUNAAN (${G.ver})`, grp: 'ins', html: true, draw };
  Object.assign(EXTA, {
    gds: ([i, k]) => { st.q = ''; st.sec = +i; refresh(k !== undefined ? `gd-${i}-${k}` : null); },
    gdq: () => { const el = document.getElementById('gdQ'); st.q = el ? el.value.trim() : ''; refresh(); },
    gdc: () => { st.q = ''; refresh(); },
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target && ev.target.id === 'gdQ') { ev.preventDefault(); EXTA.gdq(); } });
})();
