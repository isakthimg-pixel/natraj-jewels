/* DEMO ONLY: an in-browser stand-in for the Supabase project, filled with sample data.
   The demo build loads this before supabase-js, so every request to the project is answered
   here instead of the real database. Never part of the real site. */
(function(){
'use strict';
const BASE = 'https://uottxgpjgakinqprexsp.supabase.co';
const KEY = 'natraj-demo-db-v9';
const APPS = ['attendance', 'rates', 'todo', 'expenses'];
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); };
const dow = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
const now = () => new Date().toISOString();

function seed(){
  const staff = [['Sample Staff 1', 'Manager'], ['Sample Staff 2', 'Sales'], ['Sample Staff 3', 'Sales'], ['Sample Staff 4', 'Goldsmith']]
    .map(([name, designation]) => ({id: uid(), name, designation, phone: '', joined: null, active: true, created_at: now()}));
  const owner = {user_id: uid(), name: 'Owner', username: 'owner', is_owner: true, apps: APPS, staff_id: null, created_at: now()};
  const manager = {user_id: uid(), name: 'Sample Manager', username: 'sample-manager', is_owner: false, apps: ['attendance', 'rates', 'todo', 'expenses'], staff_id: staff[0].id, created_at: now()};
  const worker = {user_id: uid(), name: 'Sample Staff 2', username: 'sample-staff-2', is_owner: false, apps: [], staff_id: staff[1].id, created_at: now()};
  const db = {
    staff, profiles: [owner, manager, worker], settings: [{id: 1, weekly_off: 0, rate_due: '10:30:00', expense_categories: ['Salary & wages', 'Rent', 'Electricity', 'Tea & snacks', 'Staff food', 'Transport & petrol', 'Packing & boxes', 'Repairs & maintenance', 'Hallmarking', 'Stationery & printing', 'Advertising', 'Pooja & festival', 'Bank charges', 'Insurance', 'Other']}], attendance: [], leave_requests: [], rates: [], tasks: [], expenses: [],
    users: {owner: {id: owner.user_id, pin: '111111', recovery: 'DEMO-2026'}, 'sample-manager': {id: manager.user_id, pin: '222222'}, 'sample-staff-2': {id: worker.user_id, pin: '333333'}},
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
      db.attendance.push({staff_id: s.id, day: d, status: st, note: '', leave_id: null, marked_by: manager.user_id, marked_by_name: 'Sample Manager', marked_at: d + 'T09:45:00Z'});
    });
  }
  // today: two people already marked
  [[0, 'P'], [3, 'P']].forEach(([i, st]) => db.attendance.push({staff_id: staff[i].id, day: today, status: st, note: '', leave_id: null, marked_by: manager.user_id, marked_by_name: 'Sample Manager', marked_at: now()}));
  // leave waiting for approval
  const leave = (s, from, to, half, reason, status) => ({id: uid(), staff_id: s.id, from_day: from, to_day: to, half, reason, status, created_at: now(), decided_by_name: status === 'pending' ? '' : 'Owner', decided_at: status === 'pending' ? null : now()});
  db.leave_requests.push(
    leave(staff[1], addDays(today, 3), addDays(today, 4), false, 'Family wedding in Madurai', 'pending'),
    leave(staff[2], addDays(today, 1), addDays(today, 1), true, 'Bank work in the morning', 'pending'),
    leave(staff[3], addDays(today, -9), addDays(today, -8), false, 'Fever', 'approved')
  );
  // a year of rate history: a gentle random walk, changed most mornings, sometimes again in the afternoon
  let g = 6650, sv = 88;
  for(let d = addDays(today, -365); d <= today; d = addDays(d, 1)){
    if(dow(d) === 0) continue;
    g = Math.round((g + (rnd() - 0.47) * 40) / 5) * 5; sv = Math.round((sv + (rnd() - 0.48) * 1.0) * 10) / 10;
    const at = (h, m) => { const [y, mo, dd] = d.split('-').map(Number); return new Date(y, mo - 1, dd, h, m).toISOString(); };
    const push = t => db.rates.push({id: uid(), set_at: t, gold_22k: g, gold_24k: Math.round(g * 1.0909), gold_18k: Math.round(g * 0.8182), silver: sv, note: '', set_by: manager.user_id, set_by_name: 'Sample Manager'});
    if(d === today){ if(new Date().getHours() >= 10) push(at(10, 15)); continue; }
    push(at(10, 15));
    if(rnd() < 0.15){ g += 20; push(at(15, 30)); }
  }
  // tasks: some open, one late, one done
  const task = (title, to, by, due, high, details, done) => ({id: uid(), title, details: details || '', assigned_to: to.user_id, assigned_name: to.name, due, high: !!high,
    status: done ? 'done' : 'open', done_note: done || '', done_at: done ? addDays(today, -1) + 'T17:20:00Z' : null, done_by_name: done ? to.name : '',
    created_by: by.user_id, created_by_name: by.name, created_at: addDays(today, -3) + 'T10:00:00Z'});
  db.tasks.push(
    task('Polish the silver display', worker, manager, today, false, 'Front counter and the window shelf.'),
    task('Call Ramesh about the bangle order', worker, owner, addDays(today, -1), true, 'He wants the 22K pair by Saturday.'),
    task('Count the 916 chain stock', manager, owner, addDays(today, 2), false),
    task('Order new jewel boxes', manager, owner, null, false, '100 small red boxes.'),
    task('Clean the hallmark machine', worker, manager, addDays(today, -1), false, '', 'Done before closing')
  );
  // expenses: last month and this month, a fixed pattern
  const monthLast = d => { const [y, m] = d.split('-').map(Number); return iso(new Date(y, m, 0)); };
  const exp = (day, amount, category, mode, paid_to, note, by, from, to) => db.expenses.push({id: uid(), day, amount, category, mode, paid_to: paid_to || '', note: note || '',
    period_from: from || day, period_to: to || day,
    created_by: by.user_id, created_by_name: by.name, created_at: day + 'T12:00:00Z', updated_by_name: '', updated_at: null});
  // bills paid just before the sample months, so their costs are spread into them
  const s0 = addDays(start, -1), s0from = iso(new Date(Number(s0.slice(0, 4)), Number(s0.slice(5, 7)) - 2, 1));
  exp(addDays(start, -20), 13900, 'Electricity', 'UPI', 'TNEB', '2-month bill', owner, s0from, s0);
  exp(addDays(start, -40), 24000, 'Insurance', 'Bank transfer', 'United India', 'Shop and stock, 1 year', owner, addDays(start, -40), addDays(start, 324));
  for(let d = start; d <= today; d = addDays(d, 1)){
    if(dow(d) === 0) continue;
    exp(d, 60 + Math.round(rnd() * 8) * 10, 'Tea & snacks', 'Cash', 'Murugan tea stall', '', manager);
    if(rnd() < 0.3) exp(d, 100 + Math.round(rnd() * 20) * 10, 'Transport & petrol', rnd() < 0.5 ? 'Cash' : 'UPI', '', 'Bank and supplier trip', manager);
    if(rnd() < 0.12) exp(d, 400 + Math.round(rnd() * 30) * 50, 'Packing & boxes', 'UPI', 'Sri Vinayaga Packaging', '', manager);
    if(rnd() < 0.06) exp(d, 300 + Math.round(rnd() * 10) * 50, 'Repairs & maintenance', 'Cash', '', 'AC service', manager);
    const dd = Number(d.slice(8));
    if(dd === 1) exp(d, 45000, 'Rent', 'Bank transfer', 'Building owner', '', owner, d, monthLast(d));
    if(dd === 7) exp(d, 180000, 'Salary & wages', 'Bank transfer', '', 'Monthly salary', owner, iso(new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 2, 1)), monthLast(iso(new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 2, 1))));
    if(dd === 10) exp(d, 1500, 'Hallmarking', 'UPI', 'BIS centre', '', manager);
    if(dd === 15) exp(d, 2500, 'Advertising', 'UPI', 'Local paper', 'Weekend ad', owner);
  }
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
    case 'rate_updaters': return {status: 200, body: db.profiles.filter(p => !p.is_owner && p.apps.includes('rates')).map(p => ({name: p.name})).sort((x, y) => x.name.localeCompare(y.name))};
    case 'add_expense_category': {
      if(!canUse(me, 'expenses')) return {status: 403, body: {code: '42501', message: 'Ask the owner for access to Expenses.'}};
      const v = String(a.p_name || '').trim().replace(/\s+/g, ' ');
      if(!v || v.length > 40) return pg('A category name is 1 to 40 letters.');
      const l = db.settings[0].expense_categories;
      if(!l.some(c => c.toLowerCase() === v.toLowerCase())) l.push(v);
      return {status: 200, body: l};
    }
    case 'assignable_people': return {status: 200, body: canUse(me, 'todo') ? db.profiles.map(p => ({user_id: p.user_id, name: p.name})).sort((x, y) => x.name.localeCompare(y.name)) : []};
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
    rates: {read: true, write: method === 'POST' ? canUse(me, 'rates') : me.is_owner},
    expenses: {read: canUse(me, 'expenses'), write: canUse(me, 'expenses')},
    leave_requests: {read: canUse(me, 'attendance'), write: me.is_owner},
    tasks: {read: true, write: method === 'PATCH' || canUse(me, 'todo')}
  }[table];
  if(!rule) return {status: 404, body: {message: 'Unknown table'}};
  if(method === 'GET' ? !rule.read : !rule.write) return denied;
  let rows = db[table];
  if(table === 'profiles' && !me.is_owner) rows = rows.filter(p => p.user_id === me.user_id);
  const single = /vnd\.pgrst\.object/.test(headers.get('accept') || '');
  const wantRows = /return=representation/.test(headers.get('prefer') || '');
  if(table === 'expenses') return expensesRest(method, params, body, single, wantRows, me);
  if(table === 'tasks') return tasksRest(method, params, body, single, wantRows, me);
  let out;
  if(method === 'GET'){
    out = rows.filter(r => matches(r, params));
    out = sortBy(out.slice(), params.get('order'));
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
      } else if(table === 'rates'){
        row = Object.assign({id: uid(), gold_24k: null, gold_18k: null, note: ''}, item, {set_at: now(), set_by: me.user_id, set_by_name: me.name});
        db.rates.push(row);
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

function sortBy(out, ord){
  if(!ord) return out;
  const keys = ord.split(',').map(k => k.split('.'));
  return out.sort((a, b) => { for(const [c, dir] of keys){ const r = String(a[c]).localeCompare(String(b[c])) * (dir === 'desc' ? -1 : 1); if(r) return r; } return 0; });
}

/* expenses: the owner sees all; others see their own and change them on the day they entered them */
function expensesRest(method, params, body, single, wantRows, me){
  const owner = me.is_owner, may = canUse(me, 'expenses');
  const ownToday = r => r.created_by === me.user_id && iso(new Date(r.created_at)) === iso(new Date());
  let out = db.expenses.filter(r => owner || r.created_by === me.user_id).filter(r => matches(r, params));
  if(method === 'GET') out = sortBy(out.slice(), params.get('order'));
  else if(method === 'POST'){
    const r = Object.assign({id: uid(), mode: 'Cash', paid_to: '', note: ''}, body, {created_by: me.user_id, created_by_name: me.name, created_at: now(), updated_by_name: '', updated_at: null});
    if(!r.period_from || !r.period_to){ r.period_from = r.day; r.period_to = r.day; }
      db.expenses.push(r); out = [r];
  } else if(method === 'PATCH'){
    out = out.filter(r => owner || (may && ownToday(r)));
    out.forEach(r => Object.assign(r, body, {updated_by_name: me.name, updated_at: now()}));
  } else if(method === 'DELETE'){
    out = out.filter(r => owner || (may && ownToday(r)));
    db.expenses = db.expenses.filter(r => !out.includes(r));
  }
  if(method !== 'GET' && !wantRows) return {status: 204, body: null};
  if(single){
    if(!out.length) return {status: 406, body: {code: 'PGRST116', message: 'No rows'}};
    return {status: 200, body: out[0]};
  }
  return {status: 200, body: out};
}

/* tasks: same rules as the stamp_task trigger and the row policies */
function tasksRest(method, params, body, single, wantRows, me){
  const assigner = canUse(me, 'todo');
  const nameOf = id => (db.profiles.find(p => p.user_id === id) || {}).name || '';
  const fix = (row, old) => {
    row.assigned_name = nameOf(row.assigned_to);
    if(row.status === 'done' && (!old || old.status !== 'done')){ row.done_at = now(); row.done_by_name = me.name; }
    else if(row.status === 'open'){ row.done_at = null; row.done_by_name = ''; }
    return row;
  };
  let rows = db.tasks.filter(t => assigner || t.assigned_to === me.user_id || t.created_by === me.user_id);
  let out = rows.filter(r => matches(r, params));
  if(method === 'GET'){
    out = sortBy(out.slice(), params.get('order'));
  } else if(method === 'POST'){
    if(!assigner) return {status: 403, body: {code: '42501', message: 'permission denied'}};
    const t = fix(Object.assign({id: uid(), details: '', assigned_to: null, due: null, high: false, status: 'open', done_note: ''}, body,
      {created_by: me.user_id, created_by_name: me.name, created_at: now()}));
    db.tasks.push(t); out = [t];
  } else if(method === 'PATCH'){
    out = out.filter(t => assigner || t.assigned_to === me.user_id);
    if(!assigner && Object.keys(body).some(k => !['status', 'done_note'].includes(k)))
      return {status: 403, body: {code: '42501', message: 'Only the person who assigns tasks can change this.'}};
    out.forEach(t => { const old = Object.assign({}, t); Object.assign(t, body); fix(t, old); });
  } else if(method === 'DELETE'){
    out = out.filter(t => me.is_owner || (assigner && t.created_by === me.user_id));
    db.tasks = db.tasks.filter(t => !out.includes(t));
  }
  if(method !== 'GET' && !wantRows) return {status: 204, body: null};
  if(single){
    if(!out.length) return {status: 406, body: {code: 'PGRST116', message: 'No rows'}};
    return {status: 200, body: out[0]};
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
  b.innerHTML = '<span><b>Demo with sample data.</b> Nothing here is saved online.</span><span>Owner PIN <b>111111</b> · Sample Manager PIN <b>222222</b> · Sample Staff 2 PIN <b>333333</b></span>' +
    '<button type="button" style="font:600 .8rem Figtree,system-ui,sans-serif;border:1px solid #3B2420;background:transparent;color:#3B2420;border-radius:999px;padding:4px 12px;cursor:pointer">Reset demo</button>';
  b.querySelector('button').onclick = () => window.NJ_DEMO.reset();
  document.body.prepend(b);
});
})();
