import { store } from '../store.js';
import { app, navbar } from '../core.js';
import { esc, ymd, uid, addDays, hm, parseYmd, daysUntil, fmtCountdown } from '../util.js';
import { icon, haptic, chime, openSheet, confirmSheet, guardText, toast, ring, segmented, bindSegmented, confetti } from '../ui.js';
import { computeTimes, nextPrayer, PRAYERS, toHijri, islamicDay, isSunnahFast, qiblaBearing, distanceToMakkah } from '../prayer.js';
import { VERSES, HADITHS, ADHKAR, DHIKR_PRESETS, QURAN_PAGES, JUZ_START, juzOfPage } from '../content.js';

const STATE_LABEL = { ontime: 'Pünktlich', late: 'Verspätet', qada: 'Nachgeholt' };
const CYCLE = [undefined, 'ontime', 'late', 'qada'];

export function prayerStreak(s) {
  let n = 0; const today = new Date();
  for (let i = 0; i < 1000; i++) {
    const ds = ymd(addDays(today, -i)); const d = s.prayers[ds] || {};
    const all = PRAYERS.every((p) => d[p.key]);
    if (all) n++; else if (i === 0) continue; else break;
  }
  return n;
}
export function prayedToday(s) { const d = s.prayers[ymd()] || {}; return PRAYERS.filter((p) => d[p.key]).length; }

function markPrayer(key, ds = ymd()) {
  const s = store.state; s.prayers[ds] = s.prayers[ds] || {};
  const cur = s.prayers[ds][key]; const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
  if (next) s.prayers[ds][key] = next; else delete s.prayers[ds][key];
  if (!cur && next) { app.addXp(15); haptic('success'); chime('done'); } else if (cur && !next) { app.addXp(-15); haptic(); } else haptic();
  store.save();
  if (PRAYERS.every((p) => s.prayers[ds]?.[p.key]) && !cur) { setTimeout(() => { confetti(); toast(`${icon('sparkles')} Alle 5 Gebete – Mā shāʾ Allāh!`, 'ok'); }, 200); }
}

export function quoteOfDay(s, kind = 'verse', offset = 0) {
  const list = kind === 'verse'
    ? [...VERSES, ...s.customQuotes.filter((q) => q.type === 'verse').map((q) => [q.text, q.source])]
    : [...HADITHS, ...s.customQuotes.filter((q) => q.type === 'hadith').map((q) => [q.text, q.source])];
  const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000) + offset;
  return list[((day % list.length) + list.length) % list.length];
}

const PATTERN = `<svg class="pattern" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M50 2 61 39 98 50 61 61 50 98 39 61 2 50 39 39Z"/><path d="M16 16 50 30 84 16 70 50 84 84 50 70 16 84 30 50Z"/><circle cx="50" cy="50" r="14"/></svg>`;

