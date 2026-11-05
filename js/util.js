// Helpers: dates, formatting, ids, escaping, content filter, habit statistics.

export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const sameDay = (a, b) => ymd(a) === ymd(b);

export const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function fmtDateLong(d) { return `${WD_LONG[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`; }
export function fmtCountdown(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h} h ${pad(m)} min`;
  if (m > 0) return `${m} min ${pad(sec)} s`;
  return `${sec} s`;
}
export function fmtMinutes(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h} h ${m ? m + ' min' : ''}`.trim() : `${m} min`;
}
export function daysUntil(dateStr) {
  const t = parseYmd(dateStr); const n = parseYmd(ymd());
  return Math.round((t - n) / 86400000);
}
export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'Gute Nacht';
  if (h < 11) return 'Guten Morgen';
  if (h < 17) return 'Hallo';
  if (h < 22) return 'Guten Abend';
  return 'Gute Nacht';
}

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- Content protection ----------
// Blocks adult content in every text the user enters or every link opened from the app.
// General words are not touched: matching uses whole words and a precise list.
const BLOCK_DOMAINS = ['pornhub', 'xvideos', 'xnxx', 'xhamster', 'redtube', 'youporn', 'onlyfans', 'brazzers', 'chaturbate', 'stripchat',
  'spankbang', 'eporner', 'tnaflix', 'youjizz', 'livejasmin', 'bongacams', 'cam4', 'myfreecams', 'fansly', 'rule34', 'nhentai', 'hentaihaven',
  'motherless', 'beeg', 'porn', 'xxx', 'sex.com', 'erome', 'thothub', 'manyvids', 'clips4sale'];
const BLOCK_WORDS = ['porn', 'porno', 'pornos', 'pornografie', 'pornography', 'xxx', 'nsfw', 'hentai', 'onlyfans', 'nudes', 'sexcam', 'sexcams',
  'camgirl', 'camgirls', 'webcamsex', 'sexvideo', 'sexvideos', 'sexfilm', 'sexfilme', 'erotikfilm', 'erotikfilme', 'milf', 'fansly', 'rule34', 'r34',
  'jav', 'camsex', 'sexchat', 'nacktbilder', 'nacktfotos', 'pornhub', 'xvideos', 'xhamster', 'xnxx', 'strip chat', 'stripchat', 'nackt video', 'nacktvideo'];

function normalize(s) {
  return String(s).toLowerCase()
    .replace(/[0]/g, 'o').replace(/[1!|]/g, 'i').replace(/[3]/g, 'e').replace(/[4@]/g, 'a').replace(/[5$]/g, 's').replace(/[7]/g, 't')
    .replace(/[ä]/g, 'ae').replace(/[ö]/g, 'oe').replace(/[ü]/g, 'ue').replace(/ß/g, 'ss');
}

