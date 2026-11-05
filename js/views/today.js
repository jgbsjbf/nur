import { store } from '../store.js';
import { app, navbar } from '../core.js';
import { esc, ymd, addDays, hm, greeting, fmtDateLong, todayHabitProgress, isScheduled, levelFromXp, LEVEL_NAMES, daysUntil, parseYmd, habitDone, fmtMinutes } from '../util.js';
import { icon, haptic, openSheet, toast, confetti, chime, guardText } from '../ui.js';
import { nextPrayer, computeTimes, toHijri, islamicDay, isSunnahFast, PRAYERS } from '../prayer.js';
import { habitRow, bindHabitList } from './habits.js';
import { upcoming, eventRow, bindEvents } from './calendar.js';
import { quoteOfDay, prayedToday } from './deen.js';

const MOODS = ['😞', '😕', '😐', '🙂', '😄'];

function activityRings(h, p, f) {
  const rings = [[h, '#30D158', 54], [p, '#E8C47C', 40], [f, '#0A84FF', 26]];
  return `<svg width="124" height="124" viewBox="0 0 124 124" style="flex:none">${rings.map(([v, c, r]) => {
    const C = 2 * Math.PI * r, off = C * (1 - Math.min(1, v));
    return `<circle cx="62" cy="62" r="${r}" fill="none" stroke="${c}" stroke-opacity=".2" stroke-width="12"/>
      <circle class="ring-val" cx="62" cy="62" r="${r}" fill="none" stroke="${c}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}" style="--c:${C};--off:${off}" transform="rotate(-90 62 62)"/>`;
  }).join('')}</svg>`;
}

export function cleanDays(s) { return s.clean.since ? Math.floor((Date.now() - s.clean.since) / 86400000) : 0; }

