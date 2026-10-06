/* DEMO ONLY: an in-browser stand-in for the Supabase project, filled with sample data.
   The demo build loads this before supabase-js, so every request to the project is answered
   here instead of the real database. Never part of the real site. */
(function(){
'use strict';
const BASE = 'https://uottxgpjgakinqprexsp.supabase.co';
const KEY = 'natraj-demo-db-v1';
const APPS = ['attendance'];
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); };
const dow = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
const now = () => new Date().toISOString();

function seed(){
  const staff = [['Senthil Kumar', 'Store Manager'], ['Ponraj', 'Sales'], ['Narasimman', 'Sales'], ['Anand', 'Goldsmith']]
    .map(([name, designation]) => ({id: uid(), name, designation, phone: '', joined: null, active: true, created_at: now()}));
  const owner = {user_id: uid(), name: 'Owner', username: 'owner', is_owner: true, apps: APPS, staff_id: null, created_at: now()};
  const senthil = {user_id: uid(), name: 'Senthil Kumar', username: 'senthil-kumar', is_owner: false, apps: ['attendance'], staff_id: staff[0].id, created_at: now()};
  const db = {
    staff, profiles: [owner, senthil], settings: [{id: 1, weekly_off: 0}], attendance: [], leave_requests: [],
    users: {owner: {id: owner.user_id, pin: '111111', recovery: 'DEMO-2026'}, 'senthil-kumar': {id: senthil.user_id, pin: '222222'}},
    tokens: {}
  };
  // last month and this month up to yesterday, with a fixed pattern so the demo looks the same each time
  const today = iso(new Date());
  const t = new Date(); const start = iso(new Date(t.getFullYear(), t.getMonth() - 1, 1));
  let r = 7;
  const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  for(let d = start; d < today; d = addDays(d, 1)){
    staff.forEach((s, i) => {
      let st;
      if(dow(d) === 0) st = 'WO';
      else { const x = rnd(); st = x < .74 ? 'P' : x < .82 ? (i === 3 ? 'T' : 'HM') : x < .9 ? 'H' : x < .95 ? 'LA' : 'A'; }
      db.attendance.push({staff_id: s.id, day: d, status: st, note: '', leave_id: null, marked_by: senthil.user_id, marked_by_name: 'Senthil Kumar', marked_at: d + 'T09:45:00Z'});
    });
  }
  // today: two people already marked
  [[0, 'P'], [3, 'P']].forEach(([i, st]) => db.attendance.push({staff_id: staff[i].id, day: today, status: st, note: '', leave_id: null, marked_by: senthil.user_id, marked_by_name: 'Senthil Kumar', marked_at: now()}));
  // leave waiting for approval
  const leave = (s, from, to, half, reason, status) => ({id: uid(), staff_id: s.id, from_day: from, to_day: to, half, reason, status, created_at: now(), decided_by_name: status === 'pending' ? '' : 'Owner', decided_at: status === 'pending' ? null : now()});
  db.leave_requests.push(
    leave(staff[1], addDays(today, 3), addDays(today, 4), false, 'Family wedding in Madurai', 'pending'),
    leave(staff[2], addDays(today, 1), addDays(today, 1), true, 'Bank work in the morning', 'pending'),
    leave(staff[3], addDays(today, -9), addDays(today, -8), false, 'Fever', 'approved')
  );
  return db;
}
let db;
try{ db = JSON.parse(localStorage.getItem(KEY)) || seed(); }catch(e){ db = seed(); }
const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(db)); }catch(e){} };
save();
window.NJ_DEMO = {reset(){ try{ localStorage.removeItem(KEY); localStorage.removeItem('natraj-tools-auth'); }catch(e){} location.reload(); }};

const b64 = o => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
function session(username){
  const u = db.users[username];
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const t = b64({alg: 'HS256', typ: 'JWT'}) + '.' + b64({sub: u.id, exp, role: 'authenticated', aud: 'authenticated'}) + '.demo';
  db.tokens[t] = u.id; save();
  return {access_token: t, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'demo-' + username,
    user: {id: u.id, aud: 'authenticated', role: 'authenticated', email: username + '@staff.natraj-tools.app', app_metadata: {}, user_metadata: {}, created_at: now()}};
}
const meOf = token => db.profiles.find(p => p.user_id === db.tokens[token]);
const canUse = (p, app) => !!p && (p.is_owner || p.apps.includes(app));
const isOff = day => db.settings[0].weekly_off === dow(day);