export function isBlockedText(text) {
  if (!text) return false;
  const raw = String(text).toLowerCase();
  // URLs and domains
  const hostMatches = raw.match(/(?:https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}/g) || [];
  for (const h of hostMatches) {
    const host = h.replace(/^https?:\/\//, '');
    if (BLOCK_DOMAINS.some((d) => host.includes(d))) return true;
  }
  const n = normalize(raw);
  const squashed = n.replace(/[^a-z]/g, '');
  for (const w of BLOCK_WORDS) {
    const re = new RegExp(`(^|[^a-z])${w.replace(/\s/g, '[\\s._-]*')}($|[^a-z])`);
    if (re.test(n)) return true;
  }
  // spaced-out tricks like "p o r n"
  if (/p+o+r+n+/.test(squashed) && /(^|[^a-z])p[\s._-]*o[\s._-]*r[\s._-]*n/.test(n)) return true;
  return false;
}

// ---------- Habit statistics ----------
export function isScheduled(habit, date) {
  return !habit.days || habit.days.length === 0 || habit.days.includes(date.getDay());
}
export function habitValue(state, habit, dateStr) { return state.habitLog[dateStr]?.[habit.id] || 0; }
export function habitDone(state, habit, dateStr) {
  const v = habitValue(state, habit, dateStr);
  if (habit.type === 'bool') return v >= 1;
  return v >= (habit.target || 1);
}
export function onVacation(state, dateStr) {
  return state.vacation.some((v) => dateStr >= v.from && dateStr <= v.to);
}

// Anti-frustration streak: one missed scheduled day is forgiven per 7 completed days
// (max 2 jokers banked). Vacation days and unscheduled days never break a streak.
// Today never breaks a streak while it is still open.
export function habitStats(state, habit, today = new Date()) {
  const created = new Date(habit.createdAt || Date.now()); created.setHours(0, 0, 0, 0);
  const todayStr = ymd(today);
  let current = 0, best = 0, run = 0, jokers = 1, earned = 0;
  const days = Math.min(800, Math.floor((today - created) / 86400000) + 1);
  // walk forward to compute best and current with jokers
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i); const ds = ymd(d);
    if (!isScheduled(habit, d) || onVacation(state, ds)) continue;
    if (habitDone(state, habit, ds)) {
      run++; earned++;
      if (earned >= 7) { earned = 0; jokers = Math.min(2, jokers + 1); }
    } else if (ds === todayStr) {
      // still open
    } else if (jokers > 0 && run > 0) {
      jokers--;
    } else {
      run = 0; earned = 0; jokers = 1;
    }
    best = Math.max(best, run);
  }
  current = run;
  const rate = (n) => {
    let done = 0, sched = 0;
    for (let i = 0; i < n; i++) {
      const d = addDays(today, -i); const ds = ymd(d);
      if (d < created) break;
      if (!isScheduled(habit, d) || onVacation(state, ds)) continue;
      if (ds === todayStr && !habitDone(state, habit, ds)) continue;
      sched++; if (habitDone(state, habit, ds)) done++;
    }
    return { done, sched, pct: sched ? Math.round((done / sched) * 100) : 0 };
  };
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const yearDays = Math.floor((today - yearStart) / 86400000) + 1;
  // Habit strength score (exponential smoothing, like a "Gesamt-Score")
  let score = 0;
  for (let i = Math.min(days, 365) - 1; i >= 0; i--) {
    const d = addDays(today, -i); const ds = ymd(d);
    if (!isScheduled(habit, d) || onVacation(state, ds)) continue;
    if (ds === todayStr && !habitDone(state, habit, ds)) continue;
    const v = habitDone(state, habit, ds) ? 1 : (habit.type !== 'bool' ? Math.min(1, habitValue(state, habit, ds) / (habit.target || 1)) * 0.5 : 0);
    score = score * 0.93 + v * 0.07;
  }
  let total = 0;
  for (const ds in state.habitLog) if (habitDone(state, habit, ds)) total++;
  return { current, best, jokers, w: rate(7), m: rate(30), y: rate(yearDays), score: Math.round(score * 100), total };
}

export function todayHabitProgress(state, date = new Date()) {
  const ds = ymd(date);
  const list = state.habits.filter((h) => !h.archived && isScheduled(h, date));
  const done = list.filter((h) => habitDone(state, h, ds)).length;
  return { done, total: list.length, pct: list.length ? done / list.length : 0 };
}

export function levelFromXp(xp) {
  const level = Math.floor(Math.sqrt(xp / 60)) + 1;
  const cur = 60 * (level - 1) ** 2, next = 60 * level ** 2;
  return { level, progress: (xp - cur) / (next - cur), toNext: next - xp };
}
export const LEVEL_NAMES = ['Anfänger', 'Suchender', 'Lernender', 'Beständiger', 'Fokussierter', 'Disziplinierter', 'Standhafter', 'Meister', 'Vorbild', 'Legende'];

