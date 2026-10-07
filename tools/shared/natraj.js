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
  campaigns: {name: 'Marketing campaigns', path: 'campaigns/', desc: 'Plan festival and season campaigns, send the offer on WhatsApp to chosen customers, and see who came, what they bought and what it cost.', short: 'Campaigns'}
};

/* Line icons for the app tiles (24×24, drawn with the current text colour). New apps add one here. */
const ICONS = {
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
  silver: '<path d="M4 15h16l-2 5H6z"/><path d="M7 15l1.5-5h7L17 15M10 10l.8-3h2.4l.8 3"/>',
  chits: '<ellipse cx="12" cy="6.5" rx="7" ry="2.5"/><path d="M5 6.5v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4M5 10.5v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4M5 14.5v3c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-3"/>',
  leave: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M9.5 15h5"/>'
};
const icon = k => ICONS[k] ? '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[k] + '</svg>' : '';

const ROOT = (document.currentScript && document.currentScript.src || '').replace(/shared\/natraj\.js.*$/, '');
// each browser keeps a random device key and sends it with every request; the owner can approve the
// shop's computer, and when "staff only on approved devices" is on, the database answers staff only there
const DEVICE_KEY = (() => {
  try{
    let k = localStorage.getItem('natraj-device');
    if(!k || k.length < 32){ k = [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem('natraj-device', k); }
    return k;
  }catch(e){ return ''; }
})();
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
  if(!t){ t = document.createElement('div'); t.id = 'nj-toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2600);
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
    else if(x.type === 'code') h += '<input class="input" id="' + id + '" type="text" autocomplete="off" autocapitalize="characters" maxlength="9" style="text-transform:uppercase"' + ph + '>';
    else h += '<input class="input" id="' + id + '" type="' + (x.type || 'text') + '" autocomplete="off" maxlength="' + (x.maxlength || 60) + '" value="' + esc(x.value || '') + '"' + ph + '>';
    h += '</label>';
  });
  if(o.extra) h += '<button type="button" class="linkish" data-extra>' + esc(o.extra.label) + '</button>';
  h += '<p class="err" role="alert"></p><div class="actions">' +
    (o.cancel === null ? '' : '<button type="button" class="btn" data-cancel>' + esc(o.cancel || 'Cancel') + '</button>') +
    '<button type="submit" class="btn ' + (o.danger ? 'btn-red' : 'btn-maroon') + '" data-ok>' + esc(o.ok || 'OK') + '</button></div>';
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
    const close = r => { result = r; d.close(); };
    d.addEventListener('close', () => { d.remove(); res(result); });
    d.addEventListener('cancel', () => { result = null; });
    const c = f.querySelector('[data-cancel]'); if(c) c.onclick = () => close(null);
    const ex = f.querySelector('[data-extra]'); if(ex) ex.onclick = () => close(o.extra.value);
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
    msg: 'Owners: enter the recovery code you wrote down, and choose a new PIN. Everyone else: ask the owner to set a new PIN for you.',
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
const PAGES = {dashboard: 'Dashboard', people: 'People & settings', report: 'Report card'};
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

let blocked = false;
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
    '<div class="bar"><button class="btn btn-maroon" type="button" data-nj-out>Sign out</button><a class="btn" href="' + ROOT + 'attendance/#leave" data-nj-leave>Apply for leave</a></div></div>';
  return true;
}
async function loadMe(session){
  if(!session){ me = null; return; }
  const r = await sb.from('profiles').select('*').eq('user_id', session.user.id).maybeSingle();
  me = r.data || null;
  if(!me && !r.error){ await sb.auth.signOut(); }   // account was removed
  // staff on a device the owner has not approved, while the lock is on: the database gives them nothing
  blocked = false;
  if(me && !me.is_owner){ const d = await sb.rpc('device_status'); blocked = !!(d.data && d.data.ok === false); }
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
async function start(opts){
  onChange = opts.onReady || (() => {});
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
  if(showBlocked()) return;
  await onChange(me);
  let lastUser = me && me.user_id;
  sb.auth.onAuthStateChange((event, session) => {
    if(event === 'TOKEN_REFRESHED') return;
    setTimeout(async () => {          // run outside the auth callback, as supabase-js recommends
      await loadMe(session);
      const uid = me && me.user_id;
      if(uid === lastUser && event !== 'USER_UPDATED') return;
      lastUser = uid;
      renderAccess(opts); touch(); loadNotes(); heartbeat(true);
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

const TABLES = ['staff', 'profiles', 'settings', 'attendance', 'leave_requests', 'rates', 'tasks', 'expenses', 'bank_accounts', 'bank_entries', 'customers', 'customer_activity', 'designs', 'chit_plans', 'chit_members', 'chit_payments', 'silver_entries', 'report_cards', 'campaigns', 'campaign_contacts', 'campaign_costs'];
async function exportAll(){
  const out = {exported_at: new Date().toISOString(), tables: {}};
  for(const t of TABLES) out.tables[t] = must(await sb.from(t).select('*'));
  download('natraj-tools-backup-' + todayIso() + '.json', JSON.stringify(out, null, 1), 'application/json');
}

window.NJ = {exportAll, rateStatus, sb, start, signInFlow, setupFlow, signOut, people, dialog, ask, toast, download, esc, must, friendly,
  pad, iso, parse, todayIso, canUse, DEVICE_KEY, presenceText, matchExpenses, taskMeter, meterBar, meterHtml, APPS, ROOT, PIN_RE, loadNotes, icon, showRecoveryCode, get me(){ return me; }};
})();
