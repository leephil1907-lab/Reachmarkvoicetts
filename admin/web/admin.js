// Reachmark Admin — control-room SPA. Vanilla JS, hash router, CSRF on every POST,
// SSE live inbox with sound + badge + polling fallback. All text escaped on render.
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = t => t ? new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtAgo = t => { if (!t) return 'never'; const s = (Date.now() - t) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago'; };

let ME = null, CSRF = '', ES = null, pollTimer = null, unread = 0, activeThread = null, threadMsgs = [];

function toast(msg, err) {
  const d = document.createElement('div');
  d.className = 'toast' + (err ? ' err' : '');
  d.textContent = msg;
  $('#toasts').appendChild(d);
  setTimeout(() => { d.style.opacity = '0'; d.style.transition = 'opacity .3s'; setTimeout(() => d.remove(), 320); }, 3800);
}
async function api(path, body, limit) {
  const opts = body !== undefined
    ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF }, body: JSON.stringify(body) }
    : {};
  const r = await fetch(path, opts);
  let j = null;
  try { j = await r.json(); } catch {}
  if (!r.ok) throw Object.assign(new Error((j && j.error) || ('HTTP ' + r.status)), { status: r.status });
  return j;
}
function beep() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; const c = new AC();
    const o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.frequency.value = 880; g.gain.value = 0.06;
    o.start(); o.frequency.exponentialRampToValueAtTime(1320, c.currentTime + 0.09);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.25);
    o.stop(c.currentTime + 0.26);
  } catch {}
}
function setUnread(n) {
  unread = n;
  const b = $('#nav-unread');
  b.textContent = n; b.classList.toggle('hidden', !n);
  document.title = n ? `(${n}) Reachmark Admin` : 'Reachmark Admin — Control Room';
}

/* ---------------- gate: login + mandatory 2FA ---------------- */
let gateToken = null;
function gateErr(m) { const e = $('#gate-err'); e.textContent = m; e.classList.toggle('hidden', !m); }
function showGate() { $('#gate').classList.remove('hidden'); $('#app').classList.add('hidden'); }
function showApp() { $('#gate').classList.add('hidden'); $('#app').classList.remove('hidden'); }

$('#g-login').onclick = async () => {
  gateErr('');
  try {
    const j = await api('/api/login', { email: $('#g-email').value, password: $('#g-pass').value });
    gateToken = j.token;
    $('#gate-step-login').classList.add('hidden');
    $('#gate-step-2fa').classList.remove('hidden');
    if (j.enroll) {
      $('#g-enroll').classList.remove('hidden');
      $('#g-secret').textContent = j.secret;
      $('#g-otpauth').textContent = 'Or paste this URI into your app: ' + j.otpauth;
      $('#g-2fa-help').textContent = 'Then enter the 6-digit code it shows to finish enrollment.';
    }
    $('#g-code').focus();
  } catch (e) { gateErr(e.message); }
};
$('#g-back').onclick = () => { $('#gate-step-2fa').classList.add('hidden'); $('#gate-step-login').classList.remove('hidden'); $('#g-enroll').classList.add('hidden'); gateErr(''); };
$('#g-verify').onclick = async () => {
  gateErr('');
  try {
    const j = await api('/api/login/2fa', { token: gateToken, code: $('#g-code').value.trim() });
    ME = j.user; CSRF = j.csrf;
    enterApp();
  } catch (e) { gateErr(e.message); }
};
$('#g-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('#g-verify').click(); });
$('#g-pass').addEventListener('keydown', e => { if (e.key === 'Enter') $('#g-login').click(); });
$('#logout').onclick = async () => { try { await api('/api/logout', {}); } catch {} ME = null; stopLive(); showGate(); $('#gate-step-2fa').classList.add('hidden'); $('#gate-step-login').classList.remove('hidden'); };

async function boot() {
  try {
    const j = await api('/api/me');
    ME = j.user; CSRF = j.csrf;
    enterApp();
  } catch { showGate(); $('#g-email').focus(); }
}
function enterApp() {
  showApp();
  $('#who').innerHTML = '<b>' + esc(ME.name) + '</b>' + esc(ME.email) + ' · <span class="pill ' + esc(ME.role) + '">' + esc(ME.role) + '</span>';
  startLive();
  if (!location.hash || location.hash === '#/') location.hash = '#/dashboard';
  route();
}

/* ---------------- live SSE (+ polling fallback) ---------------- */
function startLive() {
  stopLive();
  try {
    ES = new EventSource('/api/support/stream');
    ES.onopen = () => $('#live-dot').className = 'led on';
    ES.onerror = () => { $('#live-dot').className = 'led off'; ES.close(); ES = null; startPolling(); };
    ES.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if (activeThread && m.threadId === activeThread) { pushMsg(m); renderConv(); api('/api/support/thread?id=' + encodeURIComponent(activeThread)).catch(() => {}); }
      else { beep(); setUnread(unread + 1); if (location.hash === '#/inbox') loadThreads(); }
    });
    ES.addEventListener('unread', ev => { const j = JSON.parse(ev.data); if (j.unread != null) setUnread(j.unread); });
    ES.addEventListener('typing', ev => {
      const j = JSON.parse(ev.data);
      if (activeThread === j.threadId) { $('#typing-line') && ($('#typing-line').textContent = 'user is typing…'); clearTimeout(window._tt); window._tt = setTimeout(() => { const t = $('#typing-line'); if (t) t.textContent = ''; }, 4000); }
    });
  } catch { startPolling(); }
}
function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    try { const j = await api('/api/support/threads'); setUnread(j.unread || 0); if (location.hash === '#/inbox') loadThreads(); $('#live-dot').className = 'led on'; }
    catch { $('#live-dot').className = 'led off'; }
  }, 5000);
}
function stopLive() { if (ES) { ES.close(); ES = null; } if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

/* ---------------- router ---------------- */
const PAGES = { dashboard: 'Dashboard', users: 'Users', inbox: 'Support inbox', studio: 'Studio workspace', site: 'Site control', docs: 'Agents & voices', audit: 'Audit log', admins: 'Admins' };
window.addEventListener('hashchange', route);
function route() {
  const page = (location.hash.replace('#/', '') || 'dashboard').split('?')[0];
  const fn = VIEWS[page] || VIEWS.dashboard;
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.p === page));
  $('#crumb').textContent = PAGES[page] || 'Dashboard';
  closeDrawer();
  fn($('#view'));
}