app.register({
  id: 'deen',
  render(s) {
    const now = new Date(); const ds = ymd(now);
    const t = computeTimes(now, s.settings);
    const np = nextPrayer(now, s.settings);
    const h = toHijri(now, s.settings.hijriAdjust);
    const special = islamicDay(h); const sunnah = isSunnahFast(now, h);
    const isRamadan = h.month === 9;
    const today = s.prayers[ds] || {};
    const streak = prayerStreak(s);
    const qadaTotal = Object.values(s.qada).reduce((a, b) => a + b, 0);
    const dz = s.dhikr; const dToday = dz.todayDate === ds ? dz.today : {};
    const dhikrSum = Object.values(dToday).reduce((a, b) => a + b, 0);
    const q = s.quran; const pagesToday = q.log[ds] || 0;
    const ad = s.adhkar[ds] || { morning: [], evening: [] };
    const tomorrowFajr = computeTimes(addDays(now, 1), s.settings).fajr;
    const isFriday = now.getDay() === 5;
    let khatmInfo = '';
    if (q.khatmTarget) {
      const left = QURAN_PAGES - q.page + 1; const days = Math.max(1, daysUntil(q.khatmTarget));
      khatmInfo = `${Math.ceil(left / days)} Seiten / Tag bis ${parseYmd(q.khatmTarget).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}`;
    }
    const [vText, vSrc] = quoteOfDay(s, 'verse');
    const [hText, hSrc] = quoteOfDay(s, 'hadith');
    return `${navbar('Deen', `<button class="nav-btn" data-qibla aria-label="Qibla">${icon('compass')}</button><button class="nav-btn" data-psettings aria-label="Gebetszeiten-Einstellungen">${icon('gear')}</button>`)}
      <div class="subtitle">${h.day}. ${h.monthName} ${h.year} · ${esc(s.settings.city || 'Standort')}</div>

      <div class="hero">${PATTERN}
        <div class="eyebrow" style="color:var(--gold)">Nächstes Gebet</div>
        <div class="hstack between" style="align-items:flex-end;margin-top:4px">
          <div><div class="prayer-next">${np.name}</div><div class="muted tabular" data-until="${np.time.getTime()}" data-prefix="in "></div></div>
          <div class="arabic" style="font-size:32px;color:var(--gold)">${np.ar}</div>
        </div>
        <div class="hstack between mt12"><span class="mid-num tabular">${hm(np.time)}</span>
          <span class="pill gold">${icon('flame', 'xs')} ${streak} Tage alle Gebete</span></div>
      </div>

      ${special ? `<div class="banner"><div class="icon-tile" style="background:var(--gold2)">${icon('star')}</div><div><div class="bold">${esc(special)}</div><div class="small muted">${h.day}. ${h.monthName}</div></div></div>` : ''}
      ${isFriday ? `<div class="banner"><div class="icon-tile" style="background:#2f7d4f">${icon('mosque')}</div><div><div class="bold">Jumuʿa Mubārak</div><div class="small muted">Sure al-Kahf lesen · Ṣalawāt · Ghusl · Freitagsgebet ${hm(t.dhuhr)}</div></div></div>` : ''}
      ${sunnah ? `<div class="banner"><div class="icon-tile" style="background:var(--indigo)">${icon('moon')}</div><div class="grow" style="flex:1"><div class="bold">${esc(sunnah)}</div><div class="small muted">Heute ist ein empfohlener Fastentag</div></div></div>` : ''}

      ${isRamadan ? `<div class="card glass"><div class="card-h"><span class="card-t" style="color:var(--gold)">${icon('moon', 'xs')} Ramadan ${h.day}/30</span><button class="pill gold" data-fasts>Tracker</button></div>
        <div class="grid2"><div><div class="small muted">Iftar</div><div class="mid-num">${hm(t.maghrib)}</div><div class="small muted tabular" ${now < t.maghrib ? `data-until="${t.maghrib.getTime()}"` : ''}>${now < t.maghrib ? '' : 'Guten Appetit'}</div></div>
        <div><div class="small muted">Suhoor bis</div><div class="mid-num">${hm(now < t.fajr ? t.fajr : tomorrowFajr)}</div><div class="small muted">Fajr</div></div></div></div>` : ''}

      <div class="section-h"><h2>Gebete heute</h2><span class="small muted">${PRAYERS.filter((p) => today[p.key]).length}/5</span></div>
      <div class="list">
        ${PRAYERS.map((p, i) => {
          const time = t[p.key]; const st = today[p.key];
          const isNext = !np.tomorrow && np.key === p.key; const past = time <= now;
          const row = `<div class="row prayer-row ${isNext ? 'next' : ''} ${past && !isNext ? 'past' : ''}">
            <div class="icon-tile" style="background:${['#3d5a99', '#c98a1d', '#b8742a', '#a3473a', '#35306b'][i]}">${icon(p.icon)}</div>
            <div class="grow"><div class="t">${p.name}</div><div class="s arabic" style="direction:ltr;text-align:left">${p.ar}</div></div>
            <span class="time">${hm(time)}</span>
            <button class="pstate ${st || ''}" data-pray="${p.key}" ${!past && !st ? 'disabled style="opacity:.35"' : ''}>${st ? `${icon('check', 'xs')} ${STATE_LABEL[st]}` : past ? 'Abhaken' : '–'}</button></div>`;
          const sunrise = p.key === 'fajr' ? `<div class="row prayer-row past"><div class="icon-tile" style="background:#5b4a2a">${icon('sunrise')}</div><div class="grow"><div class="t">Sonnenaufgang</div><div class="s">Ende der Fajr-Zeit</div></div><span class="time">${hm(t.sunrise)}</span><span style="min-width:82px"></span></div>` : '';
          return row + sunrise;
        }).join('')}
      </div>
      <div class="list-f">Tippe mehrmals: pünktlich → verspätet → nachgeholt. Mitternacht ${hm(t.midnight)} · Letztes Nachtdrittel ab ${hm(t.lastThird)} (Tahajjud)</div>

      <div class="grid2">
        <button class="card tap mb0" data-tasbih style="text-align:left">
          <div class="card-t">${icon('sparkles', 'xs')} Dhikr</div><div class="big-num mt8" style="color:var(--gold)">${dhikrSum}</div><div class="small muted">heute · Tasbih öffnen</div></button>
        <button class="card tap mb0" data-qada style="text-align:left">
          <div class="card-t">${icon('refresh', 'xs')} Qada</div><div class="big-num mt8" style="color:var(--purple)">${qadaTotal}</div><div class="small muted">offene Gebete</div></button>
      </div>

      <div class="section-h"><h2>Koran</h2><button class="link" data-quran>Bearbeiten</button></div>
      <button class="card tap" data-quran style="width:100%;text-align:left">
        <div class="hstack" style="gap:16px">
          ${ring((q.page - 1) / QURAN_PAGES, 72, 8, 'var(--gold)', `<span class="small bold">${Math.round(((q.page - 1) / QURAN_PAGES) * 100)}%</span>`)}
          <div style="flex:1"><div class="bold">Juz ${juzOfPage(q.page)} · Seite ${q.page}</div>
            <div class="small muted">${pagesToday ? `Heute ${pagesToday} Seiten gelesen` : 'Heute noch nicht gelesen'}${q.khatms ? ` · ${q.khatms}× Khatm` : ''}</div>
            ${khatmInfo ? `<div class="small mt8" style="color:var(--gold)">${khatmInfo}</div>` : '<div class="small mt8 faint">Khatm-Ziel setzen</div>'}</div>
        </div>
        <div class="juz-grid mt12">${JUZ_START.map((_, i) => { const j = i + 1, cj = juzOfPage(q.page); return `<i class="${j < cj ? 'on' : j === cj ? 'cur' : ''}">${j}</i>`; }).join('')}</div>
      </button>

      <div class="section-h"><h2>Adhkar</h2></div>
      <div class="grid2">
        <button class="card tap mb0" data-adhkar="morning" style="text-align:left"><div class="hstack between"><span style="font-size:26px">🌅</span>${ring(ad.morning.length / ADHKAR.morning.length, 34, 4, 'var(--orange)')}</div>
          <div class="bold mt8">Morgens</div><div class="small muted">${ad.morning.length}/${ADHKAR.morning.length} · nach Fajr</div></button>
        <button class="card tap mb0" data-adhkar="evening" style="text-align:left"><div class="hstack between"><span style="font-size:26px">🌙</span>${ring(ad.evening.length / ADHKAR.evening.length, 34, 4, 'var(--indigo)')}</div>
          <div class="bold mt8">Abends</div><div class="small muted">${ad.evening.length}/${ADHKAR.evening.length} · nach Asr</div></button>
      </div>

      <div class="section-h"><h2>Heute für dich</h2><button class="link" data-library>Sammlung</button></div>
      <div class="card glass"><div class="card-t" style="color:var(--gold)">${icon('book', 'xs')} Vers des Tages</div>
        <div class="quote serif">„${esc(vText)}“</div><div class="quote-src">${esc(vSrc)}</div></div>
      <div class="card glass"><div class="card-t" style="color:var(--teal)">${icon('heart', 'xs')} Hadith des Tages</div>
        <div class="quote serif">„${esc(hText)}“</div><div class="quote-src" style="color:var(--teal)">${esc(hSrc)}</div></div>

      <div class="list mt16">
        <button class="row tap" data-fasts style="width:100%;text-align:left"><div class="icon-tile" style="background:var(--indigo)">${icon('moon')}</div><div class="grow"><div class="t">Fasten-Tracker</div><div class="s">Ramadan, Sunnah und Qada-Fasten</div></div>${icon('right', 'chev')}</button>
        <button class="row tap" data-qibla style="width:100%;text-align:left"><div class="icon-tile" style="background:#2f7d4f">${icon('compass')}</div><div class="grow"><div class="t">Qibla-Kompass</div><div class="s">${Math.round(qiblaBearing(s.settings.lat, s.settings.lng))}° · ${distanceToMakkah(s.settings.lat, s.settings.lng).toLocaleString('de-DE')} km bis Mekka</div></div>${icon('right', 'chev')}</button>
        <button class="row tap" data-hijri style="width:100%;text-align:left"><div class="icon-tile" style="background:var(--gold2)">${icon('calendar')}</div><div class="grow"><div class="t">Islamische Tage</div><div class="s">Kommende Daten im Hijri-Kalender</div></div>${icon('right', 'chev')}</button>
      </div>`;
  },
  mount(root) {
    root.querySelectorAll('[data-pray]').forEach((b) => b.onclick = () => { markPrayer(b.dataset.pray); app.refresh(); app.el('deen').querySelector(`[data-pray="${b.dataset.pray}"]`)?.classList.add('pop'); });
    root.querySelector('[data-tasbih]').onclick = tasbihSheet;
    root.querySelector('[data-qada]').onclick = qadaSheet;
    root.querySelectorAll('[data-quran]').forEach((b) => b.onclick = quranSheet);
    root.querySelectorAll('[data-adhkar]').forEach((b) => b.onclick = () => adhkarSheet(b.dataset.adhkar));
    root.querySelector('[data-library]').onclick = librarySheet;
    root.querySelectorAll('[data-qibla]').forEach((b) => b.onclick = qiblaSheet);
    root.querySelectorAll('[data-fasts]').forEach((b) => b.onclick = fastSheet);
    root.querySelector('[data-hijri]').onclick = hijriSheet;
    root.querySelector('[data-psettings]').onclick = () => import('./settings.js').then((m) => m.prayerSettingsSheet());
  },
});

