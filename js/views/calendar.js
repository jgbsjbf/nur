import { store } from '../store.js';
import { app, navbar } from '../core.js';
import { esc, ymd, uid, addDays, parseYmd, WD, WD_LONG, MONTHS, hm, occursOn, parseQuickAdd, daysUntil, pad } from '../util.js';
import { icon, haptic, chime, openSheet, confirmSheet, guardText, toast, segmented, bindSegmented, toggle } from '../ui.js';
import { computeTimes, PRAYERS } from '../prayer.js';
import { COLORS } from '../content.js';

export const TYPES = {
  termin: { name: 'Termin', color: '#0A84FF', icon: 'calendar' },
  hausaufgabe: { name: 'Hausaufgabe', color: '#FF9F0A', icon: 'edit' },
  pruefung: { name: 'Prüfung', color: '#FF453A', icon: 'alert' },
  erinnerung: { name: 'Erinnerung', color: '#BF5AF2', icon: 'bell' },
  schule: { name: 'Schule', color: '#30D158', icon: 'book' },
};
const PRIO = ['Niedrig', 'Normal', 'Hoch'];

let sel = ymd(); let mode = 'day'; let showPrayers = true; let sortBy = 'time';

export function eventsOn(s, ds) {
  return s.events.filter((e) => occursOn(e, ds)).map((e) => ({ ...e, _done: e.repeat && e.repeat !== 'none' ? (e.doneDates || []).includes(ds) : e.done }));
}
export function upcoming(s, n = 4) {
  const out = []; const now = new Date(); const nowHm = hm(now);
  for (let i = 0; i < 30 && out.length < n; i++) {
    const ds = ymd(addDays(now, i));
    eventsOn(s, ds).filter((e) => !e._done && (i > 0 || !e.time || e.time >= nowHm)).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))
      .forEach((e) => out.length < n && out.push({ ...e, _date: ds }));
  }
  return out;
}
function color(s, e) { return e.subjectId ? (s.subjects.find((x) => x.id === e.subjectId)?.color || TYPES[e.type]?.color) : (TYPES[e.type]?.color || '#0A84FF'); }

export function eventRow(s, e, ds, showDate = false) {
  const sub = s.subjects.find((x) => x.id === e.subjectId);
  const left = e.type === 'pruefung' ? daysUntil(ds) : null;
  return `<div class="event ${e._done ? 'done' : ''}" style="--c:${color(s, e)}" data-ev="${e.id}" data-ds="${ds}">
    <div class="stripe"></div>
    <div class="time">${e.time || 'Ganz&shy;tags'}</div>
    <div style="flex:1;min-width:0"><div class="title">${esc(e.title)}</div>
      <div class="small muted hstack" style="gap:6px;margin-top:2px">${icon(TYPES[e.type]?.icon || 'calendar', 'xs')} ${TYPES[e.type]?.name || ''}${sub ? ` · ${esc(sub.name)}` : ''}${showDate ? ` · ${parseYmd(ds).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}` : ''}${e.repeat && e.repeat !== 'none' ? ` · ${icon('refresh', 'xs')}` : ''}${e.priority === 2 ? ' · <span style="color:var(--red)">!</span>' : ''}${left !== null && left >= 0 ? ` · <b style="color:var(--red)">in ${left} T</b>` : ''}</div></div>
    <button class="chk ${e._done ? 'on' : ''}" style="--c:${color(s, e)};width:26px;height:26px" data-evdone="${e.id}" data-ds="${ds}" aria-label="Erledigt">${icon('check')}</button></div>`;
}

export function toggleEventDone(id, ds) {
  const s = store.state; const e = s.events.find((x) => x.id === id); if (!e) return;
  let now;
  if (e.repeat && e.repeat !== 'none') {
    e.doneDates = e.doneDates || []; const i = e.doneDates.indexOf(ds);
    if (i >= 0) e.doneDates.splice(i, 1); else e.doneDates.push(ds); now = i < 0;
  } else { e.done = !e.done; now = e.done; }
  app.addXp(now ? 5 : -5); haptic(now ? 'success' : 'light'); if (now) chime('done');
  store.save();
}

