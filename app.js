// Vivaah Planner: all data is kept in the browser with localStorage.
function get(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch (e) { return d; } }
function put(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function $(id) { return document.getElementById(id); }
function nextId(list) { var m = 0; list.forEach(function (x) { if (x.id > m) m = x.id; }); return m + 1; }

var users = get('vp_users', null);
var recs = get('vp_recs', []); // {id, uid, type, ...fields}
if (!users) users = [{ id: 1, name: 'Administrator', email: 'admin@vivaah.local', pass: 'admin123', role: 'admin', status: 'active', p1: '', p2: '', date: '', city: '', budget: 0 }];
function saveAll() { put('vp_users', users); put('vp_recs', recs); }
saveAll();

// Each record type is described once; forms, tables, search and validation are built from this.
var TYPES = {
  guests: { title: 'Guests', one: 'guest', fields: [
    { k: 'name', l: 'Name', t: 'text', req: 1 },
    { k: 'side', l: 'Side', t: 'select', o: ['Bride', 'Groom', 'Both'] },
    { k: 'count', l: 'People attending', t: 'number', min: 1, def: 1 },
    { k: 'phone', l: 'Phone', t: 'tel' },
    { k: 'status', l: 'RSVP', t: 'select', o: ['Pending', 'Accepted', 'Declined'], st: 1 }] },
  tasks: { title: 'Tasks', one: 'task', fields: [
    { k: 'title', l: 'Task', t: 'text', req: 1 },
    { k: 'category', l: 'Category', t: 'select', o: ['Venue', 'Food', 'Attire', 'Decor', 'Paperwork', 'Other'] },
    { k: 'due', l: 'Due date', t: 'date' },
    { k: 'status', l: 'Status', t: 'select', o: ['To do', 'In progress', 'Done'], st: 1 }] },
  vendors: { title: 'Vendors', one: 'vendor', fields: [
    { k: 'name', l: 'Vendor name', t: 'text', req: 1 },
    { k: 'category', l: 'Service', t: 'select', o: ['Venue', 'Caterer', 'Photographer', 'Decorator', 'Music', 'Makeup', 'Other'] },
    { k: 'phone', l: 'Phone', t: 'tel' },
    { k: 'cost', l: 'Cost', t: 'number', min: 0, def: 0 },
    { k: 'status', l: 'Status', t: 'select', o: ['Enquired', 'Booked', 'Paid'], st: 1 }] }
};
var editing = 0;

function me() { var id = get('vp_session', 0); for (var i = 0; i < users.length; i++) if (users[i].id === id) return users[i]; return null; }
function mine(type) { var u = me(); return recs.filter(function (r) { return r.uid === u.id && r.type === type; }); }
function errBox(list) { return list.length ? '<div class="msg" role="alert">' + list.map(esc).join('<br>') + '</div>' : ''; }
function okBox(t) { return t ? '<div class="msg good">' + esc(t) + '</div>' : ''; }

function renderNav(r) {
  var u = me(), L = [];
  if (u) {
    L = [['#/dashboard', 'Dashboard'], ['#/guests', 'Guests'], ['#/tasks', 'Tasks'], ['#/vendors', 'Vendors'], ['#/profile', 'Profile']];
    if (u.role === 'admin') L.push(['#/admin', 'Admin']);
    L.push(['#/logout', 'Log out']);
  } else L = [['#/login', 'Log in'], ['#/register', 'Register']];
  $('nav').innerHTML = L.map(function (l) { return '<a href="' + l[0] + '"' + (r === l[0].slice(1) ? ' class="on"' : '') + '>' + l[1] + '</a>'; }).join('');
}

function route() {
  var r = location.hash.slice(1) || '/', u = me(), v = $('view');
  if (r === '/logout') { put('vp_session', 0); location.hash = '#/'; return; }
  var open = ['/', '/login', '/register'];
  if (!u && open.indexOf(r) < 0) { location.hash = '#/login'; return; }
  if (r === '/admin' && u.role !== 'admin') { location.hash = '#/dashboard'; return; }
  if (r === '/') v.innerHTML = homeView();
  else if (r === '/login') v.innerHTML = loginView([]);
  else if (r === '/register') v.innerHTML = registerView([]);
  else if (r === '/dashboard') v.innerHTML = dashView();
  else if (TYPES[r.slice(1)]) { v.innerHTML = listView(r.slice(1)); showRows(r.slice(1)); }
  else if (r === '/profile') v.innerHTML = profileView([], '');
  else if (r === '/admin') v.innerHTML = adminView('');
  else v.innerHTML = '<h1>Page not found</h1><p><a href="#/">Go to the home page</a></p>';
  renderNav(r);
  window.scrollTo(0, 0);
}
window.onhashchange = function () { editing = 0; route(); };

function homeView() {
  var u = me();
  return '<div class="hero"><h1>Keep your guest list, tasks and vendors in one place</h1><p>Record who is invited and who has replied, tick off planning tasks, note vendor quotes and bookings, and see how your budget stands.</p>' +
    (u ? '<a class="btn" href="#/dashboard">Open dashboard</a>' : '<a class="btn" href="#/register">Create an account</a> <a class="btn alt" href="#/login">Log in</a>') + '</div>' +
    '<div class="grid"><div class="card"><h3>Guests</h3><p class="mute">Track RSVP replies and the total head count.</p></div><div class="card"><h3>Tasks</h3><p class="mute">Set due dates and move tasks from to do to done.</p></div><div class="card"><h3>Vendors</h3><p class="mute">Store contacts and costs, and mark vendors booked or paid.</p></div></div>';
}

function loginView(e) {
  return '<h1>Log in</h1>' + errBox(e) + '<form class="box" onsubmit="doLogin(event)"><label for="em">Email</label><input id="em" type="email" required><label for="pw">Password</label><input id="pw" type="password" required><button>Log in</button></form><p>New here? <a href="#/register">Register</a>.</p>';
}
function doLogin(ev) {
  ev.preventDefault();
  var em = $('em').value.trim().toLowerCase(), pw = $('pw').value;
  for (var i = 0; i < users.length; i++) if (users[i].email === em && users[i].pass === pw) {
    if (users[i].status === 'suspended') { $('view').innerHTML = loginView(['This account is suspended. Contact the site admin.']); return; }
    put('vp_session', users[i].id); location.hash = '#/dashboard'; route(); return;
  }
  $('view').innerHTML = loginView(['Email or password is incorrect.']);
}

function registerView(e) {
  return '<h1>Register</h1>' + errBox(e) + '<form class="box" onsubmit="doRegister(event)"><label for="nm">Your name</label><input id="nm" required><label for="em">Email</label><input id="em" type="email" required><label for="pw">Password (at least 6 characters)</label><input id="pw" type="password" required><label><input type="checkbox" id="ag" required> I accept the <a href="terms.html">terms</a> and <a href="privacy.html">privacy policy</a></label><button>Create account</button></form>';
}
function doRegister(ev) {
  ev.preventDefault();
  var em = $('em').value.trim().toLowerCase(), pw = $('pw').value, errs = [];
  if (pw.length < 6) errs.push('Password must have at least 6 characters.');
  users.forEach(function (u) { if (u.email === em) errs.push('That email is already registered.'); });
  if (errs.length) { $('view').innerHTML = registerView(errs); return; }
  var u = { id: nextId(users), name: $('nm').value.trim(), email: em, pass: pw, role: 'couple', status: 'active', p1: '', p2: '', date: '', city: '', budget: 0 };
  users.push(u); saveAll(); put('vp_session', u.id); location.hash = '#/profile'; route();
}

function inputHtml(f, v) {
  var id = 'f_' + f.k;
  if (f.t === 'select') return '<select id="' + id + '">' + f.o.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>';
  return '<input id="' + id + '" type="' + f.t + '" value="' + esc(v) + '"' + (f.t === 'number' ? ' min="' + f.min + '"' : '') + '>';
}

function listView(type) {
  var T = TYPES[type], r = null;
  recs.forEach(function (x) { if (x.id === editing) r = x; });
  var h = '<h1>' + T.title + '</h1><h2>' + (r ? 'Edit ' : 'Add a ') + T.one + '</h2><div id="err"></div><form class="box" onsubmit="saveRec(event,\'' + type + '\')">';
  T.fields.forEach(function (f) {
    var v = r ? r[f.k] : (f.def !== undefined ? f.def : (f.t === 'select' ? f.o[0] : ''));
    h += '<label for="f_' + f.k + '">' + f.l + '</label>' + inputHtml(f, v);
  });
  h += '<button>' + (r ? 'Save changes' : 'Add ' + T.one) + '</button>' + (r ? ' <button type="button" class="alt" onclick="editRec(0)">Cancel</button>' : '') + '</form>';
  var st = T.fields.filter(function (f) { return f.st; })[0];
  h += '<h2>Your ' + T.title.toLowerCase() + '</h2><div class="row"><div><label for="q">Search</label><input id="q" type="search" oninput="showRows(\'' + type + '\')"></div><div><label for="sf">Filter by status</label><select id="sf" onchange="showRows(\'' + type + '\')"><option value="">All</option>' + st.o.map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select></div></div>';
  h += '<p class="mute" id="cnt"></p><div class="scroll"><table><thead><tr>' + T.fields.map(function (f) { return '<th>' + f.l + '</th>'; }).join('') + '<th>Actions</th></tr></thead><tbody id="rows"></tbody></table></div>';
  return h;
}
function showRows(type) {
  var T = TYPES[type], q = $('q').value.toLowerCase(), sf = $('sf').value;
  var list = mine(type).filter(function (r) {
    var text = T.fields.map(function (f) { return r[f.k]; }).join(' ').toLowerCase();
    return (!sf || r.status === sf) && text.indexOf(q) > -1;
  });
  $('cnt').textContent = list.length + ' of ' + mine(type).length + ' shown';
  $('rows').innerHTML = list.length ? list.map(function (r) {
    return '<tr>' + T.fields.map(function (f) {
      if (f.st) return '<td><select aria-label="Status" onchange="setStatus(' + r.id + ',this.value)">' + f.o.map(function (o) { return '<option' + (o === r.status ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></td>';
      return '<td>' + esc(r[f.k]) + '</td>';
    }).join('') + '<td><button class="alt sm" onclick="editRec(' + r.id + ')">Edit</button> <button class="del sm" onclick="delRec(' + r.id + ')">Delete</button></td></tr>';
  }).join('') : '<tr><td colspan="' + (T.fields.length + 1) + '">Nothing to show. Add a record above.</td></tr>';
}
function saveRec(ev, type) {
  ev.preventDefault();
  var T = TYPES[type], vals = {}, errs = [];
  T.fields.forEach(function (f) {
    var v = $('f_' + f.k).value.trim();
    if (f.req && !v) errs.push(f.l + ' is required.');
    if (f.t === 'number') {
      if (v === '' || isNaN(v) || +v < f.min) errs.push(f.l + ' must be a number, at least ' + f.min + '.'); else v = +v;
    }
    if (f.t === 'tel' && v && !/^[0-9+ \-]{7,15}$/.test(v)) errs.push('Enter a valid phone number (7 to 15 digits).');
    vals[f.k] = v;
  });
  if (errs.length) { $('err').innerHTML = errBox(errs); return; }
  if (editing) { recs.forEach(function (r) { if (r.id === editing) for (var k in vals) r[k] = vals[k]; }); }
  else { vals.id = nextId(recs); vals.uid = me().id; vals.type = type; recs.push(vals); }
  editing = 0; saveAll(); route();
}
function editRec(id) { editing = id; route(); window.scrollTo(0, 0); }
function delRec(id) {
  if (!confirm('Delete this record?')) return;
  recs = recs.filter(function (r) { return r.id !== id; }); saveAll(); route();
}
function setStatus(id, v) { recs.forEach(function (r) { if (r.id === id) r.status = v; }); saveAll(); }

function countBy(list, val) { return list.filter(function (r) { return r.status === val; }).length; }
function bar(p, over) { return '<div class="prog' + (over ? ' over' : '') + '"><span style="width:' + Math.min(p, 100) + '%"></span></div>'; }
function dashView() {
  var u = me(), g = mine('guests'), t = mine('tasks'), v = mine('vendors');
  var head = 0; g.forEach(function (x) { if (x.status === 'Accepted') head += x.count; });
  var spent = 0, paid = 0;
  v.forEach(function (x) { if (x.status !== 'Enquired') spent += x.cost; if (x.status === 'Paid') paid += x.cost; });
  var days = '';
  if (u.date) { var d = Math.ceil((new Date(u.date + 'T00:00:00') - new Date().setHours(0, 0, 0, 0)) / 864e5); days = d > 0 ? d + ' days to go' : (d === 0 ? 'The wedding is today' : 'Wedding date has passed'); }
  var done = countBy(t, 'Done'), tp = t.length ? Math.round(done / t.length * 100) : 0;
  var bp = u.budget > 0 ? Math.round(spent / u.budget * 100) : 0;
  var h = '<h1>' + (u.p1 && u.p2 ? esc(u.p1) + ' and ' + esc(u.p2) : 'Dashboard') + '</h1><p class="mute">' + (days ? days + (u.city ? ' in ' + esc(u.city) : '') : 'Add your wedding date in <a href="#/profile">your profile</a> to see the countdown.') + '</p>';
  h += '<div class="grid"><div class="card"><span class="mute">Guests invited</span><b>' + g.length + '</b></div><div class="card"><span class="mute">Head count confirmed</span><b>' + head + '</b></div><div class="card"><span class="mute">Replies pending</span><b>' + countBy(g, 'Pending') + '</b></div><div class="card"><span class="mute">Declined</span><b>' + countBy(g, 'Declined') + '</b></div></div>';
  h += '<h2>Tasks</h2><div class="card">' + done + ' of ' + t.length + ' done (' + tp + '%)' + bar(tp) + '</div>';
  h += '<h2>Budget</h2><div class="card">' + (u.budget > 0 ? 'Booked or paid: ' + spent + ' of ' + u.budget + ' (' + bp + '%)' + bar(bp, spent > u.budget) + 'Paid so far: ' + paid + '. Remaining: ' + (u.budget - spent) + (spent > u.budget ? '. You are over budget.' : '.') : 'Set your total budget in <a href="#/profile">your profile</a>.') + '<br>Vendors booked or paid: ' + (v.length - countBy(v, 'Enquired')) + ' of ' + v.length + '</div>';
  var up = t.filter(function (x) { return x.status !== 'Done' && x.due; }).sort(function (a, b) { return a.due < b.due ? -1 : 1; }).slice(0, 5);
  h += '<h2>Next tasks due</h2>' + (up.length ? '<div class="scroll"><table><tr><th>Task</th><th>Due</th><th>Status</th></tr>' + up.map(function (x) { return '<tr><td>' + esc(x.title) + '</td><td>' + esc(x.due) + '</td><td>' + x.status + '</td></tr>'; }).join('') + '</table></div>' : '<p class="mute">No open tasks with a due date.</p>');
  return h;
}

function profileView(e, m) {
  var u = me();
  return '<h1>Profile</h1>' + errBox(e) + okBox(m) + '<p class="mute">' + esc(u.email) + ' | Role: ' + u.role + '</p><form class="box" onsubmit="saveProfile(event)"><label for="nm">Your name</label><input id="nm" value="' + esc(u.name) + '" required><label for="p1">Partner 1 name</label><input id="p1" value="' + esc(u.p1) + '"><label for="p2">Partner 2 name</label><input id="p2" value="' + esc(u.p2) + '"><label for="dt">Wedding date</label><input id="dt" type="date" value="' + esc(u.date) + '"><label for="ct">City</label><input id="ct" value="' + esc(u.city) + '"><label for="bg">Total budget</label><input id="bg" type="number" min="0" value="' + u.budget + '"><label for="pw">New password (leave empty to keep the current one)</label><input id="pw" type="password"><button>Save profile</button></form>';
}
function saveProfile(ev) {
  ev.preventDefault();
  var u = me(), errs = [], dt = $('dt').value, bg = $('bg').value, pw = $('pw').value;
  if (dt && new Date(dt + 'T00:00:00') < new Date().setHours(0, 0, 0, 0)) errs.push('Wedding date cannot be in the past.');
  if (bg === '' || isNaN(bg) || +bg < 0) errs.push('Budget must be a number, 0 or more.');
  if (pw && pw.length < 6) errs.push('New password must have at least 6 characters.');
  if (errs.length) { $('view').innerHTML = profileView(errs, ''); return; }
  u.name = $('nm').value.trim(); u.p1 = $('p1').value.trim(); u.p2 = $('p2').value.trim();
  u.date = dt; u.city = $('ct').value.trim(); u.budget = +bg; if (pw) u.pass = pw;
  saveAll(); $('view').innerHTML = profileView([], 'Profile saved.');
}

function adminView(m) {
  function n(t) { return recs.filter(function (r) { return r.type === t; }).length; }
  var h = '<h1>Admin</h1>' + okBox(m);
  h += '<h2>Site report</h2><div class="grid"><div class="card"><span class="mute">Accounts</span><b>' + users.length + '</b></div><div class="card"><span class="mute">Guest records</span><b>' + n('guests') + '</b></div><div class="card"><span class="mute">Task records</span><b>' + n('tasks') + '</b></div><div class="card"><span class="mute">Vendor records</span><b>' + n('vendors') + '</b></div></div>';
  h += '<h2>Accounts</h2><div class="scroll"><table><tr><th>Name</th><th>Email</th><th>Wedding date</th><th>Records</th><th>Status</th><th>Actions</th></tr>' + users.map(function (x) {
    var c = recs.filter(function (r) { return r.uid === x.id; }).length;
    return '<tr><td>' + esc(x.name) + '</td><td>' + esc(x.email) + '</td><td>' + esc(x.date || 'Not set') + '</td><td>' + c + '</td><td>' + x.status + '</td><td>' + (x.role === 'admin' ? '' : '<button class="alt sm" onclick="toggleUser(' + x.id + ')">' + (x.status === 'active' ? 'Suspend' : 'Activate') + '</button> <button class="del sm" onclick="delUser(' + x.id + ')">Remove</button>') + '</td></tr>';
  }).join('') + '</table></div>';
  return h;
}
function toggleUser(id) { users.forEach(function (u) { if (u.id === id) u.status = u.status === 'active' ? 'suspended' : 'active'; }); saveAll(); $('view').innerHTML = adminView('Account status updated.'); }
function delUser(id) {
  if (!confirm('Remove this account and all of its records?')) return;
  users = users.filter(function (u) { return u.id !== id; });
  recs = recs.filter(function (r) { return r.uid !== id; });
  saveAll(); $('view').innerHTML = adminView('Account removed.');
}

route();
