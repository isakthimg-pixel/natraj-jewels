/* DEMO ONLY: an in-browser stand-in for the Supabase project, filled with sample data.
   The demo build loads this before supabase-js, so every request to the project is answered
   here instead of the real database. Never part of the real site. */
(function(){
'use strict';
const BASE = 'https://uottxgpjgakinqprexsp.supabase.co';
const KEY = 'natraj-demo-db-v31';
const APPS = ['attendance', 'rates', 'todo', 'expenses', 'banking', 'crm', 'designs', 'chits', 'silver', 'campaigns'];
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
// migration 029: staff add, change and remove only entries dated today or yesterday
const recentDay = d => { const y = new Date(); y.setDate(y.getDate() - 1); return !!d && d >= iso(y) && d <= iso(new Date()); };
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); };
const dow = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };
const parse0 = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
const now = () => new Date().toISOString();

function seed(){
  const staff = [['Sample Staff 1', 'Manager'], ['Sample Staff 2', 'Sales'], ['Sample Staff 3', 'Sales'], ['Sample Staff 4', 'Goldsmith']]
    .map(([name, designation]) => ({id: uid(), name, designation, phone: '', joined: null, active: true, created_at: now()}));
  const owner = {user_id: uid(), name: 'Owner', username: 'owner', is_owner: true, apps: APPS, staff_id: null, created_at: now()};
  const manager = {user_id: uid(), name: 'Sample Manager', username: 'sample-manager', is_owner: false, apps: ['attendance', 'rates', 'todo', 'expenses', 'banking', 'crm', 'designs', 'chits', 'silver', 'campaigns'], staff_id: staff[0].id, created_at: now()};
  const worker = {user_id: uid(), name: 'Sample Staff 2', username: 'sample-staff-2', is_owner: false, apps: [], staff_id: staff[1].id, created_at: now()};
  const db = {
    staff, profiles: [owner, manager, worker], settings: [{id: 1, weekly_off: 0, rate_due: '10:30:00', expense_categories: ['Salary & wages', 'Rent', 'Electricity', 'Tea & snacks', 'Staff food', 'Transport & petrol', 'Packing & boxes', 'Repairs & maintenance', 'Hallmarking', 'Stationery & printing', 'Advertising', 'Pooja & festival', 'Bank charges', 'Insurance', 'Other'], device_lock: false, silver_items: ['Anklet', 'Toe ring', 'Chain', 'Bangle', 'Bracelet', 'Ring', 'Kumkum bowl', 'Plate', 'Glass', 'Lamp (vilakku)', 'Pooja set', 'Idol', 'Kids items', 'Coin', 'Bar', 'Old silver']}], attendance: [], leave_requests: [], rates: [], tasks: [], expenses: [], notifications: [], bank_accounts: [], bank_entries: [], customers: [], customer_activity: [], user_prefs: [], designs: [], photos: {}, chit_plans: [], chit_members: [], chit_payments: [], chitSeq: {card: 1001, receipt: 1}, presence: [], silver_entries: [], report_cards: [], campaigns: [], campaign_contacts: [], campaign_costs: [], approved_devices: [], change_requests: [],
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
    status: done ? 'done' : 'open', done_note: (done || '').trim(), done_at: done ? (done === ' ' ? new Date(Date.now() - 2 * 3600e3).toISOString() : addDays(today, -1) + 'T17:20:00Z') : null, done_by_name: done ? to.name : '',
    created_by: by.user_id, created_by_name: by.name, created_at: addDays(today, -3) + 'T10:00:00Z'});
  db.tasks.push(
    task('Polish the silver display', worker, manager, today, false, 'Front counter and the window shelf.'),
    task('Call Ramesh about the bangle order', worker, owner, addDays(today, -1), true, 'He wants the 22K pair by Saturday.'),
    task('Count the 916 chain stock', manager, owner, addDays(today, 2), false),
    task('Order new jewel boxes', manager, owner, null, false, '100 small red boxes.'),
    task('Clean the hallmark machine', worker, manager, addDays(today, -1), false, '', 'Done before closing'),
    task('Open the shop and switch on the lights', worker, manager, today, false, '', ' '),
    task('Arrange the silver anklets tray', worker, manager, today, false, '', ' '),
    task('Update the old gold exchange register', manager, owner, today, false, '', ' ')
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
  // expenses not paid in cash came out of one of the two accounts
  db.expenses.forEach((e, i) => { e.account_id = null; e.account_name = ''; if(e.mode !== 'Cash'){ const a = i % 3 ? sbi : hdfc; e.account_id = a.id; e.account_name = a.name + ' ··' + a.last4; } });
  // GST bills: packing, hallmarking, the AC service and the paper ad. A month's bills are claimed in the return filed by the 20th of the next month.
  const GSTS = {'Packing & boxes': [18, '33AAKFS4521M1Z3'], 'Hallmarking': [18, '33AAAGB0911C1ZQ'], 'Repairs & maintenance': [18, ''], 'Advertising': [5, '33AABCD7316E1Z8']};
  const gstLastM = iso(new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1)).slice(0, 7);
  let bill = 1201;
  db.expenses.forEach(e => { const g = GSTS[e.category]; if(!g) return;
    e.gst_claimable = true; e.gst_rate = g[0]; e.gstin = g[1]; e.bill_no = g[1] ? 'INV-' + bill++ : '';
    e.gst_amount = Math.round(e.amount * g[0] / (100 + g[0]) * 100) / 100;
    if(e.category === 'Repairs & maintenance') e.paid_to = 'Cool Point AC Service';
    const m = e.day.slice(0, 7), claimedOn = iso(new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 20));
    e.gst_claimed_on = m < gstLastM || (m === gstLastM && Number(today.slice(8)) >= 20) ? claimedOn : null;
    e.gst_claimed_by_name = e.gst_claimed_on ? owner.name : ''; });
  // one change waiting for the owner: the manager forgot to enter a bill 4 days ago
  { const d4 = addDays(today, -4), data = {day: d4, amount: 340, category: 'Stationery & printing', mode: 'Cash', paid_to: 'Sri Ganesh Stores', note: 'Bill books', period_from: d4, period_to: d4};
    db.change_requests.push({id: uid(), app: 'expenses', action: 'add', target_id: null, data, before: null,
      summary: 'Stationery & printing · ₹340 · ' + new Date(d4 + 'T12:00:00').toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'}) + ' · to Sri Ganesh Stores',
      reason: 'Forgot to enter the bill on the day', status: 'pending', requested_by: manager.user_id, requested_by_name: manager.name, requested_at: today + 'T09:40:00',
      decided_by_name: '', decided_at: null, decision_note: '', result_id: null}); }
  db.expenses.forEach(e => { if(!e.gst_claimable){ e.gst_claimable = false; e.gst_rate = null; e.gst_amount = 0; e.gstin = ''; e.bill_no = ''; e.gst_claimed_on = null; e.gst_claimed_by_name = ''; } });
  const be = (a, day, direction, amount, method, party, reference, by, tid) => db.bank_entries.push({id: uid(), account_id: a.id, day, direction, amount, method, party: party || '', reference: reference || '', note: '', transfer_id: tid || null, for_chit: false,
    created_by: by.user_id, created_by_name: by.name, created_at: day + 'T11:30:00Z', updated_by_name: '', updated_at: null});
  // bank-paid expenses are in the bank log the same day (cheques two days later), except one left out to show the check
  let leftOut = false;
  db.expenses.filter(e => e.account_id).sort((x, y) => x.day.localeCompare(y.day)).forEach(e => {
    if(!leftOut && e.day < addDays(today, -5) && e.day >= addDays(today, -40)){ leftOut = true; return; }
    const d = e.mode === 'Cheque' ? addDays(e.day, 2) : e.day;
    if(d <= today) be(e.account_id === sbi.id ? sbi : hdfc, d, 'out', Number(e.amount), e.mode === 'Card' ? 'Other' : e.mode === 'Cheque' ? 'Cheque' : e.mode === 'Bank transfer' ? 'NEFT / RTGS / IMPS' : 'UPI', e.paid_to || e.category, '', manager);
  });
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
  // design library: customer enquiries and restock at every stage, with drawn sample photos (see samplePhoto)
  const at = (n, h) => addDays(today, n) + 'T' + (h || '11') + ':00:00Z';
  const des = (kind, metal, category, purity, weight_g, extra, kinds, ago, status) => {
    const r = Object.assign({id: uid(), kind, metal, category, purity, weight_g, size: '', qty: 1, budget: null, customer_id: null, customer_name: '', customer_phone: '', needed_by: null, supplier: '', notes: '',
      photos: kinds.map((k, i) => 'sample/' + k + '-' + metal.toLowerCase() + '-' + i + '-' + db.designs.length + '.svg'), status, expected: null, close_note: '',
      created_by: manager.user_id, created_by_name: manager.name, created_at: at(-ago, '10'), updated_by_name: '', updated_at: null,
      ordered_at: ['ordered', 'received', 'done'].includes(status) ? at(-ago + 1) : null, received_at: ['received', 'done'].includes(status) ? at(-Math.max(ago - 6, 0), '16') : null,
      closed_at: ['done', 'dropped'].includes(status) ? at(-Math.max(ago - 8, 0), '17') : null}, extra);
    db.designs.push(r); return r;
  };
  des('enquiry', 'Gold', 'Haram', '22K 916', 42, {customer_id: C[1].id, customer_name: C[1].name, customer_phone: C[1].phone, size: '30 inch', budget: 600000, needed_by: addDays(today, 20), supplier: 'Sri Murugan Works', notes: 'Temple bridal haram like the photo, a little lighter.'}, ['haram', 'haram'], 5, 'ordered').expected = addDays(today, 6);
  des('enquiry', 'Gold', 'Bangle', '22K 916', 24, {customer_id: C[0].id, customer_name: C[0].name, customer_phone: C[0].phone, size: '2.6', notes: 'Antique finish, pair.'}, ['bangle'], 9, 'received');
  des('enquiry', 'Gold', 'Necklace', '22K 916', 18, {customer_id: C[4].id, customer_name: C[4].name, customer_phone: C[4].phone, budget: 200000, needed_by: addDays(today, -2), notes: 'Kerala style, light weight.'}, ['necklace'], 12, 'open');
  des('enquiry', 'Gold', 'Chain', '22K 916', 4, {customer_id: C[6].id, customer_name: C[6].name, customer_phone: C[6].phone, size: '14 inch', needed_by: addDays(today, 10), notes: 'Kids’ chain under 4 g.'}, ['chain'], 3, 'open');
  des('enquiry', 'Diamond', 'Earrings', '18K 750', null, {customer_id: C[3].id, customer_name: C[3].name, customer_phone: C[3].phone, budget: 150000, supplier: 'Coimbatore Diamonds', notes: 'Solitaire studs, about 30 cents.'}, ['earrings'], 15, 'ordered');
  des('enquiry', 'Silver', 'Pooja items', '92.5 sterling', 250, {customer_name: 'Walk-in: Mr. Senthil', customer_phone: '9790011223', notes: 'Kumkum bowl set with plate.'}, ['bowl'], 25, 'done').close_note = 'Bought it';
  des('enquiry', 'Gold', 'Ring', '22K 916', 5, {customer_name: 'Walk-in: Mrs. Kavitha', customer_phone: ''}, ['ring'], 30, 'dropped').close_note = 'Bought elsewhere';
  des('restock', 'Gold', 'Ring', '22K 916', 4, {qty: 6, supplier: 'Sri Murugan Works', notes: 'Best sellers: CZ stone rings, sizes 12–16.'}, ['ring', 'ring'], 2, 'open');
  des('restock', 'Silver', 'Anklet', '92.5 sterling', 40, {qty: 4, supplier: 'Salem Silver House', notes: 'Ghungroo anklets, pairs.'}, ['chain'], 4, 'open');
  des('restock', 'Gold', 'Earrings', '22K 916', 6, {qty: 3, supplier: 'Kerala Designs', needed_by: addDays(today, -1), notes: 'Jhumkas sold out before the festival.'}, ['earrings'], 8, 'ordered');
  des('restock', 'Silver', 'Bangle', '92.5 sterling', 28, {qty: 5, supplier: 'Salem Silver House', notes: 'Kids’ bangles.'}, ['bangle'], 14, 'received');
  des('restock', 'Gold', 'Pendant', '22K 916', 3, {qty: 4, supplier: 'Sri Murugan Works'}, ['pendant'], 20, 'done').close_note = 'On the counter';
  const arrived = db.designs.find(d => d.kind === 'enquiry' && d.status === 'received');
  db.notifications.push({id: uid(), user_id: manager.user_id, kind: 'design_arrived', title: 'Arrived for ' + arrived.customer_name, body: '22K 916 gold bangle. Tell the customer.', link: 'designs/#d=' + arrived.id, created_at: new Date(Date.now() - 90 * 60000).toISOString(), read_at: null});
  // chit scheme: three plans and members at every stage (behind, up to date, ready to redeem, closed)
  const plan = (name, saves, months, instalment, bonus_kind, bonus_value, benefit) => { const p = {id: uid(), name, saves, months, instalment, bonus_kind, bonus_value, benefit, active: true, created_at: at(-400)}; db.chit_plans.push(p); return p; };
  const P1 = plan('Gold savings ₹1,000 × 11', 'money', 11, 1000, 'instalment', 0, 'No wastage up to 8%');
  const P2 = plan('Swarna gold ₹2,000 × 11', 'gold', 11, 2000, 'percent', 5, '');
  const P3 = plan('Flexi 12 months', 'money', 12, null, 'percent', 3, '');
  const month0 = today.slice(0, 7) + '-01', monthAgo = n => { const [y, m] = month0.split('-').map(Number); const d = new Date(y, m - 1 - n, 1); return iso(d); };
  const rateOn = d => { let r = null; for(const x of db.rates){ if(x.set_at.slice(0, 10) <= d && (!r || x.set_at > r.set_at)) r = x; } return r ? r.gold_22k : 6600; };
  const member = (pl, name, phone, cust, startAgo, paidMonths, extra) => {
    const m = Object.assign({id: uid(), card_no: String(db.chitSeq.card++), plan_id: pl.id, customer_id: cust ? cust.id : null, name, phone, start_month: monthAgo(startAgo), status: 'active', closed_at: null, close_note: '', notes: '',
      created_by: manager.user_id, created_by_name: manager.name, created_at: monthAgo(startAgo) + 'T11:00:00Z', updated_by_name: '', updated_at: null}, extra || {});
    db.chit_members.push(m);
    for(let i = 0; i < paidMonths; i++){
      let day = addDays(monthAgo(startAgo - i), 4 + Math.floor(rnd() * 8));
      if(day > today) day = today;
      const amount = pl.instalment || (Math.round((1 + rnd() * 4)) * 500), gr = pl.saves === 'gold' ? rateOn(day) : null;
      db.chit_payments.push({id: uid(), receipt_no: db.chitSeq.receipt++, member_id: m.id, paid_on: day, amount, mode: rnd() < 0.6 ? 'Cash' : 'UPI', gold_rate: gr, grams: gr ? Math.round(amount / gr * 1000) / 1000 : null, note: '',
        created_by: manager.user_id, created_by_name: rnd() < 0.5 ? manager.name : 'Sample Staff 2', created_at: day + 'T12:00:00Z', updated_by_name: '', updated_at: null});
    }
    return m;
  };
  member(P1, C[0].name, C[0].phone, C[0], 10, 11);                       // all 11 paid: ready to redeem
  member(P1, C[2].name, C[2].phone, C[2], 6, 7);                         // up to date, paid this month
  member(P1, C[4].name, C[4].phone, C[4], 5, 3);                         // behind
  member(P1, 'Sample Member Ganesh', '9786012345', null, 3, 3);          // not yet paid this month
  member(P2, C[1].name, C[1].phone, C[1], 8, 9);                         // gold, up to date
  member(P2, C[3].name, C[3].phone, C[3], 4, 3);                         // gold, one behind
  member(P3, C[6].name, C[6].phone, C[6], 7, 8);                         // flexible, up to date
  member(P3, 'Sample Member Revathi', '', null, 2, 1);                   // flexible, behind, no phone
  member(P1, C[5].name, C[5].phone, C[5], 13, 11, {status: 'closed', closed_at: monthAgo(1) + 'T15:00:00Z', close_note: 'Bought a 22K chain, bill 1432'});
  // chit money in the bank: UPI and transfers the same day, cards the next day, one UPI payment left out so the check shows a gap
  db.chit_payments.filter(p => p.paid_on >= month0).forEach((p, i) => { p.mode = ['UPI', 'Cash', 'UPI', 'Card'][i % 4]; });
  // silver: most days a few sales and sometimes old silver bought back, at that day's rate; a supplier purchase each month
  const silverRate = d => { let r = null; for(const x of db.rates){ if(x.set_at.slice(0, 10) <= d && (!r || x.set_at > r.set_at)) r = x; } return r ? Number(r.silver) : 90; };
  const SITEMS = [['Anklet', 30, 70], ['Toe ring', 4, 10], ['Kumkum bowl', 25, 60], ['Plate', 80, 200], ['Glass', 40, 90], ['Lamp (vilakku)', 60, 180], ['Kids items', 8, 20], ['Chain', 15, 40]];
  for(let d = monthAgo(1); d <= today; d = addDays(d, 1)){
    if(dow(d) === 0) continue;
    const rt = silverRate(d), n = 1 + Math.floor(rnd() * 3);
    for(let i = 0; i < n; i++){
      const [item, lo, hi] = SITEMS[Math.floor(rnd() * SITEMS.length)], w = Math.round((lo + rnd() * (hi - lo)) * 1000) / 1000, making = Math.round(w * (8 + rnd() * 12) / 10) * 10;
      const m = rnd() < 0.55 ? 'Cash' : rnd() < 0.8 ? 'UPI' : 'Card', acc = m === 'Cash' ? null : sbi;
      db.silver_entries.push(silverRow({kind: 'sale', day: d, item, pieces: item === 'Anklet' || item === 'Toe ring' ? 2 : 1, weight_g: w, touch: 92.5, rate: rt + 2, making, gst_percent: 3, mode: m, account_id: acc && acc.id, account_name: acc ? acc.name + ' ··' + acc.last4 : '', party: rnd() < 0.4 ? C[Math.floor(rnd() * 6)].name : ''}, d));
    }
    if(rnd() < 0.35) db.silver_entries.push(silverRow({kind: 'purchase', day: d, item: 'Old silver', weight_g: Math.round((40 + rnd() * 200) * 1000) / 1000, touch: [70, 75, 80, 85][Math.floor(rnd() * 4)], rate: rt - 4, mode: 'Cash', party: 'Walk-in'}, d));
  }
  [monthAgo(1), month0].forEach(m => { const d = addDays(m, 3); if(d <= today) db.silver_entries.push(silverRow({kind: 'purchase', from_supplier: true, day: d, item: 'Bar', weight_g: 2000, touch: 99.9, rate: silverRate(d) - 1, mode: 'Bank transfer', account_id: sbi.id, account_name: sbi.name + ' ··' + sbi.last4, party: 'Salem Silver House'}, d)); });
  // report cards: last month's card shared with Sample Staff 2; this month rated for the manager, not shared yet
  const lastM = monthAgo(1);
  db.report_cards.push({id: uid(), staff_id: staff[1].id, month: lastM, ratings: {punctual: 4, service: 5, team: 4, knowledge: 3, discipline: 4},
    remarks: 'Very good with customers at the silver counter. Come in on time for the morning opening.', target: 'Learn the gold rate message and send it on time.',
    metrics: {att: {working: 26, worked: 24.5, leave: 1, absent: 0, half: 1, unmarked: 0, pct: 94.2}, linked: true, signIn: worker.name,
      tasks: {given: 9, done: 8, onTime: 7, overdue: 1, onTimePct: 77.8}, work: {customers: 6, visits: 11, followups: 4, enquiries: 3, chitMembers: 1, chitPays: 14, chitAmount: 21000, silverSales: 22, silverGrams: 1104.5, silverAmount: 112400, rates: 0}},
    score: 85.6, grade: 'A', shared: true, shared_at: lastM.slice(0, 8) + '28T18:00:00Z', updated_by_name: 'Owner', updated_at: lastM.slice(0, 8) + '28T18:00:00Z'});
  db.report_cards.push({id: uid(), staff_id: staff[0].id, month: month0, ratings: {punctual: 5, service: 4, team: 5, knowledge: 5, discipline: 4}, remarks: 'Runs the floor well.', target: '',
    metrics: {}, score: null, grade: '', shared: false, shared_at: null, updated_by_name: 'Owner', updated_at: now()});
  // campaigns: Navaratri finished with results, Diwali running and half sent
  const camp = (name, occasion, starts, ends, channels, offer, budget) => { const c = {id: uid(), name, occasion, starts, ends, channels, offer, message: '', budget, notes: '', created_by: owner.user_id, created_by_name: owner.name, created_at: starts + 'T09:00:00Z', updated_by_name: '', updated_at: null}; db.campaigns.push(c); return c; };
  const contact = (c, cu, extra) => db.campaign_contacts.push(Object.assign({id: uid(), campaign_id: c.id, customer_id: cu ? cu.id : null, name: cu ? cu.name : '', phone: cu ? cu.phone : '', walk_in: false, sent_at: null, sent_by_name: '', came: false, came_on: null, bought: null, note: '',
    created_by: manager.user_id, created_at: c.starts + 'T10:00:00Z', updated_by_name: '', updated_at: null}, extra || {}));
  const cost = (c, day, channel, what, amount) => db.campaign_costs.push({id: uid(), campaign_id: c.id, day, channel, what, amount, created_by: manager.user_id, created_by_name: manager.name, created_at: day + 'T12:00:00Z'});
  const nav = camp('Navaratri silver gifts', 'Navaratri', addDays(today, -40), addDays(today, -28), ['WhatsApp', 'Pamphlet'], 'Free silver kumkum box on purchases above ₹25,000', 15000);
  [C[0], C[1], C[2], C[4]].forEach((cu, i) => contact(nav, cu, {sent_at: addDays(today, -39) + 'T11:00:00Z', sent_by_name: manager.name,
    came: i < 3, came_on: i < 3 ? addDays(today, -36 + i) : null, bought: i === 0 ? 68000 : i === 2 ? 24500 : null, note: i === 0 ? 'Antique bangles' : i === 2 ? 'Silver pooja set' : ''}));
  contact(nav, null, {name: 'Walk-in Saranya', phone: '9876501234', walk_in: true, came: true, came_on: addDays(today, -33), bought: 31000, note: 'Heard via Pamphlet'});
  cost(nav, addDays(today, -41), 'Pamphlet', '3,000 pamphlets with the newspaper', 4500);
  const dip = camp('Diwali gold coin offer', 'Diwali', addDays(today, -3), addDays(today, 18), ['WhatsApp', 'Instagram', 'Radio'], 'No wastage on gold coins, 50% off making on necklaces', 40000);
  [C[0], C[1], C[2], C[4]].forEach((cu, i) => contact(dip, cu, i < 2 ? {sent_at: addDays(today, -2) + 'T11:00:00Z', sent_by_name: manager.name} : {}));
  cost(dip, addDays(today, -3), 'Radio', '20 radio spots, Hello FM', 18000);
  cost(dip, addDays(today, -2), 'Instagram', 'Boosted post, 7 days', 3500);
  // who is online: Sample Staff 2 is always on the tasks page on a phone; the manager was here 40 minutes ago
  const ago = m => new Date(Date.now() - m * 60000).toISOString();
  db.presence.push({user_id: worker.user_id, page: 'Tasks', device: 'Phone', signed_in_at: ago(25), last_seen: ago(0), signed_out_at: null, demo_live: true},
    {user_id: manager.user_id, page: 'Chit scheme', device: 'Computer', signed_in_at: ago(95), last_seen: ago(40), signed_out_at: null});
  const chitBank = {};
  let skipped = false;
  db.chit_payments.filter(p => p.mode !== 'Cash' && p.paid_on >= monthAgo(1)).forEach(p => {
    if(!skipped && p.paid_on >= month0){ skipped = true; return; }
    const d = p.mode === 'Card' ? addDays(p.paid_on, 1) : p.paid_on;
    if(d > today) return;
    chitBank[d] = (chitBank[d] || 0) + Number(p.amount);
  });
  Object.entries(chitBank).forEach(([d, amt]) => { be(sbi, d, 'in', amt, 'UPI', 'Chit members', '', manager); db.bank_entries[db.bank_entries.length - 1].for_chit = true; });
  const note = (u, kind, title, body, mins) => db.notifications.push({id: uid(), user_id: u.user_id, kind, title, body, link: 'todo/#all', created_at: new Date(Date.now() - mins * 60000).toISOString(), read_at: null});
  note(manager, 'task_done', 'Sample Staff 2 completed a task', 'Clean the hallmark machine', 60 * 20);
  note(owner, 'tasks_all_done', 'Sample Staff 3 finished all their tasks', '3 done today. Last one: Arrange the silver anklets tray', 45);
  return db;
}
let db;
try{ db = JSON.parse(localStorage.getItem(KEY)) || seed(); }catch(e){ db = seed(); }
db.tokenAal = db.tokenAal || {};
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
function session(username, aal){
  const u = db.users[username]; aal = aal === 'aal2' ? 'aal2' : 'aal1';
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const t = b64({alg: 'HS256', typ: 'JWT'}) + '.' + b64({sub: u.id, exp, role: 'authenticated', aud: 'authenticated', aal, n: Math.random()}) + '.demo';
  db.tokens[t] = u.id; db.tokenAal[t] = aal; save();
  return {access_token: t, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'demo-' + username + '~' + aal,
    user: {id: u.id, aud: 'authenticated', role: 'authenticated', email: username + '@staff.natraj-tools.app', app_metadata: {}, user_metadata: {}, created_at: now(),
      factors: (u.factors || []).map(f => ({id: f.id, factor_type: 'totp', status: f.status, friendly_name: f.friendly_name, created_at: f.created_at, updated_at: f.created_at}))}};
}
// two-step sign-in: someone with a verified authenticator must have typed its code (aal2). In the demo any 6 digits work.
const tokenOf = h => ((h && h.get && h.get('authorization')) || '').replace(/^Bearer /, '');
const userNameOf = t => Object.keys(db.users).find(k => db.users[k].id === db.tokens[t]);
const aalOk = h => { const t = tokenOf(h), n = userNameOf(t);
  return !n || !(db.users[n].factors || []).some(f => f.status === 'verified') || db.tokenAal[t] === 'aal2'; };
