/* MUSI HEPP – SEQ FAULT SIM (v3.7): gangguan I/O pada permissive sekuens unit.
   Sumber:
   - block diagram unit control JEZ1L675: SH.10–12 STARTING CONDITION-1/2/3, SH.14 STARTING CONDITION-5 (86-x),
     SH.15 CONTROL CONDITION, SH.20–27 GENERATING STOP→LOAD, SH.30–36 LOAD→STOP, SH.50 CB(52) OPEN/CLOSE CONTROL
   - nomor DI/DO: tertulis pada block diagram di atas; daftar I/O LCU unit JEZ1L682 SH.U531–U572
   Lapisan DI: Unit.d(id, nilaiPeralatan) → nilai yang dibaca LCU. Tanpa gangguan keduanya sama.
   Mode gangguan: off (selalu 0), on (selalu 1), inv (terbalik), dly (perubahan terlambat N detik). */
(function (root) {
  'use strict';
  const M = (typeof module !== 'undefined' && module.exports) ? require('./plant-engine.js') : root.MUSI;
  const { EXT, STEP, START_T, STOP_T } = M;

  /* ---- katalog DI (id, nama sinyal, device, sheet JEZ1L675) ---- */
  const G = {
    SC1: 'STARTING CONDITION-1 (SH.10)', SC2: 'STARTING CONDITION-2 (SH.11)', SC3: 'STARTING CONDITION-3 / 86-x (SH.12, SH.14)',
    CTL: 'CONTROL CONDITION (SH.15)', PRE: 'STOP→PREPARATION (SH.20)', RUN: 'PREPARATION→RUNNING / INLET VALVE (SH.21–22)',
    EXC: 'RUNNING→EXCITATION (SH.23)', PAR: 'EXCITATION→PARALLEL-IN / CB 52 (SH.24, SH.50)', STP: 'LOAD→STOP (SH.30–35)',
  };
  const CAT = [
    ['DI0091', 'UNIT CIRCUIT BREAKER (52) OPEN', '52', 'SC1', '10, 24, 30–35, 50'],
    ['DI0093', 'DISCONNECTING SWITCH (89) CLOSE', '89', 'SC1', '10'],
    ['6DI152', 'UNIT LINE CIRCUIT BREAKER (152-U) CLOSE', '152-U', 'SC1', '10, 22'],
    ['6DI189A', '150kV BUS A DISCONNECTING SWITCH (189-UA) CLOSE', '189-UA', 'SC1', '10'],
    ['6DI189B', '150kV BUS B DISCONNECTING SWITCH (189-UB) CLOSE', '189-UB', 'SC1', '10'],
    ['DI0049', 'UNIT LOCAL CONTROL BOARD DC FAILURE', '27DX', 'SC1', '10'],
    ['DI0050', 'UNIT LOCAL CONTROL BOARD AC FAILURE', '27AX', 'SC1', '10'],
    ['DI0095', 'DS FOR NEUTRAL GROUNDING CLOSE', '89NGT', 'SC1', '10'],
    ['DI0079', 'FIELD CIRCUIT BREAKER (41) OPEN', '41', 'SC1', '10, 32'],
    ['DI0168', 'INLET VALVE FULLY CLOSED', '33IVlb', 'SC1', '10, 34'],
    ['DI0170', 'BY-PASS VALVE FOR INLET VALVE FULLY CLOSED', '33BPlb', 'SC1', '10, 21, 34'],
    ['DI0172', 'INLET VALVE LOCKED', '33IVL', 'SC1', '10'],
    ['DI0239', 'INLET VALVE MAIN OIL SUPPLY VALVE OPEN', '20QIVMS', 'SC1', '10'],
    ['DI0179', 'RELEASE PRESSURE FOR MAINTENANCE SEAL OF I/V AVAILABLE', '33ivm', 'SC1', '10'],
    ['DI0230', 'I/V PRESSURE TANK PRESSURE HIGH', '63QVH', 'SC1', '10'],
    ['DI0231', 'I/V PRESSURE TANK PRESSURE LOW', '63VL1', 'SC1', '10, 13'],
    ['DI0232', 'I/V PRESSURE TANK PRESSURE TOO LOW', '63QVL-2', 'SC1', '10'],
    ['DI0220', 'I/V PRESSURE TANK LEVEL TOO HIGH', '71QVPH', 'SC1', '10'],
    ['DI0221', 'I/V PRESSURE TANK LEVEL LOW', '71QVPL-1', 'SC1', '10, 13'],
    ['DI0222', 'I/V PRESSURE TANK LEVEL TOO LOW', '71QVPL-2', 'SC1', '10'],
    ['DI0243', 'I/V PRESSURE AIR SYSTEM PRESSURE ALARM', '63AV1', 'SC1', '10'],
    ['DI0100', 'UPPER GUIDE BEARING OIL LEVEL LOW', '', 'SC1', '10'],
    ['DI0101', 'LOWER GUIDE BEARING OIL LEVEL LOW', '', 'SC1', '10'],
    ['DI0205', 'WICKET GATE (GUIDE VANE) FULLY CLOSED', '33GVlb', 'SC2', '11, 33'],
    ['DI0167', 'GUIDE VANE LOCKED', '33GVL', 'SC2', '11'],
    ['DI0158', 'GOVERNOR PRESSURE TANK PRESSURE HIGH', '63QH', 'SC2', '11'],
    ['DI0159', 'GOVERNOR PRESSURE TANK PRESSURE LOW', '63QL-1', 'SC2', '11, 13'],
    ['DI0155', 'GOVERNOR PRESSURE TANK PRESSURE TOO LOW', '63QL-2', 'SC2', '11'],
    ['DI0202', 'GOVERNOR PRESSURE TANK LEVEL TOO HIGH', '71QPH', 'SC2', '11'],
    ['DI0203', 'GOVERNOR PRESSURE TANK LEVEL LOW', '71QPL-1', 'SC2', '11, 13'],
    ['DI0204', 'GOVERNOR PRESSURE TANK LEVEL TOO LOW', '71QPL-2', 'SC2', '11'],
    ['DI0207', 'GOVERNOR LOW PRESSURE AIR SYSTEM PRESSURE LOW', '63AQL', 'SC2', '11'],
    ['DI0150', 'MAIN OIL SUPPLY VALVE (20QMV) OPEN', '20QMV', 'SC2', '11'],
    ['DI0215', 'SHAFT SEAL MAINTENANCE SEAL APPLIED', '33AMS', 'SC2', '11'],
    ['DI0218', 'OVER SPEED PENDULUM RESET', '33-12M', 'SC2', '11'],
    ['DI0105', 'GENERATOR BRAKE RELEASED', '63BR', 'SC2', '11, 21, 22, 36'],
    ['DI0245', 'GOVERNOR HIGH PRESSURE AIR SYSTEM READY', '63AQH', 'SC2', '11'],
    ['DI0129', 'DIGITAL GOVERNOR CONTROLLER FAULT', 'K00', 'SC2', '11'],
    ['DI0132', 'DIGITAL GOVERNOR CONTROLLER "READY FOR START"', 'K06', 'SC2', '11'],
    ['DI0138', 'REGULATOR CONTROL MODE REMOTE', 'K14', 'SC2', '11'],
    ['DI0078', 'FIELD CIRCUIT BREAKER (41) CLOSE', '41', 'SC3', '12, 23'],
    ['DI0213', 'BEARING OIL LEVEL LOW (1ST)', '71QBL1', 'SC3', '12, 13'],
    ['DI0212', 'BEARING OIL LEVEL LOW (2ND)', '71QBL2', 'SC3', '12'],
    ['DI0208', 'GENERATOR BRAKE AIR PRESSURE LOW', '63BPF', 'SC3', '12'],
    ['DI0113', 'LOCK-OUT RELAY 86-1 OPERATE', '86-1', 'SC3', '14'],
    ['DI0114', 'LOCK-OUT RELAY 86-2 OPERATE', '86-2', 'SC3', '14'],
    ['DI0115', 'LOCK-OUT RELAY 86-4 OPERATE', '86-4', 'SC3', '14'],
    ['DI0086', 'UNIT CIRCUIT BREAKER CONTROL SELECTOR REMOTE', '43-52', 'CTL', '15'],
    ['DI0083', 'EXCITATION CONTROL SELECTOR REMOTE', '43-41', 'CTL', '15'],
    ['DI0065', 'VOLTAGE CONTROL SELECTOR AVR', '43-90', 'CTL', '15'],
    ['DI0164', 'GOVERNOR CONTROL SELECTOR ON', '43-20', 'CTL', '15'],
    ['DI0286', 'SPACE HEATER OFF', '88SH', 'PRE', '20'],
    ['DI0273', 'GOV. PRESSURE OIL PUMP (88QP1) START', '88QP1', 'PRE', '20'],
    ['DI0292', 'GOV. PRESSURE OIL PUMP (88QP2) START', '88QP2', 'PRE', '20'],
    ['DI0250', 'M.Tr OIL PUMP (88MTR1) START', '88MTR1', 'PRE', '20'],
    ['DI0251', 'M.Tr OIL PUMP (88MTR2) START', '88MTR2', 'PRE', '20'],
    ['DI0279', 'OIL LIFT PUMP (88QT) START', '88QT', 'PRE', '20'],
    ['DI0110', 'OIL LIFT PUMP PRESSURE RELAY ON', '63QT', 'PRE', '20, 22, 33'],
    ['DI0107', 'LOWER BRG. WATER FLOW LOW', '', 'PRE', '20'],
    ['DI0108', 'AIR COOLER WATER FLOW LOW', '', 'PRE', '20'],
    ['DI0109', 'OIL COOLER WATER FLOW LOW', '', 'PRE', '20'],
    ['DI0235', 'TURBINE BEARING WATER FLOW NORMAL', '80FB2', 'PRE', '20'],
    ['DI0242', 'SHAFT SEAL WATER FLOW NORMAL', '80FB2', 'PRE', '20'],
    ['DI0216', 'SHAFT SEAL WATER PRESSURE AVAILABLE', '', 'PRE', '20'],
    ['DI0169', 'INLET VALVE FULLY OPEN', '33IVha', 'RUN', '21'],
    ['DI0139', 'TURBINE SPEED > 50 %', '13-1', 'RUN', '22'],
    ['DI0106', 'GEN. OIL COOLER OIL FLOW LOW', '', 'RUN', '22'],
    ['DI0143', 'STOP DETECTOR (14L) ON', '14L', 'RUN', '22, 33'],
    ['DI0142', 'TURBINE SPEED > 90 %', '13-2', 'EXC', '22, 33'],
    ['DI0073', 'GENERATOR VOLTAGE > 90 %', '84E', 'EXC', '23'],
    ['DI0090', 'UNIT CIRCUIT BREAKER (52) CLOSED', '52', 'PAR', '24, 30, 31, 50'],
    ['DI0206', 'GUIDE VANE NO LOAD POSITION', '74mb', 'STP', '30'],
    ['DI0174', 'OPERATING SEAL APPLY', '33BPlb', 'STP', '34'],
    ['DI0285', 'GEN. SPACE HEATER ON', '88SH', 'STP', '35'],
  ];
  // tag switchyard per unit (JEZ1L675 SH.10: 6DI-0161/0177/0209 dst.)
  const SYT = { 1: ['6DI0161', '6DI0163', '6DI0165'], 2: ['6DI0177', '6DI0179', '6DI0181'], 3: ['6DI0209', '6DI0211', '6DI0213'] };
  function tagOf(id, n) {
    if (id === '6DI152') return SYT[n][0]; if (id === '6DI189A') return SYT[n][1]; if (id === '6DI189B') return SYT[n][2];
    return n + id;
  }
  function catalog(n) {
    return CAT.map(([id, name, dev, grp, sh]) => ({ id, tag: tagOf(id, n), name, dev, grp, gname: G[grp], sh }));
  }
  const MODES = { off: 'PAKSA 0 (OFF)', on: 'PAKSA 1 (ON)', inv: 'TERBALIK', dly: 'TERLAMBAT' };

  /* ---- skenario cepat ---- */
  const PRESETS = [
    { k: 'cbo', t: 'CB 52 OPEN tidak terbaca (DI0091 = 0)', set: [['DI0091', 'off']],
      e: 'Unit STOP: STARTING CONDITION-1 tidak terpenuhi → perintah start ditolak. Unit LOAD lalu STOP: 52 membuka tetapi PARALLEL-IN STEP END tidak datang → 10 s → SEQUENCE MONITOR ERROR (SH.31). Setelah 10 s juga alarm status CB tidak sesuai (SH.50).' },
    { k: 'cbc', t: 'CB 52 CLOSED tidak terbaca (DI0090 = 0)', set: [['DI0090', 'off']],
      e: 'Start: 52 masuk (sinkron) tetapi PARALLEL-IN STEP COMPLETION tidak datang → 120 s → SEQUENCE MONITOR ERROR (SH.24). Unit LOAD lalu STOP: syarat stop SH.30–31 (52 CLOSED) tidak terpenuhi.' },
    { k: 'cbi', t: 'Status CB 52 terbalik (DI0090 & DI0091)', set: [['DI0090', 'inv'], ['DI0091', 'inv']],
      e: 'LCU membaca 52 CLOSED saat CB terbuka dan sebaliknya: STARTING CONDITION-1 NG pada unit STOP; pada unit LOAD perintah STOP tertahan di step PARALLEL-IN.' },
    { k: 'ivo', t: 'Inlet valve FULLY OPEN tidak datang (DI0169 = 0)', set: [['DI0169', 'off']],
      e: 'Start: inlet valve terbuka penuh tetapi LCU tidak menerima 33IVha → brake tidak dilepas, governor tidak start → timer RUNNING 240 s (I/V 180 s + running 60 s) → SEQUENCE MONITOR ERROR (SH.21–22).' },
    { k: 'fcb', t: 'Field CB 41 CLOSE tidak datang (DI0078 = 0)', set: [['DI0078', 'off']],
      e: 'Start: eksitasi menyala, tegangan naik, tetapi 41 CLOSE tidak terbaca → EXCITATION STEP COMPLETION tidak datang → 60 s → SEQUENCE MONITOR ERROR (SH.23).' },
    { k: 'gvc', t: 'Guide vane FULLY CLOSED tidak terbaca (DI0205 = 0)', set: [['DI0205', 'off']],
      e: 'Unit STOP: STARTING CONDITION-2 NG → start ditolak. Unit LOAD lalu STOP: RUNNING STEP END (33GVlb) tidak datang → sekuens stop tertahan, SEQUENCE MONITOR ERROR saat timer habis (SH.33).' },
    { k: 'gov', t: 'Governor "READY FOR START" hilang (DI0132 = 0)', set: [['DI0132', 'off']],
      e: 'Unit STOP: STARTING CONDITION-2 NG → start ditolak. Unit yang sudah jalan tidak terpengaruh (sinyal hanya dipakai sebagai syarat start).' },
    { k: 'sel', t: 'Selector 43-52 tidak REMOTE (DI0086 = 0)', set: [['DI0086', 'off']],
      e: 'CONTROL CONDITION NG → START CONDITION tidak terpenuhi → start ditolak (SH.15).' },
    { k: 'spd', t: 'Speed > 90 % terlambat 90 s (DI0142)', set: [['DI0142', 'dly', 90]],
      e: 'Start: putaran sudah nominal tetapi 13-2 baru terbaca 90 s kemudian → step RUNNING lebih lama dari timer 240 s → SEQUENCE MONITOR ERROR muncul; begitu sinyal datang sekuens tetap berlanjut sampai LOAD (alarm tetap tercatat).' },
  ];

  class SeqFault {
    constructor(plant) { this.plant = plant; this.flt = {}; this.raw = {}; this.lcu = {}; }
    read(tag, phys, u) {
      this.raw[tag] = phys;
      const f = this.flt[tag]; let v = phys;
      if (f) {
        if (f.mode === 'off') v = false;
        else if (f.mode === 'on') v = true;
        else if (f.mode === 'inv') v = !phys;
        else if (f.mode === 'dly') {
          const t = this.plant.t;
          if (f.last === undefined) { f.last = phys; f.out = phys; f.tc = t; }
          if (phys !== f.last) { f.last = phys; f.tc = t; }
          if (f.out !== phys && t - f.tc >= f.sec) f.out = phys;
          v = f.out;
        }
      }
      this.lcu[tag] = v; return v;
    }
    set(tag, mode, sec) {
      if (!mode) { if (this.flt[tag]) { delete this.flt[tag]; this.plant.log('CMD', `SEQ FAULT ${tag} NORMAL`); } return; }
      this.flt[tag] = { mode, sec: Math.max(1, +sec || 10) };
      this.plant.log('CMD', `SEQ FAULT ${tag} → ${MODES[mode]}${mode === 'dly' ? ' ' + this.flt[tag].sec + ' s' : ''}`);
    }
    clearUnit(n) { Object.keys(this.flt).filter((t) => catalog(n).some((c) => c.tag === t)).forEach((t) => this.set(t, null)); }
    clearAll() { Object.keys(this.flt).forEach((t) => this.set(t, null)); }
    preset(k, n) {
      const p = PRESETS.find((x) => x.k === k); if (!p) return;
      this.clearUnit(n);
      p.set.forEach(([id, mode, sec]) => this.set(tagOf(id, n), mode, sec));
      this.plant.log('INFO', `SEQ FAULT U${n}: skenario "${p.t}"`);
    }
    unitTags(n) { return Object.keys(this.flt).filter((t) => catalog(n).some((c) => c.tag === t)); }
  }

  // evaluasi seluruh daftar permissive unit (agar nilai DI & mode "terlambat" selalu diperbarui)
  function evalAll(u) {
    u.sc1(); u.sc2(); u.sc3(); u.ctrlList();
    for (let k = 1; k <= 5; k++) u.condStart(k);
    for (let k = 0; k <= 4; k++) u.condStop(k);
    u.cbDisc = u.d('DI0090', u.p.cb) === u.d('DI0091', !u.p.cb);
  }

  EXT.push({
    build(plant) { plant.seqf = new SeqFault(plant); },
    clear(plant) { if (plant.seqf) plant.seqf.clearAll(); },
    tick(plant) { plant.units.forEach(evalAll); },
    points(plant) {
      // JEZ1L675 SH.50: 52 OPEN dan 52 CLOSED tidak saling berlawanan selama 10 s → CRT ALM_0002
      return plant.units.map((u) => ({ grp: 'U' + u.n, win: 'B1', tag: `${u.n}ALM0002`, text: 'UNIT CB (52) OPEN/CLOSED STATUS DISCREPANCY', lvl: 'H', cond: () => !!u.cbDisc, delay: 10 }));
    },
  });

  const API = { CAT, G, PRESETS, MODES, catalog, tagOf, SeqFault, evalAll };
  M.SEQF = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.MUSI_SEQF = API;
})(typeof window !== 'undefined' ? window : globalThis);
