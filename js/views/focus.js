import { store } from '../store.js';
import { app, navbar, notify } from '../core.js';
import { esc, ymd, addDays, pad, WD, fmtMinutes, uid } from '../util.js';
import { icon, haptic, chime, openSheet, guardText, toast, audioCtx, confetti } from '../ui.js';
import { computeTimes, PRAYERS } from '../prayer.js';
import { FOCUS_LINES } from '../content.js';

const PRESETS = [15, 25, 50, 90];
let draft = { minutes: null, label: '', subjectId: null, habitId: null };
let shield = null, ticker = null, wakeLock = null;

// ---------- Ambient sound generator ----------
let amb = null;
function stopAmbient() { try { amb?.src.stop(); amb?.gain.disconnect(); } catch {} amb = null; }
function startAmbient(kind) {
  stopAmbient(); if (kind === 'none') return;
  const ctx = audioCtx(); const len = ctx.sampleRate * 4; const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else if (kind === 'white') d[i] = w * 0.35;
      else {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        let p = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        if (kind === 'rain' && Math.random() < 0.0009) p += (Math.random() - 0.5) * 0.9;
        d[i] = p;
      }
    }
  }
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const gain = ctx.createGain(); gain.gain.value = 0;
  let node = src;
  if (kind === 'rain') { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400; src.connect(f); node = f; }
  node.connect(gain).connect(ctx.destination); src.start();
  gain.gain.linearRampToValueAtTime(kind === 'white' ? 0.25 : 0.5, ctx.currentTime + 1.5);
  amb = { src, gain };
}

// ---------- Session state ----------
function run() { return store.state.focus.running || null; }
function remaining(r) { return r.paused ? r.remaining : Math.max(0, r.endAt - Date.now()); }

export function startFocus(opts = {}) {
  const f = store.state.focus;
  const minutes = opts.minutes || draft.minutes || f.preset || 25;
  f.running = { id: uid(), phase: 'focus', minutes, endAt: Date.now() + minutes * 60000, start: Date.now(), label: opts.label ?? draft.label, subjectId: opts.subjectId ?? draft.subjectId,
    habitId: opts.habitId ?? draft.habitId, paused: false, remaining: 0, distractions: 0, prayerPaused: null, lastPrayerCheck: Date.now() };
  store.save(); haptic('heavy'); chime('tick');
  openShield();
}

function finishFocus(completed = true) {
  const s = store.state; const f = s.focus; const r = f.running; if (!r) return;
  if (r.phase === 'focus') {
    const mins = completed ? r.minutes : Math.floor((r.minutes * 60000 - remaining(r)) / 60000);
    if (mins >= 1) {
      f.sessions.push({ start: r.start, end: Date.now(), minutes: mins, label: r.label, subjectId: r.subjectId, distractions: r.distractions, completed });
      app.addXp(mins);
      if (r.habitId) { const ds = ymd(); s.habitLog[ds] = s.habitLog[ds] || {}; s.habitLog[ds][r.habitId] = (s.habitLog[ds][r.habitId] || 0) + mins; }
    }
    if (completed) {
      chime('end'); haptic('success'); notify('Fokus geschafft', `${r.minutes} min ${r.label ? '· ' + r.label : ''} – Zeit für eine Pause.`, 'focus');
      if (f.autoBreak) { f.running = { ...r, phase: 'break', minutes: f.breakMin, endAt: Date.now() + f.breakMin * 60000, paused: false }; store.save(); renderShield(); confetti(); return; }
    }
  } else if (completed) { chime('tick'); haptic('success'); notify('Pause vorbei', 'Bereit für die nächste Runde?', 'focus'); }
  f.running = null; store.save(); closeShield(); app.refresh();
}

