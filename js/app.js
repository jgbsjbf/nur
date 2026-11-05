// Entry point: boot, routing, background tasks, service worker with auto-update.
import { store } from './store.js';
import { app, bindScrollTitle, tickCountdowns } from './core.js';
import { icon, haptic, toast, closeAllSheets } from './ui.js';
import { ymd } from './util.js';
import './views/today.js';
import './views/habits.js';
import './views/deen.js';
import './views/calendar.js';
import './views/focus.js';
import { resumeIfRunning, startFocus } from './views/focus.js';
import { schedulePrayerNotifications, updateBadge } from './views/settings.js';
import { showLockScreen } from './lock.js';

const TABS = [['today', 'Heute', 'home'], ['habits', 'Habits', 'checks'], ['deen', 'Deen', 'moon'], ['calendar', 'Kalender', 'calendar'], ['focus', 'Fokus', 'timer']];

function shell() {
  document.getElementById('app').innerHTML = `<div class="views">${TABS.map(([id]) => `<section class="view" id="view-${id}" aria-label="${id}"></section>`).join('')}</div>
    <nav class="tabbar" aria-label="Navigation">${TABS.map(([id, label, ic]) => `<button data-tab="${id}" aria-label="${label}">${icon(ic)}<span>${label}</span></button>`).join('')}</nav>`;
  document.querySelectorAll('.view').forEach(bindScrollTitle);
  document.querySelector('.tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    haptic(); app.go(b.dataset.tab);
  });
}

let lastDay = ymd();
function heartbeat() {
  tickCountdowns();
  if (ymd() !== lastDay) { lastDay = ymd(); app.refresh(); schedulePrayerNotifications(); }
}

app.onRefresh = () => updateBadge();

async function boot() {
  await store.init();
  shell();
  document.body.classList.add('ready');
  if (!store.state.onboarded) { const { runOnboarding } = await import('./onboarding.js'); await runOnboarding(); }
  else await showLockScreen();

  const q = new URLSearchParams(location.search);
  const tab = q.get('tab');
  app.go(TABS.some((t) => t[0] === tab) ? tab : 'today', { top: true });
  if (q.get('focus')) startFocus({ minutes: Math.min(240, Math.max(1, parseInt(q.get('focus'), 10) || 25)) });
  if (q.get('sos')) import('./views/today.js').then((m) => m.sosSheet());
  resumeIfRunning();
  schedulePrayerNotifications(); updateBadge();
  setInterval(heartbeat, 1000);

  // Re-lock and refresh after returning from background
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (store.state.settings.lock.type !== 'none' && Date.now() - hiddenAt > 60000) { closeAllSheets(); await showLockScreen(); }
    app.refresh(); schedulePrayerNotifications();
  });
}

// ---------- Service worker: offline + silent auto-update ----------
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
      const check = () => reg.update().catch(() => {});
      setInterval(check, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) nw.postMessage('skipWaiting');
        });
      });
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return; reloading = true;
        if (store.state.focus.running || document.querySelector('.sheet-wrap')) {
          toast(`${icon('refresh')} Update geladen – wird beim nächsten Start aktiv`);
        } else {
          store.flush().then(() => location.reload());
        }
      });
    } catch (e) { console.warn('SW registration failed', e); }
  });
}

boot();
