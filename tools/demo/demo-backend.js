/* DEMO ONLY: an in-browser stand-in for the Supabase project, filled with sample data.
   The demo build loads this before supabase-js, so every request to the project is answered
   here instead of the real database. Never part of the real site. */
(function(){
'use strict';
const BASE = 'https://uottxgpjgakinqprexsp.supabase.co';
const KEY = 'natraj-demo-db-v15';
const APPS = ['attendance', 'rates', 'todo', 'expenses', 'banking', 'crm', 'designs'];
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); };
const dow = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };
const parse0 = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
const now = () => new Date().toISOString();

function seed(){
  const staff = [['Sample Staff 1', 'Manager'], ['Sample Staff 2', 'Sales'], ['Sample Staff 3', 'Sales'], ['Sample Staff 4', 'Goldsmith']]
    .map(([name, designation]) => ({id: uid(), name, designation, phone: '', joined: null, active: true, created_at: now()}));
  const owner = {user_id: uid(), name: 'Owner', username: 'owner', is_owner: true, apps: APPS, staff_id: null, created_at: now()};
  const manager = {user_id: uid(), name: 'Sample Manager', username: 'sample-manager', is_owner: false, apps: ['attendance', 'rates', 'todo', 'expenses', 'banking', 'crm', 'designs'], staff_id: staff[0].id, created_at: now()};
  const worker = {user_id: uid(), name: 'Sample Staff 2', username: 'sample-staff-2', is_owner: false, apps: [], staff_id: staff[1].id, created_at: now()};
  const db = {
    staff, profiles: [owner, manager, worker], settings: [{id: 1, weekly_off: 0, rate_due: '10:30:00', expense_categories: ['Salary & wages', 'Rent', 'Electricity', 'Tea & snacks', 'Staff food', 'Transport & petrol', 'Packing & boxes', 'Repairs & maintenance', 'Hallmarking', 'Stationery & printing', 'Advertising', 'Pooja & festival', 'Bank charges', 'Insurance', 'Other']}], attendance: [], leave_requests: [], rates: [], tasks: [], expenses: [], notifications: [], bank_accounts: [], bank_entries: [], customers: [], customer_activity: [], user_prefs: [], designs: [], photos: {},
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
  // banking: two accounts, daily cash deposits, card settlements, supplier payments, a transfer each month
  const acc = (name, bank, last4) => { const a = {id: uid(), name, bank, last4, active: true, created_at: now()}; db.bank_accounts.push(a); return a; };
  const sbi = acc('SBI Current', 'SBI, Tiruppur main', '4821'), hdfc = acc('HDFC Savings', 'HDFC, Kumaran Road', '0937');
  const be = (a, day, direction, amount, method, party, reference, by, tid) => db.bank_entries.push({id: uid(), account_id: a.id, day, direction, amount, method, party: party || '', reference: reference || '', note: '', transfer_id: tid || null,
    created_by: by.user_id, created_by_name: by.name, created_at: day + 'T11:30:00Z', updated_by_name: '', updated_at: null});
  be(sbi, start, 'in', 845000, 'Opening balance', '', '', owner); be(hdfc, start, 'in', 312500, 'Opening balance', '', '', owner);
  for(let d = start; d <= today; d = addDays(d, 1)){
    if(dow(d) === 0) continue;
    be(sbi, d, 'in', Math.round((40 + rnd() * 120)) * 500, 'Cash deposit', '', '', manager);
    if(rnd() < 0.6) be(hdfc, d, 'in', Math.round((10 + rnd() * 90)) * 500, 'Card settlement', 'Card machine', '', manager);
    if(rnd() < 0.12) be(sbi, d, 'out', Math.round((50 + rnd() * 150)) * 1000, 'NEFT / RTGS / IMPS', rnd() < 0.5 ? 'Sri Lakshmi Bullion' : 'Coimbatore Gold Refinery', 'UTR' + Math.floor(rnd() * 1e9), owner);
    const dd = Number(d.slice(8));
    if(dd === 1) be(sbi, d, 'out', 45000, 'Cheque', 'Building owner', String(100200 + Math.floor(rnd() * 99)), owner);
    if(dd === 7) be(sbi, d, 'out', 180000, 'NEFT / RTGS / IMPS', 'Staff salary', '', owner);
    if(dd === 20){ const t = uid(); be(hdfc, d, 'out', 200000, 'Transfer', sbi.name, '', owner, t); be(sbi, d, 'in', 200000, 'Transfer', hdfc.name, '', owner, t); }
    if(dd === 28) be(sbi, d, 'out', 590, 'Bank charges', 'SBI', '', owner);
  }
  // customers: a dozen sample people, some birthdays and anniversaries coming up, notes and follow-ups
  const md = (n, y) => { const d = parse0(addDays(today, n)); return y + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const cust = (name, phone, area, tags, source, extra) => { const c = Object.assign({id: uid(), name, phone, alt_phone: '', area, address: '', birthday: null, anniversary: null, tags, source, notes: '',
    created_by: manager.user_id, created_by_name: manager.name, created_at: addDays(today, -Math.floor(rnd() * 50)) + 'T11:00:00Z', updated_by_name: '', updated_at: null}, extra || {}); db.customers.push(c); return c; };
  const C = [
    cust('Sample Customer Lakshmi', '9843012345', 'Avinashi Road', ['Regular', 'Gold'], 'Family / friend', {birthday: md(0, 1904), whatsapp_ok: true, pincode: '641603', notes: 'Prefers antique finish. Ring size 14.'}),
    cust('Sample Customer Karthik', '9789022334', 'Kumaran Road', ['Bridal'], 'Instagram', {anniversary: md(3, 2015), whatsapp_ok: true, function_month: md(40, 2026).slice(0, 7), function_note: 'Sister’s wedding'}),
    cust('Sample Customer Meena', '9944055667', 'Palladam', ['Chit member', 'Silver'], 'Radio', {birthday: md(6, 1988), whatsapp_ok: true}),
    cust('Sample Customer Ravi', '9443077889', 'Dharapuram Road', ['VIP', 'Diamond'], 'Passing by', {anniversary: md(12, 2002)}),
    cust('Sample Customer Priya', '9003011223', 'Kangeyam', ['Bridal', 'Gold'], 'Instagram', {birthday: md(21, 1904), whatsapp_ok: true, function_month: md(70, 2026).slice(0, 7), function_note: 'Her wedding'}),
    cust('Sample Customer Selvam', '9894099887', 'Uthukuli', ['Old gold exchange'], 'Wall painting'),
    cust('Sample Customer Divya', '9566044556', 'Perumanallur', ['Regular'], 'Pamphlet', {birthday: md(-3, 1990)}),
    cust('Sample Customer Anbu', '', 'Tiruppur town', ['Wholesale'], 'Referral')
  ];
  const act = (c, kind, body, due, status, by, extra) => db.customer_activity.push(Object.assign({id: uid(), customer_id: c.id, kind, body, due, status, outcome: '', assigned_to: by.user_id, assigned_name: by.name,
    done_at: status === 'done' ? addDays(today, -2) + 'T15:00:00Z' : null, done_by_name: status === 'done' ? by.name : '', created_by: by.user_id, created_by_name: by.name, created_at: addDays(today, -5) + 'T10:30:00Z'}, extra || {}));
  act(C[1], 'note', 'Looking at the temple bridal set, budget about ₹6 lakh. Wedding in February.', null, 'done', manager, {assigned_to: null, assigned_name: ''});
  act(C[1], 'followup', 'Call with the bridal set quote', addDays(today, -1), 'open', manager);
  act(C[0], 'followup', 'Tell her the new antique bangles have arrived', today, 'open', manager);
  act(C[3], 'followup', 'Diamond earrings: confirm the size and send photos', addDays(today, 2), 'open', owner);
  act(C[4], 'followup', 'Bridal trial visit with family', addDays(today, 9), 'open', manager);
  const visit = (c, ago, came, bought, look, rating, missing, served) => act(c, 'visit', 'Form', null, 'done', manager,
    {assigned_to: null, assigned_name: '', visit_day: addDays(today, -ago), came_for: came, bought, looking_for: look, rating, missing, served_by: served, outcome: ''});
  visit(C[0], 2, ['Gold', 'Daily wear'], true, 'Antique bangles', 5, '', 'Sample Staff 2');
  visit(C[1], 5, ['Gold', 'Wedding'], false, 'Temple bridal set', 4, 'Lighter bridal necklace under 40 g', 'Sample Manager');
  visit(C[2], 8, ['Silver', 'Gift'], true, 'Silver pooja set', 5, '', 'Sample Staff 3');
  visit(C[3], 11, ['Diamond'], false, 'Diamond studs', 3, 'Solitaire above 30 cents', 'Sample Manager');
  visit(C[4], 14, ['Gold', 'Wedding'], false, 'Bridal set and kasu mala', 4, '', 'Sample Staff 2');
  visit(C[5], 20, ['Gold', 'Investment'], true, 'Gold coins', 4, '', 'Sample Staff 3');
  visit(C[6], 26, ['Gold', 'Gift'], false, 'Kids’ chain', 3, '22K kids’ chain under 4 g', 'Sample Staff 2');
  act(C[5], 'followup', 'Old gold exchange rate check', addDays(today, -6), 'done', manager, {outcome: 'Came in, exchanged 18 g.'});
  // design library: drawn sample photos (see samplePhoto below), gold and silver
  const des = (code, metal, category, purity, weight_g, va_percent, supplier, tags, status, kinds, ago, notes) => db.designs.push({id: uid(), code, metal, category, purity, weight_g, va_percent, supplier, tags, status, notes: notes || '',
    photos: kinds.map((k, i) => 'sample/' + k + '-' + metal.toLowerCase() + '-' + i + '-' + code + '.svg'), created_by: manager.user_id, created_by_name: manager.name,
    created_at: addDays(today, -ago) + 'T12:00:00Z', updated_by_name: status === 'sold' ? manager.name : '', updated_at: status === 'sold' ? addDays(today, -Math.min(ago, 3)) + 'T17:00:00Z' : null});
  des('G-NEC-0001', 'Gold', 'Necklace', '22K 916', 38.42, 14, 'Sri Murugan Works', ['Temple', 'Bridal', 'Antique'], 'in_shop', ['necklace', 'necklace'], 40, 'Comes with matching earrings (G-EAR-0002).');
  des('G-NEC-0002', 'Gold', 'Necklace', '22K 916', 18.65, 12, 'Kerala Designs', ['Kerala', 'Light weight'], 'in_shop', ['necklace'], 25);
  des('G-HAR-0001', 'Gold', 'Haram', '22K 916', 72.3, 16, 'Sri Murugan Works', ['Bridal', 'Nakshi', 'Handmade'], 'order', ['haram', 'haram'], 60, 'Made to order in 3 weeks. Length can change.');
  des('G-BNG-0001', 'Gold', 'Bangle', '22K 916', 24.1, 11, 'Coimbatore Casting', ['Antique', 'Daily wear'], 'in_shop', ['bangle', 'bangle'], 18, 'Set of 2. Sizes 2.4 and 2.6.');
  des('G-BNG-0002', 'Gold', 'Bangle', '22K 916', 15.8, 10, 'Coimbatore Casting', ['Plain', 'Daily wear'], 'sold', ['bangle'], 30);
  des('G-RNG-0001', 'Gold', 'Ring', '22K 916', 4.25, 13, 'Sri Murugan Works', ['CZ stones', 'Gift'], 'in_shop', ['ring'], 6);
  des('G-RNG-0002', 'Gold', 'Ring', '18K 750', 3.1, 15, 'Kerala Designs', ['Light weight'], 'in_shop', ['ring'], 3);
  des('G-EAR-0001', 'Gold', 'Earrings', '22K 916', 8.6, 14, 'Sri Murugan Works', ['Temple', 'Antique'], 'in_shop', ['earrings', 'earrings'], 12, 'Jhumka with screw back.');
  des('G-EAR-0002', 'Gold', 'Earrings', '22K 916', 6.2, 12, 'Kerala Designs', ['Bridal', 'Kundan'], 'sold', ['earrings'], 9);
  des('G-CHN-0001', 'Gold', 'Chain', '22K 916', 12.0, 8, 'Coimbatore Casting', ['Daily wear', 'Plain'], 'in_shop', ['chain'], 15, '22 inch. Also in 20 and 24.');
  des('G-PND-0001', 'Gold', 'Pendant', '22K 916', 2.9, 12, 'Sri Murugan Works', ['Temple', 'Gift'], 'in_shop', ['pendant'], 2);
  des('G-THL-0001', 'Gold', 'Thali / Mangalsutra', '22K 916', 9.4, 10, 'Kerala Designs', ['Bridal', 'Handmade'], 'order', ['pendant'], 45);
  des('S-ANK-0001', 'Silver', 'Anklet', '92.5 sterling', 42.5, 8, 'Salem Silver House', ['Daily wear', 'Light weight'], 'in_shop', ['chain', 'chain'], 20, 'Pair. Ghungroo bells.');
  des('S-ANK-0002', 'Silver', 'Anklet', '80 silver', 65.0, 6, 'Salem Silver House', ['Bridal', 'Handmade'], 'in_shop', ['chain'], 7);
  des('S-BNG-0001', 'Silver', 'Bangle', '92.5 sterling', 28.0, 9, 'Salem Silver House', ['Kids', 'Gift'], 'sold', ['bangle'], 14);
  des('S-RNG-0001', 'Silver', 'Ring', '92.5 sterling', 5.5, 10, 'Salem Silver House', ['CZ stones'], 'in_shop', ['ring'], 4);
  des('S-POO-0001', 'Silver', 'Pooja items', '92.5 sterling', 245.0, 5, 'Salem Silver House', ['Gift', 'Handmade'], 'in_shop', ['bowl', 'bowl'], 22, 'Kumkum bowl set with plate.');
  des('S-NEC-0001', 'Silver', 'Necklace', '92.5 sterling', 34.0, 8, 'Salem Silver House', ['Antique', 'Temple'], 'in_shop', ['necklace'], 1);
  const note = (u, kind, title, body, mins) => db.notifications.push({id: uid(), user_id: u.user_id, kind, title, body, link: 'todo/#all', created_at: new Date(Date.now() - mins * 60000).toISOString(), read_at: null});
  note(manager, 'task_done', 'Sample Staff 2 completed a task', 'Clean the hallmark machine', 60 * 20);
  note(owner, 'tasks_all_done', 'Sample Staff 3 finished all their tasks', '3 done today. Last one: Arrange the silver anklets tray', 45);
  return db;
}
let db;
try{ db = JSON.parse(localStorage.getItem(KEY)) || seed(); }catch(e){ db = seed(); }
const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(db)); }catch(e){} };
save();
/* sample photos are drawn here; photos added in the demo are kept in this browser */
function samplePhoto(path){
  const m = /^sample\/([a-z]+)-([a-z]+)-(\d)/.exec(path); if(!m) return '';
  const [, kind, metal, n] = m, gold = metal !== 'silver';
  const c1 = gold ? '#F3D27A' : '#F2F4F7', c2 = gold ? '#B8860B' : '#8F98A3', c3 = gold ? '#7A5A12' : '#5E6670';
  const bg = ['#F7F1E6', '#EFE6DA', '#E9EEF0'][Number(n) % 3], st = 'url(#g)';
  let d = '';
  const bead = (x, y, r) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + st + '" stroke="' + c3 + '" stroke-width="1.5"/>';
  if(kind === 'necklace' || kind === 'haram'){
    const big = kind === 'haram';
    for(let i = 0; i <= 24; i++){ const a = Math.PI * (0.08 + 0.84 * i / 24), x = 200 - Math.cos(a) * 130, y = 70 + Math.sin(a) * (big ? 230 : 170); d += bead(x.toFixed(1), y.toFixed(1), i % 4 === 0 ? 11 : 7); }
    d += '<path d="M200 ' + (big ? 300 : 240) + ' l-26 18 26 46 26-46z" fill="' + st + '" stroke="' + c3 + '" stroke-width="2"/><circle cx="200" cy="' + (big ? 330 : 270) + '" r="7" fill="#B0263A"/>';
  } else if(kind === 'bangle'){
    d = '<ellipse cx="200" cy="200" rx="128" ry="128" fill="none" stroke="' + c3 + '" stroke-width="34"/><ellipse cx="200" cy="200" rx="128" ry="128" fill="none" stroke="' + st + '" stroke-width="28"/>';
    for(let i = 0; i < 24; i++){ const a = 2 * Math.PI * i / 24; d += '<circle cx="' + (200 + Math.cos(a) * 128).toFixed(1) + '" cy="' + (200 + Math.sin(a) * 128).toFixed(1) + '" r="4" fill="' + c3 + '"/>'; }
  } else if(kind === 'ring'){
    d = '<ellipse cx="200" cy="235" rx="95" ry="95" fill="none" stroke="' + c3 + '" stroke-width="26"/><ellipse cx="200" cy="235" rx="95" ry="95" fill="none" stroke="' + st + '" stroke-width="20"/>' +
      '<path d="M160 140 l40-50 40 50 -40 30z" fill="' + (gold ? '#C8102E' : '#7FB3E6') + '" stroke="' + c3 + '" stroke-width="3"/>';
  } else if(kind === 'earrings'){
    [130, 270].forEach(x => { d += '<circle cx="' + x + '" cy="90" r="16" fill="' + st + '" stroke="' + c3 + '" stroke-width="2"/><path d="M' + (x - 55) + ' 230 Q' + x + ' 110 ' + (x + 55) + ' 230 Z" fill="' + st + '" stroke="' + c3 + '" stroke-width="2.5"/>';
      for(let i = 0; i < 7; i++) d += bead(x - 48 + i * 16, 246, 6); });
  } else if(kind === 'chain'){
    for(let i = 0; i < 22; i++){ const a = Math.PI * (0.05 + 0.9 * i / 21), x = 200 - Math.cos(a) * 140, y = 80 + Math.sin(a) * 210;
      d += '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="13" ry="8" transform="rotate(' + (a * 180 / Math.PI - 90).toFixed(0) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')" fill="none" stroke="' + st + '" stroke-width="5"/>'; }
  } else if(kind === 'pendant'){
    d = '<path d="M90 60 Q200 170 310 60" fill="none" stroke="' + c2 + '" stroke-width="4"/><path d="M200 120 C150 160 130 230 200 320 C270 230 250 160 200 120Z" fill="' + st + '" stroke="' + c3 + '" stroke-width="3"/>' +
      '<circle cx="200" cy="215" r="20" fill="' + (gold ? '#1F7A4D' : '#7FB3E6') + '" stroke="' + c3 + '" stroke-width="2"/>';
  } else {
    d = '<ellipse cx="200" cy="260" rx="140" ry="34" fill="' + st + '" stroke="' + c3 + '" stroke-width="3"/><path d="M120 250 Q120 160 200 160 Q280 160 280 250 Z" fill="' + st + '" stroke="' + c3 + '" stroke-width="3"/><circle cx="200" cy="200" r="16" fill="#C8102E"/>';
  }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c1 + '"/><stop offset=".55" stop-color="' + c2 + '"/><stop offset="1" stop-color="' + c1 + '"/></linearGradient></defs>' +
    '<rect width="400" height="400" fill="' + bg + '"/><ellipse cx="200" cy="370" rx="150" ry="14" fill="#000" opacity=".06"/>' + d + '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
const fresh = {};    // photos added in this visit, until they are saved as data
window.NJ_DEMO = {
  photo: p => p ? (p.startsWith('sample/') ? samplePhoto(p) : db.photos[p] || fresh[p] || '') : '',
  keepPhoto(path, url){
    fresh[path] = url;
    fetch(url).then(r => r.blob()).then(b => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); }))
      .then(data => { db.photos[path] = data; try{ localStorage.setItem(KEY, JSON.stringify(db)); }catch(e){ delete db.photos[path]; } }).catch(() => {});
  },
  reset(){ try{ localStorage.removeItem(KEY); localStorage.removeItem('natraj-tools-auth'); }catch(e){} location.reload(); }
};

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
  if(op === 'in') return b.replace(/^\(|\)$/g, '').split(',').map(x => x.replace(/^"|"$/g, '')).includes(a);
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
    case 'crm_people': return {status: 200, body: canUse(me, 'crm') ? db.profiles.filter(p => p.is_owner || p.apps.includes('crm')).map(p => ({user_id: p.user_id, name: p.name})).sort((x, y) => x.name.localeCompare(y.name)) : []};
    case 'bank_balances': return {status: 200, body: bankBalances(a.p_until, me)};
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
    notifications: {read: true, write: true}, customers: {read: true, write: true}, user_prefs: {read: true, write: true}, customer_activity: {read: true, write: true}, bank_accounts: {read: true, write: true}, bank_entries: {read: true, write: true},
    designs: {read: canUse(me, 'designs'), write: method === 'DELETE' ? me.is_owner : canUse(me, 'designs')},
    tasks: {read: true, write: method === 'PATCH' || canUse(me, 'todo')}
  }[table];
  if(!rule) return {status: 404, body: {message: 'Unknown table'}};
  if(method === 'GET' ? !rule.read : !rule.write) return denied;
  let rows = db[table];
  if(table === 'profiles' && !me.is_owner) rows = rows.filter(p => p.user_id === me.user_id);
  const single = /vnd\.pgrst\.object/.test(headers.get('accept') || '');
  const wantRows = /return=representation/.test(headers.get('prefer') || '');
  if(table === 'expenses') return expensesRest(method, params, body, single, wantRows, me);
  if(table === 'user_prefs') return prefsRest(method, params, body, single, wantRows, me);
  if(table === 'customers' || table === 'customer_activity') return crmRest(table, method, params, body, single, wantRows, me);
  if(table === 'bank_accounts') return bankAccountsRest(method, params, body, single, wantRows, me);
  if(table === 'bank_entries') return bankEntriesRest(method, params, body, single, wantRows, me);
  if(table === 'notifications') return notesRest(method, params, body, single, wantRows, me);
  if(table === 'tasks') return tasksRest(method, params, body, single, wantRows, me);
  if(table === 'designs') return designsRest(method, params, body, single, wantRows, me);
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