// ---------- Natural language quick add (German) ----------
export function parseQuickAdd(text, subjects = []) {
  let t = ' ' + text.trim() + ' ';
  const now = new Date();
  let date = null, time = null, type = 'termin', subjectId = null;
  const low = t.toLowerCase();
  if (/\bübermorgen\b/.test(low)) { date = addDays(now, 2); t = t.replace(/übermorgen/i, ' '); }
  else if (/\bmorgen\b/.test(low)) { date = addDays(now, 1); t = t.replace(/\bmorgen\b/i, ' '); }
  else if (/\bheute\b/.test(low)) { date = now; t = t.replace(/\bheute\b/i, ' '); }
  const wds = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'];
  wds.forEach((w, i) => {
    const re = new RegExp(`\\b(am |nächsten |naechsten )?${w}\\b`, 'i');
    if (!date && re.test(t)) {
      let diff = (i - now.getDay() + 7) % 7; if (diff === 0) diff = 7;
      date = addDays(now, diff); t = t.replace(re, ' ');
    }
  });
  const dm = t.match(/\b(am )?(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?\b/i);
  if (dm) {
    let y = dm[4] ? parseInt(dm[4], 10) : now.getFullYear(); if (y < 100) y += 2000;
    date = new Date(y, parseInt(dm[3], 10) - 1, parseInt(dm[2], 10));
    if (!dm[4] && date < addDays(now, -1)) date.setFullYear(y + 1);
    t = t.replace(dm[0], ' ');
  }
  const tm = t.match(/\b(um )?(\d{1,2})(?::(\d{2})| ?uhr(?: (\d{2}))?)\b/i);
  if (tm) {
    const h = parseInt(tm[2], 10), m = parseInt(tm[3] || tm[4] || '0', 10);
    if (h < 24 && m < 60) { time = `${pad(h)}:${pad(m)}`; t = t.replace(tm[0], ' '); }
  }
  const l2 = t.toLowerCase();
  if (/\b(test|klausur|prüfung|pruefung|arbeit|ka|exam)\b/.test(l2)) type = 'pruefung';
  else if (/\b(hausaufgabe|hausaufgaben|ha|aufgabe|referat|lernen|abgabe)\b/.test(l2)) type = 'hausaufgabe';
  else if (/\b(erinner|nicht vergessen|denk an)\b/.test(l2)) type = 'erinnerung';
  for (const s of subjects) {
    if (new RegExp(`\\b${s.name.toLowerCase()}\\b`).test(l2)) { subjectId = s.id; if (type === 'termin') type = 'hausaufgabe'; break; }
  }
  const title = t.replace(/\s+/g, ' ').trim().replace(/^(am|um)\s/i, '');
  return { title: title || text.trim(), date: date ? ymd(date) : ymd(now), time, type, subjectId };
}

// ---------- ICS ----------
export function eventsToIcs(events) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nur//Fokus//DE', 'CALSCALE:GREGORIAN'];
  const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  for (const e of events) {
    const d = e.date.replace(/-/g, '');
    lines.push('BEGIN:VEVENT', `UID:${e.id}@nur.local`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
    if (e.time) {
      const [h, m] = e.time.split(':').map(Number);
      const start = new Date(parseYmd(e.date)); start.setHours(h, m);
      const end = new Date(start.getTime() + (e.duration || 60) * 60000);
      const f = (x) => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
      lines.push(`DTSTART:${f(start)}`, `DTEND:${f(end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${ymd(addDays(parseYmd(e.date), 1)).replace(/-/g, '')}`);
    }
    if (e.repeat && e.repeat !== 'none') lines.push(`RRULE:FREQ=${{ daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY' }[e.repeat]}`);
    lines.push(`SUMMARY:${icsEsc(e.title)}`);
    if (e.notes) lines.push(`DESCRIPTION:${icsEsc(e.notes)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function icsToEvents(text) {
  const out = [];
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const blocks = unfolded.split('BEGIN:VEVENT').slice(1);
  for (const b of blocks) {
    const get = (k) => { const m = b.match(new RegExp(`^${k}(;[^:]*)?:(.*)$`, 'm')); return m ? m[2].trim() : null; };
    const st = get('DTSTART'); if (!st) continue;
    const date = `${st.slice(0, 4)}-${st.slice(4, 6)}-${st.slice(6, 8)}`;
    let time = null, duration = 60;
    if (st.includes('T')) {
      time = `${st.slice(9, 11)}:${st.slice(11, 13)}`;
      const en = get('DTEND');
      if (en && en.includes('T')) {
        const s = parseInt(st.slice(9, 11), 10) * 60 + parseInt(st.slice(11, 13), 10);
        const e = parseInt(en.slice(9, 11), 10) * 60 + parseInt(en.slice(11, 13), 10);
        if (e > s) duration = e - s;
      }
    }
    const rr = get('RRULE') || '';
    const repeat = /DAILY/.test(rr) ? 'daily' : /WEEKLY/.test(rr) ? 'weekly' : /MONTHLY/.test(rr) ? 'monthly' : 'none';
    const un = (s) => (s || '').replace(/\\n/g, '\n').replace(/\\([,;\\])/g, '$1');
    out.push({ id: uid(), title: un(get('SUMMARY')) || 'Termin', type: 'termin', date, time, duration, repeat, priority: 1, done: false, notes: un(get('DESCRIPTION')), createdAt: Date.now() });
  }
  return out;
}

// Does a (possibly repeating) event occur on a given date?
export function occursOn(e, dateStr) {
  if (e.date === dateStr) return true;
  if (!e.repeat || e.repeat === 'none' || dateStr < e.date) return false;
  if (e.until && dateStr > e.until) return false;
  const a = parseYmd(e.date), b = parseYmd(dateStr);
  if (e.repeat === 'daily') return true;
  if (e.repeat === 'weekly') return a.getDay() === b.getDay();
  if (e.repeat === 'monthly') return a.getDate() === b.getDate();
  return false;
}

export function download(filename, content, mime = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const file = new File([blob], filename, { type: mime });
  if (navigator.canShare?.({ files: [file] })) {
    return navigator.share({ files: [file], title: filename }).catch(() => {});
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
