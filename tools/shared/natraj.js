/* Natraj Jewels tools: shared sign-in, header, dialogs and helpers.
   Load supabase-js first, then this file. Pages call NJ.start({...}). */
(function(){
'use strict';

const SUPABASE_URL = 'https://uottxgpjgakinqprexsp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FHm8J9zfhFqy3EhXTMaeRA_kYEh6V-6';   // public key; the database rules decide who sees what
const EMAIL_DOMAIN = 'staff.natraj-tools.app';
const IDLE_MS = 5 * 60 * 1000;
const PIN_RE = /^[0-9]{6}$/;

/* Every app in the toolkit. "path" is relative to the toolkit's home page. */
const APPS = {
  attendance: {name: 'Attendance', path: 'attendance/', desc: 'Daily attendance, leave requests and the monthly register.'},
  rates: {name: 'Gold & silver rate', path: 'rates/', desc: 'Today’s rate, WhatsApp message and history.', everyone: true, access: 'Updates the daily rate', short: 'Daily rate'},
  todo: {name: 'Tasks', path: 'todo/', desc: 'Your to-do list: tasks given to you, and tasks you give others.', everyone: true, access: 'Assigns tasks', short: 'Assigns tasks'},
  expenses: {name: 'Expenses', path: 'expenses/', desc: 'Money paid out of the shop: enter it as it happens, see the month by category.'},
  banking: {name: 'Banking', path: 'banking/', desc: 'Deposits, withdrawals and transfers for each bank account, with statements and balances.'},
  crm: {name: 'Customers', path: 'crm/', desc: 'Customer details, follow-ups to call back, and birthdays and anniversaries coming up.'},
  designs: {name: 'Design library', path: 'designs/', desc: 'What customers asked for and what to restock, with photos: order it, track it, tell the customer when it arrives.', short: 'Designs'},
  chits: {name: 'Chit scheme', path: 'chits/', desc: 'Monthly savings plans: members, payments with receipts, who is behind, and who is ready to redeem.', short: 'Chits'},
  silver: {name: 'Silver sales & purchase', path: 'silver/', desc: 'Silver sold and bought: weight, touch, rate and amount, with a day book and monthly totals.', short: 'Silver'},
  campaigns: {name: 'Marketing campaigns', path: 'campaigns/', desc: 'Plan festival and season campaigns, send the offer on WhatsApp to chosen customers, and see who came, what they bought and what it cost.', short: 'Campaigns'},
  jobs: {name: 'Repairs & orders', path: 'jobs/', desc: 'Repairs and custom orders: what came in, which karigar has it, when it’s promised, the advance, and telling the customer when it’s ready.', short: 'Repairs'}
};

/* Line icons for the app tiles (24×24, drawn with the current text colour). New apps add one here. */
const ICONS = {
  live: '<path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z"/><circle cx="12" cy="10" r="2.3"/><path d="M8.3 16.2c.8-1.9 2.1-2.8 3.7-2.8s2.9.9 3.7 2.8"/>',
  report: '<rect x="4.5" y="3" width="15" height="18" rx="2"/><path d="M8.5 3v2.5h7V3"/><path d="m12 9.3 1.1 2.2 2.4.4-1.7 1.7.4 2.4-2.2-1.1-2.2 1.1.4-2.4-1.7-1.7 2.4-.4z"/>',
  dashboard: '<rect x="3.5" y="3.5" width="7" height="9" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.5"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.5"/><rect x="3.5" y="15.5" width="7" height="5" rx="1.5"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M15.5 4.7a3.5 3.5 0 0 1 0 6.6"/><path d="M18 14.8c2 .7 3.2 2.4 3.5 5.2"/>',
  attendance: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="m8.8 14.6 2.2 2.2 4.4-4.4"/>',
  rates: '<path d="M2.5 20.5h9l-1.6-5H4.1z"/><path d="M12.5 20.5h9l-1.6-5h-5.8z"/><path d="M7.5 14.5h9l-1.6-5H9.1z"/><path d="M12 3v2.4M8 4.4l1.2 1.6M16 4.4l-1.2 1.6"/>',
  todo: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 3h6v3H9z"/><path d="m8.5 11.2 1.5 1.5 2.6-2.6M8.5 16.4l1.5 1.5 2.6-2.6M14.6 11.5H16M14.6 16.7H16"/>',
  expenses: '<path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z"/><path d="M9.5 7.5h5M9.5 10h5M12.7 7.5c1.6 0 1.6 5-1.6 5l3.4 3.5"/>',
  banking: '<path d="M3 9.5 12 4l9 5.5"/><path d="M3.5 20.5h17M5.5 18v-6.5M10 18v-6.5M14 18v-6.5M18.5 18v-6.5M4 9.5h16"/>',
  crm: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="9" cy="10.5" r="2.5"/><path d="M5.5 16.5c.5-1.9 1.9-3 3.5-3s3 1.1 3.5 3M14.5 9.5h4M14.5 13h4"/>',
  designs: '<path d="M6.5 4h11l3.5 5-9 11L3 9z"/><path d="M3 9h18M9.5 4 8 9l4 11 4-11-1.5-5"/>',
  campaigns: '<path d="M3.5 10v4a1 1 0 0 0 1 1H7l6 4V5L7 9H4.5a1 1 0 0 0-1 1z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  jobs: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2l-5.6 5.6a1.6 1.6 0 0 0 2.2 2.2l5.6-5.6a4 4 0 0 0 5.2-5.4l-2.4 2.4-2-.4-.4-2z"/>',
  silver: '<path d="M4 15h16l-2 5H6z"/><path d="M7 15l1.5-5h7L17 15M10 10l.8-3h2.4l.8 3"/>',
  chits: '<ellipse cx="12" cy="6.5" rx="7" ry="2.5"/><path d="M5 6.5v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4M5 10.5v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4M5 14.5v3c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-3"/>',
  leave: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M9.5 15h5"/>'
};
const icon = k => ICONS[k] ? '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[k] + '</svg>' : '';

const ROOT = (document.currentScript && document.currentScript.src || '').replace(/shared\/natraj\.js.*$/, '');
// each browser keeps a random device key and sends it with every request; the owner can approve the
// shop's computer, and when "staff only on approved devices" is on, the database answers staff only there
// The key is kept in two places (the page's storage and a long-lived cookie) so clearing one does not lose
// it, and the browser is asked to keep this site's storage. Both are still per web address, and are gone
// if Chrome deletes site data on closing or a private (Incognito) window is used.
const DEVICE_KEY = (() => {
  const ok = k => !!k && /^[0-9a-f]{32,128}$/.test(k);
  let k = '';
  try{ k = localStorage.getItem('natraj-device') || ''; }catch(e){}
  if(!ok(k)){ const m = document.cookie.match(/(?:^|;\s*)natraj-device=([0-9a-f]{32,128})/); k = m ? m[1] : ''; }
  if(!ok(k)) k = [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');
  try{ localStorage.setItem('natraj-device', k); }catch(e){}
  try{ document.cookie = 'natraj-device=' + k + '; max-age=315360000; path=/; SameSite=Strict' + (location.protocol === 'https:' ? '; Secure' : ''); }catch(e){}
  try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); }catch(e){}
  return k;
})();
// a short code for this browser's key, to compare with the list of approved devices
async function deviceCode(){
  try{ const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(DEVICE_KEY)); return [...new Uint8Array(h)].slice(0, 3).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase(); }
  catch(e){ return ''; }
}
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, Object.assign({
  auth: {persistSession: true, autoRefreshToken: true, storageKey: 'natraj-tools-auth'}
}, DEVICE_KEY ? {global: {headers: {'x-natraj-device': DEVICE_KEY}}} : {}));
const $ = id => document.getElementById(id);