export function bindEvents(root) {
  root.querySelectorAll('[data-evdone]').forEach((b) => b.onclick = (ev) => { ev.stopPropagation(); toggleEventDone(b.dataset.evdone, b.dataset.ds); app.refresh(); document.querySelector(`.view.active [data-evdone="${b.dataset.evdone}"][data-ds="${b.dataset.ds}"]`)?.classList.add('pop'); });
  root.querySelectorAll('[data-ev]').forEach((b) => b.onclick = () => editEvent(b.dataset.ev));
}

function weekStart(d) { const x = parseYmd(ymd(d)); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); }

function dayList(s, ds) {
  let list = eventsOn(s, ds);
  list.sort(sortBy === 'prio' ? (a, b) => (b.priority || 1) - (a.priority || 1) || (a.time || '99').localeCompare(b.time || '99') : (a, b) => (a.time || '00').localeCompare(b.time || '00'));
  let items = list.map((e) => ({ t: e.time || '00:00', html: eventRow(s, e, ds) }));
  if (showPrayers && sortBy === 'time') {
    const t = computeTimes(parseYmd(ds), s.settings);
    items = items.concat(PRAYERS.map((p) => ({ t: hm(t[p.key]), html: `<div class="event prayer"><div style="width:4px"></div><div class="time" style="color:var(--gold)">${hm(t[p.key])}</div><div class="title">${icon('moon', 'xs')} ${p.name}</div></div>` })));
    items.sort((a, b) => a.t.localeCompare(b.t));
  }
  return list.length || showPrayers ? items.map((i) => i.html).join('') + (list.length ? '' : `<div class="empty" style="padding:20px"><div class="small">Keine Einträge. Schreib oben einfach los.</div></div>`)
    : `<div class="empty"><div class="emo">🗓️</div><div class="bold" style="color:var(--label)">Freier Tag</div><div class="small mt8">Tippe oben z. B. „Mathe Hausaufgabe morgen 16 Uhr“.</div></div>`;
}

