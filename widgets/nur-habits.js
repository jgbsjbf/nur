// Nur – Habits- und Termine-Widget für Scriptable
// Liest die Datei "nur-widget.json" aus iCloud Drive/Scriptable.
// Die Datei erstellst du in der App: Heute → Widgets → "Widget-Daten aktualisieren".
// Größen: klein (Habits-Ring), mittel (Habits + Termine), groß, Sperrbildschirm.

const fm = FileManager.iCloud();
const path = fm.joinPath(fm.documentsDirectory(), 'nur-widget.json');
let d = null;
try { if (fm.fileExists(path)) { await fm.downloadFileFromiCloud(path); d = JSON.parse(fm.readString(path)); } } catch (e) {}

const fam = config.widgetFamily || 'medium';
const GREEN = new Color('#30D158'), DIM = new Color('#ffffff', 0.6);
const w = new ListWidget();
w.refreshAfterDate = new Date(Date.now() + 30 * 60000);
const today = new Date(); const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const stale = !d || d.date !== ymd;

function ringImage(pct, size) {
  const c = new DrawContext(); c.size = new Size(size, size); c.opaque = false; c.respectScreenScale = true;
  const lw = size * 0.13, r = size / 2 - lw / 2;
  c.setStrokeColor(new Color('#30D158', 0.22)); c.setLineWidth(lw); c.strokeEllipse(new Rect(lw / 2, lw / 2, size - lw, size - lw));
  const path = new Path(); const steps = Math.max(1, Math.round(100 * pct));
  for (let i = 0; i <= steps; i++) { const a = -Math.PI / 2 + (2 * Math.PI * i) / 100; const p = new Point(size / 2 + r * Math.cos(a), size / 2 + r * Math.sin(a)); i ? path.addLine(p) : path.move(p); }
  if (pct > 0) { c.addPath(path); c.setStrokeColor(GREEN); c.strokePath(); }
  return c.getImage();
}

if (!d) {
  const t = w.addText('Öffne Nur → Heute → Widgets → „Widget-Daten aktualisieren“ und speichere die Datei in iCloud Drive/Scriptable.');
  t.font = Font.systemFont(12); t.textColor = DIM;
} else if (fam.startsWith('accessory')) {
  const h = stale ? { done: 0, total: d.habits.total } : d.habits;
  if (fam === 'accessoryInline') w.addText(`✓ ${h.done}/${h.total} Habits`);
  else if (fam === 'accessoryCircular') { const t = w.addText(`${h.done}/${h.total}`); t.font = Font.boldSystemFont(16); t.centerAlignText(); }
  else { const a = w.addText(`Habits ${h.done}/${h.total}`); a.font = Font.boldSystemFont(14); const e = d.events[0]; if (e) { const b = w.addText(`${e.h || ''} ${e.t}`); b.font = Font.systemFont(12); } }
} else {
  const g = new LinearGradient(); g.colors = [new Color('#10331e'), new Color('#07150c')]; g.locations = [0, 1]; w.backgroundGradient = g; w.setPadding(14, 16, 14, 16);
  const h = stale ? { done: 0, total: d.habits.total, list: d.habits.list.map((x) => ({ ...x, d: false })) } : d.habits;
  const pct = h.total ? h.done / h.total : 0;
  const top = w.addStack(); top.centerAlignContent();
  const img = top.addImage(ringImage(pct, 120)); img.imageSize = new Size(fam === 'small' ? 54 : 44, fam === 'small' ? 54 : 44);
  top.addSpacer(10);
  const col = top.addStack(); col.layoutVertically();
  const l = col.addText('HABITS'); l.font = Font.semiboldSystemFont(10); l.textColor = GREEN;
  const n = col.addText(`${h.done}/${h.total}`); n.font = Font.boldSystemFont(22); n.textColor = Color.white();
  w.addSpacer(8);
  if (fam === 'small') {
    const open = h.list.filter((x) => !x.d).slice(0, 3);
    for (const x of open) { const t = w.addText(`${x.e} ${x.n}`); t.font = Font.systemFont(12); t.textColor = DIM; t.lineLimit = 1; }
    if (!open.length) { const t = w.addText('Alles erledigt ✓'); t.font = Font.mediumSystemFont(13); t.textColor = GREEN; }
  } else {
    const row = w.addStack();
    const left = row.addStack(); left.layoutVertically();
    for (const x of h.list.slice(0, fam === 'large' ? 6 : 3)) { const t = left.addText(`${x.d ? '✓' : '○'} ${x.e} ${x.n}`); t.font = Font.systemFont(12); t.textColor = x.d ? GREEN : Color.white(); t.lineLimit = 1; }
    row.addSpacer();
    const right = row.addStack(); right.layoutVertically();
    const el = right.addText('ALS NÄCHSTES'); el.font = Font.semiboldSystemFont(9); el.textColor = new Color('#BF5AF2');
    for (const e of d.events.slice(0, fam === 'large' ? 4 : 2)) { const t = right.addText(`${e.h || '•'} ${e.t}`); t.font = Font.systemFont(12); t.textColor = Color.white(); t.lineLimit = 1; }
    if (!d.events.length) { const t = right.addText('Nichts geplant'); t.font = Font.systemFont(12); t.textColor = DIM; }
  }
  w.addSpacer();
  const upd = new Date(d.updated);
  const f = w.addText(stale ? 'Neuer Tag – in Nur synchronisieren' : `Stand ${String(upd.getHours()).padStart(2, '0')}:${String(upd.getMinutes()).padStart(2, '0')} · Level ${d.level} · ${d.clean} T clean`);
  f.font = Font.systemFont(9); f.textColor = new Color('#ffffff', 0.4);
}

if (config.runsInWidget || config.runsInAccessoryWidget) Script.setWidget(w); else await w.presentMedium();
Script.complete();