/* ---------- small helpers ---------- */
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d || 1); };
const todayIso = () => iso(new Date());
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function toast(msg){
  let t = $('nj-toast');
  // rises from the bottom edge and goes back the same way
  if(!t){ t = document.createElement('div'); t.id = 'nj-toast'; t.className = 'toast away'; t.setAttribute('role', 'status'); document.body.appendChild(t); void t.offsetWidth; }
  t.textContent = msg; t.classList.remove('away');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('away'), 2600);
}
function download(name, text, type){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type}));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
/* Turn a Supabase error into words for the screen. */
function friendly(error){
  if(!error) return '';
  const m = error.message || String(error);
  if(/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Could not reach the server. Check the internet connection and try again.';
  if(/JWT|not allowed|permission denied|row-level security/i.test(m)) return 'You do not have access to do that. Sign in again or ask the owner.';
  return m;
}
/* Throw a readable error if a Supabase call failed; otherwise return its data. */
function must(res){ if(res.error) throw new Error(friendly(res.error)); return res.data; }

/* ---------- dialogs ---------- */
/* One dialog builder for every form and confirmation.
   fields: [{id, label, type: text|pin|select|checkbox|date|textarea|code, options:[[value,label]], value, placeholder, maxlength}]
   Resolves to {fieldId: value}, the extra button's value, or null when cancelled. */
function dialog(o){
  const d = document.createElement('dialog');
  d.setAttribute('aria-labelledby', 'nj-dlg-title');
  const f = document.createElement('form'); f.method = 'dialog'; f.noValidate = true;
  let h = '<h2 id="nj-dlg-title">' + esc(o.title) + '</h2>' + (o.msg ? '<p>' + esc(o.msg) + '</p>' : '') + (o.html || '');
  (o.fields || []).forEach(x => {
    const id = 'nj-f-' + x.id, ph = x.placeholder ? ' placeholder="' + esc(x.placeholder) + '"' : '';
    if(x.type === 'chips'){         // several bubbles that switch on and off
      h += '<div class="field"><span>' + esc(x.label) + '</span><div class="bubbles" id="' + id + '" role="group" aria-label="' + esc(x.label) + '">' +
        x.options.map(([v, l]) => '<button type="button" class="bubble" data-v="' + esc(v) + '" aria-pressed="' + (x.value || []).includes(v) + '">' + esc(l) + '</button>').join('') + '</div></div>';
      return;
    }
    if(x.type === 'checkbox'){
      h += '<label class="field check"><input type="checkbox" id="' + id + '"' + (x.value ? ' checked' : '') + '> ' + esc(x.label) + '</label>';
      return;
    }
    h += '<label class="field">' + esc(x.label);
    if(x.type === 'select') h += '<select class="input" id="' + id + '">' + x.options.map(([v, l]) => '<option value="' + esc(v) + '"' + (v === x.value ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
    else if(x.type === 'textarea') h += '<textarea class="input" id="' + id + '" maxlength="' + (x.maxlength || 200) + '"' + ph + '>' + esc(x.value || '') + '</textarea>';
    else if(x.type === 'pin') h += '<input class="input" id="' + id + '" type="password" inputmode="numeric" autocomplete="off" maxlength="6"' + ph + '>';
    else if(x.type === 'otp') h += '<input class="input" id="' + id + '" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6"' + ph + '>';
    else if(x.type === 'code') h += '<input class="input" id="' + id + '" type="text" autocomplete="off" autocapitalize="characters" maxlength="9" style="text-transform:uppercase"' + ph + '>';
    else h += '<input class="input" id="' + id + '" type="' + (x.type || 'text') + '" autocomplete="off" maxlength="' + (x.maxlength || 60) + '" value="' + esc(x.value || '') + '"' + ph + '>';
    h += '</label>';
  });
  if(o.extra && !o.extra.btn) h += '<button type="button" class="linkish" data-extra>' + esc(o.extra.label) + '</button>';
  h += '<p class="err" role="alert"></p><div class="actions">' +
    (o.cancel === null ? '' : '<button type="button" class="btn" data-cancel>' + esc(o.cancel || 'Cancel') + '</button>') +
    (o.extra && o.extra.btn ? '<button type="button" class="btn ' + esc(o.extra.btn) + '" data-extra>' + esc(o.extra.label) + '</button>' : '') +
    (o.ok === null ? '' : '<button type="submit" class="btn ' + (o.danger ? 'btn-red' : 'btn-maroon') + '" data-ok>' + esc(o.ok || 'OK') + '</button>') + '</div>';
  f.innerHTML = h; d.appendChild(f); document.body.appendChild(d);
  f.addEventListener('click', e => { const b = e.target.closest('.bubble[data-v]'); if(b) b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'); });
  const err = f.querySelector('.err'), ok = f.querySelector('[data-ok]');
  const values = () => {
    const v = {};
    (o.fields || []).forEach(x => {
      const el = $('nj-f-' + x.id);
      v[x.id] = x.type === 'checkbox' ? el.checked
        : x.type === 'chips' ? [...el.querySelectorAll('[aria-pressed="true"]')].map(b => b.dataset.v)
        : el.value.trim();
    });
    return v;
  };
  return new Promise(res => {
    let result = null;
    // leaves the way it came (a short fade and shrink), then closes
    let closing = false;
    const close = r => { if(closing) return; closing = true; result = r; d.classList.add('closing'); setTimeout(() => d.close(), 150); };
    d.addEventListener('close', () => { d.remove(); res(result); });
    d.addEventListener('cancel', () => { result = null; });
    const c = f.querySelector('[data-cancel]'); if(c) c.onclick = () => close(null);
    const ex = f.querySelector('[data-extra]'); if(ex) ex.onclick = () => close(o.extra.withValues ? Object.assign(values(), {extra: o.extra.value}) : o.extra.value);
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const v = values();
      if(o.validate){
        ok.setAttribute('aria-busy', 'true'); err.textContent = '';
        let msg = '';
        try{ msg = await o.validate(v); }catch(x){ msg = friendly(x); }
        ok.removeAttribute('aria-busy');
        if(msg){ err.textContent = msg; return; }
      }
      close(o.fields && o.fields.length ? v : true);
    });
    // say straight away when a PIN or code is the wrong length, not only after pressing the button
    (o.fields || []).filter(x => x.type === 'pin' || x.type === 'otp').forEach(x => {
      const el = $('nj-f-' + x.id);
      el.addEventListener('blur', () => { if(el.value && !/^[0-9]{6}$/.test(el.value.trim())) err.textContent = (x.type === 'otp' ? 'The code' : 'The PIN') + ' is 6 digits.'; });
      el.addEventListener('input', () => { if(/is 6 digits/.test(err.textContent)) err.textContent = ''; });
    });
    d.showModal();
    const first = f.querySelector('input,select,textarea');
    (first || ok).focus();
  });
}
const ask = (title, msg, okLabel, danger) => dialog({title, msg, ok: okLabel || 'OK', danger, cancel: okLabel === null ? null : undefined});

/* ---------- people edge function ---------- */
async function people(action, body){
  const {data, error} = await sb.functions.invoke('people', {body: Object.assign({action}, body || {})});
  if(error){
    let msg = 'Could not reach the server. Check the internet connection and try again.';
    try{ const j = await error.context.json(); if(j && j.error) msg = j.error; }catch(e){}
    throw new Error(msg);
  }
  return data;
}

/* ---------- sign-in ---------- */
let me = null;              // the signed-in person's profile row, or null
let onChange = () => {};
const emailFor = username => username + '@' + EMAIL_DOMAIN;
const passwordFor = pin => 'natraj-' + pin;
let failed = 0, waitUntil = 0;

async function signInWith(username, pin){
  const {error} = await sb.auth.signInWithPassword({email: emailFor(username), password: passwordFor(pin)});
  if(error){
    if(error.status === 429) return 'Too many tries. Wait a few minutes and try again.';
    if(/invalid login|invalid credentials/i.test(error.message)) return 'That PIN is not right. Try again.';
    return friendly(error);
  }
  return '';
}

async function signInFlow(){
  const r = await sb.rpc('setup_needed');
  if(r.data === true) return setupFlow();
  const names = must(await sb.rpc('login_names')) || [];
  if(!names.length){ ask('No one can sign in yet', 'Ask the owner to add you.', null); return; }
  const v = await dialog({
    title: 'Sign in', msg: 'Choose your name and enter your 6-digit PIN.', ok: 'Sign in',
    fields: [
      {id: 'user', label: 'Your name', type: 'select', options: [['', 'Choose your name'], ...names.map(n => [n.username, n.name])]},
      {id: 'pin', label: 'PIN', type: 'pin'}
    ],
    extra: {label: 'Forgot your PIN?', value: 'forgot'},
    validate: async v => {
      const wait = Math.ceil((waitUntil - Date.now()) / 1000);
      if(wait > 0) return 'Too many wrong PINs. Try again in ' + wait + ' seconds.';
      if(!v.user) return 'Choose your name.';
      if(!PIN_RE.test(v.pin)) return 'The PIN is 6 digits.';
      const e = await signInWith(v.user, v.pin);
      if(e && /not right/.test(e) && ++failed >= 5){ failed = 0; waitUntil = Date.now() + 30000; return 'Too many wrong PINs. Try again in 30 seconds.'; }
      if(!e) failed = 0;
      return e;
    }
  });
  if(v === 'forgot') return recoverFlow();
}

async function setupFlow(){
  setupFlow.code = null;
  const v = await dialog({
    title: 'Set up the owner', ok: 'Save PIN', cancel: 'Later',
    msg: 'First, the owner chooses a 6-digit PIN. The owner sees the dashboard, decides who else can sign in, and which apps each person can use.',
    fields: [
      {id: 'name', label: 'Your name', type: 'text', maxlength: 60},
      {id: 'pin', label: 'PIN (6 digits)', type: 'pin'},
      {id: 'pin2', label: 'Type the PIN again', type: 'pin'}
    ],
    validate: async v => {
      if(!v.name) return 'Type your name.';
      if(!PIN_RE.test(v.pin)) return 'The PIN must be 6 digits.';
      if(v.pin !== v.pin2) return 'The two PINs do not match. Type them again.';
      const r = await people('setup', {name: v.name, pin: v.pin});
      setupFlow.code = r.recovery;
      return signInWith(r.username, v.pin);
    }
  });
  if(v && setupFlow.code) await showRecoveryCode(setupFlow.code);
}

function showRecoveryCode(code){
  return dialog({
    title: 'Write down your recovery code', cancel: null, ok: 'I have written it down',
    html: '<p class="code">' + esc(code) + '</p><p>If you forget your owner PIN, tap Sign in, then “Forgot your PIN?”, and enter this code. Keep it somewhere safe. It is shown only once.</p>'
  });
}

async function recoverFlow(){
  await dialog({
    title: 'Forgot your PIN?', ok: 'Save new PIN',
    msg: 'Owners: enter the recovery code you wrote down, and choose a new PIN. This also switches off two-step sign-in, in case your phone is lost; set it up again afterwards. Everyone else: ask the owner to set a new PIN for you.',
    fields: [
      {id: 'code', label: 'Recovery code', type: 'code', placeholder: 'XXXX-XXXX'},
      {id: 'pin', label: 'New PIN (6 digits)', type: 'pin'},
      {id: 'pin2', label: 'Type the new PIN again', type: 'pin'}
    ],
    validate: async v => {
      if(!v.code) return 'Enter the recovery code.';
      if(!PIN_RE.test(v.pin)) return 'The PIN must be 6 digits.';
      if(v.pin !== v.pin2) return 'The two PINs do not match. Type them again.';
      const r = await people('recover', {code: v.code, pin: v.pin});
      return signInWith(r.username, v.pin);
    }
  });
}

/* Two-step sign-in: someone who has set up an authenticator app types its 6-digit code after the PIN.
   Until they do, the database gives their session nothing, so the page treats them as signed out. */
let needCode = false, askingCode = false;
async function askCode(){
  if(askingCode) return; askingCode = true;
  try{
    const f = await sb.auth.mfa.listFactors();
    const factor = f.data && f.data.totp && f.data.totp[0];
    if(!factor) return;
    const v = await dialog({
      title: 'Enter the code from your phone', ok: 'Continue', cancel: 'Sign out',
      msg: 'Open your authenticator app (for example Google Authenticator) and type the 6-digit code shown for Natraj Jewels.',
      fields: [{id: 'code', label: '6-digit code', type: 'otp'}],
      extra: {label: 'Lost your phone?', value: 'lost'},
      validate: async v => {
        if(!/^[0-9]{6}$/.test(v.code)) return 'The code is 6 digits.';
        const r = await sb.auth.mfa.challengeAndVerify({factorId: factor.id, code: v.code});
        if(!r.error) return '';
        if(r.error.status === 429) return 'Too many tries. Wait a few minutes and try again.';
        if(/invalid|expired/i.test(r.error.message)) return 'That code is not right. Type the code the app shows now.';
        return friendly(r.error);
      }
    });
    if(v === 'lost'){ await signOut(true); return recoverFlow(); }
    if(!v) await signOut();
  } finally { askingCode = false; }
}

async function signOut(quiet){
  clearTimeout(idleTimer);
  if(me) try{ await sb.rpc('presence_out'); }catch(e){}   // tell the owner's "who is online" straight away
  await sb.auth.signOut();
  if(!quiet) toast('Signed out');
}

let idleTimer = null;
function touch(){
  if(!me) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { signOut(true); toast('Signed out after 5 minutes without use'); }, IDLE_MS);
}
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, touch, true));