app.register({
  id: 'calendar',
  render(s) {
    const d = parseYmd(sel); const today = ymd();
    const ws = weekStart(d);
    const exams = upcoming({ ...s, events: s.events.filter((e) => e.type === 'pruefung') }, 2).filter((e) => daysUntil(e._date) <= 30);
    let body = '';
    if (mode === 'day') {
      body = `<div class="hstack between" style="margin:4px 4px 10px"><div><div class="bold" style="font-size:20px">${sel === today ? 'Heute' : WD_LONG[d.getDay()]}</div><div class="small muted">${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}</div></div>
        <div class="hstack" style="gap:6px"><button class="pill ${showPrayers ? 'gold' : ''}" data-tp>${icon('moon', 'xs')} Gebete</button><button class="pill" data-sort>${sortBy === 'time' ? 'Nach Zeit' : 'Nach Priorität'}</button></div></div>
        <div class="stagger">${dayList(s, sel)}</div>`;
    } else if (mode === 'week') {
      body = Array.from({ length: 7 }, (_, i) => {
        const dd = addDays(ws, i); const ds = ymd(dd); const evs = eventsOn(s, ds).sort((a, b) => (a.time || '00').localeCompare(b.time || '00'));
        return `<div class="list-h" style="${ds === today ? 'color:var(--red)' : ''}">${WD_LONG[dd.getDay()]}, ${dd.getDate()}. ${MONTHS[dd.getMonth()].slice(0, 3)}</div>
          ${evs.length ? evs.map((e) => eventRow(s, e, ds)).join('') : '<div class="small faint" style="margin:0 16px 4px">Keine Einträge</div>'}`;
      }).join('');
    } else if (mode === 'month') {
      const first = new Date(d.getFullYear(), d.getMonth(), 1); const off = (first.getDay() + 6) % 7;
      const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i - off));
      body = `<div class="card"><div class="hstack between" style="margin-bottom:8px"><button class="nav-btn" data-mshift="-1">${icon('left', 'sm')}</button><span class="bold">${MONTHS[d.getMonth()]} ${d.getFullYear()}</span><button class="nav-btn" data-mshift="1">${icon('right', 'sm')}</button></div>
        <div class="month-grid">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((x) => `<div class="h">${x}</div>`).join('')}
        ${cells.map((c) => { const ds = ymd(c); const has = eventsOn(s, ds).length; return `<button data-pick="${ds}" class="${c.getMonth() !== d.getMonth() ? 'out' : ''} ${ds === today ? 'today' : ''} ${ds === sel ? 'sel' : ''}"><span>${c.getDate()}</span>${has ? '<i></i>' : ''}</button>`; }).join('')}</div></div>
        <div class="list-h">${d.getDate()}. ${MONTHS[d.getMonth()]}</div><div>${eventsOn(s, sel).sort((a, b) => (a.time || '00').localeCompare(b.time || '00')).map((e) => eventRow(s, e, sel)).join('') || '<div class="small faint" style="margin:0 16px">Keine Einträge</div>'}</div>`;
    } else {
      body = timetableHtml(s);
    }
    return `${navbar('Kalender', `<button class="nav-btn txt" data-today>Heute</button><button class="nav-btn" data-new aria-label="Neuer Eintrag">${icon('plus')}</button>`)}
      <div class="subtitle">${upcoming(s, 50).filter((e) => e._date === today).length} offene Einträge heute</div>
      <div class="quick-add"><input class="field" id="qa" placeholder="z. B. Bio Test Freitag 8 Uhr" autocomplete="off" enterkeyhint="done"><button class="btn primary" data-qa aria-label="Hinzufügen">${icon('plus')}</button></div>
      <div class="qa-preview" id="qaPrev"></div>
      ${exams.map((e) => { const n = daysUntil(e._date); return `<div class="banner" data-ev="${e.id}"><div class="icon-tile" style="background:var(--red)">${icon('alert')}</div><div class="grow" style="flex:1"><div class="bold">${esc(e.title)}</div><div class="small muted">${parseYmd(e._date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</div></div><div class="center"><div class="mid-num" style="color:var(--red)">${n}</div><div class="tiny muted">${n === 1 ? 'Tag' : 'Tage'}</div></div></div>`; }).join('')}
      ${segmented('calMode', [['day', 'Tag'], ['week', 'Woche'], ['month', 'Monat'], ['tt', 'Stundenplan']], mode)}
      ${mode === 'day' || mode === 'week' ? `<div class="hstack between mt12" style="margin-bottom:6px"><button class="nav-btn" data-wshift="-7">${icon('left', 'sm')}</button><span class="small muted">KW ${isoWeek(ws)} · ${MONTHS[ws.getMonth()]}</span><button class="nav-btn" data-wshift="7">${icon('right', 'sm')}</button></div>
      <div class="week-strip" id="wstrip">${Array.from({ length: 7 }, (_, i) => { const dd = addDays(ws, i); const ds = ymd(dd); const n = eventsOn(s, ds).length;
        return `<button data-pick="${ds}" class="${ds === today ? 'today' : ''} ${ds === sel ? 'sel' : ''}"><span class="wd">${WD[dd.getDay()]}</span><span class="dn">${dd.getDate()}</span><span class="dots">${'<i></i>'.repeat(Math.min(3, n))}</span></button>`; }).join('')}</div>` : '<div class="mt12"></div>'}
      ${body}
      <div class="list mt24"><button class="row tap" data-ics style="width:100%;text-align:left"><div class="icon-tile" style="background:var(--blue)">${icon('share')}</div><div class="grow"><div class="t">Mit Apple Kalender austauschen</div><div class="s">.ics importieren oder exportieren</div></div>${icon('right', 'chev')}</button>
        <button class="row tap" data-subjects style="width:100%;text-align:left"><div class="icon-tile" style="background:var(--green)">${icon('book')}</div><div class="grow"><div class="t">Fächer verwalten</div><div class="s">${s.subjects.length} Fächer mit Farben</div></div>${icon('right', 'chev')}</button></div>`;
  },
  mount(root, s) {
    bindSegmented(root, 'calMode', (v) => { mode = v; app.refresh(); });
    root.querySelectorAll('[data-pick]').forEach((b) => b.onclick = () => { sel = b.dataset.pick; haptic(); app.refresh(); });
    root.querySelectorAll('[data-wshift]').forEach((b) => b.onclick = () => { sel = ymd(addDays(parseYmd(sel), Number(b.dataset.wshift))); haptic(); app.refresh(); });
    root.querySelectorAll('[data-mshift]').forEach((b) => b.onclick = () => { const d = parseYmd(sel); sel = ymd(new Date(d.getFullYear(), d.getMonth() + Number(b.dataset.mshift), 1)); haptic(); app.refresh(); });
    root.querySelector('[data-today]').onclick = () => { sel = ymd(); haptic(); app.refresh(); };
    root.querySelector('[data-new]').onclick = () => editEvent(null, { date: sel });
    root.querySelector('[data-tp]')?.addEventListener('click', () => { showPrayers = !showPrayers; haptic(); app.refresh(); });
    root.querySelector('[data-sort]')?.addEventListener('click', () => { sortBy = sortBy === 'time' ? 'prio' : 'time'; haptic(); app.refresh(); });
    root.querySelector('[data-ics]').onclick = icsSheet;
    root.querySelector('[data-subjects]').onclick = subjectsSheet;
    const qa = root.querySelector('#qa'), prev = root.querySelector('#qaPrev');
    qa.oninput = () => {
      if (!qa.value.trim()) return prev.textContent = '';
      const p = parseQuickAdd(qa.value, s.subjects); const sub = s.subjects.find((x) => x.id === p.subjectId);
      prev.innerHTML = `${icon(TYPES[p.type].icon, 'xs')} <b style="color:var(--label)">${esc(p.title)}</b> · ${TYPES[p.type].name}${sub ? ' · ' + esc(sub.name) : ''} · ${parseYmd(p.date).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}${p.time ? ' · ' + p.time : ''}`;
    };
    const add = () => {
      if (!qa.value.trim()) return qa.focus();
      if (!guardText(qa.value)) return;
      const p = parseQuickAdd(qa.value, s.subjects);
      s.events.push({ id: uid(), ...p, duration: 60, repeat: 'none', priority: p.type === 'pruefung' ? 2 : 1, done: false, notes: '', createdAt: Date.now() });
      store.save(); sel = p.date; haptic('success'); toast(`${icon('check')} Eingetragen`, 'ok'); app.refresh();
    };
    root.querySelector('[data-qa]').onclick = add;
    qa.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
    // swipe week strip
    const ws = root.querySelector('#wstrip');
    if (ws) {
      let x0 = null;
      ws.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
      ws.addEventListener('touchend', (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) { sel = ymd(addDays(parseYmd(sel), dx < 0 ? 7 : -7)); haptic(); app.refresh(); } x0 = null; });
    }
    root.querySelectorAll('[data-tt]').forEach((b) => b.onclick = () => editLesson(b.dataset.tt, b.dataset.day, b.dataset.slot));
    bindEvents(root);
  },
});

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dn = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dn);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 86400000 + 1) / 7);
}

