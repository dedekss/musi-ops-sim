/* MUSI HEPP – layar tambahan: station service (MCH / powerhouse / overview / control panel), intake & re-regulating dam,
   water level control, turbine actuator, inlet valve hydraulic, analog input, daily power operation.
   Tata letak MAIN CONTROL HOUSE & UNDERGROUND POWERHOUSE mengikuti layar OPS asli (13-Okt-2017). */
(() => {
  'use strict';
  const X = window.HMIX; if (!X) return;
  const { P, M, T, R, L, lamp, mline, b3, vbox, title, backBtn, esc, f, U, dialog, go, EXTS, EXTU, EXTA, TABS, NA_MSG } = X;
  const SS = () => P.ss, DAM = () => P.dam;
  const DEV = M.SS_DEV, REL = M.SS_REL27;

  /* ============================== simbol ============================== */
  const kvOf = (node) => /^(M4|P4|UB|MCC|LG|CF|MISC|DG|SST\dS|UT\dS)/.test(node) ? 0.4 : (/^G\d$/.test(node) || /^UT\dP$/.test(node)) ? 11 : 20;
  const lc = (node) => { const ss = SS(); if (!ss.live[node]) return 'ldd'; const kv = kvOf(node); return kv === 0.4 ? 'l04' : kv === 11 ? 'l11' : 'l20'; };
  const ln = (x1, y1, x2, y2, node, bus) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${lc(node)}${bus ? ' lbus' : ''}"/>`;
  const pl = (pts, node) => `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" class="${lc(node)}"/>`;
  const st = (id) => !!SS().st[id];
  const trp = (id) => !!SS().tripFlag[id];
  function cb(x, y, id, lab, lx = 13, ly = 4) {
    const c = st(id);
    return `<g class="dev ${trp(id) ? 'trip' : ''}" data-a="x:ssd:${id}"><rect x="${x - 9}" y="${y - 9}" width="18" height="18" class="cbsq ${c ? 'devc' : 'devo'}"/>` +
      `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" fill="${c ? '#a00' : '#0a0'}"/><rect x="${x - 14}" y="${y - 14}" width="28" height="28" fill="transparent"/></g>` + (lab === '' ? '' : T(x + lx, y + ly, lab || id, 't'));
  }
  function ds(x, y, id, lab, lx = 13, ly = 4) {
    const c = st(id);
    return `<g class="dev ${trp(id) ? 'trip' : ''}" data-a="x:ssd:${id}"><circle cx="${x}" cy="${y}" r="8" class="${c ? 'devc' : 'devo'}"/>${L(x - 4.5, y - 4.5, x + 4.5, y + 4.5, 'devx')}${L(x + 4.5, y - 4.5, x - 4.5, y + 4.5, 'devx')}` +
      `<rect x="${x - 13}" y="${y - 13}" width="26" height="26" fill="transparent"/></g>` + (lab === '' ? '' : T(x + lx, y + ly, lab || id, 't'));
  }
  const gnd = (x, y) => L(x, y - 7, x, y + 7, 'ln') + L(x + 4, y - 5, x + 4, y + 5, 'ln') + L(x + 8, y - 3, x + 8, y + 3, 'ln');
  const es = (x, y, id) => ds(x, y, id, '') + L(x + 8, y, x + 14, y, 'ln') + gnd(x + 14, y);
  const rly = (cx, cy, id) => `<g class="rly ${SS().rel[id] ? 'on' : ''}" data-a="x:ssr:${id}">${R(cx - 24, cy - 8, 48, 16, '')}${T(cx, cy + 3.5, id, '')}</g>`;
  function xf(x, y, n1, n2, lab, lx = 18) {
    const ss = SS(), c1 = ss.live[n1] ? ({ 20: '#ff8c1a', 11: '#2ec5e8', 0.4: '#ffe14d' })[kvOf(n1)] : '#4a4a4a', c2 = ss.live[n2] ? '#ffe14d' : '#4a4a4a';
    return `<circle cx="${x}" cy="${y}" r="10" fill="none" stroke="${c1}" stroke-width="2"/><path d="M${x - 5},${y + 3} L${x},${y - 5} L${x + 5},${y + 3} Z" fill="none" stroke="${c1}" stroke-width="1.3"/>` +
      `<circle cx="${x}" cy="${y + 19}" r="10" fill="none" stroke="${c2}" stroke-width="2"/><path d="M${x},${y + 19} L${x},${y + 13} M${x},${y + 19} L${x - 5},${y + 23} M${x},${y + 19} L${x + 5},${y + 23}" stroke="${c2}" stroke-width="1.3"/>` +
      (lab ? T(x + lx, y + 3, lab, 't') : '');
  }
  const A = (id) => f(SS().amps(id), 1) + ' A';
  const KW = (id) => f(SS().kw(id), 1) + ' kW';
  const MW = (id) => f(SS().kw(id) / 1000, 2) + ' MW';
  const V = (node) => f(SS().volt(node), 1) + ' V';
  const KV = (node) => f(SS().volt(node), 1) + ' kV';
  const ssBtns = (macro, macroLab, loc) => b3(17, 502, 105, 28, macroLab, '', `x:ssmac:${macro}`) + b3(17, 541, 105, 28, 'FLICKER RESET', '', `x:ssfr:${loc}`) +
    `<g class="nav" data-a="nav:ssc">${R(17, 580, 105, 48)}${mline(69, 606, 'SWITCHYARD/\nSTATION SERVICE\nCONTROL PANEL', '', 10)}</g>`;
  const seqLine = (site) => { const s = SS()[site]; return s ? T(495, 630, `CHANGEOVER FUNCTION: ${s.name} (langkah ${s.i + 1}/${s.steps.length})`, 't tc', 'style="fill:#ffff40"') : ''; };

  /* ============================== MAIN CONTROL HOUSE ============================== */
  function scrMCH() {
    const ss = SS(); let g = title('MAIN CONTROL HOUSE') + backBtn();
    // 20 kV distribution lines
    [['BC', 215, '20kV DISTRIBUTION LINE\nTO BASE CAMP AND CURUP S/S', 'BCLINE', 'BCX', 'M20A'], ['ID', 520, '20kV DISTRIBUTION LINE\nTO INTAKE DAM', 'IDLINE', 'IDX', 'M20B'], ['RD', 825, '20kV DISTRIBUTION LINE\nTO REREGULATING DAM', 'RDLINE', 'RDX', 'M20B']].forEach(([k, x, lab, nl, nx, nb]) => {
      g += mline(x, 45, lab, 't tc', 11);
      g += ln(x, 60, x, 119, nl) + ln(x, 97, x + 39, 97, nl) + es(x + 47, 97, '289DLE-' + k) + T(x + 20, 80, '289DLE-' + k, 't');
      g += ds(x, 127, '289DL-' + k, '289DL-' + k, 18) + ln(x, 135, x, 164, nx) + cb(x, 173, '252DL-' + k, '252DL-' + k, 17) + ln(x, 182, x, 208, nb);
      g += T(x + 30, 147, A('252DL-' + k), 't cy') + T(x + 30, 159, MW('252DL-' + k), 't cy');
    });
    g += rly(180, 151, '27-BC');
    // 20 kV bus
    g += ln(30, 208, 370, 208, 'M20A', 1) + ln(386, 208, 962, 208, 'M20B', 1) + ds(378, 208, '289B', '289B', -8, -14);
    g += T(32, 198, '20kV BUS-A', 't') + T(128, 198, KV('M20A'), 't cy') + T(575, 198, '20kV BUS-B', 't') + T(680, 198, KV('M20B'), 't cy');
    g += rly(313, 191, '27-1M') + rly(782, 191, '27-2M');
    // LS
    g += ln(50, 208, 50, 229, 'M20A') + ds(50, 237, '289-LSA', '289-LSA', 16) + ln(50, 245, 50, 270, 'LSB');
    g += ln(470, 208, 470, 229, 'M20B') + ds(470, 237, '289-LSB', '289-LSB', 16) + ln(470, 245, 470, 270, 'LSB') + ln(50, 270, 470, 270, 'LSB');
    g += ln(50, 270, 50, 306, 'LSB') + cb(50, 315, '252-LS', '252-LS', 15) + ln(50, 324, 50, 412, 'LST20') + T(25, 424, 'FROM LSTr', 't');
    g += T(68, 340, A('252-LS'), 't cy') + T(68, 357, MW('252-LS'), 't cy');
    // cable feeder no.1 (252B-A2)
    g += ln(145, 208, 145, 228, 'M20A') + cb(145, 237, '252B-A2', '252B-A2', 15) + ln(145, 246, 145, 305, 'A2X') + ds(145, 313, '289B-A2', '289B-A2', 15) + ln(145, 321, 145, 412, 'CAB1');
    g += ln(145, 364, 184, 364, 'CAB1') + es(192, 364, '289E-A2') + T(170, 348, '289E-A2', 't') + rly(118, 290, '27-L1M');
    g += T(165, 283, A('252B-A2'), 't cy') + T(165, 296, KW('252B-A2'), 't cy');
    g += mline(150, 432, '20kV POWER SUPPLY\nLINE THROUGH\nCABLE TUNNEL', 't tc', 11);
    // SSTr No.3
    g += ln(285, 208, 285, 228, 'M20A') + cb(285, 237, '252B-A1', '252B-A1', 15) + ln(285, 246, 285, 305, 'SST3P') + xf(285, 315, 'SST3P', 'SST3S', 'SSTr No.3', 18);
    g += T(305, 283, A('252B-A1'), 't cy') + ln(285, 344, 285, 358, 'SST3S') + cb(285, 367, '352-S1', '352-S1', 15) + ln(285, 376, 285, 420, 'M4A');
    g += T(292, 389, A('352-S1'), 't cy') + T(292, 401, KW('352-S1'), 't cy') + T(372, 394, V('M4A'), 't cy') + T(366, 409, '400V BUS-A', 't');
    // SSTr No.4
    g += ln(775, 208, 775, 228, 'M20B') + cb(775, 237, '252B-B1', '252B-B1', 15) + ln(775, 246, 775, 305, 'SST4P') + xf(775, 315, 'SST4P', 'SST4S', 'SSTr No.4', -70);
    g += T(735, 283, A('252B-B1'), 't cy') + ln(775, 344, 775, 358, 'SST4S') + cb(775, 367, '352-S2', '352-S2', 15) + ln(775, 376, 775, 420, 'M4B');
    g += T(782, 389, A('352-S2'), 't cy') + T(782, 401, KW('352-S2'), 't cy') + T(697, 394, V('M4B'), 't cy') + T(672, 409, '400V BUS-B', 't');
    // cable feeder no.2 (252B-B2)
    g += ln(870, 208, 870, 228, 'M20B') + cb(870, 237, '252B-B2', '252B-B2', 15) + ln(870, 246, 870, 305, 'B2X') + ds(870, 313, '289B-B2', '289B-B2', 15) + ln(870, 321, 870, 412, 'CAB2');
    g += ln(870, 364, 911, 364, 'CAB2') + es(919, 364, '289E-B2') + T(897, 348, '289E-B2', 't') + rly(845, 290, '27-L2M');
    g += T(895, 283, A('252B-B2'), 't cy') + T(895, 296, KW('252B-B2'), 't cy');
    g += mline(880, 432, '20kV POWER SUPPLY\nLINE THROUGH\nCABLE TUNNEL', 't tc', 11);
    // 400 V bus A / C / B
    g += ln(262, 420, 463, 420, 'M4A', 1) + cb(472, 420, '352-BT2', '352-BT2', -20, -16) + ln(481, 420, 581, 420, 'M4C', 1) + cb(590, 420, '352-BT3', '352-BT3', -20, -16) + ln(599, 420, 800, 420, 'M4B', 1);
    g += T(505, 411, '400V BUS-C', 't') + rly(361, 432, '27-3M') + rly(712, 432, '27-4M');
    // feeder 400 V
    [['352B-A3', 308, 'M4A'], ['352B-A4', 401, 'M4A'], ['352B-C1', 530, 'M4C'], ['352B-B3', 660, 'M4B'], ['352B-B4', 752, 'M4B']].forEach(([id, x, nb]) => {
      g += ln(x, 420, x, 443, nb) + cb(x, 452, id, id, 13) + (id !== '352B-C1' ? T(x + 18, 474, A(id), 't cy') : '');
    });
    // kelompok beban 1 (A3/B3) & 2 (A4/B4)
    g += ln(308, 461, 308, 617, 'LG1') + pl([[660, 461], [660, 505], [316, 505]], 'LG1');
    g += ln(752, 461, 752, 617, 'LG2') + pl([[401, 461], [401, 492], [744, 492]], 'LG2');
    ['150kV SWITCHYARD CB', '150kV SWITCHYARD DS', 'AIR VENT. FOR CABLE TUNNEL', 'LSTr', 'AC PANEL-1', 'BATTERY CHARGER(A)'].forEach((s, i) => { const y = 523 + i * 19; g += ln(308, y, 320, y, 'LG1') + T(327, y + 4, s, 't'); });
    ['DIST. PANEL(P1)', 'DIST. PANEL L1', 'DIST. PANEL L2', 'SPACE HEATER SWITCHYARD EQIP.', 'SPACE HEATER SWITCHYARD EQIP.', 'BATTERY CHARGER(B)'].forEach((s, i) => { const y = 523 + i * 19; g += ln(752, y, 764, y, 'LG2') + T(770, y + 4, s, 't'); });
    // diesel generator
    const dg = ss.dg;
    g += ln(530, 461, 530, 534, 'DGX') + cb(530, 543, '52DG', '52DG', 15) + ln(530, 552, 530, 597, 'DG');
    g += `<g data-a="x:ssdgd"><circle cx="530" cy="615" r="17" fill="${dg.run ? '#ff2020' : '#18e018'}" stroke="#fff" stroke-width="1.2"/>${T(530, 619, 'DG', 't tc', 'style="fill:#000;font-size:11px"')}</g>`;
    g += T(566, 565, `${f(dg.v)}  V`, 't cy') + T(566, 578, `${f(ss.amps('52DG'))}  A`, 't cy') + T(566, 591, `${f(dg.kw)}  kW`, 't cy') + T(566, 604, `${f(dg.f)}  Hz`, 't cy');
    g += ssBtns('mchopen', 'MAIN CONTROL\nHOUSE CB OPEN', 'MCH') + seqLine('seqM');
    return g;
  }

  /* ============================== UNDERGROUND POWERHOUSE ============================== */
  function scrUPH() {
    const ss = SS(); let g = title('UNDERGROUND POWERHOUSE') + backBtn();
    const ux = { 3: 89, 2: 283, 1: 476 };
    [3, 2, 1].forEach((n, idx) => {
      const x = ux[n];
      g += T(x, 69, `FROM NO.${n} GENERATOR`, 't tc');
      g += ln(x, 84, x, 107, 'G' + n) + ds(x, 115, '89H-' + n, '89H-' + n, 18) + ln(x, 123, x, 183, `UT${n}P`);
      g += xf(x, 193, `UT${n}P`, `UT${n}S`, '') + T(x + 20, 198, `USTr No.${n}`, 't') + T(x + 20, 215, `WDG  ${f(ss.ustT[n])} ℃`, 't cy');
      g += ln(x, 222, x, 255, `UT${n}S`) + cb(x, 264, '452-' + n, '452-' + n, 15) + ln(x, 273, x, 355, 'UB' + n);
      g += ln(x - 64, 355, x + 108, 355, 'UB' + n, 1) + mline(x - 64, 338, `400V BUS\nUNIT NO.${n}`, 't', 11);
      g += T(x + 64, 322, `${f(ss.nodeKW['UB' + n] || 0, 1)}  kW`, 't cy') + T(x + 64, 334, `${f(ss.nodeAmps('UB' + n), 1)}  A`, 't cy') + T(x + 64, 346, V('UB' + n), 't cy');
      // feeder unit: n4 (MCCnB), n3 (MCCnA), n2 (bus B), n1 (bus A)
      [[`352-${n}4`, x - 47, `MCC${n}B`], [`352-${n}3`, x + 7, `MCC${n}A`], [`352-${n}2`, x + 51], [`352-${n}1`, x + 93]].forEach(([id, fx, mcc]) => {
        g += ln(fx, 355, fx, 372, 'UB' + n) + cb(fx, 381, id, '') + mline(fx + 14, 405, `352\n-${id.slice(4)}`, 't', 11);
        if (mcc) { g += ln(fx, 390, fx, 426, mcc) + R(fx - 18, 426, 36, 22, 'box') + T(fx, 441, mcc, 't tc') + T(fx, 464, `${f(ss.nodeAmps(mcc), 1)}  A`, 't tc cy'); }
      });
      // 352-n1 → 400V BUS-A, 352-n2 → 400V BUS-B
      const ya = 532 + idx * 13, yb = 575 + idx * 13, rxa = 603 + (2 - idx) * 6, rxb = 977 - (2 - idx) * 6;
      const n1live = st(`352-${n}1`) ? 'P4A' : 'UB' + n, n2live = st(`352-${n}2`) ? 'P4B' : 'UB' + n;
      g += pl([[x + 93, 390], [x + 93, ya], [rxa, ya], [rxa, 356]], ss.live.P4A && st(`352-${n}1`) ? 'P4A' : (ss.live['UB' + n] && st(`352-${n}1`) ? 'UB' + n : '__'));
      g += pl([[x + 51, 390], [x + 51, yb], [rxb, yb], [rxb, 356]], ss.live.P4B && st(`352-${n}2`) ? 'P4B' : (ss.live['UB' + n] && st(`352-${n}2`) ? 'UB' + n : '__'));
      void n1live; void n2live;
    });
    // SSTr No.1 / No.2
    [[1, 672, 'CAB1', 'PL1', 'SST1P', 'SST1S', 'P4A'], [2, 878, 'CAB2', 'PL2', 'SST2P', 'SST2S', 'P4B']].forEach(([k, x, cab, plN, pp, ps, bus]) => {
      g += mline(x, 52, '20kV POWER SUPPLY LINE\nTO MAIN CONTROL HOUSE\nTHROUGH CABLE TUNNEL', 't tc', 11);
      g += ln(x, 78, x, 89, cab) + ds(x, 97, `289L-${k}`, `289L-${k}`, 16) + ln(x, 105, x, 128, plN) + rly(x + 35, 115, `27-L${k}U`) + cb(x, 137, `252-L${k}`, `252-L${k}`, 16);
      g += ln(x, 146, x, 183, pp) + xf(x, 193, pp, ps, '') + T(x + 18, 196, `SSTr No.${k}`, 't');
      g += T(x + 20, 211, KW(`252-L${k}`), 't cy') + T(x + 20, 222, A(`252-L${k}`), 't cy') + T(x + 20, 233, KV(pp), 't cy');
      g += ln(x, 222, x, 255, ps) + cb(x, 264, `352-L${k}`, `352-L${k}`, 16) + ln(x, 273, x, 356, bus);
      g += T(x + 16, 324, KW(`352-L${k}`), 't cy') + T(x + 16, 335, A(`352-L${k}`), 't cy') + T(x + 16, 346, V(bus), 't cy');
    });
    g += ln(597, 356, 766, 356, 'P4A', 1) + cb(775, 356, '352-BT1', '352-BT1', -18, -16) + ln(784, 356, 985, 356, 'P4B', 1);
    g += T(605, 343, '400V BUS-A', 't') + T(812, 343, '400V BUS-B', 't') + rly(630, 300, '27-1U') + rly(838, 300, '27-2U');
    // feeder common
    [['352B-A1', 656, 'P4A'], ['352B-A2', 736, 'P4A'], ['352B-B1', 815, 'P4B'], ['352B-B2', 893, 'P4B']].forEach(([id, x, b]) => {
      g += ln(x, 356, x, 370, b) + cb(x, 379, id, '') + mline(x + 14, 375, `352B\n-${id.slice(5)}`, 't', 10) + T(x + 22, 402, A(id), 't cy');
    });
    g += pl([[656, 388], [656, 420], [815, 420], [815, 388]], 'CF1') + ln(656, 420, 656, 449, 'CF1') + cb(656, 458, '352-4', '352-4', 15) + T(680, 480, A('352-4'), 't cy');
    g += ln(656, 467, 656, 497, 'MCCCOM') + R(633, 497, 46, 28, 'box') + mline(656, 513, 'MCC\nCOMMON', 't tc', 10);
    g += pl([[736, 388], [736, 431], [893, 431], [893, 388]], 'MISC') + ln(893, 431, 893, 497, 'MISC') + R(850, 497, 88, 28, 'box') + mline(894, 513, 'MISCELLANEOUS\nSUPPLY', 't tc', 10);
    g += ssBtns('phnormal', 'POWER SUPPLY\nTO POWERHOUSE', 'PH') + seqLine('seqP');
    return g;
  }

  /* ============================== simbol tambahan (layar sistem) ============================== */
  const PC = () => P.pc, AIR = () => P.air, RAIN = () => P.rain;
  const C = { red: '#ff2020', grn: '#18e018', wht: '#e8e8e8', cy: '#4ce0ff', yel: '#ffff40', org: '#ff9a2a', brn: '#8a3a10' };
  // lamp status ala OPS: hijau penuh = normal/ON, lingkaran kosong = OFF, merah = alarm
  const lampS = (x, y, s) => s === 'alm' ? `<circle cx="${x}" cy="${y}" r="5" fill="${C.red}" stroke="#000"/>` : s ? `<circle cx="${x}" cy="${y}" r="5" fill="${C.grn}" stroke="#000"/>` : `<circle cx="${x}" cy="${y}" r="4.5" fill="none" stroke="${C.red}" stroke-width="1.2"/>`;
  const lampBox = (x, y, w, rows) => R(x, y, w, rows.length * 16 + 6, 'box') + rows.map(([lab, s], i) => lampS(x + 12, y + 11 + i * 16, s) + T(x + 24, y + 15 + i * 16, lab, 't')).join('');
  // valve manual (bowtie) – horisontal / vertikal
  const vlv = (x, y, v = false, col = 'none', sk = C.wht) => v ? `<path d="M${x - 5},${y - 6} L${x + 5},${y - 6} L${x - 5},${y + 6} L${x + 5},${y + 6} Z" fill="${col}" stroke="${sk}" stroke-width="1"/>` :
    `<path d="M${x - 6},${y - 5} L${x - 6},${y + 5} L${x + 6},${y - 5} L${x + 6},${y + 5} Z" fill="${col}" stroke="${sk}" stroke-width="1"/>`;
  // solenoid valve: merah = energize, putih = de-energize; hijau = posisi AUTO/terbuka khusus
  const sol = (x, y, on, v = false, col) => { const c = col || (on ? C.red : 'none'), s = col || (on ? C.red : C.wht); return vlv(x, y, v, c, s) + L(x, y, x, y - 13, 'ln') + `<circle cx="${x}" cy="${y - 18}" r="5" fill="${on ? C.red : 'none'}" stroke="${s}"/>` + T(x, y - 15, 'S', 'ts tc', 'style="font-size:7px"'); };
  const pump = (x, y, run, lab, col) => { const c = col || (run ? C.red : C.grn); return `<circle cx="${x}" cy="${y}" r="9" fill="none" stroke="${c}" stroke-width="2"/><path d="M${x},${y + 6} L${x},${y - 5} M${x - 4},${y - 1} L${x},${y - 6} L${x + 4},${y - 1}" stroke="${c}" stroke-width="2" fill="none"/>` + (lab ? T(x - 14, y + 4, lab, 't tr') : ''); };
  const filt = (x, y) => `<circle cx="${x}" cy="${y}" r="8" fill="none" stroke="${C.wht}"/><path d="M${x - 3},${y - 6} L${x - 3},${y + 6} M${x + 3},${y - 6} L${x + 3},${y + 6} M${x - 3},${y - 4} L${x + 3},${y + 4}" stroke="${C.wht}"/>`;
  const relief = (x, y) => L(x, y, x, y - 10, 'ln') + `<path d="M${x - 4},${y - 10} L${x + 4},${y - 10} L${x},${y - 17} Z" fill="none" stroke="${C.wht}"/>` + L(x + 3, y - 18, x + 9, y - 24, 'ln');
  const ptank = (x, y, w, h, lab) => `<path d="M${x},${y + 8} Q${x},${y} ${x + w / 2},${y} Q${x + w},${y} ${x + w},${y + 8} L${x + w},${y + h - 8} Q${x + w},${y + h} ${x + w / 2},${y + h} Q${x},${y + h} ${x},${y + h - 8} Z" fill="#000" stroke="${C.wht}"/>` + (lab ? mline(x + w / 2, y + h / 2 + 3, lab, 't tc', 10) : '');
  const arrowR = (x, y) => `<path d="M${x - 6},${y - 4} L${x},${y} L${x - 6},${y + 4}" fill="none" stroke="${C.wht}"/>`;
  const navRow = (items, cur) => items.map(([lab, act], i) => `<g class="nav ${act && act.slice(4) === cur ? 'cur' : ''}" ${act ? `data-a="${act}"` : ''}>${R(14 + i * 104, 583, 100, 52)}${mline(64 + i * 104, 612, lab, '', 10)}</g>`).join('');
  const unitMW = (x = 748, y = 583) => { let g = R(x, y, 236, 52, 'box') + L(x, y + 22, x + 236, y + 22, 'ln') + L(x + 40, y, x + 40, y + 52, 'ln');
    [1, 2, 3].forEach((n, i) => { const xx = x + 40 + i * 65.3; g += L(xx, y, xx, y + 52, 'ln') + T(xx + 33, y + 15, `UNIT#${n}`, 't tc') + T(xx + 58, y + 41, f(U(n).p.cb ? U(n).p.p : 0), 't tr'); });
    return g + T(x + 20, y + 41, 'MW', 't tc'); };
  const clk = () => { const s = PC().tod(); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}`; };

  /* ============================== S/S OVERVIEW (layar 00005) ============================== */
  const syS = (id) => !!P.sy.st[id];
  const l150 = (on) => on ? 'l150' : 'ldd';
  const dsY = (x, y, id) => { const c = syS(id); return `<g class="dev" data-a="dev:${id}"><circle cx="${x}" cy="${y}" r="7" class="${c ? 'devc' : 'devo'}"/>${L(x - 4, y - 4, x + 4, y + 4, 'devx')}${L(x + 4, y - 4, x - 4, y + 4, 'devx')}<rect x="${x - 12}" y="${y - 12}" width="24" height="24" fill="transparent"/></g>`; };
  const cbY = (x, y, id) => { const c = syS(id); return `<g class="dev" data-a="dev:${id}"><rect x="${x - 7}" y="${y - 7}" width="14" height="14" class="cbsq ${c ? 'devc' : 'devo'}"/><rect x="${x - 12}" y="${y - 12}" width="24" height="24" fill="transparent"/></g>`; };
  const cbU = (x, y, on, act) => `<g ${act ? `data-a="${act}"` : ''}><rect x="${x - 7}" y="${y - 7}" width="14" height="14" class="cbsq ${on ? 'devc' : 'devo'}"/></g>`;
  const dsU = (x, y, on) => `<circle cx="${x}" cy="${y}" r="7" class="${on ? 'devc' : 'devo'}"/>${L(x - 4, y - 4, x + 4, y + 4, 'devx')}${L(x + 4, y - 4, x - 4, y + 4, 'devx')}`;
  function xfc(x, y, c1, c2, r = 9) {   // trafo 2 belitan dengan warna tegangan
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c1}" stroke-width="2"/><path d="M${x - 4},${y + 3} L${x},${y - 4} L${x + 4},${y + 3} Z" fill="none" stroke="${c1}"/>` +
      `<circle cx="${x}" cy="${y + 2 * r - 2}" r="${r}" fill="none" stroke="${c2}" stroke-width="2"/><path d="M${x},${y + 2 * r - 2} l0,-5 M${x},${y + 2 * r - 2} l-4,4 M${x},${y + 2 * r - 2} l4,4" stroke="${c2}"/>`;
  }
  function scrSSO() {
    const ss = SS(), sy = P.sy, lv = sy.busLive(); let g = title('STATION SERVICE OVERVIEW') + backBtn();
    const K = { 150: '#ff2020', 11: '#2ec5e8', 20: '#ff8c1a', 4: '#ffe14d', d: '#4a4a4a' };
    g += `<rect x="8" y="32" width="475" height="366" class="boxd"/><rect x="483" y="32" width="464" height="580" class="boxd" style="stroke-dasharray:2 3"/>`;
    // bus 150 kV A / B
    g += `<line x1="12" y1="37" x2="468" y2="37" class="${l150(lv.A)} lbus"/><line x1="12" y1="47" x2="468" y2="47" class="${l150(lv.B)} lbus"/>`;
    const bays = [[3, 48], [2, 174], [1, 300]];
    for (const [n, x] of bays) {
      const u = U(n), xa = x - 28, xb = x + 27, hv = syS(`152-U${n}`) && ((syS(`189-U${n}A`) && lv.A) || (syS(`189-U${n}B`) && lv.B));
      const gen = u.p.vt > 0.3, lvOn = hv || (gen && u.p.cb), cH = hv ? K[150] : K.d, cL = lvOn ? K[11] : K.d;
      g += `<line x1="${xa}" y1="37" x2="${xa}" y2="70" class="${l150(syS(`189-U${n}A`) && lv.A)}"/><line x1="${xb}" y1="47" x2="${xb}" y2="70" class="${l150(syS(`189-U${n}B`) && lv.B)}"/>`;
      g += dsY(xa, 77, `189-U${n}A`) + dsY(xb, 77, `189-U${n}B`) + mline(xa + 12, 75, `189\n-U${n}A`, 't', 10) + mline(xb + 12, 75, `189\n-U${n}B`, 't', 10);
      g += `<polyline points="${xa},84 ${xa},100 ${xb},100 ${xb},84" class="${l150(hv)}"/><line x1="${x}" y1="100" x2="${x}" y2="181" class="${l150(hv)}"/>`;
      g += cbY(x, 188, `152-U${n}`) + mline(x + 24, 188, `152\n-U${n}`, 't', 10) + `<line x1="${x}" y1="195" x2="${x}" y2="211" class="${l150(hv)}"/>`;
      g += xfc(x, 220, cH, cL) + mline(x + 26, 228, `M.Tr\nNo.${n}`, 't', 10);
      g += `<line x1="${x}" y1="245" x2="${x}" y2="282" stroke="${cL}" stroke-width="2"/><polyline points="${x},266 ${xb + 26},266 ${xb + 26},282" fill="none" stroke="${cL}" stroke-width="2"/>`;
      g += dsU(x, 289, true) + T(x + 10, 293, `89-${n}`, 't') + dsU(xb + 26, 289, ss.st['89H-' + n]) + T(xb + 36, 293, `89H-${n}`, 't');
      g += `<line x1="${x}" y1="296" x2="${x}" y2="310" stroke="${gen && u.p.cb ? K[11] : cL}" stroke-width="2"/>` + cbU(x, 317, u.p.cb, `navu:ctl`.replace('navu:ctl', `nav:ctl${n}`)) + T(x + 12, 321, `52-${n}`, 't');
      g += `<line x1="${x}" y1="324" x2="${x}" y2="340" stroke="${gen ? K[11] : K.d}" stroke-width="2"/><g data-a="nav:ctl${n}"><circle cx="${x}" cy="357" r="15" fill="none" stroke="${gen ? C.red : C.grn}" stroke-width="2"/>${mline(x, 357, `No.${n}\nGS`, 'ts tc', 9).replace(/class="ts tc"/g, `class="ts tc" style="fill:${gen ? C.red : C.grn}"`)}</g>`;
      const ux = xb + 26, ub = ss.live['UT' + n + 'S'];
      g += `<line x1="${ux}" y1="296" x2="${ux}" y2="338" stroke="${ss.live['UT' + n + 'P'] ? K[11] : K.d}" stroke-width="2"/>` + xfc(ux, 347, ss.live['UT' + n + 'P'] ? K[11] : K.d, ub ? K[4] : K.d) + mline(ux + 22, 355, `USTr\nNo.${n}`, 't', 10);
      g += `<line x1="${ux}" y1="372" x2="${ux}" y2="405" class="${lc('UT' + n + 'S')}"/>` + cb(ux, 412, '452-' + n, '452-' + n, 14, 4) + `<line x1="${ux}" y1="420" x2="${ux}" y2="442" class="${lc('UB' + n)}"/>`;
    }
    // LSTr bay
    const lstHv = syS('152-LST') && ((syS('189-LSTA') && lv.A) || (syS('189-LSTB') && lv.B));
    g += `<line x1="380" y1="37" x2="380" y2="70" class="${l150(syS('189-LSTA') && lv.A)}"/><line x1="433" y1="47" x2="433" y2="70" class="${l150(syS('189-LSTB') && lv.B)}"/>`;
    g += dsY(380, 77, '189-LSTA') + dsY(433, 77, '189-LSTB') + mline(392, 75, '189\n-LSTA', 't', 10) + mline(445, 75, '189\n-LSTB', 't', 10);
    g += `<polyline points="380,84 380,100 433,100 433,84" class="${l150(lstHv)}"/><line x1="406" y1="100" x2="406" y2="181" class="${l150(lstHv)}"/>` + cbY(406, 188, '152-LST') + mline(430, 188, '152\n-LST', 't', 10);
    g += `<line x1="406" y1="195" x2="406" y2="216" class="${l150(lstHv)}"/><circle cx="406" cy="225" r="9" fill="none" stroke="${lstHv ? K[150] : K.d}" stroke-width="2"/><circle cx="406" cy="241" r="9" fill="none" stroke="${ss.live.LST20 ? K[20] : K.d}" stroke-width="2"/><circle cx="424" cy="233" r="9" fill="none" stroke="${ss.live.LST20 ? K[20] : K.d}" stroke-width="2"/>` + T(440, 237, 'LSTr', 't');
    g += `<polyline points="406,250 406,265 493,265 493,195" class="${lc('LST20')}"/>`;
    // ---------------- MCH ----------------
    g += ln(568, 32, 568, 50, 'BCLINE') + ds(568, 57, '289DL-BC', '289DL-BC', 12, 4) + ln(568, 64, 568, 77, 'BCX') + cb(568, 84, '252DL-BC', '252DL-BC', 12, 4) + ln(568, 91, 568, 105, 'M20A');
    g += ln(706, 32, 706, 50, 'IDLINE') + ds(706, 57, '289DL-ID', '289DL-ID', 12, 4) + ln(706, 64, 706, 77, 'IDX') + cb(706, 84, '252DL-ID', '252DL-ID', 12, 4) + ln(706, 91, 706, 105, 'M20B');
    g += ln(877, 32, 877, 50, 'RDLINE') + ds(877, 57, '289DL-RD', '289DL-RD', 12, 4) + ln(877, 64, 877, 77, 'RDX') + cb(877, 84, '252DL-RD', '252DL-RD', 12, 4) + ln(877, 91, 877, 105, 'M20B');
    g += rly(525, 65, '27-BC') + rly(525, 90, '27-1M') + rly(836, 90, '27-2M');
    g += ln(488, 105, 666, 105, 'M20A', 1) + ln(682, 105, 932, 105, 'M20B', 1) + ds(674, 105, '289B', '289B', -12, -10);
    g += ln(493, 105, 493, 116, 'M20A') + ds(493, 123, '289-LSA', '', 0) + mline(505, 127, '289\n-LSA', 't', 10) + ln(493, 130, 493, 181, 'LSB') + cb(493, 188, '252-LS', '252-LS', 11, 4) + ln(493, 195, 493, 265, 'LST20');
    g += ln(716, 105, 716, 116, 'M20B') + ds(716, 123, '289-LSB', '', 0) + mline(730, 127, '289\n-LSB', 't', 10) + `<polyline points="716,130 716,150 493,150" class="${lc('LSB')}"/>`;
    g += ln(548, 105, 548, 121, 'M20A') + cb(548, 128, '252B-A2', '', 0) + mline(570, 126, '252B\n-A2', 't', 10) + ln(548, 135, 548, 178, 'A2X') + ds(548, 185, '289B-A2', '', 0) + mline(570, 186, '289B\n-A2', 't', 10) + rly(577, 160, '27-L1M');
    g += ln(548, 192, 548, 281, 'CAB1');
    g += ln(603, 105, 603, 121, 'M20A') + cb(603, 128, '252B-A1', '', 0) + mline(625, 126, '252B\n-A1', 't', 10) + ln(603, 135, 603, 174, 'SST3P') + xf(603, 183, 'SST3P', 'SST3S', '') + mline(628, 194, 'SSTr\nNo.3', 't', 10) + ln(603, 212, 603, 225, 'SST3S') + cb(603, 232, '352-S1', '352-S1', 11, 4) + ln(603, 239, 603, 266, 'M4A');
    g += ln(847, 105, 847, 121, 'M20B') + cb(847, 128, '252B-B1', '', 0) + mline(822, 126, '252B\n-B1', 't tr', 10) + ln(847, 135, 847, 174, 'SST4P') + xf(847, 183, 'SST4P', 'SST4S', '') + mline(822, 194, 'SSTr\nNo.4', 't tr', 10) + ln(847, 212, 847, 225, 'SST4S') + cb(847, 232, '352-S2', '', 0) + T(822, 236, '352-S2', 't tr') + ln(847, 239, 847, 266, 'M4B');
    g += ln(921, 105, 921, 121, 'M20B') + cb(921, 128, '252B-B2', '', 0) + mline(898, 126, '252B\n-B2', 't tr', 10) + ln(921, 135, 921, 178, 'B2X') + ds(921, 185, '289B-B2', '', 0) + mline(898, 186, '289B\n-B2', 't tr', 10) + rly(890, 160, '27-L2M') + ln(921, 192, 921, 281, 'CAB2');
    g += `<rect x="570" y="275" width="292" height="122" class="boxd"/>`;
    g += ln(605, 266, 684, 266, 'M4A', 1) + cb(691, 266, '352-BT2', '', 0) + T(691, 255, '352-BT2', 't tc') + ln(698, 266, 755, 266, 'M4C', 1) + cb(762, 266, '352-BT3', '', 0) + T(762, 255, '352-BT3', 't tc') + ln(769, 266, 848, 266, 'M4B', 1);
    g += rly(637, 252, '27-3M') + rly(812, 252, '27-4M');
    [['352B-A3', 604, 'M4A'], ['352B-A4', 659, 'M4A'], ['352B-C1', 725, 'M4C'], ['352B-B3', 792, 'M4B'], ['352B-B4', 848, 'M4B']].forEach(([id, x, b]) => { g += ln(x, 266, x, 280, b) + cb(x, 287, id, '', 0) + mline(x + 10, 302, `352B\n-${id.slice(5)}`, 't', 10); });
    g += pl([[604, 294], [604, 312], [792, 312], [792, 294]], 'LG1') + pl([[659, 294], [659, 318], [848, 318], [848, 294]], 'LG2');
    g += ln(725, 294, 725, 335, 'DGX') + cb(725, 342, '52DG', '52DG', 11, 4) + ln(725, 349, 725, 360, 'DG') + `<g data-a="x:ssdgd"><circle cx="725" cy="375" r="14" fill="none" stroke="${ss.dg.run ? C.red : C.grn}" stroke-width="2"/>${T(725, 379, 'DG', 'ts tc', `style="fill:${ss.dg.run ? C.red : C.grn}"`)}</g>`;
    // ---------------- POWERHOUSE ----------------
    g += `<rect x="485" y="270" width="80" height="0"/>`;
    g += ds(548, 288, '289L-1', '289L-1', 12, 4) + ln(548, 295, 548, 318, 'PL1') + rly(511, 308, '27-L1U') + cb(548, 325, '252-L1', '252-L1', -50, 4) + ln(548, 332, 548, 338, 'SST1P') + xf(548, 343, 'SST1P', 'SST1S', '') + mline(524, 350, 'SSTr\nNo.1', 't tr', 10) + ln(548, 372, 548, 405, 'SST1S') + cb(548, 412, '352-L1', '', 0) + T(535, 416, '352-L1', 't tr') + ln(548, 419, 548, 442, 'P4A');
    g += ds(921, 288, '289L-2', '289L-2', -50, 4) + ln(921, 295, 921, 318, 'PL2') + rly(888, 308, '27-L2U') + cb(921, 325, '252-L2', '252-L2', -50, 4) + ln(921, 332, 921, 338, 'SST2P') + xf(921, 343, 'SST2P', 'SST2S', '') + mline(897, 350, 'SSTr\nNo.2', 't tr', 10) + ln(921, 372, 921, 405, 'SST2S') + cb(921, 412, '352-L2', '', 0) + T(908, 416, '352-L2', 't tr') + ln(921, 419, 921, 442, 'P4B');
    g += `<rect x="862" y="270" width="85" height="128" class="boxd"/>`;
    g += ln(540, 442, 721, 442, 'P4A', 1) + cb(728, 442, '352-BT1', '', 0) + T(728, 462, '352-BT1', 't tc') + ln(735, 442, 940, 442, 'P4B', 1) + rly(588, 430, '27-1U') + rly(885, 430, '27-2U');
    g += b3(632, 409, 192, 17, 'POWER SUPPLY TO POWERHOUSE', '', 'x:ssmac:phnormal');
    [['352B-A1', 630, 'P4A'], ['352B-A2', 689, 'P4A'], ['352B-B1', 766, 'P4B'], ['352B-B2', 822, 'P4B']].forEach(([id, x, b]) => { g += ln(x, 442, x, 465, b) + cb(x, 472, id, '', 0) + T(x + 12, 492, id, 't'); });
    g += pl([[630, 479], [630, 498], [766, 498], [766, 479]], 'CF1') + ln(630, 498, 630, 528, 'CF1') + cb(630, 535, '352-4', '352-4', 12, 4);
    g += pl([[689, 479], [689, 505], [822, 505], [822, 479]], 'MISC');
    // unit 400 V
    const ub = { 3: [52, 155, [57, 88, 120, 152]], 2: [180, 283, [186, 215, 248, 280]], 1: [305, 410, [310, 341, 372, 404]] };
    for (const n of [3, 2, 1]) {
      const [x1, x2, fx] = ub[n];
      g += ln(x1, 442, x2, 442, 'UB' + n, 1);
      [`352-${n}4`, `352-${n}3`, `352-${n}2`, `352-${n}1`].forEach((id, i) => { const x = fx[i]; g += ln(x, 442, x, 466, 'UB' + n) + cb(x, 473, id, '', 0) + mline(x + 12, 495, `352\n-${id.slice(4)}`, 't', 10); });
      const i = 3 - n, ya = 530 + i * 12, yb = 548 + i * 12;
      g += pl([[fx[3], 480], [fx[3], ya], [575 + i * 6, ya], [575 + i * 6, 443]], st(`352-${n}1`) && (ss.live.P4A || ss.live['UB' + n]) ? 'P4A' : '__');
      g += pl([[fx[2], 480], [fx[2], yb], [885 + i * 6, yb], [885 + i * 6, 443]], st(`352-${n}2`) && (ss.live.P4B || ss.live['UB' + n]) ? 'P4B' : '__');
    }
    g += b3(12, 568, 100, 24, 'FLICKER RESET', '', 'x:ssfr:');
    return g;
  }

  /* ============================== SWITCHYARD / STATION SERVICE CONTROL PANEL (layar 00027) ============================== */
  function scrSSC() {
    const pc = PC(), sy = P.sy, s = pc.sel; let g = title('SWITCHYARD / STATION SERVICE CONTROL PANEL') + backBtn();
    const pair = (x, y, w, a, b, cur, act, h = 25) => b3(x, y, w, h, a[0], cur === a[1] ? 'yel' : '', `${act}:${a[1]}`) + b3(x + w, y, w, h, b[0], cur === b[1] ? 'yel' : '', `${act}:${b[1]}`);
    // ---- switchyard control ----
    g += R(18, 32, 925, 111, 'box') + R(364, 25, 225, 16, 'box') + T(476, 37, 'SWITCHYARD CONTROL', 't tc');
    g += T(98, 62, '143STEP', 't tc') + pair(37, 71, 62, ['LOCAL', 'LOCAL'], ['REMOTE', 'REMOTE'], sy.sel.s143STEP, 'x:sysel:s143STEP');
    g += T(246, 62, '143R', 't tc') + pair(178, 71, 68, ['REMOTE', 'REMOTE'], ['CENTRAL', 'CENTRAL'], sy.sel.s143R, 'x:sysel:s143R');
    g += T(476, 62, 'BUS BAR PROTECTION RELAY SELECTOR', 't tc') + pair(407, 71, 67, ['LOCK', false], ['USE', true], sy.sel.busProt, 'x:sysel:busProt');
    g += T(792, 53, 'CARRIER RELAY SELECTOR', 't tc') + pair(647, 61, 67, ['T/L NO.1\nLOCK', 'LOCK'], ['T/L NO.1\nUSE', 'USE'], pc.sel.car1, 'x:pcsel:car1', 24) + pair(798, 61, 67, ['T/L NO.2\nLOCK', 'LOCK'], ['T/L NO.2\nUSE', 'USE'], pc.sel.car2, 'x:pcsel:car2', 24);
    g += T(792, 98, 'AUTOMATIC RECLOSING SELECTOR', 't tc') + pair(647, 106, 67, ['T/L NO.1\nLOCK', false], ['T/L NO.1\nUSE', true], sy.sel.L1ar, 'x:sysel:L1ar', 24) + pair(798, 106, 67, ['T/L NO.2\nLOCK', false], ['T/L NO.2\nUSE', true], sy.sel.L2ar, 'x:sysel:L2ar', 24);
    // ---- station service control ----
    g += R(18, 153, 925, 383, 'box') + R(364, 146, 225, 16, 'box') + T(476, 158, 'STATION SERVICE CONTROL', 't tc');
    g += T(98, 180, '343STEP', 't tc') + pair(37, 190, 62, ['LOCAL', 'LOCAL'], ['REMOTE', 'REMOTE'], s.s343STEP, 'x:pcsel:s343STEP');
    g += T(98, 225, '443STEP', 't tc') + pair(37, 235, 62, ['LOCAL', 'LOCAL'], ['REMOTE', 'REMOTE'], s.s443STEP, 'x:pcsel:s443STEP');
    g += T(246, 180, '343R', 't tc') + pair(178, 188, 68, ['REMOTE', 'REMOTE'], ['CENTRAL', 'CENTRAL'], s.s343R, 'x:pcsel:s343R');
    g += pair(178, 234, 68, ['REMOTE', 'REMOTE'], ['CENTRAL', 'CENTRAL'], s.s443R, 'x:pcsel:s443R') + T(246, 228, '443R', 't tc');
    g += T(408, 180, '343ASR', 't tc') + pair(338, 190, 68, ['LOCK', 'LOCK'], ['USE', 'USE'], s.s343ASR, 'x:pcsel:s343ASR');
    g += T(720, 179, '43SCH/WLC', 't tc');
    ['SCH-1', 'SCH-2', 'SCH-3', 'SCH-4', 'SCH-5', 'WLC'].forEach((m, i) => { g += b3(509 + i * 69.5, 188, 67, 25, m, pc.mode === m ? 'yel' : '', `x:pcmode:${m}`); });
    g += T(720, 232, pc.mode ? `set point joint dari ${pc.mode}${pc.mode === 'WLC' ? ' (siklus 15 menit)' : ` · jam ${clk()}`}` : 'tidak ada yang dipilih: set point joint diatur manual', 'ts tc dim');
    const tot = pc.totals();
    const vb = (x, lab, val, act) => (act ? b3(x, 273, 135, 25, lab, '', act) + R(x + 3, 300, 134, 27, 'box') : R(x, 275, 134, 52, 'box') + mline(x + 67, 291, lab, 't tc', 10)) + T(x + 68, 318, val, 't tc');
    g += vb(28, 'JOINT CONTROL SET\nPOINT ACTIVE POWER', `${f(pc.jP)}  MW`, 'x:pcjp') + vb(180, 'JOINT CONTROL\nACTIVE POWER', `${f(pc.jointP())}  MW`) + vb(328, 'TOTAL\nACTIVE POWER', `${f(tot.p)}  MW`);
    g += vb(500, 'JOINT CONTROL SET\nPOINT REACTIVE POWER', `${f(pc.jQ)}  MVar`, 'x:pcjq') + vb(652, 'JOINT CONTROL\nREACTIVE POWER', `${f(pc.jointQ())}  MVar`) + vb(800, 'TOTAL\nREACTIVE POWER', `${f(tot.q)}  MVar`);
    [1, 2, 3].forEach((n, i) => {
      const x = 27 + i * 311, u = U(n), am = pc.alrMode(u), qm = pc.aqrMode(u);
      g += R(x, 340, 292, 195, 'box') + R(x + 70, 334, 152, 13, '', 'fill="#000"') + T(x + 146, 344, `UNIT NO.${n} CONTROL MODE`, 't tc');
      g += T(x + 73, 359, '43STEP', 't tc') + pair(x + 9, 368, 62, ['LOCAL', 'LOCAL'], ['REMOTE', 'REMOTE'], u.sw.s43STEP, `sw:${n}:s43STEP`);
      g += T(x + 222, 359, '43R', 't tc') + pair(x + 157, 368, 63, ['REMOTE', 'REMOTE'], ['CENTRAL', 'CENTRAL'], u.sw.s43R, `sw:${n}:s43R`);
      g += T(x + 73, 405, 'ALR CONTROL MODE', 't tc') + b3(x + 9, 413, 125, 25, 'JOINT', am === 'JOINT' ? 'yel' : '', `x:ualr:${n}:JOINT`) + b3(x + 9, 438, 62, 25, 'MANUAL', am === 'MANUAL' ? 'yel' : '', `x:ualr:${n}:MANUAL`) + b3(x + 71, 438, 63, 25, 'INDIVIDUAL', am === 'INDIVIDUAL' ? 'yel' : '', `x:ualr:${n}:INDIVIDUAL`);
      g += T(x + 222, 405, 'AQR CONTROL MODE', 't tc') + b3(x + 157, 413, 62, 25, 'AUTO', qm === 'AUTO' ? 'yel' : '', `x:uaqr:${n}:AUTO`) + b3(x + 219, 413, 63, 25, 'JOINT', qm === 'JOINT' ? 'yel' : '', `x:uaqr:${n}:JOINT`) + b3(x + 157, 438, 62, 25, 'MANUAL', qm === 'MANUAL' ? 'yel' : '', `x:uaqr:${n}:MANUAL`) + b3(x + 219, 438, 63, 25, 'SEMI AUTO', qm === 'SEMI AUTO' ? 'yel' : '', `x:uaqr:${n}:SEMI AUTO`);
      const cell = (xx, w, lab, val, unit, act) => `<g ${act ? `data-a="${act}"` : ''}>${R(xx, 476, w, 30, 'box')}${mline(xx + w / 2, 490, lab, 't tc', 10)}${R(xx, 506, w, 29, 'box')}${T(xx + w / 2, 519, val, 't tc')}${T(xx + w - 4, 531, unit, 'ts tr')}</g>`;
      g += cell(x + 9, 62, 'ALR SET\nPOINT', f(u.sw.alrSP), 'MW', `x:ualrsp:${n}`) + cell(x + 71, 63, 'ACTIVE\nPOWER', f(u.p.cb ? u.p.p : 0), 'MW') + cell(x + 157, 62, 'AQR SET\nPOINT', f(u.sw.aqrSP), 'MVar', `x:uaqrsp:${n}`) + cell(x + 219, 63, 'REACTIVE\nPOWER', f(u.p.cb ? u.p.q : 0), 'MVar');
    });
    g += navRow([['UNIT NO.1\nCONTROL PANEL', 'nav:ctl1'], ['UNIT NO.2\nCONTROL PANEL', 'nav:ctl2'], ['UNIT NO.3\nCONTROL PANEL', 'nav:ctl3'], ['SWITCHYARD/\nSTATION SERVICE\nCONTROL PANEL', 'nav:ssc'], ['SCH/WLC\nCONTROL PANEL', 'nav:sch1'], ['', ''], ['150kV\nSWITCHYARD', 'nav:sy'], ['MAIN CONTROL\nHOUSE', 'nav:mch'], ['UNDERGROUND\nPOWERHOUSE', 'nav:uph']], 'ssc');
    return g;
  }

  /* ============================== INTAKE & RE-REGULATING DAM ============================== */
  const volI = (x) => (189.475 * x * x - 218232.925 * x + 62839304.175);
  const volR = (x) => (x > 150 ? 17.425 * x * x - 5221.875 * x + 391245.75 : 6 * x - 873);
  function tank(x, y, w, h, lo, hi, val, marks) {
    let g = R(x, y, w, h, 'barbg');
    const fy = (v) => y + h - (v - lo) / (hi - lo) * h;
    const yv = Math.max(y, Math.min(y + h, fy(val)));
    g += `<rect x="${x + 1}" y="${yv}" width="${w - 2}" height="${y + h - yv}" class="water"/>`;
    for (const [v, c, lab] of marks) { const yy = fy(v); g += `<line x1="${x - 6}" y1="${yy}" x2="${x + w + 6}" y2="${yy}" stroke="${c}" stroke-dasharray="5 3"/>` + T(x + w + 9, yy + 3, lab, 'ts', `style="fill:${c}"`); }
    for (let v = Math.ceil(lo); v <= hi; v += 1) g += T(x - 8, fy(v) + 3, v, 'ts tr dim');
    return g;
  }
  function gateBar(x, y, a, aSet, q, lab, act, manual) {
    const h = 90, fr = Math.min(1, a / 6), fs = Math.min(1, aSet / 6);
    let g = T(x + 15, y - 6, lab, 't tc') + R(x, y, 30, h, 'barbg') + `<rect x="${x + 1}" y="${y + h - fr * h}" width="28" height="${fr * h}" class="barfg"/>`;
    g += `<line x1="${x - 4}" y1="${y + h - fs * h}" x2="${x + 34}" y2="${y + h - fs * h}" stroke="#ffff40" stroke-width="1.5"/>`;
    g += T(x + 15, y + h + 13, `${f(a, 2)} m`, 't tc cy') + T(x + 15, y + h + 25, `${f(q, 1)} m³/s`, 't tc cy');
    if (manual) g += b3(x - 4, y + h + 31, 19, 16, '▲', '', `${act}:1`) + b3(x + 17, y + h + 31, 19, 16, '▼', '', `${act}:-1`);
    return g;
  }
  function scrDamX() {
    const d = DAM(), pl = P; let g = title('INTAKE DAM & RE-REGULATING DAM') + backBtn();
    // intake
    g += R(10, 40, 480, 590, 'boxd') + T(250, 57, 'INTAKE DAM (RTU-I)', 't tc cy');
    g += tank(55, 75, 90, 300, 574, 581, pl.intakeWL, [[579.1, '#ffa040', 'FSL'], [577.51, '#ff4040', '86-5']]);
    g += T(100, 395, `WL ${f(pl.intakeWL, 2)} El.m`, 't tc', 'style="fill:#4ce0ff;font-size:13px"');
    const qT = d.qTurb();
    const rows = [['Volume (f7)', `${f(volI(pl.intakeWL), 0)} ×10³ m³`], ['Inflow alami (instruktur)', `${f(pl.inflow, 1)} m³/s`], ['Inflow terhitung (5 menit)', `${f(d.qnEst, 1)} m³/s`],
      ['Debit turbin total', `${f(qT, 1)} m³/s`], ...[1, 2, 3].map((n) => [`  Unit ${n}`, `${f(U(n).meas().flow, 1)} m³/s`]), ['Debit spillway total', `${f(pl.spillQ, 1)} m³/s`],
      ['Spillway gate control', d.sgLatch ? `AKTIF · set ${f(d.sgQset, 1)} m³/s` : 'siaga (WL ≤ FSL)'], ['Catu 20 kV feeder 252DL-ID', d.powered('ID') ? 'ADA' : 'HILANG']];
    rows.forEach(([a, b], i) => { g += T(215, 92 + i * 17, a, 't') + T(470, 92 + i * 17, b, 't tr cy'); });
    g += T(215, 300, 'SPILLWAY GATE', 't cy');
    const man = d.sgMode !== 'AUTO';
    g += b3(330, 288, 60, 18, 'AUTO', !man ? 'yel' : '', 'x:dam:sgmode:AUTO') + b3(395, 288, 70, 18, 'MANUAL', man ? 'yel' : '', 'x:dam:sgmode:MANUAL');
    [0, 1, 2].forEach((i) => { g += gateBar(235 + i * 85, 330, d.sg[i], d.sgSet[i], d.qSpill(d.sg[i]), `GATE-${i + 1}`, `x:dam:sg:${i}`, man); });
    g += mline(250, 520, 'Q = 20.81·h^0.6·a^0.9 (gated) · Q = 19.00·h^1.5 (bebas)\nh = WL − 572.5 m · set tiap 300 s saat WL > FSL\nurutan buka: gate-2, gate-3, gate-1 · ambang 20 cm\ngaris kuning = bukaan set · laju gerak 0.3 m/menit (asumsi)', 't tc dim', 13);
    g += b3(40, 590, 200, 26, 'SET INFLOW (instruktur)', '', 'x:dam:inflow') + b3(260, 590, 200, 26, 'WATER LEVEL CONTROL ▶', '', 'nav:wlc');
    // re-reg dam
    g += R(500, 40, 480, 590, 'boxd') + T(740, 57, 'RE-REGULATING DAM (RTU-R)', 't tc cy');
    g += tank(545, 75, 90, 300, 148, 160, d.rwl, [[d.RFSL, '#ffa040', 'FSL'], [d.plannedRWL, '#40ff40', 'RENC.']]);
    g += T(590, 395, `RWL ${f(d.rwl, 2)} El.m`, 't tc', 'style="fill:#4ce0ff;font-size:13px"');
    const r2 = [['Volume (f6)', `${f(volR(d.rwl), 0)} ×10³ m³`], ['Inflow = turbin + Qn', `${f(d.rIn, 1)} m³/s`], ['Qn aliran alami (instruktur)', `${f(d.rQn, 1)} m³/s`],
      ['Qr = (QTT·Top + QA·(24−Top))/24', `${f(d.qr, 1)} m³/s`], ['Qo = min(Qr + Qn, 41)', `${f(d.qo, 1)} m³/s`], ['Outflow total', `${f(d.rOut, 1)} m³/s`],
      ['Flood operation', d.flood ? 'AKTIF' : '—'], ['Catu 20 kV feeder 252DL-RD', d.powered('RD') ? 'ADA' : 'HILANG']];
    r2.forEach(([a, b], i) => { g += T(705, 92 + i * 17, a, 't', d.flood && i === 6 ? 'style="fill:#ff5050"' : '') + T(965, 92 + i * 17, b, 't tr cy'); });
    g += T(705, 300, 'GATE', 't cy');
    const rman = d.rMode !== 'AUTO';
    g += b3(820, 288, 60, 18, 'AUTO', !rman ? 'yel' : '', 'x:dam:rmode:AUTO') + b3(885, 288, 70, 18, 'MANUAL', rman ? 'yel' : '', 'x:dam:rmode:MANUAL');
    g += gateBar(700, 330, d.rg, d.rgSet, d.qReg(d.rg), 'REGULATING', 'x:dam:rg:0', rman);
    g += gateBar(800, 330, d.sl[0], d.sl[0], d.qReg(d.sl[0]), 'SLUICE-1', '', false) + gateBar(890, 330, d.sl[1], d.sl[1], d.qReg(d.sl[1]), 'SLUICE-2', '', false);
    g += mline(740, 520, 'Q = 12.48·h^0.6·a^0.9 · h = RWL − 147.0 m\nbukaan dibulatkan ke atas · sluice: RWL > FSL + 20/25 cm\nflood: RWL > rencana + 0.05 m selama 5 menit (min 1 jam)\nTop, Qn, level rencana: parameter asumsi (ubah di WLC)', 't tc dim', 13);
    g += b3(560, 590, 190, 26, 'SET Qn RE-DAM', '', 'x:dam:rqn') + b3(760, 590, 190, 26, 'ANALOG INPUT DAM ▶', '', 'nav:aidam');
    return g;
  }
  function scrRDC() {
    const d = DAM(); const sp = d.rHist.length > 1 ? d.rHist : [d.rwl, d.rwl];
    const W = 520, H = 120, lo = Math.min(...sp, d.plannedRWL) - 0.3, hi = Math.max(...sp, d.RFSL) + 0.2;
    const pts = sp.map((v, i) => `${(i / (sp.length - 1)) * W},${H - (v - lo) / (hi - lo) * H}`).join(' ');
    const yl = (v) => H - (v - lo) / (hi - lo) * H;
    const svg = `<svg width="${W + 70}" height="${H + 20}" style="background:#050505;border:1px solid #333"><polyline points="${pts}" fill="none" stroke="#4ce0ff" stroke-width="1.5"/>` +
      `<line x1="0" x2="${W}" y1="${yl(d.plannedRWL)}" y2="${yl(d.plannedRWL)}" stroke="#40ff40" stroke-dasharray="4 3"/><line x1="0" x2="${W}" y1="${yl(d.RFSL)}" y2="${yl(d.RFSL)}" stroke="#ffa040" stroke-dasharray="4 3"/>` +
      `<text x="${W + 4}" y="${yl(d.plannedRWL) + 4}" fill="#40ff40" font-size="10">rencana</text><text x="${W + 4}" y="${yl(d.RFSL) + 4}" fill="#ffa040" font-size="10">FSL</text>` +
      `<text x="2" y="${H + 14}" fill="#888" font-size="10">RWL tiap 5 menit, ${sp.length} titik terakhir (${f(lo, 1)}–${f(hi, 1)} m)</text></svg>`;
    const sb = (lab, a, on) => `<span class="sb ${on ? 'on' : ''}" data-a="${a}">${esc(lab)}</span>`;
    return `<div class="h2">WATER LEVEL CONTROL (RE-REGULATING DAM · JEZ2K042)</div><div class="fs"><div class="col">
      <h4>PERHITUNGAN DEBIT YANG DILEPAS (SH.002)</h4>
      <table class="tbl"><tr><th>Besaran</th><th>Rumus / sumber</th><th>Nilai</th></tr>
      <tr><td>QTT</td><td>debit turbin total saat operasi (3 × 70 MW)</td><td class="n">61.0 m³/s</td></tr>
      <tr><td>Top</td><td>jam operasi pembangkit per hari</td><td class="n">${f(d.Top, 1)} h</td></tr>
      <tr><td>QA</td><td>debit di luar jam operasi</td><td class="n">${f(d.QA, 1)} m³/s</td></tr>
      <tr><td>Tn</td><td>periode</td><td class="n">24 h</td></tr>
      <tr><td>Qr</td><td>(QTT·Top + QA·(Tn − Top)) / Tn</td><td class="n">${f(d.qr, 2)} m³/s</td></tr>
      <tr><td>Qn</td><td>aliran alami re-dam (outflow + ΔV/300 s)</td><td class="n">${f(d.rQn, 1)} m³/s</td></tr>
      <tr><td>Qo</td><td>min(Qr + Qn, 41 m³/s)${d.flood ? ' · FLOOD: = inflow' : ''}</td><td class="n">${f(d.qo, 2)} m³/s</td></tr>
      <tr><td>a regulating gate</td><td>f2⁻¹(Qo), dibulatkan ke atas</td><td class="n">${f(d.rgSet, 2)} m</td></tr></table>
      <div class="row">${sb('Top −1 h', 'x:dam:top:-1')}${sb('Top +1 h', 'x:dam:top:1')}${sb('Qn −1', 'x:dam:rqnd:-1')}${sb('Qn +1', 'x:dam:rqnd:1')}${sb('Rencana −0.5 m', 'x:dam:plan:-0.5')}${sb('Rencana +0.5 m', 'x:dam:plan:0.5')}</div>
      <div class="note2">Nilai Top, QA, Qn, dan level rencana re-dam tidak tercantum di dokumen (nilai awal: Top 6 h, QA 0, Qn 3 m³/s, rencana El. 155.00 m). Ubah sesuai pola operasi harian PLTA Musi.</div>
      </div><div class="col">
      <h4>KURVA LEVEL RE-DAM (SH.005)</h4>${svg}
      <h4>KONTROL SPILLWAY INTAKE (JEZ2K041 SH.002–004)</h4>
      <table class="tbl"><tr><th>Besaran</th><th>Nilai</th></tr>
      <tr><td>Intake WL / FSL</td><td class="n">${f(P.intakeWL, 3)} / 579.100 m</td></tr>
      <tr><td>Kondisi kontrol (latch WL > FSL)</td><td class="n">${d.sgLatch ? 'AKTIF' : 'siaga'}</td></tr>
      <tr><td>Inflow terhitung = ΔV/300 + Q turbin + Q gate</td><td class="n">${f(d.qnEst, 1)} m³/s</td></tr>
      <tr><td>Debit set spillway</td><td class="n">${f(d.sgQset, 1)} m³/s</td></tr>
      ${[0, 1, 2].map((i) => `<tr><td>Gate-${i + 1} set / aktual</td><td class="n">${f(d.sgSet[i], 2)} / ${f(d.sg[i], 2)} m</td></tr>`).join('')}</table>
      <div class="row">${sb('INTAKE & RE-DAM ▶', 'nav:dam')}${sb('TREND PLANT ▶', 'nav:trend')}</div></div></div>`;
  }

  /* ============================== LAYAR SISTEM UNIT – DIAGRAM ASLI OPS + OVERLAY DINAMIS ============================== */
  // Diagram statis (jalur pipa, simbol, label) diambil langsung dari layar OPS 13-Okt-2017 (www/img/*.png) supaya jalur identik.
  // Semua elemen yang berubah (valve, pompa, lamp, nilai) digambar ulang di atasnya pada koordinat piksel layar asli.
  const BG = { ivh: { w: 928, h: 605 }, tact: { w: 1162, h: 757 }, ovw: { w: 1159, h: 756 } };
  const bgWrap = (k, ttl, inner) => { const b = BG[k], s = 990 / b.w; return `<g transform="scale(${s.toFixed(5)})"><image href="img/${k}.png" x="0" y="0" width="${b.w}" height="${b.h}"/>${inner}</g>` + title(ttl) + backBtn(); };
  const tx = (x, y, s, sz, anc = 'start', col = '#e8e8e8', ex = '') => `<text x="${x}" y="${y}" style="font-size:${sz}px;fill:${col};text-anchor:${anc}${ex}">${esc(String(s))}</text>`;
  const blk = (x, y, w, h, c = '#000') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
  // lamp OPS: hijau = normal, merah = alarm
  const lampO = (x, y, alarm, r = 5.5) => `<circle cx="${x}" cy="${y}" r="${r + 1.5}" fill="#000"/><circle cx="${x}" cy="${y}" r="${r}" fill="${alarm ? '#ff2020' : '#18e018'}"/>`;
  // pompa OPS: lingkaran + panah; merah = jalan, hijau = berhenti, kuning = gangguan
  const pumpO = (x, y, st, dir = 'up', r = 9) => {
    const c = st === 'run' ? '#ff2020' : st === 'fail' ? '#ffd000' : '#18e018';
    const a = { up: `M${x},${y + 6} L${x},${y - 1} M${x - 5},${y - 1} L${x},${y - 7} L${x + 5},${y - 1} Z`, right: `M${x - 6},${y} L${x + 1},${y} M${x + 1},${y - 5} L${x + 7},${y} L${x + 1},${y + 5} Z`, left: `M${x + 6},${y} L${x - 1},${y} M${x - 1},${y - 5} L${x - 7},${y} L${x - 1},${y + 5} Z` }[dir];
    return `<circle cx="${x}" cy="${y}" r="${r + 2}" fill="#000"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="1.8"/><path d="${a}" fill="${c}" stroke="${c}" stroke-width="2.4"/>`;
  };
  // solenoid valve: bowtie + kumparan 'S'. on → merah; off → putih (seperti layar OPS)
  const solO = (x, y, on, vert = false, sx = 0, sy = -12, col, hw = 8, hh = 6, sr = 5) => {
    const c = col || (on ? '#ff2020' : '#e8e8e8');
    const [a1, a2] = vert ? [hh, hw] : [hw, hh];
    const bt = vert ? `M${x - a1},${y - a2} L${x + a1},${y - a2} L${x - a1},${y + a2} L${x + a1},${y + a2} Z` : `M${x - a1},${y - a2} L${x - a1},${y + a2} L${x + a1},${y - a2} L${x + a1},${y + a2} Z`;
    return `<rect x="${x - a1 - 1.5}" y="${y - a2 - 1.5}" width="${2 * a1 + 3}" height="${2 * a2 + 3}" fill="#000"/><circle cx="${x + sx}" cy="${y + sy}" r="${sr + 1.5}" fill="#000"/>` +
      `<path d="${bt}" fill="none" stroke="${c}" stroke-width="1.5"/><line x1="${x}" y1="${y}" x2="${x + sx * 0.55}" y2="${y + sy * 0.55}" stroke="${c}" stroke-width="1.2"/>` +
      `<circle cx="${x + sx}" cy="${y + sy}" r="${sr}" fill="none" stroke="${c}" stroke-width="1.3"/>` + tx(x + sx, y + sy + sr * 0.6, 'S', sr * 1.5, 'middle', c);
  };

  /* ---------- NO.n UNIT INLET VALVE HYDRAULIC CONTROL SYSTEM (00014–00016) ---------- */
  function scrIVH(n) {
    const u = U(n), p = u.p, F = u.fx, air = P.air ? P.air.u[n - 1] : { iv: 1 }, lo = !!(u.lo['86-1'] || u.lo['86-2']);
    const ivP = Math.min(1.02, 0.6 + 0.42 * air.iv), moving = (p.ivCmd === 'open' && p.iv < 0.995) || (p.ivCmd === 'close' && p.iv > 0.005);
    let g = '';
    [[56, ivP < 0.85 || ivP > 1.06], [72, ivP < 0.85], [87, ivP < 0.75], [114, ivP > 1.05], [130, ivP < 0.85], [146, ivP < 0.75]].forEach(([y, a]) => { g += lampO(315, y, a); });
    g += lampO(495, 504, false) + lampO(495, 519, false) + lampO(495, 550, false) + lampO(495, 566, false) + lampO(495, 581, !!F.iv_stuck);
    g += solO(145, 109, ivP < 0.95, false, 0, -11);                                   // 20AJI air injection
    g += solO(396, 132, p.bypassCmd, true, 10, 0);                                     // 20QIVBPI
    g += solO(506, 132, p.ivCmd === 'open' && p.seal > 0.01 && p.iv < 0.995, true, 10, 0);   // 20QIVS1 (energize saat seal dilepas)
    g += solO(769, 351, p.ivCmd === 'open' && p.iv < 0.995, true, 10, 0);             // 20QIV
    g += solO(461, 395, p.ivCmd === 'open' && !lo, false, 0, -13, p.ivCmd === 'open' && !lo ? '#ff2020' : '#18e018', 14, 8.5, 6);   // 20QIVMSI
    const bpO = p.bypass > 0.02, bc = bpO ? '#ff2020' : '#18e018';
    g += blk(823, 156, 27, 30) + `<rect x="829" y="158" width="14" height="9" fill="none" stroke="${bc}" stroke-width="1.4"/><line x1="836" y1="167" x2="836" y2="176" stroke="${bc}"/>` +
      `<path d="M823,170 L823,182 L849,170 L849,182 Z" fill="${bc}" stroke="${bc}"/>`;
    const ivO = p.iv > 0.02;
    g += `<path d="M742,245 L797,245 L791,260 L748,260 Z" fill="${ivO ? '#ff2020' : '#18e018'}"/>` + (p.iv > 0.005 && p.iv < 0.995 ? tx(769, 243, `${f(p.iv * 100, 0)}%`, 9, 'middle', '#000') : '');
    const pr = moving && !F.iv_stuck;
    g += pumpO(352, 518, pr ? 'run' : 'stop') + pumpO(439, 518, 'stop');
    return bgWrap('ivh', `NO.${n} UNIT INLET VALVE HYDRAULIC CONTROL SYSTEM`, g);
  }

  /* ---------- NO.n UNIT HYDRAULIC TURBINE ACTUATOR CONTROL SYSTEM (00011–00013) ---------- */
  function scrTact(n) {
    const u = U(n), p = u.p, F = u.fx, lo = !!(u.lo['86-1'] || u.lo['86-2']), sumpT = u.govSumpT ? u.govSumpT() : 45;
    let g = blk(429, 76, 38, 19) + tx(463, 91, f(p.gv), 12, 'end');
    g += lampO(25, 325, p.govLvl < 0.85 || p.govLvl > 1.08, 6) + lampO(25, 343, p.govLvl < 0.85, 6) + lampO(25, 362, p.govLvl < 0.75, 6);
    g += lampO(118, 325, p.govP > 1.05, 6) + lampO(118, 343, p.govP < 0.85, 6) + lampO(118, 362, p.govP < 0.75, 6);
    g += lampO(135, 644, !!F.gov_oil_leak, 6) + lampO(427, 635, p.qp[0].fail, 6) + lampO(427, 654, p.qp[1].fail, 6);
    g += lampO(427, 687, !!F.gov_oil_leak, 6) + lampO(427, 706, sumpT > 60, 6) + lampO(427, 726, sumpT > 65, 6);
    // 75S rem: merah saat rem dilepas (kondisi operasi pada layar OPS), hijau saat rem diterapkan
    g += solO(81, 136, true, false, 0, -16, p.brake > 0.5 ? '#18e018' : '#ff2020', 16, 10.5, 7.5);
    g += solO(825, 467, true, true, 16, 0, p.govOn ? '#ff2020' : '#18e018', 16, 10.5, 7.5);                     // 20QMV
    if (lo) g += solO(881, 174, true, false, 0, -12, '#ff2020');                                  // 20SD energize saat quick shutdown
    if (p.govOn && p.speed < 0.95 && !p.cb) g += solO(324, 218, true, false, 0, -12, '#ff2020'); // 20ST saat start
    if (p.speed > 1.4 || (u.lo['86-2'] && /overspeed|140|145/i.test(u.lo['86-2'] || ''))) g += blk(1017, 57, 50, 27) + `<path d="M1026,58 L1060,58 A12,12 0 0 1 1060,82 L1026,82 L1018,70 Z" fill="none" stroke="#ff2020" stroke-width="1.6"/><circle cx="1053" cy="70" r="6" fill="none" stroke="#ff2020" stroke-width="1.6"/><path d="M1044,70 L1030,70 M1034,66 L1030,70 L1034,74" stroke="#ff2020" fill="none"/>`;
    const qst = (q) => q.fail ? 'fail' : q.run ? 'run' : 'stop';
    g += pumpO(632, 648, qst(p.qp[0])) + pumpO(742, 648, qst(p.qp[1]));
    if (F.gov_oil_leak && p.speed > 0.05) g += pumpO(108, 692, 'run');
    return bgWrap('tact', `NO.${n} UNIT HYDRAULIC TURBINE ACTUATOR CONTROL SYSTEM`, g);
  }

  /* ---------- NO.n UNIT WATER FLOW SYSTEM (00006–00008) ---------- */
  function scrOvwOPS(n) {
    const u = U(n), p = u.p, m = u.meas(), T_ = p.T;
    let g = tx(16, 52, `UNIT No.${n}`, 12);
    const head = P.intakeWL - 173.5;
    const mtrFlow = (p.mtr[0].run || p.mtr[1].run) ? 52.0 * Math.min(1, Math.max(0.2, p.f_ac || 1)) + 0.4 * Math.sin(P.t / 37) : 0;
    const L = [[71, f(m.p)], [92, f(m.q)], [115, f(m.rpm)], [137, f(m.gv)], [158, f(m.gvLim)], [180, f(m.flow), 'm3/s'], [203, f(T_.cwOut)], [224, f(T_.cwIn)], [246, f(T_.tgb)], [268, f(T_.tgbOil)],
      [290, f(m.penstock)], [312, f(m.spiral)], [334, f(mtrFlow), 'm3/h'], [362, f(P.intakeWL, 2)], [383, f(173.5)]];
    L.forEach(([y, v, unit]) => { const al = T_.tgb > 70 && y === 246; g += tx(249, y + 5, v, y === 362 ? 11 : 12, 'end', al ? '#ff4040' : '#e8e8e8') + (unit ? tx(296, y + 5, unit, 12, 'end') : ''); });
    const R2 = [[72, T_.ugb], [92, T_.ugbOil], [120, T_.thrust], [142, T_.lgb], [163, T_.lgb + 1.8], [185, T_.lgbOil], [213, T_.acOut], [235, T_.acIn]];
    R2.forEach(([y, v]) => { g += tx(567, y + 5, f(v), 12, 'end', v > 70 ? '#ff4040' : '#e8e8e8'); });
    g += tx(813, 135, f(m.kv), 12, 'end');
    [m.Ir, m.Is, m.It].forEach((v, i) => { g += tx(918, [135, 151, 168][i], f(v, 0), 12, 'end'); });
    T_.st.forEach((v, i) => { g += tx(1015, [135, 151, 168, 184][i], f(v), 12, 'end', v > 110 ? '#ff4040' : '#e8e8e8'); });
    g += tx(580, 457, f(T_.cwIn), 12, 'end') + tx(1090, 390, f(T_.cwOut), 12, 'end');
    g += tx(901, 444, `No.${n}`, 11.5, 'middle', '#333', ';font-weight:bold');
    const fr = (x, y, ok) => `<circle cx="${x}" cy="${y}" r="11" fill="#000"/><circle cx="${x}" cy="${y}" r="9.5" fill="${ok ? '#18e018' : '#ff2020'}"/><circle cx="${x}" cy="${y}" r="7.5" fill="none" stroke="#000" stroke-width=".8"/>` + tx(x, y + 3.5, 'FR', 8.5, 'middle', '#000');
    g += fr(1081, 203, p.f_lb > 0.6) + fr(1081, 252, p.f_goc > 0.6) + fr(998, 302, p.f_tb > 0.6) + fr(806, 362, p.f_sc > 0.6);
    // inlet valve & bypass (dilihat dari luar)
    const bc = p.bypass > 0.02 ? '#ff2020' : '#18e018';
    g += `<rect x="366" y="322" width="37" height="37" fill="#000"/><rect x="377" y="324" width="15" height="10" fill="none" stroke="${bc}" stroke-width="1.5"/><line x1="384" y1="334" x2="384" y2="346" stroke="${bc}"/><path d="M368,337 L368,355 L400,337 L400,355 Z" fill="${bc}" stroke="${bc}"/>`;
    g += `<path d="M354,435 L414,435 L407,448 L361,448 Z" fill="${p.iv > 0.02 ? '#ff2020' : '#18e018'}"/><circle cx="384" cy="441" r="1.5" fill="#000"/>`;
    const ps = (q) => q.fail ? 'fail' : q.run ? 'run' : 'stop';
    g += pumpO(598, 334, ps(p.ssb[0]), 'right', 8) + pumpO(598, 388, ps(p.ssb[1]), 'right', 8) + pumpO(871, 592, ps(p.cw[0]), 'left', 8) + pumpO(871, 658, ps(p.cw[1]), 'left', 8);
    return bgWrap('ovw', `NO.${n} UNIT WATER FLOW SYSTEM`, g);
  }
  window.HMIX_OVW = scrOvwOPS;

  /* ============================== AIR SUPPLY SYSTEM (layar 00010) ============================== */
  function scrAir() {
    const air = AIR(); let g = title('AIR SUPPLY SYSTEM') + backBtn();
    const comp = (x, y, c) => `<g data-a="x:airc"><circle cx="${x}" cy="${y}" r="9" fill="none" stroke="${c.fail ? C.red : c.run ? C.yel : C.wht}" stroke-width="1.6"/><path d="M${x - 4},${y - 4} L${x + 5},${y} L${x - 4},${y + 4}" fill="none" stroke="${c.fail ? C.red : c.run ? C.yel : C.wht}"/></g>`;
    const pv = (x, y, v) => T(x, y, `${f(v * 100, 0)} %`, 'ts tc', `style="fill:${v < 0.8 ? '#ff6060' : C.cy}"`);
    [0, 1, 2].forEach((i) => {
      const a = air.u[i], y = 114 + i * 94.5, n = i + 1, s1 = air.sw(a.prim), sb = air.sw(a.brake);
      g += T(17, y - 20, 'AIR COMPRESSOR 1', 't') + T(17, y, `UNIT NO.${n}`, 't') + comp(88, y, a.c1) + L(97, y, 260, y, 'ln') + vlv(116, y);
      g += lampBox(180, y - 57, 67, [['63AQH1', s1.H1 ? true : 'alm'], ['63AQH2', s1.H2]]);
      g += ptank(260, y - 47, 56, 54, `PRIMARY\nAIR\nTANK\n#${n}`) + relief(290, y - 47) + pv(288, y + 18, a.prim);
      g += L(316, y - 36, 345, y - 36, 'ln') + filt(355, y - 36) + L(363, y - 36, 378, y - 36, 'ln') + arrowR(378, y - 36) + mline(382, y - 33, `to GOVERNOR PRESSURE\nTANK (UNIT NO.${n})`, 't', 11);
      g += L(316, y, 640, y, 'ln') + vlv(398, y) + filt(432, y) + `<path d="M464,${y - 5} L476,${y} L464,${y + 5} Z" fill="none" stroke="${C.wht}"/>` + L(455, y, 455, y - 14, 'ln') + L(455, y - 14, 490, y - 14, 'ln') + L(490, y - 14, 490, y, 'ln') + vlv(510, y) + vlv(610, y);
      g += lampBox(567, y - 49, 64, [['63AQL', sb.L ? 'alm' : true]]);
      g += ptank(640, y - 47, 60, 54, `BRAKE\nAIR\nTANK\n#${n}`) + relief(680, y - 47) + relief(718, y - 30) + pv(670, y + 18, a.brake);
      g += L(700, y - 22, 812, y - 22, 'ln') + vlv(708, y - 22) + L(745, y - 22, 745, y - 36, 'ln') + L(745, y - 36, 772, y - 36, 'ln') + L(772, y - 36, 772, y - 22, 'ln') + vlv(788, y - 22) + arrowR(812, y - 22) + mline(814, y - 25, `to MAINTENANCE\nSHAFT SEAL (UNIT NO.${n})`, 't', 11);
      g += L(700, y, 812, y, 'ln') + vlv(708, y) + vlv(788, y) + relief(795, y) + arrowR(812, y) + mline(814, y + 3, `to HYDRAULIC TURBINE\nACTUATOR (UNIT NO.${n})`, 't', 11);
      // kompresor 2 – inlet valve air tank
      const y2 = 403 + i * 94.5, s2 = air.sw(a.iv);
      g += T(17, y2 - 20, 'AIR COMPRESSOR 2', 't') + T(17, y2, `UNIT NO.${n}`, 't') + comp(88, y2, a.c2) + L(97, y2, 260, y2, 'ln') + vlv(116, y2);
      g += lampBox(180, y2 - 57, 67, [['63AQH1', s2.H1 ? true : 'alm'], ['63AQH2', s2.H2]]);
      g += ptank(260, y2 - 47, 56, 54, `INLET\nVALVE\nAIR TANK\n#${n}`) + relief(290, y2 - 47) + pv(288, y2 + 18, a.iv);
      g += L(316, y2 - 36, 355, y2 - 36, 'ln') + filt(365, y2 - 36) + L(373, y2 - 36, 388, y2 - 36, 'ln') + arrowR(388, y2 - 36) + mline(392, y2 - 33, `to INLET VALVE\nPRESSURE TANK (UNIT NO.${n})`, 't', 11);
      if (i < 2) {
        [[135, y, y + 94.5], [162, y, y + 94.5], [528, y, y + 94.5], [555, y, y + 94.5], [135, y2, y2 + 94.5], [162, y2, y2 + 94.5]].forEach(([x, a0, a1]) => { g += L(x, a0, x, a1, 'ln') + vlv(x, (a0 + a1) / 2, true); });
      }
    });
    g += L(135, 114, 135, 114, '') + T(495, 638, 'Kuning = kompresor jalan, merah = gangguan. Persentase = tekanan tangki terhadap nominal (simulator); kompresor start bila 63AQH1 OFF, stop saat 63AQH2 ON.', 'ts tc dim');
    return g;
  }

  /* ============================== RAIN FALL MONITOR (layar 00023) ============================== */
  const RN = { C: [527, 295], D: [460, 320], E: [555, 335], F: [440, 385], G: [485, 450], H: [570, 430] };
  const RPOLY = [
    { c: '#8a8a00', p: [[335, 235], [370, 195], [440, 185], [460, 130], [497, 75], [565, 117], RN.C, RN.D, [400, 285]] },
    { c: '#b8ebb8', p: [[565, 117], [590, 150], [640, 147], [680, 185], [690, 265], [705, 315], [698, 350], RN.E, RN.C] },
    { c: '#ffc800', p: [RN.E, [698, 350], [712, 370], [700, 445], [640, 475], [570, 485], [540, 525], RN.H] },
    { c: '#ffd0a8', p: [RN.D, RN.C, RN.E, RN.H, RN.G, RN.F] },
    { c: '#f2e6a0', p: [RN.F, RN.G, RN.H, [540, 525], [520, 575], [450, 575], [380, 545], [355, 495], [355, 440], [380, 400]] },
    { c: '#ff99cc', p: [[335, 235], [400, 285], RN.D, RN.F, [380, 400], [320, 355], [270, 305], [260, 265]] },
  ];
  const RIV = [[[497, 90], [500, 140], [490, 200], [500, 260], [515, 300], [520, 360], [500, 420], [490, 480], [470, 540], [445, 575], [430, 590], [380, 600], [330, 598]],
    [[640, 160], [600, 210], [560, 260], [527, 300]], [[690, 300], [640, 320], [590, 335], [555, 345], [520, 360]], [[690, 410], [640, 420], [590, 430], [540, 440], [500, 450]],
    [[300, 290], [350, 310], [410, 330], [460, 345], [510, 360]], [[370, 470], [420, 470], [470, 480]], [[410, 210], [440, 250], [470, 285], [500, 320]], [[640, 240], [600, 270], [560, 300]],
    [[620, 380], [580, 395], [540, 410]], [[360, 520], [410, 515], [460, 520]]];
  function scrRain() {
    const rn = RAIN(); let g = title('RAIN FALL MONITOR') + backBtn();
    for (const s of RPOLY) g += `<polygon points="${s.p.map((q) => q.join(',')).join(' ')}" fill="${s.c}" stroke="#000" stroke-width=".8"/>`;
    for (const k of [[[527, 295], [460, 320], [440, 385]], [[527, 295], [555, 335], [698, 350]], [[460, 320], [400, 285], [335, 235]], [[527, 295], [565, 117]], [[555, 335], [570, 430], [485, 450], [440, 385]], [[570, 430], [540, 525]]]) g += `<polyline points="${k.map((q) => q.join(',')).join(' ')}" fill="none" stroke="#000" stroke-dasharray="3 3"/>`;
    for (const r of RIV) g += `<polyline points="${r.map((q) => q.join(',')).join(' ')}" fill="none" stroke="#18b8ff" stroke-width="${r === RIV[0] ? 2 : 1.2}"/>`;
    for (let k = 0; k < 40; k++) { const x = 300 + (k * 97) % 400, y = 140 + (k * 61) % 420; g += `<path d="M${x},${y} q6,8 2,16 q-4,6 3,12" fill="none" stroke="#18b8ff" stroke-width=".8"/>`; }
    g += `<rect x="342" y="590" width="8" height="12" fill="none" stroke="#fff"/><path d="M425,560 l8,-10 l8,10" fill="none" stroke="#fff"/>`;
    const box = (x, y, lab, val, unit) => T(x + 3, y - 4, lab, 't', 'style="fill:#222;font-weight:bold"') + R(x, y, 62, 32, '', 'fill="#000" stroke="#fff"') + T(x + 50, y + 13, val, 't tr') + T(x + 58, y + 27, unit, 't tr');
    const v = (i) => f(rn.rgs[i], 1);
    g += box(435, 220, 'RGS-1', v(0), 'mm/h') + box(594, 250, 'RGS-2', v(1), 'mm/h') + box(337, 283, 'RGS-6', v(5), 'mm/h') + box(465, 345, 'RGS-4', v(3), 'mm/h');
    g += box(594, 378, 'RGS-3', v(2), 'mm/h') + box(495, 409, 'WLS-1', f(rn.wls(0), 2), 'Elm') + box(337, 442, 'RGS-5', v(4), 'mm/h') + box(402, 508, 'WLS-2', f(rn.wls(1), 2), 'Elm');
    // panel instruktur
    g += R(760, 50, 215, 250, 'boxd') + T(867, 68, 'INSTRUKTUR: HUJAN DAS', 't tc cy');
    [0, 5, 10, 20, 40].forEach((I, k) => { g += b3(772 + (k % 3) * 66, 80 + Math.floor(k / 3) * 30, 62, 24, `${I} mm/h`, rn.I === I ? 'yel' : '', `x:rain:${I}`); });
    g += T(772, 155, `Intensitas set: ${f(rn.I, 0)} mm/h`, 't') + T(772, 172, `Tambahan inflow: ${f(rn.q, 1)} m³/s`, 't') + T(772, 189, `Inflow intake: ${f(P.inflow, 1)} m³/s`, 't');
    g += T(772, 210, 'Curah hujan kumulatif (mm):', 't') + rn.acc.map((a, i) => T(772 + (i % 3) * 66, 227 + Math.floor(i / 3) * 16, `R${i + 1} ${f(a, 1)}`, 'ts cy')).join('');
    g += mline(867, 275, 'Nilai simulasi (di OPS tidak\nterkomunikasi). Limpasan &\nrating curve WLS = asumsi.', 'ts tc dim', 11);
    return g;
  }

  /* ============================== ANALOG INPUT SY / USS / MSS (layar 00086 / 00084 / 00085) ============================== */
  function aiScreen(ttl, pre, ai, rtd) {
    let g = title(ttl) + backBtn() + T(495, 36, '---  4-20mA CURRENT INPUT  ---', 't tc');
    const RH = 18, sp = ['SPARE', '0', ''];
    const full = (a, n) => { const r = a.slice(); while (r.length < n) r.push(sp); return r; };
    const A = full(ai, 46), Rt = full(rtd, 16);
    const row = (x, y, tag, r) => R(x, y, 60, RH, 'box') + T(x + 3, y + 13, tag, 'ts') + R(x + 60, y, 282, RH, 'box') + T(x + 64, y + 13, r[0], 'ts') + R(x + 352, y, 106, RH, 'box') +
      T(x + 412, y + 13, r[1], 'ts tr') + T(x + 418, y + 13, r[2], 'ts');
    for (let i = 0; i < 23; i++) { g += row(10, 42 + i * RH, `${pre}AI${String(i + 1).padStart(4, '0')}`, A[i]) + row(483, 42 + i * RH, `${pre}AI${String(i + 24).padStart(4, '0')}`, A[i + 23]); }
    g += T(495, 469, '---  RTD INPUT  ---', 't tc');
    for (let i = 0; i < 8; i++) { g += row(10, 474 + i * RH, `${pre}RTD${String(i + 1).padStart(4, '0')}`, Rt[i]) + row(483, 474 + i * RH, `${pre}RTD${String(i + 9).padStart(4, '0')}`, Rt[i + 8]); }
    return g;
  }
  const v1 = (x, d = 1) => f(x, d);
  function aiSY() {
    const sy = P.sy, fl = sy.flows(), lv = sy.busLive(), ss = SS();
    const Iline = (p, q) => Math.hypot(p, q) * 1000 / (Math.sqrt(3) * 154);
    const ph = (I, k) => v1(I * [1.0, 1.008, 1.04][k], 0);
    const unitI = (n) => { const u = U(n); return u.p.cb && sy.unitOnGrid(n) ? Iline(u.p.p, u.p.q) : 0; };
    const lstI = ss.kw('252-LS') / (Math.sqrt(3) * 154 * 0.88);
    const ai = [['TRANSMISSION LINE NO.1 ACTIVE POWER', v1(fl.L1.p), 'MW'], ['TRANSMISSION LINE NO.1 REACTIVE POWER', v1(fl.L1.q), 'MVar'],
      ...[0, 1, 2].map((k) => [`TRANSMISSION LINE NO.1 CURRENT PHASE ${'RST'[k]}`, ph(Iline(fl.L1.p, fl.L1.q), k), 'A']),
      ['TRANSMISSION LINE NO.2 ACTIVE POWER', v1(fl.L2.p), 'MW'], ['TRANSMISSION LINE NO.2 REACTIVE POWER', v1(fl.L2.q), 'MVar'],
      ...[0, 1, 2].map((k) => [`TRANSMISSION LINE NO.2 CURRENT PHASE ${'RST'[k]}`, ph(Iline(fl.L2.p, fl.L2.q), k), 'A']),
      ['150KV BUS-A VOLTAGE', lv.A ? v1(154.9) : '0.0', 'kV'], ['150KV BUS-A FREQUENCY', lv.A ? v1(sy.freq) : '0.0', 'Hz'], ['150KV BUS-B VOLTAGE', lv.B ? v1(154.6) : '0.0', 'kV'], ['150KV BUS-B FREQUENCY', lv.B ? v1(sy.freq) : '0.0', 'Hz'],
      ...[0, 1, 2].map((k) => [`150KV BUS-TIE CURRENT PHASE ${'RST'[k]}`, ph(fl.BT, k), 'A']),
      ...[1, 2, 3].flatMap((n) => [0, 1, 2].map((k) => [`150KV MTR. UNIT NO.${n} CURRENT PHASE ${'RST'[k]}`, v1(unitI(n) * [1, 0.98, 1.02][k]), 'A'])),
      ...[0, 1, 2].map((k) => [`LSTR. CURRENT PHASE ${'RST'[k]}`, v1(lstI * [1, 1.05, 0.95][k]), 'A']), ['LSTR. TAP POSITION', String(sy.tap), ''], ['OUTDOOR SWITCHYARD AMBIENT TEMPERATURE', v1(PC().amb('out')), '℃']];
    const rtd = [['SPARE', '0', ''], ['LSTR. WINDING TEMPERATURE', v1(PC().amb('lstWdg')), '℃'], ['LSTR. OIL TEMPERATURE', v1(PC().amb('lstOil')), '℃']];
    return aiScreen('ANALOG INPUT FOR SWITCHYARD', 6, ai, rtd);
  }
  function aiUSS() {
    const ss = SS(), kw = (id) => v1(ss.kw(id)), a = (id) => v1(ss.amps(id)), na = (n) => v1(ss.nodeAmps(n)), V = (n) => v1(ss.volt(n));
    const u = (n) => [[`USTR.${n} ACTIVE POWER`, kw('452-' + n), 'kW'], [`USTR.${n} CURRENT`, a('452-' + n), 'A'], [`UNIT NO.${n} 400V BUS VOLTAGE`, V('UB' + n), 'V'], [`UNIT NO.${n} MCC${n}A CURRENT`, na(`MCC${n}A`), 'A'], [`UNIT NO.${n} MCC${n}B CURRENT`, na(`MCC${n}B`), 'A']];
    const zp = (k) => (ss.live[`SST${k}P`] ? '0.1' : '0.0');
    const ai = [...u(3), ...u(2), ...u(1), ['SPARE', '0', ''],
      ['SSTR.1 ACTIVE POWER', kw('252-L1'), 'kW'], ['SSTR.1 VOLTAGE', V('SST1P'), 'kV'], ['SSTR.1 CURRENT', f(ss.amps('252-L1'), 2), 'A'], ['SSTR.1 ZERO-PHASE VOLTAGE', zp(1).replace('0.1', '0.0'), 'V'],
      ['SSTR.2 ACTIVE POWER', kw('252-L2'), 'kW'], ['SSTR.2 VOLTAGE', V('SST2P'), 'kV'], ['SSTR.2 CURRENT', f(ss.amps('252-L2'), 2), 'A'], ['SSTR.2 ZERO-PHASE VOLTAGE', zp(2), 'V'],
      ['400V BUS-A ACTIVE POWER', v1(ss.nodeKW.P4A || 0), 'kW'], ['400V BUS-A VOLTAGE', V('P4A'), 'V'], ['400V BUS-A CURRENT', v1(ss.nodeAmps('P4A'), 0), 'A'],
      ['400V BUS-B ACTIVE POWER', v1(ss.nodeKW.P4B || 0), 'kW'], ['400V BUS-B VOLTAGE', V('P4B'), 'V'], ['400V BUS-B CURRENT', v1(ss.nodeAmps('P4B'), 0), 'A'], ['SPARE', '0', ''], ['SPARE', '0', ''],
      ['400V BUS-TIE 352B-A1 CURRENT', a('352B-A1'), 'A'], ['400V BUS-TIE 352B-A2 CURRENT', a('352B-A2'), 'A'], ['400V BUS-TIE 352B-B1 CURRENT', a('352B-B1'), 'A'], ['400V BUS-TIE 352B-B2 CURRENT', a('352B-B2'), 'A'],
      ['COMMON MCC CURRENT', a('352-4'), 'A'], ['TAILRACE WATER LEVEL', f(173.41, 2), 'Elm']];
    const rtd = [['USTR.1 WINDING TEMPERATURE', v1(ss.ustT[1]), '℃'], ['USTR.2 WINDING TEMPERATURE', v1(ss.ustT[2]), '℃'], ['USTR.3 WINDING TEMPERATURE', v1(ss.ustT[3]), '℃'], ['UNDERGROUND POWERHOUSE AMBIENT TEMPERATURE', v1(PC().amb('uph')), '℃']];
    return aiScreen('ANALOG INPUT FOR UNDERGROUND STATION SERVICE', 4, ai, rtd);
  }
  function aiMSS() {
    const ss = SS(), dg = ss.dg, mw = (id) => f(ss.kw(id) / 1000, 2), kw = (id) => v1(ss.kw(id)), a = (id) => v1(ss.amps(id)), V = (n) => v1(ss.volt(n));
    const ai = [['20KV LSTR. ACTIVE POWER', mw('252-LS'), 'MW'], ['20KV LSTR. CURRENT', a('252-LS'), 'A'], ['20KV DL-BC ACTIVE POWER', mw('252DL-BC'), 'MW'], ['20KV DL-BC CURRENT', a('252DL-BC'), 'A'],
      ['20KV DL-ID ACTIVE POWER', mw('252DL-ID'), 'MW'], ['20KV DL-ID CURRENT', a('252DL-ID'), 'A'], ['20KV DL-RD ACTIVE POWER', mw('252DL-RD'), 'MW'], ['20KV DL-RD CURRENT', a('252DL-RD'), 'A'],
      ['20KV SSTR.1 ACTIVE POWER', kw('252B-A2'), 'kW'], ['20KV SSTR.1 CURRENT', a('252B-A2'), 'A'], ['20KV SSTR.2 ACTIVE POWER', kw('252B-B2'), 'kW'], ['20KV SSTR.2 CURRENT', a('252B-B2'), 'A'],
      ['20KV SSTR.3 CURRENT', a('252B-A1'), 'A'], ['20KV SSTR.4 CURRENT', a('252B-B1'), 'A'], ['400V BUS-A ACTIVE POWER', kw('352-S1'), 'kW'], ['400V BUS-A CURRENT', v1(ss.amps('352-S1'), 0), 'A'],
      ['400V BUS-B ACTIVE POWER', kw('352-S2'), 'kW'], ['400V BUS-B CURRENT', v1(ss.amps('352-S2'), 0), 'A'], ['400V BUS-TIE (352B-A3) CURRENT', a('352B-A3'), 'A'], ['400V BUS-TIE (352B-A4) CURRENT', a('352B-A4'), 'A'],
      ['400V BUS-TIE (352B-B3) CURRENT', a('352B-B3'), 'A'], ['400V BUS-TIE (352B-B4) CURRENT', a('352B-B4'), 'A'], ['20KV BUS-A VOLTAGE', V('M20A'), 'kV'], ['20KV BUS-B VOLTAGE', V('M20B'), 'kV'],
      ['400V BUS-A VOLTAGE', v1(ss.volt('M4A'), 1), 'V'], ['400V BUS-B VOLTAGE', v1(ss.volt('M4B'), 1), 'V'], ['DG ACTIVE POWER', v1(dg.kw), 'kW'], ['DG VOLTAGE', v1(dg.v), 'V'], ['DG CURRENT', a('52DG'), 'A'], ['DG FREQUENCY', v1(dg.run ? dg.f : 45.0), 'Hz']];
    return aiScreen('ANALOG INPUT FOR MAIN CONTROL ROOM STATION SERVICE', 5, ai, [['MAIN CONTROL ROOM AMBIENT TEMPERATURE', v1(PC().amb('mch')), '℃']]);
  }

  /* ============================== DAILY POWER OPERATION (layar 00096) ============================== */
  function scrDPO() {
    const pc = PC(), d = pc.dpo, r = d.res, dam = DAM(); let g = title('DAILY POWER OPERATION') + backBtn();
    const ib = (x, y, w, val, act) => `<g ${act ? `data-a="${act}"` : ''}>${R(x, y, w, 21, '', `fill="${act ? '#a0a0a0' : '#000'}" stroke="#ddd"`)}${T(x + w - 4, y + 15, val, 't tr', act ? 'style="fill:#000"' : '')}</g>`;
    g += R(151, 44, 323, 113, 'box') + T(155, 57, 'CALCULATION PARAMETER', 't');
    g += T(155, 81, 'INFLOW', 't') + ib(225, 67, 46, f(d.inflow, 2), 'x:dpo:inflow') + T(276, 81, '[m3/sec]', 't') + T(330, 81, 'BIAS', 't') + ib(370, 67, 50, f(d.bias, 2), 'x:dpo:bias') + T(424, 81, '[m3/sec]', 't');
    g += mline(155, 106, 'GENERATING\nPOWER', 't', 11) + ib(226, 93, 46, f(d.P, 0), 'x:dpo:P') + T(276, 108, '[MW]', 't') + T(305, 108, 'START TIME', 't') + ib(370, 93, 50, f(d.start, 0), 'x:dpo:start') + T(424, 108, ':00', 't');
    g += T(173, 138, 'NEXT START TIME SCHEDULE : AFTER', 't') + ib(370, 123, 50, f(d.next, 0), 'x:dpo:next') + T(424, 138, '[Hr]', 't');
    g += b3(482, 65, 82, 27, 'CALCULATION', '', 'x:dpo:calc') + b3(482, 100, 82, 22, 'UKUR INFLOW', '', 'x:dpo:meas');
    g += R(570, 44, 300, 113, 'box') + T(577, 57, 'CALCULATION RESULT', 't');
    const hh = (x) => String(Math.floor(x)).padStart(2, '0');
    g += T(577, 81, 'INFLOW', 't') + ib(640, 67, 46, r ? f(r.inflow, 2) : '', '') + T(690, 81, '[m3/sec]', 't');
    g += mline(577, 106, 'GENERATING\nPOWER', 't', 11) + ib(640, 93, 46, r ? f(r.P, 0) : '', '') + T(690, 108, '[MW]', 't') + mline(757, 106, 'AVAILABLE\nPERIOD', 't tc', 11) + ib(791, 93, 50, r ? (r.period >= 24 ? '>24' : f(r.period, 1)) : '', '') + T(845, 108, '[Hr]', 't');
    g += T(627, 138, 'POWER GENERATION STOP TIME', 't') + ib(791, 123, 50, r ? (r.period >= 24 ? '--' : hh(r.stop)) : '', '') + T(845, 138, ':00', 't');
    g += R(878, 143, 55, 17, 'box');
    // nilai terakhir
    const tot = pc.totals();
    g += T(85, 95, 'LATEST VALUE', 't tc') + mline(36, 120, 'GENERATING\nPOWER', 't tc', 11) + T(108, 125, 'WATER LEVEL', 't tc') + R(10, 144, 54, 20, 'box') + T(60, 158, f(tot.p, 0), 't tr') + R(81, 144, 54, 20, 'box') + T(131, 158, f(P.intakeWL, 2), 't tr');
    // grafik 48 jam
    const X0 = 150, X1 = 890, Y0 = 183, Y1 = 465, xn = (X0 + X1) / 2, pxh = (X1 - X0) / 48;
    const yW = (w) => Y1 - (w - 575) / 5 * (Y1 - Y0), yP = (p) => Y1 - p / 250 * (Y1 - Y0), yR = (w) => 325 + (157 - w) / 5 * 70;
    g += T(36, 177, '[MW]', 't tc') + T(108, 177, '[Elm]', 't tc') + T(916, 177, '[Elm]', 't tc');
    [[250, 0], [200, 0], [100, 0], [0, 0]].forEach(([v]) => { g += T(25, yP(v) + 4, v, 't tc'); });
    [580.0, 579.1, 578.0, 577.0, 576.0, 575.0].forEach((v) => { g += T(112, yW(v) + 4, f(v, 1), 't tr'); });
    [157, 152, 147].forEach((v) => { g += T(935, yR(v) + 4, v, 't'); });
    g += R(36, Y0, 20, Y1 - Y0, 'box') + `<rect x="37" y="${yP(tot.p)}" width="18" height="${Y1 - yP(tot.p)}" fill="#ff9a10"/>` + R(118, Y0, 20, Y1 - Y0, 'box') + `<rect x="119" y="${yW(P.intakeWL)}" width="18" height="${Y1 - yW(P.intakeWL)}" fill="#22b8e8"/>`;
    g += R(900, Y0, 18, Y1 - Y0, 'box') + `<rect x="901" y="${Math.max(Y0, yR(dam.rwl))}" width="16" height="${Y1 - Math.max(Y0, yR(dam.rwl))}" fill="#22b8e8"/>`;
    g += R(X0, Y0, X1 - X0, Y1 - Y0, 'box');
    for (let k = 1; k < 8; k++) g += L(X0 + k * 6 * pxh, Y0, X0 + k * 6 * pxh, Y1, 'ln');
    const tod = pc.tod() / 3600;
    for (let k = 0; k <= 8; k++) { const h = ((tod - 24 + k * 6) % 24 + 24) % 24; g += T(X0 + k * 6 * pxh, Y1 + 18, `${Math.floor(h)} :${String(Math.round((h % 1) * 60)).padStart(2, '0')}`, 't tc'); }
    g += `<line x1="${X0 - 20}" x2="${X1}" y1="${yW(579.1)}" y2="${yW(579.1)}" stroke="#ddd" stroke-dasharray="2 3"/>` + T(126, yW(579.1) - 4, 'FSL', 't');
    g += `<line x1="${X0 - 20}" x2="${X1}" y1="${yW(578.2)}" y2="${yW(578.2)}" stroke="#ddd" stroke-dasharray="2 3"/>` + T(126, yW(578.2) - 4, 'MOL', 't');
    g += `<line x1="${X0}" x2="${X1 + 10}" y1="${yR(157.5)}" y2="${yR(157.5)}" stroke="#ddd" stroke-dasharray="2 3"/>` + T(872, yR(157.5) - 4, 'HWL', 't');
    // riwayat 24 jam
    const hs = pc.hist.concat([{ t: P.t, p: tot.p, wl: P.intakeWL }]);
    const xt = (t) => xn - (P.t - t) / 3600 * pxh;
    const ptsP = hs.filter((h) => xt(h.t) >= X0).map((h) => `${xt(h.t).toFixed(1)},${yP(h.p).toFixed(1)}`), ptsW = hs.filter((h) => xt(h.t) >= X0).map((h) => `${xt(h.t).toFixed(1)},${yW(h.wl).toFixed(1)}`);
    if (ptsP.length > 1) g += `<polyline points="${ptsP.join(' ')}" fill="none" stroke="#ff9a10" stroke-width="1.6"/><polyline points="${ptsW.join(' ')}" fill="none" stroke="#22c8f0" stroke-width="1.6"/>`;
    // prakiraan
    if (r && r.fc) {
      const off = (P.t - r.at) / 3600;
      const fx = r.fc.map((q) => [xn + (q.h - off) * pxh, q]).filter(([x]) => x >= xn - 1 && x <= X1);
      g += `<polyline points="${fx.map(([x, q]) => `${x.toFixed(1)},${yP(q.p).toFixed(1)}`).join(' ')}" fill="none" stroke="#ff9a10" stroke-dasharray="3 2"/><polyline points="${fx.map(([x, q]) => `${x.toFixed(1)},${yW(q.wl).toFixed(1)}`).join(' ')}" fill="none" stroke="#22c8f0" stroke-dasharray="3 2"/>`;
    }
    g += L(xn, Y0, xn, Y1, '') + `<line x1="${xn}" y1="${Y0}" x2="${xn}" y2="${Y1}" stroke="#ff2020" stroke-width="2.5"/>`;
    // tabel
    const pv = pc.planned();
    const rows = [['GENERATING POWER', f(tot.p, 0), pv ? f(pv.p, 0) : '', pv ? f(tot.p - pv.p, 0) : '', '[MW]'], ['WATER LEVEL', f(P.intakeWL, 2), pv ? f(pv.wl, 2) : '', pv ? f(P.intakeWL - pv.wl, 2) : '', '[Elm]'], ['RE-DAM WATER LEVEL', f(dam.rwl, 2), dam ? f(dam.plannedRWL, 2) : '', f(dam.rwl - dam.plannedRWL, 2), '[Elm]']];
    g += R(190, 495, 463, 120, 'box') + L(316, 495, 316, 615, 'ln') + L(428, 495, 428, 615, 'ln') + L(541, 495, 541, 615, 'ln') + L(190, 530, 653, 530, 'ln');
    g += T(372, 516, 'LATEST VALUE', 't tc') + mline(484, 512, 'PLANED VALUE OF\n(PRESENT TIME)', 't tc', 11) + T(597, 516, 'DIFFERENTIAL', 't tc');
    rows.forEach((rw, i) => { const y = 530 + i * 28; g += T(195, y + 18, rw[0], 't'); [[322, rw[1]], [434, rw[2]], [547, rw[3]]].forEach(([x, v]) => { g += R(x, y + 5, 55, 19, 'box') + T(x + 51, y + 19, v, 't tr') + T(x + 60, y + 19, rw[4], 't'); }); });
    g += mline(820, 555, 'Garis putus-putus = prakiraan hasil CALCULATION.\nAlgoritma: neraca volume intake (kurva f7),\nQ turbin 0.30 m³/s per MW, MOL 578.2 m (dibaca\ndari grafik) – ASUMSI, layar asli tidak\nmencantumkan rumus.', 'ts tc dim', 11);
    return g;
  }

  /* ============================== UNIT DAILY OPERATION SCHEDULE (layar 00031–00035) ============================== */
  const SCH_NAV = (cur) => navRow([['SWITCHYARD/\nSTATION SERVICE\nCONTROL PANEL', 'nav:ssc'], ['SCHEDULE\nRAINY/WEEKDAY', 'nav:sch1'], ['SCHEDULE\nRAINY/WEEKEND', 'nav:sch2'], ['SCHEDULE\nDRY/WEEKDAY', 'nav:sch3'], ['SCHEDULE\nDRY/WEEKEND', 'nav:sch4'], ['SCHEDULE\nARBITRARY SETUP', 'nav:sch5'], ['WATER LEVEL\nCONTROL', 'nav:wlc']], cur) + unitMW();
  const regMode = () => { const pc = PC(); return T(745, 516, 'REGULATION MODE(43SCH/WLC)', 't tc') + ['SCH-1', 'SCH-2', 'SCH-3', 'SCH-4', 'SCH-5', 'WLC'].map((m, i) => b3(561 + i * 64, 525, 62, 26, m, pc.mode === m ? 'yel' : '', `x:pcmode:${m}`)).join(''); };
  function scrSch(k) {
    const pc = PC(), s = pc.sch[k - 1]; let g = title(`UNIT DAILY OPERATION SCHEDULE(${s.name})`) + backBtn();
    const X0 = 82, X1 = 943, Y0 = 48, Y1 = 240, bw = (X1 - X0) / 96, y = (v) => Y1 - Math.min(210, v) / 210 * (Y1 - Y0);
    g += R(X0, Y0, X1 - X0, Y1 - Y0, 'box') + T(70, 52, '210.0MW', 'ts tr') + T(70, Y1 + 2, '0.0MW', 'ts tr');
    for (let j = 1; j < 5; j++) g += `<line x1="${X0}" x2="${X1}" y1="${Y0 + j * (Y1 - Y0) / 5}" y2="${Y0 + j * (Y1 - Y0) / 5}" stroke="#aaa" stroke-dasharray="3 3"/>`;
    s.set.forEach((v, i) => { if (v > 0) g += `<rect x="${X0 + i * bw}" y="${y(v)}" width="${bw - 0.8}" height="${Y1 - y(v)}" fill="#22e0f0"/>`; });
    g += `<polyline points="${s.inp.map((v, i) => `${(X0 + (i + 0.5) * bw).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="#ff2020" stroke-width="1.3"/>`;
    const ci = pc.idx(); g += `<line x1="${X0 + (ci + 0.5) * bw}" x2="${X0 + (ci + 0.5) * bw}" y1="${Y0}" y2="${Y1}" stroke="#ffff40" stroke-dasharray="2 2"/>` + T(X0 + (ci + 0.5) * bw, Y0 - 3, clk(), 'ts tc', 'style="fill:#ffff40"');
    // tabel
    const cw = 35.9, x0 = 80, yH = 257, RH = 27;
    g += R(8, yH, 29, 18, 'box') + T(22, yH + 13, 'MIN', 'ts tc') + R(37, yH, 43, 18, 'box') + T(58, yH + 13, 'HOUR', 'ts tc');
    for (let h = 0; h < 24; h++) g += R(x0 + h * cw, yH, cw, 18, 'box') + T(x0 + h * cw + cw / 2, yH + 13, h, 't tc');
    [0, 15, 30, 45].forEach((mn, q) => {
      const y1 = yH + 18 + q * 2 * RH;
      g += R(8, y1, 29, 2 * RH, 'box') + T(12, y1 + 12, mn, 't') + R(37, y1, 43, RH, 'box') + mline(42, y1 + 14, 'SET\nVALUE', 'ts', 9) + R(37, y1 + RH, 43, RH, 'box') + mline(42, y1 + RH + 14, 'INPUT\nVALUE', 'ts', 9);
      for (let h = 0; h < 24; h++) {
        const i = h * 4 + q, sv = s.set[i], iv = s.inp[i], x = x0 + h * cw, cur = i === ci && pc.mode === s.key;
        g += R(x, y1, cw, RH, 'box', cur ? 'style="stroke:#ffff40;stroke-width:2"' : '') + T(x + cw - 4, y1 + 19, sv, 't tr', 'style="font-size:13px;font-weight:bold"');
        g += `<g data-a="x:schin:${k}:${i}"><rect x="${x + 2}" y="${y1 + RH + 2}" width="${cw - 4}" height="${RH - 4}" fill="${iv !== sv ? '#ffff20' : '#c0c0c0'}" stroke="#fff"/>${T(x + cw - 6, y1 + RH + 18, iv, 't tr', 'style="fill:#000;font-size:11px"')}</g>`;
      }
    });
    g += b3(17, 525, 98, 26, 'LOAD/SAVE', '', `x:schls:${k}`) + b3(220, 525, 98, 26, 'SET', '', `x:schset:${k}`) + b3(332, 525, 98, 26, 'CANCEL', '', `x:schcan:${k}`) + regMode();
    g += T(450, 516, s.src.startsWith('ASUMSI') ? s.src : '', 'ts dim');
    g += T(445, 545, `jam simulasi ${clk()}`, 'ts', 'style="fill:#ffff40"') + `<g data-a="x:setclk">${R(445, 549, 90, 14, '', 'fill="#333" stroke="#888"')}${T(490, 559, 'SET JAM', 'ts tc')}</g>`;
    g += SCH_NAV(`sch${k}`);
    return g;
  }

  /* ============================== WATER LEVEL CONTROL (layar 00036) ============================== */
  function scrWLC() {
    const pc = PC(), w = pc.wlc; let g = title('WATER LEVEL CONTROL') + backBtn();
    const wl = P.intakeWL, ylv = (v) => 229 - (Math.max(575, Math.min(580, v)) - 575) / 5 * 157;
    g += T(157, 54, 'INTAKE DAM LEVEL', 't tc') + T(50, 76, '580.0 Elm', 't') + T(50, 233, '575.0 Elm', 't') + L(93, 72, 93, 229, 'ln') + L(93, 229, 158, 229, 'ln') + L(158, 229, 248, 72, 'ln');
    const yy = ylv(wl), xs = 158 + (229 - yy) / 157 * 90;
    g += `<polygon points="94,229 158,229 ${xs},${yy} 94,${yy}" fill="#1a6ab8" opacity=".75"/><line x1="94" x2="${xs}" y1="${yy}" y2="${yy}" stroke="#4ce0ff" stroke-width="1.5"/>`;
    g += T(270, 167, 'CURRENT LEVEL', 't') + T(330, 182, `${f(wl, 2)}  Elm`, 't tr cy');
    // trend 12 jam
    g += T(654, 54, 'INTAKE DAM LEVEL TREND', 't tc') + R(382, 72, 540, 158, 'box');
    for (let j = 1; j < 7; j++) g += `<line x1="382" x2="922" y1="${72 + j * 158 / 7}" y2="${72 + j * 158 / 7}" stroke="#bbb" stroke-dasharray="3 3"/>`;
    for (let j = 1; j <= 6; j++) { const x = 382 + j * 90; g += L(x, 72, x, 230, '') + T(x, 247, `${j * 2}hr`, 't tc'); }
    const hs = w.hist.concat([[P.t, wl]]), t0 = P.t - 12 * 3600;
    const pts = hs.filter(([t]) => t >= t0).map(([t, v]) => `${(382 + (t - t0) / 43200 * 540).toFixed(1)},${ylv(v).toFixed(1)}`);
    if (pts.length > 1) g += `<polyline points="${pts.join(' ')}" fill="none" stroke="#4ce0ff" stroke-width="1.5"/>`;
    g += `<line x1="382" x2="922" y1="${ylv(w.sp)}" y2="${ylv(w.sp)}" stroke="#ffff40" stroke-dasharray="5 3"/>` + T(918, ylv(w.sp) - 3, 'SET POINT', 'ts tr', 'style="fill:#ffff40"');
    // diagram blok
    const blk = (x, y, s) => R(x, y, 18, 18, 'box') + T(x + 9, y + 13, s, 't tc');
    g += b3(22, 267, 133, 25, 'WATER LEVEL\nSET POINT', '', 'x:wlcsp') + R(24, 295, 135, 27, 'box') + T(150, 313, `${f(w.sp, 2)}  Elm`, 't tr');
    g += R(24, 333, 135, 53, 'box') + mline(91, 350, 'CURRENT\nWATER LEVEL', 't tc', 11) + L(24, 360, 159, 360, 'ln') + T(150, 378, `${f(wl, 2)}  Elm`, 't tr');
    g += L(155, 296, 217, 296, 'ln') + `<path d="M217,288 L235,288 L226,304 Z" fill="#000" stroke="${C.wht}"/>` + T(226, 299, 'Δ', 'ts tc') + T(209, 290, '-', 't') + T(229, 318, '+', 't');
    g += L(159, 365, 228, 365, 'ln') + L(228, 365, 228, 304, 'ln') + L(228, 365, 228, 490, 'ln') + L(228, 490, 361, 490, 'ln') + `<circle cx="228" cy="365" r="2" fill="#fff"/>`;
    g += L(235, 296, 306, 296, 'ln') + `<circle cx="270" cy="296" r="2" fill="#fff"/>` + blk(306, 288, 'D') + mline(316, 318, '15min\nCYCLE', 't tc', 11) + L(324, 296, 397, 296, 'ln') + blk(397, 288, 'P') + L(415, 296, 487, 296, 'ln') + blk(487, 288, '+') + L(505, 296, 577, 296, 'ln') + blk(577, 288, '×') + L(595, 296, 653, 296, 'ln');
    g += L(270, 296, 270, 388, 'ln') + L(270, 388, 361, 388, 'ln') + L(450, 388, 495, 388, 'ln') + L(495, 388, 495, 306, 'ln') + L(450, 490, 586, 490, 'ln') + L(586, 490, 586, 306, 'ln');
    const curve = (x, y, pts, sx, sy, mark) => { let s = R(x, y, 89, 89, 'box') + L(x + 44, y, x + 44, y + 89, 'ln') + `<path d="M${x + 40},${y + 6} L${x + 44},${y} L${x + 48},${y + 6}" fill="none" stroke="#fff"/>`;
      s += `<polyline points="${pts.map(([a, b]) => `${(x + sx(a)).toFixed(1)},${(y + sy(b)).toFixed(1)}`).join(' ')}" fill="none" stroke="#22e0f0" stroke-width="1.5"/>`;
      if (mark) s += `<circle cx="${x + sx(mark[0])}" cy="${y + sy(mark[1])}" r="3" fill="#ffff40"/>`; return s; };
    const e = wl - w.sp, F1 = M.PlantCtrl.F1, F2 = M.PlantCtrl.F2;
    const ipl = (pts, x0) => { if (x0 <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (x0 <= pts[i][0]) { const [a, b] = pts[i - 1], [c, d] = pts[i]; return b + (d - b) * (x0 - a) / (c - a); } return pts[pts.length - 1][1]; };
    g += curve(361, 342, F1, (a) => 44 + a / 1.5 * 42, (b) => 44 - b / 45 * 40, [Math.max(-1.5, Math.min(1.5, e)), ipl(F1, e)]);
    g += curve(361, 446, F2, (a) => (a - 575) / 6 * 86 + 3, (b) => 80 - (b - 0.8) / 1.3 * 60, [Math.max(575, Math.min(581, wl)), ipl(F2, wl)]);
    g += R(653, 268, 135, 52, 'box') + mline(720, 281, 'WATER LEVEL CONTROL\nCOMPENSATION VALUE', 't tc', 11) + L(653, 292, 788, 292, 'ln') + T(750, 312, `${f(w.comp)}  MW`, 't tr');
    g += R(653, 334, 135, 52, 'box') + mline(720, 347, 'JOINT CONTROL\nSET POINT VALUE', 't tc', 11) + L(653, 358, 788, 358, 'ln') + T(750, 378, `${f(pc.jP)}  MW`, 't tr');
    g += R(801, 334, 135, 52, 'box') + T(868, 352, 'TOTAL MW', 't tc') + L(801, 358, 936, 358, 'ln') + T(898, 378, `${f(pc.totals().p)}  MW`, 't tr');
    g += T(800, 420, pc.mode === 'WLC' ? `WLC aktif · siklus berikut ${Math.ceil((w.cyc - w.t) / 60)} menit` : 'WLC tidak aktif (pilih WLC pada 43SCH/WLC)', 'ts tc', `style="fill:${pc.mode === 'WLC' ? '#ffff40' : '#888'}"`);
    g += mline(800, 455, 'Gain P, kurva fungsi & faktor level = ASUMSI\n(bentuk mengikuti layar 00036). Set point layar\nasli 575.00 m; simulator memakai 578.60 m.', 'ts tc dim', 11);
    g += regMode() + SCH_NAV('wlc');
    return g;
  }

  /* ============================== INTAKE DAM & REREGULATING DAM (layar 00022) ============================== */
  function scrDamOPS() {
    const d = DAM(); let g = title('INTAKE DAM & REREGULATING DAM') + backBtn();
    const X = [12, 80, 98, 160, 228, 290, 352, 415, 480, 542, 605];
    g += T(130, 64, 'POS.', 't tc') + T(194, 64, 'SET POS.', 't tc');
    const rows = [['SPILLWAY\nFLAP GATE', 3, (i) => [f(d.flap[i], 0), '%'], (i) => `x:damset:flap:${i}`], ['SPILLWAY\nGATE', 3, (i) => [f(d.sg[i] * 100, 0), 'cm'], (i) => `x:damset:sg:${i}`],
      ['SLUICE\nGATE', 2, (i) => [d.isl[i] > 0 ? 'OPEN' : 'CLOSE', '']], ['UPPER\nSCOURING\nGATE', 2, (i) => [f(d.usg[i] * 100, 0), 'cm']], ['LOWER\nSCOURING\nGATE', 2, (i) => [d.lsg[i] > 0 ? 'OPEN' : 'CLOSE', '']],
      ['INTAKE\nGATE', 2, (i) => [d.ig[i] ? 'OPEN' : 'CLOSE', '']], ['RAKING\nEQUIPMENT', 1, () => [d.rake ? 'RUN' : 'STOP', '']]];
    let y = 72;
    for (const [lab, nr, val, act] of rows) {
      const h = nr === 1 ? 22 : 22.6;
      g += R(X[0], y, X[1] - X[0], h * nr, 'box') + mline((X[0] + X[1]) / 2, y + h * nr / 2 + 3, lab, 'ts tc', 9);
      for (let i = 0; i < nr; i++) {
        const yy = y + i * h, [v, u] = val(i);
        if (nr > 1) g += R(X[1], yy, X[2] - X[1], h, 'box') + T(89, yy + 15, `-${i + 1}`, 'ts tc'); else g += R(X[1], yy, X[2] - X[1], h, 'box');
        g += R(X[2], yy, X[3] - X[2], h, 'box') + T(X[3] - 18, yy + 15, v, 't tr') + T(X[3] - 4, yy + 15, u, 'ts tr');
        g += act ? b3(X[3] + 1, yy + 1, 65, h - 2, `${act ? (u === '%' ? f(d.flapSet[i], 0) : f(d.sgSet[i] * 100, 0)) : ''} ${u}`, '', act(i)) : R(X[3], yy, X[4] - X[3], h, 'box');
        for (let c = 4; c < X.length - 1; c++) g += R(X[c], yy, X[c + 1] - X[c], h, 'box');
      }
      y += h * nr;
    }
    // skema
    g += `<path d="M620,50 L940,50 L915,85 L645,85 Z" fill="#888"/><path d="M630,52 L930,52 L910,80 L650,80 Z" fill="#3a7ae8"/>` + T(780, 69, 'INTAKE DAM', 't tc');
    g += `<rect x="666" y="85" width="12" height="105" fill="#bbb"/><rect x="690" y="85" width="12" height="105" fill="#bbb"/><path d="M666,190 Q684,214 702,190" fill="none" stroke="#bbb" stroke-width="12"/>`;
    g += `<rect x="666" y="110" width="36" height="10" fill="#111"/><rect x="666" y="125" width="36" height="5" fill="#111"/>`;
    for (let k = 0; k < 6; k++) { const x = 778 + k * 16; g += `<rect x="${x}" y="80" width="11" height="105" fill="${k < 3 && d.sg[k] > 0.01 ? '#6ac8ff' : '#2a5ad8'}"/>`; }
    g += `<rect x="776" y="${130}" width="100" height="5" fill="#fff" opacity=".6"/><path d="M778,185 L874,185 L888,262 L770,262 Z" fill="#2a8af0"/>` + T(829, 274, 'MUSI RIVER', 't tc');
    g += T(620, 112, 'INTAKE', 't') + T(620, 122, 'GATE', 't') + mline(722, 113, 'SLUICE\nGATE', 't', 10) + mline(722, 145, 'UPPER\nSCOURING\nGATE', 't', 10) + mline(722, 180, 'LOWER\nSCOURING\nGATE', 't', 10) + mline(883, 114, 'SPILLWAY\nFLAP GATE', 't', 11) + mline(883, 148, 'SPILLWAY\nGATE', 't', 11);
    g += `<rect x="678" y="200" width="12" height="230" fill="#bbb"/><path d="M640,305 L640,290 L728,290 L728,330" fill="none" stroke="#bbb" stroke-width="10"/><rect x="635" y="300" width="10" height="130" fill="#bbb"/><rect x="723" y="300" width="10" height="130" fill="#bbb"/>`;
    [[638, 3], [684, 2], [728, 1]].forEach(([x, n]) => { const run = U(n).p.cb; g += `<g data-a="nav:ovw${n}"><circle cx="${x}" cy="365" r="15" fill="${run ? '#ff2020' : '#180000'}" stroke="#ff2020"/>${mline(x, 365, `UNIT\nNo.${n}`, 'ts tc', 9)}</g>`; });
    g += `<path d="M640,430 L733,430 L733,415 M376,430 L640,430" fill="none" stroke="#bbb" stroke-width="10"/><path d="M376,430 L376,445" fill="none" stroke="#bbb" stroke-width="10"/>`;
    g += `<path d="M335,445 L430,445 L415,478 L350,478 Z" fill="#888"/><path d="M340,447 L425,447 L413,474 L352,474 Z" fill="#3a7ae8"/>` + mline(382, 458, 'REREGULATING\nDAM', 'ts tc', 9);
    g += `<rect x="352" y="478" width="10" height="70" fill="#bbb"/><rect x="372" y="478" width="10" height="120" fill="#bbb"/><path d="M352,540 Q367,560 382,540" fill="none" stroke="#bbb" stroke-width="10"/>`;
    // tabel nilai
    const qT = d.qTurb(), inT = d.qnEst, gI = P.spillQ, gR = d.rOut, V7 = (189.475 * P.intakeWL ** 2 - 218232.925 * P.intakeWL + 62839304.175), V6 = (d.rwl > 150 ? 17.425 * d.rwl ** 2 - 5221.875 * d.rwl + 391245.75 : 6 * d.rwl - 873);
    const tb = [['WATER LEVEL', `${f(P.intakeWL, 2)} Elm`, `${f(d.rwl, 2)} Elm`], ['INFLOW', `${f(inT, 1)} m3/s`, `${f(d.rIn, 1)} m3/s`], ['OUTFLOW', `${f(qT, 1)} m3/s`, `${f(gR, 1)} m3/s`],
      ['TOTAL GATE\nDISCHARGE', `${f(gI, 1)} m3/s`, `${f(gR, 1)} m3/s`], ['TOTAL\nDISCHARGE', `${f(qT + gI, 1)} m3/s`, `${f(gR, 1)} m3/s`], ['STORAGE VOLUME', `${f(V7, 0)} x1000m3`, `${f(V6, 0)} x1000m3`]];
    g += R(12, 447, 306, 18, 'box') + L(102, 447, 102, 612, 'ln') + L(210, 447, 210, 612, 'ln') + T(156, 460, 'INTAKE DAM', 't tc') + T(264, 460, 'REREGULATING DAM', 't tc');
    tb.forEach(([a, b, c], i) => { const yy = 465 + i * 24.5; g += R(12, yy, 306, 24.5, 'box') + mline(15, yy + 15, a, 'ts', 9) + T(204, yy + 16, b, 't tr') + T(312, yy + 16, c, 't tr'); });
    g += L(102, 447, 102, 612, 'ln') + L(210, 447, 210, 612, 'ln');
    // re-dam gates
    g += T(537, 498, 'POS.', 't tc') + T(602, 498, 'SET POS.', 't tc');
    g += R(412, 507, 90, 22, 'box') + mline(457, 520, 'REREGULATING\nGATE', 'ts tc', 9) + R(502, 507, 65, 22, 'box') + T(552, 522, f(d.rg * 100, 0), 't tr') + T(563, 522, 'cm', 'ts tr') + b3(568, 508, 65, 20, `${f(d.rgSet * 100, 0)} cm`, '', 'x:damset:rg:0') + R(633, 507, 312, 22, 'box');
    g += R(412, 529, 72, 46, 'box') + mline(448, 553, 'REREGULATING\nSCOURING\nGATE', 'ts tc', 9);
    [0, 1].forEach((i) => { const yy = 529 + i * 23; g += R(484, yy, 18, 23, 'box') + T(493, yy + 15, `-${i + 1}`, 'ts tc') + R(502, yy, 65, 23, 'box') + T(552, yy + 16, f(d.sl[i] * 100, 0), 't tr') + T(563, yy + 16, 'cm', 'ts tr') + R(567, yy, 378, 23, 'box'); });
    g += T(650, 640, 'Flap/sluice/scouring/intake gate & raking: posisi saja (kurva debit tidak tersedia). Scouring gate re-dam = sluice gate JEZ2K042.', 'ts tc dim');
    return g;
  }

  /* ============================== ANALOG INPUT (HTML) ============================== */
  const tr = (cells, cls = '') => `<tr class="${cls}">${cells.map((c, i) => i ? `<td class="n">${c}</td>` : `<td>${esc(c)}</td>`).join('')}</tr>`;
  function aiDam() {
    const d = DAM();
    const rows = [['INTAKE WATER LEVEL (7AI0011)', `${f(P.intakeWL, 3)} El.m`], ['INTAKE DAM WL (7AI0007)', `${f(P.intakeWL, 3)} El.m`], ['Volume intake (f7)', `${f(volI(P.intakeWL), 0)} ×10³ m³`],
      ['Inflow alami (setelan)', `${f(P.inflow, 1)} m³/s`], ['Inflow terhitung (7PAI)', `${f(d.qnEst, 1)} m³/s`], ...[0, 1, 2].map((i) => [`Spillway gate-${i + 1} posisi (7AI000${1 + 2 * i})`, `${f(d.sg[i] * 100, 0)} cm`]),
      ...[0, 1, 2].map((i) => [`Spillway gate-${i + 1} debit (7PAI00${17 + i})`, `${f(d.qSpill(d.sg[i]), 1)} m³/s`]), ...[1, 2, 3].map((n) => [`Debit turbin unit ${n} (${n}AI0015)`, `${f(U(n).meas().flow, 2)} m³/s`]),
      ['RE-DAM UPSTREAM WL (8AI0002)', `${f(d.rwl, 3)} El.m`], ['Volume re-dam (f6)', `${f(volR(d.rwl), 1)} ×10³ m³`], ['Regulating gate posisi (8AI0001)', `${f(d.rg * 100, 0)} cm`],
      ['Sluice gate-1 / gate-2', `${f(d.sl[0] * 100, 0)} / ${f(d.sl[1] * 100, 0)} cm`], ['Outflow re-dam', `${f(d.rOut, 1)} m³/s`], ['Natural flow Qn (8PAI0017)', `${f(d.rQn, 1)} m³/s`]];
    return `<div class="h2">ANALOG INPUT – INTAKE & RE-REGULATING DAM</div><table class="tbl" style="max-width:720px;margin:0 auto"><tr><th>Titik</th><th>Nilai</th></tr>${rows.map((r) => tr(r)).join('')}</table>
      <div class="row" style="justify-content:center;display:flex;gap:6px"><span class="sb" data-a="nav:dam" style="background:#b4b4b4;color:#111;padding:4px 8px;cursor:pointer">INTAKE & RE-DAM ▶</span></div>`;
  }
  /* ============================== REGISTRASI ============================== */
  Object.assign(EXTS, {
    sso: { no: '00005', title: () => 'STATION SERVICE OVERVIEW', grp: 'stv', draw: scrSSO },
    mch: { no: '00003', title: () => 'MAIN CONTROL HOUSE', grp: 'stv', draw: scrMCH },
    uph: { no: '00004', title: () => 'UNDERGROUND POWERHOUSE', grp: 'stv', draw: scrUPH },
    ssc: { no: '00027', title: () => 'SWITCHYARD/STATION SERVICE CONTROL PANEL', grp: 'ctl', draw: scrSSC },
    air: { no: '00010', title: () => 'AIR SUPPLY SYSTEM', grp: 'airg', draw: scrAir },
    rain: { no: '00023', title: () => 'RAIN FALL MONITOR', grp: 'airg', draw: scrRain },
    dam: { no: '00022', title: () => 'INTAKE DAM & REREGULATING DAM', grp: 'dam', draw: scrDamOPS },
    wlc: { no: '00036', title: () => 'WATER LEVEL CONTROL', grp: 'dam', draw: scrWLC },
    damx: { no: '00062', title: () => 'INTAKE & RE-DAM – DETAIL RTU (INSTRUKTUR)', grp: 'dam', draw: scrDamX },
    rdc: { no: '00063', title: () => 'RE-REGULATING DAM CONTROL (JEZ2K042)', grp: 'dam', html: true, draw: scrRDC },
    aidam: { no: '00087', title: () => 'RTU ANALOG INPUT (DAM)', grp: 'aig', html: true, draw: aiDam },
    aiuss: { no: '00084', title: () => 'ANALOG INPUT FOR UNDERGROUND S/S', grp: 'aig', draw: aiUSS },
    aimss: { no: '00085', title: () => 'ANALOG INPUT FOR MAIN CONTROL ROOM S/S', grp: 'aig', draw: aiMSS },
    aisy: { no: '00086', title: () => 'ANALOG INPUT FOR SWITCHYARD', grp: 'aig', draw: aiSY },
    dpo: { no: '00096', title: () => 'DAILY POWER OPERATION', grp: 'dpog', draw: scrDPO },
  });
  [1, 2, 3, 4, 5].forEach((k) => { EXTS['sch' + k] = { no: '0003' + k, title: () => `UNIT DAILY OPERATION SCH.(${PC().sch[k - 1].name})`, grp: 'schg', draw: () => scrSch(k) }; });
  EXTU.tact = { no: (n) => '000' + (8 + n) + (n === 1 ? '1' : ''), title: (n) => `NO.${n} UNIT HYDRAULIC TURBINE ACTUATOR CON`, grp: 'sys', draw: scrTact };
  EXTU.tact.no = (n) => ['00011', '00012', '00013'][n - 1];
  EXTU.ivh = { no: (n) => ['00014', '00015', '00016'][n - 1], title: (n) => `NO.${n} UNIT INLET VALVE HYDRAULIC CONTROL`, grp: 'sys', draw: scrIVH };
  TABS.stv = () => [['sso', 'S/S OVERVIEW'], ['sy', '150kV SWITCHYARD'], ['mch', 'MAIN CONT. HOUSE'], ['uph', 'UNDER.POWERHOUSE'], ['trend', 'Historical']];
  TABS.ctl = () => [['ssc', 'SY/SS CONTROL'], ['ctl1', 'NO.1 CONTROL PNL'], ['ctl2', 'NO.2 CONTROL PNL'], ['ctl3', 'NO.3 CONTROL PNL'], ['sy', '150kV SY'], ['trend', 'Historical']];
  TABS.dam = () => [['dam', 'INTAKE & REREG.'], ['wlc', 'WATER LEVEL CONT'], ['damx', 'DETAIL RTU'], ['rdc', 'RE-DAM CONTROL'], ['trend', 'Historical']];
  TABS.airg = () => [['air', 'AIR SYSTEM'], ['rain', 'RAIN FALL MONI.'], ['trend', 'Historical']];
  TABS.aig = () => [['aiuss', 'USS ANALOG INPUT'], ['aimss', 'MSS ANALOG INPUT'], ['aisy', 'SY ANALOG INPUT'], ['aidam', 'RTU ANALOG INPUT'], ['ai1', 'UNIT1 ANALOG'], ['trend', 'Historical']];
  TABS.schg = () => [['sch1', 'SCHEDULE SET-1'], ['sch2', 'SCHEDULE SET-2'], ['sch3', 'SCHEDULE SET-3'], ['sch4', 'SCHEDULE SET-4'], ['sch5', 'SCHEDULE SET-5'], ['trend', 'Historical']];
  TABS.dpog = () => [['dpo', 'DAILY POWER OPE.'], ['dam', 'INTAKE & REREG.'], ['wlc', 'WATER LEVEL CONT'], ['trend', 'Historical']];
  const sys0 = TABS.sys; TABS.sys = (n) => { const b = sys0(n); return [b[0], [`tact${n}`, `NO.${n} GV OIL SYS.`], [`ivh${n}`, `NO.${n} IV OIL SYS.`], ...b.slice(1)]; };

  /* ============================== AKSI ============================== */
  const MAC = {
    mchopen: ['252-LS', '252DL-BC', '252DL-ID', '252DL-RD', '252B-A1', '252B-A2', '252B-B1', '252B-B2', '352-S1', '352-S2', '352-BT2', '352-BT3', '352B-A3', '352B-A4', '352B-B3', '352B-B4', '52DG'].map((k) => [k, false]),
    mchnormal: [['352-BT2', false], ['352-BT3', false], ['52DG', false], ['352B-A3', false], ['352B-A4', false], ['352B-B3', false], ['352B-B4', false], ['252DL-BC', false],
      ['289B', false], ['289-LSA', true], ['289-LSB', true], ['252-LS', true], ['252B-A1', true], ['252B-B1', true], ['352-S1', true], ['352-S2', true], ['352B-A3', true], ['352B-B4', true],
      ['252DL-ID', true], ['252DL-RD', true], ['252B-A2', true], ['252B-B2', true]],
    phnormal: [['352-BT1', false], ...[1, 2, 3].flatMap((n) => [['452-' + n, false], [`352-${n}1`, false], [`352-${n}2`, false]]), ['289L-1', true], ['289L-2', true], ['252-L1', true], ['252-L2', true],
      ['352-L1', true], ['352-L2', true], ['352-11', true], ['352-21', true], ['352-31', true]],
  };
  const MAC_LAB = { mchopen: 'MAIN CONTROL HOUSE CB OPEN', mchnormal: 'MCH NORMAL (catu dari LSTr)', phnormal: 'POWER SUPPLY TO POWERHOUSE' };
  const MAC_TXT = { mchopen: 'Membuka semua CB 20 kV & 400 V di main control house (termasuk 52DG).\nPowerhouse kehilangan catu dari kabel.',
    mchnormal: 'Mengembalikan MCH ke catu LSTr:\nBT2/BT3, 52DG, feeder → OPEN; 289-LSA/B → CLOSE; 252-LS; SSTr3/4;\nfeeder A3/B4; ID/RD; cable feeder 1/2.\nSyarat: 152-LST (switchyard) CLOSE.',
    phnormal: 'Mengembalikan powerhouse ke catu SSTr No.1/No.2 (transfer bus mati):\nsemua breaker unit & BT1 OPEN → 252-L1/L2 → 352-L1/L2 → 352-11/21/31.\nMCC unit padam ± 3 detik.' };
  const numDlg = (ttl, msg, cur, unit, step, fn) => dialog(ttl, msg, () => { const v = parseFloat(document.querySelector('#dX input').value); if (!isNaN(v)) fn(v); },
    { extra: `<div class="drow"><span class="grow"></span><input type="number" step="${step}" value="${cur}"> ${unit}</div>`, okText: 'SET' });
  const btnRow = (items) => `<div class="simgrid">${items.map(([a, l]) => `<button data-a="${a}">${l}</button>`).join('')}</div>`;
  Object.assign(EXTA, {
    ssd: ([id]) => {
      const ss = SS(), d = DEV[id]; if (!d) return;
      const cur = !!ss.st[id], why = PC().ssBlock(id) || ss.interlock(id, !cur);
      const kind = { CB: 'CIRCUIT BREAKER', DS: 'DISCONNECTING SWITCH', ES: 'EARTHING SWITCH' }[d.t];
      const loc = { MCH20: 'MCH 20 kV', MCH04: 'MCH 400 V', PH20: 'P/H 20 kV', PH04: 'P/H 400 V' }[d.loc] + (d.p ? ` · panel ${d.p}` : '');
      const msg = `${id}  (${kind})\n${d.desc}\n${loc} · interlock: ${d.src === 'doc' ? 'logic Alstom' : d.src}\n\n${cur ? 'CLOSE' : 'OPEN'} → ${cur ? 'OPEN' : 'CLOSE'}` +
        (ss.tripFlag[id] ? `\n\nTRIP: ${ss.tripFlag[id]}` : '') + (d.note ? `\n\nCatatan: ${d.note}` : '') +
        `\n\nSyarat ${cur ? 'OPEN' : 'CLOSE'}: ${ss.exprText(cur ? d.open : d.close)}` + (why ? `\n\nINTERLOCK – belum terpenuhi:\n• ${why.split('; ').join('\n• ')}` : '\n\nEXECUTE ?');
      dialog('STATION SERVICE CONTROL', msg, why ? null : () => ss.operate(id, !cur));
    },
    ssr: ([id]) => { const ss = SS(), r = REL[id]; dialog('UNDER VOLTAGE RELAY 27', `${id}\n${r[1]}\n${r[2]}\n\nStatus: ${ss.rel[id] ? 'OPERATE (tegangan hilang ≥ 2 s)' : 'RESET (bertegangan)'}\n\nDipakai sebagai syarat interlock: "27 ON" = tegangan hilang.`, null); },
    ssmac: ([k]) => dialog('MANUVER', `${MAC_LAB[k]}\n\n${MAC_TXT[k]}\n\nEXECUTE ?`, () => {
      const ss = SS(); let done = 0;
      for (const [id, c] of MAC[k]) { if (!!ss.st[id] === c) continue; const w = ss.operate(id, c, 'MANUVER'); if (w) { dialog('MANUVER BERHENTI', `${MAC_LAB[k]}\n\nBerhenti pada ${id} ${c ? 'CLOSE' : 'OPEN'}:\n${w}\n\n${done} langkah sudah dijalankan.`, null); return; } done++; }
      if (k === 'mchnormal' && ss.dg.cmd) ss.dgStop('MANUVER');
      P.log('OK', `SS: ${MAC_LAB[k]} selesai (${done} langkah)`);
    }),
    ssfr: ([loc]) => { SS().flickerReset(loc || ''); },
    ssdgd: () => { const dg = SS().dg; dialog('DIESEL GENERATOR (52DG)', `Status: ${dg.run ? 'RUNNING' : dg.cmd ? 'STARTING' : 'STOP'}${dg.fail ? ' · START FAILURE' : ''}\n${f(dg.v)} V · ${f(dg.f)} Hz · ${f(dg.kw)} kW · jam operasi ${f(dg.hrs, 2)} h\n\nChangeover otomatis (343ASR): ${PC().sel.s343ASR}\nRating DG belum ada data; start ± 8 s, 84DG + 5 s (asumsi).`, null,
      { extra: btnRow([['x:ssdg:start', 'DG START'], ['x:ssdg:stop', 'DG STOP'], ['x:ssmac:mchnormal', 'MCH NORMAL']]) }); },
    ssdg: ([c]) => { X.closeDlg(); dialog('DIESEL GENERATOR', `DG ${c === 'start' ? 'START' : 'STOP'}\n\nEXECUTE ?`, () => { const w = PC().ssBlock('52DG'); if (w) { P.log('ALARM', `SS: DG ${c.toUpperCase()} ditolak – ${w}`); return; } c === 'start' ? SS().dgStart() : SS().dgStop(); }); },
    // selector panel SY/SS
    sysel: ([k, v]) => { const sy = P.sy, val = v === 'true' ? true : v === 'false' ? false : v; if (sy.sel[k] === val) return; const lab = typeof val === 'boolean' ? (val ? 'USE' : 'LOCK') : val;
      const nm = { s143STEP: '143STEP', s143R: '143R', busProt: 'BUS BAR PROTECTION', L1ar: 'AUTO RECLOSING T/L NO.1', L2ar: 'AUTO RECLOSING T/L NO.2' }[k];
      dialog('SELECT', `SWITCHYARD\n${nm} → ${lab}\n\nEXECUTE ?`, () => { sy.sel[k] = val; P.log('CMD', `SY: ${nm} ${lab}`); }); },
    pcsel: ([k, v]) => { const pc = PC(); if (pc.sel[k] === v) return; const nm = { s343STEP: '343STEP', s443STEP: '443STEP', s343R: '343R', s443R: '443R', s343ASR: '343ASR', car1: 'CARRIER RELAY T/L NO.1', car2: 'CARRIER RELAY T/L NO.2' }[k];
      dialog('SELECT', `${nm} → ${v}${k === 's343ASR' ? '\n(changeover otomatis station service MSSLCU & USSLCU)' : ''}${k.startsWith('car') ? '\n(status saja – skema teleproteksi tidak dimodelkan)' : ''}\n\nEXECUTE ?`, () => { pc.sel[k] = v; P.log('CMD', `PLANT: ${nm} ${v}`); }); },
    pcmode: ([m]) => { const pc = PC(), nv = pc.mode === m ? null : m;
      dialog('REGULATION MODE (43SCH/WLC)', `${nv ? `43SCH/WLC → ${nv}` : `${m} → OFF (set point joint manual)`}\n\nUnit dengan ALR = JOINT mengikuti set point joint.\nUnit JOINT saat ini: ${P.units.filter((u) => pc.alrMode(u) === 'JOINT').map((u) => 'U' + u.n).join(', ') || 'tidak ada'}\n\nEXECUTE ?`, () => pc.setMode(nv)); },
    pcjp: () => { const pc = PC(); if (pc.mode) { dialog('MESSAGE', `Set point joint dikendalikan oleh ${pc.mode}.\nMatikan 43SCH/WLC untuk set manual.`, null); return; } numDlg('JOINT CONTROL SET POINT', 'Active power total (MW)', f(pc.jP), 'MW', 1, (v) => { pc.jPman = pc.jP = Math.max(0, Math.min(216, v)); P.log('CMD', `PLANT: joint control set point = ${pc.jP} MW`); }); },
    pcjq: () => { const pc = PC(); numDlg('JOINT CONTROL SET POINT', 'Reactive power total (MVar)', f(pc.jQ), 'MVar', 1, (v) => { pc.jQ = Math.max(-120, Math.min(150, v)); P.log('CMD', `PLANT: joint control set point Q = ${pc.jQ} MVar`); }); },
    ualr: ([n, m]) => { const pc = PC(), u = U(+n); if (pc.alrMode(u) === m) return; dialog('ALR CONTROL MODE', `UNIT NO.${n}\nALR → ${m}\n\nEXECUTE ?`, () => { pc.setAlr(u, m); P.log('CMD', `U${n}: ALR CONTROL MODE ${m}`); }); },
    uaqr: ([n, m]) => { const pc = PC(), u = U(+n); if (pc.aqrMode(u) === m) return; dialog('AQR CONTROL MODE', `UNIT NO.${n}\nAQR → ${m}\n\nEXECUTE ?`, () => { pc.setAqr(u, m); P.log('CMD', `U${n}: AQR CONTROL MODE ${m}`); }); },
    ualrsp: ([n]) => { const u = U(+n), pc = PC(); if (pc.alrMode(u) !== 'INDIVIDUAL') { dialog('MESSAGE', `ALR SET POINT unit ${n} hanya dapat diubah pada mode INDIVIDUAL.`, null); return; } numDlg('ALR SET POINT', `UNIT NO.${n}`, f(u.sw.alrSP), 'MW', 0.5, (v) => { u.sw.alrSP = Math.max(u.sw.minP, Math.min(u.sw.maxP, v)); P.log('CMD', `U${n}: ALR SET POINT ${u.sw.alrSP} MW`); }); },
    uaqrsp: ([n]) => { const u = U(+n), pc = PC(); if (pc.aqrMode(u) !== 'SEMI AUTO') { dialog('MESSAGE', `AQR SET POINT unit ${n} hanya dapat diubah pada mode SEMI AUTO.`, null); return; } numDlg('AQR SET POINT', `UNIT NO.${n}`, f(u.sw.aqrSP), 'MVar', 0.5, (v) => { u.sw.aqrSP = Math.max(-40, Math.min(50, v)); P.log('CMD', `U${n}: AQR SET POINT ${u.sw.aqrSP} MVar`); }); },
    // jadwal
    schin: ([k, i]) => { const s = PC().sch[+k - 1], h = Math.floor(+i / 4), m = (+i % 4) * 15; numDlg(`SCHEDULE ${s.key}`, `${s.name}\nINPUT VALUE jam ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} (MW total plant)\n\nCentang "isi sampai akhir jam" tidak tersedia – ulangi per sel.`, s.inp[+i], 'MW', 5, (v) => { s.inp[+i] = Math.max(0, Math.min(210, Math.round(v))); }); },
    schset: ([k]) => { const s = PC().sch[+k - 1]; dialog('SCHEDULE', `${s.key} ${s.name}\nTerapkan INPUT VALUE menjadi SET VALUE?\n\nEXECUTE ?`, () => PC().schSet(+k - 1)); },
    schcan: ([k]) => { PC().schCancel(+k - 1); },
    schls: ([k, op]) => {
      const s = PC().sch[+k - 1], key = 'musi_sch_' + s.key;
      if (!op) { dialog('LOAD/SAVE', `${s.key} ${s.name}\nSAVE: simpan INPUT VALUE di perangkat ini\nLOAD: ambil INPUT VALUE tersimpan\nDEFAULT: kembali ke data layar OPS`, null, { extra: btnRow([[`x:schls:${k}:save`, 'SAVE'], [`x:schls:${k}:load`, 'LOAD'], [`x:schls:${k}:def`, 'DEFAULT']]) }); return; }
      X.closeDlg();
      try {
        if (op === 'save') { localStorage.setItem(key, JSON.stringify(s.inp)); P.log('CMD', `SCHEDULE ${s.key} disimpan`); }
        else if (op === 'load') { const a = JSON.parse(localStorage.getItem(key) || 'null'); if (Array.isArray(a) && a.length === 96) { s.inp = a.map(Number); P.log('CMD', `SCHEDULE ${s.key} dimuat`); } else dialog('MESSAGE', 'Belum ada jadwal tersimpan di perangkat ini.', null); }
        else { const d0 = M.PlantCtrl.SCH[+k - 1]; s.inp = d0.inp.slice(); }
      } catch (e) { dialog('MESSAGE', 'Penyimpanan perangkat tidak tersedia.', null); }
    },
    setclk: () => { const pc = PC(), t = pc.tod(); dialog('JAM SIMULASI', `Jam simulasi sekarang ${clk()}\nAtur jam (HH:MM) untuk latihan jadwal/WLC:`, () => { const v = document.querySelector('#dX input').value.split(':'); const h = +v[0], m = +(v[1] || 0); if (h >= 0 && h < 24 && m >= 0 && m < 60) { pc.setClock(h, m); P.log('CMD', `SIM: jam diatur ${v.join(':')}`); } },
      { extra: `<div class="drow"><span class="grow"></span><input type="text" value="${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}"></div>`, okText: 'SET' }); },
    wlcsp: () => { const w = PC().wlc; numDlg('WATER LEVEL SET POINT', 'Intake dam (El. m)', f(w.sp, 2), 'Elm', 0.05, (v) => { w.sp = Math.max(577.6, Math.min(579.1, v)); P.log('CMD', `PLANT: WLC set point ${w.sp.toFixed(2)} m`); }); },
    // daily power operation
    dpo: ([k]) => {
      const pc = PC(), d = pc.dpo;
      if (k === 'calc') { pc.calc(); return; }
      if (k === 'meas') { d.inflow = Math.round(DAM().qnEst * 100) / 100; return; }
      const lim = { inflow: [0, 500, 'm3/sec', 0.1], bias: [-50, 50, 'm3/sec', 0.1], P: [0, 210, 'MW', 5], start: [0, 23, ':00', 1], next: [1, 24, 'Hr', 1] }[k];
      numDlg('CALCULATION PARAMETER', k.toUpperCase(), d[k], lim[2], lim[3], (v) => { d[k] = Math.max(lim[0], Math.min(lim[1], k === 'start' || k === 'next' ? Math.round(v) : v)); });
    },
    // bendungan
    damset: ([k, i]) => { const d = DAM(); i = +i;
      if (k === 'flap') numDlg('SPILLWAY FLAP GATE', `FLAP GATE -${i + 1} SET POS. (%)\n(spillway gate otomatis tetap aktif bila AUTO)`, f(d.flapSet[i], 0), '%', 5, (v) => { d.flapSet[i] = Math.max(0, Math.min(100, v)); P.log('CMD', `DAM: flap gate-${i + 1} → ${d.flapSet[i]} %`); });
      else if (k === 'sg') numDlg('SPILLWAY GATE', `SPILLWAY GATE -${i + 1} SET POS. (cm)\nMode spillway: ${d.sgMode}${d.sgMode === 'AUTO' ? ' – set manual akan ditimpa kontrol otomatis saat WL > FSL' : ''}`, f(d.sgSet[i] * 100, 0), 'cm', 10, (v) => { d.sgSet[i] = Math.max(0, Math.min(600, v)) / 100; P.log('CMD', `DAM: spillway gate-${i + 1} → ${v} cm`); });
      else if (k === 'rg') numDlg('REREGULATING GATE', `SET POS. (cm)\nMode: ${d.rMode}${d.rMode === 'AUTO' ? ' – akan ditimpa kontrol otomatis' : ''}`, f(d.rgSet * 100, 0), 'cm', 5, (v) => { d.rgSet = Math.max(0, Math.min(800, v)) / 100; P.log('CMD', `DAM: regulating gate → ${v} cm`); });
    },
    dam: (r) => {
      const d = DAM(), k = r[0];
      if (k === 'sgmode') { d.sgMode = r[1]; P.log('CMD', `DAM: spillway gate ${r[1]}`); }
      else if (k === 'rmode') { d.rMode = r[1]; P.log('CMD', `DAM: regulating gate ${r[1]}`); }
      else if (k === 'sg') { const i = +r[1]; d.sgSet[i] = Math.max(0, Math.min(6, Math.round((d.sgSet[i] + 0.1 * +r[2]) * 100) / 100)); }
      else if (k === 'rg') { d.rgSet = Math.max(0, Math.min(8, Math.round((d.rgSet + 0.1 * +r[2]) * 100) / 100)); }
      else if (k === 'top') d.Top = Math.max(0, Math.min(24, d.Top + +r[1]));
      else if (k === 'rqnd') d.rQn = Math.max(0, d.rQn + +r[1]);
      else if (k === 'plan') d.plannedRWL = Math.max(150, Math.min(157.5, d.plannedRWL + +r[1]));
      else if (k === 'inflow' || k === 'rqn') {
        const isI = k === 'inflow';
        numDlg('SET POINT', isI ? 'Inflow alami intake dam (m³/s)' : 'Aliran alami re-regulating dam Qn (m³/s)', isI ? P.inflow : d.rQn, 'm³/s', 1, (v) => { if (v >= 0) { if (isI) { P.inflow = v; if (P.rain.base !== null) P.rain.base = v; } else d.rQn = v; P.log('CMD', `DAM: ${isI ? 'inflow' : 'Qn'} = ${v} m³/s`); } });
      }
    },
    airc: () => { const air = AIR(); dialog('AIR COMPRESSOR', air.u.map((a, i) => `UNIT NO.${i + 1}: AC1 ${a.c1.fail ? 'FAULT' : a.c1.run ? 'RUN' : 'STOP'} (${f(a.c1.hrs, 2)} h) · AC2 ${a.c2.fail ? 'FAULT' : a.c2.run ? 'RUN' : 'STOP'} (${f(a.c2.hrs, 2)} h)`).join('\n') + '\n\nKompresor otomatis: start saat 63AQH1 OFF, stop saat 63AQH2 ON.\nGangguan kompresor: FAULT SIM. → "Air compressor 1 unit No.1 gagal".', null); },
    rain: ([I]) => { RAIN().set(+I); },
  });

})();