/* same as notify_task_done() in migration 012 */
function notifyTaskDone(t, me){
  const nowIso = new Date().toISOString(), today = nowIso.slice(0, 10);
  const push = (user_id, kind, title, body) => db.notifications.push({id: uid(), user_id, kind, title, body, link: 'todo/#all', created_at: nowIso, read_at: null});
  const who = t.done_by_name || 'Someone';
  db.profiles.filter(p => p.user_id !== me.user_id && !p.is_owner && (p.apps.includes('todo') || p.user_id === t.created_by))
    .forEach(p => push(p.user_id, 'task_done', who + ' completed a task', t.title));
  if(t.assigned_to && !db.tasks.some(x => x.assigned_to === t.assigned_to && x.status === 'open')){
    const n = db.tasks.filter(x => x.assigned_to === t.assigned_to && x.status === 'done' && x.done_at && x.done_at.slice(0, 10) === today).length;
    db.profiles.filter(p => p.is_owner && p.user_id !== me.user_id && p.user_id !== t.assigned_to)
      .forEach(p => push(p.user_id, 'tasks_all_done', (t.assigned_name || who) + ' finished all their tasks', n + ' done today. Last one: ' + t.title));
  }
}
function notesRest(method, params, body, single, wantRows, me){
  let out = db.notifications.filter(n => n.user_id === me.user_id).filter(n => matches(n, params));
  if(method === 'GET') sortBy(out, params.get('order'));
  else if(method === 'PATCH') out.forEach(n => { if('read_at' in body) n.read_at = body.read_at; });
  else if(method === 'DELETE') db.notifications = db.notifications.filter(n => !out.includes(n));
  else return {status: 403, body: {code: '42501', message: 'permission denied'}};
  const lim = Number(params.get('limit')); if(lim) out = out.slice(0, lim);
  if(method !== 'GET' && !wantRows) return {status: 204, body: null};
  return {status: 200, body: single ? out[0] : out};
}


