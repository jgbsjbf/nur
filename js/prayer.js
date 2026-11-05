// Offline prayer time calculation (astronomical formulas, no API).
// Based on the well-known public-domain PrayTimes algorithm.

const dtr = (d) => (d * Math.PI) / 180;
const rtd = (r) => (r * 180) / Math.PI;
const sin = (d) => Math.sin(dtr(d));
const cos = (d) => Math.cos(dtr(d));
const tan = (d) => Math.tan(dtr(d));
const arcsin = (x) => rtd(Math.asin(x));
const arccos = (x) => rtd(Math.acos(x));
const arctan2 = (y, x) => rtd(Math.atan2(y, x));
const arccot = (x) => rtd(Math.atan(1 / x));
const fix = (a, b) => { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; };
const fixAngle = (a) => fix(a, 360);
const fixHour = (a) => fix(a, 24);

export const METHODS = {
  MWL:     { name: 'Muslim World League', fajr: 18, isha: 17 },
  Diyanet: { name: 'Diyanet / DITIB (Türkei)', fajr: 18, isha: 17, offsets: { sunrise: -7, dhuhr: 5, asr: 4, maghrib: 7 } },
  ISNA:    { name: 'ISNA (Nordamerika)', fajr: 15, isha: 15 },
  Egypt:   { name: 'Ägyptische Behörde', fajr: 19.5, isha: 17.5 },
  Makkah:  { name: 'Umm al-Qura (Mekka)', fajr: 18.5, ishaMin: 90 },
  Karachi: { name: 'Universität Karachi', fajr: 18, isha: 18 },
  Gulf:    { name: 'Golfregion', fajr: 19.5, ishaMin: 90 },
  France:  { name: 'UOIF (Frankreich, 12°)', fajr: 12, isha: 12 },
};

export const PRAYERS = [
  { key: 'fajr', name: 'Fajr', ar: 'الفجر', icon: 'sunrise' },
  { key: 'dhuhr', name: 'Dhuhr', ar: 'الظهر', icon: 'sun' },
  { key: 'asr', name: 'Asr', ar: 'العصر', icon: 'sun-low' },
  { key: 'maghrib', name: 'Maghrib', ar: 'المغرب', icon: 'sunset' },
  { key: 'isha', name: 'Isha', ar: 'العشاء', icon: 'moon' },
];

function julian(year, month, day) {
  if (month <= 2) { year -= 1; month += 12; }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915 * sin(g) + 0.02 * sin(2 * g));
  const e = 23.439 - 0.00000036 * D;
  const RA = arctan2(cos(e) * sin(L), cos(L)) / 15;
  const eqt = q / 15 - fixHour(RA);
  const decl = arcsin(sin(e) * sin(L));
  return { decl, eqt };
}

export function computeTimes(date, s) {
  const lat = s.lat, lng = s.lng;
  const m = METHODS[s.method] || METHODS.MWL;
  const asrFactor = s.asr === 'hanafi' ? 2 : 1;
  const tz = -new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTimezoneOffset() / 60;
  const jDate = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);

  const midDay = (t) => fixHour(12 - sunPosition(jDate + t).eqt);
  const sunAngleTime = (angle, t, ccw) => {
    const decl = sunPosition(jDate + t).decl;
    const noon = midDay(t);
    const v = arccos((-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))) / 15;
    return noon + (ccw ? -v : v);
  };
  const asrTime = (factor, t) => {
    const decl = sunPosition(jDate + t).decl;
    const angle = -arccot(factor + tan(Math.abs(lat - decl)));
    return sunAngleTime(angle, t);
  };

  // initial guesses as day portions, one refinement pass
  let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 };
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v / 24]));
    t = {
      fajr: sunAngleTime(m.fajr, p.fajr, true),
      sunrise: sunAngleTime(0.833, p.sunrise, true),
      dhuhr: midDay(p.dhuhr),
      asr: asrTime(asrFactor, p.asr),
      sunset: sunAngleTime(0.833, p.sunset),
      isha: m.ishaMin ? 0 : sunAngleTime(m.isha, p.isha),
    };
  }
  t.maghrib = t.sunset;
  if (m.ishaMin) t.isha = t.maghrib + m.ishaMin / 60;

  // high latitude adjustment (needed in Germany during summer)
  const night = fixHour(t.sunrise - t.sunset);
  const portion = (angle) => {
    if (s.highLat === 'OneSeventh') return night / 7;
    if (s.highLat === 'NightMiddle') return night / 2;
    return (angle / 60) * night;
  };
  const fajrP = portion(m.fajr);
  if (isNaN(t.fajr) || fixHour(t.sunrise - t.fajr) > fajrP) t.fajr = t.sunrise - fajrP;
  if (!m.ishaMin) {
    const ishaP = portion(m.isha);
    if (isNaN(t.isha) || fixHour(t.isha - t.sunset) > ishaP) t.isha = t.sunset + ishaP;
  }

  const offsets = m.offsets || {};
  const out = {};
  for (const k of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']) {
    let h = t[k] + tz - lng / 15;
    h += ((offsets[k] || 0) + (s.adjust?.[k] || 0)) / 60;
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    d.setTime(d.getTime() + Math.round(h * 3600) * 1000);
    out[k] = d;
  }
  // Islamic midnight and last third of the night (for Tahajjud)
  const nightMs = (night * 3600000);
  out.midnight = new Date(out.maghrib.getTime() + nightMs / 2);
  out.lastThird = new Date(out.maghrib.getTime() + (nightMs * 2) / 3);
  return out;
}