const canUse = app => !!me && (me.is_owner || (me.apps || []).includes(app));

/* ---------- who is online: while a page is open and on screen, check in about once a minute ---------- */
const PAGES = {dashboard: 'Dashboard', people: 'People & settings', report: 'Report card', live: 'Live shop'};
function pageName(){
  const parts = location.pathname.split('/').filter(Boolean);
  if(parts.length && /\.html?$/.test(parts[parts.length - 1])) parts.pop();
  const k = parts[parts.length - 1] || '';
  return (APPS[k] && APPS[k].name) || PAGES[k] || 'Home';
}
const deviceName = () => /iPad|Tablet/i.test(navigator.userAgent) ? 'Tablet' : /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'Phone' : 'Computer';
let lastBeat = 0;
async function heartbeat(force){
  if(!me || document.visibilityState !== 'visible' || (!force && Date.now() - lastBeat < 20000)) return;
  lastBeat = Date.now();
  try{ await sb.rpc('heartbeat', {p_page: pageName(), p_device: deviceName()}); }catch(e){}
}
setInterval(() => heartbeat(), 60000);
// a presence row as words: online now (checked in within the last 2½ minutes), or when last seen
function presenceText(p){
  const clock = t => new Date(t).toLocaleTimeString('en-IN', {hour: 'numeric', minute: '2-digit'});
  const when = t => { const d = new Date(t), y = new Date(); y.setDate(y.getDate() - 1);
    return d.toDateString() === new Date().toDateString() ? clock(t) : d.toDateString() === y.toDateString() ? 'yesterday ' + clock(t) : d.toLocaleDateString('en-IN', {day: 'numeric', month: 'short'}); };
  if(!p) return {online: false, text: 'Not signed in yet'};
  if(!p.signed_out_at && Date.now() - new Date(p.last_seen) < 150000)
    return {online: true, text: 'Online now · ' + (p.page || 'Home') + (p.device ? ' · ' + p.device : '') + ' · since ' + clock(p.signed_in_at)};
  return {online: false, text: p.signed_out_at ? 'Signed out ' + when(p.signed_out_at) : 'Last seen ' + when(p.last_seen) + (p.page ? ' · ' + p.page : '')};
}
document.addEventListener('visibilitychange', () => heartbeat());