// ---------- Tasbih ----------
export function tasbihSheet() {
  const s = store.state; const dz = s.dhikr; const ds = ymd();
  if (dz.todayDate !== ds) { dz.today = {}; dz.todayDate = ds; }
  const presets = dz.presets || DHIKR_PRESETS;
  let idx = Math.min(dz.active || 0, presets.length - 1);
  const render = () => {
    const p = presets[idx]; const c = dz.today[p.id] || 0; const round = c % p.target; const rounds = Math.floor(c / p.target);
    const r = 112, C = 2 * Math.PI * r, off = C * (1 - (c && round === 0 ? 1 : round / p.target));
    return `<div class="sheet-nav"><button data-close>Fertig</button><span class="ttl">Tasbih</span><button data-reset>Reset</button></div>
      <div class="chips no-drag">${presets.map((x, i) => `<button class="chip ${i === idx ? 'on' : ''}" data-i="${i}">${esc(x.t)}</button>`).join('')}</div>
      <div class="center"><div class="arabic" style="font-size:30px;color:var(--gold)">${esc(p.ar)}</div><div class="muted small">${esc(p.de)}</div></div>
      <button class="tasbih" id="tsb" aria-label="Zählen">
        <svg viewBox="0 0 230 230"><circle cx="115" cy="115" r="${r}" fill="none" stroke="rgba(232,196,124,.12)" stroke-width="5"/>
        <circle cx="115" cy="115" r="${r}" fill="none" stroke="var(--gold)" stroke-width="5" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 115 115)" style="transition:stroke-dashoffset .3s var(--ease)"/></svg>
        <div><div class="count" id="tsbc">${c && round === 0 ? p.target : round}</div><div class="small muted">von ${p.target} · Runde ${rounds + (round || !c ? 1 : 0)}</div></div>
      </button>
      <div class="center small muted">Heute insgesamt: <b class="tabular" style="color:var(--label)">${c}</b> · Alle Zeiten: ${(dz.totals[p.id] || 0).toLocaleString('de-DE')}</div>
      <p class="center tiny faint mt12">Tippe irgendwo auf den Kreis. Bei jeder vollen Runde gibt es ein stärkeres Feedback.</p>`;
  };
  openSheet(render(), {
    tall: true,
    onMount(el, api) {
      const body = el.querySelector('.sheet-body');
      const bind = () => {
        body.querySelector('#tsb').addEventListener('pointerdown', (e) => {
          e.preventDefault();
          const p = presets[idx]; dz.today[p.id] = (dz.today[p.id] || 0) + 1; dz.totals[p.id] = (dz.totals[p.id] || 0) + 1;
          const full = dz.today[p.id] % p.target === 0;
          if (full) { haptic('success'); chime('done'); app.addXp(5); } else { haptic(); }
          store.save(); body.innerHTML = render(); bind();
          const t = body.querySelector('#tsb'); t.classList.add('tap'); setTimeout(() => t.classList.remove('tap'), 90);
        });
        body.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => { idx = Number(b.dataset.i); dz.active = idx; store.save(); haptic(); body.innerHTML = render(); bind(); });
        body.querySelector('[data-reset]').onclick = async () => { dz.today[presets[idx].id] = 0; store.save(); body.innerHTML = render(); bind(); };
        body.querySelector('[data-close]').onclick = () => api.close();
      };
      bind();
    },
    onClose() { app.refresh(); },
  });
}