function cmp(a, op, b){
  a = a === null || a === undefined ? (op === 'is' ? 'null' : '') : String(a);
  if(op === 'eq' || op === 'is') return a === b;
  if(op === 'gte') return a >= b;
  if(op === 'lte') return a <= b;
  return true;
}
function matches(row, params){
  for(const [k, v] of params){
    if(['select', 'order', 'on_conflict', 'limit', 'columns'].includes(k)) continue;
    if(k === 'or'){
      if(!v.replace(/^\(|\)$/g, '').split(',').some(p => { const [c, op, ...val] = p.split('.'); return cmp(row[c], op, val.join('.')); })) return false;
      continue;
    }
    const [op, ...val] = v.split('.');
    if(!cmp(row[k], op, val.join('.'))) return false;
  }
  return true;
}
function stamp(row, me){ row.marked_by = me.user_id; row.marked_by_name = me.name; row.marked_at = now(); return row; }

/* the "people" edge function */
function people(body, me){
  const err = (error, status) => ({status: status || 400, body: {error}});
  const pinOk = p => /^\d{6}$/.test(String(p || ''));
  const create = (name, pin, isOwner, apps, staffId) => {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'user';
    let u = base, i = 2; while(db.users[u]) u = base + '-' + i++;
    const id = uid();
    db.users[u] = {id, pin};
    db.profiles.push({user_id: id, name, username: u, is_owner: isOwner, apps: isOwner ? APPS : apps, staff_id: staffId || null, created_at: now()});
    return {user_id: id, username: u};
  };
  const owners = () => db.profiles.filter(p => p.is_owner).length;
  switch(body.action){
    case 'setup':
      if(owners()) return err('The owner is already set up. Sign in instead.', 409);
      return {status: 200, body: Object.assign(create(body.name, body.pin, true, [], null), {recovery: 'DEMO-2026'})};
    case 'recover': {
      if(!pinOk(body.pin)) return err('The new PIN must be 6 digits.');
      const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const name = Object.keys(db.users).find(k => (db.users[k].recovery || '').replace('-', '') === code);
      if(!name) return err('That recovery code is not right. (Demo code: DEMO-2026)', 403);
      db.users[name].pin = body.pin;
      return {status: 200, body: {username: name}};
    }
  }
  if(!me) return err('Sign in first.', 401);
  if(!me.is_owner) return err('Only the owner can do this.', 403);
  const t = db.profiles.find(p => p.user_id === body.user_id);
  switch(body.action){
    case 'add':
      if(!body.name) return err('Type their name.');
      if(!pinOk(body.pin)) return err('The PIN must be 6 digits.');
      return {status: 200, body: create(body.name, body.pin, !!body.is_owner, (body.apps || []).filter(a => APPS.includes(a)), body.staff_id)};
    case 'update':
      if(!t) return err('That person no longer exists.', 404);
      if(t.is_owner && body.is_owner === false && owners() <= 1) return err('Keep at least one owner.', 409);
      ['name', 'is_owner', 'apps', 'staff_id'].forEach(k => { if(body[k] !== undefined) t[k] = body[k]; });
      if(t.is_owner) t.apps = APPS;
      if(body.pin !== undefined){ if(!pinOk(body.pin)) return err('The PIN must be 6 digits.'); db.users[t.username].pin = body.pin; }
      return {status: 200, body: {ok: true}};
    case 'remove':
      if(!t) return err('That person no longer exists.', 404);
      if(t.is_owner && owners() <= 1) return err('Keep at least one owner.', 409);
      db.profiles = db.profiles.filter(p => p !== t); delete db.users[t.username];
      return {status: 200, body: {ok: true}};
    case 'new_recovery':
      db.users[me.username].recovery = 'DEMO-2026';
      return {status: 200, body: {recovery: 'DEMO-2026'}};
  }
  return err('Unknown action.');
}

