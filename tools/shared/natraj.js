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
  rates: {name: 'Gold & silver rate', path: 'rates/', desc: 'Today’s rate, WhatsApp message and history.', everyone: true, access: 'Updates the daily rate', short: 'Daily rate'}
};

const ROOT = (document.currentScript && document.currentScript.src || '').replace(/shared\/natraj\.js.*$/, '');
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {persistSession: true, autoRefreshToken: true, storageKey: 'natraj-tools-auth'}
});
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
  const err = f.querySelector('.err'), ok = f.querySelector('[data-ok]');
  const values = () => {
    const v = {};
    (o.fields || []).forEach(x => { const el = $('nj-f-' + x.id); v[x.id] = x.type === 'checkbox' ? el.checked : el.value.trim(); });
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

async function loadMe(session){
  if(!session){ me = null; return; }
  const r = await sb.from('profiles').select('*').eq('user_id', session.user.id).maybeSingle();
  me = r.data || null;
  if(!me && !r.error){ await sb.auth.signOut(); }   // account was removed
}

function renderAccess(opts){
  const a = $('access'); if(!a) return;
  const home = opts.home ? '' : '<a class="btn btn-on-dark" href="' + ROOT + '">All apps</a>';
  a.innerHTML = me
    ? '<span>Signed in as <b>' + esc(me.name) + '</b></span>' + home + '<button class="btn btn-on-dark" type="button" data-nj-out>Sign out</button>'
    : home + '<button class="btn btn-gold" type="button" data-nj-in>Sign in</button>';
  document.body.classList.toggle('signed-in', !!me);
  document.body.classList.toggle('signed-out', !me);
  document.body.classList.toggle('not-owner', !(me && me.is_owner));
}
document.addEventListener('click', e => {
  if(e.target.closest('[data-nj-in]')) signInFlow();
  if(e.target.closest('[data-nj-out]')) signOut();
});

window.addEventListener('offline', () => { let b = $('nj-offline'); if(!b){ b = document.createElement('div'); b.id = 'nj-offline'; b.className = 'offline'; b.textContent = 'No internet connection. Changes will not be saved until it is back.'; document.body.appendChild(b); } b.hidden = false; });
window.addEventListener('online', () => { const b = $('nj-offline'); if(b) b.hidden = true; });

/* Pages call this once. opts: {home: true on the home page, onReady(me)}.
   onReady runs after sign-in state is known, and again whenever it changes. */
async function start(opts){
  onChange = opts.onReady || (() => {});
  const y = $('year'); if(y) y.textContent = new Date().getFullYear();
  const {data} = await sb.auth.getSession();
  await loadMe(data.session);
  renderAccess(opts); touch();
  await onChange(me);
  let lastUser = me && me.user_id;
  sb.auth.onAuthStateChange((event, session) => {
    if(event === 'TOKEN_REFRESHED') return;
    setTimeout(async () => {          // run outside the auth callback, as supabase-js recommends
      await loadMe(session);
      const uid = me && me.user_id;
      if(uid === lastUser && event !== 'USER_UPDATED') return;
      lastUser = uid;
      renderAccess(opts); touch();
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
const TABLES = ['staff', 'profiles', 'settings', 'attendance', 'leave_requests', 'rates'];
async function exportAll(){
  const out = {exported_at: new Date().toISOString(), tables: {}};
  for(const t of TABLES) out.tables[t] = must(await sb.from(t).select('*'));
  download('natraj-tools-backup-' + todayIso() + '.json', JSON.stringify(out, null, 1), 'application/json');
}

window.NJ = {exportAll, rateStatus, sb, start, signInFlow, setupFlow, signOut, people, dialog, ask, toast, download, esc, must, friendly,
  pad, iso, parse, todayIso, canUse, APPS, ROOT, PIN_RE, showRecoveryCode, get me(){ return me; }};
})();