app.register({
  id: 'today',
  render(s) {
    const now = new Date(); const ds = ymd(now);
    const np = nextPrayer(now, s.settings);
    const h = toHijri(now, s.settings.hijriAdjust);
    const special = islamicDay(h); const sunnah = isSunnahFast(now, h);
    const hp = todayHabitProgress(s);
    const pr = prayedToday(s);
    const focusMin = s.focus.sessions.filter((x) => ymd(new Date(x.start)) === ds).reduce((a, b) => a + b.minutes, 0);
    const habits = s.habits.filter((x) => !x.archived && isScheduled(x, now));
    const open = habits.filter((x) => !habitDone(s, x, ds));
    const shown = [...open, ...habits.filter((x) => habitDone(s, x, ds))].slice(0, 5);
    const up = upcoming(s, 3);
    const [vt, vs] = quoteOfDay(s, 'verse');
    const j = s.journal[ds] || {};
    const lv = levelFromXp(s.xp);
    const exam = upcoming({ ...s, events: s.events.filter((e) => e.type === 'pruefung') }, 1)[0];
    const isSunday = now.getDay() === 0;
    const t = computeTimes(now, s.settings);
    const cd = cleanDays(s);
    return `${navbar('Heute', `<button class="nav-btn" data-sos aria-label="Hilfe bei Versuchung" style="color:var(--teal)">${icon('shield')}</button><button class="nav-btn" data-settings aria-label="Einstellungen">${icon('gear')}</button>`, { smallOnly: true })}
      <div class="eyebrow">${fmtDateLong(now)} · ${h.day}. ${h.monthName}</div>
      <h1 class="large-title">${greeting(now)}${s.profile.name ? `, ${esc(s.profile.name)}` : ''}</h1>
      <div style="height:10px"></div>

      <button class="hero tap card" data-go="deen" style="width:100%;text-align:left;display:block">
        <div class="hstack between"><span class="eyebrow" style="color:var(--gold)">${icon('moon', 'xs')} Nächstes Gebet</span><span class="pill gold">${pr}/5 heute</span></div>
        <div class="hstack between mt8" style="align-items:flex-end"><div><div class="prayer-next">${np.name} <span style="font-weight:400;color:var(--label2);font-size:28px">${hm(np.time)}</span></div>
        <div class="muted tabular mt8" data-until="${np.time.getTime()}" data-prefix="noch "></div></div><div class="arabic" style="font-size:30px;color:var(--gold)">${np.ar}</div></div>
        <div class="hstack mt12" style="gap:4px">${PRAYERS.map((p) => { const done = s.prayers[ds]?.[p.key]; const past = t[p.key] <= now;
          return `<div style="flex:1;text-align:center"><div style="height:4px;border-radius:2px;background:${done ? 'var(--gold)' : past ? 'rgba(255,69,58,.5)' : 'var(--fill3)'}"></div><div class="tiny muted mt8">${p.name}</div></div>`; }).join('')}</div>
      </button>

      <div class="card hstack" style="gap:18px">
        ${activityRings(hp.pct, pr / 5, Math.min(1, focusMin / 120))}
        <div class="stack gap8" style="flex:1">
          <div><div class="small" style="color:#30D158;font-weight:600">Habits</div><div class="bold tabular">${hp.done}/${hp.total}</div></div>
          <div><div class="small" style="color:#E8C47C;font-weight:600">Gebete</div><div class="bold tabular">${pr}/5</div></div>
          <div><div class="small" style="color:#0A84FF;font-weight:600">Fokus</div><div class="bold tabular">${fmtMinutes(focusMin)} <span class="faint small">/ 2 h</span></div></div>
        </div>
      </div>

      ${special ? `<div class="banner"><div class="icon-tile" style="background:var(--gold2)">${icon('star')}</div><div><div class="bold">${esc(special)}</div><div class="small muted">Heute im islamischen Kalender</div></div></div>` : ''}
      ${now.getDay() === 5 ? `<div class="banner"><div class="icon-tile" style="background:#2f7d4f">${icon('mosque')}</div><div><div class="bold">Jumuʿa Mubārak</div><div class="small muted">Sure al-Kahf · viele Ṣalawāt · Freitagsgebet ${hm(t.dhuhr)}</div></div></div>` : ''}
      ${sunnah ? `<div class="banner"><div class="icon-tile" style="background:var(--indigo)">${icon('moon')}</div><div><div class="bold">${esc(sunnah)}</div><div class="small muted">Möchtest du heute fasten?</div></div></div>` : ''}
      ${h.month === 9 ? `<div class="banner"><div class="icon-tile" style="background:var(--gold2)">${icon('moon')}</div><div style="flex:1"><div class="bold">Ramadan · Tag ${h.day}</div><div class="small muted">Iftar ${hm(t.maghrib)} · ${now < t.maghrib ? `<span data-until="${t.maghrib.getTime()}"></span>` : 'Guten Appetit'}</div></div></div>` : ''}
      ${exam && daysUntil(exam._date) <= 14 ? `<div class="banner" data-ev="${exam.id}"><div class="icon-tile" style="background:var(--red)">${icon('alert')}</div><div style="flex:1"><div class="bold">${esc(exam.title)}</div><div class="small muted">Prüfung ${parseYmd(exam._date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'short' })}</div></div><div class="center"><div class="mid-num" style="color:var(--red)">${daysUntil(exam._date)}</div><div class="tiny muted">Tage</div></div></div>` : ''}
      ${isSunday ? `<button class="banner tap" data-review style="width:100%;text-align:left"><div class="icon-tile" style="background:var(--purple)">${icon('chart')}</div><div style="flex:1"><div class="bold">Dein Wochenrückblick</div><div class="small muted">Sieh dir deine Woche an</div></div>${icon('right', 'chev')}</button>` : ''}

      <div class="section-h"><h2>Habits</h2><button class="link" data-go="habits">Alle</button></div>
      ${shown.length ? `<div class="stagger">${shown.map((x) => habitRow(s, x, ds)).join('')}</div>` : `<button class="card tap center" data-go="habits" style="width:100%"><div style="font-size:30px">🌱</div><div class="small muted">Lege dein erstes Habit an</div></button>`}

      <div class="section-h"><h2>Als Nächstes</h2><button class="link" data-go="calendar">Kalender</button></div>
      ${up.length ? up.map((e) => eventRow(s, e, e._date, e._date !== ds)).join('') : `<div class="card small muted center">Nichts geplant. Genieß den freien Kopf.</div>`}

      <div class="section-h"><h2>Vers des Tages</h2></div>
      <div class="card glass" data-go="deen"><div class="quote serif">„${esc(vt)}“</div><div class="quote-src">${esc(vs)}</div></div>

      <div class="section-h"><h2>Wie geht's dir?</h2></div>
      <div class="card">
        <div class="mood-row" id="mood">${MOODS.map((m, i) => `<button class="${j.mood === i + 1 ? 'on' : ''}" data-m="${i + 1}" aria-label="Stimmung ${i + 1}">${m}</button>`).join('')}</div>
        <textarea class="field mt12" id="note" placeholder="Ein Satz über heute – wofür bist du dankbar?" style="min-height:64px">${esc(j.note || '')}</textarea>
      </div>

      <div class="grid2">
        <button class="card tap mb0" data-go="habits" style="text-align:left"><div class="card-t">${icon('star', 'xs')} Level ${lv.level}</div><div class="bold mt8">${LEVEL_NAMES[Math.min(lv.level - 1, LEVEL_NAMES.length - 1)]}</div>
          <div class="xp-bar mt8"><i style="width:${lv.progress * 100}%"></i></div><div class="tiny muted mt8">${s.xp} XP</div></button>
        <button class="card tap mb0" data-sos style="text-align:left"><div class="card-t" style="color:var(--teal)">${icon('shield', 'xs')} Reinheit</div><div class="big-num mt8" style="color:var(--teal)">${cd}</div>
          <div class="tiny muted">${s.clean.since ? `Tage clean · ${s.clean.resisted}× widerstanden` : 'Serie starten'}</div></button>
      </div>
      <button class="card tap mt12 hstack" data-widgets style="width:100%;text-align:left"><div class="icon-tile" style="background:var(--indigo);width:40px;height:40px;border-radius:11px">${icon('grid')}</div>
        <div style="flex:1"><div class="bold">Widgets für Home- und Sperrbildschirm</div><div class="small muted">Gebetszeit, Vers und Habits ohne App öffnen</div></div>${icon('right', 'chev')}</button>`;
  },
  mount(root, s) {
    root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', (e) => { if (e.target.closest('[data-check],[data-dec],[data-open],[data-evdone],[data-ev]')) return; haptic(); app.go(b.dataset.go); }));
    root.querySelectorAll('[data-sos]').forEach((b) => b.onclick = sosSheet);
    root.querySelector('[data-settings]').onclick = () => import('./settings.js').then((m) => m.settingsSheet());
    root.querySelector('[data-widgets]').onclick = () => import('./settings.js').then((m) => m.widgetsSheet());
    root.querySelector('[data-review]')?.addEventListener('click', () => weeklyReview());
    const ds = ymd();
    root.querySelector('#mood').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; s.journal[ds] = { ...(s.journal[ds] || {}), mood: Number(b.dataset.m) }; store.save(); haptic(); root.querySelectorAll('#mood button').forEach((x) => x.classList.toggle('on', x === b)); };
    root.querySelector('#note').onchange = (e) => {
      if (!guardText(e.target.value)) { e.target.value = s.journal[ds]?.note || ''; return; }
      s.journal[ds] = { ...(s.journal[ds] || {}), note: e.target.value.trim() }; store.save(); toast(`${icon('check')} Notiz gespeichert`, 'ok');
    };
    bindHabitList(root); bindEvents(root);
  },
});