/* database functions */
function rpc(name, a, me){
  const pg = message => ({status: 400, body: {code: '22023', message, details: null, hint: null}});
  switch(name){
    case 'setup_needed': return {status: 200, body: !db.profiles.some(p => p.is_owner)};
    case 'login_names': return {status: 200, body: db.profiles.map(p => ({name: p.name, username: p.username})).sort((x, y) => x.name.localeCompare(y.name))};
    case 'leave_staff': return {status: 200, body: db.staff.filter(s => s.active).map(s => ({id: s.id, name: s.name})).sort((x, y) => x.name.localeCompare(y.name))};
    case 'request_leave': {
      if(!db.staff.some(s => s.id === a.p_staff && s.active)) return pg('Choose your name.');
      const to = a.p_half ? a.p_from : (a.p_to || a.p_from);
      if(to < a.p_from) return pg('The last day is before the first day.');
      const l = {id: uid(), staff_id: a.p_staff, from_day: a.p_from, to_day: to, half: !!a.p_half, reason: (a.p_reason || '').slice(0, 200), status: 'pending', created_at: now(), decided_by_name: '', decided_at: null};
      db.leave_requests.push(l);
      return {status: 200, body: l.id};
    }
    case 'decide_leave': {
      if(!canUse(me, 'attendance')) return {status: 403, body: {code: '42501', message: 'Sign in to decide leave.'}};
      const l = db.leave_requests.find(x => x.id === a.p_id);
      if(!l) return pg('That request no longer exists.');
      let skipped = 0;
      if(a.p_decision === 'approved'){
        if(l.status !== 'pending') return pg('This request was already decided.');
        for(let d = l.from_day; d <= l.to_day; d = addDays(d, 1)){
          if(!l.half && isOff(d)) continue;
          const cur = db.attendance.find(x => x.staff_id === l.staff_id && x.day === d);
          if(cur && cur.status && !['A', 'LA', 'WO'].includes(cur.status) && !cur.leave_id){ skipped++; continue; }
          const row = cur || {staff_id: l.staff_id, day: d};
          Object.assign(row, {status: l.half ? 'H' : 'LA', note: l.reason ? 'Leave: ' + l.reason : 'Leave approved', leave_id: l.id});
          stamp(row, me); if(!cur) db.attendance.push(row);
        }
      } else if(a.p_decision === 'rejected'){
        if(l.status !== 'pending') return pg('This request was already decided.');
      } else if(a.p_decision === 'cancelled'){
        if(l.status !== 'approved') return pg('Only approved leave can be cancelled.');
        db.attendance = db.attendance.filter(x => x.leave_id !== l.id);
      } else return pg('Unknown decision.');
      Object.assign(l, {status: a.p_decision, decided_by_name: me.name, decided_at: now()});
      return {status: 200, body: skipped};
    }
  }
  return {status: 404, body: {message: 'Unknown function ' + name}};
}

/* tables, with the same access rules as the real database */
function rest(method, table, params, body, headers, me){
  const denied = {status: 403, body: {code: '42501', message: 'permission denied'}};
  if(!me) return {status: 401, body: {message: 'permission denied'}};
  const rule = {
    staff: {read: true, write: me.is_owner}, profiles: {read: true, write: false}, settings: {read: true, write: me.is_owner},
    attendance: {read: canUse(me, 'attendance'), write: canUse(me, 'attendance')},
    leave_requests: {read: canUse(me, 'attendance'), write: me.is_owner}
  }[table];
  if(!rule) return {status: 404, body: {message: 'Unknown table'}};
  if(method === 'GET' ? !rule.read : !rule.write) return denied;
  let rows = db[table];
  if(table === 'profiles' && !me.is_owner) rows = rows.filter(p => p.user_id === me.user_id);
  const single = /vnd\.pgrst\.object/.test(headers.get('accept') || '');
  const wantRows = /return=representation/.test(headers.get('prefer') || '');
  let out;
  if(method === 'GET'){
    out = rows.filter(r => matches(r, params));
    const ord = params.get('order');
    if(ord){ const [c, dir] = ord.split('.'); out = out.slice().sort((x, y) => String(x[c]).localeCompare(String(y[c])) * (dir === 'desc' ? -1 : 1)); }
  } else if(method === 'POST'){
    out = [];
    for(const item of (Array.isArray(body) ? body : [body])){
      let row;
      if(table === 'attendance'){
        if(!item.status && !item.note) continue;
        row = db.attendance.find(x => x.staff_id === item.staff_id && x.day === item.day);
        if(row){ if(item.status !== row.status) row.leave_id = null; Object.assign(row, item); }
        else { row = Object.assign({note: '', leave_id: null}, item); db.attendance.push(row); }
        stamp(row, me);
      } else {
        row = Object.assign({id: uid(), designation: '', phone: '', joined: null, active: true, created_at: now()}, item);
        db[table].push(row);
      }
      out.push(row);
    }
  } else if(method === 'PATCH'){
    out = db[table].filter(r => matches(r, params)); out.forEach(r => Object.assign(r, body));
  } else if(method === 'DELETE'){
    out = db[table].filter(r => matches(r, params));
    db[table] = db[table].filter(r => !out.includes(r));
    if(table === 'staff'){
      const ids = out.map(s => s.id);
      db.attendance = db.attendance.filter(r => !ids.includes(r.staff_id));
      db.leave_requests = db.leave_requests.filter(r => !ids.includes(r.staff_id));
    }
  }
  if(method !== 'GET' && !wantRows) return {status: 204, body: null};
  if(single){
    if(!out.length && method === 'GET') return {status: 406, body: {code: 'PGRST116', message: 'No rows'}};
    return {status: 200, body: out[0] || null};
  }
  return {status: 200, body: out};
}

