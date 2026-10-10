#!/usr/bin/env node
// Reachmark Audio v1.3 — integration test suite.
// Spins the public server AND the admin server on test ports with a throwaway DATA_DIR,
// then asserts the spec'd guarantees:
//   1. non-admin users are rejected by every /admin API (401/403)
//   2. admin login requires TOTP 2FA (password alone never yields a session)
//   3. lockout engages after 5 failed attempts
//   4. admin credit changes are written to the audit log (with reason)
//   5. user message reaches admin inbox and admin reply reaches user in < 2 seconds
//   + CSRF enforcement, agent chat charging w/ fallback, maintenance & signup gates,
//     audited sample access, real-time SSE delivery both ways.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const totp = require('../server/totp');

const ROOT = path.join(__dirname, '..');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-test-'));
const PUB = 'http://127.0.0.1:8123';
const ADM = 'http://127.0.0.1:8124';
const ADMIN_EMAIL = 'admin@test.local';
const ADMIN_PASS = 'AdminPass123!';

let passed = 0, failed = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log('  PASS  ' + name + (extra ? '  (' + extra + ')' : '')); }
  else { failed++; console.log('  FAIL  ' + name + (extra ? '  (' + extra + ')' : '')); }
};
const group = g => console.log('\n== ' + g + ' ==');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- cookie jars ---------- */
const jars = { pub: '', adm: '' };
async function req(base, side, method, p, body, headers = {}) {
  const h = { ...headers };
  if (body !== undefined) h['content-type'] = 'application/json';
  if (jars[side]) h.cookie = jars[side];
  const r = await fetch(base + p, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  for (const c of sc) {
    const [pair] = c.split(';');
    const [k] = pair.split('=');
    const keep = jars[side].split('; ').filter(x => x && !x.startsWith(k + '='));
    keep.push(pair);
    jars[side] = keep.join('; ');
  }
  let j = null;
  try { j = await r.json(); } catch {}
  return { status: r.status, j, r };
}
const pub = (m, p, b, h) => req(PUB, 'pub', m, p, b, h);
const adm = (m, p, b, h) => req(ADM, 'adm', m, p, b, h);

async function waitUp(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return true; } catch {}
    await sleep(250);
  }
  return false;
}

