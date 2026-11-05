import { store } from '../store.js';
import { app, navbar } from '../core.js';
import { esc, ymd, uid, addDays, WD, habitStats, habitDone, habitValue, isScheduled, todayHabitProgress, onVacation, parseYmd, levelFromXp, LEVEL_NAMES } from '../util.js';
import { icon, haptic, chime, openSheet, confirmSheet, guardText, confetti, ring, segmented, bindSegmented, toast } from '../ui.js';
import { EMOJIS, COLORS, CATEGORIES } from '../content.js';
import { PRAYERS } from '../prayer.js';

let filter = 'Alle';

export function habitRow(s, h, ds = ymd()) {
  const v = habitValue(s, h, ds); const done = habitDone(s, h, ds);
  const pct = h.type === 'bool' ? (done ? 1 : 0) : Math.min(1, v / (h.target || 1));
  const st = habitStats(s, h);
  const unit = h.type === 'duration' ? 'min' : (h.unit || '');
  const after = h.afterPrayer ? `<span>nach ${PRAYERS.find((p) => p.key === h.afterPrayer)?.name || ''}</span>` : '';
  let control;
  if (h.type === 'count') {
    control = `<div class="counter"><button data-dec="${h.id}" aria-label="Weniger">${icon('minus', 'sm')}</button>
      <button class="chk ${done ? 'on' : pct > 0 ? 'partial' : ''}" style="--c:${h.color}" data-check="${h.id}" aria-label="Mehr">${done ? icon('check') : `<span class="tiny bold" style="color:var(--label)">${v}</span>`}</button></div>`;
  } else if (h.type === 'duration') {
    control = `<button class="chk ${done ? 'on' : pct > 0 ? 'partial' : ''}" style="--c:${h.color}" data-check="${h.id}" aria-label="Zeit eintragen">${done ? icon('check') : icon('plus', 'xs')}</button>`;
  } else {
    control = `<button class="chk ${done ? 'on' : ''}" style="--c:${h.color}" data-check="${h.id}" aria-label="Abhaken">${icon('check')}</button>`;
  }
  return `<div class="habit ${done ? 'done' : ''}" data-habit="${h.id}">
    <div class="fillbar" style="--c:${h.color};width:${pct * 100}%"></div>
    <div class="emo">${esc(h.emoji)}</div>
    <div class="grow" style="flex:1;min-width:0" data-open="${h.id}">
      <div class="name">${esc(h.name)}</div>
      <div class="meta">${st.current > 0 ? `<span style="color:var(--orange)">${icon('flame', 'xs')} ${st.current}</span>` : ''}
        ${h.type !== 'bool' ? `<span>${v} / ${h.target} ${esc(unit)}</span>` : `<span>${esc(h.category)}</span>`}${after}</div>
    </div>${control}</div>`;
}

export function toggleHabit(id, delta = null, ds = ymd()) {
  const s = store.state; const h = s.habits.find((x) => x.id === id); if (!h) return;
  const wasDone = habitDone(s, h, ds);
  const before = todayHabitProgress(s);
  s.habitLog[ds] = s.habitLog[ds] || {};
  const v = s.habitLog[ds][id] || 0;
  if (h.type === 'bool') s.habitLog[ds][id] = v ? 0 : 1;
  else s.habitLog[ds][id] = Math.max(0, v + (delta ?? 1));
  if (!s.habitLog[ds][id]) delete s.habitLog[ds][id];
  const nowDone = habitDone(s, h, ds);
  if (!wasDone && nowDone) { app.addXp(10); haptic('success'); chime('done'); }
  else if (wasDone && !nowDone) { app.addXp(-10); haptic(); }
  else haptic();
  store.save();
  const after = todayHabitProgress(s);
  if (ds === ymd() && after.total > 0 && after.done === after.total && before.done < before.total) {
    setTimeout(() => { confetti(); toast(`${icon('sparkles')} Alle Habits für heute erledigt!`, 'ok'); }, 250);
  }
  return !wasDone && nowDone;
}

