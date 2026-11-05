import { store, defaultState } from '../store.js';
import { app } from '../core.js';
import { esc, ymd, parseYmd, download, sha256, isBlockedText, todayHabitProgress, isScheduled, habitDone, hm, levelFromXp } from '../util.js';
import { icon, haptic, openSheet, confirmSheet, toast, segmented, bindSegmented, closeAllSheets } from '../ui.js';
import { METHODS, CITIES, computeTimes, nextPrayer, PRAYERS, toHijri } from '../prayer.js';
import { quoteOfDay, prayedToday } from './deen.js';
import { upcoming } from './calendar.js';
import { blockGuide } from './focus.js';
import { weeklyReview, cleanDays } from './today.js';
import { setupLock } from '../lock.js';

export const APP_VERSION = '1.0.0';

const row = (attrs, color, ic, title, sub = '', right = '') => `<button class="row tap" ${attrs} style="width:100%;text-align:left"><div class="icon-tile" style="background:${color}">${icon(ic)}</div>
  <div class="grow"><div class="t">${title}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>${right}${icon('right', 'chev')}</button>`;

export function settingsSheet() {
  const s = store.state; const st = s.settings;
  const render = () => `<div class="sheet-nav"><span></span><span class="ttl">Einstellungen</span><button class="b" data-close>Fertig</button></div>
    <div class="list"><div class="row"><div class="icon-tile" style="background:var(--fill)">${icon('user')}</div><div class="grow"><div class="t">Name</div></div><input type="text" id="sName" value="${esc(s.profile.name)}" placeholder="Dein Name" maxlength="24"></div></div>
    <div class="list-h">Deen</div>
    <div class="list">${row('data-s="prayer"', 'var(--gold2)', 'moon', 'Gebetszeiten', `${esc(st.city)} · ${METHODS[st.method]?.name}`)}</div>
    <div class="list-h">Mitteilungen und Feedback</div>
    <div class="list">
      ${row('data-s="notify"', 'var(--red)', 'bell', 'Erinnerungen', st.notifyPrayers ? `Gebete, ${st.notifyBefore} min vorher` : 'Aus')}
      <div class="row"><div class="icon-tile" style="background:var(--purple)">${icon('phone')}</div><div class="grow"><div class="t">Haptisches Feedback</div></div><label class="tgl"><input type="checkbox" data-t="haptics" ${st.haptics ? 'checked' : ''}><span></span></label></div>
      <div class="row"><div class="icon-tile" style="background:var(--pink)">${icon('music')}</div><div class="grow"><div class="t">Sounds</div></div><label class="tgl"><input type="checkbox" data-t="sounds" ${st.sounds ? 'checked' : ''}><span></span></label></div>
      <div class="row"><div class="icon-tile" style="background:var(--red)">${icon('info')}</div><div class="grow"><div class="t">Zahl am App-Symbol</div><div class="s">Offene Habits</div></div><label class="tgl"><input type="checkbox" data-t="badge" ${st.badge ? 'checked' : ''}><span></span></label></div>
    </div>
    <div class="list-h">Schutz</div>
    <div class="list">
      ${row('data-s="lock"', 'var(--green)', 'face', 'App-Sperre', st.lock.type === 'none' ? 'Aus' : st.lock.type === 'faceid' ? 'Face ID + PIN' : 'PIN')}
      ${row('data-s="filter"', 'var(--teal)', 'shield', 'Inhaltsschutz', 'Filter aktiv · Link-Prüfer')}
      ${row('data-s="block"', 'var(--red)', 'phone', 'Apps und Websites sperren', 'Anleitung für Bildschirmzeit')}
    </div>
    <div class="list-h">Widgets</div>
    <div class="list">${row('data-s="widgets"', 'var(--indigo)', 'grid', 'Widgets einrichten', 'Home- und Sperrbildschirm')}</div>
    <div class="list-h">Daten</div>
    <div class="list">
      ${row('data-s="review"', 'var(--purple)', 'chart', 'Wochenrückblick')}
      ${row('data-s="export"', 'var(--blue)', 'upload', 'Backup erstellen', 'Alle Daten als Datei, z. B. in iCloud Drive')}
      <label class="row tap" style="width:100%"><div class="icon-tile" style="background:var(--green)">${icon('download')}</div><div class="grow"><div class="t">Backup wiederherstellen</div></div>${icon('right', 'chev')}<input type="file" accept="application/json,.json" id="sImport" hidden></label>
      ${row('data-s="reset"', 'var(--red)', 'trash', '<span style="color:var(--red)">Alle Daten löschen</span>')}
    </div>
    <p class="list-f center mt16">Nur ${APP_VERSION} · 100 % offline · Deine Daten bleiben auf diesem iPhone<br>${navigator.onLine ? 'Online – Updates werden automatisch geladen' : 'Offline-Modus'}</p>`;
  openSheet(render(), {
    tall: true,
    onMount(el, api) {
      const body = el.querySelector('.sheet-body');
      const bind = () => {
        body.querySelector('#sName').onchange = (e) => { s.profile.name = e.target.value.trim(); store.save(); app.refresh(); };
        body.querySelectorAll('[data-t]').forEach((t) => t.onchange = () => { st[t.dataset.t] = t.checked; store.save(); haptic(); if (t.dataset.t === 'badge') updateBadge(); });
        body.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => {
          const k = b.dataset.s;
          if (k === 'prayer') prayerSettingsSheet();
          if (k === 'notify') notifySheet(() => { body.innerHTML = render(); bind(); });
          if (k === 'lock') setupLock(() => { body.innerHTML = render(); bind(); });
          if (k === 'filter') filterSheet();
          if (k === 'block') blockGuide();
          if (k === 'widgets') widgetsSheet();
          if (k === 'review') weeklyReview();
          if (k === 'export') { download(`nur-backup-${ymd()}.json`, JSON.stringify(s, null, 1)); }
          if (k === 'reset') confirmSheet('Alle Daten löschen?', 'Habits, Gebete, Kalender und Statistiken werden unwiderruflich gelöscht. Erstelle vorher ein Backup.', 'Alles löschen').then((ok) => { if (ok) { store.reset(); closeAllSheets(); location.reload(); } });
        });
        body.querySelector('#sImport').onchange = async (e) => {
          const f = e.target.files[0]; if (!f) return;
          try {
            const data = JSON.parse(await f.text());
            if (!data || typeof data !== 'object' || !('habits' in data)) throw new Error('bad');
            if (await confirmSheet('Backup wiederherstellen?', 'Die aktuellen Daten werden durch das Backup ersetzt.', 'Wiederherstellen', false)) { store.replace(data); await store.flush(); location.reload(); }
          } catch { toast(`${icon('alert')} Datei ist kein gültiges Backup`, 'warn'); }
        };
      };
      bind();
    },
  });
}