async function answer(url, init){
  const u = new URL(url);
  const headers = new Headers(init.headers || {});
  const token = (headers.get('authorization') || '').replace(/^Bearer /, '');
  const me = meOf(token);
  let body = null;
  if(init.body){ try{ body = JSON.parse(typeof init.body === 'string' ? init.body : await new Response(init.body).text()); }catch(e){} }
  const method = (init.method || 'GET').toUpperCase();
  const p = u.pathname;
  let res;
  if(p === '/auth/v1/token'){
    if(u.searchParams.get('grant_type') === 'refresh_token'){
      const name = String(body.refresh_token || '').replace(/^demo-/, '');
      res = db.users[name] ? {status: 200, body: session(name)} : {status: 400, body: {error_code: 'refresh_token_not_found', message: 'Invalid Refresh Token'}};
    } else {
      const name = String(body.email || '').split('@')[0], user = db.users[name];
      res = user && 'natraj-' + user.pin === body.password ? {status: 200, body: session(name)}
        : {status: 400, body: {code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials', message: 'Invalid login credentials'}};
    }
  } else if(p === '/auth/v1/user'){
    res = me ? {status: 200, body: session(me.username).user} : {status: 401, body: {message: 'invalid JWT'}};
  } else if(p === '/auth/v1/logout'){
    delete db.tokens[token]; res = {status: 204, body: null};
  } else if(p === '/functions/v1/people') res = people(body || {}, me);
  else if(p.startsWith('/rest/v1/rpc/')) res = rpc(p.split('/').pop(), body || {}, me);
  else if(p.startsWith('/rest/v1/')) res = rest(method, p.split('/').pop(), u.searchParams, body, headers, me);
  else res = {status: 404, body: {message: 'Not found'}};
  save();
  await new Promise(r => setTimeout(r, 120));      // feel like a real network
  return new Response(res.body === null ? null : JSON.stringify(res.body), {status: res.status, headers: {'Content-Type': 'application/json'}});
}

const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);
  if(!url.startsWith(BASE)) return realFetch(input, init);
  const opts = Object.assign({}, init || {});
  if(input instanceof Request){
    opts.method = opts.method || input.method;
    opts.headers = opts.headers || input.headers;
    if(opts.body === undefined && !['GET', 'HEAD'].includes(input.method)) opts.body = await input.clone().text();
  }
  return answer(url, opts);
};

/* banner so nobody mistakes the demo for the real thing */
document.addEventListener('DOMContentLoaded', () => {
  const b = document.createElement('div');
  b.setAttribute('role', 'note');
  b.style.cssText = 'background:#E7D3AE;color:#3B2420;font:500 .85rem/1.4 Figtree,system-ui,sans-serif;padding:8px 16px;display:flex;flex-wrap:wrap;gap:6px 16px;justify-content:center;align-items:center;text-align:center';
  b.innerHTML = '<span><b>Demo with sample data.</b> Nothing here is saved online.</span><span>Owner PIN <b>111111</b> · Senthil Kumar PIN <b>222222</b></span>' +
    '<button type="button" style="font:600 .8rem Figtree,system-ui,sans-serif;border:1px solid #3B2420;background:transparent;color:#3B2420;border-radius:999px;padding:4px 12px;cursor:pointer">Reset demo</button>';
  b.querySelector('button').onclick = () => window.NJ_DEMO.reset();
  document.body.prepend(b);
});
})();