// ---------- Qada ----------
function qadaSheet() {
  const s = store.state; const keys = [...PRAYERS.map((p) => [p.key, p.name]), ['witr', 'Witr']];
  const render = () => `<h3 class="sheet-title">Qada-Gebete</h3>
    <p class="center small muted">Zähle offene Nachhol-Gebete. Jedes nachgeholte Gebet mit „−“ abziehen.</p>
    <div class="list">${keys.map(([k, n]) => `<div class="row"><div class="grow"><div class="t">${n}</div></div>
      <div class="counter"><button data-q="${k}" data-d="-1">${icon('minus', 'sm')}</button><span class="mid-num tabular" style="min-width:52px;text-align:center">${s.qada[k] || 0}</span><button data-q="${k}" data-d="1">${icon('plus', 'sm')}</button></div></div>`).join('')}</div>
    <div class="list"><div class="row"><div class="grow"><div class="t">Qada-Fasten</div><div class="s">Offene Fastentage</div></div>
      <div class="counter"><button data-qf="-1">${icon('minus', 'sm')}</button><span class="mid-num tabular" style="min-width:52px;text-align:center">${s.qadaFasts}</span><button data-qf="1">${icon('plus', 'sm')}</button></div></div></div>
    <label class="lbl">Schnell hinzufügen</label>
    <div class="grid3"><button class="btn sm" data-days="1">+1 Tag</button><button class="btn sm" data-days="7">+1 Woche</button><button class="btn sm" data-days="30">+1 Monat</button></div>
    <p class="tiny faint center mt12">„+1 Tag“ fügt je ein Fajr, Dhuhr, Asr, Maghrib, Isha und Witr hinzu.</p>`;
  openSheet(render(), {
    tall: true,
    onMount(el) {
      const body = el.querySelector('.sheet-body');
      const bind = () => {
        body.querySelectorAll('[data-q]').forEach((b) => b.onclick = () => { const k = b.dataset.q, d = Number(b.dataset.d); s.qada[k] = Math.max(0, (s.qada[k] || 0) + d); if (d < 0) app.addXp(10); haptic(d < 0 ? 'success' : 'light'); store.save(); body.innerHTML = render(); bind(); });
        body.querySelectorAll('[data-qf]').forEach((b) => b.onclick = () => { s.qadaFasts = Math.max(0, s.qadaFasts + Number(b.dataset.qf)); haptic(); store.save(); body.innerHTML = render(); bind(); });
        body.querySelectorAll('[data-days]').forEach((b) => b.onclick = () => { const n = Number(b.dataset.days); keys.forEach(([k]) => s.qada[k] = (s.qada[k] || 0) + n); haptic(); store.save(); body.innerHTML = render(); bind(); });
      };
      bind();
    },
    onClose() { app.refresh(); },
  });
}

