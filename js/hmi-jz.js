/* MUSI HEPP – PROTECTION SCHEME JEZ2K031 (SH.001 / SH.002 / SH.003) sebagai simulasi gangguan.
   Block diagram mengikuti gambar Mitsubishi JEZ2K031; setiap kotak input dapat diaktifkan instruktur
   (paksa ON/OFF) atau diubah nilai analognya. Logika dievaluasi oleh engine (Unit.protection). */
(() => {
  'use strict';
  const X = window.HMIX; if (!X) return;
  const { P, M, T, R, L, title, backBtn, esc, f, U, dialog, go, EXTU, EXTA, TABS } = X;
  const JZ = M.JZ, ANA = M.ANA;
  const ON = '#ff3333', OFF = '#bdbdbd', CY = '#4ce0ff';
  const col = (v) => (v ? ON : OFF), sw = (v) => (v ? 2 : 1.1);
  const W = (pts, v) => `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${col(v)}" stroke-width="${sw(v)}"/>`;
  const arrowHead = (x, y, v) => `<path d="M${x - 5},${y - 3} L${x},${y} L${x - 5},${y + 3}" fill="none" stroke="${col(v)}" stroke-width="1.1"/>`;
  const route = (x1, y1, lane, x2, y2, v) => W([[x1, y1], [lane, y1], [lane, y2], [x2, y2]], v);
  const tx = (x, y, s, sz = 8, anc = 'start', c = '#e8e8e8', ex = '') => `<text x="${x}" y="${y}" style="font-size:${sz}px;fill:${c};text-anchor:${anc}${ex}">${esc(String(s))}</text>`;
  const frame = (x, y, w, h, lab) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#8a8a8a" stroke-dasharray="4 3"/>` +
    (lab ? `<rect x="${x + 4}" y="${y - 6}" width="${lab.length * 5 + 12}" height="11" rx="5" fill="#000" stroke="#bdbdbd"/>` + tx(x + 10, y + 3, lab, 7.5) : '');
  // ---- gerbang (simbol JIS seperti pada gambar): garis vertikal + panah masuk; OR = lingkaran, AND = kotak ----
  function gate(kind, x, ys, vIn, vOut) {
    const y0 = Math.min(...ys) - 5, y1 = Math.max(...ys) + 5, ym = (Math.min(...ys) + Math.max(...ys)) / 2;
    let s = `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="${col(vOut)}" stroke-width="1.4"/>`;
    ys.forEach((y, i) => { s += arrowHead(x, y, vIn[i]); });
    s += kind === 'OR' ? `<circle cx="${x + 4.5}" cy="${ym}" r="4" fill="${vOut ? ON : '#000'}" stroke="${col(vOut)}" stroke-width="1.2"/>` :
      `<rect x="${x + 0.5}" y="${ym - 4}" width="8" height="8" fill="${vOut ? ON : '#000'}" stroke="${col(vOut)}" stroke-width="1.2"/>`;
    return { x: x + 9, y: ym, s };
  }
  const notx = (x, y, v) => `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" fill="#000" stroke="${col(v)}"/><path d="M${x - 4},${y - 4} L${x + 4},${y + 4} M${x + 4},${y - 4} L${x - 4},${y + 4}" stroke="${col(v)}"/>`;
  const circ = (x, y, s, v) => `<circle cx="${x}" cy="${y}" r="6" fill="#000" stroke="${col(v)}"/>` + tx(x, y + 3, s, 7.5, 'middle', v ? ON : '#e8e8e8');
  const timer = (x, y, lab, v, t) => `<rect x="${x}" y="${y - 8}" width="20" height="16" rx="3" fill="${v ? '#5a0000' : '#000'}" stroke="${col(v)}"/><path d="M${x + 4},${y} L${x + 14},${y} M${x + 11},${y - 3} L${x + 15},${y} L${x + 11},${y + 3} M${x + 15},${y - 4} L${x + 15},${y + 4}" stroke="${col(v)}" fill="none"/>` +
    tx(x + 10, y + 16, lab, 7, 'middle') + (t ? tx(x + 10, y - 11, t, 7, 'middle', CY) : '');
  // ---- kotak input (dapat diaktifkan) ----
  function inBox(n, id, x, y, w, opt = {}) {
    const u = U(n), d = JZ[id], v = u.jzSig(id), fr = u.jf[id], h = opt.h || 13;
    const code = opt.code !== false && d.code, cw = code ? 30 : 0, tgt = u.jtgt[id];
    const fill = v ? '#4a0000' : '#000', sk = fr ? '#ffd000' : v ? ON : '#d8d8d8';
    let s = `<g data-a="x:jzi:${n}:${id}" style="cursor:pointer"><rect x="${x}" y="${y - h / 2}" width="${w}" height="${h}" fill="${fill}" stroke="${sk}" stroke-width="${fr ? 1.6 : 1}" ${fr ? 'stroke-dasharray="3 2"' : ''}/>`;
    s += tx(x + (w - cw) / 2, y + 3, opt.lab || d.lab, opt.fs || 7.5, 'middle', v ? '#fff' : '#e8e8e8');
    if (code) s += `<rect x="${x + w - cw}" y="${y - h / 2}" width="${cw}" height="${h}" fill="${tgt ? '#7a0000' : '#000'}" stroke="${sk}"/>` + tx(x + w - cw / 2, y + 3, d.code, 7.5, 'middle');
    if (fr) s += tx(x - 3, y + 3, fr === 'on' ? 'F1' : 'F0', 7, 'end', '#ffd000');
    s += '</g>';
    if (d.ana && opt.val !== false) { const a = ANA[d.ana], av = a.get(u), man = (u.ja[d.ana] || (a.plant && P.ja[d.ana])); s += tx(x + w + 3, y - 3, `${f(av, a.unit === 'El.m' ? 2 : 1)}${a.unit === 'El.m' ? '' : ' ' + a.unit} ${d.dir}${d.lim}`, 6.8, 'start', man ? '#ffd000' : CY); }
    return s;
  }
  const relay = (x, y, top, name, on, cause, act) => `<g data-a="${act}" style="cursor:pointer">${tx(x + 40, y - 22, top, 7.5, 'middle')}<rect x="${x}" y="${y - 17}" width="80" height="34" fill="${on ? '#7a0000' : '#000'}" stroke="${on ? ON : '#e8e8e8'}" stroke-width="${on ? 2 : 1}"/>` +
    `<line x1="${x + 14}" y1="${y - 17}" x2="${x + 14}" y2="${y + 17}" stroke="#e8e8e8"/><line x1="${x}" y1="${y}" x2="${x + 14}" y2="${y}" stroke="#e8e8e8"/>` + tx(x + 7, y - 5, 'S', 8, 'middle') + tx(x + 7, y + 12, 'R', 8, 'middle') +
    tx(x + 47, y - 4, 'LOCK OUT', 7.5, 'middle') + tx(x + 47, y + 6, `RELAY (${name})`, 7.5, 'middle') + '</g>' + (on && cause ? tx(x, y + 27, String(cause).slice(0, 52), 7, 'start', '#ff8080') : '');
  const outBox = (x, y, w, lab, v) => `<rect x="${x}" y="${y - 10}" width="${w}" height="20" fill="${v ? '#5a0000' : '#000'}" stroke="${v ? ON : '#e8e8e8'}" stroke-width="${v ? 1.8 : 1}"/>` + lab.split('\n').map((l, i, a) => tx(x + w / 2, y + 3 - (a.length - 1) * 4.5 + i * 9, l, 7.5, 'middle')).join('');
  const pb = (x, y, lab, act) => `<g data-a="${act}" style="cursor:pointer"><rect x="${x}" y="${y - 7}" width="${lab.length * 4.6 + 22}" height="14" rx="2" fill="#b4b4b4" stroke="#fff"/>` +
    `<path d="M${x + 4},${y + 3} L${x + 8},${y + 3} M${x + 8},${y - 2} L${x + 14},${y - 2} M${x + 11},${y - 5} L${x + 11},${y - 2} M${x + 14},${y + 3} L${x + 18},${y + 3}" stroke="#000"/>` + tx(x + 20, y + 3, lab, 7.5, 'start', '#000') + '</g>';
  const navTo = (x, y, w, lab, scr, v) => `<g data-a="nav:${scr}" style="cursor:pointer"><rect x="${x}" y="${y - 7}" width="${w}" height="14" fill="${v ? '#4a0000' : '#000'}" stroke="${v ? ON : '#d8d8d8'}"/>${tx(x + w / 2, y + 3, lab, 7.5, 'middle')}</g>`;
  // ---- panel bawah: unit, sheet, input aktif ----
  function panel(n, sh, x = 640, y = 470, w = 345) {
    const u = U(n), cp = w < 300, dy = cp ? 20 : 0;
    let s = `<rect x="${x}" y="${y}" width="${w}" height="${640 - y}" fill="#0a0a0a" stroke="#555"/>` + tx(x + 6, y + 13, 'UNIT', 8, 'start', '#aaa');
    [1, 2, 3].forEach((k) => { s += X.b3(x + 32 + (k - 1) * 40, y + 4, 36, 15, `NO.${k}`, k === n ? 'yel' : '', `nav:jz${'abc'[sh - 1]}${k}`); });
    const sx = cp ? x + 32 : x + 192, sy = y + 4 + dy;
    if (!cp) s += tx(x + 160, y + 13, 'SHEET', 8, 'start', '#aaa');
    ['SH.001', 'SH.002', 'SH.003'].forEach((t, i) => { s += X.b3(sx + i * 51, sy, 48, 15, t, i === sh - 1 ? 'yel' : '', `nav:jz${'abc'[i]}${n}`); });
    y += dy;
    const act = Object.keys(u.jf).map((id) => `${JZ[id].soe} ${JZ[id].lab} (${u.jf[id] === 'on' ? 'ON' : 'OFF'})`).concat(Object.keys(u.ja).map((k) => `${ANA[k].name} → ${f(u.ja[k].tgt)} ${ANA[k].unit}`)).concat(Object.keys(P.ja || {}).map((k) => `${ANA[k].name} → ${f(P.ja[k].tgt, 2)} ${ANA[k].unit}`));
    s += tx(x + 6, y + 34, `INPUT DIAKTIFKAN INSTRUKTUR (${act.length})`, 8, 'start', '#ffd000');
    act.slice(0, 6).forEach((t, i) => { s += tx(x + 6, y + (cp ? 70 : 47) + i * 11, '• ' + t.slice(0, cp ? 40 : 64), 7.5); });
    if (act.length > 6) s += tx(x + 6, y + 47 + 66, `… +${act.length - 6} lagi`, 7.5, 'start', '#aaa');
    s += X.b3(cp ? x + 6 : x + w - 112, cp ? y + 42 : y + 26, 106, 16, 'NORMALKAN SEMUA', act.length ? 'pink' : '', `x:jzclr:${n}`);
    if (!cp) s += tx(x + 6, 636, 'Ketuk kotak input untuk mengaktifkan. Merah = sinyal 1. Garis kuning putus-putus = dipaksa (F1/F0).', 6.8, 'start', '#888');
    return s;
  }

  /* ============================== SH.001 – 86-1 / 86-2 / 86-4 ============================== */
  function sh1(n) {
    const u = U(n), g = u.jg || {}, S = (id) => u.jzSig(id), lo = g.lo || {};
    let s = title(`PROTECTION SCHEME FOR GENERATOR (86-1, 86-2 AND 86-4) – UNIT ${n}`) + backBtn() + tx(10, 36, 'JEZ2K031 SH.001', 8, 'start', '#888');
    const BX = 14, BW = 200, BE = BX + BW;
    // ---- UPRB / M3425A-1 ----
    s += frame(8, 42, 410, 342, '*UPRB') + frame(12, 52, 300, 140, '<M3425A-1>') + frame(12, 208, 300, 150, '<M3425A-2>');
    s += pb(150, 60, 'RESET PB', `x:jztr:${n}:M3425A-1`) + pb(150, 216, 'RESET PB', `x:jztr:${n}:M3425A-2`);
    const r1 = { DI0119: 74, DI0117: 90, DI0116: 106, DI0118: 122, DI0120: 138, M1PS: 160, M1ST: 176 };
    const r2 = { DI0125: 230, DI0124: 246, DI0121: 262, DI0122: 278, DI0123: 294, M2PS: 316, M2ST: 332 };
    for (const [id, y] of Object.entries(Object.assign({}, r1, r2))) s += inBox(n, id, BX, y, BW);
    s += inBox(n, 'DI0126', BX, 370, BW, { lab: 'OC RELAY FOR EXCITATION CIRCUIT' });
    // blok 52 OPEN (A) & LINE CHARGE (B)
    const blk = (y, sig, outv, extraB) => { let t = circ(236, y - 10, 'A', g.A) + notx(250, y - 10, g.A) + W([[242, y - 10], [262, y - 10]], !g.A) + W([[BE, y], [262, y]], sig);
      if (extraB) t += circ(236, y + 10, 'B', g.B) + notx(250, y + 10, g.B) + W([[242, y + 10], [262, y + 10]], !g.B);
      const gg = gate('AND', 262, extraB ? [y - 10, y, y + 10] : [y - 10, y], extraB ? [!g.A, sig, !g.B] : [!g.A, sig], outv); return { t: t + gg.s, o: gg }; };
    const b64vs = blk(r1.DI0117, S('DI0117'), g.and64VS), b51 = blk(r1.DI0118, S('DI0118'), g.and51), b40 = blk(r2.DI0124, S('DI0124'), g.and40), b27 = blk(r2.DI0122, S('DI0122'), g.and27, true);
    s += b64vs.t + b51.t + b40.t + b27.t;
    // OR M3425A-1: 64V, 64VS, 87
    const or1 = gate('OR', 330, [70, 84, 98], [S('DI0119'), g.and64VS, S('DI0116')], g.or1);
    s += route(BE, r1.DI0119, 300, 330, 70, S('DI0119')) + route(b64vs.o.x, b64vs.o.y, 296, 330, 84, g.and64VS) + route(BE, r1.DI0116, 304, 330, 98, S('DI0116')) + or1.s;
    const al1 = gate('OR', 330, [160, 176], [S('M1PS'), S('M1ST')], g.alm1); s += W([[BE, 160], [330, 160]], S('M1PS')) + W([[BE, 176], [330, 176]], S('M1ST')) + al1.s + tx(346, 187, '→ SOE DI0127', 6.8, 'start', '#888');
    const or2 = gate('OR', 330, [230, 244], [S('DI0125'), g.and40], g.or2); s += W([[BE, 230], [330, 230]], S('DI0125')) + route(b40.o.x, b40.o.y, 300, 330, 244, g.and40) + or2.s;
    const or3 = gate('OR', 330, [262, 276], [S('DI0121'), g.and27], g.or3); s += W([[BE, 262], [330, 262]], S('DI0121')) + route(b27.o.x, b27.o.y, 304, 330, 276, g.and27) + or3.s;
    const al2 = gate('OR', 330, [316, 332], [S('M2PS'), S('M2ST')], g.alm2); s += W([[BE, 316], [330, 316]], S('M2PS')) + W([[BE, 332], [330, 332]], S('M2ST')) + al2.s + tx(346, 343, '→ SOE DI0128', 6.8, 'start', '#888');
    s += W([[BE, r2.DI0123], [300, r2.DI0123]], S('DI0123')) + tx(304, r2.DI0123 + 3, '64E → SOE DI0123 & SH.003 (86-5)', 6.8, 'start', '#888');
    // ---- input bawah kiri ----
    s += frame(8, 392, 220, 22, '*AVR') + inBox(n, 'DI0082', BX, 404, BW);
    s += frame(8, 422, 220, 22, 'LOT-IIIA') + navTo(BX, 434, BW, 'Factor of 86-2 (See SH.02)', `jzb${n}`, g.lot3a);
    s += frame(8, 452, 220, 58, 'THERMO-METER PANEL') + inBox(n, 'DI0181', BX, 466, BW) + inBox(n, 'DI0182', BX, 482, BW) + inBox(n, 'DI0183', BX, 498, BW);
    s += frame(8, 548, 220, 58, 'Main Control House (Switchyard)') + tx(14, 566, 'OPS', 7.5, 'start', '#aaa') + pb(40, 566, '3-86-4', `x:jzrs:${n}:86-4`) + inBox(n, 'SMP1', BX, 590, BW, { lab: 'SMP-1 EMERGENCY STOP SWITCH' });
    // ---- kolom tengah bawah ----
    s += frame(236, 403, 186, 20, 'LOT-IIIC') + navTo(242, 414, 176, '86-T etc. (See SH.02)', `jzb${n}`, g.lot3c);
    s += route(BE, r1.DI0120, 380, 380, 407, S('DI0120'));
    s += frame(236, 437, 186, 81, 'CO2 F.F') + `<rect x="300" y="442" width="118" height="12" fill="#000" stroke="#d8d8d8"/>` + tx(359, 451, 'CONDITION FOR CO2 JET', 7, 'middle') + route(BE, r1.DI0116, 292, 300, 448, S('DI0116'));
    s += inBox(n, 'DI0314', 242, 510, 176);
    s += frame(236, 526, 186, 50, '*ULCB') + inBox(n, 'DI0039', 242, 540, 176) + tx(244, 562, 'ULCB', 7.5, 'start', '#aaa') + pb(270, 562, '3-86-4', `x:jzrs:${n}:86-4`);
    // ---- OR 86-1 (7 input) ----
    const y1s = [64, 76, 88, 100, 112, 124, 136];
    const src1 = [[or1.x, or1.y, g.or1], [al1.x, al1.y, g.alm1], [or2.x, or2.y, g.or2], [al2.x, al2.y, g.alm2], [BE, 370, S('DI0126')], [BE, 404, S('DI0082')], [418, 414, g.lot3c]];
    src1.forEach(([sx, sy, v], i) => { s += route(sx, sy, 440 + i * 8, 520, y1s[i], v); });
    const g861 = gate('OR', 520, y1s, src1.map((a) => a[2]), g.set1); s += g861.s;
    // ---- OR 86-2 (7 input) ----
    const y2s = [252, 264, 276, 288, 300, 312, 324];
    const src2 = [[BE, 434, g.lot3a], [418, 510, S('DI0314')], [BE, 466, S('DI0181')], [BE, 482, S('DI0182')], [BE, 498, S('DI0183')], [418, 540, S('DI0039')], [BE, 590, S('SMP1')]];
    src2.forEach(([sx, sy, v], i) => { s += route(sx, sy, 498 + i * 7, 560, y2s[i], v); });
    const g862 = gate('OR', 560, y2s, src2.map((a) => a[2]), g.set2); s += g862.s;
    // ---- OR 86-4 ----
    const g864 = gate('OR', 560, [404, 416], [g.and51, g.or3], g.set4);
    s += route(b51.o.x, b51.o.y, 548, 560, 404, g.and51) + route(or3.x, or3.y, 553, 560, 416, g.or3) + g864.s;
    // ---- lockout relay + reset (R = PB AND NOT SET) ----
    const rel = (k, ys, gout, set, top) => {
      let t = W([[gout.x, gout.y], [600, gout.y], [600, ys - 9], [620, ys - 9]], set);
      t += pb(566, ys + 22, `3-${k}`, `x:jzrs:${n}:${k}`) + notx(608, ys + 9, set) + W([[600, ys + 9], [620, ys + 9]], !set) + W([[gout.x + 30, gout.y], [gout.x + 30, gout.y]], set);
      t += relay(620, ys, top, k, lo[k], u.lo[k], `x:jzrs:${n}:${k}`);
      return t;
    };
    s += rel('86-1', 106, g861, g.set1, 'EMERGENCY STOP') + rel('86-2', 288, g862, g.set2, 'QUICK STOP') + rel('86-4', 410, g864, g.set4, 'NO-LOAD & EXCITATION');
    // ---- output (kanan) ----
    s += outBox(830, 48, 155, 'GENERATOR CIRCUIT BREAKER\n(52) OPEN', g.A) + circ(818, 48, 'A', g.A) + outBox(830, 72, 155, 'LINE CHARGE MODE : USE', g.B) + circ(818, 72, 'B', g.B) + outBox(830, 96, 155, 'GUIDE VANE :\nNO-LOAD OPENING', g.GVNL);
    s += W([[700, 106], [722, 106], [722, 430]], lo['86-1']) + W([[700, 288], [732, 288], [732, 140]], lo['86-2']) + W([[700, 410], [742, 410], [742, 158]], lo['86-4']);
    const an = gate('AND', 778, [138, 148], [g.GVNL, lo['86-2']], g.and52); s += W([[830, 96], [770, 96], [770, 138], [778, 138]], g.GVNL) + W([[732, 148], [778, 148]], lo['86-2']) + an.s;
    const t52 = gate('OR', 800, [132, 143, 156], [lo['86-1'], g.and52, lo['86-4']], g.trip52); s += W([[722, 132], [800, 132]], lo['86-1']) + W([[an.x, an.y], [800, 143]], g.and52) + W([[742, 156], [800, 156]], lo['86-4']) + t52.s + W([[t52.x, t52.y], [830, t52.y]], g.trip52) + outBox(830, t52.y, 155, 'GENERATOR CIRCUIT BREAKER\n(52) TRIP', g.trip52);
    const o12 = gate('OR', 760, [196, 206], [lo['86-1'], lo['86-2']], g.or12); s += W([[722, 196], [760, 196]], lo['86-1']) + W([[732, 206], [760, 206]], lo['86-2']) + o12.s;
    const a41 = gate('AND', 800, [201, 213], [g.or12, g.A], g.trip41); s += W([[o12.x, o12.y], [800, 201]], g.or12) + W([[818, 54], [812, 54], [812, 220], [796, 220], [796, 213], [800, 213]], g.A) + a41.s + W([[a41.x, a41.y], [830, a41.y]], g.trip41) + outBox(830, 207, 155, 'FIELD CIRCUIT BREAKER\n(41) TRIP', g.trip41);
    const tq = gate('OR', 800, [254, 264], [lo['86-1'], lo['86-2']], g.tqs); s += W([[722, 254], [800, 254]], lo['86-1']) + W([[732, 264], [800, 264]], lo['86-2']) + tq.s + W([[tq.x, tq.y], [830, tq.y]], g.tqs) + outBox(830, 259, 155, 'TURBINE QUICK SHUTDOWN\n(REG)', g.tqs);
    s += W([[722, 306], [786, 306]], lo['86-1']) + W([[732, 318], [786, 318]], lo['86-2']) + notx(770, 306, lo['86-1']) + notx(770, 318, lo['86-2']);
    const iv = gate('AND', 790, [306, 318], [!lo['86-1'], !lo['86-2']], !g.ivqs); s += iv.s + W([[iv.x, iv.y], [830, iv.y]], g.ivqs) + outBox(830, 312, 155, 'INLET VALVE QUICK\nSHUTDOWN (TCC)', g.ivqs) + tx(830, 334, 'kontak NC (fail-safe): aktif bila 86-1/86-2 operate', 6.5, 'start', '#888');
    s += tx(760, 380, 'Semua sinyal juga ke SOE ULCU → OPS (DI0113–DI0128, DI0082, DI0314, DI0181–0183, DI0039)', 6.5, 'middle', '#888');
    s += panel(n, 1, 640, 455, 345);
    return s;
  }

  /* ============================== SH.002 – 86-1 (LOT-IIIC) & 86-2 (LOT-IIIA) ============================== */
  function sh2(n) {
    const u = U(n), g = u.jg || {}, S = (id) => u.jzSig(id), lo = g.lo || {};
    let s = title(`PROTECTION SCHEME 86-1 (LOT-IIIC) AND 86-2 (LOT-IIIA) – UNIT ${n}`) + backBtn() + tx(10, 36, 'JEZ2K031 SH.002', 8, 'start', '#888');
    const tag = (x, y, t) => tx(x, y - 3, t, 6.5, 'end', '#888');
    // ---- MTPP / PCPP ----
    s += frame(30, 46, 470, 250, '*MTPP') + frame(38, 60, 440, 62, '*PCPP (AT Main Control House)');
    const pc = [['6DI0153', 46, 76], ['6DI0154', 220, 92], ['6DI0140', 46, 108]];
    pc.forEach(([id, x, y]) => { s += inBox(n, id, x, y, 170) + W([[x + 170, y], [452, y]], S(id)) + tag(450, y, `${id}`); });
    const gpc = gate('OR', 452, pc.map((a) => a[2]), pc.map((a) => S(a[0])), g.pcpp); s += gpc.s;
    const mt = [['DI0257', 46, 136], ['DI0258', 220, 150], ['DI0265', 46, 164], ['DI0268', 220, 178], ['DI0270', 46, 192], ['DI0259', 220, 206], ['DI0260', 46, 220]];
    mt.forEach(([id, x, y]) => { s += inBox(n, id, x, y, 170, { val: false }) + W([[x + 170, y], [452, y]], S(id)) + tag(450, y, id); });
    // 452 & UPRB 64T
    s += frame(38, 248, 200, 66, '452-*') + frame(250, 248, 200, 66, '*UPRB');
    const us = [['4DI0093', 260], ['UOCHV', 280], ['UOCLV', 298]];
    us.forEach(([id, y]) => { s += inBox(n, id, 46, y, 160); });
    const goc = gate('OR', 222, [280, 298], [S('UOCHV'), S('UOCLV')], g.ustOC); s += W([[206, 280], [222, 280]], S('UOCHV')) + W([[206, 298], [222, 298]], S('UOCLV')) + goc.s;
    s += inBox(n, 'DI0120', 270, 262, 150, { lab: 'GROUND OVER VOLTAGE', code: false });
    const gust = gate('OR', 440, [262, 276, 290], [S('DI0120'), S('4DI0093'), g.ustOC], g.ust);
    s += W([[420, 262], [440, 262]], S('DI0120')) + W([[206, 260], [214, 260], [214, 276], [440, 276]], S('4DI0093')) + W([[goc.x, goc.y], [440, 290]], g.ustOC) + gust.s + tag(438, 276, '4DI0093') + tag(438, 290, '4DI0092');
    s += W([[gust.x, gust.y], [462, gust.y], [462, 234], [452, 234]], g.ust);
    const gmt = gate('OR', 452, [136, 150, 164, 178, 192, 206, 220, 234], mt.map((a) => S(a[0])).concat([g.ust]), g.mtpp); s += gmt.s;
    const g1 = gate('OR', 560, [92, 178], [g.pcpp, g.mtpp], g.lot3c); s += W([[gpc.x, gpc.y], [560, 92]], g.pcpp) + W([[gmt.x, gmt.y], [560, 178]], g.mtpp) + g1.s;
    s += W([[g1.x, g1.y], [640, g1.y]], g.lot3c) + frame(632, 100, 120, 70, '*UPRB') + relay(652, 135, 'EMERGENCY STOP', '86-1', lo['86-1'], u.lo['86-1'], `nav:jza${n}`);
    s += tx(640, 186, 'ALL FACTORS FOR 86-1 ARE DESCRIBED IN SHEET01.', 7, 'start', '#aaa') + tx(640, 198, 'MTPP → 86-T (152-U trip) + 86-1 · PCPP → 86-PC + 86-1', 7, 'start', '#888');
    s += outBox(780, 135, 150, `86-T ${u.lo['86-T'] ? 'OPERATE' : 'normal'} · 86-PC ${u.lo['86-PC'] ? 'OPERATE' : 'normal'}`, u.lo['86-T'] || u.lo['86-PC']);
    // ---- 86-2: REG, TCC, ACT, IVACT ----
    s += frame(30, 330, 470, 36, '*REG') + frame(30, 378, 470, 166, '*TCC') + frame(30, 556, 470, 22, '*ACT') + frame(30, 590, 470, 22, '*IVACT');
    const rg = [['DI0129', 46, 342], ['DI0130', 220, 356]];
    const tc = [['DI0217', 46, 390], ['DI0152', 260, 404], ['DI0155', 46, 418], ['DI0212', 260, 432], ['DI0226', 46, 446], ['DI0229P', 260, 460], ['DI0204', 46, 474], ['DI0222', 260, 488], ['TCCES', 46, 502]];
    rg.concat(tc).forEach(([id, x, y]) => { s += inBox(n, id, x, y, x > 200 ? 180 : 200, { val: false }) + W([[x + (x > 200 ? 180 : 200), y], [452, y]], S(id)) + tag(450, y, JZ[id].soe); });
    const grg = gate('OR', 452, [342, 356], [S('DI0129'), S('DI0130')], g.reg); s += grg.s;
    const gtc = gate('OR', 452, tc.map((a) => a[2]), tc.map((a) => S(a[0])), g.tcc); s += gtc.s;
    s += inBox(n, 'DI0157', 46, 568, 200) + W([[246, 568], [452, 568]], S('DI0157')) + tag(450, 568, 'DI0157');
    s += inBox(n, 'DI0229L', 46, 602, 200) + W([[246, 602], [452, 602]], S('DI0229L')) + tag(450, 602, 'DI0229');
    const g2 = gate('OR', 560, [349, 446, 568, 602], [g.reg, g.tcc, S('DI0157'), S('DI0229L')], g.lot3a);
    s += W([[grg.x, grg.y], [560, 349]], g.reg) + W([[gtc.x, gtc.y], [560, 446]], g.tcc) + W([[452, 568], [560, 568]], S('DI0157')) + W([[452, 602], [560, 602]], S('DI0229L')) + g2.s;
    s += W([[g2.x, g2.y], [640, g2.y]], g.lot3a) + frame(632, 440, 120, 70, '*UPRB') + relay(652, 475, 'QUICK STOP', '86-2', lo['86-2'], u.lo['86-2'], `nav:jza${n}`);
    s += tx(640, 525, 'ALL FACTORS FOR 86-2 ARE DESCRIBED IN SHEET01.', 7, 'start', '#aaa');
    if (S('DI0217')) s += X.b3(780, 380, 190, 18, 'RESET PENDULUM 33-12M (lokal)', 'pink', `x:jzpend:${n}`);
    s += panel(n, 2, 640, 540, 345);
    return s;
  }

  /* ============================== SH.003 – 86-5 DAMAGE PREVENTIVE STOP ============================== */
  function sh3(n) {
    const u = U(n), g = u.jg || {}, S = (id) => u.jzSig(id), lo = g.lo || {};
    let s = title(`PROTECTION SCHEME (86-5 SOFTWARE LOGIC IN SCADA) – UNIT ${n}`) + backBtn() + tx(10, 36, 'JEZ2K031 SH.003 rev.A', 8, 'start', '#888');
    const grp = [['*GTB', ['DI0097', 'DI0098', 'DI0099', 'DI0100', 'DI0101']], ['*PRB', ['DI0123', 'DI0184', 'DI0185']],
      ['*VMC', ['DI0187', 'DI0189', 'DI0191', 'DI0193', 'DI0195', 'DI0197', 'DI0322', 'DI0324', 'DI0326', 'DI0328', 'DI0330', 'DI0332']], ['*ACT', ['DI0159']], ['*IVACT', ['DI0225']],
      ['*TCC', ['DI0151', 'DI0154', 'DI0203', 'DI0211', 'DI0213', 'DI0231', 'DI0236', 'DI0240']], ['MCC*A/B', ['DI0289', 'DI0301']], ['*REG', ['DI0143', 'DI0142']], ['RTU-I (INTAKE)', ['RTUI']]];
    const PY = 13.4; let y = 50; const pos = {};
    for (const [lab, ids] of grp) {
      const y0 = y - 9; ids.forEach((id, i) => { pos[id] = { y, x: i % 2 ? 196 : 16 }; y += PY; });
      s += frame(10, y0, 380, y - y0 - 4, lab); y += 8;
    }
    const BUS = 760, special = { DI0100: 1, DI0101: 1, DI0236: 1, DI0240: 1, DI0289: 1, DI0301: 1, DI0143: 1, DI0142: 1, RTUI: 1 };
    for (const [id, p] of Object.entries(pos)) {
      s += inBox(n, id, p.x, p.y, id === 'RTUI' ? 150 : 178, { code: id === 'DI0123', fs: 7, h: 11, val: false, lab: id === 'RTUI' ? 'INTAKE WATER LEVEL' : undefined });
      const d = JZ[id]; if (d.ana && id !== 'RTUI') { const a = ANA[d.ana], man = u.ja[d.ana]; s += tx(382, p.y - 2, `${f(a.get(u))} ${a.unit} ${d.dir}${d.lim}`, 6.6, 'start', man ? '#ffd000' : CY); }
      if (!special[id]) s += W([[p.x + 178, p.y], [BUS, p.y]], S(id)) + tx(700, p.y - 2, '*' + JZ[id].soe, 6.3, 'start', '#888');
    }
    // AND oil level × speed > 90 %
    const y142 = pos.DI0142.y, a100 = gate('AND', 700, [pos.DI0100.y, pos.DI0100.y + 7], [S('DI0100'), S('DI0142')], g.and100), a101 = gate('AND', 700, [pos.DI0101.y, pos.DI0101.y + 7], [S('DI0101'), S('DI0142')], g.and101);
    s += W([[pos.DI0100.x + 178, pos.DI0100.y], [700, pos.DI0100.y]], S('DI0100')) + W([[pos.DI0101.x + 178, pos.DI0101.y], [700, pos.DI0101.y]], S('DI0101'));
    s += W([[pos.DI0142.x + 178, y142], [680, y142], [680, pos.DI0100.y + 7], [700, pos.DI0100.y + 7]], S('DI0142')) + W([[680, pos.DI0101.y + 7], [700, pos.DI0101.y + 7]], S('DI0142'));
    s += a100.s + a101.s + W([[a100.x, a100.y], [BUS, a100.y]], g.and100) + W([[a101.x, a101.y], [BUS, a101.y]], g.and101);
    // timer 2 min + ARM
    const t236 = u.p.mon.t236 || 0, t240 = u.p.mon.t240 || 0, t30 = u.p.mon.t30 || 0;
    s += W([[pos.DI0236.x + 178, pos.DI0236.y], [600, pos.DI0236.y]], S('DI0236')) + timer(600, pos.DI0236.y, '2min', g.ton236, S('DI0236') ? `${Math.min(120, t236).toFixed(0)} s` : '');
    s += W([[pos.DI0240.x + 178, pos.DI0240.y], [600, pos.DI0240.y]], S('DI0240')) + timer(600, pos.DI0240.y, '2min', g.ton240, S('DI0240') ? `${Math.min(120, t240).toFixed(0)} s` : '');
    const yA = pos.DI0289.y + 6;
    const ocw = gate('OR', 520, [pos.DI0289.y, pos.DI0301.y], [S('DI0289'), S('DI0301')], g.cwStart);
    s += W([[pos.DI0289.x + 178, pos.DI0289.y], [520, pos.DI0289.y]], S('DI0289')) + W([[pos.DI0301.x + 178, pos.DI0301.y], [520, pos.DI0301.y]], S('DI0301')) + ocw.s;
    s += W([[ocw.x, ocw.y], [552, ocw.y]], g.cwStart) + timer(552, ocw.y, '30SEC', g.ton30, g.cwStart && !g.ton30 ? `${t30.toFixed(0)} s` : '') + W([[572, ocw.y], [600, ocw.y]], g.ton30);
    s += `<rect x="600" y="${ocw.y - 9}" width="20" height="30" fill="${g.arm ? '#5a0000' : '#000'}" stroke="${col(g.arm)}"/>` + tx(610, ocw.y + 3, 'S', 8, 'middle') + tx(610, ocw.y + 17, 'R', 8, 'middle');
    s += W([[pos.DI0143.x + 178, pos.DI0143.y], [590, pos.DI0143.y], [590, ocw.y + 14], [600, ocw.y + 14]], S('DI0143')) + circ(640, ocw.y + 3, 'A', g.arm) + W([[620, ocw.y + 3], [634, ocw.y + 3]], g.arm);
    s += tx(640, ocw.y + 18, 'ARM (latch)', 6.8, 'middle', '#888');
    const a236 = gate('AND', 680, [pos.DI0236.y, pos.DI0236.y + 8], [g.ton236, g.arm], g.and236), a240 = gate('AND', 680, [pos.DI0240.y, pos.DI0240.y + 8], [g.ton240, g.arm], g.and240);
    s += W([[620, pos.DI0236.y], [680, pos.DI0236.y]], g.ton236) + W([[620, pos.DI0240.y], [680, pos.DI0240.y]], g.ton240) + W([[648, ocw.y + 3], [660, ocw.y + 3], [660, pos.DI0236.y + 8], [680, pos.DI0236.y + 8]], g.arm) + W([[660, pos.DI0240.y + 8], [680, pos.DI0240.y + 8]], g.arm);
    s += a236.s + a240.s + W([[a236.x, a236.y], [BUS, a236.y]], g.and236) + W([[a240.x, a240.y], [BUS, a240.y]], g.and240);
    // RTU-I: comparator L
    const yr = pos.RTUI.y;
    s += W([[166, yr], [230, yr]], S('RTUI')) + `<rect x="230" y="${yr - 7}" width="14" height="14" fill="${S('RTUI') ? '#5a0000' : '#000'}" stroke="${col(S('RTUI'))}"/>` + tx(237, yr + 3, 'L', 8, 'middle') + tx(250, yr + 12, `< 577.51 Elm · ${f(P.intakeWL, 2)} m`, 6.5, 'start', '#888');
    s += W([[244, yr], [300, yr]], S('RTUI')) + circ(306, yr, 'A', S('RTUI')) + circ(BUS - 20, 44, 'A', S('RTUI')) + W([[BUS - 14, 44], [BUS, 44]], S('RTUI'));
    // OR 86-5 (bus) + relay + reset
    const allY = Object.entries(pos).filter(([id]) => !special[id] || id === 'RTUI').map(([, p]) => p.y).concat([44, a100.y, a101.y, a236.y, a240.y]);
    const yMid = 300;
    s += `<line x1="${BUS}" y1="${Math.min(...allY) - 4}" x2="${BUS}" y2="${Math.max(...allY) + 4}" stroke="${col(g.set5)}" stroke-width="1.6"/>` + allY.map((yy) => arrowHead(BUS, yy, false)).join('');
    s += `<circle cx="${BUS + 5}" cy="${yMid}" r="4.5" fill="${g.set5 ? ON : '#000'}" stroke="${col(g.set5)}"/>` + W([[BUS + 10, yMid], [790, yMid], [790, yMid - 9], [800, yMid - 9]], g.set5);
    s += relay(800, yMid, 'DAMAGE PREVENTIVE STOP', '86-5', lo['86-5'], u.lo['86-5'], `x:jzrs:${n}:86-5`) + W([[880, yMid], [895, yMid]], lo['86-5']) + outBox(895, yMid, 90, 'UNIT NORMAL\nSHUT DOWN', lo['86-5']);
    const a5 = gate('AND', 785, [yMid + 30, yMid + 40], [S('DI0143'), false], false);
    s += W([[pos.DI0143.x + 178, pos.DI0143.y], [770, pos.DI0143.y], [770, yMid + 30], [785, yMid + 30]], S('DI0143')) + a5.s + W([[a5.x, a5.y], [796, a5.y], [796, yMid + 9], [800, yMid + 9]], false);
    s += pb(770, yMid + 58, '86-5 RESET FACE PLATE (OPS)', `x:jzrs:${n}:86-5`) + W([[780, yMid + 51], [780, yMid + 40], [785, yMid + 40]], false);
    s += tx(BUS + 30, 620, '※ALL OF ABOVE LOGIC ARE BY SOFTWARE IN LCU.', 7, 'start', '#aaa');
    s += panel(n, 3, 790, 400, 195);
    return s;
  }

  /* ============================== REGISTRASI ============================== */
  EXTU.jza = { no: (n) => '0013' + n, title: (n) => `PROTECTION SCHEME SH.001 UNIT${n}`, grp: 'jz', draw: sh1 };
  EXTU.jzb = { no: (n) => '0014' + n, title: (n) => `PROTECTION SCHEME SH.002 UNIT${n}`, grp: 'jz', draw: sh2 };
  EXTU.jzc = { no: (n) => '0015' + n, title: (n) => `PROTECTION SCHEME SH.003 UNIT${n}`, grp: 'jz', draw: sh3 };
  TABS.jz = (n) => [[`jza${n}`, 'SH.001 86-1/2/4'], [`jzb${n}`, 'SH.002 LOT-III'], [`jzc${n}`, 'SH.003 86-5'], [`ann${n}`, `UNIT${n} ANN`], ['force', 'FORCING I/O'], ['fault', 'SKENARIO/INIT'], ['alm', 'ALARM SUM.']];

  /* ============================== AKSI ============================== */
  const btns = (items) => `<div class="simgrid">${items.map(([a, l, c]) => `<button data-a="${a}" ${c ? `class="${c}"` : ''}>${esc(l)}</button>`).join('')}</div>`;
  Object.assign(EXTA, {
    jzi: ([n, id]) => {
      const u = U(+n), d = JZ[id], fr = u.jf[id], v = u.jzSig(id);
      let msg = `${d.soe}  ${d.lab}${d.code ? ' (' + d.code + ')' : ''}\n${d.dev} · JEZ2K031 SH.00${d.sh}${d.sh3 ? ' & SH.003' : ''}\n\nStatus sinyal: ${v ? '1 (ON)' : '0 (OFF)'}${fr ? ` – DIPAKSA ${fr.toUpperCase()}` : ' – dari model plant'}`;
      let extra = btns([[`x:jzf:${n}:${id}:on`, 'PAKSA ON (1)', fr === 'on' ? 'on' : ''], [`x:jzf:${n}:${id}:off`, 'PAKSA OFF (0)', fr === 'off' ? 'on' : ''], [`x:jzf:${n}:${id}:`, 'NORMAL (model)', !fr ? 'on' : '']]);
      if (d.ana) {
        const a = ANA[d.ana], av = a.get(u), man = u.ja[d.ana] || (a.plant && P.ja[d.ana]);
        const dec = a.unit === 'El.m' ? 2 : 1;
        msg += `\n\nANALOG: ${a.name} = ${f(av, dec)} ${a.unit}\nSetelan: ${d.dir} ${d.lim} ${a.unit}${man ? `\nDiubah instruktur → ${f(man.tgt, dec)} ${a.unit} (${man.rate} ${a.unit}/menit)` : ''}`;
        const step = d.dir === '>' ? 1 : -1, big = a.unit === 'El.m' ? 0.3 : a.unit === '%' ? 5 : a.unit === 'µm' ? 30 : 3;
        const t1 = +(d.lim + step * big).toFixed(2), t0 = +(d.lim - step * big * 1.5).toFixed(2);
        extra += btns([[`x:jzan:${n}:${d.ana}:${t1}:${a.rate}`, `→ ${t1} (lewati setelan)`], [`x:jzan:${n}:${d.ana}:${t1}:${a.rate * 10}`, `→ ${t1} cepat`], [`x:jzan:${n}:${d.ana}:${t0}:${a.rate}`, `→ ${t0} (normal)`], [`x:jzan:${n}:${d.ana}:`, 'LEPAS ANALOG']]);
        extra += `<div class="drow"><span class="grow">Target</span><input id="jzT" type="number" step="any" value="${t1}"> ${esc(a.unit)}</div><div class="drow"><span class="grow">Laju (${esc(a.unit)}/menit)</span><input id="jzR" type="number" step="any" value="${a.rate}"></div>` +
          btns([[`x:jzanc:${n}:${d.ana}`, 'TERAPKAN TARGET']]);
      }
      if (id === 'DI0217' && u.p.mon.pendulum) extra += btns([[`x:jzpend:${n}`, 'RESET PENDULUM 33-12M']]);
      dialog('INPUT PROTEKSI – JEZ2K031', msg, null, { extra });
    },
    jzf: ([n, id, mode]) => { X.closeDlg(); U(+n).jzForce(id, mode || null); },
    jzan: ([n, k, tgt, rt]) => { X.closeDlg(); U(+n).jzAnalog(k, tgt === '' || tgt === undefined ? null : +tgt, +rt); },
    jzanc: ([n, k]) => { const t = parseFloat(document.getElementById('jzT').value), r = parseFloat(document.getElementById('jzR').value); X.closeDlg(); if (!isNaN(t)) U(+n).jzAnalog(k, t, isNaN(r) || r <= 0 ? undefined : r); },
    jzrs: ([n, k]) => { const u = U(+n); if (!u.lo[k]) { dialog('LOCK OUT RELAY', `${k} UNIT ${n}: tidak operate.\n\nAturan reset: ${M.RESET_RULE[k]}`, null); return; }
      dialog('RESET LOCK OUT RELAY', `UNIT ${n} – ${k}\nPenyebab: ${u.lo[k]}\n\nAturan reset: ${M.RESET_RULE[k]}\n\nEXECUTE ?`, () => u.reset86(k)); },
    jztr: ([n, dev]) => { U(+n).targetReset(dev); },
    jzpend: ([n]) => { X.closeDlg(); U(+n).pendulumReset(); },
    jzclr: ([n]) => dialog('NORMALKAN SEMUA INPUT', `UNIT ${n}: semua input yang dipaksa dan nilai analog yang diubah dikembalikan ke model.\nLockout relay tetap; reset sesuai aturan.\n\nEXECUTE ?`, () => { U(+n).jzClear(); P.log('CMD', `INSTRUKTUR: U${n} semua input JEZ2K031 normal`); }),
  });
})();
