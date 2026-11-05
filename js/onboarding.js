import { store } from './store.js';
import { esc, uid } from './util.js';
import { icon, haptic, toast, confetti } from './ui.js';
import { CITIES, METHODS } from './prayer.js';
import { COLORS } from './content.js';

const STARTERS = [
  ['📖', 'Koran lesen', 'Deen', 'duration', 10, '', 'fajr', true], ['📿', 'Morgen-Adhkar', 'Deen', 'bool', 1, '', 'fajr', true],
  ['💧', 'Wasser trinken', 'Gesundheit', 'count', 8, 'Gläser', '', true], ['📚', 'Lernen', 'Schule', 'duration', 45, '', '', true],
  ['🏃', 'Sport', 'Fitness', 'duration', 30, '', '', false], ['📵', 'Kein Handy nach Isha', 'Mindset', 'bool', 1, '', 'isha', false],
  ['😴', 'Vor 23 Uhr schlafen', 'Gesundheit', 'bool', 1, '', '', false], ['✍️', 'Tagebuch', 'Mindset', 'bool', 1, '', '', false],
];

export function runOnboarding() {
  return new Promise((resolve) => {
    const s = store.state; let step = 0;
    const picks = new Set(STARTERS.filter((x) => x[7]).map((x) => x[1]));
    const el = document.createElement('div'); el.className = 'overlay';
    document.body.appendChild(el);
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const steps = [
      () => `<div class="ob-step"><div class="ob-logo">${icon('sparkles', 'lg')}</div><h1 class="ob-title">Nur</h1><p class="ob-text">Gewohnheiten, Gebet und Fokus.<br>Alles an einem Ort, komplett offline.</p>
        ${[['var(--green)', 'checks', 'Habits mit Streaks', 'Anti-Frust-Joker, Heatmap, Level und XP'], ['var(--gold2)', 'moon', 'Deen', 'Gebetszeiten offline, Qibla, Tasbih, Koran-Ziel'], ['var(--blue)', 'calendar', 'Kalender und Schule', 'Stundenplan, Prüfungs-Countdown, Schnell-Eingabe'], ['var(--red)', 'timer', 'Deep-Work-Fokus', 'Vollbild-Timer, Sounds, Pause zur Gebetszeit']]
          .map(([c, ic, t, d]) => `<div class="ob-feat"><div class="icon-tile" style="background:${c}">${icon(ic)}</div><div><div class="bold">${t}</div><div class="small muted">${d}</div></div></div>`).join('')}
        <div style="flex:1"></div><button class="btn primary block" data-next>Los geht's</button></div>`,
      () => `<div class="ob-step"><div class="ob-logo">${icon('user', 'lg')}</div><h1 class="ob-title">Wie heißt du?</h1><p class="ob-text">Nur für die Begrüßung. Bleibt auf deinem iPhone.</p>
        <input class="field center" id="obName" placeholder="Dein Vorname" value="${esc(s.profile.name)}" maxlength="24" style="font-size:22px" autocomplete="given-name">
        <div style="flex:1"></div><button class="btn primary block" data-next>Weiter</button><button class="btn ghost block" data-skip>Überspringen</button></div>`,
      () => `<div class="ob-step"><div class="ob-logo">${icon('pin', 'lg')}</div><h1 class="ob-title">Dein Standort</h1><p class="ob-text">Für genaue Gebetszeiten und die Qibla. Wird nur lokal verwendet.</p>
        <button class="btn primary block" data-gps>${icon('pin')} Standort verwenden</button>
        <div class="center small muted mt12" id="obLoc">Aktuell: <b style="color:var(--label)">${esc(s.settings.city)}</b></div>
        <label class="lbl">Oder Stadt wählen</label>
        <div class="chips" style="flex-wrap:wrap">${CITIES.slice(0, 20).map(([n]) => `<button class="chip ${n === s.settings.city ? 'on' : ''}" data-city="${esc(n)}">${n}</button>`).join('')}</div>
        <label class="lbl">Methode</label>
        <div class="chips" style="flex-wrap:wrap">${['MWL', 'Diyanet', 'ISNA', 'Makkah'].map((k) => `<button class="chip ${k === s.settings.method ? 'on' : ''}" data-m="${k}">${METHODS[k].name}</button>`).join('')}</div>
        <div style="flex:1;min-height:20px"></div><button class="btn primary block" data-next>Weiter</button></div>`,
      () => `<div class="ob-step"><div class="ob-logo">${icon('checks', 'lg')}</div><h1 class="ob-title">Deine Start-Habits</h1><p class="ob-text">Wähle ein paar aus. Weniger ist mehr – du kannst jederzeit eigene anlegen.</p>
        <div class="list">${STARTERS.map((x) => `<button class="row tap" data-h="${esc(x[1])}" style="width:100%;text-align:left;background:var(--card)"><span style="font-size:24px">${x[0]}</span><div class="grow"><div class="t">${x[1]}</div><div class="s">${x[2]}</div></div>
          <span class="chk ${picks.has(x[1]) ? 'on' : ''}">${icon('check')}</span></button>`).join('')}</div>
        <div style="flex:1"></div><button class="btn primary block" data-next>Weiter</button></div>`,
      () => `<div class="ob-step"><div class="ob-logo">${icon('phone', 'lg')}</div><h1 class="ob-title">${standalone ? 'Alles bereit' : 'Zum Home-Bildschirm'}</h1>
        ${standalone ? '<p class="ob-text">Die App ist installiert und läuft offline. Updates kommen automatisch.</p>' : `<p class="ob-text">Damit Nur wie eine echte App läuft – im Vollbild und offline:</p>
        <div class="card"><div class="ob-feat" style="margin-bottom:12px"><div class="icon-tile" style="background:var(--blue)">${icon('share')}</div><div class="small">In Safari unten auf <b>Teilen</b> tippen</div></div>
        <div class="ob-feat" style="margin-bottom:12px"><div class="icon-tile" style="background:var(--fill)">${icon('plus')}</div><div class="small"><b>„Zum Home-Bildschirm“</b> wählen</div></div>
        <div class="ob-feat mb0"><div class="icon-tile" style="background:var(--green)">${icon('check')}</div><div class="small">Oben rechts <b>Hinzufügen</b> – fertig</div></div></div>
        <p class="small muted center">Wichtig: Daten in Safari und in der installierten App sind getrennt. Am besten direkt installieren und dort starten.</p>`}
        <div style="flex:1"></div><button class="btn primary block" data-finish>Starten</button></div>`,
    ];
    const paint = () => {
      el.innerHTML = steps[step]() + `<div class="ob-dots">${steps.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>`;
      el.querySelector('[data-next]')?.addEventListener('click', next);
      el.querySelector('[data-skip]')?.addEventListener('click', () => { step++; paint(); });
      el.querySelector('[data-finish]')?.addEventListener('click', finish);
      el.querySelector('[data-gps]')?.addEventListener('click', () => {
        navigator.geolocation?.getCurrentPosition((p) => {
          s.settings.lat = +p.coords.latitude.toFixed(4); s.settings.lng = +p.coords.longitude.toFixed(4); s.settings.city = 'Mein Standort';
          haptic('success'); paint();
        }, () => toast(`${icon('alert')} Kein Zugriff – wähle eine Stadt`, 'warn'), { timeout: 15000 });
      });
      el.querySelectorAll('[data-city]').forEach((b) => b.onclick = () => { const c = CITIES.find((x) => x[0] === b.dataset.city); Object.assign(s.settings, { city: c[0], lat: c[1], lng: c[2] }); if (/Istanbul|Ankara/.test(c[0])) s.settings.method = 'Diyanet'; haptic(); paint(); });
      el.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => { s.settings.method = b.dataset.m; haptic(); paint(); });
      el.querySelectorAll('[data-h]').forEach((b) => b.onclick = () => { const n = b.dataset.h; picks.has(n) ? picks.delete(n) : picks.add(n); haptic(); b.querySelector('.chk').classList.toggle('on'); b.querySelector('.chk').classList.add('pop'); });
    };
    const next = () => {
      if (step === 1) s.profile.name = (el.querySelector('#obName')?.value || '').trim().slice(0, 24);
      haptic(); step = Math.min(steps.length - 1, step + 1); paint();
    };
    const finish = () => {
      STARTERS.filter((x) => picks.has(x[1])).forEach((x, i) => s.habits.push({ id: uid(), emoji: x[0], name: x[1], category: x[2], type: x[3], target: x[4], unit: x[5], afterPrayer: x[6], days: [], color: COLORS[i % COLORS.length], createdAt: Date.now(), archived: false }));
      s.onboarded = true; store.save(); haptic('success');
      el.style.transition = 'opacity .5s, transform .6s var(--ease)'; el.style.opacity = '0'; el.style.transform = 'scale(1.05)';
      setTimeout(() => { el.remove(); confetti(); resolve(); }, 500);
    };
    paint();
  });
}