export function prayerSettingsSheet() {
  const s = store.state; const st = s.settings;
  const render = () => {
    const t = computeTimes(new Date(), st);
    return `<div class="sheet-nav"><span></span><span class="ttl">Gebetszeiten</span><button class="b" data-close>Fertig</button></div>
    <button class="btn primary block" data-gps>${icon('pin')} Aktuellen Standort verwenden</button>
    <p class="list-f center mt8">Standort: <b style="color:var(--label)">${esc(st.city)}</b> (${st.lat.toFixed(3)}, ${st.lng.toFixed(3)}). GPS wird nur einmal lokal gelesen.</p>
    <div class="list-h">Oder Stadt wählen</div>
    <div class="chips no-drag" style="flex-wrap:wrap">${CITIES.map(([n]) => `<button class="chip ${n === st.city ? 'on' : ''}" data-city="${esc(n)}">${n}</button>`).join('')}</div>
    <div class="list"><div class="row"><div class="grow"><div class="t">Breite</div></div><input type="number" step="0.001" id="pLat" value="${st.lat}"></div>
      <div class="row"><div class="grow"><div class="t">Länge</div></div><input type="number" step="0.001" id="pLng" value="${st.lng}"></div></div>
    <div class="list-h">Berechnungsmethode</div>
    <div class="list">${Object.entries(METHODS).map(([k, m]) => `<button class="row tap" data-m="${k}" style="width:100%;text-align:left"><div class="grow"><div class="t">${m.name}</div><div class="s">Fajr ${m.fajr}° · Isha ${m.ishaMin ? m.ishaMin + ' min' : m.isha + '°'}</div></div>${st.method === k ? `<span style="color:var(--blue)">${icon('check')}</span>` : ''}</button>`).join('')}</div>
    <div class="list-h">Asr</div>${segmented('asr', [['standard', 'Shāfiʿī, Mālikī, Ḥanbalī'], ['hanafi', 'Ḥanafī']], st.asr)}
    <div class="list-h">Hohe Breitengrade (Sommer)</div>${segmented('hl', [['AngleBased', 'Winkel'], ['OneSeventh', '1/7 Nacht'], ['NightMiddle', 'Mitte']], st.highLat)}
    <div class="list-h">Minuten anpassen (an deine Moschee)</div>
    <div class="list">${[...PRAYERS.slice(0, 1), { key: 'sunrise', name: 'Sonnenaufgang' }, ...PRAYERS.slice(1)].map((p) => `<div class="row"><div class="grow"><div class="t">${p.name}</div><div class="s tabular">${hm(t[p.key])}</div></div>
      <div class="counter"><button data-adj="${p.key}" data-d="-1">${icon('minus', 'sm')}</button><span class="tabular" style="min-width:36px;text-align:center">${st.adjust[p.key] > 0 ? '+' : ''}${st.adjust[p.key]}</span><button data-adj="${p.key}" data-d="1">${icon('plus', 'sm')}</button></div></div>`).join('')}</div>
    <div class="list-h">Hijri-Datum</div>
    <div class="list"><div class="row"><div class="grow"><div class="t">Korrektur</div><div class="s">${(() => { const h = toHijri(new Date(), st.hijriAdjust); return `${h.day}. ${h.monthName} ${h.year}`; })()}</div></div>
      <div class="counter"><button data-hj="-1">${icon('minus', 'sm')}</button><span class="tabular" style="min-width:36px;text-align:center">${st.hijriAdjust > 0 ? '+' : ''}${st.hijriAdjust}</span><button data-hj="1">${icon('plus', 'sm')}</button></div></div></div>
    <p class="list-f">Alle Zeiten werden mathematisch auf dem Gerät berechnet. Keine Internetverbindung nötig.</p>`;
  };
  openSheet(render(), {
    tall: true,
    onMount(el) {
      const body = el.querySelector('.sheet-body');
      const re = () => { store.save(); body.innerHTML = render(); bind(); app.refresh(); };
      const bind = () => {
        body.querySelector('[data-gps]').onclick = () => {
          if (!navigator.geolocation) return toast(`${icon('alert')} GPS nicht verfügbar`);
          toast(`${icon('pin')} Standort wird ermittelt …`);
          navigator.geolocation.getCurrentPosition((p) => {
            st.lat = +p.coords.latitude.toFixed(4); st.lng = +p.coords.longitude.toFixed(4); st.city = 'Mein Standort'; haptic('success'); toast(`${icon('check')} Standort gesetzt`, 'ok'); re();
          }, () => toast(`${icon('alert')} Kein Zugriff. Wähle eine Stadt.`, 'warn'), { enableHighAccuracy: false, timeout: 15000, maximumAge: 3600000 });
        };
        body.querySelectorAll('[data-city]').forEach((b) => b.onclick = () => { const c = CITIES.find((x) => x[0] === b.dataset.city); st.city = c[0]; st.lat = c[1]; st.lng = c[2]; if (c[0] === 'Istanbul' || c[0] === 'Ankara') st.method = 'Diyanet'; haptic(); re(); });
        body.querySelector('#pLat').onchange = (e) => { const v = parseFloat(e.target.value); if (v >= -90 && v <= 90) { st.lat = v; st.city = 'Eigene Koordinaten'; re(); } };
        body.querySelector('#pLng').onchange = (e) => { const v = parseFloat(e.target.value); if (v >= -180 && v <= 180) { st.lng = v; st.city = 'Eigene Koordinaten'; re(); } };
        body.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => { st.method = b.dataset.m; haptic(); re(); });
        bindSegmented(body, 'asr', (v) => { st.asr = v; re(); });
        bindSegmented(body, 'hl', (v) => { st.highLat = v; re(); });
        body.querySelectorAll('[data-adj]').forEach((b) => b.onclick = () => { st.adjust[b.dataset.adj] += Number(b.dataset.d); haptic(); re(); });
        body.querySelectorAll('[data-hj]').forEach((b) => b.onclick = () => { st.hijriAdjust = Math.max(-2, Math.min(2, st.hijriAdjust + Number(b.dataset.hj))); haptic(); re(); });
      };
      bind();
    },
  });
}

