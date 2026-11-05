// App lock: PIN (SHA-256 hashed) and optional Face ID via a local passkey (WebAuthn).
import { store } from './store.js';
import { sha256 } from './util.js';
import { icon, haptic, openSheet, toast, confirmSheet } from './ui.js';

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));

async function faceIdAvailable() {
  try { return !!window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { return false; }
}
async function faceIdRegister() {
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: rand(32), rp: { name: 'Nur' }, user: { id: rand(16), name: 'nur-lock', displayName: 'Nur App-Sperre' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' }, timeout: 60000 } });
  return b64(cred.rawId);
}
async function faceIdVerify(id) {
  const r = await navigator.credentials.get({ publicKey: { challenge: rand(32), allowCredentials: [{ type: 'public-key', id: unb64(id) }], userVerification: 'required', timeout: 60000 } });
  return !!r;
}

function pinPad(title, sub, { onDone, allowFace = false, onFace } = {}) {
  let pin = '';
  const el = document.createElement('div'); el.className = 'overlay'; el.style.justifyContent = 'center';
  el.innerHTML = `<div class="center"><div class="ob-logo" style="width:64px;height:64px;border-radius:18px;margin-top:0">${icon('lock', 'lg')}</div>
    <div class="bold" style="font-size:20px">${title}</div><div class="small muted mt8" id="pinSub">${sub}</div>
    <div class="pin-dots" id="dots">${'<i></i>'.repeat(4)}</div>
    <div class="pinpad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-n="${n}">${n}</button>`).join('')}
      ${allowFace ? `<button class="clear" data-face aria-label="Face ID">${icon('face', 'lg')}</button>` : '<span></span>'}<button data-n="0">0</button><button class="clear" data-del>Löschen</button></div></div>`;
  document.body.appendChild(el);
  const dots = el.querySelector('#dots');
  const paint = () => dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i < pin.length));
  const api = {
    el, close() { el.style.transition = 'opacity .35s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 360); },
    reset(msg) { pin = ''; paint(); if (msg) el.querySelector('#pinSub').textContent = msg; },
    fail(msg) { haptic('heavy'); dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake'); pin = ''; paint(); if (msg) el.querySelector('#pinSub').textContent = msg; },
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.face !== undefined) return onFace?.(api);
    if (b.dataset.del !== undefined) pin = pin.slice(0, -1);
    else if (b.dataset.n && pin.length < 4) { pin += b.dataset.n; haptic(); }
    paint();
    if (pin.length === 4) { const p = pin; setTimeout(() => onDone(p, api), 120); }
  });
  return api;
}

export function showLockScreen() {
  const lock = store.state.settings.lock;
  if (lock.type === 'none' || !lock.pinHash) return Promise.resolve();
  return new Promise((resolve) => {
    const tryFace = async (api) => {
      try { if (await faceIdVerify(lock.credId)) { haptic('success'); api.close(); resolve(); } } catch { api.fail('Face ID abgebrochen – PIN eingeben'); }
    };
    const api = pinPad('Nur ist gesperrt', 'PIN eingeben', {
      allowFace: lock.type === 'faceid' && !!lock.credId, onFace: tryFace,
      async onDone(p, a) { if (await sha256('nur:' + p) === lock.pinHash) { haptic('success'); a.close(); resolve(); } else a.fail('Falsche PIN'); },
    });
    if (lock.type === 'faceid' && lock.credId) setTimeout(() => tryFace(api), 350);
  });
}

export async function setupLock(done) {
  const lock = store.state.settings.lock;
  const face = await faceIdAvailable();
  openSheet(`<h3 class="sheet-title">App-Sperre</h3>
    <p class="muted small center">Schütze deine privaten Daten (Gebete, Tagebuch, Reinheits-Serie) vor neugierigen Blicken.</p>
    <div class="list">
      <button class="row tap" data-l="none" style="width:100%;text-align:left"><div class="grow"><div class="t">Aus</div></div>${lock.type === 'none' ? `<span style="color:var(--blue)">${icon('check')}</span>` : ''}</button>
      <button class="row tap" data-l="pin" style="width:100%;text-align:left"><div class="grow"><div class="t">4-stellige PIN</div></div>${lock.type === 'pin' ? `<span style="color:var(--blue)">${icon('check')}</span>` : ''}</button>
      <button class="row tap" data-l="faceid" style="width:100%;text-align:left" ${face ? '' : 'disabled'}><div class="grow"><div class="t">Face ID + PIN</div><div class="s">${face ? 'Über einen lokalen Passkey' : 'Auf diesem Gerät nicht verfügbar'}</div></div>${lock.type === 'faceid' ? `<span style="color:var(--blue)">${icon('check')}</span>` : ''}</button>
    </div>
    <p class="list-f">Face ID braucht HTTPS und funktioniert nur in der installierten App. Die PIN ist immer der Ersatz.</p>`, {
    onMount(el, api) {
      el.querySelectorAll('[data-l]').forEach((b) => b.onclick = async () => {
        const type = b.dataset.l;
        if (type === 'none') {
          if (lock.type !== 'none' && !(await confirmSheet('Sperre entfernen?', 'Die App ist danach ohne PIN zugänglich.', 'Entfernen'))) return;
          Object.assign(lock, { type: 'none', pinHash: null, credId: null }); store.save(); api.close(); done?.(); return;
        }
        api.close();
        let first = null;
        const pad = pinPad('Neue PIN', 'Wähle 4 Ziffern', {
          async onDone(p, a) {
            if (!first) { first = p; a.reset('PIN wiederholen'); return; }
            if (p !== first) { first = null; a.fail('Stimmt nicht überein – neu wählen'); return; }
            lock.pinHash = await sha256('nur:' + p); lock.type = 'pin'; lock.credId = null;
            if (type === 'faceid') {
              try { lock.credId = await faceIdRegister(); lock.type = 'faceid'; } catch { toast(`${icon('alert')} Face ID nicht eingerichtet – PIN aktiv`, 'warn'); }
            }
            store.save(); haptic('success'); a.close(); toast(`${icon('lock')} App-Sperre aktiv`, 'ok'); done?.();
          },
        });
        const cancel = document.createElement('button'); cancel.className = 'btn ghost'; cancel.textContent = 'Abbrechen'; cancel.style.marginTop = '20px';
        cancel.onclick = () => pad.close(); pad.el.firstElementChild.appendChild(cancel);
      });
    },
  });
}
