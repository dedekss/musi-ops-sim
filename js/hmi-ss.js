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
    g += `<g data-a="nav:ssc"><circle cx="530" cy="615" r="17" fill="${dg.run ? '#ff2020' : '#18e018'}" stroke="#fff" stroke-width="1.2"/>${T(530, 619, 'DG', 't tc', 'style="fill:#000;font-size:11px"')}</g>`;
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

  /* ============================== S/S OVERVIEW ============================== */
  function scrSSO() {
    const ss = SS(), sy = P.sy; let g = title('STATION SERVICE OVERVIEW') + backBtn();
    const box = (x, y, w, h, lab, node, act) => `<g ${act ? `data-a="${act}"` : ''}>${R(x, y, w, h, 'box')}${mline(x + w / 2, y + h / 2 + 4, lab, 't tc', 11)}${node ? `<rect x="${x + 3}" y="${y + 3}" width="8" height="8" fill="${ss.live[node] ? '#ff2020' : '#18e018'}"/>` : ''}</g>`;
    // sumber
    g += T(70, 56, 'SUMBER', 't tc cy');
    g += box(15, 66, 110, 34, `LSTr 150/20 kV\n152-LST ${sy.st['152-LST'] ? 'CLOSE' : 'OPEN'}`, 'LST20', 'nav:sy');
    g += box(15, 106, 110, 34, `LINE BASE CAMP\n& CURUP 20 kV`, 'BCLINE', 'nav:mch');
    g += box(15, 146, 110, 34, `DIESEL GEN.\n${ss.dg.run ? f(ss.dg.v, 0) + ' V ' + f(ss.dg.f) + ' Hz' : 'STOP'}`, 'DG', 'nav:ssc');
    [1, 2, 3].forEach((n, i) => { g += box(15, 186 + i * 40, 110, 34, `USTr No.${n}\n(GEN. ${n} ${f(U(n).p.vt * 10.9)} kV)`, `UT${n}S`, 'nav:uph'); });
    // MCH
    g += R(160, 50, 330, 260, 'boxd') + T(325, 66, 'MAIN CONTROL HOUSE', 't tc cy');
    const bus = (x1, x2, y, node, lab, val) => ln(x1, y, x2, y, node, 1) + T(x1, y - 6, lab, 't') + T(x2, y - 6, val, 't tr cy');
    g += bus(175, 320, 110, 'M20A', '20kV BUS-A', KV('M20A')) + bus(335, 475, 110, 'M20B', '20kV BUS-B', KV('M20B'));
    g += bus(175, 290, 230, 'M4A', '400V A', V('M4A')) + bus(300, 350, 230, 'M4C', 'C', '') + bus(360, 475, 230, 'M4B', '400V B', V('M4B'));
    g += T(325, 150, `LS ${MW('252-LS')}  ·  ID ${A('252DL-ID')}  ·  RD ${A('252DL-RD')}`, 't tc');
    g += T(325, 170, `SSTr3 ${A('252B-A1')}  ·  SSTr4 ${A('252B-B1')}`, 't tc') + T(325, 190, `Cable 1 ${KW('252B-A2')}  ·  Cable 2 ${KW('252B-B2')}`, 't tc');
    g += T(325, 260, `Beban 400 V MCH: ${f((ss.load.LG1 || 0) + (ss.load.LG2 || 0), 1)} kW`, 't tc') + T(325, 280, `DG: ${f(ss.dg.kw, 1)} kW · jam operasi ${f(ss.dg.hrs, 2)} h`, 't tc');
    g += b3(255, 288, 140, 18, 'MAIN CONTROL HOUSE ▶', '', 'nav:mch');
    // PH
    g += R(520, 50, 455, 260, 'boxd') + T(747, 66, 'UNDERGROUND POWERHOUSE', 't tc cy');
    g += bus(535, 735, 110, 'P4A', '400V BUS-A', V('P4A')) + bus(760, 960, 110, 'P4B', '400V BUS-B', V('P4B'));
    g += T(747, 140, `SSTr1 → 352-L1 ${KW('352-L1')}   ·   SSTr2 → 352-L2 ${KW('352-L2')}`, 't tc');
    [1, 2, 3].forEach((n, i) => { const y = 165 + i * 22; g += T(535, y, `UNIT ${n}: 452-${n} ${st('452-' + n) ? 'CLOSE' : 'OPEN'} · 352-${n}1 ${st(`352-${n}1`) ? 'CLOSE' : 'OPEN'} · 352-${n}2 ${st(`352-${n}2`) ? 'CLOSE' : 'OPEN'} · MCC ${ss.uaux[n] ? 'OK' : 'HILANG'}`, 't', `style="fill:${ss.uaux[n] ? '#e8e8e8' : '#ff5050'}"`); });
    g += T(747, 245, `MCC common ${A('352-4')} · misc ${A('352B-B2') !== '0.0 A' ? A('352B-B2') : A('352B-A2')}`, 't tc');
    g += b3(677, 288, 140, 18, 'UNDERGROUND P/H ▶', '', 'nav:uph');
    // relai 27
    g += T(495, 335, 'RELAI UNDER VOLTAGE 27 (merah = OPERATE / tegangan hilang)', 't tc cy');
    Object.keys(REL).forEach((k, i) => { const x = 40 + (i % 4) * 240, y = 355 + Math.floor(i / 4) * 34; g += rly(x + 25, y, k) + T(x + 55, y + 4, REL[k][1].slice(0, 30), 'ts'); });
    // changeover
    g += T(495, 470, 'CHANGEOVER OTOMATIS', 't tc cy');
    g += b3(150, 482, 330, 26, `MSSLCU (MCH) LSTr → DG : ${ss.aco.mch}`, ss.aco.mch === 'AUTO' ? 'yel' : '', 'x:ssaco:mch');
    g += b3(510, 482, 330, 26, `USSLCU (P/H) → USTr / BUS-TIE : ${ss.aco.ph}`, ss.aco.ph === 'AUTO' ? 'yel' : '', 'x:ssaco:ph');
    g += T(495, 530, ss.seqM ? `MSSLCU: ${ss.seqM.name} – langkah ${ss.seqM.i + 1}/${ss.seqM.steps.length}` : 'MSSLCU: siaga', 't tc', `style="fill:${ss.seqM ? '#ffff40' : '#888'}"`);
    g += T(495, 548, ss.seqP ? `USSLCU: ${ss.seqP.name} – langkah ${ss.seqP.i + 1}/${ss.seqP.steps.length}` : 'USSLCU: siaga', 't tc', `style="fill:${ss.seqP ? '#ffff40' : '#888'}"`);
    g += T(495, 585, 'Kotak kecil: merah = bertegangan, hijau = tidak bertegangan. Ketuk blok untuk membuka layar terkait.', 't tc dim');
    g += T(495, 602, 'Interlock CB/DS: logic Alstom P0039-001/-002/-L001/-L002 · changeover: JEZ1L693 · tata letak MCH/PH: layar OPS.', 't tc dim');
    return g;
  }

  /* ============================== S/S CONTROL PANEL ============================== */
  function scrSSC() {
    const ss = SS(), dg = ss.dg, sy = P.sy; let g = title('SWITCHYARD / STATION SERVICE CONTROL PANEL') + backBtn();
    const lampRow = (x, y, on, s, red = true) => `<circle cx="${x}" cy="${y}" r="6" class="lamp ${on ? (red ? 'lr' : 'lg') : ''}" fill="${on ? '' : '#333'}"/>` + T(x + 14, y + 4, s, 't');
    g += R(20, 50, 300, 270, 'boxd') + T(170, 68, 'DIESEL GENERATOR (52DG)', 't tc cy');
    g += b3(40, 82, 120, 30, 'DG START', dg.cmd ? 'pink' : '', 'x:ssdg:start') + b3(180, 82, 120, 30, 'DG STOP', !dg.cmd ? 'grn' : '', 'x:ssdg:stop');
    g += lampRow(50, 135, dg.cmd && !dg.run && !dg.fail, 'CRANKING / STARTING') + lampRow(50, 155, dg.run, 'DG RUNNING (5DI0135)') + lampRow(50, 175, dg.ready, '84DG VOLTAGE ESTABLISHED') + lampRow(50, 195, dg.fail, 'START FAILURE (5DI0137)') + lampRow(50, 215, st('52DG'), '52DG CLOSED');
    g += T(40, 245, `Tegangan  ${f(dg.v)} V`, 't cy') + T(40, 262, `Frekuensi ${f(dg.f)} Hz`, 't cy') + T(40, 279, `Daya      ${f(dg.kw)} kW`, 't cy') + T(40, 296, `Jam operasi ${f(dg.hrs, 2)} h`, 't cy');
    g += T(40, 312, 'Rating DG belum ada data · start ± 8 s, 84DG +5 s (asumsi)', 'ts dim');
    g += R(340, 50, 300, 270, 'boxd') + T(490, 68, 'CHANGEOVER OTOMATIS', 't tc cy');
    g += T(360, 92, 'MSSLCU – LSTr → DG (MCH)', 't') + b3(360, 100, 120, 26, 'AUTO', ss.aco.mch === 'AUTO' ? 'yel' : '', 'x:ssaco:mch:AUTO') + b3(490, 100, 120, 26, 'LOCK', ss.aco.mch !== 'AUTO' ? 'yel' : '', 'x:ssaco:mch:LOCK');
    g += T(360, 150, 'USSLCU – USTr / BUS-TIE (P/H)', 't') + b3(360, 158, 120, 26, 'AUTO', ss.aco.ph === 'AUTO' ? 'yel' : '', 'x:ssaco:ph:AUTO') + b3(490, 158, 120, 26, 'LOCK', ss.aco.ph !== 'AUTO' ? 'yel' : '', 'x:ssaco:ph:LOCK');
    g += mline(490, 222, 'Pemicu: 27-1M & 27-2M (MCH) atau\n27-1U / 27-2U (P/H) operate ≥ 2 s.\nPrioritas USTr: No.3 > No.2 > No.1\n(unit paralel, beban > 20 %).', 't tc dim', 13);
    g += R(660, 50, 310, 270, 'boxd') + T(815, 68, 'MANUVER CEPAT', 't tc cy');
    g += b3(680, 82, 270, 28, 'MAIN CONTROL HOUSE CB OPEN', '', 'x:ssmac:mchopen');
    g += b3(680, 118, 270, 28, 'MCH NORMAL (catu dari LSTr)', '', 'x:ssmac:mchnormal');
    g += b3(680, 154, 270, 28, 'POWER SUPPLY TO POWERHOUSE', '', 'x:ssmac:phnormal');
    g += b3(680, 190, 270, 28, 'FLICKER RESET (semua)', '', 'x:ssfr:');
    g += mline(815, 255, 'Manuver dijalankan langkah demi langkah\nmelalui interlock; berhenti pada langkah\npertama yang ditolak.', 't tc dim', 13);
    // switchyard summary
    g += R(20, 335, 950, 120, 'boxd') + T(495, 352, '150 kV SWITCHYARD & LSTr', 't tc cy');
    const lv = sy.busLive();
    g += T(40, 378, `BUS-A ${lv.A ? 'LIVE' : 'DEAD'}   BUS-B ${lv.B ? 'LIVE' : 'DEAD'}   152-BT ${sy.st['152-BT'] ? 'CLOSE' : 'OPEN'}`, 't');
    g += T(40, 398, `152-LST ${sy.st['152-LST'] ? 'CLOSE' : 'OPEN'}${sy.lstFault ? '  (GANGGUAN LSTr – LOCKOUT)' : ''}   189-LSTA ${sy.st['189-LSTA'] ? 'CLOSE' : 'OPEN'}   189-LSTB ${sy.st['189-LSTB'] ? 'CLOSE' : 'OPEN'}   TAP ${sy.tap}`, 't', sy.lstFault ? 'style="fill:#ff5050"' : '');
    g += T(40, 418, `Sumber 20 kV LS: ${ss.live.LST20 ? 'BERTEGANGAN' : 'TIDAK BERTEGANGAN'}`, 't');
    g += b3(780, 400, 170, 26, '150kV SWITCHYARD ▶', '', 'nav:sy');
    // navigasi
    g += b3(20, 470, 180, 30, 'S/S OVERVIEW', '', 'nav:sso') + b3(210, 470, 180, 30, 'MAIN CONTROL HOUSE', '', 'nav:mch') + b3(400, 470, 180, 30, 'UNDERGROUND P/H', '', 'nav:uph');
    g += b3(590, 470, 180, 30, 'USS ANNUNCIATOR', '', 'nav:annuss') + b3(780, 470, 180, 30, 'MSS ANNUNCIATOR', '', 'nav:annmss');
    g += seqLine(ss.seqM ? 'seqM' : 'seqP');
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
  function scrDam() {
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
  function scrWLC() {
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

  /* ============================== TURBINE ACTUATOR ============================== */
  function scrTact(n) {
    const u = U(n), p = u.p, F = u.fx; let g = title(`NO.${n} TURBINE ACTUATOR (GOVERNOR OIL SYSTEM)`) + backBtn();
    const sumpT = u.govSumpT ? u.govSumpT() : 45;
    // tangki tekanan
    g += R(60, 70, 110, 220, 'box') + T(115, 62, 'PRESSURE OIL TANK', 't tc');
    const lv = Math.max(0, Math.min(1, p.govLvl)); g += `<rect x="61" y="${70 + 220 * (1 - lv * 0.6)}" width="108" height="${220 * lv * 0.6}" fill="#7a5a10"/>`;
    g += T(115, 150, `${f(p.govP * 100)} %`, 't tc', 'style="fill:#4ce0ff;font-size:16px"') + T(115, 168, 'TEKANAN', 't tc') + T(115, 270, `LEVEL ${f(p.govLvl * 100)} %`, 't tc cy');
    // sump & pompa
    g += R(40, 380, 270, 90, 'box') + T(175, 372, 'SUMP TANK', 't tc') + T(175, 420, `LEVEL ${f(100 * (F.gov_oil_leak ? 0.93 : 1))} %   ·   SUHU ${f(sumpT)} ℃`, 't tc cy');
    p.qp.forEach((q, i) => {
      const x = 205 + i * 85, col = q.fail ? '#ff2020' : q.run ? '#ff2020' : '#18e018';
      g += `<circle cx="${x}" cy="320" r="18" fill="none" stroke="${col}" stroke-width="2.5"/>` + T(x, 324, q.name, 't tc', 'style="font-size:9px"');
      g += T(x, 352, q.fail ? 'FAULT' : q.run ? 'RUN' : (p.qpMain === i ? 'MAIN' : 'STANDBY'), 't tc', `style="fill:${q.fail ? '#ff5050' : q.run ? '#ffff40' : '#888'}"`);
      g += L(x, 338, x, 380, 'ln') + L(x, 302, x, 270, 'ln') + L(x, 270, 170, 270, 'ln');
    });
    // servomotor
    g += R(400, 120, 260, 70, 'box') + T(530, 112, 'GUIDE VANE SERVOMOTOR', 't tc');
    const gv = p.gv / 100; g += `<rect x="${405 + 200 * gv}" y="125" width="14" height="60" fill="#b4b4b4"/>` + L(419 + 200 * gv, 155, 690, 155, 'ln');
    g += T(530, 210, `BUKAAN GV ${f(p.gv)} %   ·   LIMIT 7-77 ${f(p.gvLim)} %`, 't tc cy');
    g += L(170, 150, 400, 150, 'ln') + T(285, 142, 'oli tekanan → distributing valve', 'ts tc dim');
    // status & lamp
    const lamps = [['65S GOVERNOR START', p.govOn], ['20SD QUICK SHUTDOWN (86-1/86-2)', !!(u.lo['86-1'] || u.lo['86-2'])], ['33GVL GUIDE VANE LOCKED', !!F.gv_locked],
      ['33GVlb GV FULLY CLOSE', p.gv < 0.3], ['74mb GV NO-LOAD POSITION', u.s74mb ? u.s74mb() : false], ['63QL-1 PRESSURE LOW 1ST (<85 %)', p.govP < 0.85],
      ['63QL-2 PRESSURE LOW 2ND (<75 %)', p.govP < 0.75], ['71QPL-1 TANK LEVEL LOW 1ST', p.govLvl < 0.85], ['71QPL-2 TANK LEVEL LOW 2ND', p.govLvl < 0.75],
      ['SUMP OIL TEMP HIGH 1ST (60 ℃)', sumpT > 60], ['SUMP OIL TEMP HIGH 2ND (65 ℃)', sumpT > 65], ['CATU MCC UNIT', P.auxOK(n)]];
    lamps.forEach(([s, on], i) => { const x = 720, y = 80 + i * 22; g += lamp(x, y, on) + T(x + 14, y + 4, s, 't'); });
    g += T(400, 250, `MODE GOVERNOR: ${p.cb && !p.islanded ? u.sw.gov : p.govOn ? 'SPEED' : '—'}`, 't') + T(400, 270, `PUTARAN ${f(p.speed * 100)} %   ·   DAYA ${f(p.p)} MW`, 't');
    g += mline(495, 560, 'Tekanan & level ditampilkan dalam % nilai nominal (nilai MPa / liter tidak tersedia di dokumen).\nAmbang 1ST/2ND: JEZ2K031 SH.002/003 (setelan asumsi). Pompa 88QP berhenti bila catu MCC unit hilang.', 't tc dim', 13);
    return g;
  }

  /* ============================== INLET VALVE HYDRAULIC ============================== */
  function scrIVH(n) {
    const u = U(n), p = u.p, F = u.fx, m = u.meas ? u.meas() : {}; let g = title(`NO.${n} INLET VALVE HYDRAULIC`) + backBtn();
    const head = (P.intakeWL - 173.5);
    g += L(40, 220, 330, 220, 'lnc') + L(40, 260, 330, 260, 'lnc') + T(120, 210, 'PENSTOCK', 't tc');
    g += L(530, 220, 950, 220, p.iv > 0.02 || p.bypass > 0.02 ? 'lnc' : 'ln') + L(530, 260, 950, 260, p.iv > 0.02 || p.bypass > 0.02 ? 'lnc' : 'ln') + T(800, 210, 'SPIRAL CASE → TURBIN', 't tc');
    // badan valve (rotary)
    g += `<circle cx="430" cy="240" r="62" fill="none" stroke="#e8e8e8" stroke-width="2"/>`;
    const ang = p.iv * 90; g += `<g transform="rotate(${ang} 430 240)"><rect x="424" y="182" width="12" height="116" fill="${p.iv > 0.995 ? '#ff2020' : p.iv < 0.005 ? '#18e018' : '#ffff40'}"/></g>`;
    g += T(430, 330, `INLET VALVE ${f(p.iv * 100)} %`, 't tc cy');
    // bypass
    g += L(300, 220, 300, 140, 'ln') + L(300, 140, 560, 140, 'ln') + L(560, 140, 560, 220, 'ln');
    g += `<rect x="415" y="128" width="30" height="24" fill="${p.bypass > 0.995 ? '#ff2020' : p.bypass < 0.005 ? '#18e018' : '#ffff40'}" stroke="#fff"/>` + T(430, 120, `BYPASS VALVE ${f(p.bypass * 100)} %`, 't tc');
    // seal
    g += R(500, 175, 14, 130, '', `fill="${p.seal > 0.99 ? '#ff2020' : p.seal < 0.02 ? '#18e018' : '#ffff40'}" opacity="0.55"`) + T(507, 318, 'OPE. SEAL', 'ts tc');
    // nilai
    const rows = [['Tekanan penstock', `${f(head * 0.0981, 1)} bar`], ['Tekanan spiral case', `${f(head * 0.0981 * (1 - p.dp * (p.iv < 0.01 ? 1 : 0)), 1)} bar`], ['Selisih tekanan (ΔP) I/V', `${f(p.dp * 100)} %`],
      ['Perintah I/V (21S)', p.ivCmd === 'open' ? 'OPEN' : 'CLOSE'], ['Rem generator', p.brake > 0.5 ? 'APPLY' : 'RELEASE'], ['Debit turbin', `${f(m.flow || 0, 1)} m³/s`]];
    rows.forEach(([a, b], i) => { g += T(40, 380 + i * 18, a, 't') + T(330, 380 + i * 18, b, 't tr cy'); });
    const lamps = [['33IVha I/V FULLY OPEN (DI0169)', p.iv > 0.995], ['33IVlb I/V FULLY CLOSE (DI0168)', p.iv < 0.005], ['33BPha BYPASS FULLY OPEN (DI0171)', p.bypass > 0.995],
      ['33BPlb BYPASS FULLY CLOSE (DI0170)', p.bypass < 0.005], ['OPERATING SEAL APPLIED (DI0174)', p.seal > 0.99], ['OPERATING SEAL RETRACTED', p.seal < 0.02],
      ['63WC SPIRAL CASE PRESSURE (DI0176)', p.dp < 0.05 || p.iv > 0.01], ['88QVP I/V OIL PUMP RUN', (p.ivCmd === 'open' && p.iv < 0.995) || (p.ivCmd === 'close' && p.iv > 0.005)],
      ['33IVL I/V LOCKED', !!F.gv_locked], ['I/V QUICK SHUTDOWN (86-1/86-2)', !!(u.lo['86-1'] || u.lo['86-2'])], ['I/V MACET (skenario)', !!F.iv_stuck], ['BYPASS MACET (skenario)', !!F.bypass_stuck]];
    lamps.forEach(([s, on], i) => { const x = 620, y = 365 + i * 20; g += lamp(x, y, on) + T(x + 14, y + 4, s, 't'); });
    g += mline(330, 610, 'Tekanan dihitung dari head (WL intake − 173.5 m tailrace). Tekanan & level tangki oli I/V tidak dimodelkan (data tidak tersedia).', 't tc dim', 13);
    return g;
  }

  /* ============================== ANALOG INPUT (HTML) ============================== */
  const tr = (cells, cls = '') => `<tr class="${cls}">${cells.map((c, i) => i ? `<td class="n">${c}</td>` : `<td>${esc(c)}</td>`).join('')}</tr>`;
  function aiUSS() {
    const ss = SS();
    const rows = [['400V BUS-A (P/H)', V('P4A'), '—', '—'], ['400V BUS-B (P/H)', V('P4B'), '—', '—'],
      ['SSTr No.1 (252-L1, 20 kV)', KV('SST1P'), A('252-L1'), KW('252-L1')], ['SSTr No.2 (252-L2, 20 kV)', KV('SST2P'), A('252-L2'), KW('252-L2')],
      ['352-L1 incoming bus A', V('P4A'), A('352-L1'), KW('352-L1')], ['352-L2 incoming bus B', V('P4B'), A('352-L2'), KW('352-L2')],
      ...[1, 2, 3].flatMap((n) => [[`452-${n} USTr No.${n}`, V('UB' + n), A('452-' + n), KW('452-' + n)], [`400V BUS UNIT NO.${n}`, V('UB' + n), f(ss.nodeAmps('UB' + n), 1) + ' A', f(ss.nodeKW['UB' + n] || 0, 1) + ' kW'],
        [`MCC${n}A / MCC${n}B`, '—', `${f(ss.nodeAmps('MCC' + n + 'A'), 1)} / ${f(ss.nodeAmps('MCC' + n + 'B'), 1)} A`, `${f(ss.load['MCC' + n + 'A'] || 0, 1)} / ${f(ss.load['MCC' + n + 'B'] || 0, 1)} kW`]]),
      ['MCC COMMON (352-4)', '—', A('352-4'), KW('352-4')], ['MISCELLANEOUS SUPPLY', '—', f(ss.nodeAmps('MISC'), 1) + ' A', f(ss.load.MISC || 0, 1) + ' kW']];
    const temps = [1, 2, 3].map((n) => [`USTr No.${n} WINDING`, `${f(ss.ustT[n])} ℃`]);
    return `<div class="h2">ANALOG INPUT – STATION SERVICE (USS / POWERHOUSE)</div><div class="fs"><div class="col"><table class="tbl"><tr><th>Titik</th><th>Tegangan</th><th>Arus</th><th>Daya</th></tr>${rows.map((r) => tr(r)).join('')}</table></div>
      <div class="col"><table class="tbl"><tr><th>Suhu</th><th>Nilai</th></tr>${temps.map((r) => tr(r)).join('')}</table>
      <table class="tbl"><tr><th>Relai 27 (P/H)</th><th>Status</th></tr>${['27-L1U', '27-L2U', '27-1U', '27-2U'].map((k) => tr([`${k} – ${REL[k][1]}`, ss.rel[k] ? 'OPERATE' : 'normal'], ss.rel[k] ? 'alm' : '')).join('')}</table>
      <div class="note2">Arus dihitung dari daya beban (cos φ 0.80 di 400 V, 0.88 di 20 kV), dikalibrasi terhadap layar OPS 13-Okt-2017.</div></div></div>`;
  }
  function aiMSS() {
    const ss = SS(), dg = ss.dg;
    const rows = [['20kV BUS-A', KV('M20A'), '—', '—'], ['20kV BUS-B', KV('M20B'), '—', '—'], ['252-LS incoming LSTr', KV('LSB'), A('252-LS'), MW('252-LS')],
      ['252DL-BC Base Camp & Curup', KV('BCX'), A('252DL-BC'), MW('252DL-BC')], ['252DL-ID Intake Dam', KV('IDX'), A('252DL-ID'), MW('252DL-ID')], ['252DL-RD Re-reg Dam', KV('RDX'), A('252DL-RD'), MW('252DL-RD')],
      ['252B-A2 cable feeder no.1', KV('CAB1'), A('252B-A2'), KW('252B-A2')], ['252B-B2 cable feeder no.2', KV('CAB2'), A('252B-B2'), KW('252B-B2')],
      ['252B-A1 SSTr No.3', KV('SST3P'), A('252B-A1'), KW('252B-A1')], ['252B-B1 SSTr No.4', KV('SST4P'), A('252B-B1'), KW('252B-B1')],
      ['400V BUS-A (MCH)', V('M4A'), A('352-S1'), KW('352-S1')], ['400V BUS-B (MCH)', V('M4B'), A('352-S2'), KW('352-S2')], ['400V BUS-C (MCH)', V('M4C'), '—', '—'],
      ...['352B-A3', '352B-A4', '352B-B3', '352B-B4'].map((k) => [k, '—', A(k), KW(k)]),
      ['DIESEL GENERATOR (52DG)', `${f(dg.v)} V · ${f(dg.f)} Hz`, A('52DG'), `${f(dg.kw)} kW`]];
    return `<div class="h2">ANALOG INPUT – STATION SERVICE (MSS / MAIN CONTROL HOUSE)</div><div class="fs"><div class="col"><table class="tbl"><tr><th>Titik</th><th>Tegangan</th><th>Arus</th><th>Daya</th></tr>${rows.map((r) => tr(r)).join('')}</table></div>
      <div class="col"><table class="tbl"><tr><th>Relai 27 (MCH)</th><th>Status</th></tr>${['27-BC', '27-1M', '27-2M', '27-L1M', '27-L2M', '27-3M', '27-4M'].map((k) => tr([`${k} – ${REL[k][1]}`, ss.rel[k] ? 'OPERATE' : 'normal'], ss.rel[k] ? 'alm' : '')).join('')}</table>
      <div class="note2">Beban MCH: kelompok 1 (A3/B3) ${f(ss.load.LG1 || 0, 1)} kW, kelompok 2 (A4/B4) ${f(ss.load.LG2 || 0, 1)} kW.</div></div></div>`;
  }
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
  function dpo() {
    const d = P.daily, us = d.u, tot = us.reduce((a, r) => ({ mwh: a.mwh + r.mwh, mvarh: a.mvarh + r.mvarh, hrs: a.hrs + r.hrs }), { mwh: 0, mvarh: 0, hrs: 0 });
    const fmt = (t) => { const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60; return `${h} h ${String(m).padStart(2, '0')} m`; };
    const rows = us.map((r, i) => tr([`UNIT ${i + 1}`, f(r.mwh, 2), f(r.mvarh, 2), f(r.hrs, 2), f(r.maxP, 1), r.starts, r.trips])).join('') + tr(['PLANT', f(tot.mwh, 2), f(tot.mvarh, 2), f(tot.hrs, 2), '—', '—', '—']);
    return `<div class="h2">DAILY POWER OPERATION (REKAP SIMULASI)</div>
      <table class="tbl"><tr><th>Unit</th><th>Energi (MWh)</th><th>Reaktif (MVArh)</th><th>Jam paralel (h)</th><th>Daya maks (MW)</th><th>Paralel (kali)</th><th>Lockout 86 (kali)</th></tr>${rows}</table>
      <table class="tbl" style="max-width:640px"><tr><th>Besaran</th><th>Nilai</th></tr>
      ${tr(['Periode rekap (waktu simulasi)', fmt(d.t)])}${tr(['Volume air turbin', `${f(d.turbM3 / 1e3, 1)} ×10³ m³`])}${tr(['Volume spillway', `${f(d.spillM3 / 1e3, 1)} ×10³ m³`])}
      ${tr(['Intake WL min / maks', `${f(d.wlMin === 999 ? P.intakeWL : d.wlMin, 2)} / ${f(d.wlMax || P.intakeWL, 2)} m`])}${tr(['Energi pemakaian sendiri (station service)', `${f(d.ssKWh, 1)} kWh`])}
      ${tr(['Rata-rata daya plant', `${f(d.t > 0 ? tot.mwh / (d.t / 3600) : 0, 1)} MW`])}</table>
      <div class="row" style="display:flex;gap:6px"><span class="sb" data-a="x:dpo:reset" style="background:#b4b4b4;color:#111;padding:4px 8px;cursor:pointer">RESET REKAP</span></div>
      <div class="note2">Rekap dihitung dari simulasi sejak inisialisasi atau reset terakhir. Format laporan harian resmi PLTA Musi belum tersedia; kolom dapat disesuaikan bila contoh laporan dikirim.</div>`;
  }

  /* ============================== REGISTRASI ============================== */
  Object.assign(EXTS, {
    mch: { no: '00003', title: () => 'MAIN CONTROL HOUSE', grp: 'stv', draw: scrMCH },
    uph: { no: '00004', title: () => 'UNDERGROUND POWERHOUSE', grp: 'stv', draw: scrUPH },
    sso: { no: '00005', title: () => 'STATION SERVICE OVERVIEW', grp: 'stv', draw: scrSSO },
    ssc: { no: '00020', title: () => 'SWITCHYARD / STATION SERVICE CONTROL PANEL', grp: 'stv', draw: scrSSC },
    dam: { no: '00060', title: () => 'INTAKE & REREGULATING DAM', grp: 'dam', draw: scrDam },
    wlc: { no: '00061', title: () => 'WATER LEVEL CONTROL', grp: 'dam', html: true, draw: scrWLC },
    aidam: { no: '00087', title: () => 'ANALOG INPUT – DAM', grp: 'dam', html: true, draw: aiDam },
    aiuss: { no: '00085', title: () => 'ANALOG INPUT – STATION SERVICE (USS)', grp: 'stv', html: true, draw: aiUSS },
    aimss: { no: '00086', title: () => 'ANALOG INPUT – STATION SERVICE (MSS)', grp: 'stv', html: true, draw: aiMSS },
    dpo: { no: '00095', title: () => 'DAILY POWER OPERATION', grp: 'ins', html: true, draw: dpo },
  });
  EXTU.tact = { no: (n) => '0011' + n, title: (n) => `NO.${n} TURBINE ACTUATOR`, grp: 'sys', draw: scrTact };
  EXTU.ivh = { no: (n) => '0012' + n, title: (n) => `NO.${n} INLET VALVE HYDRAULIC`, grp: 'sys', draw: scrIVH };
  TABS.stv = () => [['sso', 'S/S OVERVIEW'], ['sy', '150kV SWITCHYARD'], ['mch', 'MAIN CONT. HOUSE'], ['uph', 'UNDER.POWERHOUSE'], ['ssc', 'S/S CTRL PANEL'], ['trend', 'Historical']];
  TABS.dam = () => [['dam', 'INTAKE & RE-DAM'], ['wlc', 'WATER LEVEL CTRL'], ['aidam', 'ANALOG INPUT'], ['trend', 'Historical']];
  const sys0 = TABS.sys; TABS.sys = (n) => [...sys0(n).filter((t) => t[0] !== 'trend'), [`tact${n}`, 'TURB. ACTUATOR'], [`ivh${n}`, 'I/V HYDRAULIC'], ['trend', 'Historical']];
  const ins0 = TABS.ins; TABS.ins = () => [...ins0(), ['dpo', 'DAILY POWER']];

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
  Object.assign(EXTA, {
    ssd: ([id]) => {
      const ss = SS(), d = DEV[id]; if (!d) return;
      const cur = !!ss.st[id], why = ss.interlock(id, !cur);
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
    ssdg: ([c]) => dialog('DIESEL GENERATOR', `DG ${c === 'start' ? 'START' : 'STOP'}\n\nEXECUTE ?`, () => (c === 'start' ? SS().dgStart() : SS().dgStop())),
    ssaco: ([site, v]) => { const ss = SS(); const nv = v || (ss.aco[site] === 'AUTO' ? 'LOCK' : 'AUTO'); dialog('CHANGEOVER', `${site === 'mch' ? 'MSSLCU (MCH)' : 'USSLCU (P/H)'} → ${nv}\n\nEXECUTE ?`, () => { ss.aco[site] = nv; P.log('CMD', `SS: changeover ${site.toUpperCase()} ${nv}`); }); },
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
        const isI = k === 'inflow', cur = isI ? P.inflow : d.rQn;
        dialog('SET POINT', isI ? 'Inflow alami intake dam (m³/s)' : 'Aliran alami re-regulating dam Qn (m³/s)', () => { const v = parseFloat(document.querySelector('#dX input').value); if (!isNaN(v) && v >= 0) { if (isI) P.inflow = v; else d.rQn = v; P.log('CMD', `DAM: ${isI ? 'inflow' : 'Qn'} = ${v} m³/s`); } },
          { extra: `<div class="drow"><span class="grow"></span><input type="number" step="1" value="${cur}"> m³/s</div>`, okText: 'SET' });
      }
    },
    dpo: () => { const Dly = P.daily.constructor; P.daily = new Dly(P); },
  });

  /* ============================== MENU YANG MENUNGGU DATA ============================== */
  Object.assign(NA_MSG, {
    'Air Supply System': 'AIR SUPPLY SYSTEM belum aktif.\n\nData yang dibutuhkan: jumlah & kapasitas kompresor, tekanan kerja receiver (governor HP air, rem, service air), setpoint start/stop kompresor, batas alarm tekanan rendah, dan screenshot layar OPS.',
    'Rain Fall Monitor': 'RAIN FALL MONITOR belum aktif.\n\nData yang dibutuhkan: nama stasiun hujan, satuan & interval data, contoh data atau screenshot layar OPS.',
    'Schedule(Rainy/Weekday)': 'SCHEDULE belum aktif.\n\nData yang dibutuhkan: tabel jadwal beban per jam (MW per unit / total) untuk Rainy/Dry × Weekday/Weekend, dan screenshot layar schedule.',
    'Schedule(Rainy/Weekend)': 'SCHEDULE belum aktif.\n\nData yang dibutuhkan: tabel jadwal beban per jam (MW per unit / total) untuk Rainy/Dry × Weekday/Weekend, dan screenshot layar schedule.',
    'Schedule(Dry/Weekday)': 'SCHEDULE belum aktif.\n\nData yang dibutuhkan: tabel jadwal beban per jam (MW per unit / total) untuk Rainy/Dry × Weekday/Weekend, dan screenshot layar schedule.',
    'Schedule(Dry/Weekend)': 'SCHEDULE belum aktif.\n\nData yang dibutuhkan: tabel jadwal beban per jam (MW per unit / total) untuk Rainy/Dry × Weekday/Weekend, dan screenshot layar schedule.',
    'Schedule(Arbitrary Setup)': 'SCHEDULE (ARBITRARY SETUP) belum aktif.\n\nData yang dibutuhkan: format layar arbitrary setup dan logika SCH (cara jadwal diterapkan ke ALR set point tiap unit).',
  });
})();