// ---------- Event editor ----------
export function editEvent(id, defaults = {}) {
  const s = store.state;
  const orig = id ? s.events.find((x) => x.id === id) : null;
  const e = orig ? { ...orig } : { title: '', type: 'termin', subjectId: null, date: ymd(), time: '', duration: 60, repeat: 'none', priority: 1, done: false, notes: '', ...defaults };
  openSheet(`<div class="sheet-nav"><button data-close>Abbrechen</button><span class="ttl">${id ? 'Bearbeiten' : 'Neuer Eintrag'}</span><button class="b" data-save>${id ? 'Fertig' : 'Hinzufügen'}</button></div>
    <input class="field" id="evT" placeholder="Titel" value="${esc(e.title)}" maxlength="80">
    <label class="lbl">Art</label>
    <div class="chips no-drag" id="evType">${Object.entries(TYPES).map(([k, t]) => `<button class="chip ${k === e.type ? 'on' : ''}" data-k="${k}">${t.name}</button>`).join('')}</div>
    <label class="lbl">Fach</label>
    <div class="chips no-drag" id="evSub"><button class="chip ${!e.subjectId ? 'on' : ''}" data-k="">Keins</button>${s.subjects.map((x) => `<button class="chip ${x.id === e.subjectId ? 'on' : ''}" data-k="${x.id}"><span class="dot" style="background:${x.color}"></span> ${esc(x.name)}</button>`).join('')}</div>
    <div class="list mt12">
      <div class="row"><div class="grow"><div class="t">Datum</div></div><input type="date" id="evD" value="${e.date}"></div>
      <div class="row"><div class="grow"><div class="t">Uhrzeit</div><div class="s">leer = ganztags</div></div><input type="time" id="evH" value="${e.time || ''}"></div>
      <div class="row"><div class="grow"><div class="t">Dauer (min)</div></div><input type="number" inputmode="numeric" id="evDur" value="${e.duration || 60}" style="max-width:80px"></div>
      <div class="row"><div class="grow"><div class="t">Wiederholen</div></div><select id="evR">${[['none', 'Nie'], ['daily', 'Täglich'], ['weekly', 'Wöchentlich'], ['monthly', 'Monatlich']].map(([v, l]) => `<option value="${v}" ${e.repeat === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    </div>
    <label class="lbl">Priorität</label>
    ${segmented('evP', PRIO.map((p, i) => [i, p]), e.priority ?? 1)}
    <label class="lbl">Notizen</label>
    <textarea class="field" id="evN" placeholder="Details, Seiten, Raum …">${esc(e.notes || '')}</textarea>
    ${id ? `<div class="stack gap8 mt16"><button class="btn block" data-focus>${icon('timer')} Fokus für diese Aufgabe starten</button><button class="btn danger block" data-del>Löschen</button></div>` : ''}`, {
    tall: true,
    onMount(el, api) {
      const pick = (sel2, key) => el.querySelector(sel2).onclick = (ev) => { const b = ev.target.closest('.chip'); if (!b) return; e[key] = b.dataset.k || null; el.querySelectorAll(`${sel2} .chip`).forEach((x) => x.classList.toggle('on', x === b)); haptic(); };
      pick('#evType', 'type'); pick('#evSub', 'subjectId');
      bindSegmented(el, 'evP', (v) => e.priority = Number(v));
      el.querySelector('[data-save]').onclick = () => {
        e.title = el.querySelector('#evT').value.trim(); e.notes = el.querySelector('#evN').value.trim();
        if (!e.title) { el.querySelector('#evT').focus(); return toast(`${icon('info')} Titel fehlt`); }
        if (!guardText(e.title, e.notes)) return;
        e.date = el.querySelector('#evD').value || ymd(); e.time = el.querySelector('#evH').value || null;
        e.duration = Math.max(5, parseInt(el.querySelector('#evDur').value, 10) || 60); e.repeat = el.querySelector('#evR').value;
        if (orig) Object.assign(orig, e); else s.events.push({ ...e, id: uid(), createdAt: Date.now() });
        store.save(); haptic('success'); api.close(); sel = e.date; app.refresh();
      };
      el.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (await confirmSheet('Eintrag löschen?', orig.repeat !== 'none' ? 'Alle Wiederholungen werden gelöscht.' : 'Das kann nicht rückgängig gemacht werden.')) { s.events = s.events.filter((x) => x.id !== id); store.save(); api.close(); app.refresh(); }
      });
      el.querySelector('[data-focus]')?.addEventListener('click', () => { api.close(); app.go('focus', { label: e.title, subjectId: e.subjectId, minutes: Math.min(90, e.duration || 25) }); });
    },
  });
}

// ---------- Timetable ----------
const SLOTS = ['07:55', '08:45', '09:50', '10:40', '11:45', '12:35', '13:30', '14:20', '15:10'];
function timetableHtml(s) {
  const wd = new Date().getDay();
  return `<div class="card" style="padding:10px 8px"><div class="tt-grid">
    <div></div>${['Mo', 'Di', 'Mi', 'Do', 'Fr'].map((d, i) => `<div class="h" style="${wd === i + 1 ? 'color:var(--red)' : ''}">${d}</div>`).join('')}
    ${SLOTS.map((t, si) => `<div class="tt-time">${t}</div>${[1, 2, 3, 4, 5].map((day) => {
      const l = s.timetable.find((x) => x.day === day && x.slot === si); const sub = l && s.subjects.find((x) => x.id === l.subjectId);
      return `<button class="tt-cell ${sub ? 'has' : ''}" style="--c:${sub?.color || '#555'}" data-tt="${l?.id || ''}" data-day="${day}" data-slot="${si}">${sub ? `${esc(sub.name)}${l.room ? `<div style="opacity:.7;font-weight:400">${esc(l.room)}</div>` : ''}` : ''}</button>`;
    }).join('')}`).join('')}
  </div></div><p class="list-f" style="margin-top:4px">Tippe auf ein Feld, um ein Fach einzutragen.</p>`;
}
function editLesson(id, day, slot) {
  const s = store.state; const l = id ? s.timetable.find((x) => x.id === id) : null;
  let subjectId = l?.subjectId || s.subjects[0]?.id;
  openSheet(`<h3 class="sheet-title">${['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'][day]}, ${SLOTS[slot]}</h3>
    <div class="chips no-drag" id="lsSub" style="flex-wrap:wrap">${s.subjects.map((x) => `<button class="chip ${x.id === subjectId ? 'on' : ''}" data-k="${x.id}"><span class="dot" style="background:${x.color}"></span> ${esc(x.name)}</button>`).join('')}</div>
    <input class="field" id="lsRoom" placeholder="Raum (optional)" value="${esc(l?.room || '')}">
    <div class="stack gap8 mt16"><button class="btn primary block" data-save>Sichern</button>${l ? '<button class="btn danger block" data-del>Stunde entfernen</button>' : ''}</div>`, {
    onMount(el, api) {
      el.querySelector('#lsSub').onclick = (e) => { const b = e.target.closest('.chip'); if (!b) return; subjectId = b.dataset.k; el.querySelectorAll('#lsSub .chip').forEach((x) => x.classList.toggle('on', x === b)); haptic(); };
      el.querySelector('[data-save]').onclick = () => {
        const room = el.querySelector('#lsRoom').value.trim(); if (!guardText(room)) return;
        if (l) Object.assign(l, { subjectId, room }); else s.timetable.push({ id: uid(), day: Number(day), slot: Number(slot), subjectId, room });
        store.save(); haptic('success'); api.close(); app.refresh();
      };
      el.querySelector('[data-del]')?.addEventListener('click', () => { s.timetable = s.timetable.filter((x) => x.id !== id); store.save(); api.close(); app.refresh(); });
    },
  });
}

function subjectsSheet() {
  const s = store.state;
  const render = () => `<h3 class="sheet-title">Fächer</h3>
    <div class="list">${s.subjects.map((x) => `<div class="row"><span class="dot" style="background:${x.color};width:14px;height:14px"></span><div class="grow"><div class="t">${esc(x.name)}</div></div><button class="nav-btn" data-del="${x.id}" style="color:var(--red)" aria-label="Löschen">${icon('trash', 'sm')}</button></div>`).join('')}</div>
    <div class="hstack"><input class="field" id="subN" placeholder="Neues Fach, z. B. Physik"><button class="btn primary" data-add style="width:54px;padding:0">${icon('plus')}</button></div>`;
  openSheet(render(), {
    onMount(el) {
      const body = el.querySelector('.sheet-body');
      const bind = () => {
        body.querySelector('[data-add]').onclick = () => {
          const n = body.querySelector('#subN').value.trim(); if (!n || !guardText(n)) return;
          s.subjects.push({ id: uid(), name: n, color: COLORS[s.subjects.length % COLORS.length] }); store.save(); haptic('success'); body.innerHTML = render(); bind();
        };
        body.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => { s.subjects = s.subjects.filter((x) => x.id !== b.dataset.del); store.save(); body.innerHTML = render(); bind(); });
      };
      bind();
    },
    onClose() { app.refresh(); },
  });
}

async function icsSheet() {
  const { eventsToIcs, icsToEvents, download } = await import('../util.js');
  openSheet(`<h3 class="sheet-title">Apple Kalender</h3>
    <div class="list">
      <button class="row tap" data-exp style="width:100%;text-align:left"><div class="icon-tile" style="background:var(--blue)">${icon('upload')}</div><div class="grow"><div class="t">Exportieren (.ics)</div><div class="s">Datei teilen und in Kalender öffnen</div></div></button>
      <label class="row tap" style="width:100%"><div class="icon-tile" style="background:var(--green)">${icon('download')}</div><div class="grow"><div class="t">Importieren (.ics)</div><div class="s">z. B. Stundenplan oder Ferien</div></div><input type="file" accept=".ics,text/calendar" id="icsIn" hidden></label>
    </div>
    <p class="list-f">Export: In der geteilten Datei auf „Zum Kalender hinzufügen“ tippen. Import: .ics-Datei aus „Dateien“ wählen.</p>`, {
    onMount(el, api) {
      el.querySelector('[data-exp]').onclick = () => download(`nur-kalender-${ymd()}.ics`, eventsToIcs(store.state.events), 'text/calendar');
      el.querySelector('#icsIn').onchange = async (e) => {
        const f = e.target.files[0]; if (!f) return;
        const evs = icsToEvents(await f.text()).filter((x) => guardText(x.title) || false);
        store.state.events.push(...evs); store.save(); api.close(); app.refresh(); toast(`${icon('check')} ${evs.length} Einträge importiert`, 'ok');
      };
    },
  });
}