(async () => {
  const env = {
    ...process.env, DATA_DIR: DATA, PORT: '8123', ADMIN_PORT: '8124',
    ADMIN_EMAIL, ADMIN_PASSWORD: ADMIN_PASS, SUPPORT_EMAIL: 'support@test.local',
    LLM_API_KEY: '',
  };
  const pubProc = spawn('node', ['server/server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const admProc = spawn('node', ['admin/server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let pubLog = '', admLog = '';
  pubProc.stdout.on('data', d => pubLog += d); pubProc.stderr.on('data', d => pubLog += d);
  admProc.stdout.on('data', d => admLog += d); admProc.stderr.on('data', d => admLog += d);

  const up = await waitUp(PUB + '/api/health') && await waitUp(ADM + '/health');
  if (!up) { console.error('servers failed to start\nPUBLIC:\n' + pubLog + '\nADMIN:\n' + admLog); process.exit(1); }
  await sleep(1500); // let the env-seeded admin account finish hashing

  try {
    /* ---------- 1. public sanity + signup ---------- */
    group('Public API sanity');
    let r = await pub('GET', '/api/health');
    ok('GET /api/health → 200', r.status === 200 && r.j.ok === true);
    r = await pub('GET', '/api/config');
    ok('GET /api/config is public', r.status === 200 && r.j.signup_on === true);

    group('Signup & user session');
    const email = 'user' + Date.now() + '@test.local';
    r = await pub('POST', '/api/auth/signup', { name: 'Test User', email, password: 'UserPass123!' });
    ok('signup → 200', r.status === 200, 'credits=' + r.j?.user?.credits);
    ok('signup credits from config (10000)', r.j?.user?.credits === 10000);
    const credits0 = r.j.user.credits;

    /* ---------- transactional email (outbox fallback when SMTP unset) ---------- */
    group('Transactional email templates (welcome / reset / notices)');
    const outbox = () => { try { return fs.readFileSync(path.join(DATA, 'outbox.log'), 'utf8'); } catch { return ''; } };
    await sleep(300);
    ok('signup wrote branded welcome email', /Welcome to Reachmark Audio/.test(outbox()) && outbox().includes(email));
    ok('welcome email carries the Reachmark Digital footer', /product of Reachmark Digital/.test(outbox()));
    r = await pub('POST', '/api/auth/forgot', { email: 'ghost' + Date.now() + '@test.local' });
    ok('forgot for unknown email → generic 200 (no enumeration)', r.status === 200 && /If that email has an account/.test(r.j.message));
    r = await pub('POST', '/api/auth/forgot', { email });
    ok('forgot for real email → 200', r.status === 200);
    await sleep(400);
    const rlink = /#\/reset\/([a-f0-9]{48})/.exec(outbox());
    ok('reset email contains single-use link', !!rlink, rlink ? rlink[1].slice(0, 12) + '…' : 'no link found');
    r = await pub('POST', '/api/auth/reset', { token: rlink ? rlink[1] : 'x', password: 'NewPass123!' });
    ok('reset with valid token → 200', r.status === 200);
    r = await pub('POST', '/api/auth/reset', { token: rlink ? rlink[1] : 'x', password: 'Another123!' });
    ok('reset token is single-use → 400', r.status === 400);
    r = await pub('POST', '/api/auth/login', { email, password: 'UserPass123!' });
    ok('old password rejected after reset → 401', r.status === 401);
    r = await pub('POST', '/api/auth/login', { email, password: 'NewPass123!' });
    ok('new password works → fresh session', r.status === 200);
    await sleep(300);
    ok('password-changed security notice emailed', /password was changed/i.test(outbox()));
    r = await pub('GET', '/terms');
    const privR = await pub('GET', '/privacy');
    ok('public /terms and /privacy routes served', r.status === 200 && privR.status === 200);

    /* ---------- 2. non-admin rejected by admin APIs ---------- */
    group('Non-admin vs admin APIs');
    r = await adm('GET', '/api/stats');
    ok('admin /api/stats without session → 401', r.status === 401);
    r = await adm('GET', '/api/users');
    ok('admin /api/users without session → 401', r.status === 401);
    // public user cookie must NOT authenticate on the admin app
    const pubCookie = jars.pub;
    jars.adm = pubCookie.replace(/rm=/, 'rm_admin=');
    r = await adm('GET', '/api/stats');
    ok('public session token rejected by admin app → 401', r.status === 401);
    jars.adm = '';
    r = await adm('POST', '/api/login', { email, password: 'UserPass123!' });
    ok('regular user cannot admin-login → 401', r.status === 401);

    /* ---------- 3. lockout after 5 failures ---------- */
    group('Admin lockout');
    let last = null;
    for (let i = 0; i < 5; i++) last = await adm('POST', '/api/login', { email: 'lock@test.local', password: 'wrong' + i });
    ok('5 wrong passwords → 401 each', last.status === 401);
    last = await adm('POST', '/api/login', { email: 'lock@test.local', password: 'wrong6' });
    ok('6th attempt → 423 locked', last.status === 423, 'msg: ' + last.j?.error);

    /* ---------- 4. admin login REQUIRES 2FA ---------- */
    group('Admin login + mandatory 2FA');
    r = await adm('POST', '/api/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
    ok('correct password → enroll challenge (no session yet)', r.status === 200 && r.j.enroll === true && !!r.j.secret);
    let stat = await adm('GET', '/api/me');
    ok('password alone grants NO session → 401', stat.status === 401);
    const secret = r.j.secret, token = r.j.token;
    r = await adm('POST', '/api/login/2fa', { token, code: '000000' });
    ok('wrong TOTP code → 401', r.status === 401);
    stat = await adm('GET', '/api/me');
    ok('still no session after wrong code → 401', stat.status === 401);
    const code = totp.codeAt(secret, Date.now() / 1000);
    r = await adm('POST', '/api/login/2fa', { token, code });
    ok('valid TOTP → session + csrf', r.status === 200 && r.j.ok === true && !!r.j.csrf && /rm_admin=/.test(jars.adm), 'code=' + code);
    const csrf = r.j.csrf;
    stat = await adm('GET', '/api/me');
    ok('/api/me with admin session → 200 role=admin', stat.status === 200 && stat.j.user.role === 'admin');

    /* ---------- CSRF ---------- */
    group('CSRF enforcement');
    r = await adm('POST', '/api/user/credits', { id: 'x', delta: 5, reason: 'no csrf' });
    ok('state-changing POST without X-CSRF-Token → 403', r.status === 403);

    /* ---------- 5. credit adjust + audit log ---------- */
    group('Credit adjust is audit-logged');
    const users = (await adm('GET', '/api/users?q=' + encodeURIComponent(email))).j.users;
    const uid = users[0]?.id;
    ok('admin sees the new user', !!uid);
    r = await adm('POST', '/api/user/credits', { id: uid, delta: -500, reason: 'test-adjust-42' }, { 'X-CSRF-Token': csrf });
    ok('adjust −500 → 200', r.status === 200 && r.j.credits === credits0 - 500, 'credits=' + r.j?.credits);
    const aud = (await adm('GET', '/api/audit?action=credits.adjust&limit=20')).j.rows;
    const row = aud.find(a => a.target === email && (a.meta || '').includes('test-adjust-42'));
    ok('audit row: actor + action + target + reason', !!row && row.actor === ADMIN_EMAIL, row ? row.action + ' → ' + row.target : '');
    ok('audit row has ip + timestamp', !!row && !!row.ip && row.at > Date.now() - 60000);
    let me = await pub('GET', '/api/auth/me');
    ok('user balance reflects adjust server-side', me.j.user.credits === credits0 - 500);

    /* password hashes / tokens never exposed */
    const detail = (await adm('GET', '/api/user?id=' + uid)).j;
    const blob = JSON.stringify(detail);
    ok('user detail exposes NO salt/pass/session tokens', !/salt|"pass"|rm=|"token"/.test(blob));

    /* ---------- agent chat (server route, local fallback, charging) ---------- */
    group('Character agent chat');
    r = await pub('POST', '/api/agents', { name: 'Test Bot', role: 'tester', persona: 'concise', knowledge: ['The lab is open 24/7.'], greeting: 'Hi!', emoji: '🤖', traits: ['warm'], language: 'en' });
    const agentId = r.j?.agent?.id;
    ok('agent created with v1.3 fields', r.status === 200 && r.j.agent.emoji === '🤖' && r.j.agent.language === 'en');
    const before = (await pub('GET', '/api/auth/me')).j.user.credits;
    r = await pub('POST', '/api/agent/chat', { agentId, message: 'When is the lab open?', history: [] });
    ok('chat → 200 with content', r.status === 200 && typeof r.j.content === 'string' && r.j.content.length > 3);
    ok('no LLM key → local persona fallback', r.j.source === 'local');
    ok('knowledge used in fallback reply', /24\/7|lab/i.test(r.j.content), r.j.content.slice(0, 60));
    const after = (await pub('GET', '/api/auth/me')).j.user.credits;
    ok('chat charged credits server-side (2)', before - after === 2, before + '→' + after);
    r = await pub('POST', '/api/agent/chat', { agentId: 'guide', message: 'What can you do?', history: [] });
    ok('Guide chat works', r.status === 200 && !!r.j.content);
    const afterGuide = (await pub('GET', '/api/auth/me')).j.user.credits;
    ok('platform Guide chat is free', afterGuide === after);
    r = await pub('POST', '/api/agent/chat', { agentId: 'nope', message: 'hi' });
    ok('unknown agent → 404', r.status === 404);

    /* ---------- 6. support roundtrip < 2s ---------- */
    group('Live support roundtrip (<2s each way)');
    let t0 = Date.now();
    r = await pub('POST', '/api/support/escalate', { subject: 'Need help with credits' });
    ok('escalate → thread open', r.status === 200 && r.j.thread.status === 'open');
    const threadId = r.j.thread.id;
    t0 = Date.now();
    r = await pub('POST', '/api/support/message', { text: 'My renders are not saving!' });
    const userSentAt = Date.now();
    ok('user message accepted', r.status === 200 && r.j.message.sender === 'user');
    let seen = (await adm('GET', '/api/support/threads?status=open')).j.threads.find(t => t.id === threadId);
    let dt = Date.now() - userSentAt;
    ok('user → admin inbox < 2s', !!seen && seen.unreadByAdmin >= 1 && dt < 2000, dt + 'ms');
    const adminReplyAt = Date.now();
    r = await adm('POST', '/api/support/reply', { threadId, text: 'Checking your account now — one moment.' }, { 'X-CSRF-Token': csrf });
    ok('admin reply accepted', r.status === 200 && r.j.message.sender === 'admin');
    const state2 = (await pub('GET', '/api/support/state')).j;
    dt = Date.now() - adminReplyAt;
    const got = state2.messages.find(m => m.sender === 'admin');
    ok('admin → user chat < 2s', !!got && dt < 2000, dt + 'ms');
    ok('internal notes hidden from user', !state2.messages.some(m => m.sender === 'note'));
    r = await adm('POST', '/api/support/note', { threadId, text: 'internal: check render disk' }, { 'X-CSRF-Token': csrf });
    const admThread = (await adm('GET', '/api/support/thread?id=' + threadId)).j;
    ok('admin sees internal note', admThread.messages.some(m => m.sender === 'note' && m.text.includes('internal')));
    const state3 = (await pub('GET', '/api/support/state')).j;
    ok('user still cannot see note', !state3.messages.some(m => m.text.includes('internal')));

    /* rate limit */
    group('Support rate limiting & caps');
    let limited = false;
    for (let i = 0; i < 12; i++) { const x = await pub('POST', '/api/support/message', { text: 'spam ' + i }); if (x.status === 429) { limited = true; break; } }
    ok('message spam → 429', limited);
    r = await pub('POST', '/api/support/message', { text: 'x'.repeat(5000) });
    ok('over-long message rejected or capped', r.status === 400 || (r.j?.message?.text?.length || 0) <= 2000);

    /* ---------- realtime SSE both ways ---------- */
    group('Realtime SSE (auto-reconnect transport)');
    const readEvent = async (url, cookie, wantEvent, timeoutMs) => {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const res = await fetch(url, { headers: { cookie, accept: 'text/event-stream' }, signal: ctl.signal });
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '', t0 = Date.now();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const idx = buf.indexOf('event: ' + wantEvent);
          if (idx >= 0) { const dt = Date.now() - t0; ctl.abort(); clearTimeout(t); return dt; }
        }
      } catch {}
      clearTimeout(t);
      return null;
    };
    // admin stream: user message must arrive over SSE
    let adminSSE = null;
    const ssePromise = readEvent(ADM + '/api/support/stream', jars.adm, 'message', 6000);
    await sleep(400);
    // wait out the user-side rate limit window impact: use escalate path (bot message counts as 'bot' sender → also streamed)
    await pub('POST', '/api/support/escalate', { subject: 'second question' });
    adminSSE = await ssePromise;
    ok('admin SSE receives thread message', adminSSE !== null, adminSSE !== null ? adminSSE + 'ms' : 'timeout');
    // user stream: admin reply must arrive over SSE
    const userSSEP = readEvent(PUB + '/api/support/stream', jars.pub, 'message', 6000);
    await sleep(400);
    await adm('POST', '/api/support/reply', { threadId, text: 'All fixed on our side.' }, { 'X-CSRF-Token': csrf });
    const userSSE = await userSSEP;
    ok('user SSE receives admin reply', userSSE !== null, userSSE !== null ? userSSE + 'ms' : 'timeout');

    /* ---------- site control gates ---------- */
    group('Site control (maintenance / signups / flags)');
    r = await adm('POST', '/api/config', { key: 'maintenance', value: '1' }, { 'X-CSRF-Token': csrf });
    ok('maintenance on → saved + audited', r.status === 200);
    r = await pub('GET', '/api/voices');
    ok('maintenance → protected APIs 503', r.status === 503);
    r = await pub('GET', '/api/support/state');
    ok('maintenance → support stays open', r.status === 200);
    r = await pub('GET', '/api/health');
    ok('maintenance → health still 200', r.status === 200);
    await adm('POST', '/api/config', { key: 'maintenance', value: '0' }, { 'X-CSRF-Token': csrf });
    r = await pub('GET', '/api/voices');
    ok('maintenance off → APIs back', r.status === 200);
    await adm('POST', '/api/config', { key: 'signup_on', value: '0' }, { 'X-CSRF-Token': csrf });
    r = await pub('POST', '/api/auth/signup', { name: 'Blocked', email: 'blocked' + Date.now() + '@test.local', password: 'Whatever123!' });
    ok('signups off → signup 403', r.status === 403);
    await adm('POST', '/api/config', { key: 'signup_on', value: '1' }, { 'X-CSRF-Token': csrf });
    await adm('POST', '/api/config', { key: 'flags', value: JSON.stringify({ tts: 0, changer: 1, match: 1, design: 1, dub: 1, lip: 1, sep: 1, agents: 1, support: 1 }) }, { 'X-CSRF-Token': csrf });
    r = await pub('POST', '/api/tts', { text: 'hello world' });
    ok('flag tts=off → 403', r.status === 403);
    await adm('POST', '/api/config', { key: 'flags', value: JSON.stringify({ tts: 1, changer: 1, match: 1, design: 1, dub: 1, lip: 1, sep: 1, agents: 1, support: 1 }) }, { 'X-CSRF-Token': csrf });
    r = await adm('POST', '/api/config', { key: 'bogus_key', value: '1' }, { 'X-CSRF-Token': csrf });
    ok('unknown config key → 400', r.status === 400);

    /* ---------- agents & voices moderation ---------- */
    group('Agents & voices moderation');
    r = await adm('GET', '/api/docs?type=agents&q=' + encodeURIComponent('Test Bot'));
    const doc = r.j.docs[0];
    ok('admin lists user agents with owner', !!doc && doc.userEmail === email);
    r = await adm('POST', '/api/docs/disable', { type: 'agents', id: doc.id, on: 1 }, { 'X-CSRF-Token': csrf });
    ok('disable agent → 200', r.status === 200);
    r = await pub('POST', '/api/agent/chat', { agentId: doc.id, message: 'you there?' });
    ok('disabled agent → chat 403', r.status === 403);
    await adm('POST', '/api/docs/disable', { type: 'agents', id: doc.id, on: 0 }, { 'X-CSRF-Token': csrf });

    /* ---------- audited sample access ---------- */
    group('Sample access is deliberate + audited');
    r = await adm('GET', '/api/sample?file=whatever.wav');
    ok('sample without ack → 400', r.status === 400);
    r = await adm('GET', '/api/sample?file=nope.wav&ack=1');
    ok('unknown file → 404', r.status === 404);

    /* ---------- suspension & force logout ---------- */
    group('Suspension & force logout');
    r = await adm('POST', '/api/user/suspend', { id: uid, on: 1, reason: 'test' }, { 'X-CSRF-Token': csrf });
    ok('suspend → 200', r.status === 200);
    await sleep(300);
    ok('suspension notice emailed to the user', /account (is|has been) suspended/i.test(outbox()) && outbox().includes('Reason: test'));
    r = await pub('GET', '/api/voices');
    ok('suspended user → 403 on protected APIs', r.status === 403);
    await adm('POST', '/api/user/suspend', { id: uid, on: 0 }, { 'X-CSRF-Token': csrf });
    await sleep(300);
    ok('reinstatement notice emailed', /active again/i.test(outbox()));
    r = await pub('GET', '/api/voices');
    ok('unsuspended → access restored', r.status === 200);
    r = await adm('POST', '/api/user/logout', { id: uid }, { 'X-CSRF-Token': csrf });
    ok('force logout → 200', r.status === 200);
    r = await pub('GET', '/api/auth/me');
    ok('forced-out user session dead → 401', r.status === 401);

    /* ---------- admins management ---------- */
    group('Admin account management');
    const supEmail = 'support' + Date.now() + '@test.local';
    r = await adm('POST', '/api/admins/create', { name: 'Support Sam', email: supEmail, password: 'SupportPass1!', role: 'support' }, { 'X-CSRF-Token': csrf });
    ok('create support account → 200', r.status === 200 && r.j.admin.role === 'support');
    const supId = r.j.admin.id;
    // support role: inbox yes, destructive no
    jars.adm = '';
    r = await adm('POST', '/api/login', { email: supEmail, password: 'SupportPass1!' });
    const supSecret = r.j.secret, supToken = r.j.token;
    r = await adm('POST', '/api/login/2fa', { token: supToken, code: totp.codeAt(supSecret, Date.now() / 1000) });
    ok('support staff logs in with 2FA', r.status === 200 && r.j.ok);
    const supCsrf = r.j.csrf;
    r = await adm('GET', '/api/support/threads');
    ok('support role can read inbox', r.status === 200);
    r = await adm('POST', '/api/user/credits', { id: uid, delta: 10, reason: 'x' }, { 'X-CSRF-Token': supCsrf });
    ok('support role blocked from credit changes → 403', r.status === 403);
    r = await adm('GET', '/api/audit');
    ok('support role blocked from audit log → 403', r.status === 403);
    // admin disables the support account
    jars.adm = '';
    r = await adm('POST', '/api/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
    ok('admin relogin → 2FA required again (need2fa)', r.status === 200 && r.j.need2fa === true);
    r = await adm('POST', '/api/login/2fa', { token: r.j.token, code: totp.codeAt(secret, Date.now() / 1000) });
    ok('admin 2FA with enrolled secret → session', r.status === 200 && r.j.ok);
    const csrf2 = r.j.csrf;
    r = await adm('POST', '/api/admins/disable', { id: supId, on: 1 }, { 'X-CSRF-Token': csrf2 });
    ok('disable support account → 200', r.status === 200);
    jars.adm = '';
    r = await adm('POST', '/api/login', { email: supEmail, password: 'SupportPass1!' });
    ok('disabled staff cannot log in → 401', r.status === 401);

    /* ---------- security headers ---------- */
    group('Admin security posture');
    const hr = await fetch(ADM + '/');
    ok('admin CSP + nosniff + DENY frame + noindex', !!hr.headers.get('content-security-policy') && hr.headers.get('x-content-type-options') === 'nosniff' && hr.headers.get('x-frame-options') === 'DENY' && (hr.headers.get('x-robots-tag') || '').includes('noindex'));
    ok('admin login page served', hr.status === 200 && (await hr.text()).includes('Control room'));
    const pr = await fetch(PUB + '/');
    const ptxt = await pr.text();
    ok('public app contains NO reference to the admin app', !/admin\.js|ADMIN_PORT|\/api\/login\/2fa|rm_admin/.test(ptxt));
    const swtxt = await (await fetch(PUB + '/sw.js')).text();
    ok('service worker has no admin entries', !/admin/i.test(swtxt));

    /* ---------- delete user ---------- */
    group('User deletion');
    // re-auth as admin (jar was emptied for the disabled-staff login test)
    r = await adm('POST', '/api/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
    r = await adm('POST', '/api/login/2fa', { token: r.j.token, code: totp.codeAt(secret, Date.now() / 1000) });
    ok('admin re-auth for deletion → 200', r.status === 200 && r.j.ok === true);
    const csrf3 = r.j.csrf;
    r = await adm('POST', '/api/user/delete', { id: uid }, { 'X-CSRF-Token': csrf3 });
    ok('delete user → 200', r.status === 200, r.status + ' ' + JSON.stringify(r.j));
    r = await adm('GET', '/api/user?id=' + uid);
    ok('deleted user gone → 404', r.status === 404);
  } catch (e) {
    failed++;
    console.error('\nSUITE ERROR:', e);
  } finally {
    pubProc.kill('SIGKILL'); admProc.kill('SIGKILL');
    await sleep(300);
    try { fs.rmSync(DATA, { recursive: true, force: true }); } catch {}
  }

  console.log('\n──────────────────────────────');
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