/* banking, same rules as migration 013 */
function bankAccountsRest(method, params, body, single, wantRows, me){
  const denied = {status: 403, body: {code: '42501', message: 'permission denied'}};
  if(!canUse(me, 'banking')) return method === 'GET' ? {status: 200, body: single ? null : []} : denied;
  if(method !== 'GET' && !me.is_owner) return denied;
  let out = db.bank_accounts.filter(r => matches(r, params));
  if(method === 'GET') sortBy(out, params.get('order'));
  else if(method === 'POST'){ out = (Array.isArray(body) ? body : [body]).map(b => Object.assign({id: uid(), bank: '', last4: '', active: true, created_at: new Date().toISOString()}, b)); db.bank_accounts.push(...out); }
  else if(method === 'PATCH') out.forEach(r => Object.assign(r, body));
  else if(method === 'DELETE'){ db.bank_accounts = db.bank_accounts.filter(r => !out.includes(r)); db.bank_entries = db.bank_entries.filter(e => !out.some(a => a.id === e.account_id)); }
  if(method !== 'GET' && !wantRows) return {status: 204, body: null};
  if(single){ if(!out.length) return {status: 406, body: {code: 'PGRST116', message: 'No rows'}}; return {status: 200, body: out[0]}; }
  return {status: 200, body: out};
}
function bankEntriesRest(method, params, body, single, wantRows, me){
  const owner = me.is_owner, may = canUse(me, 'banking'), nowIso = new Date().toISOString();
  const ownToday = r => r.created_by === me.user_id && new Date(r.created_at).toDateString() === new Date().toDateString();
  let out = db.bank_entries.filter(r => owner || (may && r.created_by === me.user_id)).filter(r => matches(r, params));
  if(method === 'GET') sortBy(out, params.get('order'));
  else if(method === 'POST'){
    if(!may) return {status: 403, body: {code: '42501', message: 'new row violates row-level security policy for table "bank_entries"'}};
    out = (Array.isArray(body) ? body : [body]).map(b => Object.assign({id: uid(), method: '', party: '', reference: '', note: '', transfer_id: null}, b,
      {created_by: me.user_id, created_by_name: me.name, created_at: nowIso, updated_by_name: '', updated_at: null}));
    db.bank_entries.push(...out);
  } else if(method === 'PATCH'){
    out = out.filter(r => owner || (may && ownToday(r)));
    out.forEach(r => Object.assign(r, body, {updated_by_name: me.name, updated_at: nowIso}));
  } else if(method === 'DELETE'){
    out = out.filter(r => owner || (may && ownToday(r)));
    db.bank_entries = db.bank_entries.filter(r => !out.includes(r));
  }
  if(method !== 'GET' && !wantRows) return {status: 204, body: null};
  if(single){ if(!out.length) return {status: 406, body: {code: 'PGRST116', message: 'No rows'}}; return {status: 200, body: out[0]}; }
  return {status: 200, body: out};
}
function bankBalances(until, me){
  const by = {};
  db.bank_entries.filter(r => (me.is_owner || (canUse(me, 'banking') && r.created_by === me.user_id)) && r.day <= until)
    .forEach(r => by[r.account_id] = (by[r.account_id] || 0) + (r.direction === 'in' ? 1 : -1) * Number(r.amount));
  return Object.entries(by).map(([account_id, balance]) => ({account_id, balance}));
}