// ---------- SOS / urge help ----------
export function sosSheet() {
  const s = store.state; const c = s.clean;
  let secs = 60, timer = null;
  const verse = Math.random() < 0.5 ? ['Sag den gläubigen Männern, sie sollen ihre Blicke senken und ihre Keuschheit bewahren. Das ist reiner für sie.', 'Koran 24:30'] : ['Und nähert euch nicht der Unzucht. Sie ist etwas Schändliches und ein übler Weg.', 'Koran 17:32'];
  openSheet(`<div class="shield-hero">${icon('shield')}<h3 class="sheet-title" style="margin-bottom:4px">Du schaffst das</h3>
      <p class="muted small" style="margin:0">Der Drang geht vorbei – meist in unter 2 Minuten. Bleib 60 Sekunden hier.</p></div>
    <div class="breath-ball" id="sb" style="background:radial-gradient(circle at 40% 35%,#8fd8ff,#1f6fa8);box-shadow:0 0 60px rgba(100,210,255,.35)"></div>
    <div class="center"><div class="mid-num tabular" id="sbT">60</div><div class="small muted" id="sbTx">Einatmen …</div></div>
    <div class="card glass mt16"><div class="quote serif" style="font-size:17px">„${verse[0]}“</div><div class="quote-src">${verse[1]}</div></div>
    <div class="card" style="background:var(--card2)"><div class="bold small">Jetzt sofort:</div><div class="small muted" style="line-height:1.6">• Handy weglegen, aufstehen, Raum wechseln<br>• Wudu machen – kaltes Wasser ins Gesicht<br>• „Aʿūdhu billāhi mina sh-shayṭāni r-rajīm“<br>• 10 Liegestütze oder kurz rausgehen<br>• Jemandem schreiben, dem du vertraust</div></div>
    <div class="grid2 mt12"><div class="card mb0 center" style="background:var(--card2)"><div class="big-num" style="color:var(--teal)">${cleanDays(s)}</div><div class="tiny muted">Tage clean</div></div>
      <div class="card mb0 center" style="background:var(--card2)"><div class="big-num">${c.best}</div><div class="tiny muted">Beste Serie</div></div></div>
    <div class="stack gap8 mt16">
      <button class="btn primary block" data-won>${icon('check')} Ich habe widerstanden</button>
      ${c.since ? '<button class="btn ghost block" data-reset style="color:var(--label2)">Rückfall – Serie neu starten</button>' : '<button class="btn block" data-start>Serie heute starten</button>'}
    </div>
    <p class="tiny faint center mt12">Nur auf deinem Gerät gespeichert. Niemand sonst sieht das.</p>`, {
    tall: true,
    onMount(el, api) {
      const ball = el.querySelector('#sb'); let ph = 0;
      timer = setInterval(() => {
        secs--; el.querySelector('#sbT').textContent = Math.max(0, secs);
        if (secs % 4 === 0) { ph = 1 - ph; ball.classList.toggle('in', ph === 1); el.querySelector('#sbTx').textContent = ph ? 'Ausatmen …' : 'Einatmen …'; }
        if (secs <= 0) { clearInterval(timer); el.querySelector('#sbTx').textContent = 'Geschafft. Du bist stärker als der Moment.'; haptic('success'); chime('done'); }
      }, 1000);
      requestAnimationFrame(() => ball.classList.add('in'));
      el.querySelector('[data-won]').onclick = () => { c.resisted++; if (!c.since) c.since = Date.now(); app.addXp(30); store.save(); confetti(); haptic('success'); toast(`${icon('shield')} Stark! +30 XP`, 'ok'); api.close(); app.refresh(); };
      el.querySelector('[data-start]')?.addEventListener('click', () => { c.since = Date.now(); store.save(); haptic('success'); api.close(); app.refresh(); });
      el.querySelector('[data-reset]')?.addEventListener('click', () => {
        c.best = Math.max(c.best, cleanDays(s)); c.log.push({ end: Date.now(), days: cleanDays(s) }); c.since = Date.now(); store.save(); api.close(); app.refresh();
        toast(`${icon('heart')} Neuer Anfang. Allah liebt die, die umkehren.`);
      });
    },
    onClose() { clearInterval(timer); },
  });
}

