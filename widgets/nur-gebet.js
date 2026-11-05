// Nur – Gebets-Widget für Scriptable (kostenlos im App Store)
// Zeigt das nächste Gebet mit Countdown und plant lokale Gebets-Mitteilungen.
// Funktioniert komplett offline. Größen: klein, mittel, Sperrbildschirm.
// Widget-Parameter (optional): "Berlin" oder "52.52,13.40" oder "nonotify"

const CITIES = { Berlin: [52.52, 13.405], Hamburg: [53.551, 9.993], München: [48.137, 11.575], Köln: [50.937, 6.96], Frankfurt: [50.11, 8.682], Stuttgart: [48.775, 9.182], Düsseldorf: [51.227, 6.773], Dortmund: [51.514, 7.468], Essen: [51.455, 7.011], Hannover: [52.375, 9.732], Nürnberg: [49.452, 11.077], Bremen: [53.079, 8.801], Leipzig: [51.339, 12.373], Wien: [48.208, 16.373], Zürich: [47.376, 8.541], Istanbul: [41.008, 28.978] };
const METHODS = { MWL: { fajr: 18, isha: 17 }, Diyanet: { fajr: 18, isha: 17, offsets: { sunrise: -7, dhuhr: 5, asr: 4, maghrib: 7 } }, ISNA: { fajr: 15, isha: 15 }, Egypt: { fajr: 19.5, isha: 17.5 }, Makkah: { fajr: 18.5, ishaMin: 90 }, Karachi: { fajr: 18, isha: 18 }, Gulf: { fajr: 19.5, ishaMin: 90 }, France: { fajr: 12, isha: 12 } };
const NAMES = [['fajr', 'Fajr'], ['dhuhr', 'Dhuhr'], ['asr', 'Asr'], ['maghrib', 'Maghrib'], ['isha', 'Isha']];

// ---------- settings ----------
async function loadSettings() {
  let s = { lat: 52.52, lng: 13.405, city: 'Berlin', method: 'MWL', asr: 'standard', highLat: 'AngleBased', adjust: {}, notifyBefore: 10 };
  try {
    const fm = FileManager.iCloud(); const p = fm.joinPath(fm.documentsDirectory(), 'nur-widget.json');
    if (fm.fileExists(p)) { await fm.downloadFileFromiCloud(p); const d = JSON.parse(fm.readString(p)); if (d.settings) s = { ...s, ...d.settings }; return s; }
  } catch (e) {}
  const param = (args.widgetParameter || '').trim();
  if (param && param !== 'nonotify') {
    if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(param)) { const [a, b] = param.split(',').map(Number); s.lat = a; s.lng = b; s.city = 'Standort'; }
    else if (CITIES[param]) { s.lat = CITIES[param][0]; s.lng = CITIES[param][1]; s.city = param; }
    return s;
  }
  try { Location.setAccuracyToThreeKilometers(); const l = await Location.current(); s.lat = l.latitude; s.lng = l.longitude; s.city = 'Hier'; } catch (e) {}
  return s;
}

// ---------- prayer math (same as the app) ----------
const dtr = (d) => (d * Math.PI) / 180, rtd = (r) => (r * 180) / Math.PI;
const sin = (d) => Math.sin(dtr(d)), cos = (d) => Math.cos(dtr(d)), tan = (d) => Math.tan(dtr(d));
const fix = (a, b) => { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; };
function julian(y, m, d) { if (m <= 2) { y -= 1; m += 12; } const A = Math.floor(y / 100); const B = 2 - A + Math.floor(A / 4); return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5; }
function sunPos(jd) { const D = jd - 2451545; const g = fix(357.529 + 0.98560028 * D, 360); const q = fix(280.459 + 0.98564736 * D, 360); const L = fix(q + 1.915 * sin(g) + 0.02 * sin(2 * g), 360); const e = 23.439 - 0.00000036 * D; const RA = rtd(Math.atan2(cos(e) * sin(L), cos(L))) / 15; return { decl: rtd(Math.asin(sin(e) * sin(L))), eqt: q / 15 - fix(RA, 24) }; }
function times(date, s) {
  const m = METHODS[s.method] || METHODS.MWL, lat = s.lat, lng = s.lng;
  const tz = -new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTimezoneOffset() / 60;
  const jD = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / 360;
  const mid = (t) => fix(12 - sunPos(jD + t).eqt, 24);
  const ang = (a, t, ccw) => { const dc = sunPos(jD + t).decl; const v = rtd(Math.acos((-sin(a) - sin(dc) * sin(lat)) / (cos(dc) * cos(lat)))) / 15; return mid(t) + (ccw ? -v : v); };
  const asr = (f, t) => { const dc = sunPos(jD + t).decl; return ang(-rtd(Math.atan(1 / (f + tan(Math.abs(lat - dc))))), t); };
  let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 };
  for (let i = 0; i < 2; i++) { const p = {}; for (const k in t) p[k] = t[k] / 24;
    t = { fajr: ang(m.fajr, p.fajr, true), sunrise: ang(0.833, p.sunrise, true), dhuhr: mid(p.dhuhr), asr: asr(s.asr === 'hanafi' ? 2 : 1, p.asr), sunset: ang(0.833, p.sunset), isha: m.ishaMin ? 0 : ang(m.isha, p.isha) }; }
  t.maghrib = t.sunset; if (m.ishaMin) t.isha = t.maghrib + m.ishaMin / 60;
  const night = fix(t.sunrise - t.sunset, 24);
  const por = (a) => s.highLat === 'OneSeventh' ? night / 7 : s.highLat === 'NightMiddle' ? night / 2 : (a / 60) * night;
  if (isNaN(t.fajr) || fix(t.sunrise - t.fajr, 24) > por(m.fajr)) t.fajr = t.sunrise - por(m.fajr);
  if (!m.ishaMin && (isNaN(t.isha) || fix(t.isha - t.sunset, 24) > por(m.isha))) t.isha = t.sunset + por(m.isha);
  const out = {}; const off = m.offsets || {}; const adj = s.adjust || {};
  for (const k of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']) {
    const h = t[k] + tz - lng / 15 + ((off[k] || 0) + (adj[k] || 0)) / 60;
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()); d.setTime(d.getTime() + Math.round(h * 3600) * 1000); out[k] = d;
  }
  return out;
}