/* ---------------- views ---------------- */
const VIEWS = {};

VIEWS.dashboard = async el => {
  el.innerHTML = '<p class="dim">Loading telemetry…</p>';
  const s = await api('/api/stats');
  const maxSign = Math.max(1, ...s.signups.map(x => x.n));
  el.innerHTML = `
  <div class="grid g4">
    <div class="panel"><h3>Users</h3><div class="stat">${s.users.total}<small>${s.users.plus} plus · ${s.users.suspended} suspended · ${s.users.admins} staff</small></div></div>
    <div class="panel"><h3>Renders</h3><div class="stat">${s.renders}<small>${s.minutes} min of audio processed</small></div></div>
    <div class="panel"><h3>Credits (all time)</h3><div class="stat">${s.credits.issued.toLocaleString()}<small>issued · ${s.credits.spent.toLocaleString()} spent · ${s.credits.onHand.toLocaleString()} on hand</small></div></div>
    <div class="panel"><h3>Last 24 h</h3><div class="stat">+${s.credits.issued24h.toLocaleString()}<small>issued · ${s.credits.spent24h.toLocaleString()} spent</small></div></div>
  </div>
  <div class="grid g2" style="margin-top:14px">
    <div class="panel"><h3>Signups / day (7d)</h3><div class="bars">${s.signups.map(x => `<div class="b" style="height:${Math.round(x.n / maxSign * 100)}%"><span>${esc(x.day)}</span></div>`).join('')}</div><div style="height:18px"></div></div>
    <div class="panel"><h3>Engine health</h3>
      <div class="kv">
        <b>Piper TTS</b><span>${s.piper.ready ? '<span class="led on"></span> ready' : '<span class="led off"></span> not loaded'} · ${s.piper.voices ?? 0} voices${s.piper.queue != null ? ' · queue ' + s.piper.queue : ''}</span>
        <b>LLM brain</b><span>${s.llm.configured ? '<span class="led on"></span> ' + esc(s.llm.model) : '<span class="led off"></span> not configured — agents use local persona fallback'}</span>
        <b>Disk</b><span>${s.disk ? s.disk.freeGB + ' GB free / ' + s.disk.totalGB + ' GB' : 'n/a'}</span>
        <b>Support</b><span>${s.supportUnread} unread · ${s.threadsOpen} open threads</span>
      </div>
      ${s.engines ? `<h3 style="margin-top:14px">GPU engines (standby)</h3><div class="tiny dim">${esc(JSON.stringify(s.engines).slice(0, 300))}</div>` : ''}
    </div>
  </div>`;
};