export function bindHabitList(root) {
  root.querySelectorAll('[data-check]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const h = store.state.habits.find((x) => x.id === b.dataset.check);
    if (h?.type === 'duration') return durationSheet(h);
    const became = toggleHabit(b.dataset.check);
    app.refresh();
    const nb = document.querySelector(`.view.active [data-check="${b.dataset.check}"]`);
    if (nb && became !== undefined) nb.classList.add('pop');
  }));
  root.querySelectorAll('[data-dec]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); toggleHabit(b.dataset.dec, -1); app.refresh(); }));
  root.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => statsSheet(b.dataset.open)));
}

function durationSheet(h) {
  const v = habitValue(store.state, h, ymd());
  openSheet(`<h3 class="sheet-title">${esc(h.emoji)} ${esc(h.name)}</h3>
    <p class="center muted">${v} von ${h.target} min heute</p>
    <div class="grid3 mt16">${[5, 10, 15, 20, 30, 45].map((m) => `<button class="btn" data-add="${m}">+${m}</button>`).join('')}</div>
    <div class="stack gap8 mt16">
      <button class="btn primary block" data-focus>${icon('timer')} Mit Fokus-Timer starten</button>
      ${v ? '<button class="btn danger block" data-reset>Heute zurücksetzen</button>' : ''}
    </div>`, {
    onMount(el, api) {
      el.querySelectorAll('[data-add]').forEach((b) => b.onclick = () => { toggleHabit(h.id, Number(b.dataset.add)); api.close(); app.refresh(); });
      el.querySelector('[data-focus]').onclick = () => { api.close(); app.go('focus', { habitId: h.id, minutes: Math.max(5, h.target - v), label: h.name }); };
      el.querySelector('[data-reset]')?.addEventListener('click', () => { toggleHabit(h.id, -v); api.close(); app.refresh(); });
    },
  });
}