// ---------- Quran ----------
function quranSheet() {
  const s = store.state; const q = s.quran; const ds = ymd();
  openSheet(`<div class="sheet-nav"><button data-close>Abbrechen</button><span class="ttl">Koran-Fortschritt</span><button class="b" data-save>Sichern</button></div>
    <div class="center mt8">${ring((q.page - 1) / QURAN_PAGES, 120, 10, 'var(--gold)', `<div><div class="mid-num" id="qpPct">${Math.round(((q.page - 1) / QURAN_PAGES) * 100)}%</div><div class="tiny muted">gelesen</div></div>`).replace('class="ring"', 'class="ring" style="margin:0 auto;width:120px;height:120px"')}</div>
    <label class="lbl">Ich bin auf Seite (1–604)</label>
    <div class="hstack"><button class="btn sm" data-p="-1">${icon('minus', 'sm')}</button><input class="field center" type="number" inputmode="numeric" id="qPage" value="${q.page}" min="1" max="604"><button class="btn sm" data-p="1">${icon('plus', 'sm')}</button></div>
    <div class="center small muted mt8" id="qJuz">Juz ${juzOfPage(q.page)}</div>
    <label class="lbl">Heute gelesen</label>
    <div class="grid3"><button class="btn sm" data-r="1">+1 Seite</button><button class="btn sm" data-r="5">+5</button><button class="btn sm" data-r="20">+1 Juz</button></div>
    <label class="lbl">Khatm-Ziel (Datum)</label>
    <input class="field" type="date" id="qTarget" value="${q.khatmTarget || ''}">
    <div class="small center mt8" id="qPlan" style="color:var(--gold)"></div>
    <div class="list mt16"><div class="row"><div class="grow"><div class="t">Abgeschlossene Khatms</div></div><span class="mid-num">${q.khatms}</span></div></div>`, {
    tall: true,
    onMount(el, api) {
      const inp = el.querySelector('#qPage'); let read = 0;
      const upd = () => {
        const p = Math.min(604, Math.max(1, parseInt(inp.value, 10) || 1));
        el.querySelector('#qJuz').textContent = `Juz ${juzOfPage(p)}${read ? ` · +${read} Seiten heute` : ''}`;
        el.querySelector('#qpPct').textContent = `${Math.round(((p - 1) / 604) * 100)}%`;
        const tg = el.querySelector('#qTarget').value;
        el.querySelector('#qPlan').textContent = tg ? `${Math.ceil((604 - p + 1) / Math.max(1, daysUntil(tg)))} Seiten pro Tag bis zum Ziel (${Math.max(1, daysUntil(tg))} Tage)` : '';
      };
      el.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => { inp.value = Math.min(604, Math.max(1, (parseInt(inp.value, 10) || 1) + Number(b.dataset.p))); haptic(); upd(); });
      el.querySelectorAll('[data-r]').forEach((b) => b.onclick = () => { const n = Number(b.dataset.r); read += n; inp.value = Math.min(605, (parseInt(inp.value, 10) || 1) + n); haptic(); upd(); });
      inp.oninput = upd; el.querySelector('#qTarget').oninput = upd; upd();
      el.querySelector('[data-save]').onclick = () => {
        let p = parseInt(inp.value, 10) || 1;
        const before = q.page;
        if (p > 604) { q.khatms++; p = 1; confetti(); toast(`${icon('sparkles')} Khatm abgeschlossen! Mā shāʾ Allāh`, 'ok'); }
        q.page = Math.max(1, p); q.juz = juzOfPage(q.page);
        const diff = read || Math.max(0, q.page - before);
        if (diff > 0) { q.log[ds] = (q.log[ds] || 0) + diff; app.addXp(diff * 2); }
        q.khatmTarget = el.querySelector('#qTarget').value || null;
        store.save(); haptic('success'); api.close(); app.refresh();
      };
    },
  });
}