function notifySheet(done) {
  const st = store.state.settings;
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  openSheet(`<h3 class="sheet-title">Erinnerungen</h3>
    ${perm === 'unsupported' ? `<div class="banner" style="background:var(--card2)"><div class="icon-tile" style="background:var(--orange)">${icon('info')}</div><div class="small">Mitteilungen gehen erst, wenn die App über „Zum Home-Bildschirm“ installiert ist (iOS 16.4+).</div></div>` : ''}
    <div class="list"><div class="row"><div class="grow"><div class="t">Gebets-Erinnerung</div></div><label class="tgl"><input type="checkbox" id="nP" ${st.notifyPrayers ? 'checked' : ''}><span></span></label></div>
      <div class="row"><div class="grow"><div class="t">Minuten vorher</div></div><select id="nB">${[0, 5, 10, 15, 20, 30].map((v) => `<option value="${v}" ${st.notifyBefore === v ? 'selected' : ''}>${v ? v + ' min' : 'Pünktlich'}</option>`).join('')}</select></div></div>
    <div class="card" style="background:var(--card2)"><div class="bold small">${icon('info', 'xs')} Wichtig zu wissen</div><div class="small muted mt8" style="line-height:1.5">Web-Apps auf dem iPhone können ohne Server keine Mitteilungen planen, während die App geschlossen ist. Diese App erinnert dich, solange sie offen oder im Hintergrund ist.<br><br><b style="color:var(--label)">Für zuverlässige Gebets-Mitteilungen bei geschlossener App:</b> Richte unter „Widgets“ das kostenlose Scriptable-Skript ein – es plant alle Gebets-Mitteilungen lokal auf dem iPhone.</div></div>
    <button class="btn primary block mt12" data-test>Test-Mitteilung senden</button>`, {
    onMount(el, api) {
      el.querySelector('#nP').onchange = async (e) => {
        if (e.target.checked && 'Notification' in window && Notification.permission !== 'granted') {
          const r = await Notification.requestPermission();
          if (r !== 'granted') { e.target.checked = false; return toast(`${icon('alert')} Mitteilungen nicht erlaubt`, 'warn'); }
        }
        st.notifyPrayers = e.target.checked; store.save(); schedulePrayerNotifications(); done?.();
      };
      el.querySelector('#nB').onchange = (e) => { st.notifyBefore = Number(e.target.value); store.save(); schedulePrayerNotifications(); done?.(); };
      el.querySelector('[data-test]').onclick = async () => {
        if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
        import('../core.js').then((m) => m.notify('Nur', 'Mitteilungen funktionieren ✓', 'test'));
      };
    },
  });
}