let blocked = false, blockedInfo = {};
// the page in place of the app, for staff on a device that is not approved
function showBlocked(){
  document.body.classList.toggle('device-blocked', blocked);
  let el = $('nj-blocked');
  if(!blocked){ if(el) el.remove(); return false; }
  if(!el){
    el = document.createElement('div'); el.id = 'nj-blocked'; el.className = 'wrap content';
    const h = document.querySelector('header'); if(h) h.after(el); else document.body.prepend(el);
  }
  el.innerHTML = '<div class="form panel" style="max-width:640px"><h3>This device is not approved</h3>' +
    '<p>Staff can use the Natraj Jewels apps only on the shop’s approved computer. Please use the computer at the shop, or ask the owner to approve this device in People &amp; settings.</p>' +
    '<p style="font-size:.9rem;color:var(--muted)">You can still apply for leave from any phone without signing in.</p>' +
    // on the shop computer this usually means the browser forgot its approval: say which address was approved, and this browser's code
    ((blockedInfo.sites || []).length && !(blockedInfo.sites || []).includes(location.host)
      ? '<p class="notice" style="margin:0">This page is open at <b>' + esc(location.host) + '</b>, but the shop computers were approved at <b>' + (blockedInfo.sites || []).map(esc).join('</b> or <b>') + '</b>. Open the apps at that address instead.</p>' : '') +
    '<p style="font-size:.85rem;color:var(--muted)" id="nj-devcode">If this is the shop computer, the browser has forgotten its approval (for example, Chrome cleared its data when it closed). Ask the owner to approve it again.</p>' +
    '<div class="bar"><button class="btn btn-maroon" type="button" data-nj-out>Sign out</button><a class="btn" href="' + ROOT + 'attendance/#leave" data-nj-leave>Apply for leave</a></div></div>';
  deviceCode().then(c => { const p = $('nj-devcode'); if(p && c) p.insertAdjacentHTML('beforeend', ' This browser’s code: <b>' + c + '</b>.'); });
  return true;
}
async function loadMe(session){
  needCode = false;
  if(!session){ me = null; return; }
  const a = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if(a.data && a.data.currentLevel === 'aal1' && a.data.nextLevel === 'aal2'){ needCode = true; me = null; blocked = false; return; }
  const r = await sb.from('profiles').select('*').eq('user_id', session.user.id).maybeSingle();
  me = r.data || null;
  if(!me && !r.error){ await sb.auth.signOut(); }   // account was removed
  // staff on a device the owner has not approved, while the lock is on: the database gives them nothing
  blocked = false;
  if(me && !me.is_owner){ const d = await sb.rpc('device_status'); blocked = !!(d.data && d.data.ok === false); blockedInfo = d.data || {}; }
}

function renderAccess(opts){
  const a = $('access'); if(!a) return;
  const home = opts.home ? '' : '<a class="btn btn-on-dark bell" href="' + ROOT + '" aria-label="All apps" title="All apps">' + HOME + '</a>';
  a.innerHTML = me
    ? '<button class="btn btn-on-dark bell" id="nj-bell" type="button" data-nj-notes aria-label="Notifications">' + BELL + '<span class="count" hidden></span></button>' +
      '<span>Signed in as <b>' + esc(me.name) + '</b></span>' + home + '<button class="btn btn-on-dark" type="button" data-nj-out>Sign out</button>'
    : home;   // signed out: the page itself shows the sign-in card
  document.body.classList.toggle('signed-in', !!me);
  document.body.classList.toggle('signed-out', !me);
  document.body.classList.toggle('not-owner', !(me && me.is_owner));
}
document.addEventListener('click', e => {
  if(e.target.closest('[data-nj-in]')) signInFlow();
  if(e.target.closest('[data-nj-out]')) signOut();
  const lv = e.target.closest('[data-nj-leave]');   // the leave form is for people who are not signed in
  if(lv){ e.preventDefault(); signOut(true).finally(() => { location.href = lv.href; if(new URL(lv.href).pathname === location.pathname) location.reload(); }); }
  if(e.target.closest('[data-nj-notes]')) showNotes();
  const r = e.target.closest('[data-nj-read]'); if(r) markRead([r.dataset.njRead]);
  const g = e.target.closest('[data-nj-go]'); if(g) openNote(g.dataset.njGo);
});

/* ---------- notifications: a bell in the header and a bar under it with the newest unread one.
   Rows are written by the database (e.g. when a task is ticked done); each person sees only their own. */