// ---------- Adhkar ----------
function adhkarSheet(kind) {
  const s = store.state; const ds = ymd();
  s.adhkar[ds] = s.adhkar[ds] || { morning: [], evening: [] };
  const list = ADHKAR[kind];
  const render = () => {
    const done = s.adhkar[ds][kind];
    return `<h3 class="sheet-title">${kind === 'morning' ? '🌅 Morgen-Adhkar' : '🌙 Abend-Adhkar'}</h3>
      <div class="bar mb0" style="margin-bottom:14px"><i style="width:${(done.length / list.length) * 100}%;background:var(--gold)"></i></div>
      <div class="list">${list.map((a) => `<button class="row tap" data-a="${a.id}" style="width:100%;text-align:left">
        <span class="chk ${done.includes(a.id) ? 'on' : ''}" style="--c:var(--gold)">${icon('check')}</span>
        <div class="grow"><div class="t" style="white-space:normal">${esc(a.t)}</div><div class="s">${esc(a.d)}</div></div><span class="pill gold">${a.n}×</span></button>`).join('')}</div>`;
  };
  openSheet(render(), {
    tall: true,
    onMount(el) {
      const body = el.querySelector('.sheet-body');
      const bind = () => body.querySelectorAll('[data-a]').forEach((b) => b.onclick = () => {
        const arr = s.adhkar[ds][kind]; const i = arr.indexOf(b.dataset.a);
        if (i >= 0) arr.splice(i, 1); else { arr.push(b.dataset.a); app.addXp(2); }
        haptic(i >= 0 ? 'light' : 'success'); store.save();
        if (arr.length === list.length && i < 0) { confetti(); }
        body.innerHTML = render(); bind();
        if (i < 0) body.querySelector(`[data-a="${b.dataset.a}"] .chk`)?.classList.add('pop');
      });
      bind();
    },
    onClose() { app.refresh(); },
  });
}

