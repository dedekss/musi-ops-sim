/* MUSI HEPP – HMI v2 : layar operator OPS01 (simulasi) */
(() => {
  'use strict';
  const M = window.MUSI;
  const P = new M.Plant();
  P.initOperating();
  const SPEEDS = [1, 2, 5, 10, 20];
  let scr = 'main', hist = [], mult = 5, paused = false, curU = 1, selFault = 'cw_main_trip', fsUnit = 1, trendU = 1;
  const silenced = new Set();
  const $ = (id) => document.getElementById(id);
  const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d = 1) => (v === undefined || v === null || isNaN(v)) ? '?' : (+v).toFixed(d);
  const U = (n) => P.units[n - 1];

  /* =========================== SVG HELPERS =========================== */
  const T = (x, y, s, c = 't', ex = '') => `<text x="${x}" y="${y}" class="${c}" ${ex}>${esc(s)}</text>`;
  const R = (x, y, w, h, c = 'box', ex = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${c}" ${ex}/>`;
  const L = (x1, y1, x2, y2, c = 'ln') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${c}"/>`;
  const PL = (pts, c = 'ln') => `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" class="${c}"/>`;
  const lamp = (x, y, on, r = 5.5) => `<circle cx="${x}" cy="${y}" r="${r}" class="lamp ${on ? 'lr' : 'lg'}"/>`;
  const arR = (x, y) => `<path d="M${x - 6},${y - 3.5}L${x},${y}L${x - 6},${y + 3.5}Z" fill="#e8e8e8"/>`;
  const arU = (x, y) => `<path d="M${x - 3.5},${y + 6}L${x},${y}L${x + 3.5},${y + 6}Z" fill="#e8e8e8"/>`;
  const mline = (x, y, s, c, lh = 11) => { const ls = String(s).split('\n'); const y0 = y - (ls.length - 1) * lh / 2; return ls.map((l, i) => T(x, y0 + i * lh, l, c)).join(''); };
  const wrap = (s, n) => { const w = s.split(' '); const out = []; let c = ''; for (const x of w) { if ((c + ' ' + x).trim().length > n && c) { out.push(c); c = x; } else c = (c + ' ' + x).trim(); } if (c) out.push(c); return out.join('\n'); };
  function b3(x, y, w, h, label, cls = '', act = '') {
    return `<g class="b3 ${cls}" ${act ? `data-a="${act}"` : ''}><rect class="f" x="${x}" y="${y}" width="${w}" height="${h}"/>` +
      `<polyline class="hl" points="${x},${y + h} ${x},${y} ${x + w},${y}"/><polyline class="sh" points="${x + w},${y} ${x + w},${y + h} ${x},${y + h}"/>` +
      mline(x + w / 2, y + h / 2 + 3.5, label, '', 10.5) + '</g>';
  }
  const vbox = (x, y, w, h, s, c = 'cy tc') => R(x, y, w, h, 'val') + T(x + w / 2, y + h / 2 + 4, s, c);
  const navBox = (x, label, act, cur) => `<g class="nav ${cur ? 'cur' : ''}" ${act ? `data-a="${act}"` : ''}>${R(x, 583, 104, 52)}${mline(x + 52, 612, label, '', 10)}</g>`;
  const title = (s) => T(495, 22, s, 't tt');
  const backBtn = () => `<g data-a="nav:back">${R(955, 8, 26, 26, '', 'fill="#c8c8c8"')}<path d="M961,28 L961,16 L975,16 M969,11 L975,16 L969,21" stroke="#202020" stroke-width="2" fill="none"/></g>`;

  /* =========================== SCREEN REGISTRY =========================== */
  const SCR = {
    main: { no: '00001', title: () => 'Main Screen', grp: 'main' },
    sy: { no: '00002', title: () => '150kV SWITCHYARD', grp: 'ctl' },
    alm: { no: '00094', title: () => 'ALARM SUMMARY', grp: 'ins', html: true },
    trend: { no: '00097', title: () => 'TREND GRAPH', grp: 'ins', html: true },
    prot: { no: '00098', title: () => 'PROTECTION SCHEME (86 LOCKOUT)', grp: 'ins', html: true },
    fault: { no: '00099', title: () => 'FAULT SIMULATION (INSTRUCTOR)', grp: 'ins', html: true },
    annsy: { no: '00076', title: () => 'SWITCHYARD ANN', grp: 'ann' },
  };
  const UNIT_SCR = {
    ctl: (n) => ['0002' + (3 + n), `UNIT NO.${n} CONTROL PANEL`, 'ctl'],
    sc1: (n) => ['000' + (3 + n) + '1', `UNIT${n} SEQUENCE MONITOR(START CONDITION)1`, 'seq'],
    sc2: (n) => ['000' + (3 + n) + '2', `UNIT${n} SEQUENCE MONITOR(START CONDITION)2`, 'seq'],
    s2l: (n) => ['000' + (3 + n) + '3', `UNIT${n} SEQUENCE MONITOR(STOP To LOAD)`, 'seq'],
    l2s: (n) => ['000' + (3 + n) + '4', `UNIT${n} SEQUENCE MONITOR(LOAD To STOP)`, 'seq'],
    ovw: (n) => ['0000' + (5 + n), `NO.${n} UNIT WATER FLOW SYSTEM`, 'sys'],
    cap: (n) => ['0009' + n, `CAPABILITY CURVE FOR UNI${n}`, 'sys'],
    vib: (n) => ['0010' + n, `TURBINE GENERATOR VIBRATION MONITOR U${n}`, 'sys'],
    ai: (n) => ['0008' + n, `ANALOG INPUT FOR UNIT${n}`, 'sys'],
    ann: (n) => ['0007' + n, `UNIT${n} ANN`, 'ann'],
  };
  function scrInfo(id) {
    if (SCR[id]) return { id, ...SCR[id], title: SCR[id].title() };
    const m = id.match(/^([a-z0-9]+?)(\d)$/);
    if (m && UNIT_SCR[m[1]]) { const [no, t, grp] = UNIT_SCR[m[1]](+m[2]); return { id, no, title: t, grp, base: m[1], n: +m[2] }; }
    return { id: 'main', ...SCR.main, title: 'Main Screen' };
  }
  const TABS = {
    main: () => [['main', 'Main Screen']],
    seq: (n) => [[`sc1${n}`, `U${n} START COND.1`], [`sc2${n}`, `U${n} START COND.2`], [`s2l${n}`, `U${n} STOP TO LOAD`], [`l2s${n}`, `U${n} LOAD TO STOP`], ['trend', 'Historical']],
    sys: (n) => [[`ovw${n}`, `NO.${n} WATER FLOW`], [`cap${n}`, 'CAPABILITY CURVE'], [`vib${n}`, 'VIBRATION'], [`ai${n}`, 'ANALOG INPUT'], ['trend', 'Historical']],
    ctl: () => [['sy', '150kV SY'], ['ctl1', 'NO.1 CONTROL PNL'], ['ctl2', 'NO.2 CONTROL PNL'], ['ctl3', 'NO.3 CONTROL PNL'], ['trend', 'Historical']],
    ann: () => [['ann1', 'UNIT1 ANN'], ['ann2', 'UNIT2 ANN'], ['ann3', 'UNIT3 ANN'], ['annsy', 'SWITCHYARD ANN'], ['alm', 'AlmSum']],
    ins: () => [['fault', 'FAULT SIM.'], ['prot', 'PROTECTION'], ['alm', 'ALARM SUM.'], ['trend', 'TREND']],
  };
  function go(id, push = true) {
    if (id === 'back') { id = hist.pop() || 'main'; push = false; }
    const info = scrInfo(id);
    if (push && scr !== info.id) { hist.push(scr); if (hist.length > 30) hist.shift(); }
    scr = info.id; if (info.n) curU = info.n;
    $('sNo').textContent = info.no; $('sTitle').textContent = info.title;
    $('svg').classList.toggle('hidden', !!info.html); $('html').classList.toggle('hidden', !info.html);
    $('zbar').classList.toggle('hidden', !!info.html);
    const tabs = TABS[info.grp](info.n || curU);
    const tb = $('tabs');
    tb.innerHTML = `<button class="tic" data-a="nav:main" title="Main Screen">▦</button>` +
      tabs.map(([sid, lab]) => `<button data-a="nav:${sid}" class="${sid === scr ? 'on' : ''}">${esc(lab)}</button>`).join('') +
      `<button class="tic" data-a="tab:-1">◀</button><button class="tic" data-a="tab:1">▶</button><button class="tic" data-a="sim">⚙</button>`;
    htmlCache = ''; setVB(null, true);
    render();
  }

  /* =========================== MAIN SCREEN =========================== */
  function scrMain() {
    let g = '';
    const pk = (y, s) => R(12, y, 140, 21, '', 'fill="#ff40ff" stroke="#000"') + T(82, y + 15, s, 'tc', 'style="fill:#200020;font-size:11px"');
    g += pk(3, 'PT. PLN (PERSERO)') + pk(26, 'SEKTOR DALKIT') + pk(49, 'BENGKULU');
    g += R(165, 15, 700, 45, '', 'fill="#ff40ff" stroke="#fff" stroke-width="3"') + T(515, 46, 'Musi Hydro Electric Power Station Graphic Menu', 'tc', 'style="fill:#fff;font-size:22px;font-weight:bold"');
    g += `<g data-a="nav:fault">${R(877, 6, 104, 18, '', 'fill="#ff6060" stroke="#000"')}${T(929, 19, 'FAULT SIM.', 'tc', 'style="fill:#000;font-size:10px"')}</g>`;
    g += `<g data-a="nav:prot">${R(877, 27, 104, 18, '', 'fill="#ff9090" stroke="#000"')}${T(929, 40, 'PROTECTION', 'tc', 'style="fill:#000;font-size:10px"')}</g>`;
    g += `<g data-a="nav:trend">${R(877, 48, 104, 18, '', 'fill="#c0c0ff" stroke="#000"')}${T(929, 61, 'TREND', 'tc', 'style="fill:#000;font-size:10px"')}</g>`;
    const sec = (y, h, lab, rows, col, extra = '') => {
      let s = R(10, y, 255, h, '', 'fill="#202020" stroke="#bbb"') + R(275, y, 705, h, '', 'fill="#202020" stroke="#bbb"');
      s += extra || T(137, y + h / 2 + 6, lab, 'tc', 'style="fill:#ff40ff;font-size:15px"');
      rows.forEach((r, ri) => r.forEach((b, ci) => { if (!b) return; const [lb, act] = b; const x = 284 + ci * 173, yy = y + 6 + ri * 24;
        s += `<g class="menu ${act ? '' : 'na'}" data-a="${act || 'na'}">${R(x, yy, 163, 18, '', `fill="${col}"`)}${T(x + 81, yy + 13, lb)}</g>`; }));
      return s;
    };
    g += sec(76, 52, 'Annunciator', [[['Unit No.1', 'nav:ann1'], ['Unit No.2', 'nav:ann2'], ['Unit No.3', 'nav:ann3'], ['Mimic Panel (1/2)']], [['Station Service (USS)'], ['Station Service (MSS)'], ['Switchyard', 'nav:annsy'], ['Mimic Panel (2/2)']]], '#ffff40');
    g += sec(138, 34, 'Station View', [[['Station Service Overview'], ['150kV Switchyard', 'nav:sy'], ['Main Control House'], ['Underground Powerhouse']]], '#40ffff');
    const tot = P.units.reduce((a, u) => ({ p: a.p + (u.p.cb ? u.p.p : 0), q: a.q + (u.p.cb ? u.p.q : 0) }), { p: 0, q: 0 });
    g += sec(182, 76, '', [[['SY/SS Control Panel', 'nav:sy'], ['Air Supply System'], ['Intake & Reregulating Dam'], ['Rain Fall Monitor']], [['Schedule(Rainy/Weekday)'], ['Schedule(Rainy/Weekend)'], ['Schedule(Arbitrary Setup)'], ['Daily Power Operation']], [['Schedule(Dry/Weekday)'], ['Schedule(Dry/Weekend)'], ['Water Level Control']]], '#40ff40',
      T(55, 225, 'Common', 'tc', 'style="fill:#ff40ff;font-size:15px"') + L(100, 182, 100, 258, 'ln') + T(150, 208, f(tot.p, 1) + '  MW', 't', 'style="fill:#ff40ff"') + T(150, 228, f(tot.q, 1) + '  MVar', 't', 'style="fill:#ff40ff"') + T(150, 248, 'WL ' + f(P.intakeWL, 2), 't', 'style="fill:#ff40ff"'));
    [1, 2, 3].forEach((n, i) => {
      const u = U(n), m = u.meas(), y = 268 + i * 84;
      g += sec(y, 76, '', [[['Control Panel', `nav:ctl${n}`], ['Capability Curve', `nav:cap${n}`]], [['Water Flow System', `nav:ovw${n}`], ['Turbine Actuator'], ['Inlet Valve Hydraulic'], ['Vibration Monitor', `nav:vib${n}`]],
        [['Start Condition(1/2)', `nav:sc1${n}`], ['Start Condition(2/2)', `nav:sc2${n}`], ['Stop To Load', `nav:s2l${n}`], ['Load To Stop', `nav:l2s${n}`]]], '#40ff40',
        T(50, y + 44, `Unit No.${n}`, 'tc', 'style="fill:#ff40ff;font-size:15px"') + L(98, y, 98, y + 76, 'ln') +
        T(108, y + 22, `${f(m.p)} MW`, 't', 'style="fill:#ff40ff"') + T(190, y + 22, `${f(m.I, 0)} A`, 't', 'style="fill:#ff40ff"') +
        T(108, y + 44, `${f(m.q)} MVar`, 't', 'style="fill:#ff40ff"') + T(190, y + 44, `${f(m.kv)} kV`, 't', 'style="fill:#ff40ff"') +
        T(108, y + 66, `${f(m.rpm)} RPM`, 't', 'style="fill:#ff40ff"') + T(190, y + 66, M.STEP[u.pos], 't', 'style="fill:#ffff80;font-size:9px"'));
    });
    g += sec(522, 52, 'Analog Input', [[['Unit No.1', 'nav:ai1'], ['Unit No.2', 'nav:ai2'], ['Unit No.3', 'nav:ai3']], [['Station Service (USS)'], ['Station Service (MSS)'], ['Switchyard', 'nav:sy'], ['Intake & Reregulating Dam']]], '#ffa040');
    g += T(495, 600, 'Tombol redup = layar yang belum dimodelkan di simulator ini.', 'tc dim', 'style="font-size:10px"');
    g += T(495, 616, 'Instruktur: FAULT SIM. (kanan atas) untuk inisialisasi kondisi & injeksi gangguan.', 'tc dim', 'style="font-size:10px"');
    return g;
  }

  /* =========================== SEQ MONITOR =========================== */
  function condCol(items, x, w, ys, lampX, busX, opt = {}) {
    let g = ''; const mids = [];
    const orGrp = {};
    items.forEach((it, i) => {
      const [lab, v, t] = it; const y = ys[i]; const h = opt.h || 26; const mid = y + h / 2; mids.push(mid);
      g += lamp(lampX, mid, !!v);
      g += R(x, y, w, h, t === 'dash' ? 'boxd' : 'box') + (t === 'dash' ? R(x - 2, y - 2, w + 4, h + 4, 'boxd') : '');
      g += mline(x + w / 2, mid + 3.5, wrap(lab, opt.wrap || 30), 't ts tc', 10);
      if (t === 'or' || t === 'or2') { (orGrp[t] = orGrp[t] || []).push(mid); g += L(x + w, mid, busX - 26, mid); }
      else if (t === 'not') { const nx = busX - 20; g += L(x + w, mid, nx, mid) + `<rect x="${nx}" y="${mid - 7}" width="14" height="14" class="nb"/>` + L(nx, mid - 7, nx + 14, mid + 7) + L(nx + 14, mid - 7, nx, mid + 7) + L(nx + 14, mid, busX, mid) + arR(busX, mid); }
      else g += L(x + w, mid, busX, mid) + arR(busX, mid);
    });
    for (const k of Object.keys(orGrp)) { const [a, b] = orGrp[k]; const cy = (a + b) / 2; g += L(busX - 26, a, busX - 26, b) + `<circle cx="${busX - 18}" cy="${cy}" r="7" class="nb"/>` + L(busX - 11, cy, busX, cy) + arR(busX, cy); }
    return { g, mids };
  }
  function stepBtn(u, k, x, y, w, dir) {
    const tr = u.tr; let cls = '';
    if (tr && tr.to === k && tr.fail) cls = 'red';
    else if (k === u.pos) cls = 'yel';
    else if (tr && tr.to === k && tr.dir === dir) cls = 'pink';
    else if (!tr && u.pos === 5 && k === 4) cls = 'pink';
    const name = M.STEP[k] === 'PARALLEL-IN' ? 'PARALELL-IN' : M.STEP[k];
    return b3(x, y, w, 23, name, cls, `step:${u.n}:${k}`);
  }
  const junc = (x, y) => R(x, y, 6, 20, 'box');
  function timer(u, k, dir, xr, y) {
    const pre = dir > 0 ? M.START_T[k] : M.STOP_T[k]; if (!pre) return '';
    const tr = u.tr; let act = (dir > 0 ? u.dur.start : u.dur.stop)[k];
    if (tr && tr.dir === dir && tr.to === k && tr.started) act = tr.t;
    return T(xr, y + 7, `${pre} sec`, 't tr', 'style="font-size:11px"') + T(xr, y + 25, `${act === undefined ? 0 : Math.round(act)} sec`, 't tr', `style="font-size:11px;${act > pre ? 'fill:#ff5050' : ''}"`);
  }
  function unitNav(n, cur) {
    const x0 = [13, 121, 229, 337, 445, 553, 661, 769, 877];
    let g = '';
    for (let i = 0; i < 5; i++) g += navBox(x0[i], i === n - 1 ? `UNIT NO.${n}\nCONTROL PANEL` : '', i === n - 1 ? `nav:ctl${n}` : '', false);
    g += navBox(x0[5], `UNIT NO.${n}\nSEQ. MONITOR\nSTART CONDITION\n(1)`, `nav:sc1${n}`, cur === 'sc1');
    g += navBox(x0[6], `UNIT NO.${n}\nSEQ. MONITOR\nSTART CONDITION\n(2)`, `nav:sc2${n}`, cur === 'sc2');
    g += navBox(x0[7], `UNIT NO.${n}\nSEQ. MONITOR\nSTOP TO LOAD`, `nav:s2l${n}`, cur === 's2l');
    g += navBox(x0[8], `UNIT NO.${n}\nSEQ. MONITOR\nLOAD TO STOP`, `nav:l2s${n}`, cur === 'l2s');
    return g;
  }
  function scrS2L(n) {
    const u = U(n); let g = title(`UNIT${n} SEQUENCE MONITOR (STOP To LOAD)`) + backBtn();
    const c1 = u.condStart(1), c2 = u.condStart(2), c3 = u.condStart(3), c4 = u.condStart(4), c5 = u.condStart(5);
    // baris atas
    g += stepBtn(u, 0, 10, 50, 95, 1) + L(105, 61, 531, 61) + junc(531, 51) + L(537, 61, 553, 61) + arR(553, 61);
    g += stepBtn(u, 1, 553, 50, 97, 1) + timer(u, 1, 1, 715, 52) + L(650, 61, 801, 61) + junc(801, 51) + L(807, 61, 825, 61) + arR(825, 61);
    g += stepBtn(u, 2, 825, 50, 95, 1) + timer(u, 2, 1, 983, 52);
    g += PL([[920, 61], [985, 61], [985, 428], [235, 428], [235, 456], [261, 456]]);
    // kolom 1: start/control + pompa
    const col1 = [...c1.a, ...c1.b];
    const ys1 = [81, 114, 148, 181, 214, 247, 280, 313, 346];
    const k1 = condCol(col1, 28, 187, ys1, 17, 257);
    g += k1.g + L(257, k1.mids[0], 257, k1.mids[col1.length - 1]) + junc(258, 85) + L(264, 95, 528, 95);
    // kolom 2: air pendingin
    const ys2 = [114, 147, 180, 213, 246, 279];
    const k2 = condCol(c1.c, 300, 187, ys2, 288, 528);
    g += k2.g + L(528, 95, 528, k2.mids[k2.mids.length - 1]) + L(528, 95, 534, 95) + L(534, 95, 534, 71) + arU(534, 71);
    // kolom 3: running
    const ys3 = [81, 113, 145, 177, 209, 241];
    const k3 = condCol(c2.a, 572, 185, ys3, 560, 800);
    g += k3.g + L(800, k3.mids[0], 800, k3.mids[5]) + L(800, k3.mids[0], 804, k3.mids[0]) + L(804, k3.mids[0], 804, 71) + arU(804, 71);
    // baris bawah
    g += junc(261, 446) + L(267, 456, 283, 456) + arR(283, 456) + stepBtn(u, 3, 283, 445, 95, 1) + timer(u, 3, 1, 425, 447);
    g += L(378, 456, 531, 456) + junc(531, 446) + L(537, 456, 555, 456) + arR(555, 456) + stepBtn(u, 4, 555, 445, 97, 1) + timer(u, 4, 1, 715, 447);
    g += L(652, 456, 801, 456) + junc(801, 446) + L(807, 456, 825, 456) + arR(825, 456) + stepBtn(u, 5, 825, 445, 95, 1) + timer(u, 5, 1, 983, 447);
    const k4 = condCol(c3.a, 28, 187, [476, 508, 540], 17, 257);
    g += k4.g + L(257, 466, 257, k4.mids[2]) + L(257, 466, 264, 466) + arU(264, 466);
    const k5 = condCol(c4.a, 300, 187, [476], 288, 528); g += k5.g + L(528, 466, 528, k5.mids[0]) + L(528, 466, 534, 466) + arU(534, 466);
    const k6 = condCol(c5.a, 572, 185, [476], 560, 800); g += k6.g + L(800, 466, 800, k6.mids[0]) + L(800, 466, 804, 466) + arU(804, 466);
    g += seqStatus(u, 1);
    return g + unitNav(n, 's2l');
  }
  function scrL2S(n) {
    const u = U(n); let g = title(`UNIT${n} SEQUENCE MONITOR (LOAD To STOP)`) + backBtn();
    g += stepBtn(u, 5, 5, 50, 95, -1) + L(100, 61, 257, 61) + junc(257, 51) + L(263, 61, 282, 61) + arR(282, 61);
    g += stepBtn(u, 4, 282, 50, 95, -1) + timer(u, 4, -1, 444, 52) + L(377, 61, 531, 61) + junc(531, 51) + L(537, 61, 555, 61) + arR(555, 61);
    g += stepBtn(u, 3, 555, 50, 95, -1) + timer(u, 3, -1, 715, 52) + L(650, 61, 801, 61) + junc(801, 51) + L(807, 61, 825, 61) + arR(825, 61);
    g += stepBtn(u, 2, 825, 50, 95, -1) + timer(u, 2, -1, 983, 52);
    g += PL([[920, 61], [985, 61], [985, 393], [505, 393], [505, 456], [527, 456]]);
    const k1 = condCol(u.condStop(4).a, 28, 187, [81, 116, 151], 17, 257, { h: 28 });
    g += k1.g + L(257, 71, 257, k1.mids[2]) + arU(260, 71);
    const k2 = condCol(u.condStop(3).a, 300, 187, [81], 288, 528, { h: 28 }); g += k2.g + L(528, 71, 528, k2.mids[0]) + arU(531, 71);
    const k3 = condCol(u.condStop(2).a, 572, 187, [81, 116], 560, 800, { h: 28 }); g += k3.g + L(800, 71, 800, k3.mids[1]) + arU(803, 71);
    g += junc(527, 446) + L(533, 456, 553, 456) + arR(553, 456) + stepBtn(u, 1, 553, 445, 97, -1) + timer(u, 1, -1, 715, 447);
    g += L(650, 456, 801, 456) + junc(801, 446) + L(807, 456, 825, 456) + arR(825, 456) + stepBtn(u, 0, 825, 445, 95, -1) + timer(u, 0, -1, 983, 447);
    const k4 = condCol(u.condStop(1).a, 300, 187, [444, 476, 508, 540], 288, 524, { h: 26 }); g += k4.g + L(524, 466, 524, k4.mids[3]) + L(524, 466, 530, 466) + arU(530, 466);
    const k5 = condCol(u.condStop(0).a, 572, 187, [478, 513], 560, 800, { h: 28 }); g += k5.g + L(800, 466, 800, k5.mids[1]) + L(800, 466, 804, 466) + arU(804, 466);
    g += seqStatus(u, -1);
    return g + unitNav(n, 'l2s');
  }
  function seqStatus(u, dir) {
    // info kecil (tidak ada di layar asli): status 1X/5X & lockout
    const lo = Object.entries(u.lo).filter((e) => e[1]).map((e) => e[0]).join(' ');
    let s = '';
    if (u.tr && u.tr.wait) s = `MENUNGGU: ${u.tr.dir > 0 && u.tr.to === 4 ? 'interlock sinkron / jaringan' : u.tr.to === 0 ? '14LT (stand still)' : 'START/CONTROL CONDITION'}`;
    if (u.tr && u.tr.fail) s = `SEQUENCE MONITOR ERROR → pilih step lain (43S-CS)`;
    return (lo ? T(12, 404, `LOCKOUT: ${lo}`, 't', 'style="fill:#ff5050;font-size:11px"') : '') + (s ? T(12, 418, s, 't', 'style="fill:#ffd040;font-size:11px"') : '') +
      T(980, 418, `${(u.dir || u.lastDir) > 0 ? '1X' : (u.dir || u.lastDir) < 0 ? '5X' : '  '}  TARGET ${M.STEP[u.target]}`, 't tr', 'style="fill:#888;font-size:10px"');
  }

  /* =========================== START CONDITION =========================== */
  function scList(list, x, w, y0, dy, lampX, busX, h = 18) {
    let g = ''; const mids = []; let i = 0;
    while (i < list.length) {
      const [lab, v, t] = list[i]; const y = y0 + i * dy, mid = y + h / 2; mids.push(mid);
      g += lamp(lampX, mid, !!v) + R(x, y, w, h, t === 'dash' ? 'boxd' : 'box') + T(x + 4, mid + 3.5, lab, 't', 'style="font-size:10px"');
      if (t === 'or' || t === 'ornot') {
        let j = i; const ms = []; while (j < list.length && list[j][2] === t) { const yy = y0 + j * dy + h / 2; if (j > i) { mids.push(yy); g += lamp(lampX, yy, !!list[j][1]) + R(x, y0 + j * dy, w, h) + T(x + 4, yy + 3.5, list[j][0], 't', 'style="font-size:10px"'); } ms.push(yy); j++; }
        const ox = busX - 52, cy = (ms[0] + ms[ms.length - 1]) / 2;
        ms.forEach((yy) => { g += L(x + w, yy, ox, yy); }); g += L(ox, ms[0], ox, ms[ms.length - 1]) + `<circle cx="${ox + 8}" cy="${cy}" r="7" class="nb"/>`;
        if (t === 'ornot') g += L(ox + 15, cy, busX - 26, cy) + `<rect x="${busX - 26}" y="${cy - 7}" width="14" height="14" class="nb"/>` + L(busX - 26, cy - 7, busX - 12, cy + 7) + L(busX - 12, cy - 7, busX - 26, cy + 7) + L(busX - 12, cy, busX, cy) + arR(busX, cy);
        else g += L(ox + 15, cy, busX, cy) + arR(busX, cy);
        i = j; continue;
      }
      if (t === 'not') g += L(x + w, mid, busX - 26, mid) + `<rect x="${busX - 26}" y="${mid - 7}" width="14" height="14" class="nb"/>` + L(busX - 26, mid - 7, busX - 12, mid + 7) + L(busX - 12, mid - 7, busX - 26, mid + 7) + L(busX - 12, mid, busX, mid) + arR(busX, mid);
      else g += L(x + w, mid, busX, mid) + arR(busX, mid);
      i++;
    }
    return { g, mids };
  }
  function outBox(x, y, lab, on) { return lamp(x + 8, y - 10, on) + R(x, y, 83, 42, 'boxd') + R(x - 3, y - 3, 89, 48, 'boxd') + mline(x + 41, y + 25, lab, 't ts tc', 11); }
  function scrSC1(n) {
    const u = U(n); let g = title(`UNIT${n} SEQUENCE MONITOR (START CONDITION)(1/2)`) + backBtn();
    const a = scList(u.sc1(), 28, 327, 37, 23.4, 15, 435);
    g += a.g + L(435, a.mids[0], 435, a.mids[a.mids.length - 1]) + junc(437, 110) + L(443, 120, 896, 120) + arR(896, 120) + outBox(900, 98, 'STARTING\nCONDITION-1', u.scOK(1));
    const b = scList(u.sc2(), 465, 327, 150, 23.4, 450, 871);
    g += b.g + L(871, b.mids[0], 871, b.mids[b.mids.length - 1]) + junc(873, 397) + L(879, 408, 896, 408) + arR(896, 408) + outBox(900, 387, 'STARTING\nCONDITION-2', u.scOK(2));
    return g + unitNav(n, 'sc1');
  }
  function scrSC2(n) {
    const u = U(n); let g = title(`UNIT${n} SEQUENCE MONITOR (START CONDITION)(2/2)`) + backBtn();
    const list = [...u.sc3().slice(0, 4), null, ...u.sc3().slice(4), ['STARTING CONDITION-1', u.scOK(1), 'dash'], ['STARTING CONDITION-2', u.scOK(2), 'dash']];
    const ys = [111, 135, 158, 182, 0, 225, 249, 272, 296, 319, 343];
    let mids = []; let g2 = '';
    list.forEach((it, i) => { if (!it) return; const r = scList([it], 28, 327, ys[i], 0, 15, 435); g2 += r.g; mids.push(r.mids[0]); });
    g += g2 + L(435, mids[0], 435, mids[mids.length - 1]) + junc(437, 215) + L(443, 225, 900, 225) + arR(900, 225) + outBox(905, 203, 'STARTING\nCONDITION', u.startingCond());
    const c = scList(u.ctrlList(), 28, 327, 478, 24, 15, 435);
    g += c.g + L(435, c.mids[0], 435, c.mids[3]) + junc(437, 514) + L(443, 524, 900, 524) + arR(900, 524) + outBox(905, 383 + 120, 'CONTROL\nCONDITION', u.controlCond());
    g += T(470, 450, 'Klik selector pada CONTROL PANEL / FAULT SIM. untuk mengubah kondisi.', 'dim', 'style="font-size:10px"');
    return g + unitNav(n, 'sc2');
  }

  /* =========================== CONTROL PANEL =========================== */
  function sel2(x, y, w, h, k, a, b, val, n, keyAct) {
    return b3(x, y, w, h, a[0], val === a[1] ? 'yel' : '', `sw:${n}:${k}:${a[1]}`) + b3(x + w, y, w, h, b[0], val === b[1] ? 'yel' : '', `sw:${n}:${k}:${b[1]}`);
  }
  function scrCtl(n) {
    const u = U(n), sw = u.sw, p = u.p, m = u.meas(); let g = title(`UNIT NO.${n} CONTROL PANEL`) + backBtn();
    g += T(96, 66, '43STEP', 't tc') + sel2(17, 73, 78, 25, 's43STEP', ['LOCAL', 'LOCAL'], ['REMOTE', 'REMOTE'], sw.s43STEP, n);
    g += T(92, 122, '43R', 't tc') + sel2(20, 128, 75, 23, 's43R', ['REMOTE', 'REMOTE'], ['CENTRAL', 'CENTRAL'], sw.s43R, n);
    g += T(92, 178, '43CH', 't tc') + sel2(20, 184, 75, 24, 's43CH', ['LOCK', 'LOCK'], ['USE', 'USE'], sw.s43CH, n);
    g += T(92, 262, '43ALR', 't tc') + sel2(20, 269, 75, 25, 'ALR', ['LOCK', false], ['USE', true], sw.ALR, n);
    g += T(92, 332, '43JLR', 't tc') + sel2(20, 339, 75, 25, 'JLR', ['LOCK', false], ['USE', true], sw.JLR, n);
    g += T(92, 427, '43AQR', 't tc') + sel2(20, 434, 75, 25, 'AQR', ['LOCK', false], ['USE', true], sw.AQR, n);
    g += T(92, 496, '43JQR', 't tc') + sel2(20, 504, 75, 25, 'JQR', ['LOCK', false], ['USE', true], sw.JQR, n);
    // status indicator
    g += T(625, 66, 'STATUS INDICATOR', 't tc');
    const si = ['STOP', 'START\nCONDITION', 'PREPARATION', 'INLET VALVE\nOPEN', 'INLET VALVE\nCLOSE', 'RUNNING', 'EXCITATION', 'PARALELL IN', 'LOAD'];
    const tr = u.tr;
    const siCls = (i) => {
      const map = { 0: 0, 2: 1, 5: 2, 6: 3, 7: 4, 8: 5 };
      if (i === 1) return u.pos === 0 && u.startingCond() && u.controlCond() ? 'yel' : '';
      if (i === 3) return tr && tr.dir > 0 && tr.to === 2 && p.ivCmd === 'open' && p.iv < 0.995 ? 'pink' : '';
      if (i === 4) return tr && tr.dir < 0 && tr.to === 1 && p.iv > 0.005 && p.ivCmd === 'close' ? 'pink' : '';
      const k = map[i]; if (k === u.pos) return 'yel';
      if (tr && tr.to === k) return tr.fail ? 'red' : 'pink';
      if (!tr && u.pos === 5 && k === 4) return 'pink';
      return '';
    };
    si.forEach((s, i) => { g += b3(270 + i * 77.3, 73, 77.3, 25, s, siCls(i)); });
    g += T(625, 122, 'STEP SELECTOR (43S-CS)', 't tc');
    const ss = [['STOP', 0], [''], ['PREPARATION', 1], [''], [''], ['RUNNING', 2], ['EXCITATION', 3], ['PARALELL IN', 4], ['LOAD', 5]];
    ss.forEach((s, i) => { if (s[0]) g += b3(270 + i * 77.3, 128, 77.3, 23, s[0], u.target === s[1] ? 'yel' : '', `cs:${n}:${s[1]}`); else g += R(270 + i * 77.3, 128, 77.3, 23, 'box'); });
    // turbine speed, 7-65, 7-77
    g += R(210, 183, 142, 47, 'box') + T(281, 200, 'TURBINE SPEED', 't tc') + T(281, 222, `${f(m.rpm)} RPM`, 't tc');
    g += b3(383, 183, 145, 24, '7-65', '', `rl:${n}:65`) + vbox(386, 213, 142, 28, `${f(p.cb && !p.islanded ? (sw.gov === 'OPENING' ? sw.opcSP : sw.alrSP / sw.maxP * 100) : p.sref * 100)} %`);
    g += b3(563, 183, 145, 24, '7-77', '', `rl:${n}:77`) + vbox(566, 213, 142, 28, `${f(p.gvLim)} %`);
    g += T(837, 176, 'MAIN CONTROL RELAY', 't tc') + b3(776, 181, 77, 28, '5X', (u.dir || u.lastDir) < 0 ? 'pink' : '') + b3(853, 181, 78, 28, '1X', (u.dir || u.lastDir) > 0 ? 'pink' : '');
    g += b3(936, 181, 46, 28, '5E', u.fx.manual_5e ? 'red' : '', `e5:${n}`);
    g += T(277, 262, '43SCH/WLC', 't tc') + b3(203, 267, 77, 26, 'WLC', '', 'na') + b3(280, 267, 77, 26, 'SCH', '', 'na');
    const totP = P.units.reduce((a, x) => a + (x.p.cb ? x.p.p : 0), 0), totQ = P.units.reduce((a, x) => a + (x.p.cb ? x.p.q : 0), 0);
    g += b3(383, 268, 145, 27, 'JOINT CONTROL SET\nPOINT ACTIVE POWER', '', 'na') + vbox(386, 299, 142, 28, `${f(totP)} MW`);
    g += b3(563, 268, 145, 27, 'MAX POWER', '', `sp:${n}:maxP`) + vbox(566, 299, 142, 28, `${f(sw.maxP)} MW`);
    g += T(853, 264, '86RESET', 't tc') + b3(778, 269, 75, 25, '86-5', u.lo['86-5'] ? 'red' : '', `rst:${n}:86-5`) + b3(853, 269, 77, 25, '86-4', u.lo['86-4'] ? 'red' : '', `rst:${n}:86-4`);
    g += R(210, 338, 142, 60, 'box') + T(281, 358, 'ACTIVE POWER', 't tc') + T(281, 386, `${f(p.p)} MW`, 't tc');
    g += b3(383, 338, 145, 27, 'ALR SET POINT', '', `sp:${n}:alrSP`) + vbox(386, 369, 142, 28, `${f(sw.alrSP)} MW`);
    g += b3(563, 338, 145, 27, 'MIN POWER', '', `sp:${n}:minP`) + vbox(566, 369, 142, 28, `${f(sw.minP)} MW`);
    g += T(856, 360, '43USM', 't tc') + sel2(780, 366, 73, 28, 'USM', ['LOCK', false], ['USE', true], sw.USM, n);
    g += T(280, 428, '43AQRC', 't tc') + sel2(205, 434, 73, 24, 'AQRC', ['SEMI AUTO', 'SEMI'], ['AUTO', 'AUTO'], sw.AQRC, n);
    g += b3(383, 431, 145, 27, 'JOINT CONTROL SET\nPOINT REACTIVE POWER', '', 'na') + vbox(386, 462, 142, 28, `${f(totQ)} MVar`);
    g += T(636, 428, '43-90', 't tc') + sel2(565, 434, 70, 24, 'AVR', ['MANUAL', 'MANUAL'], ['AUTO', 'AUTO'], sw.AVR, n);
    g += T(856, 428, '43AFC', 't tc') + sel2(780, 434, 73, 24, 'AFC', ['LOCK', false], ['USE', true], sw.AFC, n);
    g += R(210, 505, 142, 58, 'box') + T(281, 524, 'REACTIVE POWER', 't tc') + T(281, 552, `${f(p.q)} MVar`, 't tc');
    g += b3(383, 505, 145, 27, 'AQR SET POINT', '', `sp:${n}:aqrSP`) + vbox(386, 536, 142, 28, `${f(sw.aqrSP)} MVar`);
    g += b3(563, 505, 145, 27, '7-90R/70G', '', `rl:${n}:90`) + vbox(566, 536, 142, 28, `${f(m.kv)} kV`);
    g += T(860, 498, 'GOV MODE CONTROL', 't tc');
    const gm = p.cb && !p.islanded ? sw.gov : (p.govOn ? 'SPEED' : '');
    g += b3(753, 503, 72, 27, 'SPEED\nCONTROL', gm === 'SPEED' ? 'yel' : '', `gov:${n}:SPEED`) + b3(825, 503, 73, 27, 'OPENING\nCONTROL', gm === 'OPENING' ? 'yel' : '', `gov:${n}:OPENING`) + b3(898, 503, 72, 27, 'POWER\nCONTROL', gm === 'POWER' ? 'yel' : '', `gov:${n}:POWER`);
    g += b3(825, 543, 73, 25, 'OPC\nSETTING', '', `sp:${n}:opcSP`);
    if (u.selCS !== null && u.selCS !== undefined) g += T(625, 168, `SELECT: ${M.STEP[u.selCS]}`, 't tc', 'style="fill:#ffd040"');
    const x0 = [13, 121, 229, 337, 445, 553, 661, 769, 877];
    g += navBox(x0[0], 'UNIT NO.1\nCONTROL PANEL', 'nav:ctl1', n === 1) + navBox(x0[1], 'UNIT NO.2\nCONTROL PANEL', 'nav:ctl2', n === 2) + navBox(x0[2], 'UNIT NO.3\nCONTROL PANEL', 'nav:ctl3', n === 3);
    g += navBox(x0[3], 'SWITCHYARD/\nSTATION SERVICE\nCONTROL PANEL', 'nav:sy') + navBox(x0[4], 'SCH/WLC\nCONTROL PANEL', 'na');
    g += navBox(x0[5], `UNIT NO.${n}\nSEQ. MONITOR\nSTART CONDITION\n(1)`, `nav:sc1${n}`) + navBox(x0[6], `UNIT NO.${n}\nSEQ. MONITOR\nSTART CONDITION\n(2)`, `nav:sc2${n}`);
    g += navBox(x0[7], `UNIT NO.${n}\nSEQ. MONITOR\nSTOP TO LOAD`, `nav:s2l${n}`) + navBox(x0[8], `UNIT NO.${n}\nSEQ. MONITOR\nLOAD TO STOP`, `nav:l2s${n}`);
    return g;
  }

  /* =========================== CAPABILITY CURVE =========================== */
  const CAP = [[-70, 0], [-82, 23], [-76, 32], [-62, 47], [-45, 61], [-25, 73], [-8, 80], [5, 82.5], [15, 82.5], [25, 80], [35, 77.5], [47, 76], [51, 66], [53.5, 55], [55.5, 40], [57, 25], [57.5, 10], [57.5, 0]];
  function scrCap(n) {
    const u = U(n), p = u.p, sw = u.sw; let g = title(`CAPABILITY CURVE FOR UNIT${n}`) + backBtn();
    const X = (q) => 563 + q * 4.675, Y = (mw) => 532 - mw * 4.7;
    g += R(115, 93, 798, 447, 'box');
    for (let q = -90; q <= 70; q += 10) { g += L(X(q), 93, X(q), 540, 'grid') + T(X(q), 560, q, 't tc'); }
    for (let mw = 0; mw <= 90; mw += 10) { g += L(115, Y(mw), 913, Y(mw), 'grid'); if (mw % 20 === 0 && mw) g += T(X(0) + 6, Y(mw) + 4, mw, 't'); }
    g += L(X(0), 93, X(0), 540) + T(X(0), 86, 'MW', 't tc') + T(95, 545, 'MVar', 't tr');
    g += PL(CAP.map(([q, mw]) => [X(q).toFixed(1), Y(mw).toFixed(1)]), 'ln') + L(X(0), Y(0), X(47), Y(76), 'ln') + T(X(47) + 6, Y(76) - 10, 'PF=0.85', 't');
    const pp = Math.max(0, p.p), qq = p.q;
    g += L(115, Y(pp), 913, Y(pp), 'lnr') + `<line x1="${X(qq)}" y1="93" x2="${X(qq)}" y2="540" style="stroke:#3040ff;stroke-width:2"/>`;
    g += R(210, 580, 125, 38, '', 'fill="#000" stroke="#ff2020" stroke-width="2"') + T(222, 604, 'P:', 't') + T(300, 604, `${f(pp, 0)}  MW`, 't tr', 'style="font-size:14px"');
    g += R(351, 580, 125, 38, '', 'fill="#000" stroke="#3040ff" stroke-width="2"') + T(363, 604, 'Q:', 't') + T(441, 604, `${f(qq, 0)}  Mvar`, 't tr', 'style="font-size:14px"');
    g += T(505, 588, 'AQR CONTROL FOMULA:', 't') + T(650, 588, `Q =   ${f(sw.aqrA)}+    ${f(sw.aqrB)}P`, 't', 'style="fill:#30e030"') + T(690, 602, 'Q: REACTIVE POWER', 'ts') + T(690, 614, 'P: ACTIVE POWER', 'ts');
    return g;
  }

  /* =========================== VIBRATION =========================== */
  function scrVib(n) {
    const u = U(n), v = u.p.vib, m = u.meas(); let g = title(`TURBINE GENERATOR VIBRATION MONITOR FOR Unit No.${n}`) + backBtn();
    g += R(25, 68, 382, 22) + T(30, 83, 'TURBINE SPEED') + L(256, 68, 256, 90) + T(340, 83, `${f(m.rpm)} RPM`, 't tc');
    const blk = (y, label, rows, unit1, hdr) => {
      let s = hdr ? T(330, y - 7, 'BRACKET VIBRATION', 't tc') + T(495, y - 7, 'SHAFT RUN-OUT', 't tc') : '';
      s += R(25, y, 547, 46) + L(258, y + 23, 572, y + 23) + T(31, y + 27, label, 't ts');
      s += L(258, y, 258, y + 46) + L(282, y, 282, y + 46) + L(407, y, 407, y + 46) + L(430, y, 430, y + 46);
      rows.forEach((r, i) => { const yy = y + 16 + i * 23; s += T(270, yy, i ? '(H)' : '(V)', 't tc') + T(340, yy, `${r[0]} ${unit1}`, 't tc') + T(418, yy, i ? '(Y)' : '(X)', 't tc') + T(500, yy, `${r[1]} µm pk-pk`, 't tc');
        if (r[2]) s += lamp(565, yy - 4, true, 4); });
      return s;
    };
    g += blk(122, 'GENERATOR UPPER GUIDE VIBRATION', [[f(v.ubv, 0), f(v.ugx)], [f(v.ubh, 0), f(v.ugy)]], 'µm pk-pk', true);
    g += blk(183, 'GENERATOR LOWER GUIDE VIBRATION', [[f(v.lbv, 0), f(v.lgx)], [f(v.lbh, 0), f(v.lgy)]], 'µm pk-pk');
    g += blk(410, 'TURBINE GUIDE VIBRATION', [[f(v.hcv), f(v.tgx), v.tgx > 150], [f(v.hch), f(v.tgy), v.tgy > 150]], 'mm/s pk', true);
    g += L(578, 158, 745, 158) + arR(750, 158) + L(578, 218, 745, 218) + arR(750, 218) + L(578, 445, 705, 465) + arR(710, 466);
    // poros & generator
    g += `<rect x="685" y="142" width="187" height="94" fill="none" stroke="#e8e8e8" stroke-width="2"/>` + T(808, 134, 'GENERATOR', 't');
    g += `<rect x="768" y="118" width="22" height="440" fill="#9a9a9a"/>` + [158, 218, 315].map((y) => `<rect x="752" y="${y - 8}" width="54" height="16" fill="#777"/>`).join('');
    g += `<rect x="742" y="400" width="74" height="34" fill="#bbb"/><circle cx="693" cy="478" r="17" fill="#ddd"/><circle cx="862" cy="478" r="19" fill="#ddd"/><rect x="705" y="470" width="140" height="16" fill="#aaa"/>`;
    g += `<path d="M760,486 L760,560 Q760,600 820,600 L965,600 L965,540 L840,540 Q800,540 800,500 L800,486 Z" fill="#888"/>`;
    g += T(25, 600, 'Setelan (asumsi): run-out turbine guide alarm 150 µm, trip 200 µm → 86-5', 'dim', 'style="font-size:10px"');
    return g;
  }

  /* =========================== ANALOG INPUT =========================== */
  function scrAI(n) {
    const u = U(n), p = u.p, m = u.meas(), T_ = p.T, v = p.vib; let g = title(`ANALOG INPUT FOR UNIT${n}`) + backBtn() + T(495, 40, '---  4-20mA CURRENT INPUT  ---', 't tc');
    const ai = [['GENERATOR CURRENT PHASE (R)', f(m.Ir, 0), 'A'], ['GENERATOR CURRENT PHASE (S)', f(m.Is, 0), 'A'], ['GENERATOR CURRENT PHASE (T)', f(m.It, 0), 'A'], ['GENERATOR VOLTAGE', f(m.kv), 'kV'],
      ['GENERATOR ACTIVE POWER', f(m.p), 'MW'], ['GENERATOR REACTIVE POWER', f(m.q), 'MVar'], ['SPARE', '0', ''], ['SPARE', '0', ''], ['TURBINE SPEED', f(m.rpm), 'RPM'], ['GUIDE VANE OPENING', f(m.gv), '%'],
      ['GUIDE VANE LIMIT', f(m.gvLim), '%'], ['SPARE', '0', ''], ['EXCITATION CURRENT', f(m.If, 0), 'A'], ['EXCITATION VOLTAGE', f(m.Vf), 'V'], ['TURBINE WATER FLOW', f(m.flow), 'm3/s'], ['M.TR PRESSURE TRANSMITTER', '10.0', 'bar']];
    const ai2 = [['VIBRATION FOR UPPER BRACKET - VERTICAL', f(v.ubv, 0), 'µm pk-pk'], ['VIBRATION FOR UPPER BRACKET - HORIZONTAL', f(v.ubh, 0), 'µm pk-pk'], ['VIBRATION FOR LOWER BRACKET - VERTICAL', f(v.lbv, 0), 'µm pk-pk'],
      ['VIBRATION FOR LOWER BRACKET - HORIZONTAL', f(v.lbh, 0), 'µm pk-pk'], ['VIBRATION FOR HEAD COVER - VERTICAL', f(v.hcv), 'mm/s pk'], ['VIBRATION FOR HEAD COVER - HORIZONTAL', f(v.hch), 'mm/s pk'],
      ['M.TR ROOM AMBIENT TEMPERATURE', '37.5', '℃'], ['M.TR COOLING WATER FLOW', f(p.f_ac * 0.0, 1), 'm3/s'], ['SPIRAL CASE PRESSURE', f(m.spiral), 'mWC'], ['PENSTOCK PRESSURE', f(m.penstock), 'mWC'],
      ['SHAFT RUN-OUT FOR UPPER GUIDE - X', f(v.ugx), 'µm pk-pk'], ['SHAFT RUN-OUT FOR UPPER GUIDE - Y', f(v.ugy), 'µm pk-pk'], ['SHAFT RUN-OUT FOR LOWER GUIDE - X', f(v.lgx), 'µm pk-pk'],
      ['SHAFT RUN-OUT FOR LOWER GUIDE - Y', f(v.lgy), 'µm pk-pk'], ['SHAFT RUN-OUT FOR TURBINE GUIDE - X', f(v.tgx), 'µm pk-pk'], ['SHAFT RUN-OUT FOR TURBINE GUIDE - Y', f(v.tgy), 'µm pk-pk']];
    const rtd = [['GEN. STATOR WINDING TEMPERATURE - 1', T_.st[0]], ['GEN. STATOR WINDING TEMPERATURE - 2', T_.st[1]], ['GEN. STATOR WINDING TEMPERATURE - 3', T_.st[2]], ['GEN. STATOR WINDING TEMPERATURE - 4', T_.st[3]],
      ['GEN. THRUST BEARING METAL TEMPERATURE', T_.thrust], ['GEN. UPPER GUIDE BEARING METAL TEMPERATURE', T_.ugb], ['GEN. LOWER GUIDE BEATING METAL TEMPERATURE - 1', T_.lgb], ['GEN. LOWER GUIDE BEATING METAL TEMPERATURE - 2', T_.lgb + 1.8],
      ['GEN. UPPER GUIDE BEARING OIL TEMPERATURE', T_.ugbOil], ['GEN. LOWER GUIDE BEARING OIL TEMPERATURE', T_.lgbOil], ['GEN. AIR COOLER AIR OUTLET TEMPERATURE', T_.acOut], ['GEN. AIR COOLER AIR INLET TEMPERATURE', T_.acIn],
      ['TURBINE GUIDE BEARING METAL TEMPERATURE', T_.tgb], ['TURBINE GUIDE BEARING OIL TEMPERATURE', T_.tgbOil], ['COOLING WATER OUTLET TEMPERATURE', T_.cwOut]];
    const rtd2 = [['COOLING WATER INLET TEMPERATURE', T_.cwIn], ['MAIN TRANSFORMER WINDING TEMPERAURE', T_.mtrWdg], ['MAIN TRANSFORMER OIL TEMPERAURE', T_.mtrOil], ['GENERATOR ROOM', 36.5]];
    const RH = 17.5;
    const tbl = (x, y, rows, pre, w1, w2, unitDefault) => rows.map((r, i) => { const yy = y + i * RH; return R(x, yy, 62, RH, 'box') + T(x + 3, yy + 12.5, `${n}${pre}${String(i + 1).padStart(4, '0')}`, 'ts') + R(x + 62, yy, w1 - 62, RH, 'box') + T(x + 66, yy + 12.5, r[0], 'ts') +
      R(x + w1 + 10, yy, w2, RH, 'box') + T(x + w1 + w2 - 40, yy + 12.5, typeof r[1] === 'number' ? f(r[1]) : r[1], 'ts tr') + T(x + w1 + w2 - 34, yy + 12.5, r[2] !== undefined ? r[2] : unitDefault, 'ts'); }).join('');
    g += tbl(10, 46, ai, 'AI', 355, 120, '') + tbl(500, 46, ai2.map((r, i) => r), 'AI', 355, 120, '').replace(/>(\d)AI(\d{4})</g, (s0, a, b) => `>${a}AI${String(+b + 16).padStart(4, '0')}<`);
    g += T(495, 340, '---  RTD INPUT  ---', 't tc');
    g += tbl(10, 346, rtd, 'RTD', 355, 120, '℃') + tbl(500, 346, rtd2, 'RTD', 355, 120, '℃').replace(/>(\d)RTD(\d{4})</g, (s0, a, b) => `>${a}RTD${String(+b + 15).padStart(4, '0')}<`);
    return g;
  }

  /* =========================== WATER FLOW / OVERVIEW =========================== */
  function scrOvw(n) {
    const u = U(n), p = u.p, m = u.meas(), T_ = p.T; let g = title(`NO.${n} UNIT WATER FLOW SYSTEM`) + backBtn();
    const rows = [['ACTIVE POWER', f(m.p), 'MW'], ['REACTIVE POWER', f(m.q), 'MVar'], ['TURBINE SPEED', f(m.rpm), 'RPM'], ['GUIDE VANE POS.', f(m.gv), '%'], ['LOAD LIMITER POS.', f(m.gvLim), '%'], ['TURBINE WATER FLOW', f(m.flow), 'm3/s'],
      ['COOLING WATER OUTLET', f(T_.cwOut), '℃'], ['COOLING WATER INLET', f(T_.cwIn), '℃'], ['TURB. GUIDE BRG MTL TEMP', f(T_.tgb), '℃'], ['TURB. GUIDE BRG OIL TEMP', f(T_.tgbOil), '℃'], ['PENSTOCK PRESSURE', f(m.penstock), 'mWC'],
      ['SPIRAL CASE PRESSURE', f(m.spiral), 'mWC'], ['M.TR COOLING WATER FLOW', '?', 'm3/h']];
    g += T(14, 46, `UNIT No.${n}`, 'ts');
    rows.forEach((r, i) => { const y = 52 + i * 18.8; g += R(10, y, 165, 18.8) + T(14, y + 13.5, r[0], 'ts') + R(175, y, 82, 18.8) + T(232, y + 13.5, r[1], 'ts tr') + T(236, y + 13.5, r[2], 'ts'); });
    [['INTAKE WATER LEVEL', f(P.intakeWL, 2), 'Elm'], ['TAILRACE LEVEL', '173.5', 'Elm']].forEach((r, i) => { const y = 304 + i * 18.8; g += R(10, y, 165, 18.8) + T(14, y + 13.5, r[0], 'ts') + R(175, y, 82, 18.8) + T(232, y + 13.5, r[1], 'ts tr') + T(236, y + 13.5, r[2], 'ts'); });
    g += T(270, 46, 'GENERATOR OIL/METAL TEMP', 'ts');
    const r2 = [['UPPER GUIDE BRG MTL', T_.ugb], ['THRUST & UP. GUIDE BRG OIL', T_.ugbOil], [''], ['THRUST BRG MTL', T_.thrust], ['LOWER GUIDE BRG MTL (1)', T_.lgb], ['LOWER GUIDE BRG MTL (2)', T_.lgb + 1.8], ['LOWER GUIDE BRG OIL', T_.lgbOil], [''], ['GEN. COOLING AIR OUTLET', T_.acOut], ['GEN. COOLING AIR INLET', T_.acIn]];
    r2.forEach((r, i) => { if (!r[0]) return; const y = 52 + i * 18.8; g += R(267, y, 170, 18.8) + T(271, y + 13.5, r[0], 'ts') + R(437, y, 78, 18.8) + T(495, y + 13.5, f(r[1]), 'ts tr', r[1] > 70 ? 'style="fill:#ff4040"' : '') + T(499, y + 13.5, '℃', 'ts'); });
    // mimic sederhana
    g += R(525, 30, 345, 22, 'box') + T(697, 45, 'MAIN TRANSFORMER OIL COOLER', 't tc ts');
    g += `<rect x="638" y="58" width="262" height="140" fill="none" stroke="#ddd" stroke-width="3"/>` + R(665, 66, 205, 20) + T(767, 80, 'THRUST & UPPER GUIDE BEARING', 't tc ts') + R(665, 168, 205, 20) + T(767, 182, 'THRUST & LOWER GUIDE BEARING', 't tc ts');
    g += T(665, 102, 'VOLT.', 'ts') + T(755, 102, 'CURRENT', 'ts') + T(820, 102, 'WINDING T.', 'ts') + T(665, 118, `${f(m.kv)}  kV`, 'ts');
    ['R', 'S', 'T'].forEach((ph, i) => { g += T(720, 118 + i * 14, `(${ph})  ${f([m.Ir, m.Is, m.It][i], 0)}  A`, 'ts'); });
    T_.st.forEach((t, i) => { g += T(820, 118 + i * 14, `(${i + 1})  ${f(t)} ℃`, 'ts'); });
    const fr = (x, y, ok) => `<circle cx="${x}" cy="${y}" r="9" fill="${ok ? '#18e018' : '#ff2020'}" stroke="#000"/>` + T(x, y + 3.5, 'FR', 't tc', 'style="font-size:8px;fill:#000"');
    g += fr(922, 176, p.f_lb > 0.6) + fr(922, 218, p.f_ac > 0.6) + fr(851, 260, p.f_tb > 0.6) + fr(688, 310, p.f_sc > 0.6);
    g += T(838, 245, '80FB1 80FB2', 'ts') + T(670, 296, '80FS1', 'ts');
    g += `<rect x="760" y="198" width="16" height="140" fill="#999"/><circle cx="682" cy="346" r="18" fill="#ddd"/><circle cx="850" cy="346" r="18" fill="#ddd"/><rect x="700" y="338" width="135" height="16" fill="#aaa"/>`;
    g += `<path d="M752,354 L752,420 Q752,452 805,452 L955,452 L955,405 L825,405 Q790,405 790,380 L790,354 Z" fill="#8a8a8a"/>` + T(768, 368, `UNIT No.${n}`, 'ts tc', 'style="fill:#000"');
    // inlet valve
    const ivc = p.iv > 0.995 ? '#18e018' : p.iv < 0.005 ? '#ff2020' : '#ffd000';
    g += T(250, 268, 'BY-PASS VALVE', 'ts') + `<path d="M310,286 L330,296 L310,306 Z M350,286 L330,296 L350,306 Z" fill="${p.bypass > 0.01 ? '#ffd000' : '#18e018'}"/>`;
    g += `<rect x="230" y="355" width="200" height="56" rx="20" fill="#bbb"/><circle cx="330" cy="383" r="52" fill="#999"/><rect x="305" y="374" width="50" height="18" fill="${ivc}"/>` + T(330, 450, `INLET VALVE ${f(m.iv, 0)} %`, 't tc ts');
    // pompa air pendingin
    const pumpG = (x, y, lab, pm) => `<circle cx="${x}" cy="${y}" r="10" fill="${pm.run ? '#ff2020' : pm.fail ? '#ffd000' : '#18e018'}" stroke="#000"/>` + T(x, y - 14, lab, 't tc ts');
    g += R(465, 470, 290, 120, 'box') + pumpG(745, 512, '88WC1', p.cw[0]) + pumpG(745, 565, '88WC2', p.cw[1]);
    g += T(560, 500, 'MAIN COOLING WATER', 't tc ts') + T(560, 516, `MAIN: ${p.cw[p.cwMain].name}`, 't tc ts') + T(560, 532, `GOV PUMP: ${p.qp[0].run ? '88QP1 RUN' : p.qp[1].run ? '88QP2 RUN' : 'STOP'}`, 't tc ts') + T(560, 548, `GOV OIL PRESS ${f(Math.min(100, m.govP), 0)} %`, 't tc ts', p.govP < 0.85 ? 'style="fill:#ff4040"' : '');
    g += T(560, 564, `88QT ${p.qt.run ? 'RUN' : 'STOP'}   88SH ${p.sh ? 'ON' : 'OFF'}`, 't tc ts');
    g += `<rect x="890" y="580" width="95" height="26" fill="#3070ff"/>` + T(937, 625, 'WATER DISCHARGE PIT', 't tc ts');
    return g;
  }

  /* =========================== ANNUNCIATOR =========================== */
  const GRPS = [['UNIT1', 'U1', 'ann1'], ['UNIT2', 'U2', 'ann2'], ['UNIT3', 'U3', 'ann3'], ['UNDERGROUND\nSTATION SERVICE', null, null], ['MAIN CONTROL\nSTATION SERVICE', null, null], ['SWITCHYARD', 'SY', 'annsy'], ['MIMIC PANEL\n(1/2)', null, null], ['MIMIC PANEL\n(2/2)', null, null]];
  function scrAnn(grp, label) {
    let g = title(`${label} ANN`) + backBtn();
    const xs = [47, 164, 281, 398, 515, 632, 749, 866];
    GRPS.forEach(([lab, gk, sid], i) => { const act = gk ? P.alarms.grpActive(gk) : false; g += `<g class="grp ${act ? 'act' : ''} ${gk === grp ? 'cur' : ''}" ${sid ? `data-a="nav:${sid}"` : ''}>${R(xs[i], 50, 104, 46)}${mline(xs[i] + 52, 77, lab, '', 11)}</g>`; });
    const W = grp === 'SY' ? M.SY_WIN : M.UNIT_WIN;
    xs.forEach((x, i) => { g += T(x + 52, 118, i + 1, 't tc'); });
    'ABCDEF'.split('').forEach((r, ri) => {
      const y = 130 + ri * 56.3; g += T(23, y + 27, r, 't tc');
      W[r].forEach((lab, ci) => { const st = P.alarms.win(grp, r + (ci + 1)); g += `<g class="ann ${st === 'off' ? '' : st}" data-a="win:${grp}:${r}${ci + 1}">${R(xs[ci], y, 104, 46)}${mline(xs[ci] + 52, y + 27, lab, '', 11)}</g>`; });
    });
    g += b3(736, 588, 102, 27, 'RESET', '', `annrst:${grp}`) + b3(853, 588, 102, 27, 'ACK', '', `annack:${grp}`);
    return g;
  }

  /* =========================== SWITCHYARD =========================== */
  function scrSY() {
    const sy = P.sy, st = sy.st, lv = sy.busLive(), fl = sy.flows(); let g = title('150kV SWITCHYARD') + backBtn();
    g += T(175, 32, '150kV TRANSMISSION LINES', 't') + T(175, 44, 'TO NEW CURUP SUBSTATION', 't');
    const ds = (x, y, d, lab, lx = 17) => `<g class="dev" data-a="dev:${d}"><circle cx="${x}" cy="${y}" r="8" class="${st[d] ? 'devc' : 'devo'}"/>${L(x - 4.5, y - 4.5, x + 4.5, y + 4.5, 'devx')}${L(x + 4.5, y - 4.5, x - 4.5, y + 4.5, 'devx')}</g>` + T(x + lx, y + 4, lab, 't');
    const cb = (x, y, d, lab) => `<g class="dev" data-a="dev:${d}"><rect x="${x - 9}" y="${y - 9}" width="18" height="18" class="cbsq ${st[d] ? 'devc' : 'devo'}"/><rect x="${x - 5}" y="${y - 5}" width="10" height="10" fill="${st[d] ? '#a00' : '#0a0'}"/></g>` + T(x + 17, y + 4, lab, 't');
    const lc = (live) => live ? 'lnr' : 'lng';
    // bus
    g += L(7, 277, 980, 277, lv.A ? 'lnr' : 'lng') + L(7, 299, 980, 299, lv.B ? 'lnr' : 'lng');
    g += T(565, 268, '150kV BUS-A', 't') + T(690, 268, `${lv.A ? '154.3' : '0.0'}  kV`, 't') + T(830, 268, `${lv.A ? f(sy.freq) : '0.0'}  Hz`, 't');
    g += T(565, 292, '150kV BUS-B', 't') + T(690, 292, `${lv.B ? '154.0' : '0.0'}  kV`, 't') + T(830, 292, `${lv.B ? f(sy.freq) : '0.0'}  Hz`, 't');
    // lines
    [['L1', 65, 'T/L NO.1'], ['L2', 283, 'T/L NO.2']].forEach(([Lk, x, lab]) => {
      const liveLine = sy.lineOK[Lk];
      g += R(x - 35, 53, 70, 16, '', `fill="${liveLine ? '#ff2020' : '#555'}"`) + T(x, 65, lab, 't tc');
      g += L(x, 69, x, 246 - 20, lc(liveLine)) + L(x, 96, x + 40, 96, lc(liveLine)) + L(x + 55, 88, x + 55, 104, 'ln') + L(x + 59, 90, x + 59, 102, 'ln') + L(x + 63, 92, x + 63, 100, 'ln');
      g += ds(x + 47, 96, `189-${Lk}E`, `189-${Lk}E`, -38).replace(`x="${x + 47 - 38}" y="100"`, `x="${x + 26}" y="82"`);
      g += ds(x, 118, `189-${Lk}`, `189-${Lk}`);
      g += T(x + 20, 144, `${f(fl[Lk].p)}  MW`, 't') + T(x + 20, 156, `${f(fl[Lk].q)}  MVar`, 't') + T(x + 20, 168, `${f(Math.hypot(fl[Lk].p, fl[Lk].q) * 1000 / (Math.sqrt(3) * 154), 0)}  A`, 't');
      g += cb(x, 189, `152-${Lk}`, `152-${Lk}`) + L(x, 198, x, 226, lc(liveLine && st['152-' + Lk])) + L(x - 39, 226, x + 39, 226, lc(liveLine && st['152-' + Lk]));
      g += L(x - 39, 226, x - 39, 277, lc(lv.A)) + L(x + 39, 226, x + 39, 299, lc(lv.B));
      g += ds(x - 39, 246, `189-${Lk}A`, `189-${Lk}A`) + ds(x + 39, 246, `189-${Lk}B`, `189-${Lk}B`);
    });
    // total
    g += R(655, 65, 280, 47) + T(662, 83, 'TOTAL ACTIVE POWER OUTPUT', 'ts') + T(900, 83, `${f(fl.tot.p)}  MW`, 'ts tr') + T(662, 104, 'TOTAL REACTIVE POWER OUTPUT', 'ts') + T(900, 104, `${f(fl.tot.q)}  MVar`, 'ts tr');
    // bus tie
    g += L(137, 277, 137, 331, lc(lv.A)) + L(213, 299, 213, 331, lc(lv.B)) + ds(137, 331, '189-BTA', '189-BTA', 0).replace('x="137" y="335"', 'x="150" y="318"') + ds(213, 331, '189-BTB', '189-BTB', 0).replace('x="213" y="335"', 'x="225" y="318"');
    g += PL([[137, 339], [137, 359], [213, 359], [213, 339]], lc(lv.A || lv.B)) + cb(175, 359, '152-BT', '') + T(157, 386, '152-BT', 't') + T(185, 404, `${f(fl.BT, 0)}  A`, 't');
    // unit bays
    [[3, 405], [2, 545], [1, 685]].forEach(([n, x]) => {
      const u = U(n), m = u.meas(), bus = sy.unitBus(n), live = bus && lv[bus] && st['152-U' + n];
      g += L(x - 38, 277, x - 38, 331, lc(lv.A)) + L(x + 38, 299, x + 38, 331, lc(lv.B));
      g += ds(x - 38, 331, `189-U${n}A`, '', 0) + T(x - 26, 318, `189-U${n}A`, 't') + ds(x + 38, 331, `189-U${n}B`, '', 0) + T(x + 50, 318, `189-U${n}B`, 't');
      g += PL([[x - 38, 339], [x - 38, 356], [x + 38, 356], [x + 38, 339]], lc(!!bus && lv[bus])) + L(x, 356, x, 372, lc(!!bus && lv[bus]));
      g += cb(x, 381, `152-U${n}`, `152-U${n}`) + T(x + 50, 399, `${f(u.p.cb && live ? Math.hypot(u.p.p, u.p.q) * 1000 / (Math.sqrt(3) * 154) : 0)}  A`, 't tr');
      g += L(x, 390, x, 435, lc(live)) + `<circle cx="${x}" cy="${443}" r="9" fill="none" stroke="${live ? '#ff2020' : '#666'}" stroke-width="1.5"/><circle cx="${x}" cy="${461}" r="9" fill="none" stroke="#2ec5e8" stroke-width="1.5"/>`;
      g += T(x + 18, 430, `M.Tr No.${n}`, 'ts') + T(x + 18, 446, 'OIL', 'ts') + T(x + 85, 446, `${f(u.p.T.mtrOil)} ℃`, 'ts tr') + T(x + 18, 462, 'WDG', 'ts') + T(x + 85, 462, `${f(u.p.T.mtrWdg)} ℃`, 'ts tr');
      g += L(x, 470, x, 549, u.p.vt > 0.3 ? 'lnc' : 'lng') + T(x + 5, 488, `89-${n}`, 'ts') + `<g><circle cx="${x}" cy="503" r="6" class="devc"/>${L(x - 3.5, 499.5, x + 3.5, 506.5, 'devx')}${L(x + 3.5, 499.5, x - 3.5, 506.5, 'devx')}</g>`;
      g += T(x + 78, 512, `${f(m.kv)}  kV`, 'ts tr') + T(x + 78, 524, `${f(m.I, 0)}  A`, 'ts tr') + T(x + 78, 536, `${f(m.p)}  MW`, 'ts tr') + T(x + 78, 548, `${f(m.q)}  MVar`, 'ts tr');
      g += `<g data-a="nav:ctl${n}"><rect x="${x - 9}" y="${547}" width="18" height="18" class="cbsq ${u.p.cb ? 'devc' : 'devo'}"/></g>` + T(x + 17, 560, `52-${n}`, 't');
      g += L(x, 565, x, 588, u.p.vt > 0.3 ? 'lnc' : 'lng') + `<g data-a="nav:ctl${n}"><circle cx="${x}" cy="602" r="15" fill="none" stroke="${u.p.vt > 0.3 ? '#ff2020' : '#18e018'}" stroke-width="2"/></g>` + T(x, 600, `No.${n}`, 'ts tc', `style="fill:${u.p.vt > 0.3 ? '#ff2020' : '#18e018'}"`) + T(x, 610, 'GS', 'ts tc', `style="fill:${u.p.vt > 0.3 ? '#ff2020' : '#18e018'}"`);
      g += `<path d="M${x + 24},588 l6,-6 l-6,-6 l6,-6 l-6,-6" fill="none" stroke="#ccc"/>` + T(x + 45, 594, 'EXCITOR', 'ts') + T(x + 98, 607, `${f(m.Vf)}  V`, 'ts tr') + T(x + 98, 619, `${f(m.If, 0)}  A`, 'ts tr');
    });
    // LST
    const x = 825, liveL = sy.unitBus ? (st['189-LSTA'] ? lv.A : lv.B) : false;
    g += L(x - 37, 277, x - 37, 331, lc(lv.A)) + L(x + 38, 299, x + 38, 331, lc(lv.B)) + ds(x - 37, 331, '189-LSTA', '', 0) + T(x - 25, 318, '189-LSTA', 't') + ds(x + 38, 331, '189-LSTB', '', 0) + T(x + 50, 318, '189-LSTB', 't');
    g += PL([[x - 37, 339], [x - 37, 356], [x + 38, 356], [x + 38, 339]], lc(liveL)) + L(x, 356, x, 372, lc(liveL)) + cb(x, 381, '152-LST', '152-LST') + T(x + 50, 399, `${f(st['152-LST'] && liveL ? 2.1 : 0)}  A`, 't tr');
    g += L(x, 390, x, 435, lc(st['152-LST'] && liveL)) + `<circle cx="${x}" cy="443" r="9" fill="none" stroke="#ff2020" stroke-width="1.5"/><circle cx="${x}" cy="461" r="9" fill="none" stroke="#ff9a2a" stroke-width="1.5"/><circle cx="${x + 17}" cy="452" r="9" fill="none" stroke="#ff9a2a" stroke-width="1.5"/>`;
    g += L(x, 470, x, 505, 'lno') + T(x + 30, 437, 'LSTr', 'ts') + T(x + 30, 450, 'OIL', 'ts') + T(x + 100, 450, '44.0 ℃', 'ts tr') + T(x + 30, 465, 'WDG', 'ts') + T(x + 100, 465, '43.2 ℃', 'ts tr');
    g += T(907, 400, 'TAP POSITION', 'ts') + R(907, 405, 68, 23) + T(941, 421, sy.tap, 't tc') + T(795, 517, 'to 20kV CUBICLE', 'ts') + T(795, 529, 'IN MAIN CONTROL HOUSE', 'ts');
    // ambient
    g += T(143, 482, 'AMBIENT TEMP', 'ts') + R(140, 487, 210, 140);
    [['M.Tr No.1', '?'], ['M.Tr No.2', '37.5'], ['M.Tr No.3', '?'], ['OUTDOOR SWITCHYARD', '32.9'], ['MAIN CONTROL HOUSE', '?'], ['UNDER. POWERHOUSE', '36.6']].forEach((r, i) => { g += T(145, 506 + i * 23, r[0], 'ts') + T(340, 506 + i * 23, r[1] + ' ℃', 'ts tr'); });
    g += b3(10, 537, 105, 28, 'FLICKER RESET', '', 'annack:SY') + `<g class="nav" data-a="nav:ctl${curU}">${R(13, 577, 102, 50)}${mline(64, 603, 'SWITCHYARD/\nSTATION SERVICE\nCONTROL PANEL', '', 10)}</g>`;
    g += T(980, 638, 'Klik DS/CB untuk select → execute (dengan interlock).', 'dim tr', 'style="font-size:9.5px"');
    return g;
  }

  /* =========================== HTML SCREENS =========================== */
  let htmlCache = '';
  function scrFault() {
    const sc = M.SCN[selFault];
    const unitList = [1, 2, 3].map((n) => `<span class="sb ${fsUnit === n ? 'on' : ''}" data-a="fsu:${n}">UNIT ${n}</span>`).join('');
    let list = ''; let lastG = '';
    M.SCENARIOS.forEach((s) => {
      if (s.grp !== lastG) { list += `<div class="grp">${esc(s.grp)}</div>`; lastG = s.grp; }
      const act = P.activeFault(s.key, fsUnit);
      list += `<div class="item ${s.key === selFault ? 'sel' : ''} ${act ? 'act' : ''}" data-a="fsel:${s.key}"><i class="dot"></i>${esc(s.name)}${s.unit ? '' : ' <span style="color:#888">[plant]</span>'}</div>`;
    });
    const u = U(fsUnit);
    const lo = ['86-1', '86-2', '86-4', '86-5', '86-T', '86-PC'].map((k) => `<div class="${u.lo[k] ? 'on' : ''}" data-a="rst:${fsUnit}:${k}" title="${esc(M.RESET_RULE[k])}"><i></i>${k}${u.lo[k] ? `<span style="font-size:10px;color:#ff9090"> RESET</span>` : ''}</div>`).join('');
    const loCause = Object.entries(u.lo).filter((e) => e[1]).map(([k, v]) => `<div class="ALARM">${k}: ${esc(v)}</div>`).join('') || '<div style="color:#30e030">Tidak ada lockout aktif</div>';
    const ev = P.events.slice(-60).reverse().filter((e) => e.msg.startsWith(`U${fsUnit}:`) || e.msg.startsWith('SY:') || e.msg.startsWith('FAULT') || e.msg.includes('KEHILANGAN')).slice(0, 30)
      .map((e) => `<div class="${e.type}">${fmtT(e.t)} ${esc(e.msg)}</div>`).join('');
    const act = sc.unit ? P.activeFault(sc.key, fsUnit) : P.activeFault(sc.key);
    return `<div class="h2">FAULT SIMULATION (INSTRUCTOR)</div><div class="fs">
      <div class="col">
        <h4>INISIALISASI</h4><div class="row"><span class="sb" data-a="init:op">OPERASI (U1 / U2 / U3 = 70 MW)</span><span class="sb" data-a="init:stop">SEMUA STAND STILL</span><span class="sb" data-a="init:clr">HAPUS SEMUA GANGGUAN</span></div>
        <h4>UNIT TARGET</h4><div class="row">${unitList}</div>
        <h4>SKENARIO GANGGUAN</h4>${list}
      </div>
      <div class="col">
        <h4>DETAIL SKENARIO</h4>
        <div class="det"><div style="color:#ffd040;font-size:13px">${esc(sc.name)} ${sc.unit ? `– UNIT ${fsUnit}` : '– PLANT'}</div>
          <div><b>Penyebab:</b> ${esc(sc.cause)}</div><div><b>Rantai kejadian:</b> ${esc(sc.chain)}</div>
          <div><b>Proteksi:</b> <span style="color:#ff7070">${esc(sc.prot)}</span> <span style="color:#888">(sumber: ${esc(sc.src)})</span></div>
          <div><b>Tindakan operator:</b> ${esc(sc.act)}</div>
          ${sc.grp === 'SEKUENS START' ? '<div style="color:#ffd040">Catatan: berlaku saat unit di-start dari STOP (pilih LOAD pada 43S-CS).</div>' : ''}
          <div class="row" style="margin-top:8px"><span class="sb ${act ? 'grn' : 'red'}" data-a="fx:${sc.key}">${act ? '■ CLEAR / HAPUS GANGGUAN' : '▶ TRIGGER / INJECT'}</span>
          <span class="sb" data-a="nav:${sc.unit ? 'l2s' + fsUnit : 'sy'}">Lihat ${sc.unit ? 'SEQ. LOAD TO STOP' : 'SWITCHYARD'}</span><span class="sb" data-a="nav:ann${sc.unit ? fsUnit : 'sy'}">Lihat ANNUNCIATOR</span></div></div>
        <h4>STATUS UNIT ${fsUnit}: ${M.STEP[u.pos]} → ${M.STEP[u.target]} &nbsp; P ${f(u.p.p)} MW &nbsp; n ${f(u.p.speed * 100)} % &nbsp; 52 ${u.p.cb ? 'CLOSE' : 'OPEN'}</h4>
        <div class="lo">${lo}</div><div style="margin:4px 0">${loCause}</div>
        <div class="row"><span class="sb" data-a="cs:${fsUnit}:5">43S-CS LOAD</span><span class="sb" data-a="cs:${fsUnit}:3">43S-CS EXCITATION</span><span class="sb" data-a="cs:${fsUnit}:0">43S-CS STOP</span><span class="sb ${u.fx.manual_5e ? 'red' : ''}" data-a="e5:${fsUnit}">5E</span></div>
        <h4>URUTAN KEJADIAN (TERBARU DI ATAS)</h4><div class="ev">${ev}</div>
      </div></div>`;
  }
  function scrProt() {
    const rows = M.PROT_TABLE.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td class="r">${esc(r[4])}</td><td>${esc(r[5])}</td><td class="s">${esc(r[6])}</td></tr>`).join('');
    const rr = Object.entries(M.RESET_RULE).map(([k, v]) => `<tr><td class="r">${k}</td><td colspan="6">${esc(v)}</td></tr>`).join('');
    return `<div class="h2">PROTECTION SCHEME – LOCKOUT RELAY 86</div>
      <div style="color:#bbb;margin-bottom:8px;line-height:1.5">86-1 EMERGENCY STOP · 86-2 QUICK STOP · 86-4 NO-LOAD &amp; EXCITATION · 86-5 DAMAGE PREVENTIVE STOP (software LCU) · 86-T TRANSFORMER · 86-PC POWER CABLE.<br>Sumber: PROTECTION SCHEME JEZ2K031 (as-built 2006). Output: 52 TRIP = 86-1 / 86-4 / (86-2 AND GV no-load) · 41 TRIP = (86-1 / 86-2) AND 52 OPEN · turbine &amp; I/V quick shutdown = 86-1 / 86-2 · 86-5 = unload lalu stop normal. Nilai setelan bertanda "asumsi" belum ada di dokumen (perlu protection setting list).</div>
      <table class="pt"><tr><th>FUNGSI</th><th>DEVICE / TAG</th><th>SETELAN</th><th>TUNDA</th><th>RELAY</th><th>AKSI</th><th>SUMBER</th></tr>${rows}
      <tr><th colspan="7">SYARAT RESET</th></tr>${rr}</table>`;
  }
  function scrAlm() {
    const rows = P.alarms.list.slice().reverse().slice(0, 200).map((e) => `<div class="${e.state === 'OFF' ? 'off' : e.lvl}"><span>${e.id}</span><span>${fmtT(e.t)}</span><span>${esc(e.tag)}</span><span>${esc(e.text)}</span><span>${e.state}</span></div>`).join('');
    const ev = P.events.slice(-120).reverse().map((e) => `<div class="${e.type}">${fmtT(e.t)} ${esc(e.msg)}</div>`).join('');
    return `<div class="h2">ALARM / EVENT SUMMARY</div><div class="fs"><div class="col"><h4>ALARM (ANNUNCIATOR POINT)</h4><div class="al">${rows || '<div>—</div>'}</div></div>
      <div class="col"><h4>EVENT LOG (SEKUENS, PERINTAH, PROTEKSI)</h4><div class="ev" style="max-height:none">${ev}</div></div></div>`;
  }
  const TS = [['speed', 'SPEED %', '#ffff00', 1], ['pp', 'P % (70MW)', '#ff4040', 1], ['q', 'Q MVar', '#3a7bff', 1], ['gv', 'GV %', '#00ff60', 1], ['vt', 'GEN.V %', '#ff40ff', 1], ['thr', 'THRUST ℃', '#ffa040', 0], ['gp', 'GOV OIL P %', '#4ce0ff', 0]];
  const hist2 = [];
  function scrTrend() {
    if (!$('trend')) return `<div class="tw">${[1, 2, 3].map((n) => `<span class="sbx" data-a="tru:${n}" style="padding:2px 8px;border:1px solid #666;${trendU === n ? 'background:#ffff80;color:#000' : ''}">UNIT ${n}</span>`).join('')}
      ${TS.map((s, i) => `<span data-a="trs:${i}" class="${s[3] ? '' : 'off'}"><i style="background:${s[2]}"></i>${s[1]}</span>`).join('')}</div><canvas id="trend"></canvas>`;
    return null;
  }
  function drawTrend() {
    const c = $('trend'); if (!c) return;
    const dpr = devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const Lm = 40, pw = W - Lm - 10, ph = H - 30, win = 600, tEnd = Math.max(P.t, win), t0 = tEnd - win, yMin = -40, yMax = 150;
    const Y = (v) => 8 + ph - (v - yMin) / (yMax - yMin) * ph;
    g.font = '10px monospace'; g.strokeStyle = '#2a2a2a'; g.fillStyle = '#999';
    for (let v = -40; v <= 150; v += 20) { g.beginPath(); g.moveTo(Lm, Y(v)); g.lineTo(Lm + pw, Y(v)); g.stroke(); g.fillText(v, 4, Y(v) + 3); }
    for (let t = Math.ceil(t0 / 60) * 60; t <= tEnd; t += 60) { const x = Lm + (t - t0) / win * pw; g.beginPath(); g.moveTo(x, 8); g.lineTo(x, 8 + ph); g.stroke(); g.fillText(fmtT(t).slice(3), x - 14, H - 6); }
    TS.forEach(([k, , col, on]) => { if (!on) return; g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath(); let st = false;
      for (const h of hist2) { if (h.t < t0) continue; const v = h.u[trendU - 1][k]; const x = Lm + (h.t - t0) / win * pw; st ? g.lineTo(x, Y(v)) : (g.moveTo(x, Y(v)), st = true); } g.stroke(); });
  }

  /* =========================== RENDER =========================== */
  let lastHTML = '';
  function render() {
    const info = scrInfo(scr);
    if (info.html) {
      const el = $('html');
      if (scr === 'trend') { const h = scrTrend(); if (h) { el.innerHTML = h; } drawTrend(); return; }
      const h = scr === 'fault' ? scrFault() : scr === 'prot' ? scrProt() : scrAlm();
      if (h !== lastHTML) { const st = el.scrollTop; const evs = el.querySelectorAll('.ev,.al'); const sc = [...evs].map((e) => e.scrollTop); el.innerHTML = h; el.scrollTop = st; el.querySelectorAll('.ev,.al').forEach((e, i) => { e.scrollTop = sc[i] || 0; }); lastHTML = h; }
      return;
    }
    lastHTML = '';
    let g = '';
    switch (info.base || scr) {
      case 'main': g = scrMain(); break;
      case 'sy': g = scrSY(); break;
      case 's2l': g = scrS2L(info.n); break;
      case 'l2s': g = scrL2S(info.n); break;
      case 'sc1': g = scrSC1(info.n); break;
      case 'sc2': g = scrSC2(info.n); break;
      case 'ctl': g = scrCtl(info.n); break;
      case 'cap': g = scrCap(info.n); break;
      case 'vib': g = scrVib(info.n); break;
      case 'ai': g = scrAI(info.n); break;
      case 'ovw': g = scrOvw(info.n); break;
      case 'ann': g = scrAnn('U' + info.n, 'UNIT' + info.n); break;
      case 'annsy': g = scrAnn('SY', 'SWITCHYARD'); break;
    }
    $('svg').innerHTML = g;
  }

  /* =========================== ALARM BAR & BUZZER =========================== */
  let actx = null, lastBeep = 0;
  function alarmBar() {
    const un = P.alarms.unacked();
    const rows = un.length ? un : P.alarms.latest(2);
    [0, 1].forEach((i) => {
      const r = $('alm' + i), e = rows[i];
      if (!e) { r.className = 'almrow sunk off'; r.children[0].textContent = ''; r.children[1].textContent = i ? '' : 'NO ACTIVE ALARM'; r.children[2].textContent = ''; return; }
      const ack = P.alarms.pt[e.i].ack;
      r.className = 'almrow sunk ' + (e.state === 'OFF' ? 'off' : ack ? 'ack' : 'unack');
      r.children[0].textContent = e.id; r.children[1].textContent = `${e.tag}  ${e.text}`; r.children[2].textContent = e.state;
    });
    const ring = un.some((e) => !silenced.has(e.id));
    $('bBz').classList.toggle('on', ring);
    if (ring && actx && performance.now() - lastBeep > 1200) {
      lastBeep = performance.now();
      try { const o = actx.createOscillator(), gn = actx.createGain(); const hi = un.some((e) => e.lvl === 'H'); o.frequency.value = hi ? 1000 : 600; o.type = hi ? 'square' : 'triangle'; gn.gain.value = 0.04; o.connect(gn); gn.connect(actx.destination); o.start(); o.stop(actx.currentTime + (hi ? 0.25 : 0.15)); } catch (e) { }
    }
    const trip = P.units.some((u) => u.anyLO()) || P.units.some((u) => u.tr && u.tr.fail);
    $('sOpe').textContent = trip ? 'OPE/TRIP' : 'OPE/normal'; $('sOpe').classList.toggle('trip', trip);
  }
  document.addEventListener('pointerdown', () => { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } }, { once: true });
  $('bBz').addEventListener('click', () => P.alarms.unacked().forEach((e) => silenced.add(e.id)));
  $('bAck').addEventListener('click', () => { P.alarms.ack(); render(); });
  $('bClr').addEventListener('click', () => { P.alarms.reset(false); render(); });

  /* =========================== DIALOG =========================== */
  let dlgOk = null;
  function dialog(titleS, msg, onOk, opt = {}) {
    $('dT').textContent = titleS; $('dM').textContent = msg; $('dX').innerHTML = opt.extra || '';
    dlgOk = onOk;
    $('dOk').classList.toggle('hidden', !onOk); $('dOk').textContent = opt.okText || 'EXECUTE'; $('dCancel').textContent = onOk ? 'CANCEL' : 'CLOSE';
    $('dlg').classList.remove('hidden');
    const inp = $('dX').querySelector('input'); if (inp) setTimeout(() => inp.focus(), 50);
  }
  const closeDlg = () => { $('dlg').classList.add('hidden'); dlgOk = null; };
  $('dOk').addEventListener('click', () => { const fn = dlgOk; closeDlg(); fn && fn(); render(); });
  $('dCancel').addEventListener('click', closeDlg);

  /* =========================== ACTIONS =========================== */
  const SWL = { s43STEP: '43STEP', s43R: '43R', s43CH: '43CH', ALR: '43ALR', JLR: '43JLR', AQR: '43AQR', JQR: '43JQR', USM: '43USM', AQRC: '43AQRC', AVR: '43-90', AFC: '43AFC' };
  function doAct(a) {
    const [k, ...r] = a.split(':');
    switch (k) {
      case 'nav': go(r[0]); return;
      case 'navu': go(r[0] + curU); return;
      case 'tab': { const info = scrInfo(scr); const tabs = TABS[info.grp](info.n || curU).map((t) => t[0]); const i = tabs.indexOf(scr); go(tabs[(i + (+r[0]) + tabs.length) % tabs.length]); return; }
      case 'na': dialog('MESSAGE', 'Layar / fungsi ini belum dimodelkan di simulator.', null); return;
      case 'dlg': closeDlg(); return;
      case 'zoom': if (r[0] === 'in') zoomBy(0.7); else if (r[0] === 'out') zoomBy(1 / 0.7); else if (r[0] === 'fit') fitW(); else setVB(null); return;
      case 'sim': simDialog(); return;
      case 'step': case 'cs': {
        const n = +r[0], s = +r[1], u = U(n);
        if (u.sw.s43STEP === 'LOCAL' && k !== 'cs') { dialog('MESSAGE', `43STEP = LOCAL.\nOperasi step dari OPS diblok (operasi di ULCB).`, null); return; }
        u.select43S(s); render();
        dialog('SEQUENCE SELECT', `UNIT NO.${n}\n43S-CS : ${M.STEP[s]}\n\nOPERATE ?`, () => u.operate43S(s), { okText: 'OPERATE' });
        return;
      }
      case 'sw': {
        const n = +r[0], key = r[1]; let val = r[2]; if (val === 'true') val = true; if (val === 'false') val = false;
        const u = U(n); if (u.sw[key] === val) return;
        if (key === 's43CH' && val === 'USE') { dialog('MESSAGE', 'Mode Line Charging (43CH USE) belum dimodelkan.\nHanya dapat dipilih sebelum start unit.', null); return; }
        if (key === 'JLR' || key === 'JQR') { dialog('MESSAGE', 'Joint control (JLR/JQR, SCH/WLC) belum dimodelkan.', null); return; }
        const lab = typeof val === 'boolean' ? (val ? 'USE' : 'LOCK') : val;
        dialog('SELECT', `UNIT NO.${n}\n${SWL[key] || key} → ${lab}\n\nEXECUTE ?`, () => { u.sw[key] = val; P.log('CMD', `U${n}: ${SWL[key] || key} ${lab}`); });
        return;
      }
      case 'gov': {
        const n = +r[0], u = U(n), mode = r[1];
        if (!u.p.cb || u.p.islanded) { dialog('MESSAGE', 'SPEED CONTROL dipilih otomatis saat 52 OPEN.\nOPENING/POWER hanya saat paralel.', null); return; }
        if (mode === 'SPEED') { dialog('MESSAGE', 'SPEED CONTROL hanya otomatis saat 52 OPEN / line charging.', null); return; }
        dialog('SELECT', `UNIT NO.${n}\nGOV MODE → ${mode} CONTROL\n\nEXECUTE ?`, () => { if (mode === 'OPENING') u.sw.opcSP = Math.round(u.p.gv); u.sw.gov = mode; P.log('CMD', `U${n}: GOV MODE ${mode}`); });
        return;
      }
      case 'sp': {
        const n = +r[0], key = r[1], u = U(n);
        const lab = { alrSP: ['ALR SET POINT', 'MW'], maxP: ['MAX POWER', 'MW'], minP: ['MIN POWER', 'MW'], aqrSP: ['AQR SET POINT', 'MVar'], opcSP: ['OPC SETTING (G/V opening)', '%'] }[key];
        dialog('SET POINT', `UNIT NO.${n}\n${lab[0]}`, () => { const v = parseFloat($('dX').querySelector('input').value); if (!isNaN(v)) { u.sw[key] = v; if (key === 'alrSP') u.sw.alrSP = Math.max(u.sw.minP, Math.min(u.sw.maxP, v)); P.log('CMD', `U${n}: ${lab[0]} = ${v} ${lab[1]}`); } },
          { extra: `<div class="drow"><span class="grow"></span><input type="number" step="0.5" value="${u.sw[key]}"> ${lab[1]}</div>`, okText: 'SET' });
        return;
      }
      case 'rl': {
        const n = +r[0], w = r[1], u = U(n);
        const lab = { 65: '7-65 SPEED/LOAD', 77: '7-77 GUIDE VANE LIMIT', 90: '7-90R/70G VOLTAGE / Q' }[w];
        dialog('RAISE / LOWER', `UNIT NO.${n}\n${lab}`, null, { extra: `<div class="drow"><button data-a="rlx:${n}:${w}:1">▲ RAISE</button><button data-a="rlx:${n}:${w}:-1">▼ LOWER</button></div>` });
        return;
      }
      case 'rlx': { const u = U(+r[0]), d = +r[2]; if (r[1] === '65') u.raise65(d); else if (r[1] === '77') u.raise77(d); else u.raise90(d); render(); return; }
      case 'rst': {
        const n = +r[0], key = r[1], u = U(n);
        if (!u.lo[key]) { dialog('MESSAGE', `${key} tidak operate.`, null); return; }
        dialog('86 RESET', `UNIT NO.${n}\n${key} RESET\nSyarat: ${M.RESET_RULE[key]}\n\nEXECUTE ?`, () => u.reset86(key));
        return;
      }
      case 'e5': {
        const n = +r[0], u = U(n);
        dialog('5E EMERGENCY STOP', `UNIT NO.${n}\n5E ${u.fx.manual_5e ? 'OFF (kembalikan switch)' : 'ON → 86-2 OPERATE'}\n\nEXECUTE ?`, () => P.inject('manual_5e', n));
        return;
      }
      case 'dev': {
        const d = r.join(':'), sy = P.sy, close = !sy.st[d], why = sy.interlock(d, close);
        dialog('SWITCHYARD CONTROL', `${d}\n${sy.st[d] ? 'CLOSE' : 'OPEN'} → ${close ? 'CLOSE' : 'OPEN'}${why ? `\n\nINTERLOCK: ${why}` : ''}\n\n${why ? '' : 'EXECUTE ?'}`, why ? null : () => sy.operate(d, close));
        return;
      }
      case 'win': {
        const [grp, w] = r; const items = P.alarms.activeItems(grp, w);
        dialog(`ANNUNCIATOR ${grp} ${w}`, items.length ? items.map((i) => `${i.on ? '●' : '○'} ${i.tag}  ${i.text}${i.on && !i.ack ? '  (UNACK)' : ''}`).join('\n') : 'Tidak ada titik alarm yang dimodelkan pada jendela ini.', null);
        return;
      }
      case 'annack': P.alarms.ack(r[0]); render(); return;
      case 'annrst': P.alarms.ack(r[0]); P.alarms.reset(false); render(); return;
      case 'fsu': fsUnit = +r[0]; render(); return;
      case 'fsel': selFault = r[0]; render(); return;
      case 'fx': { const sc = M.SCN[r[0]]; P.inject(r[0], fsUnit); if (!sc.unit) { } render(); return; }
      case 'init': if (r[0] === 'op') { P.initOperating(); hist2.length = 0; } else if (r[0] === 'stop') { P.initAllStop(); hist2.length = 0; } else P.clearAllFaults(); silenced.clear(); render(); return;
      case 'tru': trendU = +r[0]; $('html').innerHTML = ''; render(); return;
      case 'trs': TS[+r[0]][3] = TS[+r[0]][3] ? 0 : 1; $('html').innerHTML = ''; render(); return;
    }
  }
  function simDialog() {
    const sp = SPEEDS.map((s) => `<button data-a="spd:${s}" class="${mult === s ? 'on' : ''}">x${s}</button>`).join('');
    dialog('SIMULATOR', `Waktu simulasi ${fmtT(P.t)}\nKecepatan x${mult} ${paused ? '(PAUSE)' : ''}`, null,
      { extra: `<div class="simgrid">${sp}<button data-a="pause" class="${paused ? 'on' : ''}">${paused ? 'RESUME' : 'PAUSE'}</button></div><div class="simgrid"><button data-a="nav:fault">FAULT SIM.</button><button data-a="init:op">INIT OPERASI</button><button data-a="init:stop">INIT STOP</button></div>` });
  }
  // klik ditangani via pointerdown/up: tahan terhadap render ulang 250 ms (elemen diganti di tengah ketukan)
  let pd = null, holdRender = false;
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('[data-a]');
    pd = el ? { a: el.dataset.a, x: e.clientX, y: e.clientY, svg: !!el.closest('#svg'), dlg: !!el.closest('#dlg'), id: e.pointerId } : null;
    holdRender = !!pd;
  });
  document.addEventListener('pointercancel', () => { pd = null; holdRender = false; });
  document.addEventListener('pointerup', (e) => {
    holdRender = false;
    const d = pd; pd = null;
    if (!d || d.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12) return;
    if (d.svg && performance.now() < noClickUntil) return;
    const a = d.a;
    if (a.startsWith('spd:')) { mult = +a.slice(4); $('tbSim').textContent = 'Sim x' + mult; simDialog(); return; }
    if (a === 'pause') { paused = !paused; simDialog(); return; }
    if (d.dlg && (a.startsWith('nav:') || a.startsWith('init:'))) closeDlg();
    doAct(a);
  });

  /* =========================== PAN / ZOOM =========================== */
  const VB0 = { x: 0, y: 0, w: 990, h: 645 }; let vb = null, noClickUntil = 0;
  const svg = $('svg');
  const aspect = () => { const r = svg.getBoundingClientRect(); return r.width > 0 ? r.height / r.width : VB0.h / VB0.w; };
  const full = () => { const a = aspect(), w = Math.max(VB0.w, VB0.h / a); return { x: (VB0.w - w) / 2, y: (VB0.h - w * a) / 2, w, h: w * a }; };
  const cur = () => vb || full();
  function setVB(v, keep) {
    const F = full(), a = aspect();
    if (keep && vb) v = { ...vb };
    if (v) { v.w = Math.max(VB0.w / 5, Math.min(F.w, v.w)); v.h = v.w * a; if (v.w >= F.w - 0.5) v = null; else {
      v.x = v.w >= VB0.w ? (VB0.w - v.w) / 2 : Math.min(VB0.w - v.w, Math.max(0, v.x)); v.y = v.h >= VB0.h ? (VB0.h - v.h) / 2 : Math.min(VB0.h - v.h, Math.max(0, v.y)); } }
    vb = v; const r = vb || F; svg.setAttribute('viewBox', `${r.x.toFixed(1)} ${r.y.toFixed(1)} ${r.w.toFixed(1)} ${r.h.toFixed(1)}`);
    $('zLvl').textContent = Math.round(F.w / r.w * 100) + '%';
  }
  const fitW = () => setVB({ x: 0, y: 0, w: VB0.w });
  function toSvg(cx, cy) { const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy; const m = svg.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 }; }
  function zoomAt(fac, cx, cy) { const c = cur(), p = toSvg(cx, cy), w = c.w * fac; setVB({ x: p.x - (p.x - c.x) * (w / c.w), y: p.y - (p.y - c.y) * (w / c.w), w }); }
  function zoomBy(fac) { const r = svg.getBoundingClientRect(); zoomAt(fac, r.left + r.width / 2, r.top + r.height / 2); }
  svg.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.deltaY > 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY); }, { passive: false });
  let md = null;
  svg.addEventListener('mousedown', (e) => { if (vb) md = { x: e.clientX, y: e.clientY, vb: { ...vb }, mv: false }; });
  addEventListener('mousemove', (e) => { if (!md) return; const dx = e.clientX - md.x, dy = e.clientY - md.y; if (Math.abs(dx) + Math.abs(dy) > 6) md.mv = true; const k = md.vb.w / svg.getBoundingClientRect().width; setVB({ x: md.vb.x - dx * k, y: md.vb.y - dy * k, w: md.vb.w }); });
  addEventListener('mouseup', () => { if (md && md.mv) noClickUntil = performance.now() + 250; md = null; });
  let tg = null, lastTap = 0; const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  svg.addEventListener('touchstart', (e) => { const t = e.touches;
    if (t.length === 2) { tg = { m: 'p', d0: dist(t[0], t[1]), cx: (t[0].clientX + t[1].clientX) / 2, cy: (t[0].clientY + t[1].clientY) / 2, vb: { ...cur() }, mv: true }; e.preventDefault(); }
    else if (t.length === 1) tg = { m: 'd', x: t[0].clientX, y: t[0].clientY, vb: { ...cur() }, mv: false }; }, { passive: false });
  svg.addEventListener('touchmove', (e) => { if (!tg) return; const t = e.touches, rc = svg.getBoundingClientRect();
    if (tg.m === 'p' && t.length === 2) { e.preventDefault(); const d = dist(t[0], t[1]), w = tg.vb.w * tg.d0 / Math.max(d, 1), cx = (t[0].clientX + t[1].clientX) / 2, cy = (t[0].clientY + t[1].clientY) / 2, k0 = tg.vb.w / rc.width, k1 = w / rc.width;
      const sx = tg.vb.x + (tg.cx - rc.left) * k0, sy = tg.vb.y + (tg.cy - rc.top) * k0; setVB({ x: sx - (cx - rc.left) * k1, y: sy - (cy - rc.top) * k1, w }); }
    else if (tg.m === 'd' && t.length === 1) { const dx = t[0].clientX - tg.x, dy = t[0].clientY - tg.y; if (Math.abs(dx) + Math.abs(dy) > 10) tg.mv = true; if (vb && tg.mv) { e.preventDefault(); const k = tg.vb.w / rc.width; setVB({ x: tg.vb.x - dx * k, y: tg.vb.y - dy * k, w: tg.vb.w }); } } }, { passive: false });
  svg.addEventListener('touchend', (e) => { if (!tg) return; if (tg.mv) noClickUntil = performance.now() + 350;
    else if (tg.m === 'd' && !e.target.closest('[data-a]')) { const now = performance.now(), t = e.changedTouches[0]; if (now - lastTap < 320) { vb ? setVB(null) : zoomAt(1 / 2.2, t.clientX, t.clientY); lastTap = 0; noClickUntil = now + 350; } else lastTap = now; }
    if (!e.touches.length) tg = null; });
  let la = 0; addEventListener('resize', () => { const a = aspect(); if (Math.abs(a - la) > 0.01) { la = a; setVB(vb ? { ...vb } : null); } if (scr === 'trend') drawTrend(); });

  /* =========================== LOOP =========================== */
  function fmtT(t) { const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = Math.floor(t % 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }
  let lastRec = -1, htmlTick = 0;
  function loop() {
    if (!paused && !document.hidden) P.tick(0.25 * mult);
    if (P.t - lastRec >= 1) { lastRec = P.t; hist2.push({ t: P.t, u: P.units.map((u) => ({ speed: u.p.speed * 100, pp: u.p.p / 70 * 100, q: u.p.q, gv: u.p.gv, vt: u.p.vt * 100, thr: u.p.T.thrust, gp: u.p.govP * 100 })) }); if (hist2.length > 2000) hist2.splice(0, hist2.length - 2000); }
    $('sSim').textContent = 'SIM ' + fmtT(P.t) + (paused ? ' ❚❚' : ` x${mult}`);
    alarmBar();
    if (holdRender) return;
    const info = scrInfo(scr);
    if (info.html && scr !== 'trend' && (++htmlTick % 4)) return;   // layar teks: 1 Hz
    render();
  }
  setInterval(() => { const d = new Date(); $('sDate').textContent = d.toDateString() + ' ' + d.toTimeString().slice(0, 8); }, 1000);
  window.hmiBack = () => { if (!$('dlg').classList.contains('hidden')) { closeDlg(); return true; } if (vb && vb.w < VB0.w - 1) { fitW(); return true; } if (scr !== 'main') { go('back'); return true; } return false; };
  window.hmiPause = () => { };
  window.__plant = P;
  go('main', false);
  requestAnimationFrame(() => { la = aspect(); if (svg.getBoundingClientRect().height < 420) fitW(); else setVB(null); });
  setInterval(loop, 250);
})();