/* customers and their activity, same rules as migration 014 */
function crmRest(table, method, params, body, single, wantRows, me){
  const may = canUse(me, 'crm'), nowIso = new Date().toISOString();
  const denied = {status: 403, body: {code: '42501', message: 'permission denied'}};
  if(!may) return method === 'GET' ? {status: 200, body: single ? null : []} : denied;
  const nameOf = id => (db.profiles.find(p => p.user_id === id) || {}).name || '';
  const fix = (r, old) => {
    if(table !== 'customer_activity') return r;
    r.assigned_name = nameOf(r.assigned_to);
    if(r.kind === 'note' || r.kind === 'visit'){ r.status = 'done'; r.due = null; if(r.kind === 'visit' && !r.visit_day) r.visit_day = nowIso.slice(0, 10); }
    else if(r.status === 'done' && (!old || old.status !== 'done')){ r.done_at = nowIso; r.done_by_name = me.name; }
    else if(r.status === 'open'){ r.done_at = null; r.done_by_name = ''; r.outcome = ''; }
    return r;
  };
  let out = db[table].filter(r => matches(r, params));
  if(method === 'GET') sortBy(out, params.get('order'));
  else if(method === 'POST'){
    const base = table === 'customers'
      ? {phone: '', alt_phone: '', area: '', address: '', birthday: null, anniversary: null, tags: [], source: '', notes: '', pincode: '', whatsapp_on_phone: true, whatsapp_ok: false, function_month: '', function_note: '', updated_by_name: '', updated_at: null}
      : {due: null, status: 'open', outcome: '', assigned_to: null, assigned_name: '', done_at: null, done_by_name: '', came_for: [], bought: null, looking_for: '', rating: null, missing: '', served_by: '', visit_day: null};
    out = (Array.isArray(body) ? body : [body]).map(b => fix(Object.assign({id: uid()}, base, b, {created_by: me.user_id, created_by_name: me.name, created_at: nowIso})));
    db[table].push(...out);
  } else if(method === 'PATCH'){
    out.forEach(r => { const old = Object.assign({}, r); Object.assign(r, body); if(table === 'customers'){ r.updated_by_name = me.name; r.updated_at = nowIso; } fix(r, old); });
  } else if(method === 'DELETE'){
    out = out.filter(r => me.is_owner || (table === 'customer_activity' && r.created_by === me.user_id));
    db[table] = db[table].filter(r => !out.includes(r));
    if(table === 'customers') db.customer_activity = db.customer_activity.filter(a => !out.some(c => c.id === a.customer_id));
  }
  if(method !== 'GET' && !wantRows) return {status: 204, body: null};
  if(single){ if(!out.length) return method === 'GET' && /maybe/.test('') ? {status: 200, body: null} : {status: 406, body: {code: 'PGRST116', message: 'No rows'}}; return {status: 200, body: out[0]}; }
  return {status: 200, body: out};
}