const HOME = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9v11h13V9"/><path d="M10 20v-6h4v6"/></svg>';
const BELL = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
let notes = [];
const ago = t => {
  const m = Math.round((Date.now() - new Date(t)) / 60000);
  if(m < 1) return 'just now';
  if(m < 60) return m + ' min ago';
  if(m < 24 * 60) return Math.round(m / 60) + ' h ago';
  return new Date(t).toLocaleDateString('en-IN', {day: 'numeric', month: 'short'});
};
async function loadNotes(){
  if(!me){ notes = []; renderNotes(); return; }
  const r = await sb.from('notifications').select('*').order('created_at', {ascending: false}).limit(30);
  if(r.error) return;
  notes = r.data || []; renderNotes();
}
function renderNotes(){
  const unread = notes.filter(n => !n.read_at);
  const c = document.querySelector('#nj-bell .count');
  if(c){ c.hidden = !unread.length; c.textContent = unread.length > 9 ? '9+' : unread.length; }
  const bell = $('nj-bell'); if(bell) bell.setAttribute('aria-label', unread.length ? unread.length + ' new notifications' : 'Notifications');
  let bar = $('nj-bar');
  if(!bar){
    const head = document.querySelector('header.top'); if(!head) return;
    bar = document.createElement('div'); bar.id = 'nj-bar'; bar.className = 'notebar'; bar.setAttribute('role', 'status');
    head.after(bar);
  }
  if(!me || !unread.length){ bar.hidden = true; return; }
  const n = unread[0];
  if(bar.hidden || !bar.innerHTML){ bar.classList.remove('arrive'); void bar.offsetWidth; bar.classList.add('arrive'); }
  bar.hidden = false;
  bar.innerHTML = '<div class="wrap"><span class="nb-dot" aria-hidden="true"></span>' +
    '<button type="button" class="nb-text" data-nj-go="' + esc(n.id) + '"><b>' + esc(n.title) + '</b>' + (n.body ? ' · ' + esc(n.body) : '') + ' <span class="nb-when">' + esc(ago(n.created_at)) + '</span></button>' +
    (unread.length > 1 ? '<button type="button" class="nb-more" data-nj-notes>+' + (unread.length - 1) + ' more</button>' : '') +
    '<button type="button" class="nb-x" data-nj-read="' + esc(n.id) + '" aria-label="Mark as read">×</button></div>';
}
async function markRead(ids){
  const now = new Date().toISOString();
  notes.forEach(n => { if(ids.includes(n.id) && !n.read_at) n.read_at = now; });
  renderNotes();
  await sb.from('notifications').update({read_at: now}).in('id', ids).is('read_at', null);
}
async function openNote(id){
  const n = notes.find(x => x.id === id); if(!n) return;
  await markRead([id]);
  const d = document.querySelector('dialog.notes[open]'); if(d) d.close();
  if(n.link){
    const url = new URL(ROOT + n.link, location.href);
    if(url.pathname === location.pathname){ if(url.hash !== location.hash) location.hash = url.hash; location.reload(); }
    else location.href = url.href;
  }
}
function showNotes(){
  const d = document.createElement('dialog'); d.className = 'notes'; d.setAttribute('aria-labelledby', 'nj-notes-title');
  const unread = notes.filter(n => !n.read_at).length;
  d.innerHTML = '<div class="notes-in"><div class="notes-head"><h2 id="nj-notes-title">Notifications</h2>' +
      (unread ? '<button type="button" class="linkish" data-all>Mark all as read</button>' : '') + '</div>' +
    (notes.length ? '<div class="notes-list">' + notes.map(n =>
      '<button type="button" class="nj-note' + (n.read_at ? '' : ' new') + '" data-nj-go="' + esc(n.id) + '"><b>' + esc(n.title) + '</b>' +
      (n.body ? '<span>' + esc(n.body) + '</span>' : '') + '<small>' + esc(ago(n.created_at)) + '</small></button>').join('') + '</div>'
      : '<p class="notes-empty">Nothing yet. You will see finished tasks here.</p>') +
    '<div class="actions"><button type="button" class="btn" data-close>Close</button></div></div>';
  document.body.appendChild(d);
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', e => {
    if(e.target === d || e.target.closest('[data-close]')) d.close();
    if(e.target.closest('[data-all]')){ markRead(notes.filter(n => !n.read_at).map(n => n.id)); d.close(); }
  });
  d.showModal();
}
setInterval(() => { if(me && document.visibilityState === 'visible') loadNotes(); }, 60000);
document.addEventListener('visibilitychange', () => { if(me && document.visibilityState === 'visible') loadNotes(); });

window.addEventListener('offline', () => { let b = $('nj-offline'); if(!b){ b = document.createElement('div'); b.id = 'nj-offline'; b.className = 'offline'; b.textContent = 'No internet connection. Changes will not be saved until it is back.'; document.body.appendChild(b); } b.hidden = false; });
window.addEventListener('online', () => { const b = $('nj-offline'); if(b) b.hidden = true; });

/* Pages call this once. opts: {home: true on the home page, onReady(me)}.
   onReady runs after sign-in state is known, and again whenever it changes. */
// pages with tabs: the header scrolls away except its tab row, which stays at the top
function stickyTabs(){
  const head = document.querySelector('header.top'), tabs = head && head.querySelector('.tabs');
  if(!tabs) return;
  head.classList.add('sticky');
  const place = () => { head.style.top = -(head.offsetHeight - tabs.offsetHeight) + 'px'; };
  place(); addEventListener('resize', place);
  if(window.ResizeObserver) new ResizeObserver(place).observe(head);
  const mark = () => head.classList.toggle('stuck', head.getBoundingClientRect().top < 0);
  addEventListener('scroll', mark, {passive: true}); mark();
}
// fields that check themselves as soon as you leave them: NJ.liveCheck(input, value => message or '', where to say it)
function liveCheck(el, check, out){
  if(!el) return;
  el.addEventListener('blur', () => { const m = el.value.trim() ? check(el.value.trim()) : ''; if(m) out.textContent = m; el.toggleAttribute('aria-invalid', !!m); });
  el.addEventListener('input', () => { if(el.hasAttribute('aria-invalid')){ el.removeAttribute('aria-invalid'); out.textContent = ''; } });
}
async function start(opts){
  onChange = opts.onReady || (() => {});
  stickyTabs();
  const y = $('year'); if(y) y.textContent = new Date().getFullYear();
  // the logo in the header goes back to the home page (all apps)
  const br = document.querySelector('header .brand');
  if(br && br.tagName !== 'A'){
    const link = document.createElement('a');
    link.className = br.className; link.href = ROOT || './'; link.title = 'All apps'; link.innerHTML = br.innerHTML;
    br.replaceWith(link);
  }
  const {data} = await sb.auth.getSession();
  await loadMe(data.session);
  renderAccess(opts); touch(); loadNotes(); heartbeat(true);
  if(needCode) askCode();
  if(showBlocked()) return;
  await onChange(me);
  let lastUser = me && me.user_id;
  sb.auth.onAuthStateChange((event, session) => {
    if(event === 'TOKEN_REFRESHED') return;
    setTimeout(async () => {          // run outside the auth callback, as supabase-js recommends
      await loadMe(session);
      const uid = me && me.user_id;
      if(uid === lastUser && event !== 'USER_UPDATED' && !needCode) return;
      lastUser = uid;
      renderAccess(opts); touch(); loadNotes(); heartbeat(true);
      if(needCode) askCode();
      if(showBlocked()) return;
      if(me && event === 'SIGNED_IN') toast('Signed in as ' + me.name);
      await onChange(me);
    }, 0);
  });
}

/* Daily rate duty. settings: {rate_due}; last: newest rates row or null;
   updaters: [{name}] from the rate_updaters() function (everyone with the 'rates' app).
   Returns who is responsible, whether today's rate is in, and whether it is late. */
const listNames = n => n.length <= 1 ? (n[0] || '') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
function rateStatus(settings, last, updaters){
  const st = settings || {};
  const names = (updaters || []).map(u => u.name);
  const [h, m] = String(st.rate_due || '10:30').split(':').map(Number);
  const due = new Date(); due.setHours(h, m || 0, 0, 0);
  const done = !!last && iso(new Date(last.set_at)) === todayIso();
  return {
    assignee: names.length > 0,
    name: listNames(names),
    verb: names.length > 1 ? 'update' : 'updates',
    dueLabel: due.toLocaleTimeString('en-IN', {hour: 'numeric', minute: '2-digit'}),
    done,
    late: !done && Date.now() > due.getTime(),
    mine: !!me && !me.is_owner && canUse('rates'),
    canSet: !!me && (me.is_owner || canUse('rates'))
  };
}