/* ---- users ---- */
let userSort = { k: 'created', dir: -1 }, userQ = '';
VIEWS.users = async el => {
  el.innerHTML = `
  <div class="toolbar">
    <input id="uq" placeholder="Search name or email…" value="${esc(userQ)}">
    <span class="dim tiny" id="ucount"></span>
    <div class="spacer"></div>
  </div>
  <div class="panel" style="padding:6px"><table id="utable"></table></div>`;
  const draw = async () => {
    const j = await api('/api/users?q=' + encodeURIComponent(userQ));
    const cols = [['name', 'Name'], ['email', 'Email'], ['plan', 'Plan'], ['credits', 'Credits'], ['minutes', 'Minutes'], ['created', 'Signup'], ['last_seen', 'Last seen'], ['status', 'Status']];
    const rows = j.users.slice().sort((a, b) => { const x = a[userSort.k] ?? '', y = b[userSort.k] ?? ''; return (x < y ? -1 : x > y ? 1 : 0) * userSort.dir; });
    $('#ucount').textContent = rows.length + ' accounts';
    $('#utable').innerHTML = `<tr>${cols.map(c => `<th data-k="${c[0]}">${c[1]}${userSort.k === c[0] ? (userSort.dir > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('')}<th></th></tr>` +
      rows.map(r => `<tr data-id="${esc(r.id)}">
        <td><b>${esc(r.name)}</b></td><td class="mono tiny">${esc(r.email)}</td>
        <td><span class="pill ${esc(r.plan)}">${esc(r.plan)}</span></td>
        <td class="mono">${r.credits.toLocaleString()}</td><td class="mono">${r.minutes}</td>
        <td class="tiny">${fmtDate(r.created)}</td><td class="tiny">${fmtAgo(r.last_seen)}</td>
        <td><span class="pill ${esc(r.status)}">${esc(r.status)}</span></td>
        <td><button class="btn sm" data-open="${esc(r.id)}">Open</button></td></tr>`).join('');
    $('#utable').querySelectorAll('th[data-k]').forEach(th => th.onclick = () => { const k = th.dataset.k; userSort = { k, dir: userSort.k === k ? -userSort.dir : 1 }; draw(); });
    $('#utable').querySelectorAll('[data-open]').forEach(b => b.onclick = () => openUser(b.dataset.open));
    $('#utable').querySelectorAll('tr[data-id]').forEach(tr => tr.ondblclick = () => openUser(tr.dataset.id));
  };
  $('#uq').oninput = e => { userQ = e.target.value; clearTimeout(window._uq); window._uq = setTimeout(draw, 250); };
  draw();
};

async function openUser(id) {
  const j = await api('/api/user?id=' + encodeURIComponent(id));
  const u = j.user;
  openDrawer(`
    <h2>${esc(u.name)}</h2><p class="dim mono tiny">${esc(u.email)}</p>
    <div class="sec kv">
      <b>Plan</b><span class="pill ${esc(u.plan)}">${esc(u.plan)}</span>${u.trial_ends ? ' <span class="tiny dim">trial → ' + fmtDate(u.trial_ends) + '</span>' : ''}
      <b>Credits</b><span class="mono">${u.credits.toLocaleString()}</span>
      <b>Minutes</b><span class="mono">${u.minutes}</span>
      <b>Status</b><span class="pill ${u.suspended ? 'suspended' : 'active'}">${u.suspended ? 'suspended' : 'active'}</span>
      <b>Role</b><span class="pill ${esc(u.role)}">${esc(u.role)}</span>
      <b>Signup</b><span>${fmtDate(u.created)}</span>
      <b>Last seen</b><span>${fmtAgo(u.last_seen)}</span>
      <b>Sessions</b><span>${j.sessions} active</span>
    </div>
    <div class="sec"><h3 class="dim mono tiny">VOICES (${j.voices.length})</h3>
      ${j.voices.map(v => `<div class="flag-row"><span>${esc(v.name)} <span class="tiny dim">${esc(v.kind || '')} ${v.disabled ? '· DISABLED' : ''}</span></span>
        <span><button class="btn sm" data-sample-voice="${esc(u.id)}|${esc(v.id)}">Access &amp; listen</button></span></div>`).join('') || '<p class="dim tiny">None</p>'}
    </div>
    <div class="sec"><h3 class="dim mono tiny">AGENTS (${j.agents.length})</h3>
      ${j.agents.map(a => `<div class="flag-row"><span>${esc(a.name)} <span class="tiny dim">${esc(a.role || '')}${a.disabled ? ' · DISABLED' : ''}</span></span></div>`).join('') || '<p class="dim tiny">None</p>'}
    </div>
    <div class="sec"><h3 class="dim mono tiny">RENDERS (${j.renders.length}) — listening is audit-logged</h3>
      <div id="d-samples"></div>
      ${j.renders.slice(0, 12).map(r => `<div class="flag-row"><span class="mono tiny">${esc(r.file)}</span><button class="btn sm" data-sample="${esc(r.file)}">Access &amp; listen</button></div>`).join('') || '<p class="dim tiny">None</p>'}
    </div>
    <div class="sec"><h3 class="dim mono tiny">RECENT ACTIVITY</h3>
      ${j.history.slice(0, 10).map(h => `<div class="tiny dim">${fmtDate(h.at)} · ${esc(h.tool || h.kind || '')} ${esc((h.title || h.text || '').slice(0, 60))}</div>`).join('') || '<p class="dim tiny">None</p>'}
    </div>
    <div class="sec"><h3 class="dim mono tiny">CREDIT LEDGER</h3>
      ${j.ledger.slice(0, 10).map(l => `<div class="tiny mono" style="color:${l.delta >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtDate(l.at)} · ${l.delta >= 0 ? '+' : ''}${l.delta} · ${esc(l.kind)}</div>`).join('') || '<p class="dim tiny">None</p>'}
    </div>
    <div class="sec panel" style="background:var(--panel2)">
      <h3>Actions (all audit-logged)</h3>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <input id="a-delta" type="number" placeholder="± credits" style="width:120px">
        <input id="a-reason" placeholder="Reason (required)" style="flex:1">
        <button class="btn sm warn" id="a-adjust">Adjust</button>
      </div>
      <div class="row-actions">
        <select id="a-plan" style="width:auto"><option value="free"${u.plan === 'free' ? ' selected' : ''}>free</option><option value="plus"${u.plan === 'plus' ? ' selected' : ''}>plus</option></select>
        <button class="btn sm" id="a-planbtn">Set plan</button>
        <button class="btn sm ok" id="a-trial">${u.plan === 'plus' && u.trial_ends ? 'End trial' : 'Grant 7d trial'}</button>
        <button class="btn sm ${u.suspended ? 'ok' : 'danger'}" id="a-susp">${u.suspended ? 'Unsuspend' : 'Suspend'}</button>
        <button class="btn sm warn" id="a-flogout">Force logout</button>
        <button class="btn sm danger" id="a-del">Delete account…</button>
      </div>
      <p class="note">Password hashes and session tokens are never exposed here.</p>
    </div>`);
  // wire actions
  const listen = (src, label) => {
    const box = $('#d-samples');
    box.innerHTML = `<div class="tiny dim">Accessed: ${esc(label)} — logged to audit.</div><audio controls autoplay src="${esc(src)}"></audio>`;
  };
  drawerEl().querySelectorAll('[data-sample]').forEach(b => b.onclick = () => {
    if (!confirm('Listen to this user render? This access is written to the audit log.')) return;
    listen('/api/sample?file=' + encodeURIComponent(b.dataset.sample) + '&ack=1', b.dataset.sample);
  });
  drawerEl().querySelectorAll('[data-sample-voice]').forEach(b => b.onclick = () => {
    if (!confirm('Listen to this user\'s voice sample? This access is written to the audit log.')) return;
    const [uid, vid] = b.dataset.sampleVoice.split('|');
    listen('/api/voicesample?uid=' + encodeURIComponent(uid) + '&id=' + encodeURIComponent(vid) + '&ack=1', 'voice ' + vid);
  });
  $('#a-adjust').onclick = async () => {
    const delta = parseInt($('#a-delta').value, 10), reason = $('#a-reason').value.trim();
    if (!delta) return toast('Enter a non-zero credit delta.', true);
    if (!reason) return toast('A reason is required for credit changes.', true);
    try { const j2 = await api('/api/user/credits', { id: u.id, delta, reason }); toast('Credits adjusted → ' + j2.credits.toLocaleString()); closeDrawer(); route(); } catch (e) { toast(e.message, true); }
  };
  $('#a-planbtn').onclick = async () => { try { await api('/api/user/plan', { id: u.id, plan: $('#a-plan').value }); toast('Plan updated'); closeDrawer(); route(); } catch (e) { toast(e.message, true); } };
  $('#a-trial').onclick = async () => { const grant = !(u.plan === 'plus' && u.trial_ends); try { await api('/api/user/trial', { id: u.id, grant }); toast(grant ? 'Trial granted' : 'Trial ended'); closeDrawer(); route(); } catch (e) { toast(e.message, true); } };
  $('#a-susp').onclick = async () => {
    const on = !u.suspended;
    if (on && !confirm('Suspend ' + u.email + '? Every request from them will be blocked (403) until you unsuspend. Use “Force logout” too if you want their sessions killed.')) return;
    try { await api('/api/user/suspend', { id: u.id, on }); toast(on ? 'User suspended' : 'User reinstated'); closeDrawer(); route(); } catch (e) { toast(e.message, true); }
  };
  $('#a-flogout').onclick = async () => { try { await api('/api/user/logout', { id: u.id }); toast('All sessions revoked'); } catch (e) { toast(e.message, true); } };
  $('#a-del').onclick = async () => {
    const word = prompt('DELETE ' + u.email + ' and all their data? Type DELETE to confirm.');
    if (word !== 'DELETE') return;
    try { await api('/api/user/delete', { id: u.id }); toast('Account deleted'); closeDrawer(); route(); } catch (e) { toast(e.message, true); }
  };
}

/* ---- support inbox ---- */
let thrFilter = 'open', thrCache = [];
VIEWS.inbox = async el => {
  el.innerHTML = `
  <div class="toolbar">
    ${['open', 'pending', 'closed', ''].map(f => `<button class="btn sm ${thrFilter === f ? 'primary' : ''}" data-f="${f}">${f ? f[0].toUpperCase() + f.slice(1) : 'All'}</button>`).join('')}
    <div class="spacer"></div><span class="dim tiny" id="thr-count"></span>
  </div>
  <div class="inbox">
    <div class="thr-list" id="thr-list"></div>
    <div class="conv">
      <div class="msgs" id="msgs"><p class="dim" style="margin:auto">Select a conversation</p></div>
      <div class="typing" id="typing-line"></div>
      <div class="composer">
        <button class="btn sm" id="note-btn" title="Internal note (invisible to user)">🔒 Note</button>
        <textarea id="reply" placeholder="Reply as support… (Enter to send)"></textarea>
        <button class="btn primary" id="send-btn">Send</button>
      </div>
    </div>
    <div class="ctx" id="ctx"><h4>Context</h4><p class="dim tiny">Open a thread.</p></div>
  </div>`;
  el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { thrFilter = b.dataset.f; VIEWS.inbox(el); });
  await loadThreads();
  $('#reply').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(false); } });
  $('#reply').addEventListener('input', () => { if (activeThread) api('/api/support/typing', { threadId: activeThread }).catch(() => {}); });
  $('#send-btn').onclick = () => sendReply(false);
  $('#note-btn').onclick = () => sendReply(true);
};
async function loadThreads() {
  const j = await api('/api/support/threads' + (thrFilter ? '?status=' + thrFilter : ''));
  thrCache = j.threads; setUnread(j.unread || 0);
  const list = $('#thr-list'); if (!list) return;
  $('#thr-count') && ($('#thr-count').textContent = j.threads.length + ' threads');
  list.innerHTML = j.threads.map(t => `
    <div class="thr ${activeThread === t.id ? 'on' : ''}" data-t="${esc(t.id)}">
      <div class="t1">${t.unreadByAdmin ? '<span class="dot"></span>' : ''}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.userName)}</span><span class="pill ${esc(t.status)}">${esc(t.status)}</span></div>
      <div class="t2">${esc(t.preview || t.subject || '')}</div>
      <div class="t2 mono">${esc(t.userEmail)} · ${fmtAgo(t.lastMessageAt)}${t.assignee ? ' · 👤 ' + esc(t.assignee) : ''}</div>
    </div>`).join('') || '<p class="dim tiny" style="padding:16px">No threads.</p>';
  list.querySelectorAll('[data-t]').forEach(d => d.onclick = () => openThread(d.dataset.t));
}
async function openThread(id) {
  activeThread = id;
  const j = await api('/api/support/thread?id=' + encodeURIComponent(id));
  threadMsgs = j.messages;
  document.querySelectorAll('.thr').forEach(d => d.classList.toggle('on', d.dataset.t === id));
  setUnread(Math.max(0, unread - (j.thread.unreadByAdmin || 0)));
  renderConv();
  const ctx = $('#ctx');
  if (ctx && j.user) ctx.innerHTML = `
    <h4>User</h4><b>${esc(j.user.name)}</b><div class="tiny dim mono">${esc(j.user.email)}</div>
    <div class="kv" style="margin-top:8px">
      <b>Plan</b><span class="pill ${esc(j.user.plan)}">${esc(j.user.plan)}</span>
      <b>Credits</b><span class="mono">${j.user.credits.toLocaleString()}</span>
      <b>Minutes</b><span class="mono">${j.user.minutes}</span>
      <b>Joined</b><span class="tiny">${fmtDate(j.user.created)}</span>
      <b>Last seen</b><span class="tiny">${fmtAgo(j.user.last_seen)}</span>
      <b>Status</b><span class="pill ${j.user.suspended ? 'suspended' : 'active'}">${j.user.suspended ? 'suspended' : 'active'}</span>
    </div>
    <h4>Thread</h4>
    <div class="row-actions">
      <button class="btn sm" id="c-assign">Assign to me</button>
      <button class="btn sm warn" id="c-pending">Pending</button>
      <button class="btn sm ${j.thread.status === 'closed' ? 'ok' : 'danger'}" id="c-close">${j.thread.status === 'closed' ? 'Reopen' : 'Close'}</button>
    </div>
    <h4>Quick replies</h4>
    <div class="quick">
      <button data-q="Hi! Thanks for reaching out — I'm looking into this right now.">Acknowledge</button>
      <button data-q="Could you share the exact steps and what you expected to happen?">Ask for steps</button>
      <button data-q="I've added credits to your account as a goodwill gesture — they're live now.">Credits granted</button>
      <button data-q="This is fixed on our side. Please refresh the app and try again — and thank you for your patience!">Resolved</button>
    </div>
    <h4>Recent activity</h4>
    ${j.recent.map(h => `<div class="tiny dim">${fmtDate(h.at)} · ${esc(h.tool || h.kind || '')} ${esc((h.title || h.text || '').slice(0, 40))}</div>`).join('') || '<p class="dim tiny">None</p>'}`;
  if (ctx) {
    ctx.querySelector('#c-assign').onclick = async () => { try { await api('/api/support/assign', { threadId: id, me: true }); toast('Assigned to you'); loadThreads(); } catch (e) { toast(e.message, true); } };
    ctx.querySelector('#c-pending').onclick = async () => { try { await api('/api/support/status', { threadId: id, status: 'pending' }); toast('Marked pending'); loadThreads(); } catch (e) { toast(e.message, true); } };
    ctx.querySelector('#c-close').onclick = async () => { const st = j.thread.status === 'closed' ? 'open' : 'closed'; try { await api('/api/support/status', { threadId: id, status: st }); toast('Thread ' + st); loadThreads(); } catch (e) { toast(e.message, true); } };
    ctx.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const r = $('#reply'); r.value = b.dataset.q; r.focus(); });
  }
}
function pushMsg(m) { if (!threadMsgs.some(x => x.id === m.id)) threadMsgs.push(m); }
function renderConv() {
  const box = $('#msgs'); if (!box) return;
  box.innerHTML = threadMsgs.map(m => `
    <div class="msg ${esc(m.sender)}">${esc(m.text)}
      <span class="meta">${m.sender === 'note' ? '🔒 internal note · ' : ''}${esc(m.sender)} · ${fmtDate(m.createdAt)}${m.sender === 'admin' ? (m.readAt ? ' · ✓✓ read' : ' · ✓ delivered') : ''}</span>
    </div>`).join('');
  box.scrollTop = box.scrollHeight;
}
async function sendReply(isNote) {
  if (!activeThread) return toast('Open a thread first.', true);
  const ta = $('#reply'); const text = ta.value.trim();
  if (!text) return;
  try {
    if (isNote) { const j = await api('/api/support/note', { threadId: activeThread, text }); pushMsg(j.message); }
    else { const j = await api('/api/support/reply', { threadId: activeThread, text }); pushMsg(j.message); loadThreads(); }
    ta.value = ''; renderConv();
  } catch (e) { toast(e.message, true); }
}

/* ---- studio workspace (no charges) ---- */
VIEWS.studio = async el => {
  el.innerHTML = '<p class="dim">Loading engines…</p>';
  const s = await api('/api/studio/status');
  let myVoices = []; try { myVoices = (await api('/api/studio/voices')).voices; } catch {}
  let myAgents = []; try { myAgents = (await api('/api/studio/agents')).agents; } catch {}
  el.innerHTML = `
  <p class="note" style="margin-bottom:14px">Admin workspace — renders run on your admin account and are <b>never charged credits</b>. Piper: ${s.piper.ready ? 'ready' : 'loading'} · LLM: ${s.llm ? 'on' : 'local fallback'}.</p>
  <div class="grid g2">
    <div class="panel"><h3>Text → Speech</h3>
      <textarea id="s-text" rows="4" placeholder="Type what the voice should say…"></textarea>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
        <select id="s-model" style="width:auto">${s.catalog.map(v => `<option value="${esc(v.id)}">${esc(v.label)} (${esc(v.gender)})</option>`).join('')}</select>
        <select id="s-voice" style="width:auto"><option value="">— workspace voice —</option>${myVoices.map(v => `<option value="${esc(v.id)}">${esc(v.name)}</option>`).join('')}</select>
        <input id="s-semi" type="number" value="0" min="-24" max="24" style="width:80px" title="Semitones">
        <input id="s-rate" type="number" value="1" min="0.5" max="2" step="0.05" style="width:80px" title="Rate">
        <button class="btn primary" id="s-go">Render</button>
      </div>
      <div id="s-out" style="margin-top:10px"></div>
    </div>
    <div class="panel"><h3>Voice changer (upload WAV)</h3>
      <input type="file" id="c-file" accept="audio/wav,audio/*">
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
        <input id="c-semi" type="number" value="0" min="-24" max="24" style="width:80px">
        <input id="c-rate" type="number" value="1" min="0.5" max="2" step="0.05" style="width:80px">
        <select id="c-fx" style="width:auto">${['none', 'radio', 'hall', 'phone', 'warm'].map(f => `<option>${f}</option>`).join('')}</select>
        <button class="btn" id="c-go">Process</button>
      </div>
      <div id="c-out" style="margin-top:10px"></div>
      <h3 style="margin-top:16px">Quick vocal remove (stereo WAV)</h3>
      <input type="file" id="x-file" accept="audio/wav,audio/*">
      <button class="btn" id="x-go" style="margin-top:8px">Separate</button>
      <div id="x-out" style="margin-top:10px"></div>
    </div>
    <div class="panel"><h3>Agent tester</h3>
      <select id="g-agent" style="margin-bottom:8px">${myAgents.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('') || '<option value="">No agents in admin workspace — save one below</option>'}</select>
      <div id="g-msgs" style="max-height:180px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;margin-bottom:8px"></div>
      <div style="display:flex;gap:8px"><input id="g-in" placeholder="Message the agent…"><button class="btn" id="g-send">Send</button></div>
      <p class="note">Saves an agent into the admin workspace:<br>
      <input id="g-name" placeholder="Agent name" style="margin-top:6px">
      <input id="g-persona" placeholder="Persona, e.g. warm Nigerian radio host" style="margin-top:6px">
      <button class="btn sm" id="g-save" style="margin-top:8px">Save agent to workspace</button></p>
    </div>
    <div class="panel"><h3>Voice match (upload 10 s sample)</h3>
      <input type="file" id="m-file" accept="audio/wav,audio/*">
      <input id="m-name" placeholder="Profile name" style="margin-top:8px">
      <button class="btn" id="m-go" style="margin-top:8px">Analyse &amp; save</button>
      <div id="m-out" class="tiny dim" style="margin-top:8px"></div>
    </div>
  </div>`;
  const fileB64 = f => new Promise((rs, rj) => { const r = new FileReader(); r.onload = () => rs(r.result); r.onerror = rj; r.readAsDataURL(f); });
  $('#s-go').onclick = async () => {
    const btn = $('#s-go'); btn.disabled = true; btn.textContent = 'Rendering…';
    try {
      const r = await fetch('/api/studio/tts', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF }, body: JSON.stringify({ text: $('#s-text').value, model: $('#s-model').value, voiceId: $('#s-voice').value || undefined, semitones: +$('#s-semi').value, rate: +$('#s-rate').value }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Render failed');
      const file = r.headers.get('X-Reachmark-File');
      $('#s-out').innerHTML = `<audio controls src="/api/studio/render/${encodeURIComponent(file)}"></audio>`;
    } catch (e) { toast(e.message, true); }
    btn.disabled = false; btn.textContent = 'Render';
  };
  $('#c-go').onclick = async () => {
    const f = $('#c-file').files[0]; if (!f) return toast('Choose a WAV file.', true);
    try {
      const r = await fetch('/api/studio/voice-change', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF }, body: JSON.stringify({ audio: await fileB64(f), semitones: +$('#c-semi').value, rate: +$('#c-rate').value, fx: $('#c-fx').value }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed');
      const file = r.headers.get('X-Reachmark-File');
      $('#c-out').innerHTML = `<audio controls src="/api/studio/render/${encodeURIComponent(file)}"></audio>`;
    } catch (e) { toast(e.message, true); }
  };
  $('#x-go').onclick = async () => {
    const f = $('#x-file').files[0]; if (!f) return toast('Choose a stereo WAV.', true);
    try {
      const j = await api('/api/studio/separate', { audio: await fileB64(f) });
      $('#x-out').innerHTML = `<div class="tiny dim">Vocals</div><audio controls src="/api/studio/render/${encodeURIComponent(j.vocals)}"></audio><div class="tiny dim" style="margin-top:6px">Instrumental</div><audio controls src="/api/studio/render/${encodeURIComponent(j.instrumental)}"></audio>`;
    } catch (e) { toast(e.message, true); }
  };
  $('#m-go').onclick = async () => {
    const f = $('#m-file').files[0]; if (!f) return toast('Choose a sample WAV.', true);
    try {
      const j = await api('/api/studio/match', { sample: await fileB64(f), name: $('#m-name').value || 'Admin match' });
      $('#m-out').textContent = 'Saved to workspace: ' + j.voice.name + ' · ' + j.voice.desc;
      toast('Voice matched & saved'); setTimeout(() => VIEWS.studio(el), 600);
    } catch (e) { toast(e.message, true); }
  };
  let gh = [];
  $('#g-send').onclick = async () => {
    const id = $('#g-agent').value, msg = $('#g-in').value.trim();
    if (!id) return toast('Save an agent to the workspace first.', true);
    if (!msg) return;
    $('#g-msgs').innerHTML += `<div class="msg user" style="max-width:90%">${esc(msg)}</div>`;
    $('#g-in').value = '';
    try {
      const j = await api('/api/studio/chat', { agentId: id, message: msg, history: gh });
      gh.push({ role: 'user', content: msg }); gh.push({ role: 'assistant', content: j.content }); gh = gh.slice(-12);
      $('#g-msgs').innerHTML += `<div class="msg admin" style="max-width:90%">${esc(j.content)}<span class="meta">${esc(j.source)}</span></div>`;
      $('#g-msgs').scrollTop = $('#g-msgs').scrollHeight;
    } catch (e) { toast(e.message, true); }
  };
  $('#g-save').onclick = async () => {
    const name = $('#g-name').value.trim(); if (!name) return toast('Name required.', true);
    const doc = { id: 'ag_' + Math.random().toString(36).slice(2, 8), name, role: 'admin test agent', persona: $('#g-persona').value.trim() || 'helpful Reachmark staff member', greeting: 'Hey — admin test agent online.', knowledge: [], language: 'en', voice: '', avatar: '🎙️', created: Date.now() };
    try { await api('/api/studio/save', { type: 'agents', doc: JSON.parse(JSON.stringify(doc)) }); toast('Agent saved to workspace'); setTimeout(() => VIEWS.studio(el), 500); } catch (e) { toast(e.message, true); }
  };
};

/* ---- site control ---- */
VIEWS.site = async el => {
  let cfg, costs, flags;
  try { ({ config: cfg, costs, flags } = await api('/api/config')); }
  catch (e) { el.innerHTML = `<p class="err-line">${esc(e.message)} — site control requires the admin role.</p>`; return; }
  const set = async (key, value) => { try { const j = await api('/api/config', { key, value }); cfg = j.config; toast('Saved: ' + key); } catch (e) { toast(e.message, true); } };
  el.innerHTML = `
  <div class="grid g2">
    <div class="panel"><h3>Operations</h3>
      <div class="flag-row"><span>Maintenance mode <span class="tiny dim">(public APIs return 503; support stays open)</span></span><div class="toggle ${cfg.maintenance === '1' ? 'on' : ''}" id="t-maint"></div></div>
      <div class="flag-row"><span>New signups</span><div class="toggle ${cfg.signup_on === '1' ? 'on' : ''}" id="t-signup"></div></div>
      <label style="display:block;margin-top:12px" class="tiny dim">Announcement banner (empty = hidden)
        <input id="t-ann" value="${esc(cfg.announcement || '')}" maxlength="200" style="margin-top:6px"></label>
      <button class="btn sm" id="t-ann-save" style="margin-top:8px">Save announcement</button>
      <label style="display:block;margin-top:12px" class="tiny dim">Signup credits
        <input id="t-cred" type="number" value="${esc(cfg.signup_credits)}" min="0" max="10000000" style="margin-top:6px;width:160px"></label>
      <button class="btn sm" id="t-cred-save" style="margin-top:8px">Save credits</button>
    </div>
    <div class="panel"><h3>Credit costs</h3>
      ${Object.keys(costs).map(k => `<div class="flag-row"><span>${esc(k)}</span><input type="number" min="0" data-cost="${esc(k)}" value="${costs[k]}" style="width:110px"></div>`).join('')}
      <button class="btn sm warn" id="t-costs" style="margin-top:10px">Save costs</button>
    </div>
    <div class="panel"><h3>Feature flags (per studio)</h3>
      ${Object.keys(flags).map(k => `<div class="flag-row"><span>${esc(k)}</span><div class="toggle ${flags[k] ? 'on' : ''}" data-flag="${esc(k)}"></div></div>`).join('')}
      <p class="note">Off = that studio's API returns 403 for everyone.</p>
    </div>
    <div class="panel"><h3>Defaults</h3>
      <label class="tiny dim">Default stock voice id (blank = first catalog voice)
        <input id="t-dv" value="${esc(cfg.default_voice || '')}" style="margin-top:6px"></label>
      <button class="btn sm" id="t-dv-save" style="margin-top:8px">Save default voice</button>
    </div>
  </div>`;
  $('#t-maint').onclick = e => set('maintenance', cfg.maintenance === '1' ? '0' : '1').then(() => VIEWS.site(el));
  $('#t-signup').onclick = e => set('signup_on', cfg.signup_on === '1' ? '0' : '1').then(() => VIEWS.site(el));
  $('#t-ann-save').onclick = () => set('announcement', $('#t-ann').value.trim());
  $('#t-cred-save').onclick = () => set('signup_credits', String(parseInt($('#t-cred').value, 10) || 0));
  $('#t-costs').onclick = () => {
    const o = {}; el.querySelectorAll('[data-cost]').forEach(i => o[i.dataset.cost] = Math.max(0, parseInt(i.value, 10) || 0));
    set('costs', JSON.stringify(o)).then(() => VIEWS.site(el));
  };
  el.querySelectorAll('[data-flag]').forEach(t => t.onclick = () => {
    const o = { ...flags }; o[t.dataset.flag] = o[t.dataset.flag] ? 0 : 1;
    set('flags', JSON.stringify(o)).then(() => VIEWS.site(el));
  });
  $('#t-dv-save').onclick = () => set('default_voice', $('#t-dv').value.trim());
};

/* ---- agents & voices ---- */
let docsType = 'voices', docsQ = '';
VIEWS.docs = async el => {
  el.innerHTML = `
  <div class="toolbar">
    <button class="btn sm ${docsType === 'voices' ? 'primary' : ''}" id="d-v">Voices</button>
    <button class="btn sm ${docsType === 'agents' ? 'primary' : ''}" id="d-a">Agents</button>
    <input id="d-q" placeholder="Search name or owner…" value="${esc(docsQ)}">
  </div><div class="panel" style="padding:6px"><table id="d-t"></table></div>`;
  const draw = async () => {
    const j = await api('/api/docs?type=' + docsType + '&q=' + encodeURIComponent(docsQ));
    $('#d-t').innerHTML = `<tr><th>Name</th><th>Owner</th><th>Details</th><th>Created</th><th></th></tr>` +
      j.docs.map(d => `<tr>
        <td><b>${esc(d.name || d.id)}</b>${d.system ? ' <span class="pill admin">system</span>' : ''}${d.disabled ? ' <span class="pill suspended">disabled</span>' : ''}</td>
        <td class="tiny">${esc(d.userName)}<br><span class="dim mono">${esc(d.userEmail)}</span></td>
        <td class="tiny dim">${esc((d.desc || d.role || d.kind || '').toString().slice(0, 60))}</td>
        <td class="tiny">${fmtDate(d.created)}</td>
        <td>${d.system ? '' : `<button class="btn sm ${d.disabled ? 'ok' : 'danger'}" data-dis="${esc(d.id)}" data-on="${d.disabled ? 0 : 1}">${d.disabled ? 'Enable' : 'Disable'}</button>`}</td>
      </tr>`).join('');
    $('#d-t').querySelectorAll('[data-dis]').forEach(b => b.onclick = async () => {
      try { await api('/api/docs/disable', { type: docsType, id: b.dataset.dis, on: b.dataset.on === '1' }); toast(b.dataset.on === '1' ? 'Disabled — API now rejects it' : 'Enabled'); draw(); } catch (e) { toast(e.message, true); }
    });
  };
  $('#d-v').onclick = () => { docsType = 'voices'; VIEWS.docs(el); };
  $('#d-a').onclick = () => { docsType = 'agents'; VIEWS.docs(el); };
  $('#d-q').oninput = e => { docsQ = e.target.value; clearTimeout(window._dq); window._dq = setTimeout(draw, 250); };
  draw();
};

/* ---- audit ---- */
let audFilter = { action: '', actor: '' };
VIEWS.audit = async el => {
  el.innerHTML = `
  <div class="toolbar">
    <input id="a-action" placeholder="Filter action (e.g. credits.adjust)" value="${esc(audFilter.action)}">
    <input id="a-actor" placeholder="Filter actor email" value="${esc(audFilter.actor)}">
    <button class="btn sm" id="a-go">Apply</button>
    <div class="spacer"></div><span class="dim tiny">Every admin write is logged — who, action, target, IP, time.</span>
  </div><div class="panel" style="padding:6px"><table id="a-t"></table></div>`;
  const draw = async () => {
    try {
      const j = await api('/api/audit?limit=300&action=' + encodeURIComponent(audFilter.action) + '&actor=' + encodeURIComponent(audFilter.actor));
      $('#a-t').innerHTML = `<tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>IP</th><th>Meta</th></tr>` +
        j.rows.map(r => `<tr><td class="tiny mono">${fmtDate(r.at)}</td><td class="tiny">${esc(r.actor)}</td><td><b class="mono tiny">${esc(r.action)}</b></td><td class="tiny mono">${esc(r.target)}</td><td class="tiny mono">${esc(r.ip || '')}</td><td class="tiny dim" style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.meta || '')}</td></tr>`).join('');
    } catch (e) { $('#a-t').innerHTML = `<tr><td class="err-line">${esc(e.message)}</td></tr>`; }
  };
  $('#a-go').onclick = () => { audFilter = { action: $('#a-action').value.trim(), actor: $('#a-actor').value.trim() }; draw(); };
  draw();
};

/* ---- admins ---- */
VIEWS.admins = async el => {
  let j;
  try { j = await api('/api/admins'); }
  catch (e) { el.innerHTML = `<p class="err-line">${esc(e.message)} — requires the admin role.</p>`; return; }
  el.innerHTML = `
  <div class="grid g2">
    <div class="panel"><h3>Staff accounts</h3><table>
      <tr><th>Name</th><th>Email</th><th>Role</th><th>2FA</th><th>Last seen</th><th></th></tr>
      ${j.admins.map(a => `<tr>
        <td><b>${esc(a.name)}</b></td><td class="mono tiny">${esc(a.email)}</td>
        <td><span class="pill ${esc(a.role)}">${esc(a.role)}</span></td>
        <td>${a.totp_enabled ? '✅' : '⏳ first login'}</td>
        <td class="tiny">${fmtAgo(a.last_seen)}</td>
        <td>${a.suspended ? '<span class="pill suspended">disabled</span>' : ''}${a.id === ME.id ? '' : ` <button class="btn sm ${a.suspended ? 'ok' : 'danger'}" data-tog="${esc(a.id)}" data-on="${a.suspended ? 0 : 1}">${a.suspended ? 'Enable' : 'Disable'}</button>`}</td>
      </tr>`).join('')}
    </table></div>
    <div class="panel"><h3>Create staff account</h3>
      <p class="note" style="margin-bottom:10px">Created accounts must enroll TOTP 2FA at first login. The first admin itself only ever comes from the ADMIN_EMAIL / ADMIN_PASSWORD environment — never from public signup.</p>
      <input id="n-name" placeholder="Full name" style="margin-bottom:8px">
      <input id="n-email" type="email" placeholder="Email" style="margin-bottom:8px">
      <input id="n-pass" type="password" placeholder="Temporary password (min 8)" style="margin-bottom:8px">
      <select id="n-role" style="margin-bottom:10px"><option value="support">support — inbox + dashboard</option><option value="admin">admin — full control</option></select>
      <button class="btn primary" id="n-create">Create account</button>
    </div>
  </div>`;
  el.querySelectorAll('[data-tog]').forEach(b => b.onclick = async () => {
    try { await api('/api/admins/disable', { id: b.dataset.tog, on: b.dataset.on === '1' }); toast(b.dataset.on === '1' ? 'Account disabled & logged out' : 'Account enabled'); VIEWS.admins(el); } catch (e) { toast(e.message, true); }
  });
  $('#n-create').onclick = async () => {
    try {
      const a = (await api('/api/admins/create', { name: $('#n-name').value, email: $('#n-email').value, password: $('#n-pass').value, role: $('#n-role').value })).admin;
      toast('Created ' + a.email + ' (' + a.role + ') — 2FA enrolls at first login');
      VIEWS.admins(el);
    } catch (e) { toast(e.message, true); }
  };
};

/* ---------------- drawer ---------------- */
function openDrawer(html) {
  closeDrawer();
  const bg = document.createElement('div'); bg.className = 'drawer-bg'; bg.onclick = closeDrawer;
  const d = document.createElement('div'); d.className = 'drawer'; d.id = 'drawer'; d.innerHTML = html;
  document.body.appendChild(bg); document.body.appendChild(d);
}
function drawerEl() { return $('#drawer'); }
function closeDrawer() { document.querySelectorAll('.drawer-bg, .drawer').forEach(x => x.remove()); }

/* ---------------- clock & boot ---------------- */
setInterval(() => { const c = $('#clock'); if (c) c.textContent = new Date().toLocaleTimeString(); }, 1000);
boot();