/* each person's own settings (migration 016) */
function prefsRest(method, params, body, single, wantRows, me){
  let out = db.user_prefs.filter(r => r.user_id === me.user_id).filter(r => matches(r, params));
  if(method === 'POST'){
    const b = Array.isArray(body) ? body[0] : body;
    if(b.user_id !== me.user_id || db.user_prefs.some(r => r.user_id === me.user_id)) return {status: 409, body: {code: '23505', message: 'duplicate key'}};
    out = [Object.assign({dashboard: {}, updated_at: new Date().toISOString()}, b)]; db.user_prefs.push(...out);
  } else if(method === 'PATCH') out.forEach(r => Object.assign(r, body));
  else if(method === 'DELETE') return {status: 403, body: {message: 'permission denied'}};
  if(method !== 'GET' && !wantRows) return {status: 204, body: null};
  if(single){ if(!out.length) return {status: 406, body: {code: 'PGRST116', message: 'No rows'}}; return {status: 200, body: out[0]}; }
  return {status: 200, body: out};
}

/* tasks: same rules as the stamp_task trigger and the row policies */
/* design library (migration 017) */
function designsRest(method, params, body, single, wantRows, me){
  const nowIso = now(), dup = (code, id) => db.designs.some(d => d.code === code && d.id !== id);
  const taken = {status: 409, body: {code: '23505', message: 'duplicate key value violates unique constraint "designs_code_key"'}};
  let out = db.designs.filter(r => matches(r, params));
  if(method === 'GET') sortBy(out, params.get('order'));
  else if(method === 'POST'){
    const r = Object.assign({id: uid(), metal: 'Gold', category: '', purity: '', weight_g: null, va_percent: null, supplier: '', tags: [], status: 'in_shop', notes: '', photos: []}, Array.isArray(body) ? body[0] : body,
      {created_by: me.user_id, created_by_name: me.name, created_at: nowIso, updated_by_name: '', updated_at: null});
    r.code = String(r.code || '').trim().toUpperCase();
    if(dup(r.code)) return taken;
    db.designs.push(r); out = [r];
  } else if(method === 'PATCH'){
    if(body.code !== undefined){ body.code = String(body.code).trim().toUpperCase(); if(out.some(r => dup(body.code, r.id))) return taken; }
    out.forEach(r => Object.assign(r, body, {updated_by_name: me.name, updated_at: nowIso}));
  } else if(method === 'DELETE') db.designs = db.designs.filter(r => !out.includes(r));
  if(method !== 'GET' && !wantRows) return {status: 204, body: null};
  if(single){ if(!out.length) return {status: 406, body: {code: 'PGRST116', message: 'No rows'}}; return {status: 200, body: out[0]}; }
  return {status: 200, body: out};
}
/* the photo bucket: the demo keeps the pictures in NJ_DEMO.photo, so this only answers */
function storage(method, p, body, me){
  if(!me || !canUse(me, 'designs')) return {status: 403, body: {statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy'}};
  if(p === '/storage/v1/object/sign/designs') return {status: 200, body: (body.paths || []).map(x => ({path: x, signedURL: '/object/sign/designs/' + x + '?token=demo', error: null}))};
  if(p.startsWith('/storage/v1/object/designs/') && method === 'POST'){ const k = decodeURIComponent(p.slice(27)); return {status: 200, body: {Key: 'designs/' + k, Id: uid()}}; }
  if(p === '/storage/v1/object/designs' && method === 'DELETE'){ (body.prefixes || []).forEach(k => delete db.photos[k]); return {status: 200, body: (body.prefixes || []).map(name => ({name}))}; }
  return {status: 404, body: {message: 'Not found'}};
}

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
    out.forEach(t => { const old = Object.assign({}, t); Object.assign(t, body); fix(t, old); if(t.status === 'done' && old.status !== 'done') notifyTaskDone(t, me); });
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
  else if(p.startsWith('/storage/v1/')) res = storage(method, p, body, me);
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