/* Owner backup: every table, as one JSON file. Add new apps' tables here. */
/* Today's task meter, the same everywhere: tasks done today against what is left for today
   (open tasks due today, overdue, or with no date). Tasks due on a later day are counted apart. */
function taskMeter(list){
  const t = todayIso(), dayOf = s => iso(new Date(s));
  const done = list.filter(x => x.status === 'done' && x.done_at && dayOf(x.done_at) === t).length;
  const open = list.filter(x => x.status === 'open');
  const left = open.filter(x => !x.due || x.due <= t), late = left.filter(x => x.due && x.due < t).length;
  const total = done + left.length;
  return {done, left: left.length, late, later: open.length - left.length, total, pct: total ? Math.round(done * 100 / total) : 0};
}
// the bar: green for done, red for overdue still to do, the empty track for the rest
function meterBar(m){
  const w = n => m.total ? (n * 100 / m.total).toFixed(2) + '%' : '0%';
  return '<span class="mtrack" aria-hidden="true">' + (m.done ? '<i class="mdone" style="width:' + w(m.done) + '"></i>' : '') +
    (m.late ? '<i class="mlate" style="width:' + w(m.late) + '"></i>' : '') + '</span>';
}
function meterHtml(m, label){
  const lab = label || 'Today';
  const allDone = m.total && !m.left;
  const foot = m.total ? (allDone ? '<b class="mok">✓ All done for today</b>' : '<span><b>' + m.left + '</b> left</span>' + (m.late ? '<span class="mlate-t"><b>' + m.late + '</b> overdue</span>' : ''))
    : '<span>No tasks for today</span>';
  return '<div class="meter" role="progressbar" aria-label="' + esc(lab + ': tasks done') + '" aria-valuemin="0" aria-valuemax="' + m.total + '" aria-valuenow="' + m.done + '" aria-valuetext="' + m.done + ' of ' + m.total + ' done">' +
    '<div class="mhead"><span class="mnum"><b>' + m.done + '</b> of ' + m.total + ' done ' + esc(lab.toLowerCase()) + '</span>' + (m.total ? '<span class="mpct">' + m.pct + '%</span>' : '') + '</div>' +
    meterBar(m) + '<div class="mfoot">' + foot + (m.later ? '<span>' + m.later + ' due later</span>' : '') + '</div></div>';
}

/* Expenses against the bank. Each expense paid by UPI, card, transfer or cheque from an account is matched
   to a money-out entry on that account for the same amount, dated the same day or up to 3 days later
   (one day earlier is allowed too), closest date first. Each bank entry matches one expense at most.
   bank: money-out rows {id, account_id, day, amount, method}. Returns matched pairs, expenses not found
   (and those under 3 days old, still waiting),
   expenses with no account given, and the bank money-out with no expense (from the days given). */
function matchExpenses(expenses, bank, from, to){
  const dayN = d => Math.round(parse(d).getTime() / 864e5);
  const used = new Set(), matched = [], missing = [], waiting = [], noAccount = [], soon = dayN(todayIso()) - 3;
  const outs = bank.filter(b => b.method !== 'Transfer' && b.method !== 'Opening balance');
  expenses.filter(e => e.mode !== 'Cash').slice().sort((a, b) => a.day.localeCompare(b.day) || b.amount - a.amount).forEach(e => {
    if(!e.account_id){ noAccount.push(e); return; }
    let best = null, bestGap = 99;
    outs.forEach(b => {
      if(used.has(b.id) || b.account_id !== e.account_id || Math.abs(Number(b.amount) - Number(e.amount)) > 0.009) return;
      const gap = dayN(b.day) - dayN(e.day);
      if(gap < -1 || gap > 3) return;
      const score = gap < 0 ? 0.5 : gap;     // same day best, then the next days, then the day before
      if(score < bestGap){ best = b; bestGap = score; }
    });
    if(best){ used.add(best.id); matched.push({e, b: best, gap: dayN(best.day) - dayN(e.day)}); }
    else (dayN(e.day) > soon ? waiting : missing).push(e);     // under 3 days old: the bank entry may not be in yet
  });
  const extra = outs.filter(b => !used.has(b.id) && (!from || b.day >= from) && (!to || b.day <= to));
  return {matched, missing, waiting, noAccount, extra};
}

const TABLES = ['staff', 'profiles', 'settings', 'attendance', 'leave_requests', 'rates', 'tasks', 'expenses', 'bank_accounts', 'bank_entries', 'customers', 'customer_activity', 'designs', 'chit_plans', 'chit_members', 'chit_payments', 'silver_entries', 'report_cards', 'campaigns', 'campaign_contacts', 'campaign_costs', 'change_requests', 'jobs', 'entry_queries'];
async function exportAll(){
  const out = {exported_at: new Date().toISOString(), tables: {}};
  for(const t of TABLES) out.tables[t] = must(await sb.from(t).select('*'));
  download('natraj-tools-backup-' + todayIso() + '.json', JSON.stringify(out, null, 1), 'application/json');
}

/* ---------- older days need the owner's approval (migration 029) ----------
   In Expenses, Banking, Silver and Chit payments, staff add, change and remove entries dated today or
   yesterday. For an older day they send the change to the owner, who approves or rejects it. */
const yesterdayIso = () => { const d = new Date(); d.setDate(d.getDate() - 1); return iso(d); };
const recentDay = d => !!d && d >= yesterdayIso() && d <= todayIso();
// true when the person signed in may not do this directly because one of these dates is older than yesterday
const needsApproval = (...days) => !!me && !me.is_owner && days.some(d => d && !recentDay(d));
const REQ_APPS = {expenses: 'Expenses', banking: 'Banking', silver: 'Silver', chits: 'Chit scheme'};
const REQ_LABELS = {
  day: 'Date', paid_on: 'Date', amount: 'Amount', category: 'Category', mode: 'Paid by', paid_to: 'Paid to', note: 'Note',
  period_from: 'Covers from', period_to: 'Covers to', gst_claimable: 'GST claimable', gst_rate: 'GST rate %', gstin: 'GSTIN', bill_no: 'Bill number',
  direction: 'In or out', method: 'How', party: 'From / to', reference: 'Reference', for_chit: 'Chit money',
  kind: 'Sale or purchase', item: 'Item', phone: 'Phone', from_supplier: 'From a supplier', pieces: 'Pieces', weight_g: 'Weight (g)', touch: 'Touch %',
  rate: 'Rate', making: 'Making', gst_percent: 'GST %', gold_rate: 'Gold rate'
};
const reqVal = (k, v) => v === null || v === undefined || v === '' ? '–' : typeof v === 'boolean' ? (v ? 'Yes' : 'No')
  : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? parse(String(v)).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'})
  : k === 'amount' || k === 'making' ? '₹' + Number(v).toLocaleString('en-IN') : String(v);