export function nextPrayer(now, s) {
  const today = computeTimes(now, s);
  for (const p of PRAYERS) {
    if (today[p.key] > now) return { ...p, time: today[p.key], times: today };
  }
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const t2 = computeTimes(tomorrow, s);
  return { ...PRAYERS[0], time: t2.fajr, times: today, tomorrow: true };
}

export function currentPrayer(now, s) {
  const t = computeTimes(now, s);
  let cur = null;
  for (const p of PRAYERS) if (t[p.key] <= now) cur = p;
  if (cur && cur.key === 'fajr' && now >= t.sunrise) return null; // between sunrise and dhuhr
  return cur;
}

export function qiblaBearing(lat, lng) {
  const kLat = 21.4225, kLng = 39.8262;
  const dL = dtr(kLng - lng);
  const y = Math.sin(dL);
  const x = Math.cos(dtr(lat)) * Math.tan(dtr(kLat)) - Math.sin(dtr(lat)) * Math.cos(dL);
  return fixAngle(rtd(Math.atan2(y, x)));
}

export function distanceToMakkah(lat, lng) {
  const R = 6371, kLat = 21.4225, kLng = 39.8262;
  const a = Math.sin(dtr(kLat - lat) / 2) ** 2 + Math.cos(dtr(lat)) * Math.cos(dtr(kLat)) * Math.sin(dtr(kLng - lng) / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ---------- Hijri calendar (offline) ----------
export const HIJRI_MONTHS = ['Muharram', 'Safar', 'Rabīʿ al-Awwal', 'Rabīʿ ath-Thānī', 'Dschumādā al-Ūlā', 'Dschumādā al-Āchira',
  'Radschab', 'Schaʿbān', 'Ramadan', 'Schawwāl', 'Dhū l-Qaʿda', 'Dhū l-Hiddscha'];

let hijriFmt = null;
try {
  hijriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
  if (!/islamic/.test(hijriFmt.resolvedOptions().calendar)) hijriFmt = null;
} catch { hijriFmt = null; }

function tabularHijri(date) {
  // Kuwaiti algorithm fallback
  const jd = Math.floor(julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) + 0.5);
  const l0 = jd - 1948440 + 10632;
  const n = Math.floor((l0 - 1) / 10631);
  const l1 = l0 - 10631 * n + 354;
  const j = Math.floor((10985 - l1) / 5316) * Math.floor((50 * l1) / 17719) + Math.floor(l1 / 5670) * Math.floor((43 * l1) / 15238);
  const l2 = l1 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l2) / 709);
  const day = l2 - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { day, month, year };
}

export function toHijri(date, adjustDays = 0) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + adjustDays, 12);
  let r;
  if (hijriFmt) {
    const parts = Object.fromEntries(hijriFmt.formatToParts(d).map((p) => [p.type, p.value]));
    r = { day: parseInt(parts.day, 10), month: parseInt(parts.month, 10), year: parseInt(parts.year || parts.relatedYear, 10) };
    if (!r.day || !r.month || !r.year) r = tabularHijri(d);
  } else r = tabularHijri(d);
  return { ...r, monthName: HIJRI_MONTHS[r.month - 1] };
}

export function islamicDay(h) {
  const k = `${h.month}-${h.day}`;
  const map = {
    '1-1': 'Islamisches Neujahr', '1-9': 'Tasua (Fastentag)', '1-10': 'Aschura (Fastentag)',
    '7-27': 'Isrāʾ und Miʿrādsch', '8-15': 'Mitte Schaʿbān', '9-1': 'Ramadan beginnt',
    '10-1': 'Eid al-Fitr', '12-8': 'Tag von Tarwiya', '12-9': 'Tag von ʿArafa (Fastentag)', '12-10': 'Eid al-Adha',
    '12-11': 'Tage des Taschrīq', '12-12': 'Tage des Taschrīq', '12-13': 'Tage des Taschrīq',
  };
  if (map[k]) return map[k];
  if (h.month === 9 && h.day >= 21 && h.day % 2 === 1) return 'Ungerade Nacht – Laylat al-Qadr suchen';
  return null;
}

export function isSunnahFast(date, h) {
  const wd = date.getDay();
  if (h.month === 9) return null;
  if (h.month === 10 && h.day === 1) return null;
  if (h.month === 12 && h.day >= 10 && h.day <= 13) return null;
  if ([13, 14, 15].includes(h.day)) return 'Weiße Tage (Ayyām al-Bīḍ)';
  if (wd === 1) return 'Montag – Sunnah-Fasten';
  if (wd === 4) return 'Donnerstag – Sunnah-Fasten';
  return null;
}

export const CITIES = [
  ['Berlin', 52.52, 13.405], ['Hamburg', 53.551, 9.993], ['München', 48.137, 11.575], ['Köln', 50.937, 6.96],
  ['Frankfurt', 50.11, 8.682], ['Stuttgart', 48.775, 9.182], ['Düsseldorf', 51.227, 6.773], ['Dortmund', 51.514, 7.468],
  ['Essen', 51.455, 7.011], ['Duisburg', 51.434, 6.762], ['Hannover', 52.375, 9.732], ['Nürnberg', 49.452, 11.077],
  ['Bremen', 53.079, 8.801], ['Leipzig', 51.339, 12.373], ['Dresden', 51.05, 13.737], ['Mannheim', 49.487, 8.466],
  ['Wien', 48.208, 16.373], ['Zürich', 47.376, 8.541], ['Istanbul', 41.008, 28.978], ['Ankara', 39.933, 32.86],
  ['London', 51.507, -0.128], ['Paris', 48.857, 2.352], ['Amsterdam', 52.368, 4.904], ['Mekka', 21.4225, 39.8262],
];
