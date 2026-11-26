/* MUSI HEPP – SEQ FAULT SIM (v3.8): gangguan I/O pada sekuens unit STOP↔LOAD dan jalur LINE CHARGING (43CH).
   Sumber logika & tag:
   - block diagram unit control JEZ1L675: SH.05–06 (master control, 43CH), SH.10–15 (starting/control condition),
     SH.20–27 (STOP→LOAD), SH.25–26 (EXCITATION/PARALLEL-IN [CH]), SH.30–36 (LOAD→STOP), SH.50 (CB 52)
   - flow chart Stop_To_Load, Load_to_Stop, Stop_To_CH
   - I/O list LCU unit JEZ1L682: DI U531–U552, DO U561–U572 (nama tag mengikuti dokumen ini)
   Lapisan I/O di engine: Unit.d() (DI), Unit.setDO() (DO), Unit.a() (AI). Tanpa gangguan nilai LCU = kondisi alat.
   Mode gangguan: DI off/on/inv/dly · DO off (tidak keluar)/dly (terlambat) · AI hold (beku)/set (paksa nilai). */
(function (root) {
  'use strict';
  const M = (typeof module !== 'undefined' && module.exports) ? require('./plant-engine.js') : root.MUSI;
  const { EXT } = M;

  const G = {
    SC1: 'STARTING CONDITION-1 (SH.10)', SC2: 'STARTING CONDITION-2 (SH.11)', SC3: 'STARTING CONDITION-3 / 86-x (SH.12, SH.14)',
    CTL: 'CONTROL CONDITION (SH.15)', PRE: 'STOP→PREPARATION (SH.20)', RUN: 'PREPARATION→RUNNING / INLET VALVE (SH.21–22)',
    EXC: 'RUNNING→EXCITATION (SH.23)', PAR: 'EXCITATION→PARALLEL-IN / CB 52 (SH.24, SH.50)', LOD: 'PARALLEL-IN→LOAD (SH.27)',
    STP: 'LOAD→STOP (SH.30–36)', CH: 'LINE CHARGING 43CH (SH.06, SH.22, SH.25–26, Stop_To_CH)',
  };
  // [id, nama (I/O list JEZ1L682), device, grup, sheet JEZ1L675 / flow chart, tipe, indikasi-saja]
  const CAT = [
    ['DI0091', 'CB 52 OPEN', '52', 'SC1', '10, 24, 26, 30–31, 50', 'DI'],
    ['DI0093', 'DS 89 CLOSE', '89', 'SC1', '10', 'DI'],
    ['6DI152', 'UNIT LINE CIRCUIT BREAKER (152-U) CLOSE', '152-U', 'SC1', '10', 'DI'],
    ['6DI189A', '150kV BUS A DISCONNECTING SWITCH (189-UA) CLOSE', '189-UA', 'SC1', '10', 'DI'],
    ['6DI189B', '150kV BUS B DISCONNECTING SWITCH (189-UB) CLOSE', '189-UB', 'SC1', '10', 'DI'],
    ['DI0049', 'UNIT LOCAL CONTROL BOARD DC POWER FAILURE', '27DX', 'SC1', '10', 'DI'],
    ['DI0050', 'UNIT LOCAL CONTROL BOARD AC POWER FAILURE', '27AX', 'SC1', '10', 'DI'],
    ['DI0095', 'DS 89NGT CLOSE', '89NGT', 'SC1', '10', 'DI'],
    ['DI0079', 'FIELD BREAKER OPEN', '41', 'SC1', '10, 32', 'DI'],
    ['DI0168', 'INLET VALVE CLOSE', '33IVlb', 'SC1', '10, 34', 'DI'],
    ['DI0170', 'BY-PASS VALVE CLOSE', '33BPlb', 'SC1', '10, 21, 34', 'DI'],
    ['DI0172', 'INLET VALVE LOCKED', '33IVL', 'SC1', '10', 'DI'],
    ['DI0239', 'INLET VALVE MAIN OIL SUPPLY VALVE OPEN', '20QIVMS', 'SC1', '10', 'DI'],
    ['DI0179', 'MAINTENANCE SEAL FULLY RETRACTED', '33ivm', 'SC1', '10', 'DI'],
    ['DI0230', 'INLET VALVE PRESSURE HIGH', '63QVH', 'SC1', '10', 'DI'],
    ['DI0231', 'INLET VALVE PRESSURE OIL SYSTEM PRESSURE LOW 1ST', '63VL1', 'SC1', '10, 13', 'DI'],
    ['DI0232', 'INLET VALVE PRESSURE OIL SYSTEM PRESSURE LOW 2ND', '63QVL-2', 'SC1', '10', 'DI'],
    ['DI0220', 'INLET VALVE PRESSURE TANK OIL LEVEL HIGH', '71QVPH', 'SC1', '10', 'DI'],
    ['DI0221', 'INLET VALVE PRESSURE TANK OIL LEVEL LOW 1ST', '71QVPL-1', 'SC1', '10, 13', 'DI'],
    ['DI0222', 'INLET VALVE PRESSURE TANK OIL LEVEL LOW 2ND', '71QVPL-2', 'SC1', '10', 'DI'],
    ['DI0243', 'INLET VALVE HP AIR COMPRESSOR PRESSURE LOW', '63AV1', 'SC1', '10', 'DI'],
    ['DI0100', 'OIL LEVEL SWITCH FOR UPPER GUIDE BEARING', '', 'SC1', '10', 'DI'],
    ['DI0101', 'OIL LEVEL SWITCH FOR LOWER GUIDE BEARING', '', 'SC1', '10', 'DI'],
    ['DI0205', 'GUIDE VANE CLOSED', '33GVlb', 'SC2', '11, 33, Load_to_Stop', 'DI'],
    ['DI0167', 'GUIDE VANE LOCKED', '33GVL', 'SC2', '11', 'DI'],
    ['DI0158', 'GOVERNOR PRESSURE OIL SYSTEM PRESSURE HIGH', '63QH', 'SC2', '11', 'DI'],
    ['DI0159', 'GOVERNOR PRESSURE OIL SYSTEM PRESSURE LOW 1ST', '63QL-1', 'SC2', '11, 13', 'DI'],
    ['DI0155', 'GOVERNOR PRESSURE OIL SYSTEM PRESSURE LOW 2ND', '63QL-2', 'SC2', '11', 'DI'],
    ['DI0202', 'GOVERNOR PRESSURE TANK OIL LEVEL HIGH', '71QPH', 'SC2', '11', 'DI'],
    ['DI0203', 'GOVERNOR PRESSURE TANK OIL LEVEL LOW 1ST', '71QPL-1', 'SC2', '11, 13', 'DI'],
    ['DI0204', 'GOVERNOR PRESSURE TANK OIL LEVEL LOW 2ND', '71QPL-2', 'SC2', '11', 'DI'],
    ['DI0207', 'GOVERNOR PRIMARY AIR TANK PRESSURE LOW', '63AQL', 'SC2', '11', 'DI'],
    ['DI0150', 'GOVERNOR MAIN OIL SUPPLY VALVE OPEN', '20QMV', 'SC2', '11', 'DI'],
    ['DI0215', 'SHAFT SEAL MAINTENANCE SEAL APPLIED', '33AMS', 'SC2', '11', 'DI'],
    ['DI0218', 'OVERSPEED PENDULUM RESET', '33-12M', 'SC2', '11', 'DI'],
    ['DI0105', 'MECHANICAL BRAKE RELEASE', '63BR', 'SC2', '11, 21, 22, 36', 'DI'],
    ['DI0245', 'GOVERNOR HP AIR COMPRESSOR READY', '63AQH', 'SC2', '11', 'DI'],
    ['DI0129', 'GOVERNOR FAULT', 'K00', 'SC2', '11', 'DI'],
    ['DI0132', 'GOVERNOR READY FOR START', 'K06', 'SC2', '11', 'DI'],
    ['DI0138', 'REGULATOR REMOTE', 'K14', 'SC2', '11', 'DI'],
    ['DI0078', 'FIELD BREAKER CLOSE', '41', 'SC3', '12, 23, 25', 'DI'],
    ['DI0213', 'TURBINE BEARING OIL LEVEL LOW 1ST', '71QBL1', 'SC3', '12, 13', 'DI'],
    ['DI0212', 'TURBINE BEARING OIL LEVEL LOW 2ND', '71QBL2', 'SC3', '12', 'DI'],
    ['DI0208', 'BRAKE AIR TANK PRESSURE LOW', '63BPF', 'SC3', '12', 'DI'],
    ['DI0113', 'LOCK OUT RELAY 86-1 OPERATE', '86-1', 'SC3', '14, 25', 'DI'],
    ['DI0114', 'LOCK OUT RELAY 86-2 OPERATE', '86-2', 'SC3', '14, 25', 'DI'],
    ['DI0115', 'LOCK OUT RELAY 86-4 OPERATE', '86-4', 'SC3', '14', 'DI'],
    ['DI0086', 'CB 52 REMOTE', '43-52', 'CTL', '15', 'DI'],
    ['DI0083', 'EXCITATION SYSTEM REMOTE', '43-41', 'CTL', '15', 'DI'],
    ['DI0065', '43-90 AUTO (VOLTAGE CONSTANT)', '43-90', 'CTL', '15', 'DI'],
    ['DI0164', 'UNIT CONTROL MODE (43-20) ON', '43-20', 'CTL', '15', 'DI'],
    // STOP → PREPARATION
    ['DO0107', '1AX SET COMMAND', '1AX', 'PRE', '20, Stop_To_Load', 'DO'],
    ['DI0057', '1AX SET', '1AX', 'PRE', '05, 35', 'DI'],
    ['DO0109', 'HIGH PRESSURE OIL PUMP START COMMAND', '88QT', 'PRE', '20, 33, Load_to_Stop', 'DO'],
    ['DI0289', 'MAIN COOLING WATER PUMP A START', '88WC1', 'PRE', 'Stop_To_Load', 'DI', 1],
    ['DI0301', 'MAIN COOLING WATER PUMP B START', '88WC2', 'PRE', 'Stop_To_Load', 'DI', 1],
    ['DI0286', 'GEN. SPACE HEATER STOP', '88SH', 'PRE', '20', 'DI'],
    ['DI0273', 'GOVERNOR PRESSURE OIL PUMP A START', '88QP1', 'PRE', '20', 'DI'],
    ['DI0292', 'GOVERNOR PRESSURE OIL PUMP B START', '88QP2', 'PRE', '20', 'DI'],
    ['DI0250', 'M.TR OIL PUMP-1 START', '88MTR1', 'PRE', '20', 'DI'],
    ['DI0251', 'M.TR OIL PUMP-2 START', '88MTR2', 'PRE', '20', 'DI'],
    ['DI0279', 'HIGH PRESSURE OIL PUMP START', '88QT', 'PRE', '20', 'DI'],
    ['DI0110', 'PRESSURE SWITCH FOR HIGH PRESSURE PUMP', '63QT', 'PRE', '20, 22', 'DI'],
    ['DI0107', 'LOWER GUIDE BEARING WATER FLOW LOW', '', 'PRE', '20', 'DI'],
    ['DI0108', 'AIR COOLER WATER FLOW LOW', '', 'PRE', '20', 'DI'],
    ['DI0109', 'GEN. OIL COOLER WATER FLOW LOW', '', 'PRE', '20', 'DI'],
    ['DI0235', 'TURBINE BEARING WATER FLOW AVAILABLE', '80FB2', 'PRE', '20', 'DI'],
    ['DI0242', 'SHAFT SEAL COOLING WATER AVAILABLE', '', 'PRE', '20', 'DI'],
    ['DI0216', 'SHAFT SEAL WATER PRESSURE AVAILABLE', '', 'PRE', '20', 'DI'],
    // PREPARATION → RUNNING
    ['DO0111', 'MECHANICAL BRAKE APPLY COMMAND', '75', 'RUN', '21, 36', 'DO'],
    ['DO0129', 'INLET VALVE OPEN COMMAND', '', 'RUN', '21', 'DO'],
    ['DI0171', 'BY-PASS VALVE OPEN', '33BPha', 'RUN', '21, Stop_To_Load', 'DI', 1],
    ['DI0173', 'UP/DOWN STREAM PRESSURE BALANCED', '63WC', 'RUN', '21', 'DI', 1],
    ['DI0175', 'OPERATING SEAL RETRACTED', '', 'RUN', 'Stop_To_Load', 'DI', 1],
    ['DI0176', 'OPERATING SEAL FULLY RETRACTED', '', 'RUN', '21', 'DI', 1],
    ['DI0169', 'INLET VALVE OPEN', '33IVha', 'RUN', '21', 'DI'],
    ['DO0112', 'MECHANICAL BRAKE RELEASE COMMAND', '75', 'RUN', '21, 36', 'DO'],
    ['DO0118', 'GOVERNOR START COMMAND', '65S', 'RUN', '22', 'DO'],
    ['DO0120', 'ISO ON FOR REG (isolated network)', '', 'RUN', '22, Stop_To_CH', 'DO'],
    ['DO0121', 'ISO OFF FOR REG', '', 'RUN', '22, Stop_To_CH', 'DO'],
    ['DI0139', 'TURBINE SPEED > 50%', '13-1', 'RUN', '22, Load_to_Stop', 'DI'],
    ['DI0106', 'GEN. OIL COOLER OIL FLOW LOW', '', 'RUN', '22', 'DI'],
    ['DI0143', 'TURBINE COMPLETELY STOP (SPEED = 0%)', '14L', 'RUN', '22, 33', 'DI'],
    ['DO0110', 'HIGH PRESSURE OIL PUMP STOP COMMAND', '88QT', 'RUN', '22, Load_to_Stop', 'DO'],
    // RUNNING → EXCITATION
    ['DO0157', 'EXCITATION ON COMMAND', '', 'EXC', '23', 'DO'],
    ['DI0142', 'TURBINE SPEED > 90%', '13-2', 'EXC', '22, 23, 33', 'DI'],
    ['DI0073', 'GEN. VOLTAGE ESTABLISHED (> 90%)', '84E', 'EXC', '23, 26', 'DI'],
    ['AI0004', 'GENERATOR VOLTAGE', 'kV', 'EXC', '23, 25, 32', 'AI'],
    // EXCITATION → PARALLEL-IN
    ['DO0094', 'AUTOMATIC SYNCHRONIZER START', 'ASS', 'PAR', '24', 'DO'],
    ['DI0064', 'UNIT ASS USE (dibaca unit lain)', 'ASS', 'PAR', '24', 'DI'],
    ['DI0090', 'CB 52 CLOSE', '52', 'PAR', '24, 26, 30–31, 50', 'DI'],
    // PARALLEL-IN → LOAD
    ['DO0126', 'POWER CONTROL ON (POC)', '', 'LOD', '27', 'DO'],
    ['DO0101', '7-65 RAISE (LOAD RAISE)', '7-65', 'LOD', '27', 'DO'],
    ['AI0005', 'GENERATOR ACTIVE POWER', 'MW', 'LOD', '27, 30', 'AI'],
    // LOAD → STOP
    ['DO0102', '7-65 LOWER (NO LOAD CONTROL)', '7-65', 'STP', '30', 'DO'],
    ['DO0097', '7-90/70 RAISE (Q = 0 CONTROL)', '7-90/70', 'STP', '30', 'DO'],
    ['DO0098', '7-90/70 LOWER (Q = 0 / CH VOLTAGE LOWER)', '7-90/70', 'STP', '30, Stop_To_CH', 'DO'],
    ['DI0206', 'GUIDE VANE NO LOAD OPENING', '74mb', 'STP', '30', 'DI'],
    ['AI0006', 'GENERATOR REACTIVE POWER', 'MVar', 'STP', '30', 'AI'],
    ['DO0106', '52 OPEN COMMAND', '52', 'STP', '31, 50', 'DO'],
    ['DO0158', 'EXCITATION OFF COMMAND', '', 'STP', '32', 'DO'],
    ['DO0119', 'GOVERNOR STOP COMMAND', '65T', 'STP', '33', 'DO'],
    ['DO0130', 'INLET VALVE CLOSE COMMAND', '', 'STP', '34, Load_to_Stop', 'DO'],
    ['DI0140', 'TURBINE SPEED < 20%', '14-2', 'STP', '36, Load_to_Stop', 'DI'],
    ['DI0141', 'TURBINE SPEED < 5%', '', 'STP', 'Load_to_Stop', 'DI', 1],
    ['DO0153', 'VACUUM CLEANER START', '', 'STP', 'Load_to_Stop', 'DO'],
    ['DI0174', 'OPERATING SEAL APPLIED', '', 'STP', '34', 'DI'],
    ['DO0108', '1AX RESET COMMAND', '1AX', 'STP', '35', 'DO'],
    ['DI0058', '1AX RESET', '1AX', 'STP', '35', 'DI'],
    ['DI0285', 'GEN. SPACE HEATER START', '88SH', 'STP', '35', 'DI'],
    ['DO0154', 'VACUUM CLEANER STOP', '', 'STP', 'Load_to_Stop', 'DO'],
    // LINE CHARGING
    ['DO0095', '43CHX USE SELECT', '43CH', 'CH', '06, Stop_To_CH', 'DO'],
    ['DO0096', '43CHX LOCK SELECT', '43CH', 'CH', '06', 'DO'],
    ['DI0055', '43CHX USE', '43CH', 'CH', '05, 06, 22, 24–26', 'DI'],
    ['DI0056', '43CHX LOCK', '43CH', 'CH', '06', 'DI', 1],
    ['DO0100', '43-90 MANUAL (EXCITATION MANUAL MODE)', '43-90', 'CH', 'Stop_To_CH', 'DO'],
    ['DI0066', '43-90 MANUAL (FIELD CONSTANT)', '43-90', 'CH', '25', 'DI'],
    ['DI0074', 'EXCITATION LINE CHARGE MODE', 'AVRCH', 'CH', '25', 'DI'],
    ['DO0105', '52 CLOSE COMMAND', '52', 'CH', '26, 50', 'DO'],
    ['DO0099', '43-90 AUTO (AVR AUTO)', '43-90', 'CH', 'Stop_To_CH', 'DO'],
  ];
  const SYT = { 1: ['6DI0161', '6DI0163', '6DI0165'], 2: ['6DI0177', '6DI0179', '6DI0181'], 3: ['6DI0209', '6DI0211', '6DI0213'] };
  function tagOf(id, n) {
    if (id === '6DI152') return SYT[n][0]; if (id === '6DI189A') return SYT[n][1]; if (id === '6DI189B') return SYT[n][2];
    return n + id;
  }
  function catalog(n) {
    return CAT.map(([id, name, dev, grp, sh, type, ind]) => ({ id, tag: tagOf(id, n), name, dev, grp, gname: G[grp], sh, type, ind: !!ind }));
  }
  const MODES = { off: 'PAKSA 0 (OFF)', on: 'PAKSA 1 (ON)', inv: 'TERBALIK', dly: 'TERLAMBAT', hold: 'BEKU', set: 'PAKSA NILAI' };
  const typeOf = (tag) => (/AI\d{4}$/.test(tag) ? 'AI' : /DO\d{4}$/.test(tag) ? 'DO' : 'DI');
  function modeText(tag, f) {
    if (!f) return '';
    const t = typeOf(tag);
    if (t === 'DO') return f.mode === 'off' ? 'TIDAK KELUAR' : `TERLAMBAT ${f.sec} s`;
    if (t === 'AI') return f.mode === 'hold' ? `BEKU ${f.v === undefined ? '' : (+f.v).toFixed(1)}` : `PAKSA ${(+f.v).toFixed(1)}`;
    return f.mode === 'dly' ? `TERLAMBAT ${f.sec} s` : MODES[f.mode];
  }

  /* ---- skenario cepat ---- */
  const PRESETS = [
    { k: 'cbo', g: 'DI', t: 'CB 52 OPEN tidak terbaca (DI0091 = 0)', set: [['DI0091', 'off']],
      e: 'Unit STOP: STARTING CONDITION-1 NG → start ditolak. Unit LOAD lalu STOP: 52 membuka tetapi PARALLEL-IN STEP END tidak datang → 10 s → SEQUENCE MONITOR ERROR (SH.31) + alarm status CB (SH.50).' },
    { k: 'cbc', g: 'DI', t: 'CB 52 CLOSE tidak terbaca (DI0090 = 0)', set: [['DI0090', 'off']],
      e: 'Start: 52 masuk (sinkron) tetapi PARALLEL-IN STEP COMPLETION tidak datang → 120 s → SEQUENCE MONITOR ERROR (SH.24).' },
    { k: 'ivo', g: 'DI', t: 'INLET VALVE OPEN tidak datang (DI0169 = 0)', set: [['DI0169', 'off']],
      e: 'Start: inlet valve terbuka penuh tetapi LCU tidak menerima 33IVha → brake tidak dilepas, governor tidak start → timer RUNNING 240 s → SEQUENCE MONITOR ERROR (SH.21–22).' },
    { k: 'seal', g: 'DI', t: 'OPERATING SEAL (FULLY) RETRACTED tidak terbaca (DI0175/0176 = 0)', set: [['DI0175', 'off'], ['DI0176', 'off']],
      e: 'Hanya indikasi di OPS: interlock buka inlet valve dijalankan kontrol inlet valve (LOT IIIA, SH.21), bukan LCU → inlet valve tetap membuka dan sekuens lanjut. Bandingkan dengan gangguan peralatan di SKENARIO/INIT.' },
    { k: 'fcb', g: 'DI', t: 'FIELD BREAKER CLOSE tidak datang (DI0078 = 0)', set: [['DI0078', 'off']],
      e: 'Start: eksitasi menyala tetapi 41 CLOSE tidak terbaca → EXCITATION STEP COMPLETION tidak datang → 60 s → SEQUENCE MONITOR ERROR (SH.23).' },
    { k: 'gvc', g: 'DI', t: 'GUIDE VANE CLOSED tidak terbaca (DI0205 = 0)', set: [['DI0205', 'off']],
      e: 'Unit STOP: STARTING CONDITION-2 NG. Unit LOAD lalu STOP: DO0130 INLET VALVE CLOSE tidak keluar (menunggu GV closed, Load_to_Stop) → step RUNNING stop tertahan → SEQUENCE MONITOR ERROR.' },
    { k: 'n20', g: 'DI', t: 'TURBINE SPEED < 20 % tidak datang (DI0140 = 0)', set: [['DI0140', 'off']],
      e: 'Stop: DO0111 brake apply dan vacuum cleaner tidak keluar (SH.36) → unit berhenti tanpa rem (coast down jauh lebih lama). Step STOP baru dimulai setelah 14LT (tanpa timer), jadi sekuens tertahan di PREPARATION tanpa SEQUENCE MONITOR ERROR.' },
    { k: 'ax57', g: 'DI', t: '1AX SET tidak terbaca (DI0057 = 0)', set: [['DI0057', 'off']],
      e: 'Stop: syarat SH.35 (1AX ON) tidak terpenuhi → DO0108 1AX RESET tidak keluar → 1AX RESET (DI0058) tidak datang → 10 s → SEQUENCE MONITOR ERROR step STOP.' },
    { k: 'ass', g: 'DI', t: 'ASS unit ini terbaca USE (DI0064 = 1)', set: [['DI0064', 'on']],
      e: 'Unit LAIN yang di-start berhenti di step EXCITATION: PARALLEL-IN tidak dimulai karena LCU membaca synchronizer unit ini sedang dipakai (SH.24). Tidak ada timer – sekuens menunggu.' },
    { k: 'gov', g: 'DI', t: 'GOVERNOR READY FOR START hilang (DI0132 = 0)', set: [['DI0132', 'off']],
      e: 'Unit STOP: STARTING CONDITION-2 NG → start ditolak.' },
    { k: 'do129', g: 'DO', t: 'INLET VALVE OPEN COMMAND tidak keluar (DO0129)', set: [['DO0129', 'off']],
      e: 'Start: output tidak sampai ke kontrol inlet valve → valve tetap tertutup → RUNNING 240 s → SEQUENCE MONITOR ERROR. Begitu DO normal, perintah keluar dan sekuens lanjut.' },
    { k: 'do157', g: 'DO', t: 'EXCITATION ON COMMAND terlambat 90 s (DO0157)', set: [['DO0157', 'dly', 90]],
      e: 'Start: eksitasi baru menyala 90 s setelah step EXCITATION dimulai → timer 60 s habis → SEQUENCE MONITOR ERROR; setelah itu sekuens tetap lanjut.' },
    { k: 'do106', g: 'DO', t: '52 OPEN COMMAND tidak keluar (DO0106)', set: [['DO0106', 'off']],
      e: 'Unit LOAD lalu STOP: no-load & Q = 0 tercapai, tetapi 52 tidak membuka → PARALLEL-IN STEP END tidak datang → 10 s → SEQUENCE MONITOR ERROR (SH.31). Unit tetap paralel tanpa beban.' },
    { k: 'do108', g: 'DO', t: '1AX RESET COMMAND tidak keluar (DO0108)', set: [['DO0108', 'off']],
      e: 'Stop: pompa bantu & pendingin tetap jalan, space heater tidak start → 1AX RESET (DI0058) tidak datang → SEQUENCE MONITOR ERROR step STOP.' },
    { k: 'ai5', g: 'AI', t: 'Daya aktif terbaca 0 MW (AI0005 = 0)', set: [['AI0005', 'set', 0]],
      e: 'Start: unit sudah paralel dan berbeban tetapi 91P (> 3.5 MW 5 s) tidak terpenuhi → LOAD STEP COMPLETION tidak datang → 60 s → SEQUENCE MONITOR ERROR (SH.27).' },
    { k: 'ai6', g: 'AI', t: 'Daya reaktif terbaca 10 MVar (AI0006 = 10)', set: [['AI0006', 'set', 10]],
      e: 'Unit LOAD lalu STOP: syarat −3 < Q < 3 MVar (SH.30) tidak terpenuhi → 52 tidak dibuka → 120 s → SEQUENCE MONITOR ERROR step PARALLEL-IN.' },
    { k: 'ch74', g: 'CH', t: 'CH: AVR LINE CHARGE MODE tidak terbaca (DI0074 = 0)', set: [['DI0074', 'off']],
      e: 'Line charging: tegangan sudah < 3.3 kV, tetapi EXCITATION STEP COMPLETION (CH) tidak datang (SH.25) → timer EXCITATION (CH) habis → SEQUENCE MONITOR ERROR.' },
    { k: 'ch66', g: 'CH', t: 'CH: 43-90 MANUAL tidak terbaca (DI0066 = 0)', set: [['DI0066', 'off']],
      e: 'Line charging: AVR sudah manual, tetapi LCU tidak menerima 43-90 MANUAL → EXCITATION STEP COMPLETION (CH) tidak datang → timer habis → SEQUENCE MONITOR ERROR.' },
    { k: 'ch105', g: 'CH', t: 'CH: 52 CLOSE COMMAND tidak keluar (DO0105)', set: [['DO0105', 'off']],
      e: 'Line charging: CLOSE CONDITION (CH) terpenuhi (SH.26) tetapi 52 tidak masuk → LINE CHARGE COMPLETION tidak datang → timer PARALLEL-IN (CH) habis → SEQUENCE MONITOR ERROR.' },
    { k: 'ch55', g: 'CH', t: 'CH: 43CHX USE tidak terbaca (DI0055 = 0)', set: [['DI0055', 'off']],
      e: '43CH sudah USE di ULCB/AVR, tetapi LCU membaca LOCK → sekuens berjalan di jalur normal: PARALLEL-IN menunggu jaringan & synchronizer (bus mati), line charge tidak terjadi.' },
  ];

  class SeqFault {
    constructor(plant) { this.plant = plant; this.flt = {}; this.raw = {}; this.lcu = {}; }
    read(tag, phys) {
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
    readA(tag, phys) {
      this.raw[tag] = phys;
      const f = this.flt[tag]; let v = phys;
      if (f) { if (f.v === undefined) f.v = phys; v = f.v; }
      this.lcu[tag] = v; return v;
    }
    set(tag, mode, arg) {
      if (!mode) { if (this.flt[tag]) { delete this.flt[tag]; this.plant.log('CMD', `SEQ FAULT ${tag} NORMAL`); } return; }
      const f = { mode };
      if (mode === 'dly') f.sec = Math.max(1, +arg || 10);
      if (mode === 'set') f.v = +arg || 0;
      this.flt[tag] = f;
      this.plant.log('CMD', `SEQ FAULT ${tag} → ${modeText(tag, f)}`);
    }
    clearUnit(n) { this.unitTags(n).forEach((t) => this.set(t, null)); }
    clearAll() { Object.keys(this.flt).forEach((t) => this.set(t, null)); }
    preset(k, n) {
      const p = PRESETS.find((x) => x.k === k); if (!p) return;
      this.clearUnit(n);
      p.set.forEach(([id, mode, arg]) => this.set(tagOf(id, n), mode, arg));
      this.plant.log('INFO', `SEQ FAULT U${n}: skenario "${p.t}"`);
    }
    unitTags(n) { const c = catalog(n); return Object.keys(this.flt).filter((t) => c.some((x) => x.tag === t)); }
  }

  // semua I/O sekuens dievaluasi setiap tick (nilai DI/AI LCU & mode "terlambat" selalu terbarui)
  function evalAll(u) {
    const p = u.p, sw = u.sw;
    u.sc1(); u.sc2(); u.sc3(); u.ctrlList();
    for (let k = 1; k <= 5; k++) u.condStart(k);
    for (let k = 0; k <= 4; k++) u.condStop(k);
    u.d('DI0057', p.ax); u.d('DI0058', !p.ax); u.d('DI0064', p.sync);
    u.d('DI0139', u.s13_1()); u.d('DI0140', u.s14_2()); u.d('DI0141', p.speed < 0.05); u.d('DI0143', u.s14L());
    u.d('DI0171', p.bypass > 0.995); u.d('DI0173', p.dp < 0.05); u.d('DI0175', p.seal < 0.5); u.d('DI0176', p.seal < 0.02);
    u.d('DI0289', p.cw[0].run); u.d('DI0301', p.cw[1].run);
    u.chUse(); u.d('DI0056', sw.s43CH === 'LOCK'); u.d('DI0066', sw.AVR === 'MANUAL'); u.d('DI0074', sw.s43CH === 'USE');
    u.a('AI0004', u.kV()); u.a('AI0005', p.p); u.a('AI0006', p.q);
    u.cbDisc = u.d('DI0090', p.cb) === u.d('DI0091', !p.cb);
  }

  /* ---- sub-langkah transisi aktif (Stop_To_Load, Load_to_Stop, Stop_To_CH) – untuk diagnosa ---- */
  function substeps(u) {
    const tr = u.tr; if (!tr) return null;
    const p = u.p, S = u.plant.seqf, n = u.n, ch = u.chUse();
    const L = (tag) => S.lcu[n + tag];
    const V = (tag) => S.lcu[n + tag] || 0;
    const D = (tag) => !!u.do[tag] && !u.doPend[tag];
    const r = [];
    const add = (lab, tag, done, note) => r.push({ lab, tag, done: !!done, pend: tag && /^DO/.test(tag) ? !!u.doPend[tag] : false, note });
    if (tr.dir > 0) {
      switch (tr.to) {
        case 1: add('1AX SET COMMAND', 'DO0107', p.ax); add('1AX SET', 'DI0057', L('DI0057'));
          add('Cooling water pump A/B started', 'DI0289', L('DI0289') || L('DI0301'), 'indikasi');
          add('HIGH PRESSURE OIL PUMP START COMMAND', 'DO0109', p.qtCmd); add('HIGH PRESSURE OIL PUMP START', 'DI0279', L('DI0279'));
          add('PRESSURE SWITCH FOR HIGH PRESSURE PUMP', 'DI0110', L('DI0110')); add('SHAFT SEAL WATER PRESSURE AVAILABLE', 'DI0216', L('DI0216'));
          add('GEN. SPACE HEATER STOP', 'DI0286', L('DI0286')); break;
        case 2: add('MECHANICAL BRAKE APPLY COMMAND', 'DO0111', p.brake > 0.99 || tr.sub > 0); add('INLET VALVE OPEN COMMAND', 'DO0129', p.ivCmd === 'open');
          add('BY-PASS VALVE OPEN', 'DI0171', L('DI0171') || p.iv > 0.995, 'indikasi'); add('UP/DOWN STREAM PRESSURE BALANCED', 'DI0173', L('DI0173') || p.iv > 0.995, 'indikasi');
          add('OPERATING SEAL RETRACTED', 'DI0175', L('DI0175'), 'indikasi'); add('OPERATING SEAL FULLY RETRACTED', 'DI0176', L('DI0176'), 'indikasi');
          add('INLET VALVE OPEN', 'DI0169', L('DI0169')); add('BY-PASS VALVE CLOSE', 'DI0170', L('DI0170') && tr.sub >= 1);
          add('MECHANICAL BRAKE RELEASE COMMAND', 'DO0112', tr.sub >= 2); add('MECHANICAL BRAKE RELEASE', 'DI0105', L('DI0105') && tr.sub >= 2);
          add('GOVERNOR START COMMAND', 'DO0118', p.govOn);
          add(ch || !u.gridOK() ? 'ISO ON FOR REG' : 'ISO OFF FOR REG', ch || !u.gridOK() ? 'DO0120' : 'DO0121', p.govOn);
          add('TURBINE SPEED > 50%', 'DI0139', L('DI0139')); add('TURBINE SPEED > 90%', 'DI0142', L('DI0142'));
          add('HIGH PRESSURE OIL PUMP STOP COMMAND', 'DO0110', tr.sub >= 4); break;
        case 3: add('EXCITATION ON COMMAND', 'DO0157', p.excOn); add('FIELD BREAKER CLOSE', 'DI0078', L('DI0078')); add('GEN. VOLTAGE ESTABLISHED (> 90%)', 'DI0073', L('DI0073') || p.lc);
          if (ch) {
            add('LINE CHARGE CONTROL MODE ON (+30 s)', null, p.lc, `t = ${Math.round(tr.e30 || 0)} s`);
            add('43-90 MANUAL (EXCITATION MANUAL MODE)', 'DO0100', u.sw.AVR === 'MANUAL'); add('43-90 MANUAL (FIELD CONSTANT)', 'DI0066', L('DI0066'));
            add('7-90/70 LOWER (GEN. VOLTAGE LOWER)', 'DO0098', p.chLower || (tr.v5 || 0) > 0);
            add('GENERATOR VOLTAGE < 3.3 kV (5 s)', 'AI0004', (tr.v5 || 0) >= 5, `${V('AI0004').toFixed(1)} kV`);
            add('EXCITATION LINE CHARGE MODE (AVRCH USE)', 'DI0074', L('DI0074'));
          } break;
        case 4: if (ch) {
          add('CLOSE CONDITION (CH): 52 OPEN', 'DI0091', p.cb || L('DI0091')); add('52 CLOSE COMMAND (tanpa synchronizer)', 'DO0105', p.cb);
          add('CB 52 CLOSE → LINE CHARGE COMPLETION(1)', 'DI0090', L('DI0090')); add('Operator: 90R RAISE tegangan', null, p.cb && p.vt > 0.9, `${u.kV().toFixed(1)} kV`);
          add('GEN. VOLTAGE > 90% → LINE CHARGE COMPLETION(2)', 'DI0073', L('DI0073') && p.cb);
        } else {
          add('ASS unit lain tidak dipakai', 'DI0064', !u.plant.units.some((x) => x !== u && S.lcu[x.n + 'DI0064']));
          add('AUTOMATIC SYNCHRONIZER START', 'DO0094', p.sync || p.cb); add('CB 52 CLOSE', 'DI0090', L('DI0090'));
        } break;
        case 5: if (ch) add('43CH LOCK (setelah sinkron di sisi lawan)', 'DI0055', !L('DI0055'));
          add('POWER CONTROL ON (POC)', 'DO0126', D('DO0126')); add('7-65 RAISE (LOAD RAISE)', 'DO0101', p.loadRaise || D('DO0101'));
          add('GENERATOR POWER > 3.5 MW (5 s)', 'AI0005', (tr.p5 || 0) >= 5, `${V('AI0005').toFixed(1)} MW`); break;
      }
    } else {
      switch (tr.to) {
        case 4: add('7-65 LOWER (NO LOAD CONTROL)', 'DO0102', p.noLoad); add(`7-90/70 ${u.do.DO0097 ? 'RAISE' : 'LOWER'} (Q = 0)`, u.do.DO0097 ? 'DO0097' : 'DO0098', p.qZero);
          add('GUIDE VANE NO LOAD OPENING  atau  P < 4 MW', 'DI0206', L('DI0206') || V('AI0005') < 4, `${V('AI0005').toFixed(1)} MW`);
          add('−3 MVar < Q < 3 MVar', 'AI0006', Math.abs(V('AI0006')) < 3, `${V('AI0006').toFixed(1)} MVar`); break;
        case 3: add('52 OPEN COMMAND', 'DO0106', !p.cb); add('CB 52 OPEN', 'DI0091', L('DI0091')); break;
        case 2: add('EXCITATION OFF COMMAND', 'DO0158', !p.excOn); add('FIELD BREAKER OPEN', 'DI0079', L('DI0079'));
          add('GENERATOR VOLTAGE < 60 %', 'AI0004', V('AI0004') < 6.6, `${V('AI0004').toFixed(1)} kV`); break;
        case 1: add('GOVERNOR STOP COMMAND', 'DO0119', !p.govOn); add('GUIDE VANE CLOSED', 'DI0205', L('DI0205'));
          add('INLET VALVE CLOSE COMMAND', 'DO0130', p.ivCmd === 'close'); add('TURBINE SPEED < 90%', 'DI0142', !L('DI0142'));
          add('n < 50 % → HIGH PRESSURE OIL PUMP START', 'DO0109', p.qtCmd || p.speed < 0.005); add('TURBINE SPEED < 20%', 'DI0140', L('DI0140'));
          add('MECHANICAL BRAKE APPLY + VACUUM CLEANER START', 'DO0111', p.brakeCmd === 'apply' || p.speed < 0.005); add('TURBINE SPEED < 5%', 'DI0141', L('DI0141'), 'indikasi');
          add('INLET VALVE CLOSE', 'DI0168', L('DI0168')); add('BY-PASS VALVE CLOSE', 'DI0170', L('DI0170')); add('OPERATING SEAL APPLIED', 'DI0174', L('DI0174')); break;
        case 0: add('TURBINE COMPLETELY STOP (14L) + 20 s (14LT)', 'DI0143', u.s14LT()); add('1AX SET (syarat reset)', 'DI0057', L('DI0057') || !p.ax);
          add('1AX RESET COMMAND', 'DO0108', tr.started && !p.ax); add('1AX RESET', 'DI0058', tr.started && L('DI0058'));
          add('HIGH PRESSURE OIL PUMP STOP COMMAND', 'DO0110', tr.started && !p.qtCmd);
          add('GEN. SPACE HEATER START', 'DI0285', tr.started && L('DI0285')); add('MECHANICAL BRAKE RELEASE COMMAND (+ vacuum cleaner stop 1 min)', 'DO0112', tr.started && p.brakeCmd === 'release'); break;
      }
    }
    const act = r.findIndex((x) => !x.done); if (act >= 0) r[act].act = true;
    return r;
  }

  /* ---- operasi pendukung latihan LINE CHARGING ---- */
  function remoteSync(plant) {
    const sy = plant.sy;
    const L = ['L1', 'L2'].find((x) => sy.st['152-' + x] && sy.st['189-' + x] && !sy.lineOK[x]);
    if (!L) return 'Tidak ada T/L mati yang tersambung ke bus (152-L & 189-L harus CLOSE, sisi GI belum bertegangan).';
    const u = plant.units.find((x) => x.sw.s43CH === 'USE' && x.p.cb && x.p.vt > 0.9 && sy.st['152-U' + x.n] && sy.unitBus(x.n));
    if (!u) return 'Belum ada unit LINE CHARGING dengan 52 CLOSE dan tegangan > 90 % ke bus 150 kV.';
    sy.lineOK[L] = true;
    plant.log('OK', `GI NEW CURUP: T/L ${L} SINKRON DI SISI LAWAN – unit ${u.n} tersambung ke sistem`);
    return null;
  }
  function prepCH(plant) {
    plant.initAllStop();
    if (!plant.fx.tl_both) plant.inject('tl_both');
    plant.chAux = true;
    plant.log('INFO', 'Latihan LINE CHARGING: semua unit STOP, kedua T/L trip (bus 150 kV mati); catu bantu unit dianggap tersedia dari sumber darurat (asumsi). Langkah: 43CH USE → 43S-CS PARALLEL-IN.');
  }

  EXT.push({
    build(plant) { plant.seqf = new SeqFault(plant); plant.chAux = false; },
    clear(plant) { if (plant.seqf) plant.seqf.clearAll(); },
    tick(plant) { plant.units.forEach(evalAll); },
    points(plant) {
      // JEZ1L675 SH.50: 52 OPEN dan 52 CLOSE tidak saling berlawanan selama 10 s → CRT ALM_0002
      return plant.units.map((u) => ({ grp: 'U' + u.n, win: 'B1', tag: `${u.n}ALM0002`, text: 'UNIT CB (52) OPEN/CLOSED STATUS DISCREPANCY', lvl: 'H', cond: () => !!u.cbDisc, delay: 10 }));
    },
  });

  const API = { CAT, G, PRESETS, MODES, catalog, tagOf, typeOf, modeText, SeqFault, evalAll, substeps, remoteSync, prepCH };
  M.SEQF = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.MUSI_SEQF = API;
})(typeof window !== 'undefined' ? window : globalThis);