const DEMO_QR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29" shape-rendering="crispEdges"><rect width="29" height="29" fill="white"/>' +
  [[0,0],[22,0],[0,22]].map(([x, y]) => '<rect x="' + (x + 0.5) + '" y="' + (y + 0.5) + '" width="6" height="6" fill="none" stroke="black"/><rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="3" height="3" fill="black"/>').join('') +
  Array.from({length: 120}, (_, i) => { const x = 8 + (i * 7) % 13, y = (i * 11) % 29; return (x > 21 && y < 8) || (y > 21 && x < 8) ? '' : '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="black"/>'; }).join('') + '</svg>';
function factors(method, p, body, token){
  const n = userNameOf(token); if(!n) return {status: 401, body: {message: 'invalid JWT'}};
  const u = db.users[n]; u.factors = u.factors || [];
  const m = /^\/auth\/v1\/factors(?:\/([^/]+))?(?:\/(challenge|verify))?$/.exec(p), f = m[1] && u.factors.find(x => x.id === m[1]);
  const aal2 = db.tokenAal[token] === 'aal2', hasVerified = u.factors.some(x => x.status === 'verified');
  if(!m[1] && method === 'POST'){
    if(hasVerified && !aal2) return {status: 422, body: {code: 'insufficient_aal', message: 'AAL2 required to enroll a new factor'}};
    const nf = {id: uid(), status: 'unverified', friendly_name: body.friendly_name || 'Phone', created_at: now()}; u.factors.push(nf);
    return {status: 200, body: {id: nf.id, type: 'totp', friendly_name: nf.friendly_name, totp: {qr_code: DEMO_QR, secret: 'DEMOKEY2026NATRAJJEWELSDEMO', uri: 'otpauth://totp/Natraj%20Jewels:demo'}}};
  }
  if(!f) return {status: 404, body: {message: 'Factor not found'}};
  if(m[2] === 'challenge') return {status: 200, body: {id: uid(), type: 'totp', expires_at: Math.floor(Date.now() / 1000) + 300}};
  if(m[2] === 'verify'){
    if(!/^[0-9]{6}$/.test(String(body.code || ''))) return {status: 422, body: {code: 'mfa_verification_failed', message: 'Invalid TOTP code entered'}};
    f.status = 'verified'; return {status: 200, body: session(n, 'aal2')};
  }
  if(method === 'DELETE'){
    if(f.status === 'verified' && !aal2) return {status: 422, body: {code: 'insufficient_aal', message: 'AAL2 required to unenroll verified factor'}};
    u.factors = u.factors.filter(x => x !== f); return {status: 200, body: {id: f.id}};
  }
  return {status: 404, body: {message: 'Not found'}};
}
const meOf = token => db.profiles.find(p => p.user_id === db.tokens[token]);
const canUse = (p, app) => !!p && (p.is_owner || p.apps.includes(app));
const isOff = day => db.settings[0].weekly_off === dow(day);