let notifTimers = [];
export function schedulePrayerNotifications() {
  notifTimers.forEach(clearTimeout); notifTimers = [];
  const st = store.state.settings; if (!st.notifyPrayers) return;
  const now = Date.now(); const t = computeTimes(new Date(), st);
  PRAYERS.forEach((p) => {
    const at = t[p.key].getTime() - st.notifyBefore * 60000;
    if (at > now && at - now < 86400000) notifTimers.push(setTimeout(() => import('../core.js').then((m) => m.notify(`${p.name} ${st.notifyBefore ? `in ${st.notifyBefore} min` : 'jetzt'}`, `${hm(t[p.key])} · ${st.city}`, `prayer-${p.key}`)), at - now));
  });
}

export function updateBadge() {
  try {
    const s = store.state;
    if (!('setAppBadge' in navigator)) return;
    if (!s.settings.badge) return navigator.clearAppBadge();
    const p = todayHabitProgress(s); const open = p.total - p.done;
    if (open > 0) navigator.setAppBadge(open); else navigator.clearAppBadge();
  } catch {}
}

function filterSheet() {
  openSheet(`<div class="shield-hero">${icon('shield')}<h3 class="sheet-title">Inhaltsschutz</h3>
    <p class="muted small">Ein lokaler Filter prüft jeden Text, den du in der App speicherst, und jeden Link, den du über die App öffnest. Eindeutige Erwachsenen-Inhalte werden blockiert. Normale Wörter bleiben unberührt.</p></div>
    <div class="list-h">Sicherer Link-Öffner</div>
    <div class="hstack"><input class="field" id="lnk" type="url" placeholder="https://…" autocomplete="off" inputmode="url"><button class="btn primary" data-open style="width:54px;padding:0">${icon('link')}</button></div>
    <p class="list-f mt8">Links aus Nachrichten hier einfügen. Erwachsenen-Seiten werden nicht geöffnet.</p>
    <div class="list-h">Systemweit schützen</div>
    <button class="btn block" data-guide>${icon('phone')} Bildschirmzeit-Anleitung öffnen</button>
    <p class="list-f mt8">Den vollständigen Schutz für Safari und alle Apps bietet nur iOS selbst (Bildschirmzeit → Beschränkungen → Websites für Erwachsene beschränken).</p>`, {
    onMount(el) {
      el.querySelector('[data-open]').onclick = () => {
        let u = el.querySelector('#lnk').value.trim(); if (!u) return;
        if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
        if (isBlockedText(u)) { haptic('heavy'); return toast(`${icon('shield')} Blockiert. Diese Seite tut dir nicht gut.`, 'warn'); }
        try { new URL(u); } catch { return toast(`${icon('alert')} Ungültiger Link`); }
        window.open(u, '_blank', 'noopener');
      };
      el.querySelector('[data-guide]').onclick = blockGuide;
    },
  });
}

