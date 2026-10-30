/* MUSI HEPP – FORCING I/O (instruktur): paksa nilai DI / DO / AI / AO berdasarkan tag.
   Alur: ketik tag → SEARCH (verifikasi tag ada) → ubah nilai (digital ON/OFF, analog 0–100 % rentang) → RELEASE. */
(() => {
  'use strict';
  const X = window.HMIX; if (!X) return;
  const { P, M, esc, f, U, dialog, EXTS, EXTA } = X;
  const JZ = M.JZ;
  window.FRC_AI = {};
  const FR = { di: {}, do: {}, ai: {}, ao: {} };     // tag → nilai paksa

  /* ============================== KATALOG TAG ============================== */
  // ---- DO unit (perintah LCU, tag sesuai sekuens) ----
  const DO_DEF = [
    ['DO0094', 'AUTO SYNCHRONIZER START (ASSX)', (p) => { p.sync = true; }, (p) => { p.sync = false; }],
    ['DO0102', 'NO LOAD CONTROL', (p) => { p.noLoad = true; }, (p) => { p.noLoad = false; }],
    ['DO0106', '52 OPEN (GENERATOR CB TRIP)', (p, u) => { if (p.cb) u.openCB('FORCE DO0106'); }, () => {}],
    ['DO0107', '1AX SET (aux. start)', (p) => { p.ax = true; }, (p) => { p.ax = false; }],
    ['DO0108', '1AX RESET (aux. stop)', (p) => { p.ax = false; }, () => {}],
    ['DO0109', 'HIGH PRESSURE OIL PUMP (88QT) START', (p) => { p.qtCmd = true; }, (p) => { p.qtCmd = false; }],
    ['DO0110', 'HIGH PRESSURE OIL PUMP (88QT) STOP', (p) => { p.qtCmd = false; }, () => {}],
    ['DO0111', 'BRAKE APPLY', (p) => { p.brakeCmd = 'apply'; }, (p) => { p.brakeCmd = 'release'; }],
    ['DO0112', 'BRAKE RELEASE', (p) => { p.brakeCmd = 'release'; }, (p) => { p.brakeCmd = 'apply'; }],
    ['DO0118', 'TURBINE GOVERNOR START (65S)', (p) => { p.govOn = true; }, (p) => { p.govOn = false; }],
    ['DO0119', 'TURBINE STOP (65T)', (p) => { p.govOn = false; }, () => {}],
    ['DO0126', 'POC – POWER CONTROL', (p, u) => { u.sw.gov = 'POWER'; }, (p, u) => { u.sw.gov = 'SPEED'; }],
    ['DO0129', 'INLET VALVE OPEN', (p) => { p.ivCmd = 'open'; }, (p) => { p.ivCmd = 'close'; }],
    ['DO0130', 'INLET VALVE CLOSE', (p) => { p.ivCmd = 'close'; }, () => {}],
    ['DO0157', 'EXCITATION START', (p) => { p.excOn = true; }, (p) => { p.excOn = false; }],
    ['DO0158', 'EXCITATION OFF', (p) => { p.excOn = false; }, () => {}],
  ];
  // ---- AO (set point keluaran kontrol; penomoran simulator) ----
  const AO_DEF = [];
  [1, 2, 3].forEach((n) => {
    const u = () => U(n);
    AO_DEF.push([`${n}AO0001`, `UNIT ${n} ALR LOAD SET POINT`, 'MW', 0, 72, () => u().sw.alrSP, (v) => { u().sw.alrSP = v; if (!u().sw.ALR) u().p.pref = v; }]);
    AO_DEF.push([`${n}AO0002`, `UNIT ${n} AQR REACTIVE SET POINT`, 'MVar', -40, 50, () => u().sw.aqrSP, (v) => { u().sw.aqrSP = v; u().p.qref = v; }]);
    AO_DEF.push([`${n}AO0003`, `UNIT ${n} LOAD LIMITER (77) POSITION`, '%', 0, 100, () => u().p.gvLim, (v) => { u().p.gvLim = v; }]);
    AO_DEF.push([`${n}AO0004`, `UNIT ${n} GOVERNOR SPEED REFERENCE`, '%', 90, 110, () => u().p.sref * 100, (v) => { u().p.sref = v / 100; }]);
    AO_DEF.push([`${n}AO0005`, `UNIT ${n} AVR VOLTAGE REFERENCE`, '%', 90, 110, () => u().p.vref * 100, (v) => { u().p.vref = v / 100; }]);
  });
  [0, 1, 2].forEach((i) => {
    AO_DEF.push([`7AO000${i + 1}`, `SPILLWAY GATE-${i + 1} SET POSITION`, 'cm', 0, 600, () => P.dam.sgSet[i] * 100, (v) => { P.dam.sgSet[i] = v / 100; }]);
    AO_DEF.push([`7AO000${i + 4}`, `SPILLWAY FLAP GATE-${i + 1} SET POSITION`, '%', 0, 100, () => P.dam.flapSet[i], (v) => { P.dam.flapSet[i] = v; }]);
  });
  AO_DEF.push(['8AO0001', 'REREGULATING GATE SET POSITION', 'cm', 0, 800, () => P.dam.rgSet * 100, (v) => { P.dam.rgSet = v / 100; }]);
  AO_DEF.push(['0AO0001', 'JOINT CONTROL SET POINT (ACTIVE POWER)', 'MW', 0, 210, () => P.pc.jP, (v) => { P.pc.jPman = v; if (!P.pc.mode) P.pc.jP = v; }]);
  // ---- AI: dikumpulkan dari layar Analog Input (tag & nama sama dengan layar) ----
  const RTD_ANA = [[/THRUST BEARING METAL/, 'thrust'], [/UPPER GUIDE BEARING METAL/, 'ugb'], [/LOWER GUIDE BEATING METAL TEMPERATURE - 1/, 'lgb'], [/TURBINE GUIDE BEARING METAL/, 'tgb'],
    [/AIR COOLER AIR OUTLET/, 'acOut'], [/AIR COOLER AIR INLET/, 'acIn'], [/TRANSFORMER WINDING/, 'mtrWdg'], [/TRANSFORMER OIL/, 'mtrOil']];
  const VIB_ANA = [[/UPPER BRACKET - VERTICAL/, 'ubv'], [/UPPER BRACKET - HORIZONTAL/, 'ubh'], [/LOWER BRACKET - VERTICAL/, 'lbv'], [/LOWER BRACKET - HORIZONTAL/, 'lbh'], [/HEAD COVER - VERTICAL/, 'hcv'], [/HEAD COVER - HORIZONTAL/, 'hch'],
    [/UPPER GUIDE - X/, 'ugx'], [/UPPER GUIDE - Y/, 'ugy'], [/LOWER GUIDE - X/, 'lgx'], [/LOWER GUIDE - Y/, 'lgy'], [/TURBINE GUIDE - X/, 'tgx'], [/TURBINE GUIDE - Y/, 'tgy']];
  function range(name, unit) {
    const N = name.toUpperCase(), un = (unit || '').trim();
    if (un === 'A') return /GENERATOR CURRENT/.test(N) ? [0, 5000] : /EXCITATION/.test(N) ? [0, 1500] : /400V BUS-[AB] CURRENT/.test(N) ? [0, 2000] : [0, 1000];
    if (un === 'kV') return /150KV/.test(N) ? [0, 180] : /GENERATOR/.test(N) ? [0, 15] : [0, 25];
    if (un === 'V') return /EXCITATION/.test(N) ? [0, 150] : [0, 500];
    if (un === 'MW') return /TRANSMISSION/.test(N) ? [0, 250] : /20KV/.test(N) ? [0, 5] : [0, 100];
    if (un === 'MVar') return /TRANSMISSION/.test(N) ? [-100, 100] : [-50, 50];
    if (un === 'kW') return [0, 1000]; if (un === 'Hz') return [45, 55]; if (un === 'RPM') return [0, 1000];
    if (un === 'm3/s') return [0, 30]; if (un === 'm3/h') return [0, 100]; if (un === 'mWC') return [0, 600]; if (un === 'bar') return [0, 20];
    if (/µm/.test(un)) return [0, 500]; if (/mm\/s/.test(un)) return [0, 20]; if (un === '℃') return [0, 150]; if (un === 'Elm') return [160, 190];
    return [0, 100];
  }
  const DAM_AI = [['7AI0011', 'INTAKE WATER LEVEL', 'El.m', 570, 582, () => P.intakeWL, 'intake'], ['7AI0007', 'INTAKE DAM WATER LEVEL', 'El.m', 570, 582, () => P.intakeWL, 'intake'],
    ['7AI0001', 'SPILLWAY GATE-1 POSITION', 'cm', 0, 600, () => P.dam.sg[0] * 100], ['7AI0003', 'SPILLWAY GATE-2 POSITION', 'cm', 0, 600, () => P.dam.sg[1] * 100], ['7AI0005', 'SPILLWAY GATE-3 POSITION', 'cm', 0, 600, () => P.dam.sg[2] * 100],
    ['8AI0001', 'REGULATING GATE POSITION', 'cm', 0, 800, () => P.dam.rg * 100], ['8AI0002', 'RE-DAM UPSTREAM WATER LEVEL', 'El.m', 145, 160, () => P.dam.rwl, 'rwl']];
  let aiCache = null, aiT = -1;
  function collectAI() {
    if (aiCache && aiT === P.t) return aiCache;
    const out = {};
    try {
      window.__aiCol = [];
      [1, 2, 3].forEach((n) => X.scrAI(n));
      for (const k of [4, 5, 6]) window.HMIX_AI[k]();
      for (const [tag, name, val, unit] of window.__aiCol) {
        if (name === 'SPARE') continue;
        const [lo, hi] = range(name, unit), m = /^(\d)/.exec(tag), n = m && +m[1] <= 3 ? +m[1] : 0;
        let ana = null; if (n) { for (const [re, k] of RTD_ANA.concat(VIB_ANA)) if (re.test(name)) { ana = k; break; } if (/^GENERATOR VOLTAGE$/.test(name)) ana = 'vt'; }
        out[tag] = { tag, type: 'AI', desc: name, unit: (unit || '').trim(), lo, hi, val: parseFloat(val), n, ana };
      }
    } finally { window.__aiCol = null; }
    for (const [tag, name, unit, lo, hi, get, ana] of DAM_AI) out[tag] = { tag, type: 'AI', desc: name, unit, lo, hi, val: get(), n: 0, ana };
    aiCache = out; aiT = P.t; return out;
  }
  let CAT = null;
  function catalog() {
    if (CAT) return CAT;
    const c = {};
    // DI: titik alarm/annunciator + input proteksi JEZ2K031
    for (const d of P.alarms.defs) if (/DI\d{4}$/.test(d.tag)) { const e = c[d.tag] || (c[d.tag] = { tag: d.tag, type: 'DI', desc: d.text, jz: [], alarm: [] }); e.alarm.push(d.i); }
    [1, 2, 3].forEach((n) => Object.values(JZ).forEach((d) => {
      if (!/^\d?DI\d{4}$/.test(d.soe)) return;
      const tag = /^DI/.test(d.soe) ? `${n}${d.soe}` : `${d.soe}-U${n}`;
      const e = c[tag] || (c[tag] = { tag, type: 'DI', desc: d.lab + (d.code ? ` (${d.code})` : ''), jz: [], alarm: [] });
      e.jz.push([n, d.id]); e.desc = d.lab + (d.code ? ` (${d.code})` : '');
    }));
    [1, 2, 3].forEach((n) => DO_DEF.forEach(([t, desc, on, off]) => { const tag = `${n}${t}`; c[tag] = { tag, type: 'DO', desc: `UNIT ${n} ${desc}`, n, on, off, base: t }; }));
    AO_DEF.forEach(([tag, desc, unit, lo, hi, get, set]) => { c[tag] = { tag, type: 'AO', desc, unit, lo, hi, get, set }; });
    CAT = c; return c;
  }
  function find(tag) { const c = catalog(); if (c[tag]) return c[tag]; const a = collectAI(); return a[tag] || null; }
  function value(e) {
    if (!e) return null;
    if (e.type === 'DI') { if (e.jz.length) return e.jz.some(([n, id]) => U(n).jzSig(id)); return e.alarm.some((i) => P.alarms.pt[i].on); }
    if (e.type === 'DO') { const u = U(e.n), p = u.p, b = e.base, D = u.do[b]; return FR.do[e.tag] !== undefined ? FR.do[e.tag] : D !== undefined && P.t - D < 2; }
    if (e.type === 'AO') return e.get();
    const a = collectAI()[e.tag]; return a ? (FR.ai[e.tag] !== undefined ? FR.ai[e.tag] : a.val) : null;
  }

  /* ============================== PENERAPAN ============================== */
  const ANA = M.ANA;
  function setDI(e, v) {
    e.jz.forEach(([n, id]) => U(n).jzForce(id, v === null ? null : v ? 'on' : 'off'));
    for (const i of e.alarm) { const tag = P.alarms.defs[i].tag; if (v === null) delete P.alarms.force[tag]; else P.alarms.force[tag] = !!v; }
    if (v === null) delete FR.di[e.tag]; else FR.di[e.tag] = !!v;
  }
  function setAI(e, eng) {
    if (eng === null) {
      delete FR.ai[e.tag]; delete window.FRC_AI[e.tag];
      if (e.ana === 'rwl') {} else if (e.ana) U(e.n || 1).jzAnalog(e.ana, null);
      return;
    }
    FR.ai[e.tag] = eng; window.FRC_AI[e.tag] = eng;
    if (e.ana === 'rwl') P.dam.rwl = eng;
    else if (e.ana === 'vt') U(e.n).jzAnalog('vt', eng / (11 * 0.99) * 100, 1e6);
    else if (e.ana) U(e.n || 1).jzAnalog(e.ana, eng, 1e6);
  }
  P.frc = {
    unitDO(u) { for (const [tag, v] of Object.entries(FR.do)) { const e = catalog()[tag]; if (e.n === u.n) (v ? e.on : e.off)(u.p, u); } },
    unitAO(u) {
      for (const [tag, v] of Object.entries(FR.ao)) { const e = catalog()[tag]; if (/^\d/.test(tag) && +tag[0] === u.n) e.set(v); else if (u.n === 1 && !(+tag[0] >= 1 && +tag[0] <= 3)) e.set(v); }
      if (u.n === 1) for (const [tag, v] of Object.entries(FR.ai)) { const e = collectAIStatic(tag); if (e && e.ana === 'rwl') P.dam.rwl = v; }
    },
  };
  const collectAIStatic = (tag) => DAM_AI.find((d) => d[0] === tag) ? { ana: DAM_AI.find((d) => d[0] === tag)[6] } : null;
  function apply(e, v) {
    const lab = e.type === 'DI' || e.type === 'DO' ? (v ? 'ON' : 'OFF') : `${f(v, 2)} ${e.unit}`;
    if (e.type === 'DI') setDI(e, v);
    else if (e.type === 'DO') { FR.do[e.tag] = !!v; }
    else if (e.type === 'AO') { FR.ao[e.tag] = v; e.set(v); }
    else setAI(e, v);
    P.log('CMD', `FORCING ${e.tag} ${e.desc} → ${lab}`);
  }
  function release(tag) {
    const e = find(tag); if (!e) return;
    if (e.type === 'DI') setDI(e, null); else if (e.type === 'DO') delete FR.do[tag]; else if (e.type === 'AO') delete FR.ao[tag]; else setAI(e, null);
    P.log('CMD', `FORCING ${tag} RELEASE`);
  }
  const forced = () => [...Object.keys(FR.di).map((t) => [t, 'DI', FR.di[t]]), ...Object.keys(FR.do).map((t) => [t, 'DO', FR.do[t]]), ...Object.keys(FR.ai).map((t) => [t, 'AI', FR.ai[t]]), ...Object.keys(FR.ao).map((t) => [t, 'AO', FR.ao[t]])];

  /* ============================== LAYAR ============================== */
  const st = { q: '', res: null, msg: '', sugg: [] };
  const fmtV = (e, v) => v === null || v === undefined ? '—' : typeof v === 'boolean' ? (v ? 'ON (1)' : 'OFF (0)') : `${f(v, Math.abs(v) < 10 ? 2 : 1)} ${e.unit || ''}`;
  const pctOf = (e, v) => (e.hi === e.lo ? 0 : (v - e.lo) / (e.hi - e.lo) * 100);
  function draw() {
    const e = st.res, isA = e && (e.type === 'AI' || e.type === 'AO'), fv = e ? (e.type === 'DI' ? FR.di[e.tag] : e.type === 'DO' ? FR.do[e.tag] : e.type === 'AI' ? FR.ai[e.tag] : FR.ao[e.tag]) : undefined;
    const B = (a, l, c = '#b4b4b4') => `<span class="sb" data-a="${a}" style="background:${c};color:#000;padding:6px 12px;cursor:pointer;display:inline-block;margin:2px 4px 2px 0;font-weight:700">${esc(l)}</span>`;
    let h = `<div class="h2">FORCING I/O – DIGITAL INPUT / DIGITAL OUTPUT / ANALOG INPUT / ANALOG OUTPUT</div>
      <div class="fs"><div class="col" style="min-width:330px">
      <h4>1. INPUT TAG</h4>
      <div class="row" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <input id="frcTag" type="text" autocomplete="off" spellcheck="false" value="${esc(st.q)}" placeholder="mis. 1DI0116" style="font:16px var(--mono);width:180px;padding:5px;text-transform:uppercase">
        ${B('x:frcs', '🔍 SEARCH', '#ffd040')}</div>
      <div class="note2">Format tag: <b>nDI0000</b> digital input unit n (mis. 1DI0116, 2DI0183) · <b>nDO0000</b> digital output LCU (1DO0129) · <b>nAI0000 / nRTD0000</b> analog input unit (1AI0010, 1RTD0005) ·
      <b>4AI</b> USS · <b>5AI</b> MSS · <b>6AI / 6DI</b> switchyard · <b>7AI/8AI</b> dam · <b>nAO0001–5</b>, <b>7AO</b>, <b>8AO</b>, <b>0AO0001</b> analog output (set point).</div>`;
    if (st.msg) h += `<div style="margin:8px 0;padding:6px;border:1px solid ${e ? '#18e018' : '#ff5050'};color:${e ? '#18e018' : '#ff7070'}">${esc(st.msg)}</div>`;
    if (st.sugg.length) h += `<div style="margin:4px 0">Tag serupa: ${st.sugg.map((t) => B(`x:frcp:${t.tag}`, `${t.tag}`, '#ddd')).join('')}</div><div class="note2">${st.sugg.map((t) => `${esc(t.tag)} = ${esc(t.desc)}`).join(' · ')}</div>`;
    if (e) {
      h += `<h4>2. TAG TERVERIFIKASI</h4><table class="tbl"><tr><td>Tag</td><td class="n"><b style="font-size:15px">${esc(e.tag)}</b></td></tr><tr><td>Tipe</td><td class="n">${e.type}${e.type === 'AI' && /RTD/.test(e.tag) ? ' (RTD)' : ''}</td></tr>
        <tr><td>Deskripsi</td><td class="n">${esc(e.desc)}</td></tr>${isA ? `<tr><td>Rentang 0–100 %</td><td class="n">${f(e.lo)} – ${f(e.hi)} ${esc(e.unit)}</td></tr>` : ''}
        <tr><td>Nilai sekarang</td><td class="n"><b><span class="fv" data-t="${esc(e.tag)}">—</span></b></td></tr>
        <tr><td>Status forcing</td><td class="n" style="color:${fv !== undefined ? '#ffd000' : '#888'}">${fv !== undefined ? 'DIPAKSA → ' + esc(fmtV(e, fv)) : 'tidak dipaksa'}</td></tr>
        <tr><td>Efek</td><td class="n" style="font-size:11px">${esc(effect(e))}</td></tr></table>
        <h4>3. UBAH NILAI</h4>`;
      if (!isA) h += `<div>${B(`x:frcd:${e.tag}:1`, 'ON', '#ff8080')}${B(`x:frcd:${e.tag}:0`, 'OFF', '#80ff80')}${B(`x:frcr:${e.tag}`, 'RELEASE')}</div>`;
      else h += `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><input id="frcPct" type="number" min="0" max="100" step="0.1" value="${f(st.pct, 1)}" style="font:16px var(--mono);width:90px;padding:5px"> %
        <span id="frcEng" style="color:#4ce0ff">= — ${esc(e.unit)}</span></div><div>${B(`x:frca:${e.tag}`, 'APPLY', '#ffd040')}${B(`x:frcr:${e.tag}`, 'RELEASE')}</div>`;
    }
    h += `</div><div class="col" style="min-width:330px"><h4>TAG YANG SEDANG DIPAKSA</h4>`;
    const fl = forced();
    h += fl.length ? `<table class="tbl"><tr><th>Tag</th><th>Tipe</th><th>Deskripsi</th><th>Paksa</th><th>Aktual</th><th></th></tr>${fl.map(([t, ty, v]) => { const e2 = find(t) || { unit: '' };
      return `<tr><td><a data-a="x:frcp:${esc(t)}" style="color:#ffd000;cursor:pointer">${esc(t)}</a></td><td>${ty}</td><td style="font-size:10px">${esc((e2.desc || '').slice(0, 42))}</td><td class="n">${esc(fmtV(e2, v))}</td><td class="n"><span class="fv" data-t="${esc(t)}">—</span></td><td>${B(`x:frcr:${t}`, 'RELEASE')}</td></tr>`; }).join('')}</table>
      <div>${B('x:frcra', 'RELEASE ALL', '#ff9090')}</div>` : '<div class="note2">Belum ada tag yang dipaksa.</div>';
    h += `<div class="note2" style="margin-top:10px">Forcing berlaku sampai RELEASE (atau INIT). DI dipaksa → masuk logika proteksi JEZ2K031 & annunciator. DO dipaksa → perintah LCU ditahan (menimpa sekuens).
      AI dipaksa → nilai di layar Analog Input; untuk suhu bantalan/M.Tr, getaran, tegangan generator, level intake/re-dam nilai fisik model ikut berubah. AO dipaksa → set point ditahan.
      Rentang 0–100 % analog: skala simulator (asumsi, bukan range transmitter asli). Penomoran AO = penomoran simulator.</div></div></div>`;
    return h;
  }
  function effect(e) {
    if (e.type === 'DI') return [e.jz.length ? `input proteksi JEZ2K031 (${e.jz.map(([n, id]) => 'U' + n + ' SH.00' + JZ[id].sh).join(', ')})` : '', e.alarm.length ? 'annunciator / alarm' : ''].filter(Boolean).join(' + ');
    if (e.type === 'DO') return 'perintah LCU ke peralatan (ON = perintah aktif ditahan, OFF = kebalikannya/tidak aktif)';
    if (e.type === 'AO') return 'set point keluaran kontrol ditahan pada nilai paksa';
    return e.ana ? 'nilai tampilan + variabel fisik model (memicu proteksi/alarm)' : 'nilai tampilan layar Analog Input saja';
  }
  // pembaruan nilai live tanpa render ulang (agar isian tag tidak terhapus)
  setInterval(() => {
    if (X.scr !== 'force') return;
    document.querySelectorAll('#html .fv').forEach((el) => { const e = find(el.dataset.t); el.textContent = e ? fmtV(e, value(e)) : '—'; });
    const pi = document.getElementById('frcPct'), pe = document.getElementById('frcEng');
    if (pi && pe && st.res) { const v = parseFloat(pi.value); pe.textContent = isNaN(v) ? '= —' : `= ${f(st.res.lo + Math.max(0, Math.min(100, v)) / 100 * (st.res.hi - st.res.lo), 2)} ${st.res.unit}`; }
  }, 400);
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target && ev.target.id === 'frcTag') { ev.preventDefault(); EXTA.frcs(); } });
  function refresh() { X.render(); setTimeout(() => { const el = document.getElementById('frcTag'); if (el && !st.res) el.focus(); }, 30); }
  function search(q) {
    st.q = q.toUpperCase().replace(/\s+/g, ''); st.sugg = []; st.res = null;
    if (!st.q) { st.msg = 'Masukkan tag terlebih dahulu.'; refresh(); return; }
    CAT = null; aiCache = null;
    const e = find(st.q);
    if (e) { st.res = e; st.msg = `TAG ${e.tag} DITEMUKAN – ${e.type}`; if (e.type === 'AI' || e.type === 'AO') { const fv = e.type === 'AI' ? FR.ai[e.tag] : FR.ao[e.tag]; st.pct = Math.max(0, Math.min(100, pctOf(e, fv !== undefined ? fv : value(e) || 0))); } }
    else {
      st.msg = `TAG ${st.q} TIDAK DITEMUKAN`;
      const all = Object.values(catalog()).concat(Object.values(collectAI()));
      const core = st.q.replace(/^\d/, '');
      st.sugg = all.filter((x) => x.tag.includes(st.q) || (core.length >= 4 && x.tag.includes(core)) || x.desc.toUpperCase().includes(st.q)).slice(0, 12);
    }
    refresh();
  }

  EXTS.force = { no: '00093', title: () => 'FORCING I/O (DI / DO / AI / AO)', grp: 'ins', html: true, draw };
  Object.assign(EXTA, {
    frcs: () => { const el = document.getElementById('frcTag'); search(el ? el.value : st.q); },
    frcp: ([t]) => { search(t); },
    frcd: ([t, v]) => { const e = find(t); if (!e) return; dialog('FORCING', `${e.tag}\n${e.desc}\n\nPAKSA → ${v === '1' ? 'ON (1)' : 'OFF (0)'}\n\nEXECUTE ?`, () => { apply(e, v === '1'); refresh(); }); },
    frca: ([t]) => {
      const e = find(t), pi = document.getElementById('frcPct'); if (!e || !pi) return;
      const pct = parseFloat(pi.value);
      if (isNaN(pct) || pct < 0 || pct > 100) { dialog('FORCING', 'Nilai harus 0 – 100 %.', null); return; }
      const eng = e.lo + pct / 100 * (e.hi - e.lo);
      st.pct = pct;
      dialog('FORCING', `${e.tag}\n${e.desc}\n\nPAKSA → ${f(pct, 1)} % = ${f(eng, 2)} ${e.unit}\n(rentang ${f(e.lo)} – ${f(e.hi)} ${e.unit})\n\nEXECUTE ?`, () => { apply(e, eng); refresh(); });
    },
    frcr: ([t]) => { release(t); refresh(); },
    frcra: () => dialog('FORCING', `RELEASE semua tag yang dipaksa (${forced().length})?\n\nEXECUTE ?`, () => { forced().forEach(([t]) => release(t)); refresh(); }),
  });
  // INIT membangun ulang plant → forcing dikosongkan
  const ob = P.build.bind(P);
  P.build = () => { for (const k of Object.keys(FR)) FR[k] = {}; window.FRC_AI = {}; ob(); CAT = null; aiCache = null; st.res = null; st.msg = ''; };
  // CLEAR semua gangguan juga melepas forcing
  const cf = P.clearAllFaults.bind(P);
  P.clearAllFaults = () => { forced().forEach(([t]) => release(t)); cf(); };
})();
