/* MUSI HEPP – layar SEQ FAULT SIM (v3.8): simulasi gangguan I/O (DI, DO, AI) pada sekuens unit STOP↔LOAD dan LINE CHARGING (43CH).
   Pengguna mengganti nilai I/O LCU (DI paksa 0/1/terbalik/terlambat, DO tidak keluar/terlambat, AI beku/paksa) lalu melihat dampaknya:
   starting condition, step sekuens STOP→LOAD / LOAD→STOP, timer SEQUENCE MONITOR ERROR, dan alarm.
   Logika & tag DI: JEZ1L675 (block diagram unit control) dan JEZ1L682 (I/O list LCU). */
(() => {
  'use strict';
  const X = window.HMIX; if (!X) return;
  const { P, M, esc, f, U, dialog, EXTU, EXTA, TABS } = X;
  const SQ = M.SEQF; if (!SQ) return;
  const { STEP, START_T, STOP_T } = M;
  const GRN = '#18e018', RED = '#ff4040', YEL = '#ffd040', CY = '#4ce0ff', GRY = '#9a9a9a';
  const st = { grp: 'ALL', typ: 'ALL', pg: 'ALL', n: 1 };

  /* ---------------- util ---------------- */
  const B = (a, l, c = '#b4b4b4', extra = '') => `<span class="sb" data-a="${a}" style="background:${c};color:#000;padding:5px 10px;cursor:pointer;display:inline-block;margin:2px 4px 2px 0;font-weight:700;${extra}">${esc(l)}</span>`;
  const bit = (v) => (v === undefined ? '—' : v ? '1' : '0');
  const S = () => P.seqf;
  const catOf = (n) => SQ.catalog(n);
  const findCat = (n, tagOrId) => catOf(n).find((c) => c.tag === tagOrId || c.id === tagOrId || (tagOrId && n + tagOrId === c.tag));
  const fullTag = (n, id) => (/^\d/.test(id) ? id : n + id);
  const fmode = (fl, tag) => SQ.modeText(tag || '', fl);
  const isAI = (tag) => /AI\d{4}$/.test(tag || ''), isDO = (tag) => /DO\d{4}$/.test(tag || '');
  const val = (tag, v) => (v === undefined ? '—' : isAI(tag) ? f(v, 1) : bit(v));

  // butir permissive: [label, nilai, tipe, tag] → status OK/NG menurut aturan gerbang
  function items(list) {
    const out = [];
    list.forEach((it, i) => {
      const [lab, v, t, id] = it;
      let need = !(t === 'not' || t === 'ornot');
      let ok = need ? !!v : !v;
      out.push({ lab, v: !!v, t, id, need, ok, i });
    });
    // grup OR: OK bila salah satu anggota OK (or) / semua anggota "tidak aktif" (ornot)
    let g = 0; out.forEach((x, i) => { if (x.t === 'or' || x.t === 'or2' || x.t === 'ornot') { if (!(i && out[i - 1].t === x.t && out[i - 1].g)) g++; x.g = g; } });
    const grp = {}; out.forEach((x) => { if (!x.g) return; const a = grp[x.g] || (grp[x.g] = { t: x.t, v: x.t === 'ornot' }); if (x.t === 'ornot') a.v = a.v && !x.v; else a.v = a.v || x.v; });
    out.forEach((x) => { if (x.g) x.gok = grp[x.g].v; });
    return out;
  }
  const condOK = (arr) => arr.every((x) => (x.g ? x.gok : x.ok));

  /* ---------------- diagnosa ---------------- */
  function focus(u) {
    const tr = u.tr;
    const scGroups = () => [['STARTING CONDITION-1 (SH.10)', items(u.sc1())], ['STARTING CONDITION-2 (SH.11)', items(u.sc2())], ['STARTING CONDITION-3 / 86-x (SH.12/14)', items(u.sc3())], ['CONTROL CONDITION (SH.15)', items(u.ctrlList())]];
    if (tr && tr.started) {
      const c = tr.dir > 0 ? u.condStart(tr.to) : u.condStop(tr.to);
      const arr = items([].concat(c.a || [], c.b || [], c.c || []).filter((x) => x[2] !== 'dash'));
      const lim = u.stepLim(tr);
      return { kind: 'tr', title: `${tr.dir > 0 ? (u.chUse() ? 'STOP TO CH (LINE CHARGING)' : 'STOP TO LOAD') : 'LOAD TO STOP'} – menuju step ${STEP[tr.to]}`, groups: [[`SYARAT STEP ${STEP[tr.to]} (${tr.dir > 0 ? 'START' : 'STOP'})`, arr]], lim, t: tr.t, fail: tr.fail };
    }
    if (tr && !tr.started && tr.dir > 0 && tr.to === 1) return { kind: 'wait', title: 'Menunggu START CONDITION (sekuens belum berjalan)', groups: scGroups() };
    if (tr && !tr.started) return { kind: 'wait', title: `Menunggu prasyarat step ${STEP[tr.to]}` + (tr.dir < 0 && tr.to === 0 ? ' (14LT – putaran nol 20 s)' : tr.to === 4 ? (u.chUse() ? ' (LINE CHARGE belum aktif / 86-4)' : ' (ASS unit lain tidak dipakai – nDI0064, jaringan tersedia, 86-4 reset)') : tr.to === 5 ? ' (jalur CH: 43CH LOCK dahulu)' : ''), groups: [] };
    if (u.pos === 0) return { kind: 'idle0', title: 'Unit STAND STILL – kesiapan START (STARTING + CONTROL CONDITION)', groups: scGroups() };
    return { kind: 'idle', title: `Unit di step ${STEP[u.pos]} – tidak ada transisi aktif`, groups: [] };
  }

  // dampak sebuah DI terganggu: daftar syarat yang menjadi NG karena nilai LCU berbeda dengan nilai peralatan
  function impact(u, tag) {
    const n = u.n, res = [];
    const chk = (name, list) => { const arr = items(list); arr.forEach((x) => { if (x.id && fullTag(n, x.id) === tag && !(x.g ? x.gok : x.ok)) res.push(name); }); };
    chk('STARTING CONDITION-1 → start ditolak', u.sc1()); chk('STARTING CONDITION-2 → start ditolak', u.sc2()); chk('STARTING CONDITION-3 → start ditolak', u.sc3()); chk('CONTROL CONDITION → start ditolak', u.ctrlList());
    for (let k = 1; k <= 5; k++) { const c = u.condStart(k); chk(`START step ${STEP[k]}${u.chUse() && (k === 3 || k === 4) ? ' (CH)' : ''} (timer ${u.stepLim({ dir: 1, to: k })} s)`, [].concat(c.a || [], c.b || [], c.c || []).filter((x) => x[2] !== 'dash')); }
    for (let k = 0; k <= 4; k++) { const c = u.condStop(k); chk(`STOP step ${STEP[k]} (timer ${STOP_T[k]} s)`, c.a || []); }
    return [...new Set(res)];
  }

  /* ---------------- block diagram (SVG) ---------------- */
  function diagram(u, F) {
    const arr = F.groups.length === 1 ? F.groups[0][1] : null;
    if (!arr || !arr.length) return '';
    const n = u.n, S0 = S(), rowH = 22, top = 26, W = 820;
    const xIn = 6, wIn = 330, xBus = 440, xG = 460;
    const H = Math.max(top + arr.length * rowH + 30, top + (arr.length * rowH) / 2 + 86);
    let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;background:#000;border:1px solid #333;display:block">`;
    s += `<text x="${xIn}" y="14" style="font-size:10px;fill:${CY}">INPUT DI / AI (dibaca LCU)</text><text x="${xG + 40}" y="14" style="font-size:10px;fill:${CY}">LOGIKA LCU</text>`;
    const yMid = top + (arr.length * rowH) / 2 - 4, all = condOK(arr);
    arr.forEach((x, i) => {
      const y = top + i * rowH + 8, tag = x.id ? fullTag(n, x.id) : '', fl = tag && S0.flt[tag], raw = tag ? S0.raw[tag] : undefined;
      const good = x.g ? x.gok : x.ok, col = good ? GRN : RED;
      s += `<g ${tag ? `data-a="x:sqfd:${n}:${tag}" style="cursor:pointer"` : ''}><rect x="${xIn}" y="${y - 9}" width="${wIn}" height="18" fill="${fl ? '#3a2a00' : '#0d0d0d'}" stroke="${fl ? YEL : '#555'}"/>`;
      s += `<text x="${xIn + 4}" y="${y + 4}" style="font-size:9.5px;fill:${tag ? YEL : GRY}">${esc(tag || '(internal)')}</text>`;
      s += `<text x="${xIn + 62}" y="${y + 4}" style="font-size:9px;fill:#e8e8e8">${esc(x.lab.slice(0, 50))}</text>`;
      s += `<text x="${xIn + wIn - 4}" y="${y + 4}" style="font-size:10px;fill:${col};text-anchor:end">${bit(x.v)}</text></g>`;
      if (fl) s += `<text x="${xIn + wIn + 4}" y="${y - 1}" style="font-size:8px;fill:${YEL}">⚡${esc(fmode(fl, tag))}</text><text x="${xIn + wIn + 4}" y="${y + 8}" style="font-size:8px;fill:${GRY}">alat=${esc(val(tag, raw))}</text>`;
      s += `<line x1="${xIn + wIn}" y1="${y}" x2="${xBus}" y2="${y}" stroke="${col}" stroke-width="${good ? 1.2 : 2}"/>`;
      if (x.t === 'not' || x.t === 'ornot') s += `<rect x="${xBus - 22}" y="${y - 5}" width="10" height="10" fill="#000" stroke="${col}"/><path d="M${xBus - 22},${y - 5} L${xBus - 12},${y + 5} M${xBus - 12},${y - 5} L${xBus - 22},${y + 5}" stroke="${col}"/>`;
      if (x.g) s += `<text x="${xBus - 40}" y="${y - 3}" style="font-size:7.5px;fill:${CY}">${x.t === 'ornot' ? 'NOR' : 'OR'}</text>`;
      s += `<path d="M${xBus - 6},${y - 3} L${xBus},${y} L${xBus - 6},${y + 3}" fill="none" stroke="${col}"/>`;
    });
    s += `<line x1="${xBus}" y1="${top}" x2="${xBus}" y2="${top + arr.length * rowH}" stroke="${all ? GRN : RED}" stroke-width="2"/>`;
    s += `<rect x="${xBus + 2}" y="${yMid - 8}" width="16" height="16" fill="${all ? GRN : '#000'}" stroke="${all ? GRN : RED}" stroke-width="1.5"/><text x="${xBus + 10}" y="${yMid + 23}" style="font-size:8px;fill:${GRY};text-anchor:middle">AND</text>`;
    const lab = F.kind === 'tr' ? 'STEP COMPLETION' : 'START CONDITION';
    s += `<line x1="${xBus + 18}" y1="${yMid}" x2="${xG + 40}" y2="${yMid}" stroke="${all ? GRN : RED}" stroke-width="1.5"/>`;
    s += `<rect x="${xG + 40}" y="${yMid - 14}" width="120" height="28" fill="#000" stroke="${all ? GRN : RED}"/><text x="${xG + 100}" y="${yMid + 4}" style="font-size:10px;fill:${all ? GRN : RED};text-anchor:middle">${lab} ${all ? '✔' : '✘'}</text>`;
    if (F.kind === 'tr' && F.lim) {
      const left = Math.max(0, F.lim - F.t), err = F.fail;
      const yT = yMid + 42;
      s += `<line x1="${xG + 100}" y1="${yMid + 14}" x2="${xG + 100}" y2="${yT - 10}" stroke="${GRY}" stroke-dasharray="3 2"/>`;
      s += `<rect x="${xG + 70}" y="${yT - 10}" width="60" height="20" rx="3" fill="${err ? '#5a0000' : '#000'}" stroke="${err ? RED : YEL}"/><text x="${xG + 100}" y="${yT + 4}" style="font-size:10px;fill:${err ? RED : YEL};text-anchor:middle">→ ${F.lim} s</text>`;
      s += `<line x1="${xG + 130}" y1="${yT}" x2="${xG + 170}" y2="${yT}" stroke="${err ? RED : GRY}"/>`;
      s += `<rect x="${xG + 170}" y="${yT - 14}" width="185" height="28" fill="${err ? '#5a0000' : '#000'}" stroke="${err ? RED : GRY}"/><text x="${xG + 262}" y="${yT + 4}" style="font-size:9.5px;fill:${err ? RED : '#ccc'};text-anchor:middle">SEQUENCE MONITOR ERROR ${err ? '(TERJADI)' : ''}</text>`;
      s += `<text x="${xG + 100}" y="${yT + 24}" style="font-size:9px;fill:${CY};text-anchor:middle">t = ${f(F.t, 0)} s${err ? '' : ` · sisa ${f(left, 0)} s`}${u.sw.USM ? '' : ' · 43USM LOCK (monitor nonaktif)'}</text>`;
    }
    return s + '</svg>';
  }

  /* ---------------- layar ---------------- */
  function chain(u) {
    const tr = u.tr;
    return `<div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center;margin:4px 0">` + STEP.map((s, k) => {
      const cur = u.pos === k, tgt = tr && tr.to === k, err = tgt && tr.fail;
      const bg = err ? '#7a0000' : cur ? '#0b5a0b' : tgt ? '#5a4a00' : '#111', bd = err ? RED : cur ? GRN : tgt ? YEL : '#444';
      return `<div style="padding:4px 7px;border:1px solid ${bd};background:${bg};font-size:11px">${esc(s)}${tgt ? (tr.dir > 0 ? ' ◀' : ' ▶') : ''}</div>${k < STEP.length - 1 ? '<span style="color:#666">→</span>' : ''}`;
    }).join('') + `</div>`;
  }

  function draw(n) {
    n = n || st.n; st.n = n;
    const u = U(n), S0 = S(), F = focus(u), tags = S0.unitTags(n);
    let h = `<div class="h2">SEQ FAULT SIM – UNIT ${n} · GANGGUAN I/O PADA PERMISSIVE SEKUENS</div>`;
    h += `<div class="fs"><div class="col">`;
    h += `<div>${[1, 2, 3].map((k) => B(`nav:sqf${k}`, `UNIT ${k}`, k === n ? '#ffff80' : '#b4b4b4')).join('')}</div>`;
    h += `<h4>1. STATUS SEKUENS UNIT ${n}</h4>${chain(u)}`;
    h += `<div style="font-size:11px;color:#ccc">Posisi: <b style="color:${GRN}">${STEP[u.pos]}</b> · Target: <b>${STEP[u.target]}</b>${u.tr ? ` · Transisi ${u.tr.dir > 0 ? 'START' : 'STOP'} → ${STEP[u.tr.to]} ${u.tr.started ? `(t = ${f(u.tr.t, 0)} s)` : '(menunggu prasyarat)'}` : ''}${u.anyLO() ? ` · <span style="color:${RED}">LOCKOUT: ${Object.keys(u.lo).filter((k) => u.lo[k]).join(', ')}</span>` : ''}</div>`;
    h += `<div style="margin:4px 0">${B(`x:sqfcmd:${n}:5`, '43S-CS LOAD (START)', '#9be89b')}${B(`x:sqfcmd:${n}:0`, '43S-CS STOP', '#ff9a9a')}${B(`nav:s2l${n}`, 'SEQ MONITOR STOP→LOAD')}${B(`nav:l2s${n}`, 'SEQ MONITOR LOAD→STOP')}${B(`nav:sc1${n}`, 'START CONDITION')}</div>`;

    h += `<h4>2. DIAGNOSA LANGSUNG – ${esc(F.title)}</h4>`;
    if (F.groups.length === 1) h += diagram(u, F);
    else if (F.groups.length) {
      F.groups.forEach(([g, arr]) => {
        const ng = arr.filter((x) => !(x.g ? x.gok : x.ok)), ok = !ng.length;
        h += `<div style="margin:3px 0;padding:3px 6px;border:1px solid ${ok ? '#244' : RED};background:${ok ? '#020' : '#200'}"><span style="color:${ok ? GRN : RED}">${ok ? '✔' : '✘'}</span> ${esc(g)}`;
        if (!ok) h += `<div style="font-size:11px;margin:2px 0 0 14px">${ng.map((x) => { const tag = x.id ? fullTag(n, x.id) : '', fl = tag && S0.flt[tag];
          return `<div>${tag ? `<a data-a="x:sqfd:${n}:${tag}" style="color:${YEL};cursor:pointer">${esc(tag)}</a>` : '(internal)'} ${esc(x.lab)} = ${bit(x.v)} (perlu ${x.need ? 1 : 0})${fl ? ` <span style="color:${YEL}">⚡ ${esc(fmode(fl, tag))} – alat sebenarnya ${esc(val(tag, S0.raw[tag]))}</span>` : ''}</div>`; }).join('')}</div>`;
        h += `</div>`;
      });
    } else h += `<div class="note2">Tidak ada transisi. Beri perintah 43S-CS (LOAD / STOP) untuk melihat dampak gangguan pada sekuens.</div>`;
    const sub = SQ.substeps(u);
    if (sub && sub.length) {
      h += `<div style="margin-top:6px;font-size:11px;color:${CY}">SUB-LANGKAH (${u.tr.dir > 0 ? (u.chUse() ? 'Stop_To_CH' : 'Stop_To_Load') : 'Load_to_Stop'} → ${STEP[u.tr.to]})</div><div style="display:flex;flex-wrap:wrap;gap:3px;margin:3px 0">`;
      sub.forEach((x, i) => {
        const tag = x.tag ? n + x.tag : '', fl = tag && S0.flt[tag];
        const bd = x.pend ? RED : x.act ? YEL : x.done ? GRN : '#444', bg = x.pend ? '#3a0000' : x.act ? '#3a3000' : x.done ? '#032' : '#111';
        h += `<div ${tag ? `data-a="x:sqfd:${n}:${tag}"` : ''} style="cursor:${tag ? 'pointer' : 'default'};border:1px solid ${bd};background:${bg};padding:3px 6px;font-size:10px;max-width:250px">
          <span style="color:${GRY}">${i + 1}.</span> ${tag ? `<span style="color:${YEL}">${esc(x.tag)}</span> ` : ''}${esc(x.lab)}${x.note ? ` <span style="color:${GRY}">(${esc(x.note)})</span>` : ''}${x.pend ? ` <b style="color:${RED}">TERTAHAN</b>` : ''}${fl ? ` <span style="color:${YEL}">⚡${esc(fmode(fl, tag))}</span>` : ''}</div>`;
      });
      h += `</div>`;
    }
    // akar masalah
    const rc = tags.filter((t) => !isDO(t) && S0.lcu[t] !== undefined && S0.lcu[t] !== S0.raw[t]);
    if (F.kind === 'tr' && F.groups[0]) {
      const ng = F.groups[0][1].filter((x) => !(x.g ? x.gok : x.ok));
      if (ng.length) {
        const byFault = ng.filter((x) => x.id && S0.flt[fullTag(n, x.id)] && S0.lcu[fullTag(n, x.id)] !== S0.raw[fullTag(n, x.id)]);
        h += `<div class="det" style="margin-top:6px">${byFault.length ? `<b>Penyebab:</b> sinyal ${byFault.map((x) => esc(fullTag(n, x.id))).join(', ')} terganggu – peralatan sudah pada posisi yang diminta, tetapi LCU membaca nilai lain. Step tidak selesai sampai sinyal normal atau timer habis → SEQUENCE MONITOR ERROR.${ng.length > byFault.length ? ` Syarat NG lainnya (${ng.filter((x) => !byFault.includes(x)).map((x) => esc(x.lab)).join('; ')}) ikut tertahan karena langkah berikutnya menunggu sinyal tersebut.` : ''}`
          : `<b>Menunggu:</b> ${ng.map((x) => esc(x.lab)).join('; ')} – peralatan sedang bergerak / proses berjalan (bukan gangguan I/O).`}</div>`;
      }
    }
    if (rc.length && F.kind !== 'tr') h += `<div class="det" style="margin-top:6px"><b>Sinyal berbeda dengan kondisi alat saat ini:</b> ${rc.map((t) => `${esc(t)} (LCU ${esc(val(t, S0.lcu[t]))}, alat ${esc(val(t, S0.raw[t]))})`).join(', ')}</div>`;
    if (tags.length) {
      h += `<h4>DAMPAK GANGGUAN AKTIF (prediksi dari logika sekuens)</h4><table class="tbl" style="font-size:11px"><tr><th>Tag</th><th>Mode</th><th>Syarat yang menjadi NG dengan kondisi alat sekarang</th></tr>`;
      tags.forEach((t) => { const im = impact(u, t), c = findCat(n, t);
        h += `<tr><td><a data-a="x:sqfd:${n}:${esc(t)}" style="color:${YEL};cursor:pointer">${esc(t)}</a><div style="font-size:9.5px;color:${GRY}">${esc(c ? c.name : '')}</div></td><td>${esc(fmode(S0.flt[t], t))}</td><td>${im.length ? im.map(esc).join('<br>') : `<span style="color:${GRY}">${isDO(t) ? (u.doPend[t.slice(1)] ? 'perintah sedang TERTAHAN – lihat sub-langkah' : 'berlaku saat sekuens mengeluarkan perintah ini (lihat sub-langkah)') : c && c.ind ? 'indikasi saja – tidak masuk logika LCU sekuens' : 'belum ada (dampak muncul saat kondisi alat berubah)'}</span>`}</td></tr>`; });
      h += `</table>`;
    }
    const ev = P.events.filter((e) => e.msg.startsWith(`U${n}:`) || /SEQ FAULT/.test(e.msg) || e.msg.startsWith(`${n}ALM`)).slice(-12).reverse();
    h += `<h4>3. RIWAYAT KEJADIAN UNIT ${n}</h4><div class="ev">${ev.map((e) => `<div style="color:${e.type === 'ALARM' ? RED : e.type === 'OK' ? GRN : e.type === 'CMD' ? YEL : '#ccc'}">${X.fmtT(e.t)} ${esc(e.type)} ${esc(e.msg)}</div>`).join('') || '—'}</div>`;
    h += `</div><div class="col">`;

    const ch = u.sw.s43CH === 'USE', sy = P.sy;
    h += `<h4>4. LINE CHARGING (43CH) – UNIT ${n}</h4><div style="font-size:11px;color:#ccc">43CH (ULCB): <b style="color:${ch ? YEL : GRN}">${u.sw.s43CH}</b> · LCU DI0055: ${bit(S0.lcu[n + 'DI0055'])} · LINE CHARGE: ${u.p.lc ? '<b style="color:' + YEL + '">ON</b>' : 'OFF'} · 43-90: ${u.sw.AVR} · 52: ${u.p.cb ? 'CLOSE' : 'OPEN'} · ${f(u.kV(), 1)} kV · ${f(u.p.speed * 50, 2)} Hz · jaringan: ${u.gridOK() ? '<span style="color:' + GRN + '">ADA</span>' : '<span style="color:' + RED + '">MATI</span>'} · T/L1 ${sy.st['152-L1'] ? 'CLOSE' : 'OPEN'}/${sy.lineOK.L1 ? 'GI hidup' : 'GI mati'}</div>`;
    h += `<div style="margin:4px 0">${B('x:sqfch:prep', 'SIAPKAN LATIHAN CH', '#c8b4ff')}${B(`x:sqfch:use:${n}`, '43CH USE', '#ffd040')}${B(`x:sqfcmd:${n}:4`, '43S-CS PARALLEL-IN', '#9be89b')}${B(`x:sqfch:r90:${n}:1`, '90R RAISE')}${B(`x:sqfch:r90:${n}:-1`, '90R LOWER')}${B('x:sqfch:l1', '152-L1 CLOSE')}${B('x:sqfch:sync', 'SINKRON DI SISI GI')}${B(`x:sqfch:lock:${n}`, '43CH LOCK', '#ffd040')}${B(`x:sqfcmd:${n}:5`, '43S-CS LOAD', '#9be89b')}</div>`;
    h += `<div class="note2">Urutan Stop_To_CH: unit STOP → 43CH USE (DO0095, ISO ON) → 43S-CS PARALLEL-IN → EXCITATION: tegangan normal +30 s → LINE CHARGE, 43-90 MANUAL (DO0100), tegangan diturunkan < 3.3 kV (DO0098) → PARALLEL-IN: 52 CLOSE tanpa synchronizer (DO0105) → operator 90R RAISE sampai > 90 % → 152-L1 CLOSE → sinkron di sisi GI → 43CH LOCK (DO0096, ISO OFF, AVR AUTO) → 43S-CS LOAD. "SIAPKAN LATIHAN CH" = INIT STOP + kedua T/L trip; catu bantu unit dianggap tersedia (asumsi).</div>`;

    h += `<h4>5. SKENARIO CEPAT (UNIT ${n})</h4><div class="note2">Skenario menimpa gangguan I/O unit ini. Setelah dipasang, beri perintah START/STOP (atau jalur CH) lalu amati diagnosa.</div>`;
    h += `<div>${['ALL', 'DI', 'DO', 'AI', 'CH'].map((g) => B(`x:sqfpg:${g}`, g === 'ALL' ? 'SEMUA' : g, g === st.pg ? '#ffff80' : '#d0d0d0', 'padding:3px 7px;font-size:10px')).join('')}</div>`;
    h += SQ.PRESETS.filter((p) => st.pg === 'ALL' || p.g === st.pg).map((p) => `<div style="border:1px solid #333;margin:3px 0;padding:4px 6px"><div style="display:flex;justify-content:space-between;gap:6px;align-items:center"><b style="color:${YEL};font-weight:400">${esc(p.t)}</b>${B(`x:sqfp:${n}:${p.k}`, 'PASANG', '#ffd040')}</div><div style="font-size:10.5px;color:#bbb">${esc(p.e)}</div></div>`).join('');
    h += `<div>${B(`x:sqfclr:${n}`, `NORMALKAN SEMUA I/O UNIT ${n}`, '#ff9090')}</div>`;

    h += `<h4>6. DAFTAR I/O SEKUENS UNIT ${n} (JEZ1L675 / JEZ1L682)</h4>`;
    const grps = ['ALL', ...Object.keys(SQ.G)];
    h += `<div>${grps.map((g) => B(`x:sqfg:${g}`, g === 'ALL' ? 'SEMUA' : g, g === st.grp ? '#ffff80' : '#d0d0d0', 'padding:3px 7px;font-size:10px')).join('')}</div>`;
    h += `<div>${['ALL', 'DI', 'DO', 'AI'].map((g) => B(`x:sqft:${g}`, g === 'ALL' ? 'SEMUA TIPE' : g, g === st.typ ? '#ffff80' : '#e8e8e8', 'padding:3px 7px;font-size:10px')).join('')}</div>`;
    const all = catOf(n), list = all.filter((c) => (st.grp === 'ALL' || c.grp === st.grp) && (st.typ === 'ALL' || c.type === st.typ));
    h += `<div style="font-size:10px;color:${GRY}">${all.filter((c) => c.type === 'DI').length} DI · ${all.filter((c) => c.type === 'DO').length} DO · ${all.filter((c) => c.type === 'AI').length} AI per unit</div>`;
    h += `<table class="tbl" style="font-size:11px"><tr><th>Tag</th><th>Sinyal</th><th>SH</th><th>Alat</th><th>LCU</th><th>Gangguan</th></tr>`;
    let lastG = '';
    list.forEach((c) => {
      if (c.grp !== lastG) { lastG = c.grp; h += `<tr><td colspan="6" style="color:${CY};font-size:10px;padding-top:6px">${esc(c.gname)}</td></tr>`; }
      const fl = S0.flt[c.tag];
      let a1, a2, diff = false;
      if (c.type === 'DO') { const pd = u.doPend[c.id], t0 = u.do[c.id]; a1 = '—'; a2 = pd ? 'TERTAHAN' : t0 !== undefined ? X.fmtT(t0) : '—'; diff = !!pd; }
      else { const raw = S0.raw[c.tag], lcu = S0.lcu[c.tag]; a1 = val(c.tag, raw); a2 = val(c.tag, lcu); diff = c.type === 'AI' ? !!fl : lcu !== raw; }
      h += `<tr style="${fl ? 'background:#2a2000' : ''};cursor:pointer" data-a="x:sqfd:${n}:${esc(c.tag)}"><td style="color:${YEL}">${esc(c.tag)}</td><td style="font-size:10px">${esc(c.name)}${c.dev ? ` <span style="color:${GRY}">(${esc(c.dev)})</span>` : ''}${c.ind ? ` <span style="color:${GRY}">· indikasi</span>` : ''}</td><td style="font-size:10px">${esc(c.sh)}</td><td class="n">${esc(a1)}</td><td class="n" style="color:${diff ? RED : '#fff'}">${esc(a2)}</td><td style="font-size:10px;color:${YEL}">${esc(fmode(fl, c.tag))}</td></tr>`;
    });
    h += `</table><div class="note2" style="margin-top:8px">DI/AI: kolom <b>Alat</b> = kondisi peralatan pada model, <b>LCU</b> = nilai yang dipakai logika sekuens. DO: kolom <b>LCU</b> = waktu perintah terakhir keluar, atau TERTAHAN bila gangguan menahannya (perintah keluar begitu DO dinormalkan). Gangguan I/O tidak merusak peralatan.
      Tag, nama dan logika: block diagram JEZ1L675 (SH.05–06, 10–15, 20–27, 30–36, 50), flow chart Stop_To_Load / Load_to_Stop / Stop_To_CH, I/O list JEZ1L682. Tanda "indikasi" = sinyal hanya untuk tampilan OPS (interlock dilakukan di peralatan, mis. kontrol inlet valve), sehingga gangguannya tidak menghentikan sekuens.
      Setelah SEQUENCE MONITOR ERROR model hanya membangkitkan alarm dan sekuens tetap menunggu (tindakan lain tidak tertulis di gambar). Timer EXCITATION (CH) 120 s dan PARALLEL-IN (CH) 300 s adalah asumsi.</div></div></div>`;
    return h;
  }

  /* ---------------- aksi ---------------- */
  const btns = (items2) => `<div class="simgrid">${items2.map(([a, l, c]) => `<button data-a="${a}" ${c ? `class="${c}"` : ''}>${esc(l)}</button>`).join('')}</div>`;
  Object.assign(EXTA, {
    sqfd: ([n, tag]) => {
      const S0 = S(), c = findCat(+n, tag), fl = S0.flt[tag];
      const u = U(+n), im = impact(u, tag), typ = SQ.typeOf(tag), m = fl ? fl.mode : '';
      const head = `${tag}  ${c ? c.name : ''}${c && c.dev ? ' (' + c.dev + ')' : ''}\n${c ? c.gname + ' · sheet/flow chart: ' + c.sh : ''}${c && c.ind ? '\nIndikasi saja – tidak masuk logika LCU sekuens.' : ''}\n\n`;
      let msg, extra;
      const NORM = [`x:sqfs:${n}:${tag}:`, 'NORMAL', !m ? 'on' : ''];
      if (typ === 'DO') {
        const pd = u.doPend[tag.slice(1)];
        msg = head + `Perintah terakhir keluar: ${u.do[tag.slice(1)] !== undefined ? X.fmtT(u.do[tag.slice(1)]) : '—'}${pd ? '\nSaat ini: TERTAHAN – ' + pd.desc : ''}\nGangguan: ${fl ? fmode(fl, tag) : 'tidak ada'}\n\nDO "tidak keluar": LCU memberi perintah tetapi output tidak sampai ke peralatan; perintah keluar begitu DO dinormalkan.`;
        extra = btns([[`x:sqfs:${n}:${tag}:off`, 'TIDAK KELUAR', m === 'off' ? 'on' : ''], [`x:sqfs:${n}:${tag}:dly:10`, 'TERLAMBAT 10 s', m === 'dly' && fl.sec === 10 ? 'on' : ''], [`x:sqfs:${n}:${tag}:dly:30`, 'TERLAMBAT 30 s', m === 'dly' && fl.sec === 30 ? 'on' : ''], [`x:sqfs:${n}:${tag}:dly:90`, 'TERLAMBAT 90 s', m === 'dly' && fl.sec === 90 ? 'on' : ''], NORM]);
      } else if (typ === 'AI') {
        const unit = c ? c.dev : '';
        msg = head + `Nilai alat: ${val(tag, S0.raw[tag])} ${unit}\nNilai dibaca LCU: ${val(tag, S0.lcu[tag])} ${unit}\nGangguan: ${fl ? fmode(fl, tag) : 'tidak ada'}` + (im.length ? `\n\nDengan kondisi sekarang, syarat yang NG:\n- ${im.join('\n- ')}` : '');
        const pv = { AI0004: [0, 3, 6, 11], AI0005: [0, 2, 5, 70], AI0006: [-10, 0, 10, 30] }[tag.slice(1)] || [0];
        extra = btns([[`x:sqfs:${n}:${tag}:hold`, 'BEKU (nilai sekarang)', m === 'hold' ? 'on' : ''], NORM]) + btns(pv.map((v) => [`x:sqfs:${n}:${tag}:set:${v}`, `PAKSA ${v} ${unit}`, m === 'set' && +fl.v === v ? 'on' : '']));
      } else {
        msg = head + `Nilai peralatan: ${bit(S0.raw[tag])}\nNilai dibaca LCU: ${bit(S0.lcu[tag])}\nGangguan: ${fl ? fmode(fl, tag) : 'tidak ada'}` + (im.length ? `\n\nDengan kondisi alat sekarang, syarat yang NG:\n- ${im.join('\n- ')}` : '');
        extra = btns([[`x:sqfs:${n}:${tag}:off`, 'PAKSA 0 (OFF)', m === 'off' ? 'on' : ''], [`x:sqfs:${n}:${tag}:on`, 'PAKSA 1 (ON)', m === 'on' ? 'on' : ''], [`x:sqfs:${n}:${tag}:inv`, 'TERBALIK', m === 'inv' ? 'on' : '']]) +
          btns([[`x:sqfs:${n}:${tag}:dly:10`, 'TERLAMBAT 10 s', m === 'dly' && fl.sec === 10 ? 'on' : ''], [`x:sqfs:${n}:${tag}:dly:30`, 'TERLAMBAT 30 s', m === 'dly' && fl.sec === 30 ? 'on' : ''], [`x:sqfs:${n}:${tag}:dly:120`, 'TERLAMBAT 120 s', m === 'dly' && fl.sec === 120 ? 'on' : ''], NORM]);
      }
      dialog('GANGGUAN I/O SEKUENS', msg, null, { extra });
    },
    sqfs: ([n, tag, mode, arg]) => { X.closeDlg(); S().set(tag, mode || null, arg); },
    sqfpg: ([g]) => { st.pg = g; },
    sqft: ([g]) => { st.typ = g; },
    sqfch: ([op, n, arg]) => {
      const u = n ? U(+n) : null, msg = (r) => { if (r) dialog('MESSAGE', r, null); };
      if (op === 'prep') dialog('LINE CHARGING', 'Siapkan latihan line charging?\n\n• Semua unit INIT STOP\n• Kedua T/L 150 kV trip (bus mati, GI sisi lawan mati)\n• Catu bantu unit dianggap tersedia (asumsi)\n\nEXECUTE ?', () => SQ.prepCH(P));
      else if (op === 'use') dialog('43CH', `UNIT ${n}\n43CH → USE (line charge)\n\nEXECUTE ?`, () => msg(u.operate43CH(true)));
      else if (op === 'lock') dialog('43CH', `UNIT ${n}\n43CH → LOCK\n\nEXECUTE ?`, () => msg(u.operate43CH(false)));
      else if (op === 'r90') { u.raise90(+arg); P.log('CMD', `U${n}: 90R ${+arg > 0 ? 'RAISE' : 'LOWER'}`); }
      else if (op === 'l1') dialog('SWITCHYARD', '152-L1 CLOSE (T/L No.1)\n\nEXECUTE ?', () => msg(P.sy.operate('152-L1', true)));
      else if (op === 'sync') dialog('GI NEW CURUP', 'Sinkronisasi di sisi lawan (GI) – T/L yang diberi tegangan unit disambung ke sistem.\n\nEXECUTE ?', () => msg(SQ.remoteSync(P)));
    },
    sqfp: ([n, k]) => { const p = SQ.PRESETS.find((x) => x.k === k); dialog('SEQ FAULT SIM', `UNIT ${n}\n${p.t}\n\nPerkiraan dampak:\n${p.e}\n\nGangguan I/O lain pada unit ini dinormalkan dahulu.\n\nEXECUTE ?`, () => S().preset(k, +n)); },
    sqfclr: ([n]) => dialog('SEQ FAULT SIM', `Normalkan semua gangguan I/O sekuens UNIT ${n}?\n\nEXECUTE ?`, () => S().clearUnit(+n)),
    sqfg: ([g]) => { st.grp = g; },
    sqfcmd: ([n, k]) => { const u = U(+n); dialog('43S-CS', `UNIT ${n}\n43S-CS ${STEP[+k]} OPERATE\n\nEXECUTE ?`, () => u.operate43S(+k)); },
  });

  EXTU.sqf = { no: (n) => '0016' + n, title: (n) => `SEQ FAULT SIM UNIT${n}`, grp: 'sqf', html: true, draw };
  TABS.sqf = (n) => [[`sqf${n}`, `SEQ FAULT U${n}`], [`s2l${n}`, 'STOP→LOAD'], [`l2s${n}`, 'LOAD→STOP'], [`sc1${n}`, 'START COND.'], [`ann${n}`, `UNIT${n} ANN`], ['force', 'FORCING I/O'], ['alm', 'ALARM SUM.']];
})();