// ---------- Widgets ----------
export function widgetData() {
  const s = store.state; const now = new Date(); const ds = ymd(now);
  const habits = s.habits.filter((h) => !h.archived && isScheduled(h, now));
  const np = nextPrayer(now, s.settings); const t = computeTimes(now, s.settings);
  const [vt, vs] = quoteOfDay(s, 'verse');
  return {
    app: 'nur', version: 1, updated: Date.now(), date: ds,
    settings: { lat: s.settings.lat, lng: s.settings.lng, city: s.settings.city, method: s.settings.method, asr: s.settings.asr, highLat: s.settings.highLat, adjust: s.settings.adjust, hijriAdjust: s.settings.hijriAdjust, notifyBefore: s.settings.notifyBefore },
    prayers: Object.fromEntries(PRAYERS.map((p) => [p.key, hm(t[p.key])])), prayedToday: prayedToday(s),
    habits: { done: habits.filter((h) => habitDone(s, h, ds)).length, total: habits.length, list: habits.slice(0, 6).map((h) => ({ e: h.emoji, n: h.name, d: habitDone(s, h, ds) })) },
    events: upcoming(s, 4).map((e) => ({ t: e.title, d: e._date, h: e.time })),
    verse: { text: vt, src: vs }, clean: cleanDays(s), level: levelFromXp(s.xp).level, xp: s.xp,
  };
}