function cmp(a, op, b){
  a = a === null || a === undefined ? (op === 'is' ? 'null' : '') : String(a);
  if(op === 'eq' || op === 'is') return a === b;
  if(op === 'neq') return a !== b;
  if(op === 'lt') return a < b;
  if(op === 'gt') return a > b;
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
function people(body, me, headers){
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
      db.users[name].pin = body.pin; db.users[name].factors = [];
      return {status: 200, body: {username: name}};
    }
  }
  if(!me) return err('Sign in first.', 401);
  if(!aalOk(headers)) return err('Type the code from your authenticator app first.', 403);
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
      if(body.two_step_off === true) db.users[t.username].factors = [];
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
/* migration 026: devices staff can use (the demo keeps the key itself; the real database keeps only a hash) */
const devKey = h => { const k = (h && h.get && h.get('x-natraj-device')) || ''; return k.length >= 32 ? k : null; };
const deviceOk = (me, h) => aalOk(h) && (!db.settings[0].device_lock || (me && me.is_owner) || db.approved_devices.some(d => d.key_hash === devKey(h)));
/* migration 029: changes to older days, asked by staff and approved by the owner */
const CT = {expenses: ['expenses', ['day','amount','category','mode','account_id','paid_to','note','period_from','period_to','gst_claimable','gst_rate','gstin','bill_no']],
  banking: ['bank_entries', ['account_id','day','direction','amount','method','party','reference','note','for_chit']],
  silver: ['silver_entries', ['kind','day','item','party','phone','customer_id','from_supplier','pieces','weight_g','touch','rate','making','gst_percent','mode','account_id','bill_no','note']],
  chits: ['chit_payments', ['member_id','paid_on','amount','mode','gold_rate','note']]};