// ---------- Fullscreen shield ----------
function openShield() {
  if (!shield) {
    shield = document.createElement('div'); shield.className = 'focus-shield';
    document.body.appendChild(shield);
  }
  document.querySelector('.tabbar')?.classList.add('hide');
  renderShield();
  requestAnimationFrame(() => shield.classList.add('on'));
  clearInterval(ticker); ticker = setInterval(tick, 250);
  requestWake();
  startAmbient(store.state.settings.ambient);
}
function closeShield() {
  clearInterval(ticker); ticker = null; stopAmbient();
  try { wakeLock?.release(); } catch {} wakeLock = null;
  document.querySelector('.tabbar')?.classList.remove('hide');
  if (shield) { shield.classList.remove('on'); const sh = shield; shield = null; setTimeout(() => sh.remove(), 600); }
}
async function requestWake() { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch {} }

function renderShield() {
  const r = run(); if (!r || !shield) return;
  const isBreak = r.phase === 'break';
  shield.classList.toggle('break', isBreak);
  const line = FOCUS_LINES[Math.floor(r.start / 1000) % FOCUS_LINES.length];
  shield.innerHTML = `<div class="orb"></div>
    <div class="center" style="position:relative">
      <div class="eyebrow" style="color:${isBreak ? 'var(--green)' : 'var(--blue)'}">${isBreak ? 'Pause' : 'Deep Work'}</div>
      <div class="bold mt8" style="font-size:20px">${esc(isBreak ? 'Atme durch' : (r.label || 'Fokus'))}</div>
    </div>
    <div class="center" style="position:relative">
      ${r.prayerPaused ? `<div class="mid-num" style="color:var(--gold)">Zeit für ${esc(r.prayerPaused)}</div><p class="muted">Der Timer ist pausiert. Bete in Ruhe.</p>
        <button class="btn gold mt16" data-resume>Weiter nach dem Gebet</button>` : `
      ${isBreak ? '<div class="breath-ball" id="ball"></div><div class="muted" id="breathTxt">Einatmen …</div>' : ''}
      <div class="big" id="shTime">--:--</div>
      <div class="bar" style="width:220px;margin:12px auto 0"><i id="shBar" style="width:0;background:${isBreak ? 'var(--green)' : 'var(--blue)'}"></i></div>
      <p class="muted serif" style="font-size:17px;margin-top:22px">${esc(isBreak ? 'Steh auf, trink Wasser, schau in die Ferne.' : line)}</p>`}
    </div>
    <div class="hstack" style="gap:28px;position:relative">
      <button class="btn round" data-pause aria-label="Pause">${icon(r.paused ? 'play' : 'pause')}</button>
      <div class="hold-btn" id="holdX" aria-label="Halten zum Beenden">
        <svg class="prog" viewBox="0 0 74 74"><circle cx="37" cy="37" r="34" fill="none" stroke="var(--red)" stroke-width="3" stroke-dasharray="213.6" stroke-dashoffset="213.6" id="holdC"/></svg>${icon('stop')}</div>
      ${isBreak ? `<button class="btn round" data-skip aria-label="Pause überspringen">${icon('right')}</button>` : `<div style="width:64px;text-align:center" class="tiny muted">${r.distractions ? `${r.distractions}× raus` : ''}</div>`}
    </div>
    <div class="tiny faint" style="position:relative">Zum Beenden das Stopp-Symbol 2 Sekunden halten</div>`;
  shield.querySelector('[data-pause]').onclick = () => {
    if (r.paused) { r.endAt = Date.now() + r.remaining; r.paused = false; } else { r.remaining = remaining(r); r.paused = true; }
    haptic(); store.save(); renderShield();
  };
  shield.querySelector('[data-resume]')?.addEventListener('click', () => { r.prayerPaused = null; r.endAt = Date.now() + r.remaining; r.paused = false; store.save(); renderShield(); });
  shield.querySelector('[data-skip]')?.addEventListener('click', () => { store.state.focus.running = null; store.save(); closeShield(); app.refresh(); });
  // hold to exit
  const hb = shield.querySelector('#holdX'), hc = shield.querySelector('#holdC'); let t0 = null, raf = null;
  const step = () => { const p = Math.min(1, (Date.now() - t0) / 2000); hc.style.strokeDashoffset = 213.6 * (1 - p); if (p >= 1) { haptic('heavy'); finishFocus(false); return; } raf = requestAnimationFrame(step); };
  hb.addEventListener('pointerdown', (e) => { e.preventDefault(); t0 = Date.now(); haptic(); raf = requestAnimationFrame(step); });
  const cancel = () => { cancelAnimationFrame(raf); t0 = null; if (hc) hc.style.strokeDashoffset = 213.6; };
  hb.addEventListener('pointerup', cancel); hb.addEventListener('pointerleave', cancel); hb.addEventListener('pointercancel', cancel);
  tick();
}

