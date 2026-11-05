// UI primitives: icons, haptics, bottom sheets, toasts, confetti, rings.
import { store } from './store.js';
import { esc, isBlockedText } from './util.js';

const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  checks: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="m8 12.3 2.8 2.7L16 9.5"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 2.5h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  right: '<path d="m9 5 7 7-7 7"/>', left: '<path d="m15 5-7 7 7 7"/>', down: '<path d="m5 9 7 7 7-7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  flame: '<path d="M12 3c1 4 5 5.5 5 10.5A5 5 0 0 1 12 19a5 5 0 0 1-5-5.5c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-6 1-9z"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9z"/>',
  shield: '<path d="M12 3 5 6v5.5c0 4.5 3 8 7 9.5 4-1.5 7-5 7-9.5V6z"/><path d="m9 12 2 2 4-4"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  sunrise: '<path d="M12 3v6M8.5 6.5 12 3l3.5 3.5M4 18h16M2 22h20M6 18a6 6 0 0 1 12 0M4.2 12.2l1.4 1.4M18.4 13.6l1.4-1.4"/>',
  sunset: '<path d="M12 9V3M8.5 5.5 12 9l3.5-3.5M4 18h16M2 22h20M6 18a6 6 0 0 1 12 0M4.2 12.2l1.4 1.4M18.4 13.6l1.4-1.4"/>',
  'sun-low': '<circle cx="12" cy="15" r="4"/><path d="M12 6v2M4 15H2M22 15h-2M5.6 8.6 7 10M17 10l1.4-1.4M2 21h20"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="3"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  download: '<path d="M12 3v12M8 11l4 4 4-4M5 21h14"/>',
  upload: '<path d="M12 15V3M8 7l4-4 4 4M5 21h14"/>',
  play: '<path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/>',
  stop: '<rect x="5.5" y="5.5" width="13" height="13" rx="3" fill="currentColor" stroke="none"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  sparkles: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  heart: '<path d="M12 20s-7.5-4.5-9-9.5A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 9 4.5c-1.5 5-9 9.5-9 9.5z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  alert: '<path d="M12 3 2 20h20zM12 10v4M12 17v.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  pin: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  minus: '<path d="M5 12h14"/>',
  mosque: '<path d="M12 3c-1.5 2-4 3-4 6h8c0-3-2.5-4-4-6zM6 21V12h12v9M10 21v-4a2 2 0 0 1 4 0v4M3 21V10M21 21V10M2 21h20"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  face: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M9 9v1M15 9v1M12 9v4h-1M9 16a4 4 0 0 0 6 0"/>',
  phone: '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M11 18.5h2"/>',
};
export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.info}</svg>`;
}

// ---------- Haptics ----------
// iOS Safari 17.4+: toggling a native <input switch> produces a real haptic tick.
let hapticLabel = null;
export function haptic(kind = 'light') {
  if (!store.state.settings.haptics) return;
  try {
    if (navigator.vibrate) { navigator.vibrate(kind === 'success' ? [12, 40, 18] : kind === 'heavy' ? 25 : 8); return; }
    if (!hapticLabel) {
      hapticLabel = document.createElement('label');
      hapticLabel.style.cssText = 'position:fixed;left:-100px;top:-100px;opacity:0;pointer-events:none';
      const input = document.createElement('input');
      input.type = 'checkbox'; input.setAttribute('switch', '');
      hapticLabel.appendChild(input); document.body.appendChild(hapticLabel);
    }
    hapticLabel.click();
    if (kind === 'success') setTimeout(() => hapticLabel.click(), 90);
  } catch {}
}

// ---------- Tiny synth sounds (Web Audio, no files) ----------
let actx = null;
export function audioCtx() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
export function chime(type = 'tick') {
  if (!store.state.settings.sounds) return;
  try {
    const ctx = audioCtx();
    const notes = type === 'done' ? [880, 1174.7, 1568] : type === 'end' ? [659.3, 880, 1318.5] : [1320];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t0 = ctx.currentTime + i * 0.09;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(type === 'tick' ? 0.04 : 0.12, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (type === 'tick' ? 0.08 : 0.9));
      o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + 1);
    });
  } catch {}
}

// ---------- Toast ----------
export function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = msg;
  document.getElementById('toasts').appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 400); }, 2600);
}

// ---------- Bottom sheet with drag-to-dismiss ----------
let sheetStack = [];
export function openSheet(html, { onMount, onClose, tall = false, cls = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet ${tall ? 'tall' : ''} ${cls}" role="dialog" aria-modal="true"><div class="grabber"></div><div class="sheet-body">${html}</div></div>`;
  document.getElementById('sheets').appendChild(wrap);
  const sheet = wrap.querySelector('.sheet');
  document.getElementById('app').classList.add('dimmed');
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  const api = {
    el: sheet,
    close() {
      wrap.classList.remove('open'); wrap.classList.add('closing');
      sheetStack = sheetStack.filter((s) => s !== api);
      if (!sheetStack.length) document.getElementById('app').classList.remove('dimmed');
      setTimeout(() => wrap.remove(), 420);
      onClose?.();
    },
  };
  sheetStack.push(api);
  wrap.querySelector('.sheet-backdrop').addEventListener('click', () => api.close());
  sheet.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) api.close(); });
  // drag to dismiss
  let y0 = null, dy = 0;
  const body = sheet.querySelector('.sheet-body');
  sheet.addEventListener('touchstart', (e) => {
    if (body.scrollTop > 0 && !e.target.closest('.grabber')) return;
    if (e.target.closest('input,textarea,select,.no-drag')) return;
    y0 = e.touches[0].clientY; dy = 0; sheet.style.transition = 'none';
  }, { passive: true });
  sheet.addEventListener('touchmove', (e) => {
    if (y0 === null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  sheet.addEventListener('touchend', () => {
    if (y0 === null) return;
    sheet.style.transition = ''; sheet.style.transform = '';
    if (dy > 110) api.close();
    y0 = null;
  });
  onMount?.(sheet, api);
  return api;
}
export function closeAllSheets() { [...sheetStack].forEach((s) => s.close()); }

export function confirmSheet(title, text, okLabel = 'Löschen', danger = true) {
  return new Promise((resolve) => {
    let answered = false;
    openSheet(`
      <h3 class="sheet-title">${esc(title)}</h3>
      <p class="muted center">${esc(text)}</p>
      <div class="stack gap8 mt16">
        <button class="btn ${danger ? 'danger' : 'primary'} block" data-ok>${esc(okLabel)}</button>
        <button class="btn ghost block" data-close>Abbrechen</button>
      </div>`, {
      onMount(el, api) { el.querySelector('[data-ok]').onclick = () => { answered = true; resolve(true); api.close(); }; },
      onClose() { if (!answered) resolve(false); },
    });
  });
}

// Guard every free text the user saves.
export function guardText(...texts) {
  if (texts.some((t) => isBlockedText(t))) {
    haptic('heavy');
    toast(`${icon('shield')} Inhalt blockiert. Bleib bei dem, was dir guttut.`, 'warn');
    return false;
  }
  return true;
}

// ---------- Confetti (canvas) ----------
export function confetti(x = innerWidth / 2, y = innerHeight / 3) {
  const c = document.createElement('canvas');
  c.className = 'confetti'; c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio;
  document.body.appendChild(c);
  const ctx = c.getContext('2d'); ctx.scale(devicePixelRatio, devicePixelRatio);
  const colors = ['#0A84FF', '#30D158', '#FFD60A', '#FF9F0A', '#BF5AF2', '#FF375F', '#64D2FF'];
  const parts = Array.from({ length: 90 }, () => ({
    x, y, vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 13 - 4, r: Math.random() * 6 + 3,
    c: colors[(Math.random() * colors.length) | 0], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, life: 0,
  }));
  let frame = 0;
  (function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts.forEach((p) => {
      p.vy += 0.38; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life++;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.max(0, 1 - p.life / 110);
      ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore();
    });
    if (++frame < 120) requestAnimationFrame(tick); else c.remove();
  })();
}

// ---------- Progress ring SVG ----------
export function ring(pct, size = 64, stroke = 7, color = 'var(--blue)', inner = '') {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--fill3)" stroke-width="${stroke}"/>
      <circle class="ring-val" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${c}" stroke-dashoffset="${off}" style="--c:${c};--off:${off}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg><div class="ring-in">${inner}</div></div>`;
}

export function segmented(name, options, value) {
  return `<div class="seg" data-seg="${name}">${options.map(([v, l]) =>
    `<button type="button" class="${String(v) === String(value) ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>`;
}
export function bindSegmented(root, name, cb) {
  const seg = root.querySelector(`[data-seg="${name}"]`);
  if (!seg) return;
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    haptic(); cb(b.dataset.v);
  });
}

export function toggle(name, on) {
  return `<label class="tgl"><input type="checkbox" data-tgl="${name}" ${on ? 'checked' : ''}><span></span></label>`;
}

// Press feedback for any element with .press (spring scale)
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('.press, .btn, .card.tap, .row.tap, .tabbar button');
  if (!el) return;
  el.classList.add('pressed');
  const up = () => { el.classList.remove('pressed'); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
}, { passive: true });