export function editHabit(id = null) {
  const s = store.state;
  const h = id ? { ...s.habits.find((x) => x.id === id) } : { name: '', emoji: '📖', category: 'Deen', color: COLORS[0], type: 'bool', target: 1, unit: '', days: [], afterPrayer: '' };
  const html = `<div class="sheet-nav"><button data-close>Abbrechen</button><span class="ttl">${id ? 'Habit bearbeiten' : 'Neues Habit'}</span><button class="b" data-save>Fertig</button></div>
    <div class="center" style="font-size:54px;margin:4px 0" id="hePreview">${esc(h.emoji)}</div>
    <input class="field" id="heName" placeholder="Name, z. B. 10 Seiten lesen" value="${esc(h.name)}" maxlength="40">
    <label class="lbl">Emoji</label>
    <div class="emoji-grid no-drag" id="heEmoji">${EMOJIS.map((e) => `<button class="${e === h.emoji ? 'on' : ''}">${e}</button>`).join('')}</div>
    <input class="field mt8" id="heEmojiCustom" placeholder="Eigenes Emoji eingeben" maxlength="4">
    <label class="lbl">Kategorie</label>
    <div class="chips no-drag" id="heCat">${CATEGORIES.map((c) => `<button class="chip ${c === h.category ? 'on' : ''}">${c}</button>`).join('')}</div>
    <label class="lbl">Farbe</label>
    <div class="color-row" id="heColor">${COLORS.map((c) => `<button style="background:${c};color:${c}" class="${c === h.color ? 'on' : ''}" data-c="${c}"></button>`).join('')}</div>
    <label class="lbl">Ziel-Art</label>
    ${segmented('heType', [['bool', 'Ja / Nein'], ['count', 'Anzahl'], ['duration', 'Dauer']], h.type)}
    <div id="heTarget" class="grid2 mt8" style="${h.type === 'bool' ? 'display:none' : ''}">
      <input class="field" type="number" inputmode="numeric" id="heTargetV" value="${h.target || 1}" min="1">
      <input class="field" id="heUnit" placeholder="${h.type === 'duration' ? 'min' : 'Einheit (Gläser)'}" value="${esc(h.unit || '')}" ${h.type === 'duration' ? 'disabled' : ''}>
    </div>
    <label class="lbl">Tage (leer = jeden Tag)</label>
    <div class="days-row" id="heDays">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button data-d="${d}" class="${h.days.includes(d) ? 'on' : ''}">${WD[d]}</button>`).join('')}</div>
    <label class="lbl">An Gebet koppeln</label>
    <div class="chips no-drag" id="hePrayer"><button class="chip ${!h.afterPrayer ? 'on' : ''}" data-p="">Keins</button>${PRAYERS.map((p) => `<button class="chip ${h.afterPrayer === p.key ? 'on' : ''}" data-p="${p.key}">nach ${p.name}</button>`).join('')}</div>
    ${id ? '<button class="btn danger block mt24" data-del>Habit löschen</button>' : ''}`;
  openSheet(html, {
    tall: true,
    onMount(el, api) {
      const q = (sel) => el.querySelector(sel);
      q('#heEmoji').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; h.emoji = b.textContent; el.querySelectorAll('#heEmoji button').forEach((x) => x.classList.toggle('on', x === b)); q('#hePreview').textContent = h.emoji; haptic(); };
      q('#heEmojiCustom').oninput = (e) => { if (e.target.value.trim()) { h.emoji = e.target.value.trim(); q('#hePreview').textContent = h.emoji; } };
      q('#heCat').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; h.category = b.textContent; el.querySelectorAll('#heCat .chip').forEach((x) => x.classList.toggle('on', x === b)); haptic(); };
      q('#heColor').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; h.color = b.dataset.c; el.querySelectorAll('#heColor button').forEach((x) => x.classList.toggle('on', x === b)); haptic(); };
      q('#heDays').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; b.classList.toggle('on'); haptic(); };
      q('#hePrayer').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; h.afterPrayer = b.dataset.p; el.querySelectorAll('#hePrayer .chip').forEach((x) => x.classList.toggle('on', x === b)); haptic(); };
      bindSegmented(el, 'heType', (v) => {
        h.type = v; q('#heTarget').style.display = v === 'bool' ? 'none' : '';
        const u = q('#heUnit'); u.disabled = v === 'duration'; u.placeholder = v === 'duration' ? 'min' : 'Einheit (Gläser)';
        if (v === 'duration' && Number(q('#heTargetV').value) < 5) q('#heTargetV').value = 20;
      });
      q('[data-save]').onclick = () => {
        h.name = q('#heName').value.trim();
        if (!h.name) { q('#heName').focus(); return toast(`${icon('info')} Gib dem Habit einen Namen`); }
        h.unit = q('#heUnit').value.trim();
        if (!guardText(h.name, h.unit, h.emoji)) return;
        h.target = h.type === 'bool' ? 1 : Math.max(1, parseInt(q('#heTargetV').value, 10) || 1);
        h.days = [...el.querySelectorAll('#heDays button.on')].map((b) => Number(b.dataset.d));
        if (h.days.length === 7) h.days = [];
        if (id) Object.assign(s.habits.find((x) => x.id === id), h);
        else s.habits.push({ ...h, id: uid(), createdAt: Date.now(), archived: false });
        store.save(); haptic('success'); api.close(); app.refresh();
      };
      q('[data-del]')?.addEventListener('click', async () => {
        if (await confirmSheet('Habit löschen?', 'Alle Einträge und Streaks dieses Habits gehen verloren.')) {
          s.habits = s.habits.filter((x) => x.id !== id); store.save(); api.close(); app.refresh();
        }
      });
    },
  });
}

export function statsSheet(id) {
  const s = store.state; const h = s.habits.find((x) => x.id === id); if (!h) return;
  const render = () => {
    const st = habitStats(s, h);
    const today = new Date();
    const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    const heat = [];
    const start = addDays(today, -7 * 26 + 1);
    for (let i = 0; i < 7 * 26; i++) {
      const d = addDays(start, i); const ds = ymd(d);
      const v = habitValue(s, h, ds); const p = h.type === 'bool' ? (v ? 1 : 0) : Math.min(1, v / h.target);
      heat.push(`<i style="${p ? `background:${h.color};opacity:${0.35 + p * 0.65}` : ''}" title="${ds}"></i>`);
    }
    return `<div class="sheet-nav"><button data-close>Schließen</button><span class="ttl"></span><button data-edit>Bearbeiten</button></div>
      <div class="center"><div style="font-size:52px">${esc(h.emoji)}</div><h3 class="sheet-title" style="margin-top:0">${esc(h.name)}</h3>
      <span class="pill">${esc(h.category)}</span></div>
      <div class="grid2 mt16">
        <div class="card mb0" style="background:var(--card2)"><div class="card-t">${icon('flame', 'xs')} Streak</div><div class="big-num" style="color:var(--orange)">${st.current}</div><div class="small muted">Beste: ${st.best} Tage</div></div>
        <div class="card mb0" style="background:var(--card2)"><div class="card-t">${icon('star', 'xs')} Score</div><div class="big-num" style="color:${h.color}">${st.score}</div><div class="small muted">Gewohnheits-Stärke</div></div>
      </div>
      <div class="grid3 mt12">
        ${[['7 Tage', st.w], ['30 Tage', st.m], ['Jahr', st.y]].map(([l, r]) => `<div class="card mb0 center" style="background:var(--card2);padding:12px 6px">
          ${ring(r.pct / 100, 58, 6, h.color, `<span class="small bold">${r.pct}%</span>`)}<div class="small muted mt8">${l}</div><div class="tiny faint">${r.done}/${r.sched}</div></div>`).join('').replace(/<div class="ring"/g, '<div style="margin:0 auto" class="ring"')}
      </div>
      <div class="card mt12" style="background:var(--card2)"><div class="card-h"><span class="card-t">Letzte 7 Tage</span><span class="tiny muted">Tippen zum Nachtragen</span></div>
        <div class="week-dots" style="--c:${h.color}">${week.map((d) => {
          const ds = ymd(d); const done = habitDone(s, h, ds); const sch = isScheduled(h, d) && !onVacation(s, ds);
          return `<button class="wd" data-day="${ds}">${WD[d.getDay()]}<i class="${done ? 'on' : ''}" style="${!sch ? 'opacity:.35' : ''}">${d.getDate()}</i></button>`;
        }).join('')}</div></div>
      <div class="card" style="background:var(--card2)"><div class="card-t" style="margin-bottom:10px">Letzte 26 Wochen</div><div class="heat">${heat.join('')}</div></div>
      <div class="card" style="background:var(--card2)"><div class="hstack">${icon('shield')}<div class="grow" style="flex:1"><div class="bold">Anti-Frust-Schutz</div>
        <div class="small muted">${st.jokers} Joker verfügbar. Pro 7 erledigten Tagen bekommst du einen Joker (max. 2). Ein verpasster Tag kostet dann nur einen Joker, nicht die Streak.</div></div></div></div>
      <div class="small muted center">Insgesamt ${st.total}× erledigt</div>
      <button class="btn block mt16" data-archive>${h.archived ? 'Wiederherstellen' : 'Archivieren'}</button>`;
  };
  openSheet(render(), {
    tall: true,
    onMount(el, api) {
      const bind = () => {
        const hm = el.querySelector('.heat'); if (hm) hm.scrollLeft = hm.scrollWidth;
        el.querySelector('[data-edit]').onclick = () => { api.close(); setTimeout(() => editHabit(id), 200); };
        el.querySelector('[data-archive]').onclick = () => { h.archived = !h.archived; store.save(); api.close(); app.refresh(); };
        el.querySelectorAll('[data-day]').forEach((b) => b.onclick = () => {
          const ds = b.dataset.day;
          if (h.type === 'bool') toggleHabit(id, null, ds);
          else { const v = habitValue(s, h, ds); toggleHabit(id, habitDone(s, h, ds) ? -v : h.target - v, ds); }
          el.querySelector('.sheet-body').innerHTML = render(); bind(); app.refresh();
        });
      };
      bind();
    },
  });
}

function vacationSheet() {
  const s = store.state; const today = ymd();
  const active = s.vacation.find((v) => today >= v.from && today <= v.to);
  openSheet(`<h3 class="sheet-title">Pause-Modus</h3>
    <p class="muted center small">Krank, Urlaub oder Prüfungsphase? Im Pause-Modus zählen Tage nicht gegen deine Streaks.</p>
    ${active ? `<div class="card center" style="background:var(--card2)">Aktiv bis <b>${parseYmd(active.to).toLocaleDateString('de-DE')}</b></div>
      <button class="btn danger block" data-end>Pause beenden</button>` : `
    <label class="lbl">Von</label><input class="field" type="date" id="vFrom" value="${today}">
    <label class="lbl">Bis</label><input class="field" type="date" id="vTo" value="${ymd(addDays(new Date(), 3))}">
    <button class="btn primary block mt16" data-start>Pause starten</button>`}`, {
    onMount(el, api) {
      el.querySelector('[data-start]')?.addEventListener('click', () => {
        const from = el.querySelector('#vFrom').value, to = el.querySelector('#vTo').value;
        if (!from || !to || to < from) return toast(`${icon('info')} Prüfe die Daten`);
        s.vacation.push({ from, to }); store.save(); api.close(); app.refresh(); toast(`${icon('check')} Pause aktiv`, 'ok');
      });
      el.querySelector('[data-end]')?.addEventListener('click', () => {
        active.to = ymd(addDays(new Date(), -1)); if (active.to < active.from) s.vacation = s.vacation.filter((v) => v !== active);
        store.save(); api.close(); app.refresh();
      });
    },
  });
}

app.register({
  id: 'habits',
  render(s) {
    const today = new Date(); const ds = ymd(today);
    const all = s.habits.filter((h) => !h.archived);
    const cats = ['Alle', ...new Set(all.map((h) => h.category))];
    if (!cats.includes(filter)) filter = 'Alle';
    const list = all.filter((h) => filter === 'Alle' || h.category === filter);
    const todayList = list.filter((h) => isScheduled(h, today));
    const other = list.filter((h) => !isScheduled(h, today));
    const prog = todayHabitProgress(s);
    const lv = levelFromXp(s.xp);
    const archived = s.habits.filter((h) => h.archived);
    const vac = onVacation(s, ds);
    return `${navbar('Habits', `<button class="nav-btn" data-add aria-label="Neues Habit">${icon('plus')}</button>`)}
      <div class="subtitle">${prog.done} von ${prog.total} heute erledigt${vac ? ' · Pause aktiv' : ''}</div>
      <div class="card glass hstack" style="gap:16px">
        ${ring(prog.pct, 78, 9, 'var(--green)', `<span class="bold">${Math.round(prog.pct * 100)}%</span>`)}
        <div style="flex:1;min-width:0">
          <div class="hstack between"><span class="bold">Level ${lv.level} · ${LEVEL_NAMES[Math.min(lv.level - 1, LEVEL_NAMES.length - 1)]}</span><span class="small muted tabular">${s.xp} XP</span></div>
          <div class="xp-bar mt8"><i style="width:${lv.progress * 100}%"></i></div>
          <div class="tiny muted mt8">Noch ${lv.toNext} XP bis Level ${lv.level + 1}</div>
        </div>
      </div>
      ${cats.length > 2 ? `<div class="chips" id="hCats">${cats.map((c) => `<button class="chip ${c === filter ? 'on' : ''}">${esc(c)}</button>`).join('')}</div>` : ''}
      ${all.length === 0 ? `<div class="empty"><div class="emo">🌱</div><div class="bold" style="color:var(--label)">Starte dein erstes Habit</div>
        <div class="small mt8">Kleine Gewohnheiten, jeden Tag. Die Streak macht den Rest.</div><button class="btn primary mt16" data-add>${icon('plus')} Habit erstellen</button></div>` : ''}
      <div class="stagger">${todayList.map((h) => habitRow(s, h, ds)).join('')}</div>
      ${other.length ? `<div class="list-h">Heute nicht geplant</div><div style="opacity:.6">${other.map((h) => habitRow(s, h, ds)).join('')}</div>` : ''}
      <div class="list mt16">
        <button class="row tap" data-vac style="width:100%;text-align:left"><div class="icon-tile" style="background:var(--orange)">${icon('sun')}</div><div class="grow"><div class="t">Pause-Modus</div><div class="s">${vac ? 'Aktiv – Streaks sind geschützt' : 'Urlaub, krank, Prüfungsphase'}</div></div>${icon('right', 'chev')}</button>
        <button class="row tap" data-templates style="width:100%;text-align:left"><div class="icon-tile" style="background:var(--purple)">${icon('sparkles')}</div><div class="grow"><div class="t">Vorlagen</div><div class="s">Bewährte Habits mit einem Tipp</div></div>${icon('right', 'chev')}</button>
      </div>
      ${archived.length ? `<div class="list-h">Archiviert</div><div class="list">${archived.map((h) => `<button class="row tap" data-open="${h.id}" style="width:100%;text-align:left"><span style="font-size:22px">${esc(h.emoji)}</span><div class="grow"><div class="t">${esc(h.name)}</div></div>${icon('right', 'chev')}</button>`).join('')}</div>` : ''}`;
  },
  mount(root) {
    root.querySelectorAll('[data-add]').forEach((b) => b.onclick = () => editHabit());
    root.querySelector('#hCats')?.addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (!b) return; filter = b.textContent; haptic(); app.refresh(); });
    root.querySelector('[data-vac]').onclick = vacationSheet;
    root.querySelector('[data-templates]').onclick = templatesSheet;
    bindHabitList(root);
  },
});

const TEMPLATES = [
  ['📖', 'Koran lesen', 'Deen', 'duration', 10, '', 'fajr'], ['📿', 'Morgen-Adhkar', 'Deen', 'bool', 1, '', 'fajr'], ['🌙', 'Abend-Adhkar', 'Deen', 'bool', 1, '', 'asr'],
  ['💧', 'Wasser trinken', 'Gesundheit', 'count', 8, 'Gläser', ''], ['🏃', 'Sport', 'Fitness', 'duration', 30, '', ''], ['📚', 'Lernen', 'Schule', 'duration', 45, '', ''],
  ['📵', 'Kein Handy nach Isha', 'Mindset', 'bool', 1, '', 'isha'], ['😴', 'Vor 23 Uhr schlafen', 'Gesundheit', 'bool', 1, '', ''], ['🚶', '8000 Schritte', 'Fitness', 'bool', 1, '', ''],
  ['✍️', 'Tagebuch', 'Mindset', 'bool', 1, '', ''], ['🤲', 'Dua machen', 'Deen', 'bool', 1, '', 'maghrib'], ['🧘', 'Atmen / Ruhe', 'Mindset', 'duration', 5, '', ''],
];
function templatesSheet() {
  const s = store.state;
  openSheet(`<h3 class="sheet-title">Vorlagen</h3><div class="list">${TEMPLATES.map((t, i) => {
    const has = s.habits.some((h) => h.name === t[1]);
    return `<div class="row"><span style="font-size:24px">${t[0]}</span><div class="grow"><div class="t">${t[1]}</div><div class="s">${t[2]}${t[3] !== 'bool' ? ` · Ziel ${t[4]} ${t[3] === 'duration' ? 'min' : t[5]}` : ''}</div></div>
      <button class="btn sm ${has ? 'ghost' : ''}" data-t="${i}" ${has ? 'disabled' : ''}>${has ? icon('check', 'sm') : 'Hinzufügen'}</button></div>`;
  }).join('')}</div>`, {
    tall: true,
    onMount(el) {
      el.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => {
        const t = TEMPLATES[Number(b.dataset.t)];
        s.habits.push({ id: uid(), emoji: t[0], name: t[1], category: t[2], type: t[3], target: t[4], unit: t[5], afterPrayer: t[6], days: [], color: COLORS[s.habits.length % COLORS.length], createdAt: Date.now(), archived: false });
        store.save(); haptic('success'); b.innerHTML = icon('check', 'sm'); b.classList.add('ghost'); b.disabled = true; app.refresh();
      });
    },
  });
}