// ---------- Library ----------
function librarySheet() {
  const s = store.state; let tab = 'verse';
  const render = () => {
    const base = (tab === 'verse' ? VERSES : HADITHS).map(([t, src], i) => ({ id: `${tab}-${i}`, text: t, source: src }));
    const custom = s.customQuotes.filter((q) => q.type === tab);
    const all = [...custom, ...base];
    return `<div class="sheet-nav"><button data-close>Fertig</button><span class="ttl">Sammlung</span><button data-add>${icon('plus', 'sm')}</button></div>
      ${segmented('lib', [['verse', 'Koran-Verse'], ['hadith', 'Hadithe'], ['fav', 'Favoriten']], tab)}
      <div class="mt12">${(tab === 'fav' ? [...s.customQuotes, ...VERSES.map(([t, src], i) => ({ id: `verse-${i}`, text: t, source: src })), ...HADITHS.map(([t, src], i) => ({ id: `hadith-${i}`, text: t, source: src }))].filter((q) => s.favQuotes.includes(q.id)) : all)
        .map((q) => `<div class="card" style="background:var(--card2)"><div class="serif" style="font-size:17px;line-height:1.45">„${esc(q.text)}“</div>
          <div class="hstack between mt8"><span class="quote-src">${esc(q.source)}</span><div class="hstack">
          ${q.type ? `<button class="nav-btn" data-del="${q.id}" aria-label="Löschen" style="color:var(--red)">${icon('trash', 'sm')}</button>` : ''}
          <button class="nav-btn" data-fav="${q.id}" aria-label="Favorit" style="color:${s.favQuotes.includes(q.id) ? 'var(--pink)' : 'var(--label3)'}">${icon('heart', 'sm')}</button></div></div></div>`).join('') || '<div class="empty">Noch keine Favoriten. Tippe auf das Herz.</div>'}</div>`;
  };
  openSheet(render(), {
    tall: true,
    onMount(el) {
      const body = el.querySelector('.sheet-body');
      const bind = () => {
        bindSegmented(body, 'lib', (v) => { tab = v; body.innerHTML = render(); bind(); });
        body.querySelectorAll('[data-fav]').forEach((b) => b.onclick = () => { const id = b.dataset.fav; const i = s.favQuotes.indexOf(id); if (i >= 0) s.favQuotes.splice(i, 1); else s.favQuotes.push(id); haptic(); store.save(); body.innerHTML = render(); bind(); });
        body.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => { s.customQuotes = s.customQuotes.filter((q) => q.id !== b.dataset.del); store.save(); body.innerHTML = render(); bind(); });
        body.querySelector('[data-add]').onclick = () => addQuoteSheet(() => { body.innerHTML = render(); bind(); });
      };
      bind();
    },
    onClose() { app.refresh(); },
  });
}
function addQuoteSheet(done) {
  let type = 'verse';
  openSheet(`<h3 class="sheet-title">Eigenes Zitat</h3>
    ${segmented('qt', [['verse', 'Koran-Vers'], ['hadith', 'Hadith']], type)}
    <label class="lbl">Text</label><textarea class="field" id="qText" placeholder="Text eingeben"></textarea>
    <label class="lbl">Quelle</label><input class="field" id="qSrc" placeholder="Koran 2:255 oder Bukhari 1">
    <button class="btn primary block mt16" data-save>Hinzufügen</button>`, {
    onMount(el, api) {
      bindSegmented(el, 'qt', (v) => type = v);
      el.querySelector('[data-save]').onclick = () => {
        const text = el.querySelector('#qText').value.trim(), source = el.querySelector('#qSrc').value.trim();
        if (!text) return toast(`${icon('info')} Text fehlt`);
        if (!guardText(text, source)) return;
        store.state.customQuotes.unshift({ id: uid(), type, text, source }); store.save(); api.close(); done?.();
      };
    },
  });
}

