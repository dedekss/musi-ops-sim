/**
 * MUSI HEPP – Plant Simulator v2 (3 unit + 150 kV switchyard + proteksi)
 *
 * Acuan (prioritas): layar HMI operator OPS01 → block diagram as-built JEZ1L675/JEZ1L699
 * → flowchart Mitsubishi A7166C-A. Model dinamik disederhanakan (per-unit) dan
 * dikalibrasi dengan data operasi di layar (GV–MW tabel OPC, 500 rpm, 10.9 kV, dll).
 *
 * Konvensi:  step index 0..5 = STOP, PREPARATION, RUNNING, EXCITATION, PARALLEL-IN, LOAD.
 *            Transisi ke step k (arah start) selesai bila "kondisi masuk" step k terpenuhi
 *            (sesuai kotak kondisi di layar SEQ. MONITOR STOP TO LOAD / LOAD TO STOP);
 *            timer preset ditampilkan di samping tombol step tujuan.
 */
(function (root) {
  'use strict';

  /* ===================================================================== */
  /*  KONSTANTA                                                            */
  /* ===================================================================== */
  const STEP = ['STOP', 'PREPARATION', 'RUNNING', 'EXCITATION', 'PARALLEL-IN', 'LOAD'];
  const START_T = [null, 60, 240, 60, 120, 60];   // timer masuk step k (arah start)
  const STOP_T = [10, 270, 10, 10, 120, null];      // timer masuk step k (arah stop)
  const PR = 70;           // MW rating unit
  const RPM = 500;         // putaran nominal
  const VKV = 11.0;        // kV nominal generator
  // tabel OPC (Control Detail): bukaan GV (%) → daya (MW) pada head normal
  const GV_MW = [[0, -1.2], [5, -0.6], [11.5, 0], [20, 6], [30, 13], [40, 20], [50, 30], [60, 40], [70, 52], [80, 63], [90, 74], [100, 82]];
  const GV_NL = 11.5;      // bukaan no-load (74mb)

  const lag = (x, t, tau, dt) => x + (t - x) * Math.min(1, dt / tau);
  const rate = (x, t, r, dt) => { const d = t - x, m = r * dt; return Math.abs(d) <= m ? t : x + Math.sign(d) * m; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const interp = (tbl, x) => {
    if (x <= tbl[0][0]) return tbl[0][1];
    for (let i = 1; i < tbl.length; i++) if (x <= tbl[i][0]) {
      const [x0, y0] = tbl[i - 1], [x1, y1] = tbl[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
    return tbl[tbl.length - 1][1];
  };
  const invInterp = (tbl, y) => {
    for (let i = 1; i < tbl.length; i++) if (y <= tbl[i][1]) {
      const [x0, y0] = tbl[i - 1], [x1, y1] = tbl[i]; return x0 + (x1 - x0) * (y - y0) / (y1 - y0);
    }
    return 100;
  };
  const f1 = (v, d = 1) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d));
  const noise = (a) => (Math.random() - 0.5) * 2 * a;
  const pump = (name) => ({ name, cmd: false, run: false, t: 0, fail: false });
  // volume waduk intake (JEZ2K041 SH.003)  [m3]
  const volIntake = (x) => (189.475 * x * x - 218232.925 * x + 62839304.175) * 1000;

  /* ===================================================================== */
  /*  DAFTAR SKENARIO GANGGUAN (instruktur)                                */
  /* ===================================================================== */
  // src: 'data' = tercantum di dokumen/annunciator; 'asumsi' = pemetaan tipikal yang perlu diverifikasi
  const SCENARIOS = [
    // ---------------- gangguan saat unit beroperasi ----------------
    { key: 'cw_main_trip', grp: 'OPERASI – PENDINGIN', name: 'Pompa air pendingin utama trip (auto change-over)', unit: true,
      cause: 'Pompa main cooling water (88WC) yang sedang jalan trip (MCC).',
      chain: 'E2 MCC alarm → pompa standby start otomatis 3 s → aliran sempat turun (alarm C-window singkat) → normal.',
      prot: 'Tidak trip (alarm saja).', src: 'data', act: 'ACK alarm, periksa pompa yang trip, pastikan standby running.' },
    { key: 'cw_both_fail', grp: 'OPERASI – PENDINGIN', name: 'Kedua pompa air pendingin gagal', unit: true,
      cause: 'Main & standby cooling water pump tidak tersedia.',
      chain: 'Aliran air turun → TURBINE BEARING WATER FLOW LOW (DI0236) & SHAFT SEAL COOLING WATER FLOW LOW (DI0240) selama 2 menit → 86-5 → unload → stop normal. Proteksi aktif 30 s setelah pompa CW start dan di-reset 14L, jadi saat unit diam (PREPARATION) tidak trip – start tertahan di INLET VALVE (water flow available OFF).',
      prot: '86-5 DAMAGE PREVENTIVE STOP', src: 'data JEZ2K031 SH.003', act: 'Pulihkan pompa dalam 2 menit untuk mencegah trip; reset 86-5 setelah standstill.' },
    { key: 'ss_cool_low', grp: 'OPERASI – PENDINGIN', name: 'Shaft seal cooling water flow low', unit: true,
      cause: 'Strainer/filter air seal tersumbat.',
      chain: 'D7 SHAFT SEAL alarm → 2 menit → 86-5 → stop normal.', prot: '86-5', src: 'data JEZ2K031 SH.003', act: 'Back-flush strainer dalam 2 menit; reset 86-5.' },
    { key: 'lgb_water_low', grp: 'OPERASI – PENDINGIN', name: 'Lower guide bearing water flow low', unit: true,
      cause: 'Katup/strainer jalur air LGB tersumbat.',
      chain: 'C1 LOWER GUIDE BEARING water flow alarm; suhu LGB naik perlahan → TEMP. HIGH 1ST (DI0099) → 86-5. Bila tetap naik → HIGH 2ND (DI0182) → 86-2.', prot: 'Alarm → 86-5 (1ST) → 86-2 (2ND)', src: 'data JEZ2K031 SH.001/003 · setpoint asumsi', act: 'Turunkan beban, pulihkan aliran sebelum suhu 1ST.' },
    { key: 'thrust_temp', grp: 'OPERASI – BEARING & VIBRASI', name: 'Suhu thrust bearing naik (kontaminasi oli)', unit: true,
      cause: 'Kualitas oli thrust bearing turun.',
      chain: 'C4 THRUST BEARING TEMP. HIGH 1ST (DI0097, 70 °C) → 86-5 (unload, stop normal). Suhu terus naik → HIGH 2ND (DI0183, 75 °C, thermo-meter panel) → 86-2 quick stop.', prot: '86-5 → 86-2', src: 'data JEZ2K031 SH.001/003 · setpoint asumsi', act: 'Kurangi beban, siapkan stop, analisa oli.' },
    { key: 'tgb_vib', grp: 'OPERASI – BEARING & VIBRASI', name: 'Shaft run-out turbine guide meningkat', unit: true,
      cause: 'Ketidakseimbangan / keausan bearing turbine guide.',
      chain: 'E1 VIBRATION: run-out alarm (150 µm) → run-out trip (200 µm) → 86-5 → stop normal.', prot: '86-5', src: 'data (setpoint asumsi)', act: 'Pantau Vibration Monitor, turunkan beban.' },
    { key: 'brg_oil_low', grp: 'OPERASI – BEARING & VIBRASI', name: 'Oil level lower guide bearing rendah', unit: true,
      cause: 'Kebocoran oli bak LGB.',
      chain: 'LOWER GUIDE BEARING OIL LEVEL LOW (DI0101) AND TURBINE SPEED > 90 % (DI0142) → 86-5. Saat unit diam: hanya alarm & STARTING CONDITION-1 OFF.',
      prot: '86-5 (saat n > 90 %)', src: 'data JEZ2K031 SH.003', act: 'Tambah oli, cari kebocoran.' },
    { key: 'tgb_oil_low', grp: 'OPERASI – BEARING & VIBRASI', name: 'Oil level turbine guide bearing turun', unit: true,
      cause: 'Kebocoran oli bak turbine guide bearing.',
      chain: 'TURBINE GUIDE BEARING OIL LEVEL LOW (DI0213) → 86-5; level terus turun → LOW 2ND (DI0212) → 86-2.',
      prot: '86-5 → 86-2', src: 'data JEZ2K031 SH.002/003', act: 'Tambah oli, cari kebocoran.' },
    { key: 'gov_pump_trip', grp: 'OPERASI – GOVERNOR', name: 'Pompa oli governor utama trip', unit: true,
      cause: 'Pompa 88QP utama trip.', chain: 'E2 MCC alarm → pompa standby start otomatis → tekanan pulih.',
      prot: 'Tidak trip.', src: 'data', act: 'ACK, periksa pompa.' },
    { key: 'gov_oil_leak', grp: 'OPERASI – GOVERNOR', name: 'Kebocoran oli tekanan governor', unit: true,
      cause: 'Kebocoran pipa tekanan / pompa tidak mampu mengimbangi.',
      chain: 'GOV OIL SYSTEM PRESSURE LOW 1ST (DI0159) → 86-5. Bila terus turun → GOV SUMP TANK OIL PRESSURE LOW 2ND (DI0155) → 86-2 quick stop. Level tangki tekanan turun → LOW 1ST (DI0203, 86-5) / 2ND (DI0204, 86-2).',
      prot: '86-5, lalu 86-2', src: 'data JEZ2K031 SH.002/003', act: 'Isolasi kebocoran, pantau stop unit.' },
    { key: 'gov_fault', grp: 'OPERASI – GOVERNOR', name: 'Digital governor fault', unit: true,
      cause: 'Kegagalan kontroler governor digital (K00).',
      chain: 'REG: GOVERNOR FAULT (DI0129) → 86-2 → turbine & IV quick shutdown, 52 trip saat GV no-load, stop. Selama fault, starting condition GOVERNOR CONTROLLER FAULT memblok start.',
      prot: '86-2', src: 'data JEZ2K031 SH.002', act: 'Periksa governor, hapus fault, reset 86-2.' },
    { key: 'gov_sump_temp', grp: 'OPERASI – GOVERNOR', name: 'Suhu oli sump governor naik', unit: true,
      cause: 'Pendingin oli governor kotor.',
      chain: 'GOV. SUMP TANK OIL TEMP. HIGH 1ST (DI0151, 60 °C) → 86-5 → stop normal; suhu terus naik → HIGH 2ND (DI0152, 65 °C) → 86-2.',
      prot: '86-5 → 86-2', src: 'data JEZ2K031 SH.002/003 · setpoint asumsi', act: 'Periksa cooler oli governor.' },
    { key: 'gov_runaway', grp: 'OPERASI – GOVERNOR', name: 'Load rejection + servo guide vane macet', unit: true,
      cause: '52 trip saat beban penuh dan servo guide vane tidak menutup (macet mekanik, tidak terdeteksi governor).',
      chain: 'Kecepatan naik → OVER SPEED (ELECTRICAL) DI0130 140 % → 86-2 → TURBINE QUICK SHUTDOWN (20SD) menutup GV. Bila tetap naik → OVER SPEED (MECHANICAL) 33-12M DI0217 145 %.',
      prot: '86-2 QUICK STOP', src: 'data JEZ2K031 SH.002 · setpoint asumsi', act: 'Pastikan GV & IV menutup; reset pendulum 33-12M manual.' },
    { key: 'gen_87', grp: 'OPERASI – PROTEKSI LISTRIK', name: 'Gangguan internal stator (87)', unit: true,
      cause: 'Hubung singkat belitan stator.',
      chain: 'GENERATOR DIFFERENTIAL 87 (M3425A-1, DI0116) → 86-1 → 52 trip, turbine & inlet valve quick shutdown, 41 trip setelah 52 open. 87 juga memberi CONDITION FOR CO2 JET.',
      prot: '86-1 EMERGENCY STOP', src: 'data JEZ2K031 SH.001', act: 'Jangan reset sebelum inspeksi generator.' },
    { key: 'gen_64e', grp: 'OPERASI – PROTEKSI LISTRIK', name: 'Field ground fault (64E)', unit: true,
      cause: 'Isolasi rangkaian medan rotor ke tanah.',
      chain: 'GENERATOR FIELD GROUND FAULT 64E (M3425A-2, DI0123) → 86-5 (software LCU) → unload → stop normal.', prot: '86-5', src: 'data JEZ2K031 SH.001/003', act: 'Ukur isolasi rotor sebelum start ulang.' },
    { key: 'gen_40', grp: 'OPERASI – PROTEKSI LISTRIK', name: 'Loss of field (40)', unit: true,
      cause: 'Kegagalan eksitasi saat berbeban.',
      chain: 'Arus medan turun → Q sangat negatif → LOSS OF FIELD 40 (DI0124, aktif hanya saat 52 CLOSED) → 86-1 → 52 trip, 41 trip, stop.',
      prot: '86-1', src: 'data JEZ2K031 SH.001 · setelan asumsi', act: 'Periksa sistem eksitasi.' },
    { key: 'gen_46', grp: 'OPERASI – PROTEKSI LISTRIK', name: 'Arus urutan negatif (46) – ketidakseimbangan jaringan', unit: true,
      cause: 'Gangguan asimetris di jaringan / satu fasa terbuka.',
      chain: 'NEGATIVE SEQUENCE OVERCURRENT 46 (M3425A-2, DI0125) → 86-1 → 52 trip, turbine & IV quick shutdown, 41 trip, stop.',
      prot: '86-1 EMERGENCY STOP', src: 'data JEZ2K031 SH.001', act: 'Periksa jaringan & generator sebelum reset 86-1.' },
    { key: 'gen_51', grp: 'OPERASI – PROTEKSI LISTRIK', name: 'Arus lebih generator (51) – gangguan eksternal', unit: true,
      cause: 'Gangguan di sisi jaringan tidak terisolasi oleh proteksi saluran.',
      chain: 'GENERATOR OVER CURRENT 51 (M3425A-1, DI0118, aktif saat 52 CLOSED) → 86-4 → 52 trip; unit tetap berputar & bereksitasi (step EXCITATION).',
      prot: '86-4 NO-LOAD & EXCITATION', src: 'data JEZ2K031 SH.001 · waktu asumsi', act: 'Setelah jaringan normal: reset 86-4, sinkron ulang (step LOAD).' },
    { key: 'gen_59', grp: 'OPERASI – PROTEKSI LISTRIK', name: 'AVR macet naik – tegangan lebih (59)', unit: true,
      cause: 'Regulator AVR gagal, arus medan terus naik.',
      chain: 'Q dan tegangan naik → GENERATOR OVERVOLTAGE 59 (DI0121, > 112 % 2 s) → 86-4 → 52 trip. Unit tetap bereksitasi; tegangan no-load tetap tinggi selama AVR rusak.',
      prot: '86-4', src: 'data JEZ2K031 SH.001 · setelan asumsi', act: 'Pilih step RUNNING (eksitasi off), perbaiki AVR, reset 86-4.' },
    { key: 'gen_27', grp: 'OPERASI – PROTEKSI LISTRIK', name: 'Tegangan kurang generator (27)', unit: true,
      cause: 'Tegangan jaringan jatuh / sekring PT.',
      chain: 'GENERATOR UNDERVOLTAGE 27 (DI0122; aktif saat 52 CLOSED, diblok LINE CHARGE MODE) → 86-4 → 52 trip, unit tetap no-load & excitation.',
      prot: '86-4', src: 'data JEZ2K031 SH.001 · waktu asumsi', act: 'Periksa PT & tegangan bus, reset 86-4, sinkron ulang.' },
    { key: 'exc_heavy', grp: 'OPERASI – PROTEKSI LISTRIK', name: 'Excitation system heavy fault', unit: true,
      cause: 'Kegagalan thyristor/AVR.', chain: 'AVR: EXCITATION SYSTEM HEAVY FAULT (DI0082) → 86-1 → trip & stop.', prot: '86-1', src: 'data JEZ2K031 SH.001', act: 'Periksa AVR.' },
    { key: 'exc_51e', grp: 'OPERASI – PROTEKSI LISTRIK', name: 'Arus lebih rangkaian eksitasi (51E)', unit: true,
      cause: 'Hubung singkat di trafo eksitasi / thyristor.', chain: 'OVERCURRENT RELAY FOR EXCITATION CIRCUIT 51E (DI0126) → 86-1 → trip & stop.', prot: '86-1', src: 'data JEZ2K031 SH.001', act: 'Periksa trafo eksitasi & thyristor.' },
    { key: 'mtr_87t', grp: 'OPERASI – PROTEKSI LISTRIK', name: 'Diferensial trafo utama (87T)', unit: true,
      cause: 'Gangguan internal M.Tr.',
      chain: 'MTPP: M.TR DIFFERENTIAL (DI0257) → 86-T → 152-U trip; LOT-IIIC "86-T etc." → 86-1 → 52 & 41 trip, stop.',
      prot: '86-T + 86-1', src: 'data JEZ2K031 SH.002', act: 'Isolasi M.Tr, inspeksi.' },
    { key: 'mtr_buchholz', grp: 'OPERASI – PROTEKSI LISTRIK', name: 'Buchholz M.Tr (alarm → trip)', unit: true,
      cause: 'Akumulasi gas di trafo.', chain: 'B2 M.TR BUCHHOLZ ALARM → 60 s → M.TR BUCHHOLZ TRIP (DI0265) → 86-T + 86-1.',
      prot: '86-T + 86-1', src: 'data JEZ2K031 SH.002 · waktu asumsi', act: 'Turunkan beban saat alarm, siapkan stop.' },
    { key: 'gen_fire', grp: 'OPERASI – PROTEKSI LISTRIK', name: 'Kebakaran generator', unit: true,
      cause: 'Detektor api generator (CO2 F.F).', chain: 'GENERATOR FIRE (DI0314) → 86-2 QUICK STOP → GV tutup cepat, 52 trip saat GV no-load, 41 trip setelah 52 open, stop.', prot: '86-2', src: 'data JEZ2K031 SH.001', act: 'Ikuti prosedur pemadaman (CO2).' },
    { key: 'manual_5e', grp: 'OPERASI – OPERATOR', name: 'Tombol emergency stop (ULCB)', unit: true,
      cause: 'Operator menekan EMERGENCY STOP SWITCH di ULCB (juga ada di TCC dan SMP-1 main control house).',
      chain: 'EMERGENCY STOP SWITCH (DI0039) → 86-2 → turbine & IV quick shutdown, 52 trip saat GV no-load (74mb), 41 trip setelah 52 open, stop.',
      prot: '86-2', src: 'data JEZ2K031 SH.001/002', act: 'Reset 86-2 setelah standstill.' },
    { key: 'intake_low', grp: 'OPERASI – WADUK', name: 'Muka air intake turun < El. 577.51 m', unit: false,
      cause: 'Debit turbin > inflow (drawdown dipercepat untuk latihan).',
      chain: 'RTU-I: intake WL < 577.51 m selama 5 s → 86-5 SEMUA unit (juga unit yang diam: start diblok) → unload & stop.', prot: '86-5 (semua unit)', src: 'data JEZ2K031 SH.003', act: 'Kurangi total beban sebelum batas, koordinasi jadwal.' },
    // ---------------- switchyard ----------------
    { key: 'tl1_trip', grp: 'SWITCHYARD', name: 'Gangguan T/L No.1 (reclose sukses)', unit: false,
      cause: 'Gangguan temporer satu fasa di saluran ke GI New Curup.',
      chain: 'Proteksi saluran → 152-L1 trip → auto-reclose 1 s (bila selector USE) → masuk kembali. Selama terbuka seluruh daya lewat T/L No.2.',
      prot: 'Proteksi saluran + auto reclose', src: 'data (selector) / asumsi (waktu)', act: 'Pantau beban T/L No.2.' },
    { key: 'tl1_perm', grp: 'SWITCHYARD', name: 'Gangguan permanen T/L No.1 (lockout)', unit: false,
      cause: 'Gangguan permanen.', chain: '152-L1 trip, reclose gagal → lockout. Daya lewat T/L No.2.', prot: 'Proteksi saluran', src: 'asumsi', act: 'Buka 189-L1, tutup earth 189-L1E untuk pemeliharaan.' },
    { key: 'tl_both', grp: 'SWITCHYARD', name: 'Kedua T/L trip (plant terisolasi)', unit: false,
      cause: 'Gangguan berat di GI / kedua saluran.',
      chain: 'Semua unit kehilangan beban (load rejection) → governor beralih kontrol kecepatan → overspeed transien → unit berputar tanpa beban, 52 masih tertutup.',
      prot: '— (governor)', src: 'asumsi', act: 'Pantau overspeed, buka 52 (pilih step EXCITATION), tunggu saluran normal.' },
    { key: 'busa_fault', grp: 'SWITCHYARD', name: 'Gangguan bus 150 kV A (bus protection)', unit: false,
      cause: 'Hubung singkat di bus A.',
      chain: 'Bus protection → semua CB pada bus A trip (152-L1, 152-U1, 152-U3, 152-LST, 152-BT) → unit di bus A load rejection.',
      prot: 'Bus bar protection', src: 'data (selector) / asumsi (aksi)', act: 'Pindahkan bay ke bus B (DS interlock), energize ulang.' },
    // ---------------- gangguan sekuens start ----------------
    { key: 'iv_stuck', grp: 'SEKUENS START', name: 'Inlet valve macet 60 %', unit: true, cause: 'Servo I/V macet.',
      chain: 'INLET VALVE FULLY OPEN (21HA) tidak tercapai → timer RUNNING 240 s habis → SEQUENCE MONITOR ERROR.', prot: '—', src: 'sekuens', act: 'Pilih step STOP.' },
    { key: 'bypass_stuck', grp: 'SEKUENS START', name: 'Bypass valve tidak membuka', unit: true, cause: 'Solenoid 20QIVBP.',
      chain: 'Tidak ada pressure balance → operating seal tidak retract → I/V tidak membuka → timeout RUNNING.', prot: '—', src: 'sekuens', act: 'Pilih step STOP.' },
    { key: 'brake_stuck', grp: 'SEKUENS START', name: 'Rem mekanik tidak release', unit: true, cause: '75S / tekanan udara.',
      chain: 'GENERATOR MECHANICAL BRAKE RELEASE tidak ON → governor tidak start → timeout RUNNING.', prot: '—', src: 'sekuens', act: 'Pilih step STOP.' },
    { key: 'fcb_fail', grp: 'SEKUENS START', name: 'Field breaker 41 gagal close', unit: true, cause: 'Mekanik 41.',
      chain: 'FIELD CIRCUIT BREAKER (41) CLOSED tidak ON → timeout EXCITATION 60 s.', prot: '—', src: 'sekuens', act: 'Pilih step RUNNING/STOP.' },
    { key: 'sync_fail', grp: 'SEKUENS START', name: 'Synch-check relay (25) blok – 52 tidak close', unit: true, cause: 'Relay 25.',
      chain: 'UNIT CIRCUIT BREAKER (52) CLOSED tidak ON → timeout PARALLEL-IN 120 s.', prot: '—', src: 'sekuens', act: 'Pilih step EXCITATION.' },
    { key: 'gv_locked', grp: 'SEKUENS START', name: 'Guide vane locked / I/V locked', unit: true, cause: 'Kunci mekanik terpasang.',
      chain: 'STARTING CONDITION-1/-2 OFF → unit tidak bisa di-start.', prot: '—', src: 'data (start cond.)', act: 'Lepas kunci (hapus gangguan).' },
    { key: 'ctrl_local', grp: 'SEKUENS START', name: 'Excitation control selector LOCAL', unit: true, cause: '43-41 di posisi LOCAL.',
      chain: 'CONTROL CONDITION OFF → start diblok.', prot: '—', src: 'data (control cond.)', act: 'Kembalikan ke REMOTE.' },
  ];
  const SCN = Object.fromEntries(SCENARIOS.map(s => [s.key, s]));

  /* ===================================================================== */
  /*  UNIT                                                                 */
  /* ===================================================================== */
  class Unit {
    constructor(n, plant) {
      this.n = n; this.plant = plant;
      this.pos = 0; this.target = 0; this.dir = 0; this.lastDir = 0;   // dir +1 = 1X, -1 = 5X
      this.tr = null;                                    // transisi aktif {to, dir, t, started, fail}
      this.dur = { start: {}, stop: {} };                // durasi aktual per step
      this.selCS = null;                                 // pilihan 43S-CS menunggu OPERATE
      this.sw = {                                        // selector panel
        s43STEP: 'REMOTE', s43R: 'REMOTE', s43CH: 'LOCK', ALR: true, JLR: false, AQR: true, AQRC: 'SEMI',
        AVR: 'AUTO', USM: true, AFC: false, gov: 'SPEED', JQR: false,
        alrSP: 50, maxP: 72, minP: n === 3 ? 3.5 : 5, aqrSP: 10, aqrA: n === 1 ? 0 : 0.5, aqrB: n === 1 ? 0 : 0.1, opcSP: 50,
      };
      this.ctrl = { cb52Remote: true, excRemote: true, voltAuto: true, govRemote: true };
      this.lo = { '86-1': null, '86-2': null, '86-4': null, '86-5': null, '86-T': null, '86-PC': null };   // lockout relay (penyebab)
      this.fx = {};                                      // gangguan aktif
      this.do = {};                                      // perintah DO terakhir (indikasi)
      this.p = this.coldState();
      this.alm = {};
    }

    coldState() {
      return {
        ax: false, axT: 0,
        qp: [pump('88QP1'), pump('88QP2')], qpMain: 0,
        mtr: [pump('M.Tr A'), pump('M.Tr B')], mtrMain: 0,
        cw: [pump('88WC1'), pump('88WC2')], cwMain: this.n === 1 ? 1 : 0,
        ssb: [pump('Booster A'), pump('Booster B')], ssbMain: 0,
        qt: pump('88QT'), qtCmd: false, vq: false, vqT: 0,
        sh: true,
        f_lb: 0, f_ac: 0, f_goc: 0, f_tb: 0, f_sc: 0, sealP: 0, genOil: 0, lift: 0,
        govP: 0.97, govLvl: 1.0,
        brake: 0, brakeCmd: 'release', bypass: 0, bypassCmd: false, dp: 1, seal: 1, iv: 0, ivCmd: 'close',
        govOn: false, gv: 0, gvRate: 0.08, gvLim: 100, xi: 0, sref: 0, speed: 0, pm: 0, zeroT: 99,
        excOn: false, fcb: false, fcbT: 0, field: 0, vt: 0, vref: 1.0,
        cb: false, sync: false, phase: 0, p: 0, q: 0, pref: 0, qref: 0, islanded: false, loadRaise: false, noLoad: false, qZero: false,
        T: { thrust: 30, ugb: 30, lgb: 30, tgb: 30, ugbOil: 29, lgbOil: 29, tgbOil: 29, st: [30, 30, 30, 30], acOut: 28, acIn: 28, cwIn: 27.3, cwOut: 27.3, mtrOil: 40, mtrWdg: 42 },
        vib: { ubv: 0, ubh: 0, lbv: 0, lbh: 0, hcv: 0, hch: 0, ugx: 0, ugy: 0, lgx: 0, lgy: 0, tgx: 0, tgy: 0 },
        bh: 0, mon: {},
      };
    }

    /** Kondisi unit langsung "LOAD" (untuk inisialisasi skenario operasi). */
    forceLoad(P, Q) {
      const p = this.p, c = this;
      p.ax = true; p.qp[p.qpMain].run = p.qp[p.qpMain].cmd = true; p.mtr[0].run = p.mtr[0].cmd = true;
      p.cw[p.cwMain].run = p.cw[p.cwMain].cmd = true; p.ssb[0].run = p.ssb[0].cmd = true; p.sh = false;
      Object.assign(p, { f_lb: 1, f_ac: 1, f_goc: 1, f_tb: 1, f_sc: 1, sealP: 1, genOil: 1, lift: 0, govP: 1, brake: 0, brakeCmd: 'release',
        bypass: 0, dp: 0, seal: 0, iv: 1, ivCmd: 'open', govOn: true, speed: 1, sref: 1, excOn: true, fcb: true, fcbT: 5, cb: true, zeroT: 0 });
      p.gv = invInterp(GV_MW, P); p.xi = 0; p.pm = P / PR; p.p = P; p.pref = P; p.q = Q; p.qref = Q;
      p.field = 1 + Q / 42; p.vt = 1 + 0.05 * (p.field - 1); p.vref = 0.99;
      c.sw.gov = 'POWER'; c.sw.alrSP = P; c.pos = c.target = 5; c.dir = 0; c.lastDir = 1; c.tr = null;
      c.dur = { start: { 1: 14, 2: 177, 3: 13, 4: 56, 5: 18 }, stop: {} };   // waktu aktual dari layar OPS (13-Okt-2017)
      const Ts = this.steadyTemps(); Object.assign(p.T, Ts); p.T.st = Ts.st.slice();
      Object.assign(p.vib, this.steadyVib());
    }

    get name() { return 'UNIT NO.' + this.n; }
    f(k) { return !!this.fx[k]; }
    log(type, msg) { this.plant.log(type, `U${this.n}: ${msg}`); }
    setDO(tag, desc) { this.do[tag] = this.plant.t; this.log('CMD', `${this.n}${tag} ${desc}`); }

    /* ----------------------- status turunan ----------------------- */
    s13_1() { return this.p.speed > 0.5; }
    s13_2() { return this.p.speed > 0.9; }
    s14L() { return this.p.speed < 0.005; }
    s14LT() { return this.s14L() && this.p.zeroT >= 20; }
    s14_2() { return this.p.speed < 0.2; }
    tgbOilLvl() { return this.fx.tgb_oil_low ? 1 - this.fx.tgb_oil_low.v : 1; }
    govSumpT() { return 45 + (this.fx.gov_sump_temp ? this.fx.gov_sump_temp.v : 0); }
    s74mb() { return this.p.gv <= GV_NL + 2; }
    gridOK() { return this.plant.sy.unitOnGrid(this.n); }
    anyLO() { return Object.values(this.lo).some(Boolean); }
    lockout(k) { return !!this.lo[k]; }

    /* ----------------- STARTING / CONTROL CONDITION --------------- */
    sc1() {
      const p = this.p, sy = this.plant.sy, n = this.n, f = (k) => this.f(k);
      return [
        ['UNIT CIRCUIT BREAKER (52) OPEN', !p.cb],
        ['DISCONNECTING SWITCH (89) CLOSED', true],
        [`LINE SIDE CIRCUIT BREAKER (152-U${n}) CLOSE`, sy.st['152-U' + n]],
        ['150kV BUS A DISCONNECTING SWITCH (189A) CLOSE', sy.st[`189-U${n}A`], 'or'],
        ['150kV BUS B DISCONNECTING SWITCH (189B) CLOSE', sy.st[`189-U${n}B`], 'or'],
        [`U${n}LCB DC POWER SUPPLY FAILURE`, false, 'ornot'],
        [`U${n}LCB AC POWER SUPPLY FAILURE`, false, 'ornot'],
        ['DS FOR NEUTRAL GROUNDING (89NGT) CLOSE', true],
        ['FIELD CIRCUIT BREAKER (41) OPEN', !p.fcb],
        ['INLET VALVE FULLY CLOSED (33IVlb)', p.iv < 0.005],
        ['BYPASS VALVE FOR I/V FULLY CLOSED (33BPlb)', p.bypass < 0.005],
        ['I/V LOCKED', f('gv_locked'), 'not'],
        ['I/V MAIN OIL SUPPLY VALVE OPEN', true],
        ['MAINTENANCE SEAL RETRACTED', true],
        ['I/V PRESSURE OIL SYSTEM PRESSURE HIGH', false, 'ornot'],
        ['I/V PRESSURE OIL SYSTEM PRESSURE LOW 1ST', false, 'ornot'],
        ['I/V PRESSURE OIL SYSTEM PRESSURE LOW 2ND', false, 'ornot'],
        ['I/V PRESSURE TANK OIL LEVEL HIGH', false, 'ornot'],
        ['I/V PRESSURE TANK OIL LEVEL LOW 1ST', false, 'ornot'],
        ['I/V PRESSURE TANK OIL LEVEL LOW 2ND', false, 'ornot'],
        ['I/V HP AIR COMPRESSOR PRESSURE LOW', false, 'not'],
        ['UPPER GUIDE BEARING OIL LEVEL LOW', false, 'not'],
        ['LOWER GUIDE BEARING OIL LEVEL LOW', f('brg_oil_low'), 'not'],
      ];
    }
    sc2() {
      const p = this.p, f = (k) => this.f(k);
      return [
        ['GUIDE VANE FULLY COLSED (33GVlb)', p.gv < 0.3],
        ['GUIDE VANE LOCKED', f('gv_locked'), 'not'],
        ['GOVERNOR PRESSURE OIL SYSTEM PRESSURE HIGH', false, 'ornot'],
        ['GOVERNOR PRESSURE OIL SYSTEM PRESSURE LOW 1ST', p.govP < 0.85, 'ornot'],
        ['GOVERNOR PRESSURE OIL SYSTEM PRESSURE LOW 2ND', p.govP < 0.75, 'ornot'],
        ['GOVERNOR PRESSURE TANK OIL LEVEL HIGH', false, 'ornot'],
        ['GOVERNOR PRESSURE TANK OIL LEVEL LOW 1ST', p.govLvl < 0.85, 'ornot'],
        ['GOVERNOR PRESSURE TANK OIL LEVEL LOW 2ND', p.govLvl < 0.75, 'ornot'],
        ['GOVERNOR PRIMARY AIR TANK PRESSURE LOW', false, 'not'],
        ['GOVERNOR MAIN OIL SUPPLY VALVE OPEN', true],
        ['SHAFT SEAL MAINTENANCE SEAL APPLIED', false, 'not'],
        ['GOVERNOR HP AIR SYSTEM READY', true],
        ['OVERSPEED PENDULUM RESET', !this.p.mon.pendulum],
        ['GENERATOR BRAKE RELEASE', p.brake < 0.01],
        ['GENERATOR STOP', this.s14LT()],
        ['GOVERNOR CONTROLLER FAULT', f('gov_fault'), 'not'],
        ['GOVERNOR CONTROLLER READY FOR START', !this.anyLO()],
        ['REGULATOR CONTROL MODE REMOTE', this.ctrl.govRemote],
      ];
    }
    sc3() {
      const p = this.p;
      return [
        ['FIELD CIRCUIT BREAKER (41) CLOSE', p.fcb, 'not'],
        ['TURBINE BEARING OIL LEVEL LOW 1ST', this.tgbOilLvl() < 0.8, 'not'],
        ['TURBINE BEARING OIL LEVEL LOW 2ND', this.tgbOilLvl() < 0.6, 'not'],
        ['GENERATOR BRAKE AIR TANK PRESSURE LOW', false, 'not'],
        ['86-1 OPERATE', this.lockout('86-1'), 'not'],
        ['86-2 OPERATE', this.lockout('86-2'), 'not'],
        ['86-4 OPERATE', this.lockout('86-4'), 'not'],
        ['86-5 OPERATE', this.lockout('86-5'), 'not'],
      ];
    }
    static evalList(list) {
      let ok = true; const or = {}; let grp = 0;
      list.forEach(([, v, t], i) => {
        const val = (t === 'not' || t === 'ornot') ? !v : v;
        if (t === 'or' || t === 'ornot') { const g = list[i - 1] && list[i - 1][2] === t ? grp : ++grp; or[g] = or[g] === undefined ? (t === 'or' ? v : !v) : (t === 'or' ? (or[g] || v) : (or[g] && !v)); }
        else if (!val) ok = false;
      });
      Object.values(or).forEach(v => { if (!v) ok = false; });
      return ok;
    }
    scOK(i) { return Unit.evalList(i === 1 ? this.sc1() : i === 2 ? this.sc2() : this.sc3()); }
    startingCond() { return this.scOK(1) && this.scOK(2) && this.scOK(3); }
    ctrlList() {
      const c = this.ctrl;
      return [['UNIT CIRCUIT BREAKER CONTROL SELECTOR REMOTE', c.cb52Remote], ['EXCITATION CONTROL SELECTOR REMOTE', c.excRemote && !this.f('ctrl_local')],
        ['VOLTAGE CONTROL SELECTOR AUTO', c.voltAuto], ['GOVERNOR CONTROL SELECTOR REMOTE', c.govRemote]];
    }
    controlCond() { return this.ctrlList().every(x => x[1]); }

    /* ------------- KONDISI MASUK STEP (sesuai layar seq. monitor) ------------- */
    condStart(k) {
      const p = this.p;
      const qpA = p.qp[0].run, qpB = p.qp[1].run, mA = p.mtr[0].run, mB = p.mtr[1].run;
      switch (k) {
        case 1: return {
          a: [['STARTING CONDITION', this.startingCond(), 'dash'], ['CONTROL CONDITION', this.controlCond(), 'dash']],
          b: [['SPACE HEATER (88SH) OFF', !p.sh], ['GOVERNOR PRESSURE OIL PUMP - A START', qpA, 'or'], ['GOVERNOR PRESSURE OIL PUMP - B START', qpB, 'or'],
            ['M.TR OIL PUMP - A START', mA, 'or2'], ['M.TR OIL PUMP - B START', mB, 'or2'], ['OIL LIFT PUMP (88QT) START', p.qt.run || this.s13_2()],
            ['OIL LIFT PUMP PRESSURE RELAY (69QT) ON', p.lift > 0.8 || this.s13_2()]],
          c: [['LOWER BRG.WATER FLOW LOW', p.f_lb < 0.6, 'not'], ['AIR COOLER WATER FLOW LOW', p.f_ac < 0.6, 'not'], ['GEN.OIL COOLER WATER FLOW LOW', p.f_goc < 0.6, 'not'],
            ['TURBINE BEARING WATER FLOW AVAILABLE', p.f_tb > 0.7], ['SHAFT SEAL COOLING WATER FLOW AVAILBALE', p.f_sc > 0.7], ['SHAFT SEAL WATER PRESSURE AVAILABLE', p.sealP > 0.7]],
        };
        case 2: return { a: [['GENERATOR MECHANICAL BRAKE RELEASE', p.brake < 0.01], ['INLET VALVE FULLY OPEN (21HA) ON', p.iv > 0.995], ['BYPASS VALVE FULLY CLOSE (33BPlb) ON', p.iv > 0.995 && p.bypass < 0.005],
          ['TURBINE SPEED > 50% (13-1) ON', this.s13_1()], ['GEN.OIL COOLER OIL FLOW LOW', p.genOil < 0.5, 'not'], ['STOP DETECTOR (14L) OFF', !this.s14L()]] };
        case 3: return { a: [['TURBINE SPEED > 90% (13-2) ON', this.s13_2()], ['FILED CIRCUIT BREAKER (41) CLOSED', p.fcb], ['GENERATOR VOLTAGE > 90% (84EX)', p.vt > 0.9]] };
        case 4: return { a: [['UNIT CIRCUIT BREAKER (52) CLOSED', p.cb]] };
        case 5: return { a: [['GENERATOR POWER > 10%', p.p > 0.1 * PR]] };
      }
      return { a: [] };
    }
    condStop(k) {
      const p = this.p;
      switch (k) {
        case 4: return { a: [['GUIDE VANE NO LOAD POSITION (74mb) ON', this.s74mb()], ['GENERATOR POWER < 5%', p.p < 0.05 * PR], ['GENERATOR REACTIVE POWER 5% > Q > -5%', Math.abs(p.q) < 0.05 * PR]] };
        case 3: return { a: [['UNIT CIRCUIT BREAKER (52) OPEN', !p.cb]] };
        case 2: return { a: [['FIELD CIRCUIT BREAKER (41) OPEN', !p.fcb], ['GENERATOR VOLTAGE < 60%', p.vt < 0.6]] };
        case 1: return { a: [['GUIDE VANE FULLY CLOSE (33GVlb) ON', p.gv < 0.3], ['INLET VALVE FULLY CLOSE (33IVlb) ON', p.iv < 0.005], ['BYPASS VALVE FULLY CLOSE (33BPlb) ON', p.bypass < 0.005], ['OPERATING SEAL APPLIED', p.seal > 0.995]] };
        case 0: return { a: [['TIME DELAY RELAY FOR 14L (14LT) ON', this.s14LT()], ['SPACE HEATER (88SH) ON', p.sh]] };
      }
      return { a: [] };
    }
    static allOK(grp) {
      let ok = true; const or = {};
      for (const key of Object.keys(grp)) for (const [, v, t] of grp[key]) {
        const val = t === 'not' ? !v : v;
        if (t === 'or' || t === 'or2') or[t] = (or[t] || false) || v;
        else if (!val) ok = false;
      }
      return ok && Object.values(or).every(Boolean);
    }
    entryOK(k, dir) { return Unit.allOK(dir > 0 ? this.condStart(k) : this.condStop(k)); }

    /* ======================= PERINTAH OPERATOR ======================= */
    select43S(k) {   // pilih step tujuan, eksekusi = operate43S()
      this.selCS = k; this.log('INFO', `43S-CS select ${STEP[k]}`);
    }
    operate43S(k) {
      if (k === undefined) k = this.selCS;
      if (k === null || k === undefined) return;
      this.selCS = null;
      const hardLO = ['86-1', '86-2', '86-5', '86-T', '86-PC'].filter((x) => this.lo[x]);
      if (hardLO.length && k > 0) { this.log('ALARM', `43S-CS ${STEP[k]} diblok: ${hardLO.join(', ')} operate – hanya STOP yang diizinkan`); return; }
      if (k > this.pos || (this.tr && this.tr.dir < 0 && k >= this.pos)) {
        if (this.pos === 0 && !this.tr) {
          if (this.anyLO()) { this.log('ALARM', 'Start diblok: lockout relay 86 belum direset'); return; }
          if (!this.startingCond() || !this.controlCond()) { this.log('ALARM', 'Start diblok: STARTING/CONTROL CONDITION belum terpenuhi'); return; }
        }
        if (this.lo['86-4'] && k > 3) { this.log('ALARM', 'Diblok: 86-4 operate (reset 86-4 dahulu)'); return; }
      }
      this.target = k;
      this.log('CMD', `43S-CS ${STEP[k]} OPERATE`);
      this.retarget();
    }
    // posisi fisik unit dari status peralatan (dipakai bila transisi START terputus oleh stop/lockout)
    physPos() {
      const p = this.p;
      if (p.cb) return 4;
      if (p.excOn || p.vt > 0.3) return 3;
      if (p.govOn || p.ivCmd === 'open' || p.iv > 0.005 || p.gv > 0.3 || p.speed > 0.01) return 2;
      if (p.ax || p.qtCmd) return 1;
      return 0;
    }
    // transisi START yang sedang berjalan dihentikan: step efektif = step tertinggi yang peralatannya sudah bekerja,
    // sehingga sekuens 5X menjalankan semua langkah stop (IV close, governor stop, 1AX reset) – block diagram SH.04/05 & SH.30–35
    abortStart() {
      const tr = this.tr;
      if (!tr || tr.dir <= 0 || !tr.started) return;
      const ph = Math.min(this.physPos(), tr.to);
      if (ph > this.pos) { this.log('INFO', `Transisi START → ${STEP[tr.to]} dihentikan; sekuens stop mulai dari step ${STEP[ph]}`); this.pos = ph; }
    }
    retarget() {
      if (this.tr && this.tr.dir > 0 && this.target < this.tr.to) this.abortStart();
      const want = this.target > this.pos ? 1 : this.target < this.pos ? -1 : 0;
      if (this.tr && this.tr.dir === want && !this.tr.fail) return;     // sudah berjalan ke arah yang sama
      if (this.tr && this.tr.dir === -want && this.tr.dir !== 0) {
        // balik arah: posisi tetap step terakhir yang dicapai
        this.log('INFO', `MODE TRANSFER ${this.tr.dir > 0 ? '1X→5X' : '5X→1X'}`);
      }
      this.tr = null; this.dir = want; if (want) this.lastDir = want;
      if (want) this.beginTransition();
    }
    beginTransition() {
      const to = this.pos + this.dir;
      this.tr = { to, dir: this.dir, t: 0, started: false, fail: false, sub: 0 };
    }

    /* ======================= LOGIKA SEKUENS ======================= */
    sequence(dt) {
      const p0 = this.p;
      // rem dilepas setelah stand still (block diagram SH.36: DO0112 = I/V step end AND 14LT)
      if (this.pos === 0 && !this.tr && p0.brakeCmd === 'apply' && this.s14LT() && p0.iv < 0.005) {
        this.setDO('DO0112', 'BRAKE RELEASE (stand still)'); p0.brakeCmd = 'release';
      }
      const tr = this.tr; if (!tr) return;
      const p = this.p, to = tr.to;
      this.coastDown(tr);
      // ---- prasyarat sebelum transisi dimulai ----
      if (!tr.started) {
        let pre = true;
        if (tr.dir > 0 && to === 1) pre = this.startingCond() && this.controlCond() && !this.anyLO();
        if (tr.dir > 0 && to === 4) pre = !this.plant.units.some(u => u !== this && u.p.sync) && this.gridOK() && !this.lo['86-4'];
        if (tr.dir < 0 && to === 0) pre = this.s14LT();
        if (!pre) { tr.wait = true; return; }
        tr.started = true; tr.wait = false; tr.t = 0;
        this.log('STEP', `${tr.dir > 0 ? 'START' : 'STOP'} → ${STEP[to]}`);
        this.onEnterTransition(tr);
      }
      tr.t += dt;
      this.transitionActions(tr, dt);
      if (this.entryOK(to, tr.dir) && this.transitionDone(tr)) {
        (tr.dir > 0 ? this.dur.start : this.dur.stop)[to] = Math.round(tr.t);
        this.pos = to; this.tr = null;
        this.log('OK', `Step ${STEP[to]} tercapai (${Math.round((tr.dir > 0 ? this.dur.start : this.dur.stop)[to])} s)`);
        if (to === 0) this.dur.start = {};
        if (to === 5 && tr.dir > 0) this.dur.stop = {};
        if (this.pos !== this.target) this.beginTransition(); else { this.dir = 0; if (to === 5) this.log('OK', '*** START COMPLETE ***'); if (to === 0) this.log('OK', '*** STOP COMPLETE (STAND STILL) ***'); }
        return;
      }
      const lim = tr.dir > 0 ? START_T[to] : STOP_T[to];
      if (this.sw.USM && lim && tr.t > lim && !tr.fail) {
        tr.fail = true;
        this.p.mon.seqErr = STEP[to];
        this.log('ALARM', `SEQUENCE MONITOR ERROR – ${tr.dir > 0 ? 'STOP TO LOAD' : 'LOAD TO STOP'} step ${STEP[to]} (${lim} s)`);
      }
    }
    transitionDone(tr) {
      if (tr.dir > 0 && tr.to === 2) return tr.sub >= 4;      // tunggu 88QT stop selesai? (tidak wajib) – sub≥4 = governor start sudah
      return true;
    }
    onEnterTransition(tr) {
      const p = this.p;
      if (tr.dir > 0) {
        switch (tr.to) {
          case 1: this.setDO('DO0107', '1AX SET (aux. start: GOV pump, M.Tr pump, CW pump, booster, 88SH OFF)'); p.ax = true;
            this.setDO('DO0109', 'HIGH PRESSURE OIL PUMP (88QT) START'); p.qtCmd = true; break;
          case 2: tr.sub = 0; break;
          case 3: this.setDO('DO0157', 'EXCITATION START'); p.excOn = true; break;
          case 4: this.setDO('DO0094', 'AUTO SYNCHRONIZER START (ASSX)'); p.sync = true; break;
          case 5: this.setDO('DO0126', 'POC – POWER CONTROL'); this.sw.gov = 'POWER'; p.loadRaise = true; break;
        }
      } else {
        switch (tr.to) {
          case 4: this.setDO('DO0102', 'NO LOAD CONTROL'); p.noLoad = true; p.loadRaise = false; this.setDO('DO0097/98', 'Q≈0 CONTROL'); p.qZero = true; break;
          case 3: this.setDO('DO0106', '52 OPEN'); this.openCB('52 OPEN (sekuens stop)'); break;
          case 2: this.setDO('DO0158', 'EXCITATION OFF'); p.excOn = false; p.sync = false; break;
          case 1: this.setDO('DO0119', 'TURBINE STOP (65T)'); p.govOn = false; p.sync = false;
            this.setDO('DO0130', 'INLET VALVE CLOSE'); break;
          case 0: this.setDO('DO0108', '1AX RESET (aux. stop, 88SH ON)'); p.ax = false; p.qtCmd = false; break;
        }
      }
    }
    // SH.33/36: 88QT start & brake apply berbasis kondisi (stop cmd AND n<20%) – berlaku juga saat menunggu 14LT di step terakhir
    coastDown(tr) {
      const p = this.p;
      if (!(tr.dir < 0 && tr.to <= 1 && (tr.started || tr.to === 0))) return;
      if (!this.s13_2() && !p.qtCmd && p.speed > 0.01 && p.ax) { this.setDO('DO0109', '88QT START (coast down)'); p.qtCmd = true; }
      if (p.gv < 0.3 && p.ivCmd !== 'close') { p.ivCmd = 'close'; }
      if (this.s14_2() && p.brakeCmd !== 'apply' && p.speed > 0.002) { this.setDO('DO0111', 'BRAKE APPLY (n<20%) + DO0153 VACUUM CLEANER START'); p.brakeCmd = 'apply'; p.vq = true; p.vqT = 0; }
    }
    transitionActions(tr, dt) {
      const p = this.p;
      if (tr.dir > 0 && tr.to === 2) {
        switch (tr.sub) {
          case 0: if (p.brake < 0.99) { if (p.brakeCmd !== 'apply') { this.setDO('DO0111', 'BRAKE APPLY (for I/V open)'); p.brakeCmd = 'apply'; } }
            else { this.setDO('DO0129', 'INLET VALVE OPEN'); p.ivCmd = 'open'; tr.sub = 1; } break;
          case 1: if (p.iv > 0.995 && p.bypass < 0.005) { this.setDO('DO0112', 'BRAKE RELEASE (for G/V open)'); p.brakeCmd = 'release'; tr.sub = 2; } break;
          case 2: if (p.brake < 0.01) { this.setDO('DO0118', 'TURBINE GOVERNOR START (65S)'); this.setDO(this.gridOK() ? 'DO0121' : 'DO0120', this.gridOK() ? 'ISO OFF' : 'ISO ON');
            p.govOn = true; this.sw.gov = 'SPEED'; p.sref = Math.max(p.speed, 0); p.xi = p.gv / 100; tr.sub = 3; } break;
          case 3: if (this.s13_2() && p.genOil >= 0.5) { tr.hold = (tr.hold || 0) + dt; if (tr.hold > 5) { this.setDO('DO0110', 'HIGH PRESSURE OIL PUMP (88QT) STOP'); p.qtCmd = false; tr.sub = 4; } } break;
        }
      }
      if (tr.dir < 0 && tr.to === 0 && tr.started && p.brakeCmd === 'apply' && this.s14LT() && !tr.relDone) {
        tr.relDone = true; // brake release setelah standstill (block diagram SH.36), vacuum cleaner stop +1 min
        this.setDO('DO0112', 'BRAKE RELEASE (standstill)'); p.brakeCmd = 'release';
      }
    }

    openCB(why) {
      const p = this.p;
      if (!p.cb) return;
      p.cb = false; p.sync = false; p.islanded = false; p.loadRaise = false; p.noLoad = false; p.qZero = false;
      p.pref = 0; p.p = 0; p.q = 0; p.sref = 1.0; p.xi = p.gv / 100; if (p.govOn) this.sw.gov = 'SPEED';
      p.gvRate = 0.2;
      this.log('ALARM', `${this.n}DI0091 52 OPEN – ${why}`);
    }

    /* ======================= LOCKOUT 86 ======================= */
    operate86(k, cause) {
      if (this.lo[k]) return;
      this.lo[k] = cause || k;
      this.log('ALARM', `LOCK OUT RELAY ${k} OPERATE – ${cause}`);
      const p = this.p;
      if (k !== '86-4') this.abortStart();
      if (k === '86-T') { this.plant.sy.trip('152-U' + this.n, '86-T'); this.operate86('86-1', '86-T'); return; }
      if (k === '86-PC') { this.plant.sy.trip('152-U' + this.n, '86-PC'); this.operate86('86-1', '86-PC'); return; }
      if (k === '86-1') {
        this.openCB('86-1'); p.govOn = false; p.gvRate = 0.25; p.ivCmd = 'close'; p.sync = false;
        this.target = 0; this.pos = Math.min(this.pos, 2); this.retargetForce();
      } else if (k === '86-2') {
        p.govOn = false; p.gvRate = 0.25; p.ivCmd = 'close'; p.loadRaise = false; p.sync = false;
        this.target = 0; this.retargetForce();
      } else if (k === '86-4') {
        this.openCB('86-4'); p.sync = false;
        if (this.pos > 3) this.pos = 3;
        this.target = Math.min(this.target, 3); if (this.pos >= 3) this.target = 3; this.retargetForce();
      } else if (k === '86-5') {
        this.target = 0; this.retargetForce();
      }
    }
    retargetForce() { this.tr = null; this.dir = this.target > this.pos ? 1 : this.target < this.pos ? -1 : 0; if (this.dir) { this.lastDir = this.dir; this.beginTransition(); } }
    reset86(k) {
      if (!this.lo[k]) return;
      if ((k === '86-5' || k === '86-1' || k === '86-2' || k === '86-T' || k === '86-PC') && !this.s14LT()) { this.log('INFO', `${k} RESET ditolak: unit belum stand still (14LT)`); return; }
      if (k === '86-4' && this.p.cb) { this.log('INFO', '86-4 RESET ditolak: 52 masih tertutup'); return; }
      if (this.protActive(k)) { this.log('INFO', `${k} RESET ditolak: penyebab masih ada (${this.lo[k]})`); return; }
      this.log('CMD', `${k} RESET`); this.lo[k] = null;
      if (k === '86-1' || k === '86-2') this.p.mon.pendulum = false;
    }
    protActive(k) { return (this.p.mon.active || {})[k] || false; }

    /* ======================= OPERATOR LAIN ======================= */
    raise65(dir) {   // 7-65 speed/load raise-lower
      const p = this.p, sw = this.sw;
      if (p.cb && !p.islanded) {
        if (sw.gov === 'OPENING') sw.opcSP = clamp(sw.opcSP + dir, 0, 100);
        else if (sw.ALR) sw.alrSP = clamp(sw.alrSP + dir, sw.minP, sw.maxP);
        else p.pref = clamp(p.pref + dir, 0, sw.maxP);
      } else p.sref = clamp(p.sref + dir * 0.002, 0.9, 1.1);
    }
    raise77(dir) { this.p.gvLim = clamp(this.p.gvLim + dir * 5, 0, 100); }
    raise90(dir) {
      const p = this.p, sw = this.sw;
      if (p.cb && !p.islanded) { if (sw.AQR && sw.AVR === 'AUTO') sw.aqrSP = clamp(sw.aqrSP + dir, -40, 50); else p.qref = clamp(p.qref + dir, -40, 50); }
      else p.vref = clamp(p.vref + dir * 0.01, 0.9, 1.1);
    }

    /* ======================= MODEL PLANT ======================= */
    steadyTemps() {
      const p = this.p, P = Math.max(0, p.p) / PR, run = p.speed;
      const cwIn = this.plant.cwIn;
      const cool = (f) => (1 - f) * 38;                 // kenaikan bila aliran pendingin hilang
      const thrBase = this.n === 2 ? 62 : 55;
      return {
        cwIn, cwOut: cwIn + (run > 0.5 ? 0.5 + 2.5 * P : 0),
        thrust: cwIn + run * (thrBase - 27.5 - 6 + 6 * P) + cool(p.f_lb) * 0.4 * run + (this.fx.thrust_temp ? this.fx.thrust_temp.v : 0),
        ugb: cwIn + run * (21 + 3 * P) + cool(p.f_lb) * 0.6 * run,
        lgb: cwIn + run * (18 + 3 * P) + cool(p.f_lb) * run + (this.fx.lgb_water_low ? this.fx.lgb_water_low.v : 0),
        tgb: cwIn + run * (20 + 3 * P) + cool(p.f_tb) * run,
        ugbOil: cwIn + run * (12 + 2 * P), lgbOil: cwIn + run * (13 + 2 * P) + cool(p.f_lb) * 0.7 * run, tgbOil: cwIn + run * (16 + 2 * P),
        st: [0, 1, 2, 3].map(i => cwIn + (p.cb ? 22 + 35 * P * P + 0.25 * Math.abs(p.q) : run * 6) + (i === 2 ? -3 : 0) + cool(p.f_ac) * 0.8 * (p.cb ? 1 : 0)),
        acOut: cwIn + (p.cb ? 3 + 6 * P + cool(p.f_ac) * 0.5 : run * 2), acIn: cwIn + (p.cb ? 18 + 12 * P + cool(p.f_ac) : run * 6),
        mtrOil: 33 + (p.cb ? 27 * P : 0), mtrWdg: 36 + (p.cb ? 29 * P : 0),
      };
    }
    steadyVib() {
      const s = this.p.speed, P = Math.max(0, this.p.p) / PR, n = this.n;
      const k = s * s;
      const tg = this.fx.tgb_vib ? this.fx.tgb_vib.v : 0;
      const base = [[7, 31, 0.3, 7, 0.5, 0.6, 5.5, 4.3, 6.1, 5.2, 30, 30], [9, 43, 2, 9, 0.9, 0.9, 8.6, 9.2, 5.2, 5.0, 37, 40], [45, 41, 13, 4, 0.6, 0.7, 5.7, 6.0, 8.4, 7.9, 62, 27]][n - 1];
      const r = (v) => Math.max(0, v * k * (0.85 + 0.25 * P));
      return { ubv: r(base[0]), ubh: r(base[1]), lbv: r(base[2]), lbh: r(base[3]), hcv: r(base[4]), hch: r(base[5]),
        ugx: r(base[6]), ugy: r(base[7]), lgx: r(base[8]), lgy: r(base[9]), tgx: r(base[10]) + tg * k, tgy: r(base[11]) + tg * 0.7 * k };
    }

    pumpStep(pm, cmd, dt, delay) {
      pm.cmd = cmd;
      if (cmd && !pm.fail) { pm.t += dt; pm.run = pm.t >= delay; } else { pm.t = 0; pm.run = false; }
    }
    pairStep(arr, mainKey, cmd, dt, delay, label) {
      const p = this.p, main = p[mainKey], sb = 1 - main;
      const mainOK = !arr[main].fail;
      this.pumpStep(arr[main], cmd, dt, delay);
      // standby auto-start bila main gagal (5 s)
      if (cmd && !mainOK) {
        arr._sbT = (arr._sbT || 0) + dt;
        if (arr._sbT > 3) this.pumpStep(arr[sb], true, dt, delay); else this.pumpStep(arr[sb], false, dt, delay);
        if (!arr._logged && arr._sbT > 3) { arr._logged = true; this.log('INFO', `${label}: standby ${arr[sb].name} AUTO START`); }
      } else { arr._sbT = 0; arr._logged = false; this.pumpStep(arr[sb], false, dt, delay); }
    }

    physics(dt) {
      const p = this.p, sw = this.sw, F = this.fx;
      const aux = p.ax;
      // ---------------- auxiliary ----------------
      p.cw[0].fail = !!(F.cw_both_fail || (F.cw_main_trip && p.cwMain === 0));
      p.cw[1].fail = !!(F.cw_both_fail || (F.cw_main_trip && p.cwMain === 1));
      p.qp[p.qpMain].fail = !!F.gov_pump_trip;
      this.pairStep(p.qp, 'qpMain', aux, dt, 1.5, 'GOV PRESSURE OIL PUMP');
      this.pairStep(p.mtr, 'mtrMain', aux, dt, 1.0, 'M.TR OIL PUMP');
      this.pairStep(p.cw, 'cwMain', aux, dt, 2.0, 'MAIN COOLING WATER PUMP');
      this.pairStep(p.ssb, 'ssbMain', aux, dt, 1.5, 'SHAFT SEAL BOOSTER PUMP');
      this.pumpStep(p.qt, p.qtCmd, dt, 1.5);
      if (aux) { p.axT += dt; if (p.axT > 0.8) p.sh = false; } else { p.axT = 0; p.sh = p.speed < 0.05 ? true : p.sh; }
      if (p.vq) { p.vqT += dt; if (p.brakeCmd === 'release' && p.vqT > 60) { p.vq = false; this.log('INFO', 'DO0154 VACUUM CLEANER STOP'); } }

      const cw = (p.cw[0].run || p.cw[1].run) ? 1 : 0;
      p.f_lb = lag(p.f_lb, cw * (F.lgb_water_low ? 0.3 : 1), 3, dt);
      p.f_ac = lag(p.f_ac, cw, 3, dt);
      p.f_goc = lag(p.f_goc, cw, 3, dt);
      p.f_tb = lag(p.f_tb, cw, 3.5, dt);
      p.f_sc = lag(p.f_sc, cw * (F.ss_cool_low ? 0.25 : 1), 4, dt);
      const booster = p.ssb[0].run || p.ssb[1].run;
      p.sealP = lag(p.sealP, booster ? (F.ss_cool_low ? 0.6 : 1) : 0, 4, dt);
      p.genOil = lag(p.genOil, Math.min(1, 1.6 * p.speed), 2, dt);
      p.lift = lag(p.lift, p.qt.run ? 1 : 0, 2, dt);

      // tekanan oli governor (tangki tekanan, pompa load/unload)
      const govPump = p.qp[0].run || p.qp[1].run;
      const leak = 0.0015 + (F.gov_oil_leak ? 0.012 : 0) + Math.abs(p._gvMove || 0) * 0.02;
      p.govP = clamp(p.govP + ((govPump ? Math.min(0.008, 0.5 * (1.02 - p.govP)) : 0) - leak) * dt, 0.2, 1.02);
      if (!aux && !govPump) p.govP = Math.max(p.govP, 0.95);    // stand still: tangki dipertahankan
      p.govLvl = lag(p.govLvl, F.gov_oil_leak ? 0.6 : 1, 400, dt);

      // ---------------- rem, bypass, seal, inlet valve ----------------
      const bTgt = (p.brakeCmd === 'apply' || F.brake_stuck) ? 1 : 0;
      p.brake = rate(p.brake, bTgt, 1 / 3, dt);
      p.bypassCmd = p.ivCmd === 'open' && p.iv < 0.995 && p.seal > 0.01 ? true : (p.ivCmd === 'open' && p.iv < 0.995);
      if (p.ivCmd === 'open' && p.iv >= 0.995) p.bypassCmd = false;
      p.bypass = rate(p.bypass, p.bypassCmd && !F.bypass_stuck ? 1 : 0, 0.1, dt);
      if (p.iv < 0.01) { if (p.bypass > 0.01) p.dp -= p.dp * p.bypass * dt / 6; else if (p.seal > 0.99) p.dp = lag(p.dp, 1, 40, dt); }
      else p.dp = lag(p.dp, 0, 1, dt);
      p.dp = clamp(p.dp, 0, 1);
      if (p.ivCmd === 'open') {
        if (p.dp < 0.05) p.seal = rate(p.seal, 0, 0.25, dt);
        if (p.seal < 0.02) p.iv = Math.min(F.iv_stuck ? 0.6 : 1, p.iv + dt / 45);
      } else { p.iv = Math.max(0, p.iv - dt / 45); if (p.iv < 0.01) p.seal = rate(p.seal, 1, 0.25, dt); }
      const head = (1 - p.dp) * this.plant.headFactor();

      // ---------------- governor ----------------
      const isl = p.cb && !this.gridOK();
      if (isl && !p.islanded) { p.gvRate = 0.25; p.xi = Math.min(0.2, p.gv / 100); p.sref = 1; this.log('ALARM', 'KEHILANGAN JARINGAN – unit terisolasi (load rejection), governor → speed control'); }
      p.islanded = isl;
      let gvCmd = 0;
      const speedCtl = !p.cb || p.islanded;
      if (p.govOn && p.govP > 0.6 && !F.gov_runaway) {
        if (speedCtl) {
          if (!p.sync) p.sref = Math.min(rate(p.sref, 1, p.sref < 0.9 ? 0.03 : 0.008, dt), Math.max(p.speed + 0.05, Math.min(p.sref, 1.0)));
          const e = p.sref - p.speed;
          p.xi = clamp(p.xi + 0.35 * e * dt, 0, 0.2);
          gvCmd = clamp(p.xi + 3 * e, 0, 0.2) * 100;      // start opening limit ±20 %
        } else {
          let pset;
          if (sw.gov === 'OPENING') gvCmd = sw.opcSP;
          else {
            if (p.noLoad) p.pref = rate(p.pref, 0, 1.0, dt);
            else if (p.loadRaise || this.pos === 5) {
              const tgt = clamp(sw.ALR ? sw.alrSP : p.pref, sw.minP, sw.maxP);
              p.pref = rate(p.pref, tgt, 0.35, dt);
            }
            pset = p.pref;
            if (sw.AFC) pset += (50 - this.plant.sy.freq) / 50 / 0.04 * PR;
            const e = (pset - p.p) / PR;
            p.xp = clamp((p.xp || 0) + 0.15 * e * dt, -0.15, 0.15);
            gvCmd = clamp(invInterp(GV_MW, pset) + 100 * (p.xp + 0.4 * e), 0, 100);
            if (p.noLoad && p.pref <= 0.01) gvCmd = GV_NL;
          }
        }
      }
      gvCmd = Math.min(gvCmd, p.gvLim);
      const gv0 = p.gv;
      if (!F.gov_runaway || !p.govOn) {
        const r = gvCmd < p.gv ? Math.max(p.gvRate, 0.08) * 100 : 8;
        p.gv = rate(p.gv, gvCmd, r, dt);
      }
      if (F.gov_runaway && !p.govOn && (this.lo['86-2'] || this.lo['86-1'])) p.gv = rate(p.gv, 0, 25, dt);   // 20SD emergency stop solenoid
      p._gvMove = (p.gv - gv0) / Math.max(dt, 1e-6) / 100;
      if (!p.govOn && p.gv < 0.1) p.gvRate = 0.08;

      // ---------------- turbin & rotor ----------------
      const tm = head * interp(GV_MW, p.gv) / PR;            // pu daya pada n=1
      p.pm = lag(p.pm, tm * (1.5 - 0.5 * Math.min(p.speed, 1.6)), 1.2, dt);
      // eksitasi
      if (p.excOn && !F.fcb_fail && !this.lo['86-1']) { p.fcbT += dt; if (p.fcbT > 1.5 && !p.fcb) { p.fcb = true; this.log('INFO', `${this.n}DI0078 41 FIELD BREAKER CLOSED`); } }
      else if (!p.excOn) { p.fcbT = 0; if (p.fcb) { p.fcb = false; this.log('INFO', `${this.n}DI0079 41 FIELD BREAKER OPEN`); } }
      const sp = Math.max(p.speed, 0.3);
      if (p.fcb) {
        let ft;
        if (F.gen_40) ft = 0.05;
        else if (F.gen_59) ft = p.cb && !p.islanded ? 4 : 1.2 / sp;   // AVR macet di arah naik (over-excitation)
        else if (p.cb && !p.islanded) {
          const qT = p.qZero ? 0 : (sw.AQR && sw.AVR === 'AUTO' ? (sw.AQRC === 'AUTO' ? sw.aqrA + sw.aqrB * p.p : sw.aqrSP) : p.qref);
          p.qref = rate(p.qref, qT, 1.0, dt);
          ft = 1 + p.qref / 42;
        } else ft = clamp(p.vref / sp, 0, 1.6);
        p.field = rate(p.field, ft, ft < p.field ? 0.6 : 0.12, dt);   // de-eksitasi cepat (negative ceiling thyristor), penguatan dibatasi
      } else p.field = rate(p.field, 0, 0.6, dt);

      if (p.cb && !p.islanded) {
        p.speed = this.plant.sy.freq / 50;
        p.p = p.pm * p.speed * PR + noise(0.05);
        p.vt = 1 + 0.05 * (p.field - 1) - 0.01;
        p.q = (p.field - 1) * 42 + (F.gen_40 ? -0.9 * PR * (1 - p.field) : 0) + noise(0.05);
        p.phase = 0;
      } else {
        // p.pm = torsi turbin (pu); gesekan + rugi angin + rugi besi (∝ V²)
        const tfric = 0.02 * p.speed + 0.022 * p.speed * p.speed + 0.004 * p.vt * p.vt;
        let acc = (p.pm - tfric) / (2 * 3.0);
        p.speed += acc * dt;
        if (p.brake > 0.5 && p.speed > 0) p.speed = Math.max(0, p.speed - 0.004 * p.brake * dt);
        p.speed = Math.max(0, p.speed);
        p.vt = p.field * p.speed; p.p = p.cb ? 0.3 + noise(0.05) : 0; p.q = p.cb ? (p.field - 1) * 5 : 0;
      }
      if (p.speed < 0.003 && p.pm <= 0.02) p.speed = 0;
      p.zeroT = p.speed < 0.005 ? p.zeroT + dt : 0;

      // ---------------- auto synchronizer ----------------
      if (!p.cb) {
        const slip = p.speed - this.plant.sy.freq / 50;
        p.phase = ((p.phase + slip * 50 * 360 * dt) % 360 + 540) % 360 - 180;
        p.sR = p.sL = p.vR = p.vL = false;
        if (p.sync && p.fcb) {
          const nT = this.plant.sy.freq / 50 + 0.1 / 50;
          if (p.sref < nT - 0.0002) p.sR = true; else if (p.sref > nT + 0.0002) p.sL = true;
          p.sref = rate(p.sref, nT, 0.001, dt);
          const dv = p.vt - this.plant.sy.vbus(this.n) / 150;
          if (dv < -0.01) { p.vref += 0.02 * dt; p.vR = true; } else if (dv > 0.03) { p.vref -= 0.02 * dt; p.vL = true; }
          const ok = slip > 0.0004 && slip < 0.003 && Math.abs(dv) < 0.05 && p.phase > -8 && p.phase < 2 && this.gridOK();
          if (ok && !F.sync_fail && !this.anyLO()) {
            p.cb = true; p.sync = false; p.xp = 0; p.pref = Math.max(p.p, 2); p.loadRaise = false;
            this.sw.gov = 'POWER';
            this.log('OK', `${this.n}DI0090 52 CLOSE – slip ${f1(slip * 50, 3)} Hz, ΔV ${f1(dv * 100, 1)}%`);
            this.setDO('DO0121', 'ISO OFF');
            p.pref = 2;  // GOV takes ±2 MW (Control Detail)
          }
        }
      }

      // ---------------- suhu & vibrasi ----------------
      if (F.thrust_temp) F.thrust_temp.v = Math.min(30, F.thrust_temp.v + dt * 0.25);
      if (F.lgb_water_low) F.lgb_water_low.v = Math.min(10, F.lgb_water_low.v + dt * 0.05);
      if (F.tgb_vib) F.tgb_vib.v = Math.min(260, F.tgb_vib.v + dt * 2.5);
      if (F.gov_sump_temp) F.gov_sump_temp.v = Math.min(30, F.gov_sump_temp.v + dt * 0.08);    // 1ST 60 °C ≈ 3 menit, 2ND 65 °C ≈ 4 menit
      if (F.tgb_oil_low) F.tgb_oil_low.v = Math.min(0.7, F.tgb_oil_low.v + dt * 0.002);       // 1ST (<80 %) ≈ 100 s, 2ND (<60 %) ≈ 200 s
      const Ts = this.steadyTemps(), T = p.T;
      for (const k of Object.keys(Ts)) if (k !== 'st') T[k] = lag(T[k], Ts[k], k === 'thrust' && F.thrust_temp ? 8 : 60, dt);
      Ts.st.forEach((v, i) => T.st[i] = lag(T.st[i], v, 120, dt));
      const Vs = this.steadyVib();
      for (const k of Object.keys(Vs)) p.vib[k] = lag(p.vib[k], Vs[k] * (1 + noise(0.03)), 2, dt);
      if (F.mtr_buchholz) p.bh += dt;
    }

    /* ======================= PROTEKSI ======================= */
    protection(dt) {
      const p = this.p, F = this.fx, m = p.mon;
      const timed = (key, cond, delay) => { m[key] = cond ? (m[key] || 0) + dt : 0; return m[key] >= delay; };
      const act = { '86-1': false, '86-2': false, '86-4': false, '86-5': false, '86-T': false, '86-PC': false };
      const trip = (k, cause) => { act[k] = true; if (!this.lo[k]) this.operate86(k, cause); };
      const running = p.speed > 0.3;
      const s14L = p.speed < 0.005;                               // DI0143 UNIT COMPLETELY STOP (14L)
      const s13_2 = p.speed > 0.9;                                // DI0142 TURBINE SPEED > 90 %
      // JEZ2K031 SH.003: proteksi aliran air diaktifkan 30 s setelah pompa CW main A/B start, di-reset oleh 14L (reset dominan)
      const cwRun = p.cw[0].run || p.cw[1].run;
      m.cwT = cwRun ? (m.cwT || 0) + dt : 0;
      if (s14L) m.cwArm = false; else if (m.cwT >= 30) m.cwArm = true;
      // ================= 86-5 DAMAGE PREVENTIVE STOP (JEZ2K031 SH.003, software LCU) =================
      if (p.T.thrust > 70) trip('86-5', 'THRUST BEARING TEMP. HIGH 1ST (DI0097)');
      if (p.T.ugb > 70) trip('86-5', 'UPPER GUIDE BEARING TEMP. HIGH 1ST (DI0098)');
      if (p.T.lgb > 70) trip('86-5', 'LOWER GUIDE BEARING TEMP. HIGH 1ST (DI0099)');
      if (p.T.tgb > 70) trip('86-5', 'TURBINE GUIDE BEARING TEMP. HIGH 1ST (DI0211)');
      if (F.brg_oil_low && s13_2) trip('86-5', 'LOWER GUIDE BEARING OIL LEVEL LOW (DI0101) AND n > 90 %');
      if (F.gen_64e && p.fcb) trip('86-5', 'GENERATOR FIELD GROUND FAULT 64E (DI0123)');
      if (Math.max(p.vib.tgx, p.vib.tgy) > 200) trip('86-5', 'SHAFT RUN-OUT TRIP (TURBINE SHAFT) (DI0330/0332)');
      if (timed('gp1', p.govP < 0.85, 2)) trip('86-5', 'GOV. OIL SYSTEM PRESSURE LOW 1ST (DI0159)');
      if (p.govLvl < 0.85) trip('86-5', 'GOV. PRESSURE TANK OIL LEVEL LOW 1ST (DI0203)');
      if (this.govSumpT() > 60) trip('86-5', 'GOV. SUMP TANK OIL TEMPERATURE HIGH 1ST (DI0151)');
      if (this.tgbOilLvl() < 0.8) trip('86-5', 'TURBINE GUIDE BEARING OIL LEVEL LOW (DI0213)');
      if (timed('tbw', m.cwArm && p.f_tb < 0.4, 120)) trip('86-5', 'TURBINE BEARING WATER FLOW LOW (DI0236, 2 min)');
      if (timed('ssw', m.cwArm && p.f_sc < 0.4, 120)) trip('86-5', 'SHAFT SEAL COOLING WATER FLOW LOW (DI0240, 2 min)');
      if (timed('intake', this.plant.intakeWL < 577.51, 5)) trip('86-5', 'INTAKE WATER LEVEL < El.577.51 m (RTU-I)');
      // ================= 86-2 QUICK STOP (SH.001 + SH.002 LOT-IIIA) =================
      if (F.manual_5e) trip('86-2', 'EMERGENCY STOP SWITCH ULCB (DI0039)');
      if (F.gen_fire) trip('86-2', 'GENERATOR FIRE (DI0314)');
      if (p.T.thrust > 75) trip('86-2', 'THRUST BEARING TEMP. HIGH 2ND (DI0183)');
      if (p.T.ugb > 75) trip('86-2', 'UPPER GUIDE BEARING TEMP. HIGH 2ND (DI0181)');
      if (p.T.lgb > 75) trip('86-2', 'LOWER GUIDE BEARING TEMP. HIGH 2ND (DI0182)');
      if (F.gov_fault && (p.govOn || running)) trip('86-2', 'GOVERNOR FAULT (DI0129)');
      if (p.speed > 1.40) trip('86-2', 'OVER SPEED (ELECTRICAL) (DI0130)');
      if (p.speed > 1.45) { m.pendulum = true; trip('86-2', 'OVER SPEED (MECHANICAL) 33-12M (DI0217)'); }
      if (timed('gp2', p.govP < 0.75, 1)) trip('86-2', 'GOV. SUMP TANK OIL PRESSURE LOW 2ND (DI0155)');
      if (p.govLvl < 0.75) trip('86-2', 'GOV. PRESSURE TANK OIL LEVEL LOW 2ND (DI0204)');
      if (this.govSumpT() > 65) trip('86-2', 'GOV. SUMP TANK OIL TEMPERATURE HIGH 2ND (DI0152)');
      if (this.tgbOilLvl() < 0.6) trip('86-2', 'TURBINE GUIDE BEARING OIL LEVEL LOW 2ND (DI0212)');
      // ================= 86-1 EMERGENCY STOP (SH.001 + SH.002 LOT-IIIC) =================
      if (F.gen_87 && p.vt > 0.3) trip('86-1', 'GENERATOR DIFFERENTIAL 87 (DI0116)');
      if (F.gen_40 && p.cb && timed('g40', p.q < -0.35 * PR, 1)) trip('86-1', 'GENERATOR LOSS OF FIELD 40 (DI0124)');
      if (F.gen_46 && p.cb && timed('g46', true, 1)) trip('86-1', 'NEGATIVE SEQUENCE OVERCURRENT 46 (DI0125)');
      if (F.exc_51e && p.fcb) trip('86-1', 'OVERCURRENT RELAY FOR EXCITATION CIRCUIT 51E (DI0126)');
      if (F.exc_heavy && p.excOn) trip('86-1', 'EXCITATION SYSTEM HEAVY FAULT (DI0082)');
      // ================= 86-4 NO-LOAD & EXCITATION (SH.001: 51, 59, 27) =================
      if (F.gen_51 && p.cb && timed('g51', true, 1.5)) trip('86-4', 'GENERATOR OVER CURRENT 51 (DI0118)');
      if (timed('g59', p.vt > 1.12, 2)) trip('86-4', 'GENERATOR OVERVOLTAGE 59 (DI0121)');
      if (F.gen_27 && p.cb && this.sw.s43CH !== 'USE' && timed('g27', true, 3)) trip('86-4', 'GENERATOR UNDERVOLTAGE 27 (DI0122)');
      // ================= 86-T (LOT-IIIC, ditambah 86-1) =================
      if (F.mtr_87t) trip('86-T', 'M.TR DIFFERENTIAL (DI0257)');
      if (F.mtr_buchholz && p.bh > 60) trip('86-T', 'M.TR BUCHHOLZ TRIP (DI0265)');
      // ================= OUTPUT HARDWIRED (SH.001) =================
      // 52 TRIP = 86-1 OR 86-4 OR (86-2 AND GUIDE VANE NO-LOAD OPENING)
      if (p.cb && this.lo['86-2'] && this.s74mb()) this.openCB('86-2 AND GUIDE VANE NO-LOAD OPENING (74mb)');
      // 41 TRIP = (86-1 OR 86-2) AND 52 OPEN
      if (!p.cb && (this.lo['86-1'] || this.lo['86-2']) && (p.excOn || p.fcb)) {
        p.excOn = false; p.sync = false; this.log('ALARM', `${this.n}: FIELD CIRCUIT BREAKER (41) TRIP – ${this.lo['86-1'] ? '86-1' : '86-2'} AND 52 OPEN`);
      }
      m.active = act;
      // alarm sekuens error dihapus bila transisi berjalan ulang
      if (!this.tr || !this.tr.fail) m.seqErr = null;
    }

    /* ======================= TICK ======================= */
    tick(dt) { this.sequence(dt); this.physics(dt); this.protection(dt); }

    /* ======================= ANALOG / OUTPUT ======================= */
    meas() {
      const p = this.p, sy = this.plant.sy;
      const kv = p.vt * VKV * 0.99;
      const S = Math.hypot(p.p, p.q);
      const I = kv > 0.5 && p.cb ? S * 1000 / (Math.sqrt(3) * kv) : 0;
      const If = p.fcb ? 520 * Math.min(p.vt / Math.max(p.speed, 0.3), 1.3) + (p.cb ? 8 * Math.max(-20, p.q) + 4 * p.p : 0) : 0;
      return {
        p: p.p, q: p.q, kv, I, Ir: I * 0.985, Is: I * 0.97, It: I * 1.005, rpm: p.speed * RPM, speed: p.speed * 100,
        gv: p.gv, gvLim: p.gvLim, iv: p.iv * 100, bypass: p.bypass * 100, If, Vf: If * 0.0922,
        flow: p.speed > 0.05 ? Math.max(0, (p.iv > 0.5 ? 0.6 : 0) + p.p * 0.293 + (p.gv > 1 && !p.cb ? p.gv * 0.08 : 0)) : 0,
        spiral: (1 - p.dp) * (this.plant.intakeWL - 173.5 + 0) * 0.977 + (p.dp) * 0, penstock: (this.plant.intakeWL - 173.5) * 0.976,
        freq: p.speed * 50, slip: (p.speed - sy.freq / 50) * 50, phase: p.phase, dv: (p.vt - sy.vbus(this.n) / 150) * 100,
        govP: p.govP * 100, sref: p.sref * 100, pref: p.pref, field: p.field * 100,
      };
    }
  }

  /* ===================================================================== */
  /*  SWITCHYARD 150 kV                                                    */
  /* ===================================================================== */
  class Switchyard {
    constructor(plant) {
      this.plant = plant;
      this.st = {
        '189-L1E': false, '189-L1': true, '152-L1': true, '189-L1A': true, '189-L1B': false,
        '189-L2E': false, '189-L2': true, '152-L2': true, '189-L2A': false, '189-L2B': true,
        '189-BTA': true, '189-BTB': true, '152-BT': true,
        '189-U3A': true, '189-U3B': false, '152-U3': true,
        '189-U2A': false, '189-U2B': true, '152-U2': true,
        '189-U1A': true, '189-U1B': false, '152-U1': true,
        '189-LSTA': true, '189-LSTB': false, '152-LST': true,
      };
      this.lineOK = { L1: true, L2: true };       // sumber GI New Curup tersedia
      this.busFault = { A: false, B: false };
      this.sel = { L1ar: true, L2ar: true, busProt: true, s143STEP: 'REMOTE', s143R: 'REMOTE' };
      this.freq = 50.0; this.fT = 0;
      this.reclose = {};
      this.tap = 8;
    }
    isCB(d) { return d.startsWith('152'); }
    /* energisasi bus */
    busLive() {
      const s = this.st;
      const lineTo = (L) => (s['152-' + L] && s['189-' + L] && this.lineOK[L]) ? { A: s[`189-${L}A`], B: s[`189-${L}B`] } : { A: false, B: false };
      let A = false, B = false;
      for (const L of ['L1', 'L2']) { const x = lineTo(L); A = A || x.A; B = B || x.B; }
      const tie = s['152-BT'] && s['189-BTA'] && s['189-BTB'];
      if (tie) { const ab = A || B; A = ab; B = ab; }
      if (this.busFault.A) A = false; if (this.busFault.B) B = false;
      return { A, B, tie };
    }
    unitBus(n) { const s = this.st; return s[`189-U${n}A`] ? 'A' : s[`189-U${n}B`] ? 'B' : null; }
    unitOnGrid(n) { const s = this.st, b = this.unitBus(n); if (!b || !s['152-U' + n]) return false; return this.busLive()[b]; }
    vbus(n) { const lv = this.busLive(); const b = this.unitBus(n) || 'A'; return lv[b] ? (b === 'A' ? 154.3 : 154.0) : 150; }
    /* interlock (JEZ1L699 SH.007 dst.) */
    interlock(dev, close) {
      const s = this.st;
      if (this.isCB(dev)) {
        if (!close) return null;
        if (dev === '152-BT') return (s['189-BTA'] && s['189-BTB']) ? null : '189-BTA dan 189-BTB harus CLOSE';
        const m = dev.match(/^152-(U\d|L\d|LST)$/); const b = m[1];
        const dsA = s[`189-${b}A`], dsB = s[`189-${b}B`];
        if (!(dsA || dsB)) return `189-${b}A atau 189-${b}B harus CLOSE`;
        if (b.startsWith('L') && !s['189-' + b]) return `189-${b} harus CLOSE`;
        if (b.startsWith('L') && s[`189-${b}E`]) return `Earth switch 189-${b}E masih CLOSE`;
        if (b.startsWith('U')) { const u = this.plant.units[+b[1] - 1]; if (u.p.cb) return `52-${b[1]} (CB generator) harus OPEN`; if (u.lo['86-T']) return '86-T operate'; }
        return null;
      }
      // DS
      const m = dev.match(/^189-(U\d|L\d|LST|BT)(A|B|E)?$/);
      const bay = m[1], side = m[2];
      if (side === 'E') { if (close && s['189-' + bay]) return `189-${bay} harus OPEN`; return null; }
      const cb = bay === 'BT' ? '152-BT' : '152-' + bay;
      if (s[cb]) return `${cb} harus OPEN`;
      if (close && (side === 'A' || side === 'B') && bay !== 'BT') {
        const other = side === 'A' ? 'B' : 'A';
        if (s[`189-${bay}${other}`]) return `189-${bay}${other} harus OPEN`;
      }
      if (close && !side && s[`189-${bay}E`]) return `Earth switch 189-${bay}E masih CLOSE`;
      return null;
    }
    operate(dev, close) {
      if (this.st[dev] === close) return 'Sudah pada posisi tersebut';
      const why = this.interlock(dev, close);
      if (why) { this.plant.log('ALARM', `SY: ${dev} ${close ? 'CLOSE' : 'OPEN'} ditolak – interlock: ${why}`); return why; }
      this.st[dev] = close;
      this.plant.log('CMD', `SY: ${dev} ${close ? 'CLOSE' : 'OPEN'}`);
      return null;
    }
    trip(dev, why) {
      if (!this.st[dev]) return;
      this.st[dev] = false;
      this.plant.log('ALARM', `SY: ${dev} TRIP – ${why}`);
    }
    tick(dt) {
      // frekuensi jaringan (fluktuasi kecil)
      this.fT += dt;
      if (this.fT > 2) { this.fT = 0; this.fTarget = 50 + noise(0.15); }
      this.freq = lag(this.freq, this.fTarget || 50, 20, dt);
      // auto reclose
      for (const L of Object.keys(this.reclose)) {
        const r = this.reclose[L]; r.t += dt;
        if (r.t > 1.0 && !r.done) {
          r.done = true;
          if (r.perm) { this.plant.log('ALARM', `SY: 152-${L} AUTO RECLOSE GAGAL → LOCKOUT`); }
          else { this.st['152-' + L] = true; this.lineOK[L] = true; this.plant.log('OK', `SY: 152-${L} AUTO RECLOSE SUCCESS`); }
          delete this.reclose[L];
        }
      }
    }
    flows() {
      // pembagian daya ke T/L (bus-tie menyatukan kedua bus)
      const s = this.st, lv = this.busLive();
      const units = this.plant.units.map(u => ({ n: u.n, bus: this.unitBus(u.n), on: this.unitOnGrid(u.n) && u.p.cb, p: u.p.p, q: u.p.q }));
      const lst = s['152-LST'] && lv[s['189-LSTA'] ? 'A' : 'B'] ? 0.5 : 0;
      const lines = ['L1', 'L2'].filter(L => s['152-' + L] && s['189-' + L] && this.lineOK[L]).map(L => ({ L, bus: s[`189-${L}A`] ? 'A' : 'B' }));
      const res = { L1: { p: 0, q: 0 }, L2: { p: 0, q: 0 }, BT: 0 };
      const tot = units.filter(u => u.on).reduce((a, u) => ({ p: a.p + u.p, q: a.q + u.q }), { p: -lst, q: -0.3 });
      if (lv.tie || lines.length < 2) {
        if (lines.length) lines.forEach(l => { res[l.L].p = tot.p / lines.length; res[l.L].q = tot.q / lines.length; });
        // arus bus-tie: selisih injeksi bus A terhadap saluran bus A
        const injA = units.filter(u => u.on && u.bus === 'A').reduce((a, u) => a + u.p, 0) - (s['189-LSTA'] ? lst : 0);
        const outA = lines.filter(l => l.bus === 'A').reduce((a, l) => a + res[l.L].p, 0);
        res.BT = lv.tie ? Math.abs(injA - outA) * 1000 / (Math.sqrt(3) * 154) : 0;
      } else {
        for (const l of lines) { const inj = units.filter(u => u.on && u.bus === l.bus); res[l.L].p = inj.reduce((a, u) => a + u.p, 0); res[l.L].q = inj.reduce((a, u) => a + u.q, 0); }
      }
      res.tot = tot; res.lst = lst;
      return res;
    }
  }

  /* ===================================================================== */
  /*  PLANT                                                                */
  /* ===================================================================== */
  class Plant {
    constructor() { this.t = 0; this.events = []; this.seq = 0; this.build(); }
    build() {
      this.units = [1, 2, 3].map(n => new Unit(n, this));
      this.sy = new Switchyard(this);
      this.intakeWL = 578.60; this.inflow = 14.6; this.cwIn = 27.3;
      this.fx = {};
      this.alarms = new AlarmSystem(this);
    }
    headFactor() { return clamp((this.intakeWL - 173.5) / (578.6 - 173.5), 0.9, 1.02); }
    log(type, msg) {
      this.events.push({ id: ++this.seq, t: this.t, type, msg });
      if (this.events.length > 600) this.events.splice(0, this.events.length - 600);
    }
    /* ---- skenario awal ---- */
    initAllStop() {
      this.build();
      this.units.forEach(u => { u.p.zeroT = 99; });
      this.log('CMD', 'INIT: semua unit STAND STILL, switchyard normal');
    }
    initOperating() {
      this.initAllStop();
      const LD = [[70.0, 10.0], [70.0, 10.0], [70.0, 10.0]];   // beban penuh (rating 70 MW) untuk seluruh unit
      this.units.forEach((u, i) => u.forceLoad(LD[i][0], LD[i][1]));
      this.alarms.reset(true);
      this.log('CMD', 'INIT: kondisi operasi beban penuh (U1 / U2 / U3 = 70 MW)');
    }
    /* ---- injeksi gangguan ---- */
    inject(key, unitN) {
      const s = SCN[key]; if (!s) return;
      if (s.unit) {
        const u = this.units[(unitN || 1) - 1];
        if (u.fx[key]) { delete u.fx[key]; this.log('INFO', `FAULT CLEAR U${u.n}: ${s.name}`); return; }
        u.fx[key] = { t0: this.t, v: 0 };
        this.log('ALARM', `FAULT INJECT U${u.n}: ${s.name}`);
        // gangguan yang efeknya baru muncul pada kondisi tertentu – beri tahu instruktur bila unit belum di kondisi itu
        const NEED = { lgb_water_low: ['rot', 'unit berputar (bearing baru memanas saat berputar)'], thrust_temp: ['rot', 'unit berputar'], tgb_vib: ['rot', 'unit berputar'],
          gov_runaway: ['gov', 'governor start (step RUNNING)'], gen_87: ['exc', 'generator bertegangan (step EXCITATION ke atas)'], gen_64e: ['exc', 'field breaker 41 tertutup'],
          exc_heavy: ['exc', 'eksitasi ON'], gen_40: ['cb', '52 tertutup (paralel jaringan)'], gen_46: ['cb', '52 tertutup (paralel jaringan)'],
          gen_51: ['cb', '52 tertutup (relay 51 diblok saat 52 open)'], gen_27: ['cb', '52 tertutup (relay 27 diblok saat 52 open)'], gen_59: ['exc', 'eksitasi ON'],
          exc_51e: ['exc', 'field breaker 41 tertutup'], gov_fault: ['gov', 'governor start (step RUNNING)'], brg_oil_low: ['n90', 'putaran > 90 % (DI0142)'],
          cw_both_fail: ['cwarm', 'unit berputar (proteksi aliran di-arm 30 s setelah pompa CW start, di-reset 14L)'], ss_cool_low: ['cwarm', 'unit berputar (proteksi aliran di-arm 30 s setelah pompa CW start, di-reset 14L)'],
          cw_main_trip: ['ax', '1AX ON (pompa aux. berjalan)'], gov_pump_trip: ['ax', '1AX ON (pompa aux. berjalan)'] };
        const nd = NEED[key];
        if (nd) {
          const p = u.p, met = { rot: p.speed > 0.3, gov: p.govOn, exc: p.excOn || p.vt > 0.3, cb: p.cb, ax: p.ax, n90: p.speed > 0.9, cwarm: !!p.mon.cwArm }[nd[0]];
          if (!met) this.log('INFO', `U${u.n}: gangguan aktif, tetapi proteksinya baru bekerja saat ${nd[1]} – unit saat ini di step ${STEP[u.pos]}`);
        }
        if (key === 'gov_runaway') { if (u.p.cb) u.openCB('Load rejection (skenario)'); }
        if (key === 'gen_40') u.p.field = Math.min(u.p.field, 0.6);
      } else {
        if (this.fx[key]) { delete this.fx[key]; this.log('INFO', `FAULT CLEAR: ${s.name}`); if (key === 'busa_fault') this.sy.busFault.A = false; if (key === 'tl_both') { this.sy.lineOK.L1 = this.sy.lineOK.L2 = true; } if (key === 'tl1_perm') this.sy.lineOK.L1 = true; return; }
        this.fx[key] = { t0: this.t };
        this.log('ALARM', `FAULT INJECT: ${s.name}`);
        const sy = this.sy;
        if (key === 'tl1_trip' || key === 'tl1_perm') {
          sy.trip('152-L1', 'T/L No.1 line protection (21/87L)'); sy.lineOK.L1 = false;
          if (sy.sel.L1ar) sy.reclose.L1 = { t: 0, perm: key === 'tl1_perm' };
          if (key === 'tl1_trip') delete this.fx[key];
        }
        if (key === 'tl_both') { sy.trip('152-L1', 'line protection'); sy.trip('152-L2', 'line protection'); sy.lineOK.L1 = sy.lineOK.L2 = false; }
        if (key === 'busa_fault') {
          if (sy.sel.busProt) for (const d of ['152-L1', '152-U1', '152-U3', '152-LST', '152-BT', '152-U2', '152-L2']) {
            const bay = d.slice(4); const onA = d === '152-BT' || sy.st[`189-${bay}A`]; if (onA) sy.trip(d, 'BUS BAR PROTECTION (bus A)');
          }
          sy.busFault.A = true;
        }
      }
    }
    activeFault(key, n) { return SCN[key].unit ? !!this.units[n - 1].fx[key] : !!this.fx[key]; }
    clearAllFaults() { this.units.forEach(u => u.fx = {}); this.fx = {}; this.sy.busFault = { A: false, B: false }; this.sy.lineOK = { L1: true, L2: true }; this.log('INFO', 'Semua gangguan dihapus'); }

    tick(dt) {
      dt = clamp(+dt || 0, 0, 60);
      const h = 0.05, n = Math.ceil(dt / h);
      for (let i = 0; i < n; i++) {
        const st = Math.min(h, dt - i * h); if (st <= 0) break;
        this.t += st;
        this.sy.tick(st);
        this.units.forEach(u => u.tick(st));
        // muka air intake
        const qT = this.units.reduce((a, u) => a + u.meas().flow, 0);
        let net = this.inflow - qT;
        if (this.fx.intake_low) net -= 900;   // drawdown dipercepat (latihan)
        const V = volIntake(this.intakeWL) + net * st;
        // invers kurva volume (newton 2 iterasi)
        let x = this.intakeWL; for (let k = 0; k < 2; k++) { const fx = volIntake(x) - V, d = (2 * 189.475 * x - 218232.925) * 1000; x -= fx / d; }
        this.intakeWL = clamp(x, 574.0, 579.4);
        this.alarms.tick(st);
      }
    }
  }

  /* ===================================================================== */
  /*  ALARM & ANNUNCIATOR 30F                                              */
  /* ===================================================================== */
  // [window, tag(DI), teks, H/L, kondisi(u, plant), delay]
  const UNIT_POINTS = [
    ['A2', 'DI0113', 'LOCK OUT RELAY 86-1 OPERATE', 'H', u => u.lockout('86-1')],
    ['A3', 'DI0114', 'LOCK OUT RELAY 86-2 OPERATE', 'H', u => u.lockout('86-2')],
    ['A4', 'DI0115', 'LOCK OUT RELAY 86-4 OPERATE', 'H', u => u.lockout('86-4')],
    ['A5', 'SH013-1', 'LOCK OUT RELAY 86-5 OPERATE', 'H', u => u.lockout('86-5')],
    ['A6', 'DI0257', 'MTR. DIFFERENTIAL RELAY TRIP', 'H', u => !!u.fx.mtr_87t],
    ['A7', 'DI0258', 'POWER CABLE DIFFERENTIAL RELAY TRIP', 'H', u => u.lockout('86-PC')],
    ['A8', 'DI0039', '5E ON ULCB', 'H', u => !!u.fx.manual_5e],
    ['B1', 'DI0116', 'GEN.DEFFERENTIAL FOR STATOR WINDING (87)', 'H', u => !!u.fx.gen_87 && (u.p.vt > 0.3 || !!u.lo['86-1'])],
    ['B1', 'DI0123', 'GEN. FIELD GROUND (64E)', 'H', u => !!u.fx.gen_64e && (u.p.fcb || !!u.lo['86-5'])],
    ['B1', 'DI0124', 'GEN. LOSS OF FIELD (40)', 'H', u => !!u.fx.gen_40 && u.p.q < -0.35 * PR],
    ['B1', 'DI0125', 'NEGATIVE SEQUENCE OVER CURRENT (46)', 'H', u => !!u.fx.gen_46 && (u.p.cb || !!u.lo['86-1'])],
    ['B1', 'DI0118', 'GENERATOR OVER CURRENT (51)', 'H', u => !!u.fx.gen_51 && (u.p.cb || !!u.lo['86-4'])],
    ['B1', 'DI0121', 'GENERATOR OVERVOLTAGE (59)', 'H', u => u.p.vt > 1.12, 2],
    ['B1', 'DI0122', 'GENERATOR UNDERVOLTAGE (27)', 'H', u => !!u.fx.gen_27 && (u.p.cb || !!u.lo['86-4'])],
    ['B2', 'DI0261', 'MTR. BUCHHOLZ ALARM', 'L', u => !!u.fx.mtr_buchholz],
    ['B2', 'DI0004', 'MTR. BUCHHOLZ TRIP', 'H', u => !!u.fx.mtr_buchholz && u.p.bh > 60],
    ['B3', 'DI0082', 'EXCITATION SYSTEM HEAVY FAULT', 'H', u => !!u.fx.exc_heavy && (u.p.excOn || !!u.lo['86-1'])],
    ['B3', 'DI0126', 'OVERCURRENT RELAY FOR EXCITATION CIRCUIT (51E)', 'H', u => !!u.fx.exc_51e && (u.p.fcb || !!u.lo['86-1'])],
    ['B4', 'DI0217', 'OVER SPEED (MECHANICAL) – PENDULUM 33-12M TRIPPED', 'H', u => !!u.p.mon.pendulum],
    ['B4', 'DI0130', 'OVER SPEED (ELECTRICAL)', 'H', u => u.p.speed > 1.4],
    ['B4', 'DI0129', 'GOVERNOR FAULT', 'H', u => !!u.fx.gov_fault],
    ['B5', 'DI0230', 'INLET VALVE PRESSURE HIGH', 'L', u => false],
    ['B8', 'DI0314', 'GENERATOR FIRE', 'H', u => !!u.fx.gen_fire],
    ['B8', 'DI0166', 'GEN. FIRE PROTECTION EQUIPMENT OPERATE', 'H', u => !!u.fx.gen_fire],
    ['C1', 'DI0107', 'LOWER GUIDE BEARING WATER FLOW LOW', 'L', u => u.p.ax && u.p.axT > 15 && u.p.f_lb < 0.6, 2],
    ['C1', 'DI0099', 'LOWER GUIDE BEARING TEMPERATURE HIGH 1ST', 'L', u => u.p.T.lgb > 70],
    ['C1', 'DI0182', 'LOWER GUIDE BEARING METAL TEMPERATURE HIGH 2ND', 'H', u => u.p.T.lgb > 75],
    ['C1', 'DI0101', 'LOWER GUIDE BEARING OIL LEVEL LOW', 'L', u => !!u.fx.brg_oil_low],
    ['C2', 'DI0098', 'UPPER GUIDE BEARING TEMPERATURE HIGH 1ST', 'L', u => u.p.T.ugb > 70],
    ['C2', 'DI0181', 'UPPER GUIDE BEARING TEMPERATURE HIGH 2ND', 'H', u => u.p.T.ugb > 75],
    ['C3', 'DI0211', 'TURBINE BEARING METAL TEMPERATURE HIGH 1ST', 'L', u => u.p.T.tgb > 70],
    ['C3', 'DI0213', 'TURBINE GUIDE BEARING OIL LEVEL LOW', 'L', u => u.tgbOilLvl() < 0.8],
    ['C3', 'DI0212', 'TURBINE GUIDE BEARING OIL LEVEL LOW 2ND', 'H', u => u.tgbOilLvl() < 0.6],
    ['C3', 'DI0236', 'TURBINE BEARING WATER FLOW LOW', 'H', u => u.p.ax && u.p.axT > 15 && u.p.f_tb < 0.6, 2],
    ['C4', 'DI0097', 'THRUST BEARING TEMPERATURE HIGH 1ST', 'L', u => u.p.T.thrust > 70],
    ['C4', 'DI0183', 'THRUST BEARING METAL TEMPERATURE HIGH 2ND', 'H', u => u.p.T.thrust > 75],
    ['C5', 'DI0106', 'GEN. OIL COOLER OIL FLOW LOW', 'L', u => u.p.speed > 0.6 && u.p.genOil < 0.5],
    ['C5', 'DI0109', 'GEN. OIL COOLER WATER FLOW LOW', 'L', u => u.p.ax && u.p.axT > 15 && u.p.f_goc < 0.6, 2],
    ['C6', 'DI0108', 'AIR COOLER WATER FLOW LOW', 'L', u => u.p.ax && u.p.axT > 15 && u.p.f_ac < 0.6, 2],
    ['C6', 'DI0184', 'AIR COOLER OUTLET TEMPERATURE HIGH', 'L', u => u.p.T.acOut > 45],
    ['D1', 'DI0151', 'GOV. SUMP TANK OIL TEMPERATURE HIGH 1ST', 'L', u => u.govSumpT() > 60],
    ['D1', 'DI0152', 'GOV. SUMP TANK OIL TEMPERATURE HIGH 2ND', 'H', u => u.govSumpT() > 65],
    ['D2', 'DI0159', 'GOVERNOR PRESSURE OIL SYSTEM PRESSURE LOW 1ST', 'H', u => u.p.govP < 0.85],
    ['D2', 'DI0155', 'GOVERNOR PRESSURE OIL SYSTEM PRESSURE LOW 2ND', 'H', u => u.p.govP < 0.75],
    ['D2', 'DI0203', 'GOVERNOR PRESSURE TANK OIL LEVEL LOW 1ST', 'L', u => u.p.govLvl < 0.85],
    ['D2', 'DI0204', 'GOVERNOR PRESSURE TANK OIL LEVEL LOW 2ND', 'H', u => u.p.govLvl < 0.75],
    ['D7', 'DI0240', 'SHAFT SEAL COOLING WATER FLOW LOW', 'H', u => u.p.ax && u.p.axT > 15 && u.p.f_sc < 0.6, 2],
    ['D7', 'DI0216', 'SHAFT SEAL WATER PRESSURE LOW', 'L', u => u.p.ax && u.p.axT > 15 && u.p.sealP < 0.7, 3],
    ['E1', 'DI0332', 'SHAFT RUN-OUT ALARM FOR TURBINE SHAFT - X AXIS', 'L', u => u.p.vib.tgx > 150],
    ['E1', 'DI0330', 'SHAFT RUN-OUT TRIP FOR TURBINE SHAFT - X AXIS', 'H', u => u.p.vib.tgx > 200],
    ['E2', 'DI0271', 'MAIN COOLING WATER PUMP FAULT', 'L', u => u.p.cw[0].fail || u.p.cw[1].fail],
    ['E2', 'DI0273', 'GOVERNOR PRESSURE OIL PUMP FAULT', 'L', u => u.p.qp[0].fail || u.p.qp[1].fail],
    ['A1', 'SEQ', 'SEQUENCE MONITOR ERROR', 'H', u => !!(u.tr && u.tr.fail)],
  ];
  const SY_POINTS = [
    ['B1', '6DI0301', 'TRANSMISSION LINE NO.1 PROTECTION TRIP', 'H', (p) => !p.sy.st['152-L1'] && !p.sy.lineOK.L1],
    ['B2', '6DI0311', 'TRANSMISSION LINE NO.2 PROTECTION TRIP', 'H', (p) => !p.sy.st['152-L2'] && !p.sy.lineOK.L2],
    ['B3', '6DI0321', 'BUS BAR PROTECTION OPERATE', 'H', (p) => p.sy.busFault.A || p.sy.busFault.B],
    ['C1', '6DI0153', '152-L1 TRIP', 'H', (p) => !p.sy.st['152-L1']],
    ['C2', '6DI0158', '152-L2 TRIP', 'H', (p) => !p.sy.st['152-L2']],
    ['C3', '6DI0173', '152-BT OPEN', 'L', (p) => !p.sy.st['152-BT']],
    ['C4', '6DI0162', '152-U1 OPEN', 'L', (p) => !p.sy.st['152-U1']],
    ['C5', '6DI0178', '152-U2 OPEN', 'L', (p) => !p.sy.st['152-U2']],
    ['C6', '6DI0210', '152-U3 OPEN', 'L', (p) => !p.sy.st['152-U3']],
    ['C7', '6DI0194', '152-LST OPEN', 'L', (p) => !p.sy.st['152-LST']],
  ];
  const UNIT_WIN = {
    A: ['', '86-1', '86-2', '86-4', '86-5', '86-T', '86-PC', 'MANUAL\nSHUTDOWN'],
    B: ['GENERATOR', 'M.TR', 'EXCITATION', 'GOVERNOR', 'INLET VALVE', 'LOCAL\nCONTROL\nUNIT', 'PROTECTION\nRELAY', 'FIRE SYSTEM'],
    C: ['LOWER\nGUIDE\nBEARING', 'UPPER\nGUIDE\nBEARING', 'TURBINE\nGUIDE\nBEARING', 'THRUST\nBEARING', 'GEN.OIL\nCOOLER', 'AIR COOLER', '', ''],
    D: ['GOV.OIL\nSUMP TANK', 'GOV.PRESSURE\nTANK/OIL', 'I/V OIL\nSUMP TANK', 'I/V PRESSURE\nTANK/OIL', 'LEAKAGE\nOIL TANK', 'AIR PRESSURE', 'SHAFT SEAL', 'BACK FLUSH\nSTRAINER/\nFILTER'],
    E: ['VIBRATION', 'MCC', 'CREEP/\nSHEAR PIN', 'TURBINE PIT', 'SEAL WATER', '', '', ''],
    F: ['', '', '', '', '', '', '', ''],
  };
  const SY_WIN = {
    A: ['', '', '', '', '', '', '', ''],
    B: ['TRANSMISSION\nLINE NO.1', 'TRANSMISSION\nLINE NO.2', 'BUS-PROTECTION', 'LOCAL\nCONTROL\nUNIT', 'SYNCH.CHECK\nRELAY', '', '', ''],
    C: ['152-L1', '152-L2', '152-BT', '152-U1', '152-U2', '152-U3', '152-LST', ''],
    D: Array(8).fill(''), E: Array(8).fill(''), F: Array(8).fill(''),
  };

  class AlarmSystem {
    constructor(plant) {
      this.plant = plant; this.pt = {}; this.seq = 500; this.list = [];
      this.defs = [];
      plant.units.forEach(u => UNIT_POINTS.forEach(d => this.defs.push({ grp: 'U' + u.n, win: d[0], tag: `${u.n}${d[1]}`, text: d[2], lvl: d[3], cond: () => d[4](u), delay: d[5] || 0 })));
      SY_POINTS.forEach(d => this.defs.push({ grp: 'SY', win: d[0], tag: d[1], text: d[2], lvl: d[3], cond: () => d[4](plant), delay: d[5] || 0 }));
      this.defs.forEach((d, i) => { d.i = i; this.pt[i] = { on: false, tOn: 0, ack: true, id: null }; });
    }
    tick(dt) {
      for (const d of this.defs) {
        const s = this.pt[d.i]; let c = false;
        try { c = !!d.cond(); } catch (e) { c = false; }
        s.tOn = c ? s.tOn + dt : 0;
        const on = c && s.tOn >= d.delay;
        if (on && !s.on) {
          s.on = true; s.ack = false; s.id = (d.lvl === 'H' ? 'A' : 'G') + String(++this.seq).padStart(4, '0');
          this.list.push({ id: s.id, i: d.i, t: this.plant.t, tag: d.tag, text: d.text, grp: d.grp, win: d.win, lvl: d.lvl, state: 'ON' });
          this.plant.log('ALARM', `${d.tag} ${d.text} ON`);
        } else if (!on && s.on) {
          s.on = false;
          this.list.push({ id: s.id, i: d.i, t: this.plant.t, tag: d.tag, text: d.text, grp: d.grp, win: d.win, lvl: d.lvl, state: 'OFF' });
        }
      }
      if (this.list.length > 400) this.list.splice(0, this.list.length - 400);
    }
    win(grp, w) {   // status jendela annunciator: 'off' | 'blink' | 'on'
      let st = 'off';
      for (const d of this.defs) if (d.grp === grp && d.win === w) { const s = this.pt[d.i]; if (s.on && !s.ack) return 'blink'; if (s.on || !s.ack) st = 'on'; }
      return st;
    }
    grpActive(grp) { return this.defs.some(d => d.grp === grp && (this.pt[d.i].on || !this.pt[d.i].ack)); }
    ack(grp) { for (const d of this.defs) if (!grp || d.grp === grp) this.pt[d.i].ack = true; }
    reset(all) { for (const d of this.defs) { const s = this.pt[d.i]; if (all) { s.on = false; s.ack = true; s.tOn = 0; } else if (!s.on) s.ack = true; } if (all) this.list = []; }
    unacked() { return this.list.filter(e => e.state === 'ON' && !this.pt[e.i].ack).slice(-2).reverse(); }
    latest(n = 2) { return this.list.slice(-n).reverse(); }
    activeItems(grp, w) { return this.defs.filter(d => d.grp === grp && d.win === w).map(d => ({ tag: d.tag, text: d.text, lvl: d.lvl, on: this.pt[d.i].on, ack: this.pt[d.i].ack })); }
  }

  // [fungsi, device/tag, setelan, tunda, relay, aksi, sumber]
  const PROT_TABLE = [
    ['Gen. differential', '87 / DI0116', 'Id > setelan', 'instan', '86-1', '52 trip, turbine & I/V quick shutdown, 41 trip setelah 52 open', 'data JEZ2K031 SH.001'],
    ['Gen. ground OV / ground fault', '64V DI0119 / 64VS DI0117', '—', 'instan', '86-1', 'idem 86-1 (64VS aktif saat 52 closed)', 'data JEZ2K031 SH.001'],
    ['Neg. sequence overcurrent', '46 / DI0125', '—', '1 s (model)', '86-1', 'idem 86-1', 'data JEZ2K031 SH.001'],
    ['Loss of field', '40 / DI0124', 'Q < −35 % Prated', '1 s (model)', '86-1', 'idem 86-1 (aktif saat 52 closed)', 'data JEZ2K031 SH.001 · setelan asumsi'],
    ['Excitation circuit OC', '51E / DI0126', '—', 'instan', '86-1', 'idem 86-1', 'data JEZ2K031 SH.001'],
    ['Excitation system heavy fault', 'AVR / DI0082', '—', 'instan', '86-1', 'idem 86-1', 'data JEZ2K031 SH.001'],
    ['Relay M3425A PS / self-test alarm', 'DI0127 / DI0128', '—', 'instan', '86-1', 'idem 86-1 (tidak disimulasikan)', 'data JEZ2K031 SH.001'],
    ['M.Tr diff / Buchholz / oil & winding temp / OC / neutral OC', 'DI0257, 0265, 0268, 0270, 0259, 0260', '—', 'instan', '86-T + 86-1', '152-U trip + 86-1', 'data JEZ2K031 SH.002'],
    ['Power cable diff / OC, bus protection', 'DI0258, 6DI0153/0154, 6DI0140', '—', 'instan', '86-PC + 86-1', '152-U trip + 86-1', 'data JEZ2K031 SH.002'],
    ['USTr OC / ground OC, 64T', '4DI0092/0093, DI0120', '—', 'instan', '86-1', 'idem 86-1 (tidak disimulasikan)', 'data JEZ2K031 SH.002'],
    ['Emergency stop switch', 'ULCB DI0039 / TCC / SMP-1', 'operator', 'instan', '86-2', 'turbine & I/V quick shutdown, 52 trip saat GV no-load, 41 trip setelah 52 open', 'data JEZ2K031 SH.001/002'],
    ['Generator fire', 'CO2 F.F / DI0314', '—', 'instan', '86-2', 'idem 86-2', 'data JEZ2K031 SH.001'],
    ['Bearing temp. HIGH 2ND (UGB/LGB/thrust)', 'DI0181 / 0182 / 0183', '> 75 °C', 'instan', '86-2', 'idem 86-2', 'data JEZ2K031 SH.001 · setelan asumsi'],
    ['Governor fault', 'REG / DI0129', '—', 'instan', '86-2', 'idem 86-2', 'data JEZ2K031 SH.002'],
    ['Over speed electrical / mechanical', 'DI0130 / DI0217 (33-12M)', '> 140 % / > 145 %', 'instan', '86-2', 'idem 86-2 (reset pendulum manual)', 'data JEZ2K031 SH.002 · setelan asumsi'],
    ['GOV oil pressure LOW 2ND', 'DI0155', '< 75 %', '1 s', '86-2', 'idem 86-2', 'data JEZ2K031 SH.002'],
    ['GOV pressure tank level LOW 2ND / sump temp HIGH 2ND', 'DI0204 / DI0152', '< 75 % / > 65 °C', 'instan', '86-2', 'idem 86-2', 'data JEZ2K031 SH.002 · setelan asumsi'],
    ['Turbine guide brg oil level LOW 2ND', 'DI0212', '< 60 %', 'instan', '86-2', 'idem 86-2', 'data JEZ2K031 SH.002'],
    ['I/V sump / pressure tank items 2ND, GOV sump level 2ND', 'DI0226, 0229, 0222, 0157', '—', 'instan', '86-2', 'idem 86-2 (tidak disimulasikan)', 'data JEZ2K031 SH.002'],
    ['Generator overcurrent', '51 / DI0118', '—', '1.5 s (model)', '86-4', '52 trip saja, unit tetap no-load & eksitasi', 'data JEZ2K031 SH.001'],
    ['Generator over / under voltage', '59 DI0121 / 27 DI0122', '> 112 % / —', '2 s / 3 s (model)', '86-4', 'idem 86-4 (27 aktif saat 52 closed, diblok line charge)', 'data JEZ2K031 SH.001 · setelan asumsi'],
    ['Bearing temp. HIGH 1ST (thrust/UGB/LGB/TGB)', 'DI0097/0098/0099/0211', '> 70 °C', 'instan', '86-5', 'unload → 52 open → stop normal', 'data JEZ2K031 SH.003 · setelan asumsi'],
    ['UGB / LGB oil level low', 'DI0100 / DI0101', 'AND n > 90 % (DI0142)', 'instan', '86-5', 'idem 86-5', 'data JEZ2K031 SH.003'],
    ['Turbine bearing / shaft seal water flow low', 'DI0236 / DI0240', '< 40 %', '2 min', '86-5', 'di-arm 30 s setelah pompa CW A/B start, reset oleh 14L', 'data JEZ2K031 SH.003'],
    ['Field ground fault', '64E / DI0123', '—', 'instan', '86-5', 'idem 86-5', 'data JEZ2K031 SH.003'],
    ['Vibration / shaft run-out trip', 'DI0187–0197, DI0322–0332', '> 200 µm (TGB)', 'instan', '86-5', 'idem 86-5', 'data JEZ2K031 SH.003 · setelan asumsi'],
    ['GOV oil pressure LOW 1ST / tank level LOW 1ST / sump temp HIGH 1ST', 'DI0159 / DI0203 / DI0151', '< 85 % / < 85 % / > 60 °C', '2 s / instan', '86-5', 'idem 86-5', 'data JEZ2K031 SH.003'],
    ['Turbine guide brg oil level low', 'DI0213', '< 80 %', 'instan', '86-5', 'idem 86-5', 'data JEZ2K031 SH.003'],
    ['Air cooler temp, I/V oil items 1ST, GOV sump level 1ST', 'DI0184/0185, 0225, 0231, 0154', '—', 'instan', '86-5', 'idem 86-5 (tidak disimulasikan)', 'data JEZ2K031 SH.003'],
    ['Intake water level low', 'RTU-I', '< El. 577.51 m', '5 s', '86-5 (semua unit)', 'idem 86-5', 'data JEZ2K031 SH.003'],
    ['T/L line protection', '152-L1/L2', '—', 'instan', '— (CB saluran)', '152-L trip, auto-reclose 1 s bila USE', 'selector: data · waktu: asumsi'],
    ['Bus bar protection', 'bus A/B', '—', 'instan', '— (CB bus)', 'semua CB pada bus trip', 'selector: data · aksi: asumsi'],
  ];
  const RESET_RULE = { '86-1': 'RESET PB 3-86-1 (OPS) – penyebab hilang & stand still (14LT)', '86-2': 'RESET PB 3-86-2 (OPS) – penyebab hilang & stand still (14LT)', '86-T': 'stand still & penyebab hilang', '86-PC': 'stand still & penyebab hilang', '86-4': 'RESET PB 3-86-4 (OPS/ULCB) – 52 OPEN & penyebab hilang', '86-5': '86-5 RESET face plate OPS – 14L ON & penyebab hilang' };

  const API = { PROT_TABLE, RESET_RULE, Plant, Unit, Switchyard, STEP, START_T, STOP_T, SCENARIOS, SCN, UNIT_WIN, SY_WIN, PR, RPM, GV_MW, GV_NL, interp };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.MUSI = API;
})(typeof window !== 'undefined' ? window : globalThis);