// ---------- Weekly review ----------
export function weeklyReview() {
  const s = store.state; const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i - 6)); const dss = days.map((d) => ymd(d));
  let hDone = 0, hTotal = 0;
  days.forEach((d) => { const p = todayHabitProgress(s, d); hDone += p.done; hTotal += p.total; });
  const prayers = dss.reduce((a, ds) => a + Object.keys(s.prayers[ds] || {}).length, 0);
  const focus = s.focus.sessions.filter((x) => dss.includes(ymd(new Date(x.start)))).reduce((a, b) => a + b.minutes, 0);
  const pages = dss.reduce((a, ds) => a + (s.quran.log[ds] || 0), 0);
  const xp = dss.reduce((a, ds) => a + (s.xpLog[ds] || 0), 0);
  const moods = dss.map((ds) => s.journal[ds]?.mood).filter(Boolean);
  const best = s.habits.filter((h) => !h.archived).map((h) => ({ h, n: dss.filter((ds) => habitDone(s, h, ds)).length })).sort((a, b) => b.n - a.n)[0];
  const done = s.events.filter((e) => e.done && dss.includes(e.date)).length;
  const pct = hTotal ? Math.round((hDone / hTotal) * 100) : 0;
  const msg = pct >= 80 ? 'Herausragende Woche. Bleib dran!' : pct >= 50 ? 'Solide Woche – jeder Tag zählt.' : 'Neue Woche, neue Chance. Fang klein an.';
  openSheet(`<div class="center"><div style="font-size:44px">📊</div><h3 class="sheet-title" style="margin:4px 0">Deine Woche</h3><p class="muted small">${days[0].toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</p></div>
    <div class="grid2">
      ${[['Habits', `${pct}%`, `${hDone}/${hTotal}`, '#30D158'], ['Gebete', `${prayers}/35`, `${Math.round(prayers / 35 * 100)}%`, '#E8C47C'], ['Fokus', fmtMinutes(focus), `${s.focus.sessions.filter((x) => dss.includes(ymd(new Date(x.start)))).length} Sessions`, '#0A84FF'], ['Koran', `${pages} S.`, 'gelesen', '#E8C47C'],
        ['XP', `+${xp}`, 'gesammelt', '#BF5AF2'], ['Stimmung', moods.length ? ['😞', '😕', '😐', '🙂', '😄'][Math.round(moods.reduce((a, b) => a + b, 0) / moods.length) - 1] : '–', `${moods.length} Einträge`, '#64D2FF']]
        .map(([l, v, sub, c]) => `<div class="card mb0" style="background:var(--card2)"><div class="small bold" style="color:${c}">${l}</div><div class="mid-num mt8">${v}</div><div class="tiny muted">${sub}</div></div>`).join('')}
    </div>
    ${best && best.n ? `<div class="card mt12" style="background:var(--card2)"><div class="small muted">Stärkstes Habit</div><div class="bold mt8">${esc(best.h.emoji)} ${esc(best.h.name)} · ${best.n}/7 Tage</div></div>` : ''}
    <div class="card" style="background:var(--card2)"><div class="small muted">Erledigte Aufgaben</div><div class="bold mt8">${done}</div></div>
    <p class="center bold mt16">${msg}</p>`, { tall: true, onMount() { s.lastReview = ymd(); store.save(); } });
}