// what the request changes, field by field (ids such as the account are shown in the summary instead)
function reqDiff(q){
  const keys = Object.keys(q.data || {}).filter(k => REQ_LABELS[k]);
  // a new entry: what it says, leaving out blanks, "No", zeros and a period that is just its own day
  const dayOf = q.data.day || q.data.paid_on;
  if(q.action === 'add') return keys.filter(k => ![null, undefined, '', false, 0, '0'].includes(q.data[k]) && !((k === 'period_from' || k === 'period_to') && q.data[k] === dayOf))
    .map(k => REQ_LABELS[k] + ': ' + reqVal(k, q.data[k]));
  if(q.action === 'edit') return keys.filter(k => String(q.data[k] ?? '') !== String((q.before || {})[k] ?? '') && !(Number(q.data[k]) === Number((q.before || {})[k]) && q.data[k] !== '' && q.data[k] !== null && !isNaN(Number(q.data[k]))))
    .map(k => REQ_LABELS[k] + ': ' + reqVal(k, (q.before || {})[k]) + ' → ' + reqVal(k, q.data[k]));
  return [];
}
// ask the owner: o = {app, action: 'add'|'edit'|'delete', target, data, summary}
async function requestChange(o){
  const word = {add: 'add', edit: 'change', delete: 'remove'}[o.action];
  const v = await dialog({
    title: 'Ask the owner to ' + word + ' this', ok: 'Send for approval',
    msg: 'Staff can add, change and remove entries for today and yesterday only. For an older day, the owner approves the change; until then nothing changes.',
    html: '<p class="reqsum">' + esc(o.summary) + '</p>',
    fields: [{id: 'reason', label: 'Why? (the owner will see this)', type: 'textarea', maxlength: 300, placeholder: 'e.g. forgot to enter the bill on Monday'}],
    validate: async v => {
      if(!v.reason) return 'Write a short reason for the owner.';
      must(await sb.rpc('request_change', {p_app: o.app, p_action: o.action, p_target: o.target || null, p_data: o.data || {}, p_reason: v.reason, p_summary: o.summary}));
      return '';
    }
  });
  if(v){ toast('Sent to the owner for approval'); reqBars.forEach(b => b.load()); }
  return !!v;
}
// the list of requests: the owner approves or rejects; the person who asked can take theirs back
function reqItem(q, withApp){
  const when = new Date(q.requested_at).toLocaleString('en-IN', {weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'});
  const word = {add: 'Add', edit: 'Change', delete: 'Remove'}[q.action];
  const diff = reqDiff(q);
  const state = q.status === 'pending' ? '' : '<span class="reqstate ' + q.status + '">' + {approved: 'Approved', rejected: 'Not approved', cancelled: 'Taken back'}[q.status] +
    (q.decided_by_name ? ' by ' + esc(q.decided_by_name) : '') + (q.decision_note ? ': ' + esc(q.decision_note) : '') + '</span>';
  const acts = q.status !== 'pending' ? '' : me && me.is_owner
    ? '<button class="btn mini btn-maroon" type="button" data-req-ok="' + esc(q.id) + '">Approve</button><button class="btn mini" type="button" data-req-no="' + esc(q.id) + '">Reject</button>'
    : me && q.requested_by === me.user_id ? '<button class="btn mini" type="button" data-req-cancel="' + esc(q.id) + '">Take back</button>' : '';
  return '<div class="req"><div class="reqmain"><b>' + (withApp ? esc(REQ_APPS[q.app] || q.app) + ' · ' : '') + word + ': ' + esc(q.summary) + '</b>' +
    (diff.length ? '<span class="reqdiff">' + diff.map(esc).join(' · ') + '</span>' : '') +
    '<span>Asked by ' + esc(q.requested_by_name || 'someone') + ' · ' + esc(when) + ' · “' + esc(q.reason) + '”</span>' + state + '</div>' +
    (acts ? '<div class="acts">' + acts + '</div>' : '') + '</div>';
}
async function loadRequests(app){
  let q = sb.from('change_requests').select('*').order('requested_at', {ascending: false}).limit(60);
  if(app) q = q.eq('app', app);
  if(me && me.is_owner) q = q.eq('status', 'pending');
  else q = q.or('status.eq.pending,decided_at.gte.' + new Date(Date.now() - 7 * 864e5).toISOString());
  return must(await q) || [];
}
async function decideRequest(id, approve){
  let note = '';
  if(!approve){
    const v = await dialog({title: 'Reject this change?', ok: 'Reject', danger: true, fields: [{id: 'note', label: 'Note for them (optional)', type: 'text', maxlength: 300}]});
    if(!v) return false;
    note = v.note;
  }
  must(await sb.rpc('decide_change_request', {p_id: id, p_approve: approve, p_note: note}));
  toast(approve ? 'Approved: the change is made' : 'Rejected');
  return true;
}
// a box at the top of an app page with its requests; onApplied runs after the owner approves one
const reqBars = [];
function requestsBar(app, onApplied){
  let box = document.getElementById('nj-req');
  if(!box){ box = document.createElement('div'); box.id = 'nj-req'; box.className = 'wrap content reqbar'; box.hidden = true; const m = document.querySelector('main'); if(m) m.prepend(box); else return; }
  const bar = {load: async () => {
    if(!me){ box.hidden = true; return; }
    try{
      const list = await loadRequests(app);
      if(box.hidden && list.length){ box.classList.remove('arrive'); void box.offsetWidth; box.classList.add('arrive'); }
      box.hidden = !list.length;
      const pending = list.filter(q => q.status === 'pending').length;
      box.innerHTML = '<div class="form panel reqs"><h3>' + (me.is_owner ? 'Waiting for your approval (' + pending + ')' : 'Your requests to the owner') + '</h3>' + list.map(q => reqItem(q, false)).join('') + '</div>';
    }catch(e){ box.hidden = true; }
  }};
  box.addEventListener('click', e => reqClick(e, () => { bar.load(); if(onApplied) onApplied(); }));
  reqBars.push(bar); bar.load();
  return bar;
}
async function reqClick(e, after){
  const ok = e.target.closest('[data-req-ok]'), no = e.target.closest('[data-req-no]'), cancel = e.target.closest('[data-req-cancel]');
  if(!ok && !no && !cancel) return;
  const b = ok || no || cancel; b.disabled = true;
  try{
    if(cancel){ must(await sb.rpc('cancel_change_request', {p_id: cancel.dataset.reqCancel})); toast('Request taken back'); after(); }
    else if(await decideRequest((ok || no).dataset[ok ? 'reqOk' : 'reqNo'], !!ok)) after();
  }catch(x){ toast(x.message); }
  b.disabled = false;
}

/* ---------- queries on entries (migration 034) ----------
   The owner asks about an entry; the staff member who made it explains; the owner closes it when satisfied. */
const qBars = [];
const qWhen = t => new Date(t).toLocaleString('en-IN', {day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'});
async function loadQueries(app, all){
  let q = sb.from('entry_queries').select('*').order('updated_at', {ascending: false}).limit(500);
  if(app) q = q.eq('app', app);
  q = all ? q.or('status.neq.closed,updated_at.gte.' + new Date(Date.now() - 90 * 864e5).toISOString()) : q.neq('status', 'closed');
  return must(await q) || [];
}
// target id -> its query (an open one first, else the latest closed one)
function queryMap(list){
  const m = new Map();
  list.slice().reverse().forEach(q => { const cur = m.get(q.target_id); if(!cur || cur.status === 'closed' || q.status !== 'closed') m.set(q.target_id, q); });
  return m;
}
function queryState(q){
  if(q.status === 'closed') return 'Query closed';
  if(q.status === 'answered') return me && me.is_owner ? 'Answered: read and close' : 'Answered · waiting for the owner';
  return me && me.is_owner ? 'Query · waiting for ' + (q.asked_of_name || 'staff') : 'The owner asked: please explain';
}
// the small button on an entry that opens its query
function queryChip(q){
  return '<button type="button" class="qchip ' + esc(q.status) + (q.status === 'open' && me && !me.is_owner || q.status === 'answered' && me && me.is_owner ? ' mine' : '') + '" data-q-open="' + esc(q.id) + '">' + esc(queryState(q)) + '</button>';
}
async function askQuery(o){
  const v = await dialog({title: 'Query this entry', ok: 'Send query',
    msg: (o.who ? o.who + ' made this entry. They' : 'The person who made this entry') + ' will be told and asked to explain. You close the query when you are okay with it.',
    html: '<p class="reqsum">' + esc(o.summary) + '</p>',
    fields: [{id: 'q', label: 'Your question', type: 'textarea', maxlength: 500, placeholder: 'e.g. What is this interest for? Please share the bill.'}],
    validate: async v => {
      if(!v.q) return 'Write your question.';
      must(await sb.rpc('ask_query', {p_app: o.app, p_target: o.target, p_question: v.q, p_summary: o.summary}));
      return '';
    }});
  if(v){ toast('Query sent'); qBars.forEach(b => b.load()); }
  return !!v;
}
async function openQuery(id){
  let q;
  try{ q = must(await sb.from('entry_queries').select('*').eq('id', id).maybeSingle()); }catch(x){ toast(friendly(x)); return false; }
  if(!q){ toast('That query is not there any more.'); return false; }
  const owner = me && me.is_owner, mineToAnswer = !owner && me && q.asked_of === me.user_id && q.status !== 'closed';
  const thread = '<p class="reqsum">' + esc(q.summary) + '</p><div class="qthread">' + (q.messages || []).map(m =>
    '<div class="qmsg' + (m.owner ? ' owner' : '') + '"><span>' + esc(m.by_name || (m.owner ? 'Owner' : 'Staff')) + ' · ' + esc(qWhen(m.at)) + '</span><p>' + esc(m.body) + '</p></div>').join('') + '</div>' +
    (q.status === 'closed' ? '<p class="qclosed">Closed by ' + esc(q.closed_by_name || 'the owner') + (q.closed_at ? ' · ' + esc(qWhen(q.closed_at)) : '') + '</p>' : '');
  const title = 'Query to ' + (q.asked_of_name || 'staff');
  let v;
  if(owner){
    v = await dialog({title, html: thread, cancel: 'Back',
      ok: q.status === 'closed' ? 'Open again and send' : 'Send reply',
      extra: q.status === 'closed' ? null : {label: 'Close: I’m okay with it', value: 'close', btn: 'btn-green', withValues: true},
      fields: [{id: 'm', label: q.status === 'closed' ? 'Ask again (opens the query again)' : 'Reply (optional when closing)', type: 'textarea', maxlength: 500}],
      validate: async v => {
        if(!v.m) return 'Write a reply, or press “Close” if you are okay with it.';
        must(await sb.rpc('reply_query', {p_id: q.id, p_body: v.m}));
        return '';
      }});
    if(v && v.extra === 'close'){
      try{ must(await sb.rpc('close_query', {p_id: q.id, p_note: v.m || ''})); toast('Query closed'); }catch(x){ toast(friendly(x)); return false; }
    } else if(v) toast('Reply sent to ' + (q.asked_of_name || 'staff'));
  } else if(mineToAnswer){
    v = await dialog({title: 'The owner asked about your entry', html: thread, ok: 'Send explanation', cancel: 'Later',
      fields: [{id: 'm', label: q.status === 'answered' ? 'Add more (optional)' : 'Your explanation', type: 'textarea', maxlength: 500, placeholder: 'e.g. Interest paid to Jothimani for August, bill is in the file.'}],
      validate: async v => {
        if(!v.m) return 'Write your explanation.';
        must(await sb.rpc('reply_query', {p_id: q.id, p_body: v.m}));
        return '';
      }});
    if(v) toast('Sent to the owner');
  } else {
    await dialog({title, html: thread, ok: 'OK', cancel: null});
  }
  if(v) qBars.forEach(b => { b.load(); if(b.changed) b.changed(); });
  return !!v;
}
// a box at the top of an app page with the queries still open; onChange runs after one changes
function queriesBar(app, onChange){
  let box = document.getElementById('nj-qry');
  if(!box){ box = document.createElement('div'); box.id = 'nj-qry'; box.className = 'wrap content reqbar'; box.hidden = true; const m = document.querySelector('main'); if(m) m.prepend(box); else return; }
  const bar = {list: [], load: async () => {
    if(!me){ box.hidden = true; return; }
    try{
      const list = bar.list = await loadQueries(app, false);
      const first = (s => list.filter(q => q.status === s));
      const need = me.is_owner ? first('answered') : first('open'), wait = me.is_owner ? first('open') : first('answered');
      box.hidden = !list.length;
      const item = q => { const last = (q.messages || [])[q.messages.length - 1] || {};
        return '<div class="req"><div class="reqmain"><b>' + esc(q.summary || 'Entry') + '</b><span>' + esc((last.by_name || '') + ': “' + (last.body || '') + '”') + ' · ' + esc(qWhen(q.updated_at)) + '</span></div>' +
          '<div class="acts">' + queryChip(q) + '</div></div>'; };
      box.innerHTML = '<div class="form panel reqs">' +
        (need.length ? '<h3>' + (me.is_owner ? 'Queries answered: read and close (' + need.length + ')' : 'The owner asked about your entries (' + need.length + ')') + '</h3>' + need.map(item).join('') : '') +
        (wait.length ? '<h3' + (need.length ? ' style="margin-top:14px"' : '') + '>' + (me.is_owner ? 'Queries waiting for staff (' + wait.length + ')' : 'Explained, waiting for the owner (' + wait.length + ')') + '</h3>' + wait.map(item).join('') : '') + '</div>';
    }catch(e){ box.hidden = true; }
  }, changed: onChange};
  qBars.push(bar); bar.load();
  const fromHash = () => { const m = /^#q=([0-9a-f-]{36})$/.exec(location.hash); if(m){ history.replaceState(null, '', location.pathname + location.search); openQuery(m[1]); } };
  window.addEventListener('hashchange', fromHash); fromHash();
  return bar;
}
// a page that shows queries some other way hears when one changes
function queryListen(fn){ qBars.push({load(){}, changed: fn}); }
// any [data-q-open] button on any page opens that query
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-q-open]'); if(!b) return;
  e.preventDefault(); e.stopPropagation(); b.disabled = true;
  await openQuery(b.dataset.qOpen);
  b.disabled = false;
}, true);

window.NJ = {exportAll, rateStatus, sb, start, signInFlow, setupFlow, signOut, people, dialog, ask, toast, download, esc, must, friendly,
  pad, iso, parse, todayIso, canUse, DEVICE_KEY, presenceText, matchExpenses, taskMeter, meterBar, meterHtml, APPS, ROOT, PIN_RE, loadNotes, icon, showRecoveryCode,
  liveCheck, deviceCode, recentDay, needsApproval, requestChange, requestsBar, loadRequests, reqItem, reqClick,
  loadQueries, queryMap, queryChip, askQuery, openQuery, queriesBar, queryListen, get me(){ return me; }};
})();
