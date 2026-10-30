/* MUSI HEPP – modul station service (20 kV / 400 V MCH & powerhouse), diesel generator,
   intake dam & re-regulating dam, dan rekap operasi harian.
   Sumber:
   - interlock CB/DS: logic diagram Alstom P0039-001 (MCH 20 kV), P0039-002 (PH 20 kV), P0039-L001 (MCH 400 V), P0039-L002 (PH 400 V)
     (ditranskripsi di aplikasi "Interlock Station Service Musi"); 520G = 52DG
   - topologi & nama peralatan: layar OPS MAIN CONTROL HOUSE / UNDERGROUND POWERHOUSE (13-Okt-2017)
   - changeover otomatis: block diagram JEZ1L693 (USSLCU SH.011–032, MSSLCU SH.073–083, DG SH.109)
   - annunciator: JEZ1L693 SH.064 (USS) & SH.110 (MSS), JEZ1L699 SH.063–079 (mimic board)
   - intake dam: JEZ2K041; re-regulating dam: JEZ2K042 */
(function (root) {
  'use strict';
  const M = (typeof module !== 'undefined' && module.exports) ? require('./plant-engine.js') : root.MUSI;
  const { clamp, rate, lag } = M;

  /* ============================== EKSPRESI INTERLOCK ============================== */
  const AND = (...c) => ({ k: 'and', c }), OR = (...c) => ({ k: 'or', c });
  const O = (id) => ({ k: 'dev', id, v: false }), C = (id) => ({ k: 'dev', id, v: true });
  const RON = (id) => ({ k: 'rel', id, v: true }), ROFF = (id) => ({ k: 'rel', id, v: false });
  const READY = (id) => ({ k: 'flag', id });

  /* ============================== PERALATAN ==============================
     t: CB / DS / ES ; loc: MCH20 / MCH04 / PH20 / PH04 ; src: 'doc' (logic Alstom) | 'asumsi' (peralatan di luar 4 dokumen) */
  const DEV = {};
  const dev = (id, o) => { DEV[id] = Object.assign({ id, close: null, open: null, src: 'doc', trips: [] }, o); };
  const T2 = ['50/51', '50N/51N'], TL = ['50/51'], TLN = ['50/51', '51N'];
  const ALLCB_MCH = AND(O('252-LS'), O('252DL-BC'), O('252DL-ID'), O('252DL-RD'), O('252B-A1'), O('252B-A2'), O('252B-B1'), O('252B-B2'), O('352-BT2'), O('352-BT3'));

  // ---- MCH 20 kV (P0039-001) ----
  dev('252DL-BC', { t: 'CB', loc: 'MCH20', p: 1, trips: T2, desc: '20 kV distribution line ke Base Camp & Curup S/S',
    close: AND(C('289DL-BC'), O('289DLE-BC'), OR(RON('27-BC'), AND(RON('27-1M'), O('252-LS'), O('289-LSA'), O('289-LSB')))),
    note: 'Logic Alstom menulis "252B-01 OPEN"; tidak ada panel dengan nama itu – di simulator dibaca 252-LS (incoming LSTr).' });
  dev('289-LSA', { t: 'DS', loc: 'MCH20', p: 2, desc: 'Incoming DS 1 (bus LS → bus A)',
    close: AND(OR(O('289B'), AND(C('289B'), O('289-LSB'))), ALLCB_MCH), open: ALLCB_MCH });
  dev('252B-A2', { t: 'CB', loc: 'MCH20', p: 3, trips: T2, desc: 'Cable tunnel feeder no.1 (ke SSTr No.1 powerhouse)',
    close: AND(C('289B-A2'), OR(RON('27-1M'), RON('27-L1M'))) });
  dev('252B-A1', { t: 'CB', loc: 'MCH20', p: 4, trips: T2, desc: 'Outgoing SSTr No.3 (ke 352-S1)',
    close: OR(ROFF('27-1M'), AND(C('352-S1'), RON('27-3M')), O('352-S1')) });
  dev('289B', { t: 'DS', loc: 'MCH20', p: 6, desc: 'Bus section 20 kV bus A – bus B',
    close: AND(OR(O('289-LSA'), AND(C('289-LSA'), O('289-LSB'))), ALLCB_MCH), open: AND(OR(O('289-LSA'), AND(C('289-LSA'), O('289-LSB'))), ALLCB_MCH) });
  dev('289-LSB', { t: 'DS', loc: 'MCH20', p: 7, desc: 'Incoming DS 2 (bus LS → bus B)',
    close: AND(OR(O('289B'), AND(C('289B'), O('289-LSA'))), ALLCB_MCH), open: ALLCB_MCH });
  dev('252B-B1', { t: 'CB', loc: 'MCH20', p: 8, trips: T2, desc: 'Outgoing SSTr No.4 (ke 352-S2)',
    close: OR(ROFF('27-2M'), AND(C('352-S2'), RON('27-4M')), O('352-S2')) });
  dev('252B-B2', { t: 'CB', loc: 'MCH20', p: 9, trips: T2, desc: 'Cable tunnel feeder no.2 (ke SSTr No.2 powerhouse)',
    close: AND(C('289B-B2'), OR(RON('27-2M'), RON('27-L2M'))) });
  dev('252DL-ID', { t: 'CB', loc: 'MCH20', p: 10, trips: T2, desc: '20 kV distribution line ke Intake Dam', close: AND(C('289DL-ID'), O('289DLE-ID')) });
  dev('252DL-RD', { t: 'CB', loc: 'MCH20', p: 11, trips: T2, desc: '20 kV distribution line ke Reregulating Dam', close: AND(C('289DL-RD'), O('289DLE-RD')) });
  dev('252-LS', { t: 'CB', loc: 'MCH20', p: 14, trips: T2, desc: 'Incoming dari LSTr (152-LST switchyard)',
    close: AND(READY('lst152'), OR(
      AND(O('289B'), OR(AND(RON('27-1M'), C('289-LSA')), AND(RON('27-2M'), C('289-LSB')))),
      AND(C('289B'), RON('27-1M'), RON('27-2M'), OR(O('289-LSA'), O('289-LSB'))))) });
  // ---- PH 20 kV (P0039-002) ----
  dev('289L-1', { t: 'DS', loc: 'PH20', p: 1, desc: 'Incoming DS 1 (kabel dari MCH)', close: O('252-L1'), open: O('252-L1') });
  dev('252-L1', { t: 'CB', loc: 'PH20', p: 2, trips: T2, desc: 'Incoming SSTr No.1',
    close: AND(C('289L-1'), OR(O('352-L1'), AND(C('352-L1'), RON('27-1U')), RON('27-L1U'))) });
  dev('289L-2', { t: 'DS', loc: 'PH20', p: 3, desc: 'Incoming DS 2 (kabel dari MCH)', close: O('252-L2'), open: O('252-L2') });
  dev('252-L2', { t: 'CB', loc: 'PH20', p: 4, trips: T2, desc: 'Incoming SSTr No.2',
    close: AND(C('289L-2'), OR(O('352-L2'), AND(C('352-L2'), RON('27-2U')), RON('27-L2U'))) });
  // ---- MCH 400 V (P0039-L001) ----
  dev('352-S1', { t: 'CB', loc: 'MCH04', p: 1, trips: TLN, desc: 'Incoming SSTr No.3 → 400 V bus A', close: OR(RON('27-3M'), AND(ROFF('27-3M'), O('252B-A1'))) });
  dev('352B-A3', { t: 'CB', loc: 'MCH04', p: 3, trips: TL, desc: 'Feeder beban kelompok 1 dari bus A (pasangan 352B-B3)', close: O('352B-B3') });
  dev('352B-A4', { t: 'CB', loc: 'MCH04', p: 4, trips: TL, desc: 'Feeder beban kelompok 2 dari bus A (pasangan 352B-B4)', close: O('352B-B4') });
  dev('352-BT2', { t: 'CB', loc: 'MCH04', p: 4, trips: TL, desc: 'Bus section 400 V bus A – bus C', close: AND(O('289-LSA'), O('289-LSB'), C('352B-C1'), RON('27-3M'), O('289B')) });
  dev('352B-C1', { t: 'CB', loc: 'MCH04', p: 5, trips: TL, desc: 'Feeder diesel generator (bus C)', close: AND(O('352-BT2'), O('352-BT3'), C('52DG')) });
  dev('352-BT3', { t: 'CB', loc: 'MCH04', p: 6, trips: TL, desc: 'Bus section 400 V bus C – bus B', close: AND(O('289-LSA'), O('289-LSB'), C('352B-C1'), RON('27-4M'), O('289B')) });
  dev('352B-B4', { t: 'CB', loc: 'MCH04', p: 6, trips: TL, desc: 'Feeder beban kelompok 2 dari bus B (pasangan 352B-A4)', close: O('352B-A4') });
  dev('352B-B3', { t: 'CB', loc: 'MCH04', p: 7, trips: TL, desc: 'Feeder beban kelompok 1 dari bus B (pasangan 352B-A3)', close: O('352B-A3') });
  dev('352-S2', { t: 'CB', loc: 'MCH04', p: 9, trips: TLN, desc: 'Incoming SSTr No.4 → 400 V bus B', close: OR(RON('27-4M'), AND(ROFF('27-4M'), O('252B-B1'))) });
  // ---- PH 400 V (P0039-L002) ----
  const UNITS_OPEN = AND(...[1, 2, 3].flatMap((n) => [O('452-' + n), O(`352-${n}1`), O(`352-${n}2`)]));
  const others = (n) => [1, 2, 3].filter((k) => k !== n).flatMap((k) => [O(`352-${k}1`), O(`352-${k}2`)]);
  [1, 2, 3].forEach((n) => {
    dev(`352-${n}1`, { t: 'CB', loc: 'PH04', p: 1, unit: n, trips: TL, desc: `Unit ${n} bus 400 V ↔ 400 V BUS-A`, src: n === 1 ? 'doc' : 'asumsi (pola unit 1)',
      close: OR(AND(O('452-' + n), O(`352-${n}2`)), AND(C('452-' + n), RON('27-1U'), O('352-BT1'), ...others(n))) });
    dev(`352-${n}2`, { t: 'CB', loc: 'PH04', p: 2, unit: n, trips: TL, desc: `Unit ${n} bus 400 V ↔ 400 V BUS-B`, src: n === 1 ? 'doc' : 'asumsi (pola unit 1)',
      close: OR(AND(O('452-' + n), O(`352-${n}1`)), AND(C('452-' + n), RON('27-2U'), O('352-BT1'), ...others(n))) });
    dev(`352-${n}3`, { t: 'CB', loc: 'PH04', p: 3, unit: n, trips: TL, desc: `Feeder MCC${n}A` });
    dev(`352-${n}4`, { t: 'CB', loc: 'PH04', p: 4, unit: n, trips: TL, desc: `Feeder MCC${n}B` });
    dev('452-' + n, { t: 'CB', loc: 'PH04', p: 5, unit: n, trips: TLN, desc: `Incoming USTr No.${n} → unit ${n} bus 400 V`, src: n === 1 ? 'doc' : 'asumsi (pola unit 1)',
      close: AND(O(`352-${n}1`), O(`352-${n}2`), C('89H-' + n), O('352-L1'), O('352-L2')) });
    dev('89H-' + n, { t: 'DS', loc: 'PH04', unit: n, desc: `DS sisi generator USTr No.${n}`, src: 'asumsi', close: O('452-' + n), open: O('452-' + n) });
  });
  dev('352-4', { t: 'CB', loc: 'PH04', p: 2, trips: TL, desc: 'Feeder MCC COMMON (dari feeder 352B-A1 / 352B-B1)' });
  dev('352B-A1', { t: 'CB', loc: 'PH04', p: 3, trips: TL, desc: 'Feeder MCC common dari bus A (pasangan 352B-B1)', close: O('352B-B1') });
  dev('352-L1', { t: 'CB', loc: 'PH04', p: 4, trips: TLN, desc: 'Incoming SSTr No.1 → 400 V BUS-A', close: AND(O('352-BT1'), OR(RON('27-1U'), RON('27-L1U')), UNITS_OPEN) });
  dev('352-BT1', { t: 'CB', loc: 'PH04', p: 6, trips: TL, desc: 'Bus section 400 V BUS-A – BUS-B', close: AND(OR(RON('27-1U'), RON('27-2U')), OR(O('352-L1'), O('352-L2'))) });
  dev('352B-A2', { t: 'CB', loc: 'PH04', p: 6, trips: TL, desc: 'Feeder miscellaneous supply dari bus A (pasangan 352B-B2)', close: O('352B-B2') });
  dev('352B-B2', { t: 'CB', loc: 'PH04', p: 7, trips: TL, desc: 'Feeder miscellaneous supply dari bus B (pasangan 352B-A2)', close: O('352B-A2') });
  dev('352B-B1', { t: 'CB', loc: 'PH04', p: 8, trips: TL, desc: 'Feeder MCC common dari bus B (pasangan 352B-A1)', close: O('352B-A1') });
  dev('352-L2', { t: 'CB', loc: 'PH04', p: 11, trips: TLN, desc: 'Incoming SSTr No.2 → 400 V BUS-B', close: AND(O('352-BT1'), OR(RON('27-2U'), RON('27-L2U')), UNITS_OPEN) });
  // ---- peralatan di luar 4 logic diagram (interlock asumsi standar: DS hanya dioperasikan saat CB terbuka, ES hanya saat DS terbuka & tak bertegangan) ----
  [['BC', 'Base Camp & Curup'], ['ID', 'Intake Dam'], ['RD', 'Reregulating Dam']].forEach(([k, nm]) => {
    dev('289DL-' + k, { t: 'DS', loc: 'MCH20', src: 'asumsi', desc: `DS outdoor line ${nm}`, close: O('252DL-' + k), open: O('252DL-' + k) });
    dev('289DLE-' + k, { t: 'ES', loc: 'MCH20', src: 'asumsi', desc: `Earthing switch line ${nm}`, close: k === 'BC' ? AND(O('289DL-BC'), READY('bcDead')) : O('289DL-' + k) });
  });
  dev('289B-A2', { t: 'DS', loc: 'MCH20', src: 'asumsi', desc: 'DS outgoing cable tunnel feeder no.1', close: O('252B-A2'), open: O('252B-A2') });
  dev('289E-A2', { t: 'ES', loc: 'MCH20', src: 'asumsi', desc: 'Earthing switch cable tunnel feeder no.1', close: AND(O('289B-A2'), RON('27-L1M')) });
  dev('289B-B2', { t: 'DS', loc: 'MCH20', src: 'asumsi', desc: 'DS outgoing cable tunnel feeder no.2', close: O('252B-B2'), open: O('252B-B2') });
  dev('289E-B2', { t: 'ES', loc: 'MCH20', src: 'asumsi', desc: 'Earthing switch cable tunnel feeder no.2', close: AND(O('289B-B2'), RON('27-L2M')) });
  dev('52DG', { t: 'CB', loc: 'MCH04', src: 'asumsi', trips: TLN, desc: 'CB diesel generator', close: READY('dgReady') });

  // posisi awal = layar OPS MAIN CONTROL HOUSE & UNDERGROUND POWERHOUSE (13-Okt-2017)
  const INIT_CLOSED = ['289DLE-BC', '289DL-ID', '252DL-ID', '289DL-RD', '252DL-RD', '289-LSA', '289-LSB', '252-LS', '252B-A2', '289B-A2', '252B-A1',
    '252B-B1', '252B-B2', '289B-B2', '352-S1', '352-S2', '352B-A3', '352B-C1', '352B-B4',
    '289L-1', '252-L1', '289L-2', '252-L2', '352-L1', '352-L2', '352B-A1', '352B-B2', '352-4',
    '89H-1', '89H-2', '89H-3', '352-11', '352-13', '352-14', '352-21', '352-23', '352-24', '352-31', '352-33', '352-34'];

  /* ============================== JARINGAN ==============================
     node: titik listrik; edge: [node1, node2, perangkat|null(trafo/kabel tetap)] */
  const EDGES = [
    ['BCLINE', 'BCX', '289DL-BC'], ['BCX', 'M20A', '252DL-BC'],
    ['M20A', 'M20B', '289B'], ['LSB', 'M20A', '289-LSA'], ['LSB', 'M20B', '289-LSB'], ['LST20', 'LSB', '252-LS'],
    ['M20B', 'IDX', '252DL-ID'], ['IDX', 'IDLINE', '289DL-ID'], ['M20B', 'RDX', '252DL-RD'], ['RDX', 'RDLINE', '289DL-RD'],
    ['M20A', 'A2X', '252B-A2'], ['A2X', 'CAB1', '289B-A2'], ['CAB1', 'PL1', '289L-1'], ['PL1', 'SST1P', '252-L1'], ['SST1P', 'SST1S', null], ['SST1S', 'P4A', '352-L1'],
    ['M20B', 'B2X', '252B-B2'], ['B2X', 'CAB2', '289B-B2'], ['CAB2', 'PL2', '289L-2'], ['PL2', 'SST2P', '252-L2'], ['SST2P', 'SST2S', null], ['SST2S', 'P4B', '352-L2'],
    ['M20A', 'SST3P', '252B-A1'], ['SST3P', 'SST3S', null], ['SST3S', 'M4A', '352-S1'],
    ['M20B', 'SST4P', '252B-B1'], ['SST4P', 'SST4S', null], ['SST4S', 'M4B', '352-S2'],
    ['M4A', 'M4C', '352-BT2'], ['M4C', 'M4B', '352-BT3'], ['M4C', 'DGX', '352B-C1'], ['DGX', 'DG', '52DG'],
    ['M4A', 'LG1', '352B-A3'], ['M4B', 'LG1', '352B-B3'], ['M4A', 'LG2', '352B-A4'], ['M4B', 'LG2', '352B-B4'],
    ['P4A', 'P4B', '352-BT1'], ['P4A', 'CF1', '352B-A1'], ['P4B', 'CF1', '352B-B1'], ['CF1', 'MCCCOM', '352-4'], ['P4A', 'MISC', '352B-A2'], ['P4B', 'MISC', '352B-B2'],
  ];
  [1, 2, 3].forEach((n) => EDGES.push(['G' + n, `UT${n}P`, '89H-' + n], [`UT${n}P`, `UT${n}S`, null], [`UT${n}S`, 'UB' + n, '452-' + n],
    ['UB' + n, 'P4A', `352-${n}1`], ['UB' + n, 'P4B', `352-${n}2`], ['UB' + n, `MCC${n}A`, `352-${n}3`], ['UB' + n, `MCC${n}B`, `352-${n}4`]));
  const ADJ = {};
  EDGES.forEach((e, i) => { for (const [a, b] of [[e[0], e[1]], [e[1], e[0]]]) (ADJ[a] = ADJ[a] || []).push({ to: b, dev: e[2], i }); });
  const NODE_KV = (n) => /^(M4|P4|UB|MCC|LG|CF|MISC|DG|SST\dS|UT\dS)/.test(n) ? 0.4 : (/^G\d$/.test(n) || /^UT\dP$/.test(n)) ? 11 : 20;
  // ES → node yang ditanahkan
  const ES_NODE = { '289DLE-BC': 'BCLINE', '289DLE-ID': 'IDLINE', '289DLE-RD': 'RDLINE', '289E-A2': 'CAB1', '289E-B2': 'CAB2' };
  // relai 27 → node yang diukur
  const REL27 = {
    '27-BC': ['BCX', '20 kV line Base Camp & Curup', 'MCH 20 kV panel 1'], '27-1M': ['M20A', '20 kV BUS-A MCH', 'MCH 20 kV panel 5'], '27-2M': ['M20B', '20 kV BUS-B MCH', 'MCH 20 kV panel 12'],
    '27-L1M': ['CAB1', 'Cable tunnel feeder no.1 (sisi MCH)', 'MCH 20 kV panel 3'], '27-L2M': ['CAB2', 'Cable tunnel feeder no.2 (sisi MCH)', 'MCH 20 kV panel 9'],
    '27-3M': ['M4A', '400 V BUS-A MCH', 'MCH 400 V panel 1'], '27-4M': ['M4B', '400 V BUS-B MCH', 'MCH 400 V panel 9'],
    '27-L1U': ['PL1', 'Incoming 20 kV SSTr No.1 (PH)', 'PH 20 kV panel 2'], '27-L2U': ['PL2', 'Incoming 20 kV SSTr No.2 (PH)', 'PH 20 kV panel 4'],
    '27-1U': ['P4A', '400 V BUS-A powerhouse', 'PH 400 V panel 4'], '27-2U': ['P4B', '400 V BUS-B powerhouse', 'PH 400 V panel 11'],
  };
  // beban (kW) – dikalibrasi dari arus pada layar OPS 13-Okt-2017; MCC unit sebagian bergantung pada pompa bantu unit (1AX)
  const LOADS = {
    LG1: { kw: () => 41, name: 'Beban MCH kelompok 1 (150kV SY CB/DS, air vent cable tunnel, LSTr, AC panel-1, battery charger A)' },
    LG2: { kw: () => 25, name: 'Beban MCH kelompok 2 (dist. panel P1/L1/L2, space heater switchyard, battery charger B)' },
    IDLINE: { kw: (pl) => 6 + (pl.dam ? pl.dam.gateKW('ID') : 0), name: 'Intake dam (RTU, penerangan, motor spillway gate)' },
    RDLINE: { kw: (pl) => 1 + (pl.dam ? pl.dam.gateKW('RD') : 0), name: 'Re-regulating dam (RTU, motor gate)' },
    MCCCOM: { kw: () => 55, name: 'MCC common powerhouse' }, MISC: { kw: () => 94, name: 'Miscellaneous supply powerhouse' },
    MCC1A: { kw: () => 6.5, name: 'MCC1A' }, MCC1B: { kw: (pl) => 26 + (pl.units[0].p.ax ? 54 : 0), name: 'MCC1B (pompa bantu unit 1)' },
    MCC2A: { kw: (pl) => 29 + (pl.units[1].p.ax ? 60 : 0), name: 'MCC2A (pompa bantu unit 2)' }, MCC2B: { kw: () => 3, name: 'MCC2B' },
    MCC3A: { kw: (pl) => 28 + (pl.units[2].p.ax ? 58 : 0), name: 'MCC3A (pompa bantu unit 3)' }, MCC3B: { kw: () => 5.4, name: 'MCC3B' },
  };
  const AUX_MCC = { 1: 'MCC1B', 2: 'MCC2A', 3: 'MCC3A' };   // MCC yang memikul pompa bantu unit

  /* ============================== STATION SERVICE ============================== */
  class StationService {
    constructor(plant) {
      this.plant = plant;
      this.st = {}; Object.keys(DEV).forEach((k) => { this.st[k] = INIT_CLOSED.includes(k); });
      this.rel = {}; this.relT = {}; Object.keys(REL27).forEach((k) => { this.rel[k] = false; this.relT[k] = 0; });
      this.live = {}; this.flow = {}; this.load = {}; this.nodeKW = {};
      this.aco = { mch: 'AUTO', ph: 'AUTO' };     // selektor changeover otomatis (MSSLCU / USSLCU)
      this.seqM = null; this.seqP = null;         // sekuens otomatis MSSLCU (MCH) & USSLCU (powerhouse) – berjalan paralel
      this.mchDone = false; this.phCool = 0; this.ustT = { 1: 77, 2: 85, 3: 77 };
      this.dg = { cmd: false, run: false, t: 0, v: 0, f: 0, ready: false, rdyT: 0, fail: false, kw: 0, hrs: 0 };
      this.fault = {};                            // node gangguan aktif
      this.tripFlag = {};                         // CB yang trip oleh proteksi (flicker sampai FLICKER RESET)
      this.acc = 0; this.uaux = { 1: true, 2: true, 3: true }; this.uauxT = { 1: 0, 2: 0, 3: 0 };
      this.solve(); for (const k of Object.keys(REL27)) this.rel[k] = !this.live[REL27[k][0]];
    }
    log(m, type = 'INFO') { this.plant.log(type, 'SS: ' + m); }
    /* ---- sumber ---- */
    lstLive() {
      const sy = this.plant.sy, s = sy.st; if (!s['152-LST'] || sy.lstFault) return false;
      const lv = sy.busLive();
      const isl = (b) => this.plant.units.some((u) => u.p.cb && u.p.vt > 0.5 && sy.unitBus(u.n) === b && s['152-U' + u.n]);
      return (s['189-LSTA'] && (lv.A || isl('A'))) || (s['189-LSTB'] && (lv.B || isl('B')));
    }
    genLive(n) { const u = this.plant.units[n - 1]; return u.p.vt > 0.5; }
    sources() {
      const src = [];
      if (this.lstLive()) src.push('LST20');
      if (this.bcAvail) src.push('BCLINE');
      [1, 2, 3].forEach((n) => { if (this.genLive(n)) src.push('G' + n); });
      if (this.dg.run && this.dg.v > 300) src.push('DG');
      return src;
    }
    get bcAvail() { return !!this.plant.fx.ss_bc_live && !this.st['289DLE-BC']; }   // line Base Camp & Curup (13-Okt-2017: 27-BC operate, line di-ground)
    conducts(dev) { return dev === null || !!this.st[dev]; }
    /* ---- energisasi (BFS multi-sumber) + aliran daya ---- */
    solve() {
      const live = {}, par = {}, srcOf = {}; const q = [];
      for (const s of this.sources()) { live[s] = true; par[s] = null; srcOf[s] = s; q.push(s); }
      while (q.length) {
        const n = q.shift();
        for (const e of ADJ[n] || []) if (!live[e.to] && this.conducts(e.dev)) { live[e.to] = true; par[e.to] = { n, dev: e.dev }; srcOf[e.to] = srcOf[n]; q.push(e.to); }
      }
      this.live = live; this.par = par; this.srcOf = srcOf;
      // aliran: beban dijumlahkan sepanjang jalur ke sumber
      const flow = {}, nodeKW = {};
      const add = (node, kw) => { let n = node; while (n && par[n]) { const pe = par[n]; if (pe.dev) flow[pe.dev] = (flow[pe.dev] || 0) + kw; nodeKW[pe.n] = (nodeKW[pe.n] || 0) + kw; n = pe.n; } };
      const load = {};
      for (const [node, L] of Object.entries(LOADS)) { const kw = live[node] ? L.kw(this.plant) : 0; load[node] = kw; nodeKW[node] = (nodeKW[node] || 0) + kw; if (kw) add(node, kw); }
      // rugi trafo (3 kW + 4 %) ditambahkan pada sisi primer
      for (const t of ['SST1', 'SST2', 'SST3', 'SST4']) { const k = nodeKW[t + 'S'] || 0; if (k > 0) { const loss = 3 + 0.04 * k; add(t + 'S', loss); } }
      this.flow = flow; this.load = load; this.nodeKW = nodeKW;
    }
    kw(dev) { return this.flow[dev] || 0; }
    amps(dev) { const k = this.kw(dev); const kv = this.devKV(dev); return k / (Math.sqrt(3) * kv * (kv < 1 ? 0.80 : 0.88)); }
    devKV(dev) { const e = EDGES.find((x) => x[2] === dev); return e ? Math.min(NODE_KV(e[0]), NODE_KV(e[1])) : 20; }
    nodeAmps(node) { const kv = NODE_KV(node); return (this.nodeKW[node] || 0) / (Math.sqrt(3) * kv * (kv < 1 ? 0.80 : 0.88)); }
    volt(node) {
      if (!this.live[node]) return 0;
      const kv = NODE_KV(node);
      if (kv === 0.4) {
        if (node === 'DG' || node === 'DGX') return this.dg.v;
        const I = this.nodeAmps(node);
        if (/^(UB|MCC|LG|CF|MISC)/.test(node) && this.par[node] && this.par[node].n !== node) { const up = this.par[node].n; if (NODE_KV(up) === 0.4) return this.volt(up) - 0.012 * I; }
        return 405.5 - 0.0235 * I;
      }
      if (kv === 11) return 10.9;
      return /^(PL|SST\dP|CAB)/.test(node) ? 19.9 : 20.0;
    }
    /* ---- interlock ---- */
    ev(e) {
      if (!e) return true;
      if (e.k === 'and') return e.c.every((c) => this.ev(c));
      if (e.k === 'or') return e.c.some((c) => this.ev(c));
      if (e.k === 'dev') return !!this.st[e.id] === e.v;
      if (e.k === 'rel') return !!this.rel[e.id] === e.v;
      if (e.k === 'flag') return this.flag(e.id);
      return false;
    }
    flag(id) {
      if (id === 'lst152') return !!this.plant.sy.st['152-LST'] && !this.plant.sy.lstFault;
      if (id === 'dgReady') return this.dg.ready;
      if (id === 'bcDead') return !this.bcAvail;
      return false;
    }
    leafText(e) {
      if (e.k === 'dev') return `${e.id} ${e.v ? 'CLOSE' : 'OPEN'}`;
      if (e.k === 'rel') return `${e.id} ${e.v ? 'OPERATE (tegangan hilang)' : 'RESET (bertegangan)'}`;
      return { lst152: '152-LST (switchyard) CLOSE', dgReady: 'DG VOLTAGE ESTABLISHED (84DG)', bcDead: 'line Base Camp tidak bertegangan' }[e.id] || e.id;
    }
    failing(e, out = []) {
      if (!e || this.ev(e)) return out;
      if (e.k === 'and') e.c.forEach((c) => this.failing(c, out));
      else if (e.k === 'or') out.push('salah satu: ' + e.c.map((c) => (c.k === 'and' || c.k === 'or') ? '(' + this.exprText(c) + ')' : this.leafText(c)).join(' / '));
      else out.push(this.leafText(e));
      return out;
    }
    exprText(e) {
      if (!e) return '—';
      if (e.k !== 'and' && e.k !== 'or') return this.leafText(e);
      return e.c.map((c) => (c.k === 'and' || c.k === 'or') ? '(' + this.exprText(c) + ')' : this.leafText(c)).join(e.k === 'and' ? ' DAN ' : ' ATAU ');
    }
    interlock(id, close) {
      const d = DEV[id]; if (!d) return 'perangkat tidak dikenal';
      const cond = close ? d.close : d.open;
      const f = this.failing(cond);
      return f.length ? f.join('; ') : null;
    }
    /* ---- operasi ---- */
    operate(id, close, who = 'OPS') {
      if (!!this.st[id] === close) return null;
      const why = this.interlock(id, close);
      if (why) { this.log(`${id} ${close ? 'CLOSE' : 'OPEN'} ditolak (${who}): ${why}`, 'ALARM'); return why; }
      this.st[id] = close; delete this.tripFlag[id];
      this.log(`${id} ${close ? 'CLOSE' : 'OPEN'}${who !== 'OPS' ? ' (' + who + ')' : ''}`, 'CMD');
      this.solve(); this.checkFaults();
      return null;
    }
    trip(id, why) {
      if (!this.st[id]) return;
      this.st[id] = false; this.tripFlag[id] = why;
      this.log(`${id} TRIP – ${why}`, 'ALARM'); this.solve();
    }
    flickerReset(loc) { for (const k of Object.keys(this.tripFlag)) if (!loc || DEV[k].loc.startsWith(loc)) delete this.tripFlag[k]; }
    /* gangguan: node ditanahkan (ES) atau node gangguan aktif yang bertegangan → CB terdekat pada jalur sumber trip (50/51, 50N/51N) */
    checkFaults() {
      for (let it = 0; it < 6; it++) {
        const bad = [];
        for (const [es, node] of Object.entries(ES_NODE)) if (this.st[es] && this.live[node]) bad.push([node, `earthing switch ${es} CLOSE`]);
        for (const [node, why] of Object.entries(this.fault)) if (this.live[node]) bad.push([node, why]);
        if (!bad.length) return;
        for (const [node, why] of bad) {
          let n = node, tripped = false;
          while (n && this.par[n]) { const pe = this.par[n]; if (pe.dev && DEV[pe.dev] && DEV[pe.dev].t === 'CB') { this.trip(pe.dev, `${DEV[pe.dev].trips.includes('50N/51N') || DEV[pe.dev].trips.includes('51N') ? '50/51 + 51N' : '50/51'} (${why})`); tripped = true; break; } n = pe.n; }
          if (!tripped && this.srcOf[node] && /^G\d$/.test(this.srcOf[node])) { this.trip('89H-' + this.srcOf[node][1], why); }
        }
        this.solve();
      }
    }
    /* ---- daya bantu unit: MCC unit bertegangan ---- */
    unitAux(n) { return this.uaux[n]; }
    /* ---- sekuens otomatis ---- */
    get seq() { return this.seqM || this.seqP; }
    startSeq(site, name, steps) { this[site] = { name, steps, i: 0, t: 0 }; this.log(`CHANGEOVER FUNCTION: ${name} mulai`, 'STEP'); }
    runSeq(site, dt) {
      const s = this[site]; if (!s) return;
      s.t += dt;
      while (s.i < s.steps.length) {
        const st = s.steps[s.i];
        if (st.wait) { const r = st.wait(); if (r === 'fail' || s.t > (st.timeout || 60)) { this.log(`CHANGEOVER ${s.name} GAGAL: ${st.label || 'timeout'}`, 'ALARM'); this[site] = null; return; } if (!r) return; }
        else if (s.t < (st.dt || 0)) return;
        if (st.fn) { const err = st.fn(); if (err) { this.log(`CHANGEOVER ${s.name} berhenti: ${err}`, 'ALARM'); this[site] = null; return; } }
        s.i++; s.t = 0;
      }
      this.log(`CHANGEOVER FUNCTION: ${s.name} selesai`, 'OK'); this[site] = null; if (site === 'seqP') this.phCool = 4;
    }
    // urutan perintah; berhenti bila ada perintah yang ditolak interlock
    cmds(list, who) { for (const [id, c] of list) { if (!!this.st[id] === c) continue; const w = this.operate(id, c, who); if (w) return `${id}: ${w}`; } return null; }
    acoPH() {
      const r1 = this.rel['27-1U'], r2 = this.rel['27-2U'];
      if (this.phCool > 0) { this.phCool -= 0.25; return; }
      if (this.aco.ph !== 'AUTO' || this.seqP || !(r1 || r2)) return;
      if (this.fault.P4A || this.fault.P4B) return;          // gangguan bus: changeover diblok (proteksi bus)
      if (r1 && r2) {
        // USTr selectable: generator bertegangan, beban > 20 % (91P2), 89H CLOSE – prioritas USTr.3 > USTr.2 > USTr.1 (JEZ1L693 SH.007/011)
        const k = [3, 2, 1].find((n) => { const u = this.plant.units[n - 1]; return this.genLive(n) && u.p.cb && u.p.p > 14 && this.st['89H-' + n] && !this.fault['UT' + n + 'P']; });
        if (!k) { if (!this.noUstrLogged) { this.log('27-1U & 27-2U OPERATE – tidak ada USTr yang memenuhi syarat (unit berbeban > 20 %); powerhouse tanpa catu AC', 'ALARM'); this.noUstrLogged = true; } return; }
        this.noUstrLogged = false;
        const opens = [['352-BT1', false], ['352-L1', false], ['352-L2', false]];
        [1, 2, 3].forEach((n) => opens.push(['452-' + n, false], [`352-${n}1`, false], [`352-${n}2`, false]));
        this.startSeq('seqP', `USTr No.${k} → 400 V BUS-A/B powerhouse`, [
          { dt: 0.4, fn: () => this.cmds(opens, 'AUTO') },
          { dt: 1.0, fn: () => this.cmds([['452-' + k, true]], 'AUTO') },
          { dt: 1.0, fn: () => this.cmds([[`352-${k}1`, true], [`352-${k}2`, true]], 'AUTO') },
          { dt: 1.0, fn: () => this.cmds([1, 2, 3].filter((n) => n !== k).map((n) => [`352-${n}1`, true]), 'AUTO') },
        ]);
      } else {
        const dead = r1 ? 'A' : 'B', inc = r1 ? '352-L1' : '352-L2', other = r1 ? '352-L2' : '352-L1';
        if (!this.st[other] && !this.st['452-1'] && !this.st['452-2'] && !this.st['452-3']) return;
        this.startSeq('seqP', `400 V BUS-${dead} → BUS-${dead === 'A' ? 'B' : 'A'} (bus section 352-BT1)`, [
          { dt: 0.4, fn: () => this.cmds([[inc, false]], 'AUTO') },
          { dt: 1.0, fn: () => this.cmds([['352-BT1', true]], 'AUTO') },
        ]);
      }
    }
    acoMCH() {
      if (!(this.rel['27-1M'] && this.rel['27-2M'])) { this.mchDone = false; return; }
      if (this.aco.mch !== 'AUTO' || this.seqM || this.mchDone) return;
      if (this.live.M4A && this.live.M4B) return;
      this.mchDone = true;
      const fdr = ['352B-A3', '352B-A4', '352B-B3', '352B-B4'].filter((k) => this.st[k]);
      this.mchFeeders = fdr.length ? fdr : ['352B-A3', '352B-B4'];
      const cbs = ['252-LS', '252DL-BC', '252DL-ID', '252DL-RD', '252B-A1', '252B-A2', '252B-B1', '252B-B2', '352-S1', '352-S2', '352B-A3', '352B-A4', '352B-B3', '352B-B4'];
      this.startSeq('seqM', 'LSTr → DG (main control house)', [
        { dt: 1.0, fn: () => this.cmds(cbs.map((k) => [k, false]), 'AUTO') },
        { dt: 1.0, fn: () => this.cmds([['289-LSA', false], ['289-LSB', false], ['289B', false]], 'AUTO') },
        { dt: 0.5, fn: () => { this.dgStart('AUTO'); return null; } },
        { wait: () => this.dg.fail ? 'fail' : this.dg.ready, timeout: 40, label: 'DG tidak mencapai VOLTAGE ESTABLISHED (84DG)' },
        { dt: 0.5, fn: () => this.cmds([['52DG', true]], 'AUTO') },
        { dt: 0.5, fn: () => this.cmds([['352B-C1', true]], 'AUTO') },
        { dt: 1.0, fn: () => this.cmds([['352-BT2', true], ['352-BT3', true]], 'AUTO') },
        { dt: 0.5, fn: () => this.cmds(this.mchFeeders.map((k) => [k, true]), 'AUTO') },
      ]);
    }
    /* ---- diesel generator ---- */
    dgStart(who = 'OPS') { if (this.dg.cmd) return; this.dg.cmd = true; this.dg.t = 0; this.log(`DG START (${who})`, 'CMD'); }
    dgStop(who = 'OPS') { if (!this.dg.cmd) return; if (this.st['52DG']) this.operate('52DG', false, who); this.dg.cmd = false; this.log(`DG STOP (${who})`, 'CMD'); }
    dgStep(dt) {
      const g = this.dg, F = this.plant.fx;
      if (g.cmd && !F.ss_dg_fail) {
        g.t += dt;
        if (g.t > 8) { g.run = true; g.f = rate(g.f, 50, 10, dt); g.v = rate(g.v, 400, 80, dt); }
        g.ready = g.run && g.v > 380 && g.f > 49 ? ((g.rdyT += dt) >= 5) : ((g.rdyT = 0), false);
        g.fail = false;
      } else {
        if (g.cmd && F.ss_dg_fail) { g.t += dt; if (g.t > 15 && !g.fail) { g.fail = true; this.log('DG GAGAL START (start failure)', 'ALARM'); } }
        if (!g.cmd) { g.fail = false; g.t = 0; }
        g.run = false; g.ready = false; g.rdyT = 0; g.f = rate(g.f, 0, 8, dt); g.v = rate(g.v, 0, 120, dt);
      }
      if (g.run) g.hrs += dt / 3600;
      g.kw = this.st['52DG'] ? this.kw('52DG') : 0;
      if (!g.run && this.st['52DG']) this.trip('52DG', 'DG berhenti (84DG reset)');
    }
    /* ---- tick (dipanggil tiap 0.05 s, dijalankan tiap 0.25 s) ---- */
    tick(dt) {
      this.acc += dt; if (this.acc < 0.25) return; const h = this.acc; this.acc = 0;
      this.dgStep(h);
      this.solve(); this.checkFaults();
      // relai 27: OPERATE bila tegangan hilang ≥ 2 s (After Timer 2.0 s), reset seketika saat tegangan kembali
      for (const [k, [node]] of Object.entries(REL27)) {
        const dead = !this.live[node];
        this.relT[k] = dead ? this.relT[k] + h : 0;
        const nv = dead ? (this.rel[k] || this.relT[k] >= 2.0) : false;
        if (nv !== this.rel[k]) { this.rel[k] = nv; if (nv) this.log(`${k} OPERATE – ${REL27[k][1]} UNDER VOLTAGE`, 'ALARM'); }
      }
      // daya bantu unit (MCC unit) – hilang > 1 s → pompa bantu berhenti
      [1, 2, 3].forEach((n) => {
        const ok = !!this.live[AUX_MCC[n]];
        this.uauxT[n] = ok ? 0 : this.uauxT[n] + h;
        const nv = ok || this.uauxT[n] < 1;
        if (nv !== this.uaux[n]) { this.uaux[n] = nv; this.log(`U${n}: catu MCC unit ${nv ? 'kembali' : 'HILANG – pompa bantu unit berhenti'}`, nv ? 'OK' : 'ALARM'); }
      });
      this.runSeq('seqM', h); this.runSeq('seqP', h);
      [1, 2, 3].forEach((n) => { const e = this.live['UT' + n + 'S']; const ld = (this.kw('452-' + n) || 0) / 750; this.ustT[n] = lag(this.ustT[n], e ? 62 + 45 * ld + (n === 2 ? 8 : 0) : 36, 900, h); });
      this.acoPH(); this.acoMCH();
    }
    lineupNormal() { Object.keys(DEV).forEach((k) => { this.st[k] = INIT_CLOSED.includes(k); }); this.tripFlag = {}; this.solve(); }
  }

  /* ============================== BENDUNGAN (JEZ2K041 / JEZ2K042) ============================== */
  const volRe = (x) => (x > 150 ? 17.425 * x * x - 5221.875 * x + 391245.75 : 6 * x - 873) * 1000;   // m3
  const dVolRe = (x) => (x > 150 ? 2 * 17.425 * x - 5221.875 : 6) * 1000;
  class Dam {
    constructor(plant) {
      this.plant = plant;
      // intake dam – spillway gate 1..3 (bukaan m)
      this.sg = [0, 0, 0]; this.sgSet = [0, 0, 0]; this.sgMode = 'AUTO'; this.sgLatch = false; this.sgT = 0; this.sgQset = 0;
      this.FSL = 579.1; this.wlHist = []; this.histT = 0; this.qnEst = 14.6;
      // re-regulating dam
      this.rwl = 154.0; this.rg = 0.4; this.rgSet = 0.4; this.sl = [0, 0]; this.rMode = 'AUTO'; this.rQn = 3.0;
      this.Top = 6; this.QA = 0; this.plannedRWL = 155.0; this.RFSL = 157.5; this.flood = false; this.floodT = 0; this.floodHold = 0; this.rT = 0;
      this.qo = 0; this.qr = 0; this.rOut = 0; this.rIn = 0; this.rHist = [];
      // peralatan lain di layar 00022 (posisi saja – kurva debit tidak tersedia)
      this.flap = [0, 0, 0]; this.flapSet = [0, 0, 0]; this.isl = [0, 0]; this.usg = [0, 0]; this.lsg = [0, 0]; this.ig = [1, 1]; this.rake = false;
    }
    powered(site) { const ss = this.plant.ss; return !ss || !!ss.live[site === 'ID' ? 'IDLINE' : 'RDLINE']; }
    gateKW(site) { return site === 'ID' ? (this.sg.some((a, i) => Math.abs(a - this.sgSet[i]) > 0.01) ? 15 : 0) : (Math.abs(this.rg - this.rgSet) > 0.01 ? 7.5 : 0); }
    // debit spillway (SH.001): h = WL − 572.5 ; bebas Q = 19.00 h^1.5 ; gated Q = 20.81 h^0.6 a^0.9
    qSpill(a, wl = this.plant.intakeWL) { const h = Math.max(0, wl - 572.5); if (a <= 0.005 || h <= 0) return 0; return Math.min(19.0 * Math.pow(h, 1.5), 20.81 * Math.pow(h, 0.6) * Math.pow(a, 0.9)); }
    // debit regulating gate (JEZ2K042 SH.001): h = RWL − 147.0 ; f1 = 12.16 h^1.5 ; f2 = 12.48 h^0.6 a^0.9
    qReg(a, rwl = this.rwl) { const h = Math.max(0, rwl - 147.0); if (a <= 0.005 || h <= 0) return 0; return Math.min(12.16 * Math.pow(h, 1.5), 12.48 * Math.pow(h, 0.6) * Math.pow(a, 0.9)); }
    qTurb() { return this.plant.units.reduce((a, u) => a + u.meas().flow, 0); }
    tick(dt) {
      const pl = this.plant;
      // ---------------- intake dam ----------------
      const pw = this.powered('ID');
      for (let i = 0; i < 3; i++) if (pw) { this.sg[i] = rate(this.sg[i], this.sgSet[i], 0.3 / 60, dt); this.flap[i] = rate(this.flap[i], this.flapSet[i], 10 / 60, dt); }   // gate 0.3 m/menit, flap 10 %/menit (asumsi)
      pl.spillQ = this.sg.reduce((a, x) => a + this.qSpill(x), 0);
      this.histT += dt;
      if (this.histT >= 300) {     // nilai 5 menit (SH.003)
        this.histT = 0; this.wlHist.push(pl.intakeWL); if (this.wlHist.length > 3) this.wlHist.shift();
        const n = this.wlHist.length;
        if (n >= 2) { const dv = volIntakeLocal(this.wlHist[n - 1]) - volIntakeLocal(this.wlHist[n - 2]); this.qnEst = dv / 300 + this.qTurb() + pl.spillQ; }
        this.rHist.push(this.rwl); if (this.rHist.length > 96) this.rHist.shift();
      }
      // kontrol spillway (SH.002/004): latch saat WL > FSL; set debit tiap 300 s
      if (pl.intakeWL > this.FSL + 0.005) this.sgLatch = true;
      if (this.sgMode === 'AUTO' && this.sgLatch) {
        this.sgT += dt;
        if (this.sgT >= 300 || this.sgQset === 0 && pl.intakeWL > this.FSL + 0.02 && this.sgT >= 30) {
          this.sgT = 0;
          const est = this.qnEst;                                          // inflow alami terhitung
          const area = (2 * 189.475 * pl.intakeWL - 218232.925) * 1000;                    // luas muka air dari kurva f7 (m2)
          const q = Math.max(0, est - this.qTurb() + (pl.intakeWL - this.FSL) * area / 3600);   // pertahankan WL di FSL
          this.sgQset = q; this.setSpill(q);
          if (q <= 0.5 && pl.intakeWL < this.FSL - 0.02) { this.sgLatch = false; this.sgSet = [0, 0, 0]; pl.log('INFO', 'DAM: SPILLWAY GATE CONTROL selesai – semua gate menutup'); }
        }
      }
      // ---------------- re-regulating dam ----------------
      const qT = this.qTurb();
      this.qr = (61.0 * this.Top + this.QA * (24 - this.Top)) / 24;          // SH.002: Qr = (QTT·Top + QA·(Tn−Top))/Tn
      if (this.rwl > this.plannedRWL + 0.05) this.floodT += dt; else this.floodT = 0;
      if (!this.flood && this.floodT >= 300) { this.flood = true; this.floodHold = 3600; pl.log('ALARM', 'DAM: RE-REG DAM FLOOD OPERATION (RWL > planned + 0.05 m selama 5 menit)'); }
      if (this.flood) { this.floodHold -= dt; if (this.floodHold <= 0 && this.rwl < this.plannedRWL) { this.flood = false; pl.log('INFO', 'DAM: flood operation selesai'); } }
      this.rIn = qT + this.rQn;
      this.qo = this.flood ? this.rIn + (this.rwl - this.plannedRWL) * 30 : Math.min(this.qr + this.rQn, 41);
      this.rT += dt;
      if (this.rMode === 'AUTO' && this.rT >= 60) {      // instruksi bukaan regulating gate, dibulatkan ke atas 0.5 m (SH.003)
        this.rT = 0;
        const h = Math.max(0.3, this.rwl - 147.0);
        let a = Math.pow(Math.max(0, this.qo) / (12.48 * Math.pow(h, 0.6)), 1 / 0.9);
        a = Math.min(Math.ceil(a / 0.05) * 0.05, h);
        this.rgSet = clamp(a, 0, 8);
      }
      if (this.powered('RD')) {
        this.rg = rate(this.rg, this.rgSet, 0.3 / 60, dt);
        // sluice gate saat RWL > FSL 157.5 m (SH.007-008): ambang 20 / 25 cm
        const ex = this.rwl - this.RFSL;
        this.sl[0] = rate(this.sl[0], ex > 0.20 ? Math.min(3, this.sl[0] + 0.2) : ex < 0.05 ? 0 : this.sl[0], 0.3 / 60, dt);
        this.sl[1] = rate(this.sl[1], ex > 0.25 ? Math.min(3, this.sl[1] + 0.2) : ex < 0.05 ? 0 : this.sl[1], 0.3 / 60, dt);
      }
      const overflow = this.rwl > this.RFSL + 0.6 ? 12.16 * Math.pow(this.rwl - this.RFSL - 0.6, 1.5) * 4 : 0;
      this.rOut = this.qReg(this.rg) + this.qReg(this.sl[0]) + this.qReg(this.sl[1]) + overflow;
      const V = volRe(this.rwl) + (this.rIn - this.rOut) * dt;
      let x = this.rwl; for (let k = 0; k < 2; k++) x -= (volRe(x) - V) / dVolRe(x);
      this.rwl = clamp(x, 148.0, 159.5);
    }
    setSpill(q) {
      // buka gate-2 dulu, lalu gate-3, lalu gate-1 (SH.004); ambang 20 cm, tutup bila set < 0.2 m
      const order = [1, 2, 0], set = [0, 0, 0]; let rem = q;
      const h = Math.max(0.3, this.plant.intakeWL - 572.5), aMax = 6.0;
      const qMax = 20.81 * Math.pow(h, 0.6) * Math.pow(aMax, 0.9);
      for (const i of order) { if (rem <= 0) break; const qi = Math.min(rem, qMax); let a = Math.pow(qi / (20.81 * Math.pow(h, 0.6)), 10 / 9); if (a < 0.2) a = 0; set[i] = Math.round(a * 100) / 100; rem -= qi; }
      this.sgSet = set;
    }
  }
  const volIntakeLocal = (x) => (189.475 * x * x - 218232.925 * x + 62839304.175) * 1000;

  /* ============================== REKAP OPERASI HARIAN ============================== */
  class DailyOps {
    constructor(plant) { this.plant = plant; this.u = [1, 2, 3].map(() => ({ mwh: 0, mvarh: 0, hrs: 0, starts: 0, trips: 0, maxP: 0, wasCB: false, lo: false })); this.ssKWh = 0; this.spillM3 = 0; this.turbM3 = 0; this.wlMin = 999; this.wlMax = 0; this.t = 0; }
    tick(dt) {
      const pl = this.plant; this.t += dt;
      pl.units.forEach((u, i) => {
        const r = this.u[i];
        if (u.p.cb) { r.mwh += u.p.p * dt / 3600; r.mvarh += u.p.q * dt / 3600; r.hrs += dt / 3600; r.maxP = Math.max(r.maxP, u.p.p); }
        if (u.p.cb && !r.wasCB) r.starts++;
        const lo = Object.values(u.lo).some(Boolean); if (lo && !r.lo) r.trips++; r.lo = lo; r.wasCB = u.p.cb;
      });
      this.spillM3 += (pl.spillQ || 0) * dt;
      this.turbM3 += pl.units.reduce((a, u) => a + u.meas().flow, 0) * dt;
      if (pl.ss) this.ssKWh += ((pl.ss.kw('252-LS') || 0) + (pl.ss.kw('52DG') || 0) + [1, 2, 3].reduce((a, n) => a + (pl.ss.kw('452-' + n) || 0), 0)) * dt / 3600;
      this.wlMin = Math.min(this.wlMin, pl.intakeWL); this.wlMax = Math.max(this.wlMax, pl.intakeWL);
    }
  }

  /* ============================== SKENARIO GANGGUAN STATION SERVICE & BENDUNGAN ============================== */
  const NEW_SCN = [
    { key: 'ss_lst_trip', grp: 'STATION SERVICE', name: 'LSTr trip (152-LST) – station service MCH & powerhouse hilang', unit: false,
      cause: 'Gangguan internal trafo LSTr; 152-LST trip dan terkunci.',
      chain: 'Bus LS & 20 kV MCH bus A/B mati → 27-1M & 27-2M (2 s) → CHANGEOVER LSTr → DG: semua CB MCH dibuka, 289-LSA/B dibuka, DG start, 84DG → 52DG, 352B-C1, 352-BT2/BT3, feeder 400 V MCH. Powerhouse: kabel feeder mati → 27-1U & 27-2U → CHANGEOVER ke USTr No.3 (prioritas 3 > 2 > 1): 352-L1/L2 & breaker unit dibuka, 452-3 → 352-31/32 → 352-11, 352-21.',
      prot: 'Changeover otomatis (MSSLCU & USSLCU)', src: 'data JEZ1L693 SH.011–032, SH.073–083', act: 'Pantau changeover di MAIN CONTROL HOUSE & UNDERGROUND POWERHOUSE; setelah CLEAR: kembalikan konfigurasi normal (MCH CB OPEN → 289-LSA/B → 252-LS → feeder; POWER SUPPLY TO POWERHOUSE).' },
    { key: 'ss_dg_fail', grp: 'STATION SERVICE', name: 'Diesel generator gagal start', unit: false,
      cause: 'Baterai starter lemah / bahan bakar tidak mengalir.',
      chain: 'Saat ada perintah start (manual atau CHANGEOVER LSTr → DG), DG tidak mencapai 84DG → sekuens changeover gagal (timeout 40 s) → 400 V MCH tetap mati.', prot: 'Alarm DIESEL GENERATOR', src: 'data JEZ1L693 SH.077, SH.109 · waktu asumsi', act: 'Coba start ulang setelah CLEAR, atau pulihkan sumber 20 kV.' },
    { key: 'ss_cable1', grp: 'STATION SERVICE', name: 'Gangguan kabel cable tunnel feeder no.1', unit: false,
      cause: 'Kerusakan isolasi kabel 20 kV di cable tunnel.',
      chain: 'Arus gangguan → 252B-A2 trip (50/51, 50N/51N) → SSTr No.1 & 400 V BUS-A powerhouse mati → 27-1U (2 s) → CHANGEOVER BUS-A → BUS-B: 352-L1 OPEN, 352-BT1 CLOSE.', prot: '50/51, 50N/51N 252B-A2', src: 'data JEZ2K031 SH.005 / JEZ1L693 SH.022–029', act: 'Isolasi kabel: 289B-A2 & 289L-1 OPEN, 289E-A2 CLOSE (setelah 27-L1M operate).' },
    { key: 'ss_sstr1', grp: 'STATION SERVICE', name: 'Gangguan SSTr No.1 (powerhouse)', unit: false,
      cause: 'Gangguan internal trafo SSTr No.1.', chain: '252-L1 trip (50/51) → 400 V BUS-A mati → 27-1U → CHANGEOVER BUS-A → BUS-B (352-L1 OPEN, 352-BT1 CLOSE).', prot: '50/51 252-L1', src: 'data JEZ2K031 SH.006', act: 'Biarkan BUS-A dicatu lewat 352-BT1; periksa SSTr No.1.' },
    { key: 'ss_ph_busa', grp: 'STATION SERVICE', name: 'Gangguan 400 V BUS-A powerhouse', unit: false,
      cause: 'Hubung singkat di busbar 400 V BUS-A.', chain: '352-L1 (dan 352-11/21/31 bila mencatu balik) trip 50/51 → BUS-A mati; changeover DIBLOK (gangguan bus) → MCC unit yang tercatu dari BUS-A ikut mati → pompa bantu unit berhenti → proteksi unit (aliran air pendingin / tekanan oli) bekerja bila tidak dipulihkan.',
      prot: '50/51 352-L1, changeover diblok', src: 'data JEZ2K031 SH.006 · perilaku blok asumsi', act: 'Pindahkan MCC unit ke BUS-B: 352-x1 OPEN, 352-x2 CLOSE (syarat: 452-x OPEN & 352-x1 OPEN).' },
    { key: 'ss_bc_live', grp: 'STATION SERVICE', name: 'Line 20 kV Base Camp & Curup bertegangan (sumber alternatif)', unit: false,
      cause: 'GI Curup menormalkan saluran distribusi 20 kV.', chain: '27-BC reset. Line dapat dipakai sebagai sumber 20 kV MCH: 289DLE-BC OPEN → 289DL-BC CLOSE → 252DL-BC CLOSE (syarat: 27-1M operate, 252-LS & 289-LSA/B OPEN).',
      prot: '—', src: 'data P0039-001 (logic 252DL-BC)', act: 'Latihan manuver sumber alternatif saat LSTr hilang.' },
    { key: 'dam_flood', grp: 'BENDUNGAN', name: 'Banjir – inflow intake naik ke 180 m³/s', unit: false,
      cause: 'Hujan lebat di DAS Musi hulu.', chain: 'Intake WL naik → > FSL El. 579.10 m → SPILLWAY GATE CONTROL: debit set tiap 300 s = inflow terhitung − debit turbin; gate-2 dibuka dulu, lalu gate-3, gate-1 (ambang 20 cm). Gate hanya bergerak bila feeder 252DL-ID bertegangan.',
      prot: '—', src: 'data JEZ2K041 SH.001–004 · laju gerak gate asumsi', act: 'Pantau Intake & Reregulating Dam; pastikan feeder Intake Dam bertegangan.' },
  ];
  NEW_SCN.forEach((s) => { M.SCENARIOS.push(s); M.SCN[s.key] = s; });

  /* ============================== ANNUNCIATOR ==============================
     USS: JEZ1L693 SH.064 ; MSS: JEZ1L693 SH.110 */
  NEW_SCN.push({ key: 'air_comp_fail', grp: 'STATION SERVICE', name: 'Air compressor 1 unit No.1 gagal + kebocoran primary air tank #1', unit: false,
    cause: 'Motor kompresor trip dan ada kebocoran pada pipa udara primary air tank #1.',
    chain: 'Tekanan primary air tank #1 turun → 63AQH1 OFF (alarm PRIMARY AIR TANK PRESSURE LOW) → suplai udara ke governor pressure tank dan, lewat reducing valve, ke brake air tank berkurang → bila berlanjut 63AQL (BRAKE AIR TANK PRESSURE LOW).',
    prot: 'Alarm 63AQH1 / 63AQL', src: 'layar AIR SUPPLY SYSTEM 00010 · laju tekanan ASUMSI', act: 'Pantau tekanan di AIR SUPPLY SYSTEM; buka valve interkoneksi (cross-tie) dari unit lain bila tersedia, perbaiki kompresor; hindari start/stop unit No.1 (pemakaian udara rem).' });
  M.SCENARIOS.push(NEW_SCN[NEW_SCN.length - 1]); M.SCN.air_comp_fail = NEW_SCN[NEW_SCN.length - 1];
  const USS_WIN = {
    A: ['UNDERGROUND\nS/S CONTROL\nCPU\nHEAVY ERROR', '', '', '', '', '', '', ''],
    B: ['SSTR. NO.1', 'SSTR. NO.2', 'USTR. NO.1', 'USTR. NO.2', 'USTR. NO.3', 'LOCAL\nCONTROL\nUNIT', 'AIR SUPPLY\nSYSTEM', 'WATER CHILLER'],
    C: ['DRAINAGE\nPUMP', 'JET PUMP', 'LUBRICATING\nOIL PUMP', 'DRAINAGE\nWATER LEVEL', 'DC SYSTEM', 'AC SYSTEM', 'BATTERY', ''],
    D: ['', '', '', '', '', '', '', ''], E: ['', '', '', '', '', '', '', ''], F: ['', '', '', '', '', '', '', ''],
  };
  const MSS_WIN = {
    A: ['MAIN CONTROL\nROOM\nS/S CONTROL\nCPU\nHEAVY ERROR', '', '', '', '', '', '', ''],
    B: ['CABLE TUNNEL\nFEEDER NO.1', 'CABLE TUNNEL\nFEEDER NO.2', 'SSTR. NO.3', 'SSTR. NO.4', 'DIESEL\nGENERATOR', 'LOCAL\nCONTROL\nUNIT', '', ''],
    C: ['252DL-BC\nFEEDER', '252DL\nFEEDER', '252DL-ID\nFEEDER', '252-LS\nFEEDER', 'DC SYSTEM', 'AC SYSTEM', 'BATTERY', ''],
    D: ['', '', '', '', '', '', '', ''], E: ['', '', '', '', '', '', '', ''], F: ['', '', '', '', '', '', '', ''],
  };
  const trp = (pl, id) => !!(pl.ss && pl.ss.tripFlag[id]);
  const rl = (pl, id) => !!(pl.ss && pl.ss.rel[id]);
  function points(pl) {
    const P = [];
    const add = (grp, win, tag, text, lvl, cond, delay = 0) => P.push({ grp, win, tag, text, lvl, cond: () => cond(pl), delay });
    // ---- USS (powerhouse) ----
    add('USS', 'B1', '4DI0038', 'SSTR. NO.1 252-L1 OVER CURRENT TRIP', 'H', (p) => trp(p, '252-L1'));
    add('USS', 'B1', '4DI0057', 'SSTR. NO.1 352-L1 TRIP', 'H', (p) => trp(p, '352-L1'));
    add('USS', 'B1', '27-L1U', 'SSTR. NO.1 20kV INCOMING UNDER VOLTAGE (27-L1U)', 'L', (p) => rl(p, '27-L1U'));
    add('USS', 'B2', '4DI0046', 'SSTR. NO.2 252-L2 OVER CURRENT TRIP', 'H', (p) => trp(p, '252-L2'));
    add('USS', 'B2', '4DI0071', 'SSTR. NO.2 352-L2 TRIP', 'H', (p) => trp(p, '352-L2'));
    add('USS', 'B2', '27-L2U', 'SSTR. NO.2 20kV INCOMING UNDER VOLTAGE (27-L2U)', 'L', (p) => rl(p, '27-L2U'));
    [1, 2, 3].forEach((n, i) => add('USS', 'B' + (3 + i), `4DI0${92 + 16 * i}`, `USTR. NO.${n} 452-${n} TRIP / USTR FAULT`, 'H', (p) => trp(p, '452-' + n) || trp(p, '89H-' + n)));
    [1, 2, 3].forEach((n, i) => add('USS', 'B' + (3 + i), `UST${n}`, `USTR. NO.${n} WINDING TEMPERATURE HIGH`, 'L', (p) => p.ss && p.ss.ustT && p.ss.ustT[n] > 110));
    add('USS', 'B6', 'USSLCU', 'CHANGEOVER FUNCTION OPERATED (USSLCU)', 'L', (p) => p.ss && !!p.ss.seqP);
    add('USS', 'C6', '27-1U', '400V BUS-A UNDER VOLTAGE (27-1U)', 'H', (p) => rl(p, '27-1U'));
    add('USS', 'C6', '27-2U', '400V BUS-B UNDER VOLTAGE (27-2U)', 'H', (p) => rl(p, '27-2U'));
    [1, 2, 3].forEach((n) => add('USS', 'C6', `MCC${n}`, `UNIT NO.${n} MCC POWER SUPPLY LOST`, 'H', (p) => p.ss && !p.ss.uaux[n]));
    add('USS', 'C6', 'P4F', '400V BUS FAULT (50/51)', 'H', (p) => p.ss && (p.ss.fault.P4A || p.ss.fault.P4B));
    [1, 2, 3].forEach((n) => {
      add('USS', 'B7', `63AQH1-${n}`, `PRIMARY AIR TANK #${n} PRESSURE LOW (63AQH1)`, 'L', (p) => p.air && !p.air.sw(p.air.u[n - 1].prim).H1, 30);
      add('USS', 'B7', `63AQL-${n}`, `BRAKE AIR TANK #${n} PRESSURE LOW (63AQL)`, 'H', (p) => p.air && p.air.sw(p.air.u[n - 1].brake).L, 5);
      add('USS', 'B7', `63AQI-${n}`, `INLET VALVE AIR TANK #${n} PRESSURE LOW (63AQH1)`, 'L', (p) => p.air && !p.air.sw(p.air.u[n - 1].iv).H1, 30);
      add('USS', 'B7', `AC1-${n}`, `AIR COMPRESSOR 1 UNIT NO.${n} FAULT`, 'H', (p) => p.air && p.air.u[n - 1].c1.fail);
    });
    // ---- MSS (main control house) ----
    add('MSS', 'B1', '5DI0044', '20KV 252B-A2 (CABLE FEEDER NO.1) OVER CURRENT', 'H', (p) => trp(p, '252B-A2'));
    add('MSS', 'B1', '27-L1M', 'CABLE TUNNEL FEEDER NO.1 UNDER VOLTAGE (27-L1M)', 'L', (p) => rl(p, '27-L1M') && p.ss.st['252B-A2']);
    add('MSS', 'B2', '5DI0063', '20KV 252B-B2 (CABLE FEEDER NO.2) OVER CURRENT', 'H', (p) => trp(p, '252B-B2'));
    add('MSS', 'B2', '27-L2M', 'CABLE TUNNEL FEEDER NO.2 UNDER VOLTAGE (27-L2M)', 'L', (p) => rl(p, '27-L2M') && p.ss.st['252B-B2']);
    add('MSS', 'B3', '5DI0049', '20KV 252B-A1 (SSTR.3) OVER CURRENT', 'H', (p) => trp(p, '252B-A1') || trp(p, '352-S1'));
    add('MSS', 'B4', '5DI0058', '20KV 252B-B1 (SSTR.4) OVER CURRENT', 'H', (p) => trp(p, '252B-B1') || trp(p, '352-S2'));
    add('MSS', 'B5', '5DI0135', 'DIESEL GENERATOR STARTED', 'L', (p) => p.ss && p.ss.dg.run);
    add('MSS', 'B5', '5DI0137', 'DIESEL GENERATOR START FAILURE', 'H', (p) => p.ss && p.ss.dg.fail);
    add('MSS', 'B6', 'MSSLCU', 'CHANGEOVER FUNCTION LSTr → DG OPERATED (MSSLCU)', 'L', (p) => p.ss && !!p.ss.seqM);
    add('MSS', 'C1', '5DI0036', '20KV 252DL-BC OVER CURRENT RELAY', 'H', (p) => trp(p, '252DL-BC'));
    add('MSS', 'C2', '5DI0074', '20KV 252DL-RD OVER CURRENT RELAY', 'H', (p) => trp(p, '252DL-RD'));
    add('MSS', 'C3', '5DI0068', '20KV 252DL-ID OVER CURRENT RELAY', 'H', (p) => trp(p, '252DL-ID'));
    add('MSS', 'C4', '5DI0081', '20KV 252-LS OVER CURRENT RELAY', 'H', (p) => trp(p, '252-LS'));
    add('MSS', 'C4', 'LSTR', 'LSTr / 152-LST TRIP – 20kV INCOMING LS LOST', 'H', (p) => !!p.sy.lstFault);
    add('MSS', 'C6', '27-1M', '20kV BUS-A UNDER VOLTAGE (27-1M)', 'H', (p) => rl(p, '27-1M'));
    add('MSS', 'C6', '27-2M', '20kV BUS-B UNDER VOLTAGE (27-2M)', 'H', (p) => rl(p, '27-2M'));
    add('MSS', 'C6', '27-3M', '400V BUS-A UNDER VOLTAGE (27-3M)', 'H', (p) => rl(p, '27-3M'));
    add('MSS', 'C6', '27-4M', '400V BUS-B UNDER VOLTAGE (27-4M)', 'H', (p) => rl(p, '27-4M'));
    // ---- bendungan (switchyard/mimic: tampil di annunciator MSS kolom 8) ----
    add('MSS', 'C8', 'IWL-H', 'INTAKE WATER LEVEL HIGH (> FSL 579.10 m)', 'L', (p) => p.intakeWL > 579.1, 10);
    add('MSS', 'C8', 'IWL-L', 'INTAKE WATER LEVEL LOW (< 577.80 m)', 'L', (p) => p.intakeWL < 577.8, 10);
    add('MSS', 'C8', 'RWL-H', 'RE-REG DAM WATER LEVEL HIGH (> FSL 157.50 m)', 'L', (p) => p.dam && p.dam.rwl > 157.5, 10);
    return P;
  }
  M.ANN_WIN = Object.assign(M.ANN_WIN || {}, { USS: USS_WIN, MSS: MSS_WIN });
  MSS_WIN.C[7] = 'DAM WATER\nLEVEL';

  /* ============================== PLANT CONTROL: JOINT CONTROL · 43SCH/WLC · JADWAL · WLC ============================== */
  // jadwal harian (MW total plant per 15 menit) dari layar OPS 00031/00032/00034 (13-Okt-2017)
  const q4 = (m0, m15, m30, m45) => { const a = []; for (let h = 0; h < 24; h++) a.push(m0[h], m15[h], m30[h], m45[h]); return a; };
  const S1 = q4([50, 50, 45, 45, 45, 50, 55, 50, 50, 70, 210, 30, 30, 200, 20, 10, 70, 70, 100, 125, 175, 200, 175, 10],
    [50, 50, 45, 45, 45, 50, 55, 50, 50, 210, 50, 30, 30, 50, 20, 10, 70, 70, 100, 150, 175, 200, 175, 10],
    [50, 50, 45, 45, 45, 50, 55, 50, 50, 210, 50, 30, 30, 50, 20, 10, 70, 70, 100, 150, 175, 200, 175, 10],
    [50, 50, 45, 45, 45, 50, 55, 50, 50, 210, 50, 30, 30, 50, 20, 10, 70, 70, 100, 150, 70, 200, 175, 0]);
  const S1in = S1.map((v, i) => (Math.floor(i / 4) === 18 ? 210 : v));
  const S2 = q4([45, 25, 25, 25, 25, 25, 50, 45, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 70, 150, 210, 210, 210, 45],
    [45, 25, 25, 25, 25, 45, 50, 45, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 90, 185, 210, 210, 180, 45],
    [25, 25, 25, 25, 25, 50, 45, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 45, 105, 195, 210, 210, 165, 45],
    [25, 25, 25, 25, 25, 50, 45, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 70, 150, 200, 210, 210, 150, 45]);
  const S4in = Array.from({ length: 96 }, (_, i) => { const h = Math.floor(i / 4); return h >= 15 && h <= 21 ? 105 : 30; });
  const SCH_DEF = [
    { key: 'SCH-1', name: 'RAINY/WEEKDAY', no: '00031', set: S1, inp: S1in, src: 'layar OPS 00031' },
    { key: 'SCH-2', name: 'RAINY/WEEKEND', no: '00032', set: S2, inp: S2.slice(), src: 'layar OPS 00032' },
    { key: 'SCH-3', name: 'DRY/WEEKDAY', no: '00033', set: S4in.slice(), inp: S4in.slice(), src: 'ASUMSI – layar 00033 belum ada, disalin dari pola DRY/WEEKEND' },
    { key: 'SCH-4', name: 'DRY/WEEKEND', no: '00034', set: new Array(96).fill(0), inp: S4in, src: 'layar OPS 00034 (SET VALUE 0, INPUT VALUE belum di-SET)' },
    { key: 'SCH-5', name: 'ARBITRARY SETUP', no: '00035', set: new Array(96).fill(70), inp: new Array(96).fill(70), src: 'ASUMSI – bebas diisi instruktur' },
  ];
  const ip = (pts, x) => { if (x <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return pts[pts.length - 1][1]; };
  // kurva WLC (bentuk mengikuti layar 00036; nilai = ASUMSI)
  const WLC_F1 = [[-1.5, -45], [-0.5, -12], [0, 0], [0.5, 12], [1.5, 45]];          // e (m) → MW per siklus
  const WLC_F2 = [[575.0, 2.0], [576.5, 1.4], [577.5, 1.0], [581.0, 1.0]];           // WL → faktor
  const QPMW = 21.1 / 70;                                                             // m3/s per MW (unit 70 MW ≈ 21.1 m3/s)
  const MOL = 578.2, FSL = 579.1;                                                     // MOL dibaca dari grafik layar 00096
  class PlantCtrl {
    constructor(pl) {
      this.plant = pl;
      const d = new Date(); this.clock0 = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); this.date0 = d.getTime() - this.clock0 * 1000;
      // selector panel SY/SS (layar 00027)
      this.sel = { s343STEP: 'REMOTE', s443STEP: 'REMOTE', s343R: 'REMOTE', s443R: 'REMOTE', s343ASR: 'USE', car1: 'LOCK', car2: 'USE' };
      this.mode = null;                       // 43SCH/WLC: null | 'SCH-1'..'SCH-5' | 'WLC'
      this.jP = 140; this.jQ = 30; this.jPman = 140;
      this.sch = SCH_DEF.map((s) => ({ key: s.key, name: s.name, no: s.no, src: s.src, set: s.set.slice(), inp: s.inp.slice() }));
      this.wlc = { sp: 578.60, comp: 0, t: 0, ePrev: null, Kp: 60, hist: [], cyc: 900 };
      this.hist = []; this.histT = 300;
      this.dpo = { inflow: 14.6, bias: 0, P: 150, start: 16, next: 12, res: null };
    }
    syBlock() { const sl = this.plant.sy.sel; return sl.s143STEP === 'LOCAL' ? '143STEP = LOCAL (operasi dari panel lokal switchyard)' : sl.s143R === 'CENTRAL' ? '143R = CENTRAL (kontrol dari pusat)' : null; }
    ssBlock(id) {
      const d = DEV[id]; if (!d) return null; const mch = /^MCH/.test(d.loc), k = mch ? '343' : '443';
      if (this.sel[`s${k}STEP`] === 'LOCAL') return `${k}STEP = LOCAL (operasi dari panel lokal ${mch ? 'main control house' : 'powerhouse'})`;
      if (this.sel[`s${k}R`] === 'CENTRAL') return `${k}R = CENTRAL (kontrol dari pusat)`;
      return null;
    }
    tod() { return (this.clock0 + this.plant.t) % 86400; }
    // suhu lingkungan/peralatan simulasi (nilai '?' di OPS): pola harian (puncak ±14:00) + pengaruh beban
    amb(k) {
      const h = this.tod() / 3600, d = Math.sin((h - 8) / 24 * 2 * Math.PI), pl = this.plant, U = (n) => pl.units[n - 1];
      const lst = pl.ss ? pl.ss.kw('252-LS') : 500;
      switch (k) {
        case 'out': return 28.5 + 4.5 * d;
        case 'mch': return 25.5 + 1.2 * d;
        case 'uph': return 33.0 + 0.6 * d + 0.012 * this.totals().p;
        case 'mtr1': case 'mtr2': case 'mtr3': { const u = U(+k.slice(3)); return 31.5 + 1.5 * d + 0.08 * Math.max(0, u.p.p); }
        case 'lstOil': return 29.0 + 3.0 * d + lst / 60;
        case 'lstWdg': return 29.5 + 3.0 * d + lst / 55;
        default: return 30;
      }
    }
    nowMs() { return this.date0 + (this.clock0 + this.plant.t) * 1000; }
    setClock(h, m) { this.clock0 = ((h * 3600 + m * 60 - this.plant.t) % 86400 + 86400) % 86400; }
    idx(tod = this.tod()) { return Math.floor(tod / 900) % 96; }
    alrMode(u) { return !u.sw.ALR ? 'MANUAL' : u.sw.JLR ? 'JOINT' : 'INDIVIDUAL'; }
    aqrMode(u) { return !u.sw.AQR ? 'MANUAL' : u.sw.JQR ? 'JOINT' : u.sw.AQRC === 'AUTO' ? 'AUTO' : 'SEMI AUTO'; }
    setAlr(u, m) { u.sw.ALR = m !== 'MANUAL'; u.sw.JLR = m === 'JOINT'; if (m === 'INDIVIDUAL') u.sw.alrSP = clamp(u.p.cb ? u.p.p : u.sw.alrSP, u.sw.minP, u.sw.maxP); if (m === 'MANUAL') u.p.pref = u.p.p; }
    setAqr(u, m) { u.sw.AQR = m !== 'MANUAL'; u.sw.JQR = m === 'JOINT'; if (m === 'AUTO') u.sw.AQRC = 'AUTO'; if (m === 'SEMI AUTO') u.sw.AQRC = 'SEMI'; if (m === 'SEMI AUTO' || m === 'INDIVIDUAL') u.sw.aqrSP = u.p.q; if (m === 'MANUAL') u.p.qref = u.p.q; }
    online(u) { return u.p.cb && !u.p.islanded && u.pos === 5; }
    totals() { const us = this.plant.units.filter((u) => u.p.cb); return { p: us.reduce((a, u) => a + u.p.p, 0), q: us.reduce((a, u) => a + u.p.q, 0) }; }
    jointP() { return this.plant.units.filter((u) => this.online(u) && u.sw.ALR && u.sw.JLR).reduce((a, u) => a + u.p.p, 0); }
    jointQ() { return this.plant.units.filter((u) => this.online(u) && u.sw.AQR && u.sw.JQR).reduce((a, u) => a + u.p.q, 0); }
    setMode(m) {
      const pl = this.plant; if (this.mode === m) return;
      this.mode = m; if (m === 'WLC') { this.wlc.t = 0; this.wlc.ePrev = pl.intakeWL - this.wlc.sp; this.wlc.comp = 0; }
      if (!m) this.jPman = this.jP;
      pl.log('CMD', `PLANT: 43SCH/WLC = ${m || 'OFF (set point manual)'}`);
    }
    schSet(k) { const s = this.sch[k]; s.set = s.inp.slice(); this.plant.log('CMD', `PLANT: SCHEDULE ${s.key} (${s.name}) SET – nilai input diterapkan`); }
    schCancel(k) { const s = this.sch[k]; s.inp = s.set.slice(); }
    wlcStep() {
      const pl = this.plant, w = this.wlc, e = pl.intakeWL - w.sp, de = w.ePrev === null ? 0 : e - w.ePrev;
      w.ePrev = e; w.comp = (w.Kp * de + ip(WLC_F1, e)) * ip(WLC_F2, pl.intakeWL);
      this.jP = clamp(this.jP + w.comp, 0, 210);
      pl.log('INFO', `PLANT: WLC siklus 15 menit – WL ${pl.intakeWL.toFixed(2)} m, e ${e >= 0 ? '+' : ''}${e.toFixed(2)} m → kompensasi ${w.comp.toFixed(1)} MW, joint SP ${this.jP.toFixed(1)} MW`);
    }
    tick(dt) {
      const pl = this.plant, us = pl.units;
      const jU = us.filter((u) => this.online(u) && u.sw.ALR && u.sw.JLR), jUq = us.filter((u) => this.online(u) && u.sw.AQR && u.sw.JQR);
      // sumber set point joint control
      if (this.mode && this.mode.startsWith('SCH')) this.jP = this.sch[+this.mode.slice(4) - 1].set[this.idx()];
      else if (this.mode === 'WLC') { this.wlc.t += dt; if (this.wlc.t >= this.wlc.cyc) { this.wlc.t = 0; this.wlcStep(); } }
      else if (!jU.length) this.jP = this.totals().p;                       // tanpa unit JOINT: set point mengikuti total (bumpless)
      else this.jP = this.jPman;
      if (!jUq.length) this.jQ = this.totals().q;
      // pembagian ke unit JOINT: (SP joint − unit non-joint) dibagi rata (ASUMSI)
      if (jU.length) {
        const other = us.filter((u) => u.p.cb && !jU.includes(u)).reduce((a, u) => a + u.p.p, 0);
        const share = (this.jP - other) / jU.length;
        jU.forEach((u) => { u.sw.alrSP = clamp(share, u.sw.minP, u.sw.maxP); });
      }
      if (jUq.length) {
        const other = us.filter((u) => u.p.cb && !jUq.includes(u)).reduce((a, u) => a + u.p.q, 0);
        jUq.forEach((u) => { u.sw.aqrSP = clamp((this.jQ - other) / jUq.length, -40, 50); });
      }
      // trend WLC (tiap 60 s, 12 jam) & riwayat DPO (tiap 300 s, 24 jam)
      this.wlc.hT = (this.wlc.hT || 60) + dt; if (this.wlc.hT >= 60) { this.wlc.hT = 0; this.wlc.hist.push([pl.t, pl.intakeWL]); if (this.wlc.hist.length > 720) this.wlc.hist.shift(); }
      this.histT += dt; if (this.histT >= 300) { this.histT = 0; this.hist.push({ t: pl.t, tod: this.tod(), p: this.totals().p, wl: pl.intakeWL, rwl: pl.dam ? pl.dam.rwl : 0 }); if (this.hist.length > 288) this.hist.shift(); }
    }
    /* Daily Power Operation – CALCULATION (algoritma ASUMSI: neraca volume intake f7) */
    calc() {
      const pl = this.plant, d = this.dpo, qin = Math.max(0, d.inflow + d.bias);
      const tod = this.tod(), now = tod / 3600, tStart = ((d.start - now) % 24 + 24) % 24;     // jam menuju start
      const vol = (x) => volIntakeLocal(x), Vmol = vol(MOL), Vfsl = vol(FSL);
      const qNow = 0;                                                         // pola peaking: sebelum START TIME pembangkit tidak beroperasi (air ditampung)
      let V = vol(pl.intakeWL) + (qin - qNow) * tStart * 3600;
      V = Math.min(V, Vfsl); const Vu = Math.max(0, V - Vmol);
      const per = (P) => { const qn = P * QPMW - qin; return qn <= 0 ? 24 : Math.min(24, Vu / qn / 3600); };
      // daya hasil: daya input dibatasi supaya air cukup sampai jadwal start berikutnya (d.next jam)
      let Pr = Math.min(d.P, 210); const need = Math.min(24, Math.max(1, d.next));
      if (per(Pr) < need) { let lo = 0, hi = Pr; for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (per(mid) >= need) lo = mid; else hi = mid; } Pr = Math.floor(lo); }
      const T = per(Pr), stop = (d.start + T) % 24;
      d.res = { inflow: qin, P: Pr, period: T, stop, at: pl.t, tod, V0: vol(pl.intakeWL) };
      // prakiraan 24 jam ke depan (tiap 15 menit)
      const fc = []; let v = vol(pl.intakeWL);
      const inv = (Vx) => { let x = pl.intakeWL; for (let k = 0; k < 4; k++) { const f = volIntakeLocal(x) - Vx, dd = (2 * 189.475 * x - 218232.925) * 1000; x -= f / dd; } return x; };
      for (let k = 0; k <= 96; k++) {
        const h = k * 0.25, Pk = h < tStart ? qNow / QPMW : (h < tStart + T ? Pr : 0);
        fc.push({ h, p: Pk, wl: Math.min(FSL, inv(v)) });
        v = Math.min(Vfsl, v + (qin - Pk * QPMW) * 900);
      }
      d.res.fc = fc; d.res.mol = MOL; d.res.qNow = qNow;
      pl.log('CMD', `DPO: CALCULATION – inflow ${qin.toFixed(2)} m³/s, daya ${Pr} MW, available ${T.toFixed(1)} h, stop ${String(Math.floor(stop)).padStart(2, '0')}:00`);
      return d.res;
    }
    planned() {   // nilai rencana pada waktu sekarang (dari hasil CALCULATION)
      const r = this.dpo.res; if (!r) return null;
      const h = (this.plant.t - r.at) / 3600; if (h > 24) return null;
      const k = Math.min(96, Math.max(0, Math.round(h * 4))); return r.fc[k];
    }
  }
  PlantCtrl.SCH = SCH_DEF; PlantCtrl.MOL = MOL; PlantCtrl.QPMW = QPMW; PlantCtrl.F1 = WLC_F1; PlantCtrl.F2 = WLC_F2;

  /* ============================== AIR SUPPLY SYSTEM (layar 00010) ============================== */
  // tekanan dalam p.u. nominal (nilai MPa tidak ada di layar). Kompresor 1 → primary air tank → governor pressure tank
  // & (via reducing) brake air tank → shaft seal / brake / actuator. Kompresor 2 → inlet valve air tank → I/V pressure tank.
  class AirSystem {
    constructor(pl) {
      this.plant = pl;
      this.u = [1, 2, 3].map(() => ({ c1: { run: false, fail: false, hrs: 0 }, c2: { run: false, fail: false, hrs: 0 }, prim: 0.97, brake: 0.95, iv: 0.97, lastBrake: 0, lastIv: 0 }));
      this.leak = [0, 0, 0];
    }
    sw(x) { return { H1: x >= 0.90, H2: x >= 0.985, L: x < 0.80 }; }
    tick(dt) {
      const pl = this.plant;
      pl.units.forEach((un, i) => {
        const a = this.u[i], p = un.p, pw = !pl.ss || pl.ss.unitAux(i + 1) || pl.ss.live.MCCCOM;
        // konsumsi
        a.prim -= (p.govOn ? 0.0006 : 0.00015) * dt + this.leak[i] * dt;
        if (p.brake > 0.5 && a.lastBrake <= 0.5) a.brake -= 0.04;                      // satu kali aplikasi rem
        a.lastBrake = p.brake;
        a.brake -= (p.ax ? 0.0002 : 0.00005) * dt;                                       // shaft seal / actuator
        if (Math.abs(p.iv - a.lastIv) > 1e-5) a.iv -= 0.0012 * dt; a.lastIv = p.iv;
        a.iv -= 0.00008 * dt;
        // reducing valve primary → brake
        if (a.brake < 0.95 && a.prim > a.brake + 0.02) { const f = Math.min(0.004 * dt, 0.95 - a.brake); a.brake += f; a.prim -= f * 0.5; }
        // kompresor (start < 0.90 / 63AQH1 off, stop ≥ 0.985 / 63AQH2 on)
        for (const [c, k] of [[a.c1, 'prim'], [a.c2, 'iv']]) {
          if (a[k] < 0.90) c.run = true; if (a[k] >= 0.985) c.run = false;
          if (c.fail || !pw) c.run = false;
          if (c.run) { a[k] += 0.003 * dt; c.hrs += dt / 3600; }
          a[k] = clamp(a[k], 0, 1.0);
        }
        a.brake = clamp(a.brake, 0, 1.0);
      });
    }
  }

  /* ============================== RAIN FALL MONITOR (layar 00023) ============================== */
  // RGS-1..6 (mm/h) & WLS-1/2 (El.m). Di OPS nilai '?' (tidak terkomunikasi) → simulator membangkitkan data sintetis.
  class Rain {
    constructor(pl) { this.plant = pl; this.I = 0; this.base = null; this.rgs = [0, 0, 0, 0, 0, 0]; this.fac = [1.15, 0.9, 1.05, 1.0, 0.8, 1.2]; this.acc = [0, 0, 0, 0, 0, 0]; this.t = 0; this.q = 0; }
    set(I) { const pl = this.plant; if (I > 0 && this.base === null) this.base = pl.inflow; this.I = I; pl.log('CMD', `RAIN: intensitas hujan DAS = ${I} mm/h`); }
    tick(dt) {
      const pl = this.plant; this.t += dt;
      this.rgs = this.fac.map((k, i) => Math.max(0, this.I * k * (1 + 0.15 * Math.sin(this.t / 900 + i * 1.7))));
      this.rgs.forEach((r, i) => { this.acc[i] += r * dt / 3600; });
      const avg = this.rgs.reduce((a, b) => a + b, 0) / 6;
      // limpasan: tambahan inflow = 6 m3/s per mm/h rata-rata DAS, tunda ±30 menit (ASUMSI)
      this.q = lag(this.q, 6 * avg, 1800, dt);
      if (this.base !== null) { pl.inflow = this.base + this.q; if (this.I === 0 && this.q < 0.05) { pl.inflow = this.base; this.base = null; } }
    }
    wls(i) { const q = this.plant.inflow; return i === 0 ? 585.0 + 0.32 * Math.sqrt(q) : 579.0 + 0.30 * Math.sqrt(q); }   // ASUMSI rating curve
  }

  /* ============================== REGISTRASI KE ENGINE ============================== */
  M.EXT.push({
    build(pl) {
      pl.ss = new StationService(pl); pl.dam = new Dam(pl); pl.daily = new DailyOps(pl); pl.pc = new PlantCtrl(pl); pl.air = new AirSystem(pl); pl.rain = new Rain(pl);
      // 152-LST: gangguan LSTr menahan close
      const sy = pl.sy, il = sy.interlock.bind(sy);
      sy.interlock = (d, close) => (d === '152-LST' && close && sy.lstFault) ? 'Gangguan LSTr masih ada (lockout)' : il(d, close);
      // selector 143STEP / 143R: operasi switchyard dari OPS hanya saat REMOTE
      const il2 = sy.interlock;
      sy.interlock = (d, close) => pl.pc.syBlock() || il2(d, close);
      // selector 343STEP/343R (MCH) & 443STEP/443R (powerhouse): blok perintah OPS (changeover otomatis tetap jalan)
      const ssop = pl.ss.operate.bind(pl.ss);
      pl.ss.operate = (id, close, who = 'OPS') => ((who === 'OPS' || who === 'MANUVER') && pl.pc.ssBlock(id)) || ssop(id, close, who);
    },
    points,
    tick(pl, st) { pl.ss.tick(st); pl.dam.tick(st); pl.daily.tick(st); pl.pc.tick(st); pl.air.tick(st); pl.rain.tick(st);
      const asr = pl.pc.sel.s343ASR === 'USE' ? 'AUTO' : 'LOCK'; if (pl.pc.asrLast !== asr) { pl.pc.asrLast = asr; pl.ss.aco.mch = asr; pl.ss.aco.ph = asr; } },
    inject(pl, key) {
      if (!NEW_SCN.some((x) => x.key === key)) return false;
      const s = M.SCN[key], ss = pl.ss;
      if (pl.fx[key]) {
        delete pl.fx[key]; pl.log('INFO', `FAULT CLEAR: ${s.name}`);
        if (key === 'ss_lst_trip') pl.sy.lstFault = false;
        if (key === 'ss_cable1') delete ss.fault.CAB1;
        if (key === 'ss_sstr1') delete ss.fault.SST1P;
        if (key === 'ss_ph_busa') delete ss.fault.P4A;
        if (key === 'dam_flood') pl.inflow = 14.6;
        if (key === 'air_comp_fail') { pl.air.u[0].c1.fail = false; pl.air.leak[0] = 0; }
        return true;
      }
      pl.fx[key] = { t0: pl.t }; pl.log('ALARM', `FAULT INJECT: ${s.name}`);
      if (key === 'ss_lst_trip') { pl.sy.lstFault = true; if (pl.sy.st['152-LST']) { pl.sy.st['152-LST'] = false; pl.log('ALARM', 'SY: 152-LST TRIP – LSTr differential / Buchholz'); } }
      if (key === 'ss_cable1') ss.fault.CAB1 = 'gangguan kabel feeder no.1';
      if (key === 'ss_sstr1') ss.fault.SST1P = 'gangguan SSTr No.1';
      if (key === 'ss_ph_busa') ss.fault.P4A = 'gangguan 400 V BUS-A powerhouse';
      if (key === 'ss_bc_live' && ss.st['289DLE-BC']) pl.log('INFO', 'SS: line Base Camp masih di-ground (289DLE-BC CLOSE) – GI baru menormalkan setelah 289DLE-BC OPEN');
      if (key === 'dam_flood') pl.inflow = 180;
      if (key === 'air_comp_fail') { pl.air.u[0].c1.fail = true; pl.air.leak[0] = 0.00025; }
      ss.solve(); ss.checkFaults();
      return true;
    },
    clear(pl) { pl.sy.lstFault = false; pl.ss.fault = {}; pl.inflow = 14.6; pl.air.u.forEach((a) => { a.c1.fail = false; a.c2.fail = false; }); pl.air.leak = [0, 0, 0]; pl.rain.I = 0; pl.rain.q = 0; pl.rain.base = null; },
    init(pl) { pl.ss.lineupNormal(); },
  });
  M.PlantCtrl = PlantCtrl; M.AirSystem = AirSystem; M.Rain = Rain;
  M.StationService = StationService; M.Dam = Dam; M.SS_DEV = DEV; M.SS_REL27 = REL27; M.SS_LOADS = LOADS; M.SS_EDGES = EDGES;
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
})(typeof window !== 'undefined' ? window : globalThis);