// ---------- notifications ----------
async function scheduleNotifications(s) {
  if ((args.widgetParameter || '').includes('nonotify')) return;
  const now = new Date();
  for (let day = 0; day < 2; day++) {
    const d = new Date(now); d.setDate(now.getDate() + day); const t = times(d, s);
    for (const [k, name] of NAMES) {
      const at = new Date(t[k].getTime() - (s.notifyBefore || 0) * 60000); if (at <= now) continue;
      const n = new Notification(); n.identifier = `nur-${k}-${d.toDateString()}`;
      n.title = `${name} ${s.notifyBefore ? `in ${s.notifyBefore} min` : 'jetzt'}`;
      n.body = `${hm(t[k])} · ${s.city}`; n.sound = 'default'; n.threadIdentifier = 'nur-prayer';
      n.setTriggerDate(at); await n.schedule();
    }
  }
}

const hm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const GOLD = new Color('#E8C47C'), DIM = new Color('#ffffff', 0.6);

function nextOf(s) {
  const now = new Date(); const t = times(now, s);
  for (const [k, n] of NAMES) if (t[k] > now) return { k, n, time: t[k], t };
  const tm = new Date(now); tm.setDate(now.getDate() + 1); const t2 = times(tm, s);
  return { k: 'fajr', n: 'Fajr', time: t2.fajr, t };
}

async function build() {
  const s = await loadSettings(); const np = nextOf(s); const fam = config.widgetFamily || 'medium';
  try { await scheduleNotifications(s); } catch (e) {}
  const w = new ListWidget();
  w.refreshAfterDate = new Date(Math.min(np.time.getTime() + 60000, Date.now() + 30 * 60000));

  if (fam.startsWith('accessory')) {
    if (fam === 'accessoryInline') { w.addText(`☾ ${np.n} ${hm(np.time)}`); return w; }
    const a = w.addText(np.n); a.font = Font.boldSystemFont(13);
    const b = w.addText(hm(np.time)); b.font = Font.systemFont(fam === 'accessoryCircular' ? 13 : 20);
    if (fam === 'accessoryRectangular') { const c = w.addDate(np.time); c.applyRelativeStyle(); c.font = Font.systemFont(11); }
    return w;
  }

  const g = new LinearGradient(); g.colors = [new Color('#1d2b4a'), new Color('#0b1222')]; g.locations = [0, 1]; w.backgroundGradient = g;
  w.setPadding(14, 16, 14, 16);
  const top = w.addText('NÄCHSTES GEBET'); top.font = Font.semiboldSystemFont(10); top.textColor = GOLD;
  w.addSpacer(4);
  if (fam === 'small') {
    const n = w.addText(np.n); n.font = Font.boldSystemFont(24); n.textColor = Color.white();
    const tt = w.addText(hm(np.time)); tt.font = Font.lightSystemFont(28); tt.textColor = Color.white();
    w.addSpacer();
    const c = w.addDate(np.time); c.applyTimerStyle(); c.font = Font.mediumSystemFont(13); c.textColor = DIM;
    const city = w.addText(s.city); city.font = Font.systemFont(10); city.textColor = new Color('#ffffff', 0.4);
    return w;
  }
  const row = w.addStack(); row.centerAlignContent();
  const n = row.addText(`${np.n}  `); n.font = Font.boldSystemFont(22); n.textColor = Color.white();
  const tt = row.addText(hm(np.time)); tt.font = Font.lightSystemFont(22); tt.textColor = Color.white();
  row.addSpacer();
  const c = row.addDate(np.time); c.applyTimerStyle(); c.font = Font.mediumSystemFont(14); c.textColor = GOLD; c.rightAlignText();
  w.addSpacer();
  const all = w.addStack();
  for (const [k, name] of NAMES) {
    const col = all.addStack(); col.layoutVertically(); col.centerAlignContent();
    const l = col.addText(name); l.font = Font.mediumSystemFont(10); l.textColor = k === np.k ? GOLD : DIM;
    const v = col.addText(hm(np.t[k])); v.font = Font.semiboldSystemFont(14); v.textColor = k === np.k ? GOLD : Color.white();
    if (k !== 'isha') all.addSpacer();
  }
  w.addSpacer(6);
  const f = w.addText(`${s.city} · offline berechnet`); f.font = Font.systemFont(9); f.textColor = new Color('#ffffff', 0.35);
  return w;
}

const widget = await build();
if (config.runsInWidget || config.runsInAccessoryWidget) Script.setWidget(widget);
else { await widget.presentMedium(); }
Script.complete();