// ---------- Qibla ----------
function qiblaSheet() {
  const s = store.state.settings; const bearing = qiblaBearing(s.lat, s.lng);
  let handler = null;
  openSheet(`<h3 class="sheet-title">Qibla</h3>
    <p class="center muted small">Halte das iPhone flach. Richte es aus, bis der Ring grün leuchtet.</p>
    <div class="compass" id="cmp"><div class="fixed-mark"></div><div class="dial" id="dial">
      <svg viewBox="0 0 250 250" style="position:absolute;inset:0">${Array.from({ length: 72 }, (_, i) => { const a = i * 5, long = i % 18 === 0; const r1 = 118, r2 = long ? 102 : 110; const x1 = 125 + r1 * Math.sin(a * Math.PI / 180), y1 = 125 - r1 * Math.cos(a * Math.PI / 180), x2 = 125 + r2 * Math.sin(a * Math.PI / 180), y2 = 125 - r2 * Math.cos(a * Math.PI / 180); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${long ? '#fff' : 'rgba(255,255,255,.3)'}" stroke-width="${long ? 2 : 1}"/>`; }).join('')}
      ${['N', 'O', 'S', 'W'].map((l, i) => `<text x="${125 + 88 * Math.sin(i * Math.PI / 2)}" y="${131 - 88 * Math.cos(i * Math.PI / 2)}" fill="${l === 'N' ? '#ff453a' : '#fff'}" font-size="16" font-weight="600" text-anchor="middle">${l}</text>`).join('')}</svg>
      <div class="needle" style="transform:rotate(${bearing}deg)"><div style="width:4px;height:100%;background:linear-gradient(var(--gold),transparent);border-radius:2px"></div></div>
      <div style="position:absolute;inset:0;transform:rotate(${bearing}deg)"><div class="kaaba">🕋</div></div>
    </div></div>
    <div class="center"><div class="mid-num" id="qDeg">${Math.round(bearing)}°</div><div class="small muted">Richtung Mekka von ${esc(s.city || 'deinem Standort')}</div></div>
    <button class="btn primary block mt16" id="cmpStart">${icon('compass')} Kompass starten</button>`, {
    onMount(el) {
      const dial = el.querySelector('#dial'), cmp = el.querySelector('#cmp');
      const start = async () => {
        try {
          if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
            const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') return toast(`${icon('info')} Kompass-Zugriff verweigert`);
          }
        } catch {}
        handler = (e) => {
          let heading = e.webkitCompassHeading ?? (e.absolute && e.alpha != null ? 360 - e.alpha : null);
          if (heading == null) return;
          dial.style.transform = `rotate(${-heading}deg)`;
          const diff = Math.abs(((bearing - heading + 540) % 360) - 180);
          const aligned = diff < 5;
          if (aligned && !cmp.classList.contains('aligned')) haptic('success');
          cmp.classList.toggle('aligned', aligned);
        };
        window.addEventListener('deviceorientationabsolute', handler);
        window.addEventListener('deviceorientation', handler);
        el.querySelector('#cmpStart').style.display = 'none';
      };
      el.querySelector('#cmpStart').onclick = start;
    },
    onClose() { if (handler) { window.removeEventListener('deviceorientation', handler); window.removeEventListener('deviceorientationabsolute', handler); } },
  });
}

// ---------- Fasting ----------
function fastSheet() {
  const s = store.state; const now = new Date();
  const h = toHijri(now, s.settings.hijriAdjust);
  const render = () => {
    const days = Array.from({ length: 35 }, (_, i) => addDays(now, i - 34));
    const fasted = Object.values(s.fasts).filter((v) => v === 'fasted').length;
    return `<h3 class="sheet-title">Fasten-Tracker</h3>
      <div class="grid2"><div class="card mb0 center" style="background:var(--card2)"><div class="big-num" style="color:var(--green)">${fasted}</div><div class="small muted">Tage gefastet</div></div>
      <div class="card mb0 center" style="background:var(--card2)"><div class="big-num" style="color:var(--purple)">${s.qadaFasts}</div><div class="small muted">Qada offen</div></div></div>
      <label class="lbl">Letzte 5 Wochen · tippen zum Markieren</label>
      <div class="month-grid">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => `<div class="h">${d}</div>`).join('')}
        ${Array.from({ length: (days[0].getDay() + 6) % 7 }, () => '<span></span>').join('')}
        ${days.map((d) => { const ds = ymd(d); const v = s.fasts[ds]; const hh = toHijri(d, s.settings.hijriAdjust);
          return `<button data-f="${ds}" style="border-radius:12px;${v === 'fasted' ? 'background:rgba(48,209,88,.25);color:#4ee07a' : v === 'missed' ? 'background:rgba(191,90,242,.2);color:#d08af7' : ''}"><span>${d.getDate()}</span><span class="tiny faint" style="font-size:9px">${hh.month === 9 ? 'R' + hh.day : ''}</span></button>`; }).join('')}</div>
      <p class="tiny faint center mt12">Grün = gefastet · Lila = verpasst (zählt automatisch als Qada) · „R“ = Ramadan-Tag</p>
      ${h.month === 9 ? '' : `<div class="banner mt12" style="background:var(--card2)"><div class="icon-tile" style="background:var(--indigo)">${icon('info')}</div><div class="small muted">Sunnah: Montag, Donnerstag und die weißen Tage (13.–15. jedes Hijri-Monats).</div></div>`}`;
  };
  openSheet(render(), {
    tall: true,
    onMount(el) {
      const body = el.querySelector('.sheet-body');
      const bind = () => body.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => {
        const ds = b.dataset.f; const cur = s.fasts[ds];
        const next = cur === undefined ? 'fasted' : cur === 'fasted' ? 'missed' : undefined;
        if (cur === 'missed') s.qadaFasts = Math.max(0, s.qadaFasts - 1);
        if (next === 'missed') s.qadaFasts++;
        if (next === 'fasted') app.addXp(20);
        if (next) s.fasts[ds] = next; else delete s.fasts[ds];
        haptic(); store.save(); body.innerHTML = render(); bind();
      });
      bind();
    },
    onClose() { app.refresh(); },
  });
}

function hijriSheet() {
  const s = store.state; const now = new Date(); const items = [];
  for (let i = 0; i < 400 && items.length < 14; i++) {
    const d = addDays(now, i); const h = toHijri(d, s.settings.hijriAdjust); const name = islamicDay(h);
    if (name && !/Ungerade|Taschrīq/.test(name) || (name && /Taschrīq/.test(name) && h.day === 11)) items.push({ d, h, name: /Taschrīq/.test(name) ? 'Tage des Taschrīq (11.–13.)' : name, i });
  }
  openSheet(`<h3 class="sheet-title">Islamische Tage</h3>
    <p class="center small muted">Offline berechnet (Umm al-Qura). Lokale Mondsichtung kann ±1 Tag abweichen – in den Einstellungen anpassbar.</p>
    <div class="list">${items.map((x) => `<div class="row"><div class="grow"><div class="t">${esc(x.name)}</div><div class="s">${x.h.day}. ${x.h.monthName} ${x.h.year}</div></div>
      <div style="text-align:right"><div class="small">${x.d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}</div><div class="tiny muted">${x.i === 0 ? 'heute' : `in ${x.i} Tagen`}</div></div></div>`).join('')}</div>`, { tall: true });
}
