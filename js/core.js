// Shared app controller used by all views.
import { store } from './store.js';
import { ymd, esc } from './util.js';
import { icon, toast } from './ui.js';

export const app = {
  views: {},
  current: 'today',
  register(v) { this.views[v.id] = v; },
  el(id) { return document.getElementById(`view-${id}`); },
  render(id = this.current) {
    const v = this.views[id]; const root = this.el(id);
    if (!v || !root) return;
    const scroll = root.scrollTop;
    root.innerHTML = v.render(store.state);
    v.mount?.(root, store.state);
    root.scrollTop = scroll;
    tickCountdowns();
  },
  refresh() { this.render(this.current); this.onRefresh?.(); },
  go(id, opts = {}) {
    if (!this.views[id]) return;
    const prev = this.current; this.current = id;
    document.querySelectorAll('.view').forEach((el) => el.classList.toggle('active', el.id === `view-${id}`));
    document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === id));
    this.render(id);
    if (opts.top || prev === id) this.el(id).scrollTo({ top: 0, behavior: prev === id ? 'smooth' : 'auto' });
    this.views[id].onShow?.(opts);
    try { history.replaceState(null, '', id === 'today' ? location.pathname : `?tab=${id}`); } catch {}
  },
  addXp(n) {
    store.state.xp = Math.max(0, (store.state.xp || 0) + n);
    const d = ymd(); store.state.xpLog[d] = Math.max(0, (store.state.xpLog[d] || 0) + n);
  },
};

export function navbar(title, actions = '', { back = false, smallOnly = false } = {}) {
  return `<div class="navbar">
    ${back ? `<button class="nav-btn" data-back aria-label="Zurück">${icon('left', 'sm')}</button>` : ''}
    <div class="small-title">${esc(title)}</div>
    <div class="nav-actions">${actions}</div>
  </div>${smallOnly ? '' : `<h1 class="large-title">${esc(title)}</h1>`}`;
}

// Live countdowns: any element with data-until="<ms timestamp>"
import { fmtCountdown } from './util.js';
export function tickCountdowns() {
  const now = Date.now();
  document.querySelectorAll('[data-until]').forEach((el) => {
    const t = Number(el.dataset.until);
    const left = t - now;
    if (left <= 0 && !el.dataset.fired) { el.dataset.fired = '1'; setTimeout(() => app.refresh(), 1200); }
    el.textContent = (el.dataset.prefix || '') + fmtCountdown(left);
  });
}

export function bindScrollTitle(root) {
  const on = () => root.classList.toggle('scrolled', root.scrollTop > 34);
  root.addEventListener('scroll', on, { passive: true }); on();
}

export function notify(title, body, tag) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return toast(`${icon('bell')} ${esc(title)}`);
    navigator.serviceWorker?.ready.then((reg) => reg.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' }))
      .catch(() => new Notification(title, { body }));
  } catch { toast(`${icon('bell')} ${esc(title)}`); }
}