export function widgetsSheet() {
  const s = store.state; const now = new Date();
  const np = nextPrayer(now, s.settings); const p = todayHabitProgress(s);
  const [vt, vs] = quoteOfDay(s, 'verse'); const up = upcoming(s, 2); const h = toHijri(now, s.settings.hijriAdjust);
  openSheet(`<div class="sheet-nav"><span></span><span class="ttl">Widgets</span><button class="b" data-close>Fertig</button></div>
    <p class="muted small center" style="margin-top:0">So sehen deine Widgets aus. Live-Daten von heute.</p>
    <div class="widgets">
      <div class="wg prayer"><div class="wl">Nächstes Gebet</div><div><div style="font-size:26px;font-weight:700">${np.name}</div><div style="font-size:30px;font-weight:300" class="tabular">${hm(np.time)}</div></div><div class="tiny" style="opacity:.7">${h.day}. ${h.monthName}</div></div>
      <div class="wg habit"><div class="wl">Habits</div><div style="font-size:40px;font-weight:700" class="tabular">${p.done}<span style="font-size:20px;opacity:.6">/${p.total}</span></div><div class="bar" style="background:rgba(255,255,255,.15)"><i style="width:${p.pct * 100}%;background:var(--green)"></i></div></div>
      <div class="wg verse wide"><div class="wl" style="color:var(--gold)">Vers des Tages</div><div class="serif" style="font-size:15px;line-height:1.35">„${esc(vt.length > 110 ? vt.slice(0, 107) + '…' : vt)}“</div><div class="tiny" style="color:var(--gold)">${esc(vs)}</div></div>
      <div class="wg next wide"><div class="wl">Als Nächstes</div>${up.map((e) => `<div class="hstack between"><span class="bold small">${esc(e.title)}</span><span class="tiny" style="opacity:.7">${e.time || ''} ${e._date !== ymd() ? parseYmd(e._date).toLocaleDateString('de-DE', { weekday: 'short' }) : 'heute'}</span></div>`).join('') || '<div class="small" style="opacity:.7">Nichts geplant</div>'}<span></span></div>
    </div>
    <div class="list-h">Sperrbildschirm</div>
    <div class="card" style="background:linear-gradient(160deg,#16233d,#0a0f1a)"><div class="center" style="font-size:52px;font-weight:600;letter-spacing:-1px" class="tabular">${hm(now)}</div>
      <div class="lock-wg mt8"><div><div class="tiny" style="opacity:.7">${np.name}</div><div class="bold">${hm(np.time)}</div></div><div><div class="tiny" style="opacity:.7">Habits</div><div class="bold">${p.done}/${p.total}</div></div><div><div class="tiny" style="opacity:.7">Clean</div><div class="bold">${cleanDays(s)} T</div></div></div></div>

    <div class="list-h">Einrichten (einmalig, ca. 3 Minuten)</div>
    <div class="card" style="background:var(--card2)"><ol class="small" style="margin:0;padding-left:18px;line-height:1.65">
      <li>Kostenlose App <b>Scriptable</b> aus dem App Store laden (kein Abo, kein Konto)</li>
      <li>Unten auf <b>„Skript kopieren“</b> tippen</li>
      <li>In Scriptable: <b>+</b> → einfügen → oben Namen geben, z. B. „Nur Gebet“</li>
      <li>Home-Bildschirm lange drücken → <b>+</b> → Scriptable → Größe wählen → Widget antippen → Skript auswählen</li>
      <li>Sperrbildschirm: lange drücken → Anpassen → Widgets → Scriptable</li>
    </ol></div>
    <div class="list">
      <button class="row tap" data-copy="widgets/nur-gebet.js" style="width:100%;text-align:left"><div class="icon-tile" style="background:#1d2b4a">${icon('moon')}</div><div class="grow"><div class="t">Gebets-Widget + Mitteilungen</div><div class="s">Countdown, alle Zeiten, plant Gebets-Mitteilungen</div></div><span class="pill blue">Kopieren</span></button>
      <button class="row tap" data-copy="widgets/nur-vers.js" style="width:100%;text-align:left"><div class="icon-tile" style="background:#3a2d14">${icon('book')}</div><div class="grow"><div class="t">Vers- und Hadith-Widget</div><div class="s">Wechselt täglich, komplett offline</div></div><span class="pill blue">Kopieren</span></button>
      <button class="row tap" data-copy="widgets/nur-habits.js" style="width:100%;text-align:left"><div class="icon-tile" style="background:#10331e">${icon('checks')}</div><div class="grow"><div class="t">Habits- und Termine-Widget</div><div class="s">Braucht den Sync unten</div></div><span class="pill blue">Kopieren</span></button>
    </div>
    <div class="list-h">Daten-Sync für Habits und Termine</div>
    <button class="btn primary block" data-sync>${icon('refresh')} Widget-Daten aktualisieren</button>
    <p class="list-f mt8">Tippe hier, dann „In Dateien sichern“ → iCloud Drive → Ordner <b>Scriptable</b> → Datei ersetzen. Web-Apps dürfen nicht selbst im Hintergrund schreiben, deshalb dieser eine Tipp. Gebetszeit- und Vers-Widget brauchen keinen Sync.</p>
    <p class="tiny faint center mt12">Hinweis: Ein Tipp aufs Widget öffnet Safari statt der installierten App – das ist eine iOS-Grenze für Web-Apps.</p>`, {
    tall: true,
    onMount(el) {
      el.querySelectorAll('[data-copy]').forEach((b) => b.onclick = async () => {
        try {
          const txt = await (await fetch(b.dataset.copy, { cache: 'no-cache' })).text();
          await navigator.clipboard.writeText(txt); haptic('success'); toast(`${icon('check')} Skript kopiert – jetzt in Scriptable einfügen`, 'ok');
        } catch { download(b.dataset.copy.split('/').pop(), await (await fetch(b.dataset.copy)).text(), 'text/javascript'); }
      });
      el.querySelector('[data-sync]').onclick = () => download('nur-widget.json', JSON.stringify(widgetData()));
    },
  });
}
