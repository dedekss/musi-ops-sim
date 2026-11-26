/* MUSI HEPP – layar SEQ FAULT SIM (v3.7): simulasi gangguan I/O pada permissive sekuens unit.
   Pengguna mengganti nilai DI yang dibaca LCU (paksa 0/1, terbalik, terlambat) lalu melihat dampaknya:
   starting condition, step sekuens STOP→LOAD / LOAD→STOP, timer SEQUENCE MONITOR ERROR, dan alarm.
   Logika & tag DI: JEZ1L675 (block diagram unit control) dan JEZ1L682 (I/O list LCU). */
(() => {
  'use strict';
  const X = window.HMIX; if (!X) return;
  const { P, M, esc, f, U, dialog, EXTU, EXTA, TABS } = X;
  const SQ = M.SEQF; if (!SQ) return;
  const { STEP, START_T, STOP_T } = M;
  const GRN = '#18e018', RED = '#ff4040', YEL = '#ffd040', CY = '#4ce0ff', GRY = '#9a9a9a';
  const st = { grp: 'ALL', n: 1 };

  /* ---------------- util ---------------- */
  const B = (a, l, c = '#b4b4b4', extra = '') => `<span class="sb" data-a="${a}" style="background:${c};color:#000;padding:5px 10px;cursor:pointer;display:inline-block;margin:2px 4px 2px 0;font-weight:700;${extra}">${esc(l)}</span>`;
  const bit = (v) => (v === undefined ? '—' : v ? '1' : '0');
  const S = () => P.seqf;
  const catOf = (n) => SQ.catalog(n);
  const findCat = (n, tagOrId) => catOf(n).find((c) => c.tag === tagOrId || c.id === tagOrId || (tagOrId && n + tagOrId === c.tag));
  const fullTag = (n, id) => (/^\d/.test(id) ? id : n + id);
  const fmode = (fl) => (fl ? (fl.mode === 'dly' ? `TERLAMBAT ${fl.sec} s` : SQ.MODES[fl.mode]) : '');

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
      const lim = tr.dir > 0 ? START_T[tr.to] : STOP_T[tr.to];
      return { kind: 'tr', title: `${tr.dir > 0 ? 'STOP TO LOAD' : 'LOAD TO STOP'} – menuju step ${STEP[tr.to]}`, groups: [[`SYARAT STEP ${STEP[tr.to]} (${tr.dir > 0 ? 'START' : 'STOP'})`, arr]], lim, t: tr.t, fail: tr.fail };
    }
    if (tr && !tr.started && tr.dir > 0 && tr.to === 1) return { kind: 'wait', title: 'Menunggu START CONDITION (sekuens belum berjalan)', groups: scGroups() };
    if (tr && !tr.started) return { kind: 'wait', title: `Menunggu prasyarat step ${STEP[tr.to]}` + (tr.dir < 0 && tr.to === 0 ? ' (14LT – putaran nol 20 s)' : tr.to === 4 ? ' (synchronizer bebas, jaringan tersedia, 86-4 reset)' : ''), groups: [] };
    if (u.pos === 0) return { kind: 'idle0', title: 'Unit STAND STILL – kesiapan START (STARTING + CONTROL CONDITION)', groups: scGroups() };
    return { kind: 'idle', title: `Unit di step ${STEP[u.pos]} – tidak ada transisi aktif`, groups: [] };
  }

  // dampak sebuah DI terganggu: daftar syarat yang menjadi NG karena nilai LCU berbeda dengan nilai peralatan
  function impact(u, tag) {
    const n = u.n, res = [];
    const chk = (name, list) => { const arr = items(list); arr.forEach((x) => { if (x.id && fullTag(n, x.id) === tag && !(x.g ? x.gok : x.ok)) res.push(name); }); };
    chk('STARTING CONDITION-1 → start ditolak', u.sc1()); chk('STARTING CONDITION-2 → start ditolak', u.sc2()); chk('STARTING CONDITION-3 → start ditolak', u.sc3()); chk('CONTROL CONDITION → start ditolak', u.ctrlList());
    for (let k = 1; k <= 5; k++) { const c = u.condStart(k); chk(`START step ${STEP[k]} (timer ${START_T[k]} s)`, [].concat(c.a || [], c.b || [], c.c || []).filter((x) => x[2] !== 'dash')); }
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
    s += `<text x="${xIn}" y="14" style="font-size:10px;fill:${CY}">INPUT DI (dibaca LCU)</text><text x="${xG + 40}" y="14" style="font-size:10px;fill:${CY}">LOGIKA LCU</text>`;
    const yMid = top + (arr.length * rowH) / 2 - 4, all = condOK(arr);
    arr.forEach((x, i) => {
      const y = top + i * rowH + 8, tag = x.id ? fullTag(n, x.id) : '', fl = tag && S0.flt[tag], raw = tag ? S0.raw[tag] : undefined;
      const good = x.g ? x.gok : x.ok, col = good ? GRN : RED;
      s += `<g ${tag ? `data-a="x:sqfd:${n}:${tag}" style="cursor:pointer"` : ''}><rect x="${xIn}" y="${y - 9}" width="${wIn}" height="18" fill="${fl ? '#3a2a00' : '#0d0d0d'}" stroke="${fl ? YEL : '#555'}"/>`;
      s += `<text x="${xIn + 4}" y="${y + 4}" style="font-size:9.5px;fill:${tag ? YEL : GRY}">${esc(tag || '(internal)')}</text>`;
      s += `<text x="${xIn + 62}" y="${y + 4}" style="font-size:9px;fill:#e8e8e8">${esc(x.lab.slice(0, 50))}</text>`;
      s += `<text x="${xIn + wIn - 4}" y="${y + 4}" style="font-size:10px;fill:${col};text-anchor:end">${bit(x.v)}</text></g>`;
      if (fl) s += `<text x="${xIn + wIn + 4}" y="${y - 1}" style="font-size:8px;fill:${YEL}">⚡${esc(fmode(fl))}</text><text x="${xIn + wIn + 4}" y="${y + 8}" style="font-size:8px;fill:${GRY}">alat=${bit(raw)}</text>`;
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
          return `<div>${tag ? `<a data-a="x:sqfd:${n}:${tag}" style="color:${YEL};cursor:pointer">${esc(tag)}</a>` : '(internal)'} ${esc(x.lab)} = ${bit(x.v)} (perlu ${x.need ? 1 : 0})${fl ? ` <span style="color:${YEL}">⚡ ${esc(fmode(fl))} – alat sebenarnya ${bit(S0.raw[tag])}</span>` : ''}</div>`; }).join('')}</div>`;
        h += `</div>`;
      });
    } else h += `<div class="note2">Tidak ada transisi. Beri perintah 43S-CS (LOAD / STOP) untuk melihat dampak gangguan pada sekuens.</div>`;
    // akar masalah
    const rc = tags.filter((t) => S0.lcu[t] !== undefined && S0.lcu[t] !== S0.raw[t]);
    if (F.kind === 'tr' && F.groups[0]) {
      const ng = F.groups[0][1].filter((x) => !(x.g ? x.gok : x.ok));
      if (ng.length) {
        const byFault = ng.filter((x) => x.id && S0.flt[fullTag(n, x.id)] && S0.lcu[fullTag(n, x.id)] !== S0.raw[fullTag(n, x.id)]);
        h += `<div class="det" style="margin-top:6px">${byFault.length ? `<b>Penyebab:</b> sinyal ${byFault.map((x) => esc(fullTag(n, x.id))).join(', ')} terganggu – peralatan sudah pada posisi yang diminta, tetapi LCU membaca nilai lain. Step tidak selesai sampai sinyal normal atau timer habis → SEQUENCE MONITOR ERROR.${ng.length > byFault.length ? ` Syarat NG lainnya (${ng.filter((x) => !byFault.includes(x)).map((x) => esc(x.lab)).join('; ')}) ikut tertahan karena langkah berikutnya menunggu sinyal tersebut.` : ''}`
          : `<b>Menunggu:</b> ${ng.map((x) => esc(x.lab)).join('; ')} – peralatan sedang bergerak / proses berjalan (bukan gangguan I/O).`}</div>`;
      }
    }
    if (rc.length && F.kind !== 'tr') h += `<div class="det" style="margin-top:6px"><b>Sinyal berbeda dengan kondisi alat saat ini:</b> ${rc.map((t) => `${esc(t)} (LCU ${bit(S0.lcu[t])}, alat ${bit(S0.raw[t])})`).join(', ')}</div>`;
    if (tags.length) {
      h += `<h4>DAMPAK GANGGUAN AKTIF (prediksi dari logika sekuens)</h4><table class="tbl" style="font-size:11px"><tr><th>Tag</th><th>Mode</th><th>Syarat yang menjadi NG dengan kondisi alat sekarang</th></tr>`;
      tags.forEach((t) => { const im = impact(u, t), c = findCat(n, t);
        h += `<tr><td><a data-a="x:sqfd:${n}:${esc(t)}" style="color:${YEL};cursor:pointer">${esc(t)}</a><div style="font-size:9.5px;color:${GRY}">${esc(c ? c.name : '')}</div></td><td>${esc(fmode(S0.flt[t]))}</td><td>${im.length ? im.map(esc).join('<br>') : `<span style="color:${GRY}">belum ada (nilai LCU = nilai yang diminta pada kondisi alat sekarang; dampak muncul saat kondisi alat berubah)</span>`}</td></tr>`; });
      h += `</table>`;
    }
    const ev = P.events.filter((e) => e.msg.startsWith(`U${n}:`) || /SEQ FAULT/.test(e.msg) || e.msg.startsWith(`${n}ALM`)).slice(-12).reverse();
    h += `<h4>3. RIWAYAT KEJADIAN UNIT ${n}</h4><div class="ev">${ev.map((e) => `<div style="color:${e.type === 'ALARM' ? RED : e.type === 'OK' ? GRN : e.type === 'CMD' ? YEL : '#ccc'}">${X.fmtT(e.t)} ${esc(e.type)} ${esc(e.msg)}</div>`).join('') || '—'}</div>`;
    h += `</div><div class="col">`;

    h += `<h4>4. SKENARIO CEPAT (UNIT ${n})</h4><div class="note2">Skenario menimpa gangguan I/O unit ini. Setelah dipasang, beri perintah START/STOP lalu amati diagnosa.</div>`;
    h += SQ.PRESETS.map((p) => `<div style="border:1px solid #333;margin:3px 0;padding:4px 6px"><div style="display:flex;justify-content:space-between;gap:6px;align-items:center"><b style="color:${YEL};font-weight:400">${esc(p.t)}</b>${B(`x:sqfp:${n}:${p.k}`, 'PASANG', '#ffd040')}</div><div style="font-size:10.5px;color:#bbb">${esc(p.e)}</div></div>`).join('');
    h += `<div>${B(`x:sqfclr:${n}`, `NORMALKAN SEMUA I/O UNIT ${n}`, '#ff9090')}</div>`;

    h += `<h4>5. DAFTAR DI SEKUENS UNIT ${n} (JEZ1L675 / JEZ1L682)</h4>`;
    const grps = ['ALL', ...Object.keys(SQ.G)];
    h += `<div>${grps.map((g) => B(`x:sqfg:${g}`, g === 'ALL' ? 'SEMUA' : g, g === st.grp ? '#ffff80' : '#d0d0d0', 'padding:3px 7px;font-size:10px')).join('')}</div>`;
    const list = catOf(n).filter((c) => st.grp === 'ALL' || c.grp === st.grp);
    h += `<table class="tbl" style="font-size:11px"><tr><th>Tag</th><th>Sinyal</th><th>SH</th><th>Alat</th><th>LCU</th><th>Gangguan</th></tr>`;
    let lastG = '';
    list.forEach((c) => {
      if (c.grp !== lastG) { lastG = c.grp; h += `<tr><td colspan="6" style="color:${CY};font-size:10px;padding-top:6px">${esc(c.gname)}</td></tr>`; }
      const fl = S0.flt[c.tag], raw = S0.raw[c.tag], lcu = S0.lcu[c.tag];
      h += `<tr style="${fl ? 'background:#2a2000' : ''};cursor:pointer" data-a="x:sqfd:${n}:${esc(c.tag)}"><td style="color:${YEL}">${esc(c.tag)}</td><td style="font-size:10px">${esc(c.name)}${c.dev ? ` <span style="color:${GRY}">(${esc(c.dev)})</span>` : ''}</td><td style="font-size:10px">${esc(c.sh)}</td><td class="n">${bit(raw)}</td><td class="n" style="color:${lcu !== raw ? RED : '#fff'}">${bit(lcu)}</td><td style="font-size:10px;color:${YEL}">${esc(fmode(fl))}</td></tr>`;
    });
    h += `</table><div class="note2" style="margin-top:8px">Kolom <b>Alat</b> = status peralatan pada model; <b>LCU</b> = nilai DI yang dipakai logika sekuens. Gangguan I/O hanya mengubah sinyal yang dibaca LCU, peralatannya tetap bekerja normal.
      Tag dan logika mengikuti block diagram JEZ1L675 (SH.10–15, 20–24, 27, 30–36, 50) dan daftar I/O JEZ1L682. Setelah SEQUENCE MONITOR ERROR, model hanya membangkitkan alarm dan sekuens tetap menunggu sinyal (gambar tidak menunjukkan tindakan otomatis lain); langkah operator: normalkan sinyal atau pilih 43S-CS STOP.
      Nilai timer mengikuti layar sequence monitor simulator (RUNNING = I/V 180 s + running 60 s).</div></div></div>`;
    return h;
  }

  /* ---------------- aksi ---------------- */
  const btns = (items2) => `<div class="simgrid">${items2.map(([a, l, c]) => `<button data-a="${a}" ${c ? `class="${c}"` : ''}>${esc(l)}</button>`).join('')}</div>`;
  Object.assign(EXTA, {
    sqfd: ([n, tag]) => {
      const S0 = S(), c = findCat(+n, tag), fl = S0.flt[tag];
      const u = U(+n), im = impact(u, tag);
      const msg = `${tag}  ${c ? c.name : ''}${c && c.dev ? ' (' + c.dev + ')' : ''}\n${c ? c.gname + ' · JEZ1L675 SH.' + c.sh : ''}\n\nNilai peralatan: ${bit(S0.raw[tag])}\nNilai dibaca LCU: ${bit(S0.lcu[tag])}${fl ? '\nGangguan: ' + fmode(fl) : '\nGangguan: tidak ada'}` +
        (im.length ? `\n\nDengan kondisi alat sekarang, syarat yang NG:\n- ${im.join('\n- ')}` : '');
      const m = fl ? fl.mode : '';
      dialog('GANGGUAN I/O SEKUENS', msg, null, { extra: btns([[`x:sqfs:${n}:${tag}:off`, 'PAKSA 0 (OFF)', m === 'off' ? 'on' : ''], [`x:sqfs:${n}:${tag}:on`, 'PAKSA 1 (ON)', m === 'on' ? 'on' : ''], [`x:sqfs:${n}:${tag}:inv`, 'TERBALIK', m === 'inv' ? 'on' : '']]) +
        btns([[`x:sqfs:${n}:${tag}:dly:10`, 'TERLAMBAT 10 s', m === 'dly' && fl.sec === 10 ? 'on' : ''], [`x:sqfs:${n}:${tag}:dly:30`, 'TERLAMBAT 30 s', m === 'dly' && fl.sec === 30 ? 'on' : ''], [`x:sqfs:${n}:${tag}:dly:120`, 'TERLAMBAT 120 s', m === 'dly' && fl.sec === 120 ? 'on' : ''], [`x:sqfs:${n}:${tag}:`, 'NORMAL', !m ? 'on' : '']]) });
    },
    sqfs: ([n, tag, mode, sec]) => { X.closeDlg(); S().set(tag, mode || null, sec); },
    sqfp: ([n, k]) => { const p = SQ.PRESETS.find((x) => x.k === k); dialog('SEQ FAULT SIM', `UNIT ${n}\n${p.t}\n\nPerkiraan dampak:\n${p.e}\n\nGangguan I/O lain pada unit ini dinormalkan dahulu.\n\nEXECUTE ?`, () => S().preset(k, +n)); },
    sqfclr: ([n]) => dialog('SEQ FAULT SIM', `Normalkan semua gangguan I/O sekuens UNIT ${n}?\n\nEXECUTE ?`, () => S().clearUnit(+n)),
    sqfg: ([g]) => { st.grp = g; },
    sqfcmd: ([n, k]) => { const u = U(+n); dialog('43S-CS', `UNIT ${n}\n43S-CS ${STEP[+k]} OPERATE\n\nEXECUTE ?`, () => u.operate43S(+k)); },
  });

  EXTU.sqf = { no: (n) => '0016' + n, title: (n) => `SEQ FAULT SIM UNIT${n}`, grp: 'sqf', html: true, draw };
  TABS.sqf = (n) => [[`sqf${n}`, `SEQ FAULT U${n}`], [`s2l${n}`, 'STOP→LOAD'], [`l2s${n}`, 'LOAD→STOP'], [`sc1${n}`, 'START COND.'], [`ann${n}`, `UNIT${n} ANN`], ['force', 'FORCING I/O'], ['alm', 'ALARM SUM.']];
})();