let breathPhase = 0;
function tick() {
  const r = run(); if (!r) return closeShield();
  const left = remaining(r);
  const el = shield?.querySelector('#shTime');
  if (el) {
    const sec = Math.ceil(left / 1000); el.textContent = `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
    shield.querySelector('#shBar').style.width = `${(1 - left / (r.minutes * 60000)) * 100}%`;
  }
  const ball = shield?.querySelector('#ball');
  if (ball) { const ph = Math.floor(Date.now() / 4000) % 2; if (ph !== breathPhase) { breathPhase = ph; ball.classList.toggle('in', ph === 0); shield.querySelector('#breathTxt').textContent = ph === 0 ? 'Einatmen …' : 'Ausatmen …'; } }
  // auto pause at prayer time
  if (r.phase === 'focus' && !r.paused && store.state.settings.focusPauseOnPrayer) {
    const t = computeTimes(new Date(), store.state.settings); const now = Date.now();
    const hit = PRAYERS.find((p) => t[p.key].getTime() > r.lastPrayerCheck && t[p.key].getTime() <= now);
    r.lastPrayerCheck = now;
    if (hit) { r.remaining = left; r.paused = true; r.prayerPaused = hit.name; store.save(); chime('end'); haptic('success'); notify(`Zeit für ${hit.name}`, 'Dein Fokus-Timer ist pausiert.', 'prayer'); renderShield(); return; }
  }
  if (!r.paused && left <= 0) finishFocus(true);
}

// Count leaving the app as a distraction
document.addEventListener('visibilitychange', () => {
  const r = run(); if (!r || r.phase !== 'focus' || r.paused) return;
  if (document.hidden) { r.distractions = (r.distractions || 0) + 1; r._leftAt = Date.now(); store.save(); }
  else {
    const away = r._leftAt ? Math.round((Date.now() - r._leftAt) / 1000) : 0;
    if (away > 3) setTimeout(() => toast(`${icon('eye')} ${away}s abgelenkt. Zurück zum Fokus.`, 'warn'), 400);
    requestWake(); renderShield();
  }
});

export function resumeIfRunning() { if (run()) openShield(); }

// ---------- View ----------
function stats(s) {
  const today = ymd(); const sess = s.focus.sessions;
  const byDay = {}; sess.forEach((x) => { const d = ymd(new Date(x.start)); byDay[d] = (byDay[d] || 0) + x.minutes; });
  const week = Array.from({ length: 7 }, (_, i) => { const d = addDays(new Date(), i - 6); return { d, m: byDay[ymd(d)] || 0 }; });
  const weekTotal = week.reduce((a, b) => a + b.m, 0);
  const bySub = {}; sess.filter((x) => Date.now() - x.start < 7 * 86400000).forEach((x) => { const k = x.subjectId || '_'; bySub[k] = (bySub[k] || 0) + x.minutes; });
  let streak = 0; for (let i = 0; i < 400; i++) { const d = ymd(addDays(new Date(), -i)); if (byDay[d]) streak++; else if (i === 0) continue; else break; }
  return { todayMin: byDay[today] || 0, week, weekTotal, bySub, streak, total: sess.reduce((a, b) => a + b.minutes, 0), count: sess.length };
}

app.register({
  id: 'focus',
  render(s) {
    const f = s.focus; const st = stats(s);
    const mins = draft.minutes || f.preset;
    const max = Math.max(60, ...st.week.map((w) => w.m));
    const R = 120, C = 2 * Math.PI * R;
    return `${navbar('Fokus', `<button class="nav-btn" data-guide aria-label="Apps sperren">${icon('shield')}</button>`)}
      <div class="subtitle">Heute ${fmtMinutes(st.todayMin)} fokussiert${st.streak > 1 ? ` · ${st.streak} Tage in Folge` : ''}</div>
      <div class="focus-dial">
        <svg viewBox="0 0 270 270" width="270" height="270"><circle cx="135" cy="135" r="${R}" fill="none" stroke="var(--card)" stroke-width="14"/>
          <circle cx="135" cy="135" r="${R}" fill="none" stroke="var(--blue)" stroke-width="14" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - Math.min(1, mins / 120))}" transform="rotate(-90 135 135)" style="transition:stroke-dashoffset .6s var(--spring)"/></svg>
        <div class="ring-in"><div><div class="time">${pad(mins)}:00</div><div class="small muted">Minuten Deep Work</div></div></div>
      </div>
      <div class="focus-presets">${PRESETS.map((p) => `<button class="${p === mins ? 'on' : ''}" data-min="${p}">${p}</button>`).join('')}<button class="${!PRESETS.includes(mins) ? 'on' : ''}" data-custom>${!PRESETS.includes(mins) ? mins : 'Eigene'}</button></div>
      <input class="field" id="fLabel" placeholder="Woran arbeitest du? z. B. Mathe-Aufgaben" value="${esc(draft.label)}" maxlength="60">
      <div class="chips mt8 no-drag" id="fSub"><button class="chip ${!draft.subjectId ? 'on' : ''}" data-k="">Allgemein</button>${s.subjects.map((x) => `<button class="chip ${x.id === draft.subjectId ? 'on' : ''}" data-k="${x.id}"><span class="dot" style="background:${x.color}"></span> ${esc(x.name)}</button>`).join('')}</div>
      <button class="btn primary block" data-start style="height:56px;font-size:19px">${icon('play')} Fokus starten</button>

      <div class="list mt16">
        <div class="row"><div class="icon-tile" style="background:var(--teal)">${icon('music')}</div><div class="grow"><div class="t">Hintergrund-Sound</div></div>
          <select id="fAmb">${[['none', 'Aus'], ['rain', 'Regen'], ['pink', 'Rauschen'], ['brown', 'Brown Noise'], ['white', 'White Noise']].map(([v, l]) => `<option value="${v}" ${s.settings.ambient === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="row"><div class="icon-tile" style="background:var(--green)">${icon('wind')}</div><div class="grow"><div class="t">Pause danach</div><div class="s">mit Atemübung</div></div>
          <select id="fBreak">${[0, 5, 10, 15].map((v) => `<option value="${v}" ${(f.autoBreak ? f.breakMin : 0) === v ? 'selected' : ''}>${v ? v + ' min' : 'Keine'}</option>`).join('')}</select></div>
        <div class="row"><div class="icon-tile" style="background:var(--gold2)">${icon('moon')}</div><div class="grow"><div class="t">Bei Gebetszeit pausieren</div></div>
          <label class="tgl"><input type="checkbox" id="fPray" ${s.settings.focusPauseOnPrayer ? 'checked' : ''}><span></span></label></div>
      </div>

      <div class="section-h"><h2>Statistik</h2><span class="small muted">${fmtMinutes(st.weekTotal)} diese Woche</span></div>
      <div class="card">
        <div style="display:flex;align-items:flex-end;gap:8px;height:120px">${st.week.map((w) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end">
          <span class="tiny muted">${w.m ? w.m : ''}</span><div style="width:100%;max-width:28px;border-radius:6px;background:${ymd(w.d) === ymd() ? 'var(--blue)' : 'rgba(10,132,255,.4)'};height:${Math.max(3, (w.m / max) * 85)}%;transition:height .8s var(--ease)"></div>
          <span class="tiny muted">${WD[w.d.getDay()]}</span></div>`).join('')}</div>
      </div>
      <div class="grid3">
        <div class="card mb0 center"><div class="mid-num">${st.count}</div><div class="tiny muted">Sessions</div></div>
        <div class="card mb0 center"><div class="mid-num">${Math.round(st.total / 60)}</div><div class="tiny muted">Stunden gesamt</div></div>
        <div class="card mb0 center"><div class="mid-num">${st.streak}</div><div class="tiny muted">Tage-Serie</div></div>
      </div>
      ${Object.keys(st.bySub).length ? `<div class="list-h">Diese Woche nach Fach</div><div class="list">${Object.entries(st.bySub).sort((a, b) => b[1] - a[1]).map(([k, m]) => {
        const sub = s.subjects.find((x) => x.id === k);
        return `<div class="row"><span class="dot" style="background:${sub?.color || 'var(--label3)'};width:12px;height:12px"></span><div class="grow"><div class="t">${esc(sub?.name || 'Allgemein')}</div><div class="bar mt8"><i style="width:${(m / st.weekTotal) * 100}%;background:${sub?.color || 'var(--label3)'}"></i></div></div><span class="v">${fmtMinutes(m)}</span></div>`;
      }).join('')}</div>` : ''}
      <button class="card tap mt12 hstack" data-guide style="width:100%;text-align:left"><div class="icon-tile" style="background:var(--red);width:40px;height:40px;border-radius:11px">${icon('shield')}</div>
        <div style="flex:1"><div class="bold">Social Media wirklich sperren</div><div class="small muted">3 iOS-Tricks, die Instagram & Co. blockieren</div></div>${icon('right', 'chev')}</button>`;
  },
  mount(root, s) {
    const f = s.focus;
    root.querySelectorAll('[data-min]').forEach((b) => b.onclick = () => { draft.minutes = Number(b.dataset.min); f.preset = draft.minutes; store.save(); haptic(); app.refresh(); });
    root.querySelector('[data-custom]').onclick = () => {
      openSheet(`<h3 class="sheet-title">Eigene Dauer</h3><input class="field center" type="number" inputmode="numeric" id="cm" value="${draft.minutes || f.preset}" min="1" max="240" style="font-size:34px;font-weight:700">
        <p class="center small muted">Minuten (1–240)</p><button class="btn primary block mt16" data-ok>Übernehmen</button>`, {
        onMount(el, api) { el.querySelector('[data-ok]').onclick = () => { const v = Math.min(240, Math.max(1, parseInt(el.querySelector('#cm').value, 10) || 25)); draft.minutes = v; f.preset = v; store.save(); api.close(); app.refresh(); }; },
      });
    };
    root.querySelector('#fLabel').oninput = (e) => draft.label = e.target.value;
    root.querySelector('#fSub').onclick = (e) => { const b = e.target.closest('.chip'); if (!b) return; draft.subjectId = b.dataset.k || null; root.querySelectorAll('#fSub .chip').forEach((x) => x.classList.toggle('on', x === b)); haptic(); };
    root.querySelector('#fAmb').onchange = (e) => { s.settings.ambient = e.target.value; store.save(); if (e.target.value !== 'none') { startAmbient(e.target.value); setTimeout(stopAmbient, 2500); } };
    root.querySelector('#fBreak').onchange = (e) => { const v = Number(e.target.value); f.autoBreak = v > 0; if (v) f.breakMin = v; store.save(); };
    root.querySelector('#fPray').onchange = (e) => { s.settings.focusPauseOnPrayer = e.target.checked; store.save(); haptic(); };
    root.querySelector('[data-start]').onclick = () => { if (!guardText(draft.label)) return; startFocus(); draft.habitId = null; };
    root.querySelectorAll('[data-guide]').forEach((b) => b.onclick = blockGuide);
  },
  onShow(opts) {
    if (opts.minutes) { draft = { minutes: opts.minutes, label: opts.label || '', subjectId: opts.subjectId || null, habitId: opts.habitId || null }; app.render('focus'); }
    if (opts.autostart) startFocus();
  },
});

export function blockGuide() {
  openSheet(`<div class="shield-hero">${icon('shield')}<h3 class="sheet-title">Ablenkung wirklich blockieren</h3>
    <p class="muted small">Apple erlaubt Web-Apps nicht, andere Apps zu sperren. Mit diesen kostenlosen iOS-Funktionen klappt es trotzdem – einmal einrichten, für immer Ruhe.</p></div>
    <div class="list-h">1 · Fokus „Lernen“ (Apps ausblenden)</div>
    <div class="card" style="background:var(--card2)"><ol class="small" style="margin:0;padding-left:18px;line-height:1.6">
      <li>Einstellungen → Fokus → <b>+</b> → Eigener Fokus → „Lernen“</li>
      <li>Mitteilungen: nur erlaubte Personen und Apps</li>
      <li>Bildschirme anpassen: Home-Bildschirm nur mit dieser App und Schul-Apps</li>
      <li>Fokus-Filter: Safari-Tab-Gruppe „Schule“</li>
      <li>Optional: Action Button (iPhone 15 Pro+) → Fokus „Lernen“ – ein Druck und du bist im Lernmodus</li></ol></div>
    <div class="list-h">2 · Bildschirmzeit (Apps sperren)</div>
    <div class="card" style="background:var(--card2)"><ol class="small" style="margin:0;padding-left:18px;line-height:1.6">
      <li>Einstellungen → Bildschirmzeit → <b>App-Limits</b> → Limit hinzufügen</li>
      <li>„Soziale Netzwerke“ wählen, z. B. 30 min pro Tag</li>
      <li><b>Auszeit</b> planen, z. B. 16–19 Uhr für Hausaufgaben</li>
      <li>Code für Bildschirmzeit von Eltern oder Freund setzen lassen – sonst klickt man zu schnell „Ignorieren“</li></ol></div>
    <div class="list-h">3 · Kurzbefehl-Automation (Instagram abfangen)</div>
    <div class="card" style="background:var(--card2)"><ol class="small" style="margin:0;padding-left:18px;line-height:1.6">
      <li>Kurzbefehle → Automation → <b>+</b> → „App“ → Instagram, TikTok … → „Wird geöffnet“ → „Sofort ausführen“</li>
      <li>Aktion „Mitteilung anzeigen“: „Du wolltest fokussiert bleiben.“</li>
      <li>Aktion „Zum Home-Bildschirm“ – die App schließt sich direkt wieder</li></ol></div>
    <div class="list-h">4 · Erwachsenen-Inhalte systemweit sperren</div>
    <div class="card" style="background:var(--card2)"><ol class="small" style="margin:0;padding-left:18px;line-height:1.6">
      <li>Einstellungen → Bildschirmzeit → <b>Beschränkungen</b> aktivieren</li>
      <li>Store-, Web- & Siri-Inhalte → Webinhalte → <b>„Websites für Erwachsene beschränken“</b></li>
      <li>Optional: Sperrseiten unter „Nie erlauben“ eintragen</li>
      <li>Code von einer Vertrauensperson setzen lassen</li></ol></div>
    <p class="tiny faint center">In dieser App selbst blockiert ein Filter automatisch jede Eingabe und jeden Link mit eindeutigen Erwachsenen-Inhalten.</p>`, { tall: true });
}