function applyChange(app, action, target, data, who, tryOnly){
  const tbl = CT[app][0], snap = JSON.stringify(db[tbl]);
  const meX = Object.assign({}, who, {is_owner: true});     // made as them, without the day limit
  const res = rest(action === 'add' ? 'POST' : action === 'edit' ? 'PATCH' : 'DELETE', tbl, new URLSearchParams(action === 'add' ? '' : 'id=eq.' + target), data, new Headers({prefer: 'return=representation'}), meX);
  const row = res.body && (Array.isArray(res.body) ? res.body[0] : res.body);
  if(tryOnly || res.status >= 300) db[tbl] = JSON.parse(snap);
  if(res.status >= 300) throw res;
  if(!row && action !== 'add') throw {status: 400, body: {code: 'P0002', message: 'That entry no longer exists.'}};
  return row && row.id;
}
function changeRpc(name, a, me, headers){
  const pg = (message, code) => ({status: 400, body: {code: code || '22023', message}});
  if(!me) return {status: 401, body: {message: 'no'}};
  if(!deviceOk(me, headers)) return {status: 403, body: {code: '42501', message: 'permission denied'}};
  if(name === 'request_change'){
    const ct = CT[a.p_app]; if(!ct || !['add', 'edit', 'delete'].includes(a.p_action)) return pg('Unknown change.');
    if(!canUse(me, a.p_app)) return {status: 403, body: {code: '42501', message: 'Ask the owner for access to this app.'}};
    if(!String(a.p_reason || '').trim()) return pg('Write a short reason for the owner.');
    const data = {}; Object.keys(a.p_data || {}).filter(k => ct[1].includes(k)).forEach(k => data[k] = a.p_data[k]);
    let before = null;
    if(a.p_action !== 'add'){
      before = db[ct[0]].find(r => r.id === a.p_target);
      if(!before) return pg('That entry no longer exists.', 'P0002');
      if(['expenses', 'banking'].includes(a.p_app) && !me.is_owner && before.created_by !== me.user_id) return {status: 403, body: {code: '42501', message: 'You can ask to change only entries you made.'}};
      if(a.p_app === 'banking' && before.transfer_id) return pg('Transfers between accounts on older days are changed by the owner. Please ask the owner.');
      before = JSON.parse(JSON.stringify(before));
    }
    if(!(a.p_app === 'chits' && a.p_action === 'add')){ try{ applyChange(a.p_app, a.p_action, a.p_target, data, me, true); }catch(e){ return e.status ? e : pg(String(e)); } }
    const q = {id: uid(), app: a.p_app, action: a.p_action, target_id: a.p_action === 'add' ? null : a.p_target, data, before, summary: String(a.p_summary || '').slice(0, 300),
      reason: String(a.p_reason).trim(), status: 'pending', requested_by: me.user_id, requested_by_name: me.name, requested_at: now(), decided_by_name: '', decided_at: null, decision_note: '', result_id: null};
    db.change_requests.push(q);
    db.profiles.filter(p => p.is_owner).forEach(p => db.notifications.push({id: uid(), user_id: p.user_id, kind: 'change_request', title: me.name + ' asks to ' + {add: 'add', edit: 'change', delete: 'remove'}[q.action] + ' an older entry', body: q.summary + ' · ' + q.reason, link: q.app + '/', created_at: q.requested_at, read_at: null}));
    return {status: 200, body: q.id};
  }
  if(name === 'cancel_change_request'){
    const q = db.change_requests.find(x => x.id === a.p_id && x.requested_by === me.user_id && x.status === 'pending');
    if(!q) return pg('That request is no longer waiting.');
    q.status = 'cancelled'; q.decided_at = now(); return {status: 204, body: null};
  }
  if(name === 'decide_change_request'){
    if(!me.is_owner) return {status: 403, body: {code: '42501', message: 'Only the owner approves changes.'}};
    const q = db.change_requests.find(x => x.id === a.p_id);
    if(!q) return pg('That request no longer exists.', 'P0002');
    if(q.status !== 'pending') return pg('This request was already ' + q.status + '.');
    let res = null;
    if(a.p_approve){
      const who = db.profiles.find(p => p.user_id === q.requested_by);
      if(!who) return pg('The person who asked has been removed, so the change can\'t be made in their name. Reject it and make the change yourself.');
      try{ res = applyChange(q.app, q.action, q.target_id, q.data, who, false); }catch(e){ return e.status ? e : pg(String(e)); }
    }
    Object.assign(q, {status: a.p_approve ? 'approved' : 'rejected', decided_by_name: me.name, decided_at: now(), decision_note: String(a.p_note || '').trim(), result_id: res});
    db.notifications.push({id: uid(), user_id: q.requested_by, kind: 'change_decided', title: me.name + (a.p_approve ? ' approved your change' : ' did not approve your change'), body: q.summary + (q.decision_note ? ' · ' + q.decision_note : ''), link: q.app + '/', created_at: q.decided_at, read_at: null});
    return {status: 200, body: {status: q.status, result_id: res}};
  }
}
function rpc(name, a, me, headers){
  if(['request_change', 'cancel_change_request', 'decide_change_request'].includes(name)) return changeRpc(name, a, me, headers);
  if(name === 'add_silver_item'){
    if(!me || !canUse(me, 'silver')) return {status: 403, body: {code: '42501', message: 'Ask the owner for access to Silver.'}};
    const v = String(a.p_name || '').trim().replace(/\s+/g, ' '); if(!v || v.length > 60) return {status: 400, body: {code: '22023', message: 'An item name is 1 to 60 letters.'}};
    const st = db.settings[0]; st.silver_items = st.silver_items || []; if(!st.silver_items.some(x => x.toLowerCase() === v.toLowerCase())) st.silver_items.push(v);
    return {status: 200, body: st.silver_items};
  }
  if(name === 'device_status'){ const k = devKey(headers), d = db.approved_devices.find(x => x.key_hash === k);
    return {status: 200, body: {locked: !!db.settings[0].device_lock, approved: !!d, name: d ? d.name : null, has_key: !!k, ok: deviceOk(me, headers)}}; }
  if(name === 'two_step_people') return {status: 200, body: me && me.is_owner && aalOk(headers)
    ? Object.values(db.users).filter(u => (u.factors || []).some(f => f.status === 'verified')).map(u => ({user_id: u.id, since: u.factors[0].created_at})) : []};
  if(name === 'approve_this_device'){
    if(!me || !me.is_owner || !aalOk(headers)) return {status: 403, body: {code: '42501', message: 'Only the owner can approve a device.'}};
    const k = devKey(headers), nm = String(a.p_name || '').trim();
    if(!k) return {status: 400, body: {code: '22023', message: 'This browser did not send its device key. Reload the page and try again.'}};
    if(!nm) return {status: 400, body: {code: '22023', message: 'Give the device a name, e.g. Counter computer.'}};
    const d = db.approved_devices.find(x => x.key_hash === k); if(d) d.name = nm; else db.approved_devices.push({id: uid(), name: nm, key_hash: k, approved_by_name: me.name, created_at: now(), last_seen_at: null});
    return rpc('device_status', {}, me, headers);
  }
  if(me && !deviceOk(me, headers) && !['login_names', 'setup_needed', 'leave_staff', 'request_leave', 'presence_out', 'heartbeat'].includes(name)) return {status: 403, body: {code: '42501', message: 'permission denied'}};
  if(name === 'heartbeat' && me && !deviceOk(me, headers)) a = Object.assign({}, a, {p_page: 'Not approved device'});
  if(name === 'heartbeat' && me){ const d = db.approved_devices.find(x => x.key_hash === devKey(headers)); if(d) d.last_seen_at = now(); }
  const pg = message => ({status: 400, body: {code: '22023', message, details: null, hint: null}});
  switch(name){
    case 'heartbeat': {
      if(!me) return {status: 200, body: null};
      let r = db.presence.find(x => x.user_id === me.user_id); const t = now();
      if(!r){ r = {user_id: me.user_id, signed_in_at: t}; db.presence.push(r); }
      else if(r.signed_out_at || Date.now() - new Date(r.last_seen) > 600000) r.signed_in_at = t;
      Object.assign(r, {page: String(a.p_page || '').slice(0, 40), device: String(a.p_device || '').slice(0, 20), last_seen: t, signed_out_at: null, demo_live: false});
      return {status: 200, body: null};
    }
    case 'presence_out': { const r = me && db.presence.find(x => x.user_id === me.user_id); if(r){ r.signed_out_at = now(); r.demo_live = false; } return {status: 200, body: null}; }
    case 'bank_account_choices': return {status: 200, body: (canUse(me, 'expenses') || canUse(me, 'banking') || canUse(me, 'silver')) ? db.bank_accounts.filter(x => x.active).map(x => ({id: x.id, name: x.name, last4: x.last4})).sort((x, y) => x.name.localeCompare(y.name)) : []};
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
    chit_plans: {read: canUse(me, 'chits'), write: me.is_owner}, chit_members: {read: canUse(me, 'chits'), write: method === 'DELETE' ? me.is_owner : canUse(me, 'chits')},
    chit_payments: {read: canUse(me, 'chits'), write: canUse(me, 'chits')}, presence: {read: true, write: false}, approved_devices: {read: me.is_owner, write: me.is_owner}, campaigns: {read: canUse(me, 'campaigns'), write: method === 'DELETE' ? me.is_owner : canUse(me, 'campaigns')},
    campaign_contacts: {read: canUse(me, 'campaigns'), write: canUse(me, 'campaigns')}, campaign_costs: {read: canUse(me, 'campaigns'), write: canUse(me, 'campaigns')}, report_cards: {read: true, write: me.is_owner}, silver_entries: {read: canUse(me, 'silver'), write: canUse(me, 'silver')},
    designs: {read: canUse(me, 'designs'), write: method === 'DELETE' ? me.is_owner : canUse(me, 'designs')},
    tasks: {read: true, write: method === 'PATCH' || canUse(me, 'todo')}, change_requests: {read: true, write: false}
  }[table];
  if(!rule) return {status: 404, body: {message: 'Unknown table'}};
  if(method === 'GET' ? !rule.read : !rule.write) return denied;
  // a device the owner has not approved, while the lock is on: nothing but the person's own profile
  if(!deviceOk(me, headers)){
    if(table === 'profiles' && method === 'GET'){ const own = db.profiles.filter(p => p.user_id === me.user_id); return {status: 200, body: /vnd\.pgrst\.object/.test(headers.get('accept') || '') ? own[0] || null : own}; }
    return method === 'GET' ? {status: 200, body: /vnd\.pgrst\.object/.test(headers.get('accept') || '') ? null : []} : denied;
  }
  let rows = db[table];
  if(table === 'profiles' && !me.is_owner) rows = rows.filter(p => p.user_id === me.user_id);
  const single = /vnd\.pgrst\.object/.test(headers.get('accept') || '');
  const wantRows = /return=representation/.test(headers.get('prefer') || '');
  if(table === 'presence'){
    if(method !== 'GET') return denied;
    db.presence.forEach(r => { if(r.demo_live && !r.signed_out_at) r.last_seen = now(); });   // the sample person stays online in the demo
    return {status: 200, body: db.presence.filter(r => me.is_owner || r.user_id === me.user_id).map(r => Object.assign({}, r))};
  }
  if(table === 'change_requests'){
    const out = sortBy(db.change_requests.filter(q => me.is_owner || q.requested_by === me.user_id).filter(q => matches(q, params)), params.get('order'));
    return {status: 200, body: out.slice(0, Number(params.get('limit') || 1000))};
  }
  if(table === 'expenses') return expensesRest(method, params, body, single, wantRows, me);
  if(table === 'user_prefs') return prefsRest(method, params, body, single, wantRows, me);
  if(table === 'customers' || table === 'customer_activity') return crmRest(table, method, params, body, single, wantRows, me);
  if(table === 'bank_accounts') return bankAccountsRest(method, params, body, single, wantRows, me);
  if(table === 'bank_entries') return bankEntriesRest(method, params, body, single, wantRows, me);
  if(table === 'notifications') return notesRest(method, params, body, single, wantRows, me);
  if(table === 'tasks') return tasksRest(method, params, body, single, wantRows, me);
  if(table === 'designs') return designsRest(method, params, body, single, wantRows, me);
  if(table === 'report_cards'){
    let out = db.report_cards.filter(r => me.is_owner || (r.shared && r.staff_id === me.staff_id)).filter(r => matches(r, params));
    const stamp = (r, old) => { r.updated_by_name = me.name; r.updated_at = now(); if(r.shared && (!old || !old.shared || JSON.stringify(r.metrics) !== JSON.stringify(old.metrics))) r.shared_at = r.updated_at; if(!r.shared) r.shared_at = null; };
    if(method === 'GET') sortBy(out, params.get('order'));
    else if(method === 'POST'){ const r = Object.assign({id: uid(), ratings: {}, remarks: '', target: '', metrics: {}, score: null, grade: '', shared: false, shared_at: null}, Array.isArray(body) ? body[0] : body);
      if(db.report_cards.some(x => x.staff_id === r.staff_id && x.month === r.month)) return {status: 409, body: {code: '23505', message: 'duplicate key'}};
      stamp(r, null); db.report_cards.push(r); out = [r]; }
    else if(method === 'PATCH') out.forEach(r => { const old = JSON.parse(JSON.stringify(r)); Object.assign(r, body); stamp(r, old); });
    else if(method === 'DELETE') db.report_cards = db.report_cards.filter(r => !out.includes(r));
    if(method !== 'GET' && !wantRows) return {status: 204, body: null};
    if(single){ if(!out.length) return {status: 406, body: {code: 'PGRST116', message: 'No rows'}}; return {status: 200, body: out[0]}; }
    return {status: 200, body: out.map(r => JSON.parse(JSON.stringify(r)))};
  }
  if(table.startsWith('campaign')) return campaignsRest(table, method, params, body, single, wantRows, me);
  if(table === 'silver_entries') return silverRest(method, params, body, single, wantRows, me);
  if(table.startsWith('chit_')) return chitsRest(table, method, params, body, single, wantRows, me);
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
/* migration 022: the account an expense was paid from keeps its name on the expense; cash has none */
function expenseGst(r, old, me){   // migration 028: GST in the bill, worked out from the rate; only the owner marks it claimed
  r.gstin = String(r.gstin || '').replace(/\s/g, '').toUpperCase(); r.bill_no = r.bill_no || '';
  if(r.gst_claimable){ const g = Number(r.gst_rate); r.gst_amount = g ? Math.round(Number(r.amount) * g / (100 + g) * 100) / 100 : 0; }
  else { r.gst_claimable = false; r.gst_rate = null; r.gst_amount = 0; r.gst_claimed_on = null; }
  if(!(me && me.is_owner)){ r.gst_claimed_on = old && r.gst_claimable ? old.gst_claimed_on || null : null; r.gst_claimed_by_name = old ? old.gst_claimed_by_name || '' : ''; }
  else if(!r.gst_claimed_on) r.gst_claimed_by_name = '';
  else if(!old || old.gst_claimed_on !== r.gst_claimed_on) r.gst_claimed_by_name = me.name;
}
function expenseAccount(r, old){
  if(r.mode === 'Cash') r.account_id = null;
  if(!r.account_id){ if(!old || old.account_id || r.mode === 'Cash') r.account_name = ''; }
  else if(!old || r.account_id !== old.account_id){ const a = db.bank_accounts.find(x => x.id === r.account_id); r.account_name = a ? a.name + (a.last4 ? ' ··' + a.last4 : '') : ''; }
}
function expensesRest(method, params, body, single, wantRows, me){
  const owner = me.is_owner, may = canUse(me, 'expenses');
  const ownToday = r => r.created_by === me.user_id && recentDay(r.day);
  const denied = {status: 403, body: {code: '42501', message: 'new row violates row-level security policy for table "expenses"'}};
  let out = db.expenses.filter(r => owner || r.created_by === me.user_id).filter(r => matches(r, params));
  if(method === 'GET') out = sortBy(out.slice(), params.get('order'));
  else if(method === 'POST'){
    if(!owner && !recentDay(body.day)) return denied;
    const r = Object.assign({id: uid(), mode: 'Cash', paid_to: '', note: ''}, body, {created_by: me.user_id, created_by_name: me.name, created_at: now(), updated_by_name: '', updated_at: null});
    if(!r.period_from || !r.period_to){ r.period_from = r.day; r.period_to = r.day; }
    expenseAccount(r, null); expenseGst(r, null, me);
    db.expenses.push(r); out = [r];
  } else if(method === 'PATCH'){
    out = out.filter(r => owner || (may && ownToday(r)));
    if(!owner && body.day && !recentDay(body.day)) return denied;
    out.forEach(r => { const old = Object.assign({}, r); Object.assign(r, body, {updated_by_name: me.name, updated_at: now()}); expenseAccount(r, old); expenseGst(r, old, me); });
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
  const ownToday = r => r.created_by === me.user_id && recentDay(r.day);
  let out = db.bank_entries.filter(r => owner || (may && r.created_by === me.user_id)).filter(r => matches(r, params));
  if(method === 'GET') sortBy(out, params.get('order'));
  else if(method === 'POST'){
    if(!may || (!owner && (Array.isArray(body) ? body : [body]).some(b => !recentDay(b.day)))) return {status: 403, body: {code: '42501', message: 'new row violates row-level security policy for table "bank_entries"'}};
    out = (Array.isArray(body) ? body : [body]).map(b => Object.assign({id: uid(), method: '', party: '', reference: '', note: '', transfer_id: null, for_chit: false}, b,
      {created_by: me.user_id, created_by_name: me.name, created_at: nowIso, updated_by_name: '', updated_at: null}));
    db.bank_entries.push(...out);
  } else if(method === 'PATCH'){
    out = out.filter(r => owner || (may && ownToday(r)));
    if(!owner && body.day && !recentDay(body.day)) return {status: 403, body: {code: '42501', message: 'new row violates row-level security policy for table "bank_entries"'}};
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
/* design library (migration 018): enquiries and restock; each stage is stamped, and whoever took an enquiry hears when it arrives */
function designsRest(method, params, body, single, wantRows, me){
  const nowIso = now();
  const stage = (r, old) => {
    if(['ordered', 'received', 'done'].includes(r.status) && !r.ordered_at) r.ordered_at = nowIso;
    if(['received', 'done'].includes(r.status) && !r.received_at) r.received_at = nowIso;
    r.closed_at = ['done', 'dropped'].includes(r.status) ? (r.closed_at || nowIso) : null;
    if(r.status === 'open'){ r.ordered_at = null; r.received_at = null; }
    if(r.status === 'ordered') r.received_at = null;
    if(r.kind === 'enquiry' && !String(r.customer_name).trim()) return false;
    if(old && r.status === 'received' && old.status !== 'received' && r.kind === 'enquiry' && r.created_by && r.created_by !== me.user_id)
      db.notifications.push({id: uid(), user_id: r.created_by, kind: 'design_arrived', title: 'Arrived for ' + r.customer_name,
        body: [r.purity, r.metal.toLowerCase(), (r.category || '').toLowerCase()].filter(Boolean).join(' ') + '. Tell the customer.', link: 'designs/#d=' + r.id, created_at: nowIso, read_at: null});
    return true;
  };
  const bad = {status: 400, body: {code: '23514', message: 'Type the customer’s name.'}};
  let out = db.designs.filter(r => matches(r, params));
  if(method === 'GET') sortBy(out, params.get('order'));
  else if(method === 'POST'){
    const r = Object.assign({id: uid(), kind: 'enquiry', metal: 'Gold', category: '', purity: '', weight_g: null, size: '', qty: 1, budget: null, customer_id: null, customer_name: '', customer_phone: '', needed_by: null, supplier: '', notes: '', photos: [], status: 'open', expected: null, close_note: ''},
      Array.isArray(body) ? body[0] : body, {created_by: me.user_id, created_by_name: me.name, created_at: nowIso, updated_by_name: '', updated_at: null, ordered_at: null, received_at: null, closed_at: null});
    if(!stage(r)) return bad;
    db.designs.push(r); out = [r];
  } else if(method === 'PATCH'){
    for(const r of out){ const old = Object.assign({}, r); Object.assign(r, body, {updated_by_name: me.name, updated_at: nowIso}); if(!stage(r, old)){ Object.assign(r, old); return bad; } }
  } else if(method === 'DELETE') db.designs = db.designs.filter(r => !out.includes(r));
  if(method !== 'GET' && !wantRows) return {status: 204, body: null};
  if(single){ if(!out.length) return {status: 406, body: {code: 'PGRST116', message: 'No rows'}}; return {status: 200, body: out[0]}; }
  return {status: 200, body: out};
}
/* campaigns (migration 025): sent times and who sent are stamped here; costs fixed on the day or by the owner */
function campaignsRest(table, method, params, body, single, wantRows, me){
  const nowIso = now(), ownToday = r => r.created_by === me.user_id && new Date(r.created_at).toDateString() === new Date().toDateString();
  let out = db[table].filter(r => matches(r, params));
  if(method === 'GET') sortBy(out, params.get('order'));
  else if(method === 'POST'){
    const base = table === 'campaigns' ? {occasion: '', channels: [], offer: '', message: '', budget: null, notes: '', updated_by_name: '', updated_at: null, created_by_name: me.name}
      : table === 'campaign_contacts' ? {customer_id: null, phone: '', walk_in: false, sent_at: null, sent_by_name: '', came: false, came_on: null, bought: null, note: '', updated_by_name: '', updated_at: null}
      : {channel: '', what: '', day: iso(new Date()), created_by_name: me.name};
    out = (Array.isArray(body) ? body : [body]).map(b => { const r = Object.assign({id: uid()}, base, b, {created_by: me.user_id, created_at: nowIso});
      if(table === 'campaign_contacts'){ if(r.sent_at){ r.sent_at = nowIso; r.sent_by_name = me.name; } if(!r.came) r.came_on = null; } return r; });
    if(table === 'campaign_contacts' && out.some(r => r.customer_id && db.campaign_contacts.some(x => x.campaign_id === r.campaign_id && x.customer_id === r.customer_id))) return {status: 409, body: {code: '23505', message: 'Already on the list'}};
    db[table].push(...out);
  } else if(method === 'PATCH'){
    if(table === 'campaign_costs') out = out.filter(r => me.is_owner || ownToday(r));
    out.forEach(r => { const old = Object.assign({}, r); Object.assign(r, body);
      if(table === 'campaign_contacts'){ if(r.sent_at && !old.sent_at){ r.sent_at = nowIso; r.sent_by_name = me.name; } else if(!r.sent_at) r.sent_by_name = ''; else { r.sent_at = old.sent_at; r.sent_by_name = old.sent_by_name; } if(!r.came) r.came_on = null; }
      if(table !== 'campaign_costs'){ r.updated_by_name = me.name; r.updated_at = nowIso; } });
  } else if(method === 'DELETE'){
    out = out.filter(r => table === 'campaign_costs' ? (me.is_owner || ownToday(r)) : true);
    db[table] = db[table].filter(r => !out.includes(r));
    if(table === 'campaigns'){ db.campaign_contacts = db.campaign_contacts.filter(k => !out.some(c => c.id === k.campaign_id)); db.campaign_costs = db.campaign_costs.filter(k => !out.some(c => c.id === k.campaign_id)); }
  }
  if(method !== 'GET' && !wantRows) return {status: 204, body: null};
  if(single){ if(!out.length) return {status: 406, body: {code: 'PGRST116', message: 'No rows'}}; return {status: 200, body: out[0]}; }
  return {status: 200, body: out};
}
/* silver (migration 023): fine weight and amount always worked out from weight, touch, rate, making and GST */
function silverFigures(r){
  const r2 = n => Math.round(n * 100) / 100;
  if(r.kind === 'sale') r.from_supplier = false; else { r.making = 0; r.gst_percent = 0; }
  r.fine_g = Math.round(r.weight_g * r.touch / 100 * 1000) / 1000;
  // a sale with a final amount keeps it, and the rate per gram is worked out from it (migration 031)
  r.amount = Number(r.amount) > 0 ? (r.amount = r2(Number(r.amount)), r.rate = Math.max(r.kind === 'sale' ? r2((r.amount / (1 + r.gst_percent / 100) - Number(r.making)) / r.weight_g) : r2(r.amount / r.fine_g), 0.01), r.amount) : r.kind === 'sale' ? r2((r.weight_g * r.rate + Number(r.making)) * (1 + r.gst_percent / 100)) : r2(r.fine_g * r.rate);
  return r;
}
function silverRow(x, d){
  return silverFigures(Object.assign({id: uid(), item: '', party: '', phone: '', customer_id: null, from_supplier: false, pieces: 1, touch: 92.5, making: 0, gst_percent: 0, mode: 'Cash', account_id: null, account_name: '', bill_no: '', note: '',
    created_by: null, created_by_name: 'Sample Staff 2', created_at: d + 'T12:00:00Z', updated_by_name: '', updated_at: null}, x));
}
function silverRest(method, params, body, single, wantRows, me){
  const nowIso = now(), ownToday = r => r.created_by === me.user_id && recentDay(r.day);
  const denied = {status: 403, body: {code: '42501', message: 'new row violates row-level security policy for table "silver_entries"'}};
  let out = db.silver_entries.filter(r => matches(r, params));
  if(method === 'GET') sortBy(out, params.get('order'));
  else if(method === 'POST'){
    const r = Object.assign(silverRow(Array.isArray(body) ? body[0] : body, iso(new Date())), {created_by: me.user_id, created_by_name: me.name, created_at: nowIso});
    if(!r.day) r.day = iso(new Date());
    if(!me.is_owner && !recentDay(r.day)) return denied;
    expenseAccount(r, null); silverFigures(r); db.silver_entries.push(r); out = [r];
  } else if(method === 'PATCH'){
    out = out.filter(r => me.is_owner || ownToday(r));
    if(!me.is_owner && body.day && !recentDay(body.day)) return denied;
    out.forEach(r => { const old = Object.assign({}, r); Object.assign(r, body, {updated_by_name: me.name, updated_at: nowIso}); expenseAccount(r, old); silverFigures(r); });
  } else if(method === 'DELETE'){
    out = out.filter(r => me.is_owner || ownToday(r));
    db.silver_entries = db.silver_entries.filter(r => !out.includes(r));
  }
  if(method !== 'GET' && !wantRows) return {status: 204, body: null};
  if(single){ if(!out.length) return {status: 406, body: {code: 'PGRST116', message: 'No rows'}}; return {status: 200, body: out[0]}; }
  return {status: 200, body: out};
}
/* chit scheme (migration 019): card numbers and receipt numbers count up; staff fix only their own payment on the day */
function chitsRest(table, method, params, body, single, wantRows, me){
  const nowIso = now();
  const ownToday = r => r.created_by === me.user_id && recentDay(r.paid_on);
  const denied = {status: 403, body: {code: '42501', message: 'new row violates row-level security policy for table "' + table + '"'}};
  const fix = r => {
    if(table === 'chit_members'){ r.card_no = String(r.card_no || '').trim().toUpperCase(); r.closed_at = r.status === 'active' ? null : (r.closed_at || nowIso); }
    if(table === 'chit_payments') r.grams = r.gold_rate ? Math.round(r.amount / r.gold_rate * 1000) / 1000 : null;
    return r;
  };
  const dup = what => ({status: 409, body: {code: '23505', message: 'duplicate key value violates unique constraint "' + what + '"'}});
  let out = db[table].filter(r => matches(r, params));
  if(method === 'GET') sortBy(out, params.get('order'));
  else if(method === 'POST'){
    const b = Array.isArray(body) ? body[0] : body;
    const base = table === 'chit_plans' ? {saves: 'money', instalment: null, bonus_kind: 'none', bonus_value: 0, benefit: '', active: true, created_at: nowIso}
      : table === 'chit_members' ? {customer_id: null, phone: '', status: 'active', closed_at: null, close_note: '', notes: '', card_no: ''}
      : {paid_on: iso(new Date()), mode: 'Cash', gold_rate: null, note: ''};
    const r = Object.assign({id: uid()}, base, b);
    if(table === 'chit_payments' && !me.is_owner && !recentDay(r.paid_on)) return denied;
    if(table !== 'chit_plans') Object.assign(r, {created_by: me.user_id, created_by_name: me.name, created_at: nowIso, updated_by_name: '', updated_at: null});
    if(table === 'chit_members' && !String(r.card_no).trim()) r.card_no = String(db.chitSeq.card++);
    if(table === 'chit_payments') r.receipt_no = db.chitSeq.receipt++;
    fix(r);
    if(table === 'chit_plans' && db.chit_plans.some(x => x.name === r.name)) return dup('chit_plans_name_key');
    if(table === 'chit_members' && db.chit_members.some(x => x.card_no === r.card_no)) return dup('chit_members_card_no_key');
    db[table].push(r); out = [r];
  } else if(method === 'PATCH'){
    if(table === 'chit_payments') out = out.filter(r => me.is_owner || ownToday(r));
    if(table === 'chit_payments' && !me.is_owner && body.paid_on && !recentDay(body.paid_on)) return denied;
    out.forEach(r => { Object.assign(r, body); if(table !== 'chit_plans') Object.assign(r, {updated_by_name: me.name, updated_at: nowIso}); fix(r); });
  } else if(method === 'DELETE'){
    out = out.filter(r => me.is_owner || (table === 'chit_payments' && ownToday(r)));
    db[table] = db[table].filter(r => !out.includes(r));
    if(table === 'chit_members') db.chit_payments = db.chit_payments.filter(p => !out.some(m => m.id === p.member_id));
  }
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
      const [name, aal] = String(body.refresh_token || '').replace(/^demo-/, '').split('~');
      res = db.users[name] ? {status: 200, body: session(name, aal)} : {status: 400, body: {error_code: 'refresh_token_not_found', message: 'Invalid Refresh Token'}};
    } else {
      const name = String(body.email || '').split('@')[0], user = db.users[name];
      res = user && 'natraj-' + user.pin === body.password ? {status: 200, body: session(name)}
        : {status: 400, body: {code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials', message: 'Invalid login credentials'}};
    }
  } else if(p === '/auth/v1/user'){
    res = me ? {status: 200, body: session(me.username, db.tokenAal[token]).user} : {status: 401, body: {message: 'invalid JWT'}};
  } else if(p === '/auth/v1/logout'){
    delete db.tokens[token]; res = {status: 204, body: null};
  } else if(p.startsWith('/auth/v1/factors')) res = factors(method, p, body || {}, token);
  else if(p === '/functions/v1/people') res = people(body || {}, me, headers);
  else if(p.startsWith('/storage/v1/')) res = storage(method, p, body, me);
  else if(p.startsWith('/rest/v1/rpc/')) res = rpc(p.split('/').pop(), body || {}, me, headers);
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
