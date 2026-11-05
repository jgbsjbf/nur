// Persistent state: IndexedDB with localStorage mirror as fallback.
// The whole app state is one JSON document. Small, fast and easy to back up.

const DB_NAME = 'nur-db';
const STORE = 'kv';
const KEY = 'state';
const LS_KEY = 'nur-state-backup';

export const SCHEMA_VERSION = 1;

export function defaultState() {
  return {
    v: SCHEMA_VERSION,
    onboarded: false,
    profile: { name: '', createdAt: Date.now() },
    settings: {
      lat: 52.52, lng: 13.405, city: 'Berlin', tz: null,
      method: 'MWL', asr: 'standard', highLat: 'AngleBased',
      adjust: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
      hijriAdjust: 0,
      notifyPrayers: false, notifyBefore: 10, badge: true,
      haptics: true, sounds: true,
      lock: { type: 'none', pinHash: null, credId: null },
      focusPauseOnPrayer: true,
      ambient: 'none',
    },
    habits: [],          // {id,name,emoji,category,color,type:'bool'|'count'|'duration',target,unit,days:[0..6],afterPrayer,createdAt,archived}
    habitLog: {},        // { 'YYYY-MM-DD': { habitId: value } }
    vacation: [],        // [{from:'YYYY-MM-DD', to:'YYYY-MM-DD'}]
    prayers: {},         // { 'YYYY-MM-DD': { fajr:'ontime'|'late'|'qada', ... } }
    qada: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0, witr: 0 },
    qadaFasts: 0,
    fasts: {},           // { 'YYYY-MM-DD': 'fasted'|'missed' }
    dhikr: { presets: null, totals: {}, today: {}, todayDate: null, active: 0 },
    adhkar: {},          // { 'YYYY-MM-DD': { morning:[ids], evening:[ids] } }
    quran: { page: 1, juz: 1, khatmTarget: null, khatms: 0, log: {} }, // log: {date: pagesRead}
    customQuotes: [],    // {id,type:'verse'|'hadith',text,source}
    favQuotes: [],
    events: [],          // {id,title,type,subject,date,time,duration,repeat,priority,done,notes,createdAt}
    subjects: [
      { id: 's1', name: 'Mathe', color: '#0A84FF' },
      { id: 's2', name: 'Deutsch', color: '#FF9F0A' },
      { id: 's3', name: 'Englisch', color: '#BF5AF2' },
      { id: 's4', name: 'Bio', color: '#30D158' },
    ],
    timetable: [],       // {id,day:1..5,start:'08:00',end:'08:45',subjectId,room}
    focus: { sessions: [], preset: 25, breakMin: 5, autoBreak: true }, // sessions: {start,end,minutes,label,subjectId,distractions}
    journal: {},         // { date: { mood:1..5, note:'' } }
    clean: { since: null, best: 0, resisted: 0, log: [] }, // private "Reinheits-Serie"
    xp: 0,
    xpLog: {},           // { date: xp }
    lastReview: null,
  };
}

let db = null;
function openDB() {
  return new Promise((resolve) => {
    if (!('indexedDB' in window)) return resolve(null);
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

function idbGet() {
  return new Promise((resolve) => {
    if (!db) return resolve(null);
    try {
      const tx = db.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).get(KEY);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

function idbPut(value) {
  return new Promise((resolve) => {
    if (!db) return resolve(false);
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch { resolve(false); }
  });
}

// Deep merge defaults into loaded state so new fields appear after updates.
function mergeDefaults(def, cur) {
  if (Array.isArray(def)) return Array.isArray(cur) ? cur : def;
  if (def && typeof def === 'object') {
    const out = { ...def };
    if (cur && typeof cur === 'object') {
      for (const k of Object.keys(cur)) {
        out[k] = k in def ? mergeDefaults(def[k], cur[k]) : cur[k];
      }
    }
    return out;
  }
  return cur === undefined ? def : cur;
}

export const store = {
  state: defaultState(),
  listeners: new Set(),
  async init() {
    db = await openDB();
    let loaded = await idbGet();
    if (!loaded) {
      try { loaded = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { loaded = null; }
    }
    if (loaded) this.state = mergeDefaults(defaultState(), loaded);
    // Ask the browser to keep data even under storage pressure.
    try { await navigator.storage?.persist?.(); } catch {}
    return this.state;
  },
  _timer: null,
  save() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flush(), 150);
    this.listeners.forEach((fn) => fn(this.state));
  },
  async flush() {
    const snapshot = JSON.parse(JSON.stringify(this.state));
    await idbPut(snapshot);
    try { localStorage.setItem(LS_KEY, JSON.stringify(snapshot)); } catch {}
  },
  update(fn) { fn(this.state); this.save(); },
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  replace(newState) {
    this.state = mergeDefaults(defaultState(), newState);
    this.save();
  },
  reset() { this.state = defaultState(); this.save(); },
};

window.addEventListener('pagehide', () => store.flush());
document.addEventListener('visibilitychange', () => { if (document.hidden) store.flush(); });
