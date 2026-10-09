// Reachmark Audio — ADMIN control-room server.
// A completely separate app from web/: own process, own port (ADMIN_PORT, meant for its
// own subdomain), own design, own cookie (rm_admin), own session table. The public app
// never links here — hiding is not protection, so every route is authenticated:
//   • role admin|support only, seeded from ADMIN_EMAIL/ADMIN_PASSWORD env (never signup)
//   • mandatory TOTP 2FA (enrolled on first successful password login)
//   • HttpOnly SameSite=Strict cookie, 8h expiry, Secure behind TLS
//   • lockout after 5 failed attempts (15 min), optional ADMIN_IP_ALLOWLIST
//   • CSRF token required on every state-changing call
//   • every write lands in the audit log (who, action, target, ip, meta)
// Shares ONE SQLite database (WAL) with the public server — safe multi-process.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const { promisify } = require('util');
const store = require('../server/db');
const totp = require('../server/totp');
const tts = require('../server/tts');
const dsp = require('../server/dsp');
const engines = require('../server/engines');
const llm = require('../server/llm');
const brainS = require('../server/brain');
const mail = require('../server/mail');

const ADMIN_PORT = Number(process.env.ADMIN_PORT || 8001);
const WEB = path.join(__dirname, 'web');
const RENDER = tts.RENDER_DIR;
const SESSION_MS = 8 * 3600 * 1000;
const MAX_BODY = 28e6, MAX_UPLOAD = 20e6;
const ALLOW = (process.env.ADMIN_IP_ALLOWLIST || '').split(',').map(s => s.trim()).filter(Boolean);
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@reachmarkdigital.com';

const scryptAsync = promisify(crypto.scrypt);
const hashPass = async (pass, salt) => (await scryptAsync(pass, salt, 32, { N: 16384, r: 8, p: 1 })).toString('hex');
const sameHash = (a, b) => { const ba = Buffer.from(a, 'hex'), bb = Buffer.from(b, 'hex'); return ba.length === bb.length && crypto.timingSafeEqual(ba, bb); };
const clientIp = req => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'local';

store.db.exec('CREATE TABLE IF NOT EXISTS typing (threadId TEXT PRIMARY KEY, side TEXT, at INTEGER)');

/* ---------- first admin: seeded from env ONLY ---------- */
(function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const pass = process.env.ADMIN_PASSWORD || '';
  if (!email || !pass) return;
  const ex = store.users.byEmail(email);
  if (ex) { if (ex.role !== 'admin') { ex.role = 'admin'; store.users.save(ex); } return; }
  const salt = crypto.randomBytes(16).toString('hex');
  hashPass(pass, salt).then(h => {
    store.users.create({ id: 'a_' + crypto.randomBytes(4).toString('hex'), name: email.split('@')[0], email, salt, pass: h, credits: 0, plan: 'plus', minutes: 0, trial_used: 1, trial_ends: null, created: Date.now(), role: 'admin' });
    store.audit(email, 'admin.seed', email, 'boot', null);
    console.log('[admin] seeded first admin account:', email);
  }).catch(e => console.error('[admin] seed failed', e.message));
})();

/* ---------- http helpers ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.wav': 'audio/wav', '.json': 'application/json' };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
function send(res, code, body, headers = {}) { res.writeHead(code, headers); res.end(body); }
function json(res, code, obj, headers = {}) { send(res, code, JSON.stringify(obj), { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }); }
function wav(res, buf, extra = {}) { send(res, 200, buf, { 'Content-Type': 'audio/wav', 'Content-Length': buf.length, 'Cache-Control': 'no-store', ...extra }); }
function readBody(req, limit = MAX_BODY) {
  return new Promise((rs, rj) => {
    let n = 0; const chunks = [];
    req.on('data', c => { n += c.length; if (n > limit) { rj(Object.assign(new Error('Upload too large — 20 MB max.'), { status: 413 })); req.destroy(); } chunks.push(c); });
    req.on('end', () => rs(Buffer.concat(chunks)));
    req.on('error', rj);
  });
}
const b64ToBuf = s => Buffer.from(String(s).split(',')[1] || String(s), 'base64');
const wavSeconds = buf => { try { const sr = buf.readUInt32LE(24), ch = buf.readUInt16LE(22); return (buf.length - 44) / (sr * 2 * ch); } catch { return 0; } };
const str = (v, max) => (typeof v === 'string' && v.length <= max) ? v : (typeof v === 'string' ? v.slice(0, max) : (v == null ? null : null));
const num = (v, lo, hi, dflt) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt; };
const oneOf = (v, list, dflt) => (list.includes(v) ? v : dflt);
const FX = ['none', 'radio', 'hall', 'phone', 'warm'];
const saveRender = (buf, tag, uid) => { const f = tag + '_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex') + '.wav'; fs.writeFileSync(path.join(RENDER, f), buf); store.renders.add(f, uid); return f; };

function securityHeaders(res, req) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket?.encrypted === true;
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'microphone=(self), camera=()');
  if (secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  return secure;
}

/* ---------- auth ---------- */
function adminSession(req) {
  const m = /(?:^|;\s*)rm_admin=([a-f0-9]{64})/.exec(req.headers.cookie || '');
  if (!m) return null;
  const s = store.adminSessions.get(m[1]);
  if (!s || s.exp < Date.now()) { if (s) store.adminSessions.del(m[1]); return null; }
  const u = store.users.byId(s.uid);
  if (!u || u.suspended || (u.role !== 'admin' && u.role !== 'support')) { store.adminSessions.del(m[1]); return null; }
  return { user: u, token: m[1], csrf: s.csrf };
}
const pending = new Map(); // 2FA challenges: token -> {uid, secret?, exp}
const setCookie = (res, token, secure) => res.setHeader('Set-Cookie', token
  ? `rm_admin=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS / 1000}${secure ? '; Secure' : ''}`
  : 'rm_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
const pubAdmin = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, suspended: !!u.suspended, totp_enabled: !!u.totp_enabled, last_seen: u.last_seen || null, created: u.created });

/* ---------- dashboard stats ---------- */
async function stats() {
  const users = store.users.all();
  const now = Date.now();
  const signups = [];
  for (let d = 6; d >= 0; d--) {
    const a = new Date(now - d * 864e5); a.setUTCHours(0, 0, 0, 0);
    const b = a.getTime() + 864e5;
    signups.push({ day: a.toISOString().slice(5, 10), n: users.filter(u => u.created >= a.getTime() && u.created < b).length });
  }
  let disk = null;
  try { const s = fs.statfsSync(store.DATA_DIR); disk = { freeGB: +(s.bavail * s.bsize / 1e9).toFixed(2), totalGB: +(s.blocks * s.bsize / 1e9).toFixed(2) }; } catch {}
  let eng = null;
  try { eng = await engines.status(); } catch {}
  const led = store.ledger.sums(), led24 = store.ledger.since(now - 864e5);
  return {
    users: { total: users.length, suspended: users.filter(u => u.suspended).length, admins: users.filter(u => u.role !== 'user').length, plus: users.filter(u => u.plan === 'plus').length },
    signups, credits: { onHand: users.reduce((a, u) => a + u.credits, 0), issued: led.issued || 0, spent: led.spent || 0, issued24h: led24.issued || 0, spent24h: led24.spent || 0 },
    renders: store.renders.count(),
    minutes: +users.reduce((a, u) => a + (u.minutes || 0), 0).toFixed(1),
    piper: tts.status(), engines: eng, disk,
    llm: { configured: llm.configured(), model: llm.model() },
    supportUnread: store.support.unreadAdmin(),
    threadsOpen: store.support.threads(null).filter(t => t.status !== 'closed').length,
  };
}

/* ---------- user sample (voice clone) helper ---------- */
function samplePath(uid, id) { return path.join(store.DATA_DIR, 'u', uid, 'samples', id + '.wav'); }

const server = http.createServer(async (req, res) => {
  const secure = securityHeaders(res, req);
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;
  const ip = clientIp(req);

  if (ALLOW.length && !ALLOW.includes(ip) && p !== '/health') return json(res, 403, { error: 'Forbidden' });
  if (p === '/health') return json(res, 200, { ok: true, app: 'Reachmark Admin', version: '1.3.0' });

  try {
    /* ---------- login flow (the only unauthenticated API) ---------- */
    if (p === '/api/login' && req.method === 'POST') {
      const b = JSON.parse((await readBody(req, 1e5)).toString() || '{}');
      const email = String(b.email || '').trim().toLowerCase();
      const pass = String(b.password || '');
      const key = 'alogin:' + ip + ':' + email;
      if (!store.rateLimit(key, 10, 15 * 60 * 1000)) return json(res, 429, { error: 'Too many attempts. Try again later.' });
      const lkey = 'alock:' + ip + ':' + email;
      if (store.lockout(lkey)) return json(res, 423, { error: 'Locked after 5 failed attempts. Try again in 15 minutes.' });
      const usr = store.users.byEmail(email);
      const ok = usr && !usr.suspended && (usr.role === 'admin' || usr.role === 'support') && usr.salt && sameHash(await hashPass(pass, usr.salt), usr.pass);
      if (!ok) { store.registerFailure(lkey); store.audit(email || '?', 'admin.login.fail', email || '?', ip, null); return json(res, 401, { error: 'Incorrect email or password.' }); }
      store.clearFailures(lkey); store.clearFailures(key);
      const token = crypto.randomBytes(24).toString('hex');
      if (!usr.totp_secret) {
        const secret = totp.newSecret();
        pending.set(token, { uid: usr.id, secret, exp: Date.now() + 10 * 60 * 1000 });
        return json(res, 200, { enroll: true, token, secret, otpauth: totp.otpauthUri(secret, usr.email) });
      }
      pending.set(token, { uid: usr.id, exp: Date.now() + 10 * 60 * 1000 });
      return json(res, 200, { need2fa: true, token });
    }
    if (p === '/api/login/2fa' && req.method === 'POST') {
      const b = JSON.parse((await readBody(req, 1e5)).toString() || '{}');
      const ent = pending.get(String(b.token || ''));
      if (!ent || ent.exp < Date.now()) { pending.delete(String(b.token || '')); return json(res, 400, { error: 'Login challenge expired — start again.' }); }
      const usr = store.users.byId(ent.uid);
      if (!usr) return json(res, 400, { error: 'Login challenge expired — start again.' });
      const lkey = 'alock2:' + ip + ':' + usr.email;
      if (store.lockout(lkey)) return json(res, 423, { error: 'Too many wrong codes. Try again in 15 minutes.' });
      const secret = ent.secret || usr.totp_secret;
      if (!totp.verify(secret, String(b.code || ''))) { store.registerFailure(lkey); return json(res, 401, { error: 'Wrong 2FA code.' }); }
      pending.delete(String(b.token)); store.clearFailures(lkey);
      if (ent.secret) { usr.totp_secret = ent.secret; usr.totp_enabled = 1; store.users.save(usr); }
      const t = crypto.randomBytes(32).toString('hex');
      const csrf = crypto.randomBytes(16).toString('hex');
      store.adminSessions.add(t, usr.id, Date.now() + SESSION_MS, csrf);
      setCookie(res, t, secure);
      store.audit(usr.email, 'admin.login', usr.id, ip, { role: usr.role, first2fa: !!ent.secret });
      return json(res, 200, { ok: true, user: pubAdmin(usr), csrf }, {});
    }

    /* ---------- everything below requires a valid admin session ---------- */
    if (p.startsWith('/api/')) {
      const ses = adminSession(req);
      if (!ses) return json(res, 401, { error: 'Admin authentication required.' });
      const me = ses.user;
      const isAdmin = me.role === 'admin';
      if (req.method === 'POST') {
        if (p === '/api/logout') { store.adminSessions.del(ses.token); setCookie(res, null, secure); store.audit(me.email, 'admin.logout', me.id, ip, null); return json(res, 200, { ok: true }); }
        if (req.headers['x-csrf-token'] !== ses.csrf) return json(res, 403, { error: 'CSRF token missing or invalid.' });
      }
      const body = async limit => JSON.parse((await readBody(req, limit)).toString() || '{}');
      const log = (action, target, meta) => store.audit(me.email, action, String(target || ''), ip, meta || null);

      if (p === '/api/me' && req.method === 'GET') return json(res, 200, { user: pubAdmin(me), csrf: ses.csrf, llm: llm.configured() });
      if (p === '/api/stats' && req.method === 'GET') return json(res, 200, await stats());

      /* ---------- users ---------- */
      if (p === '/api/users' && req.method === 'GET') {
        const q = (u.searchParams.get('q') || '').toLowerCase();
        let rows = store.users.all().map(x => ({ id: x.id, name: x.name, email: x.email, plan: x.plan, credits: x.credits, minutes: Math.round((x.minutes || 0) * 10) / 10, created: x.created, last_seen: x.last_seen || null, role: x.role, suspended: !!x.suspended, status: x.suspended ? 'suspended' : (x.role !== 'user' ? x.role : 'active') }));
        if (q) rows = rows.filter(r => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
        return json(res, 200, { users: rows });
      }
      if (p === '/api/user' && req.method === 'GET') {
        const t = store.users.byId(u.searchParams.get('id') || '');
        if (!t) return json(res, 404, { error: 'User not found.' });
        return json(res, 200, {
          user: { id: t.id, name: t.name, email: t.email, plan: t.plan, credits: t.credits, minutes: Math.round((t.minutes || 0) * 10) / 10, trial_ends: t.trial_ends, created: t.created, last_seen: t.last_seen, role: t.role, suspended: !!t.suspended },
          voices: store.voices.list(t.id).map(v => ({ id: v.id, name: v.name, kind: v.kind, model: v.model, desc: v.desc, disabled: !!v.disabled, created: v.created })),
          agents: store.agents.list(t.id).map(a => ({ id: a.id, name: a.name, role: a.role, language: a.language, system: !!a.system, disabled: !!a.disabled, created: a.created })),
          history: store.history.list(t.id).slice(0, 40),
          renders: store.db.prepare('SELECT file, created FROM renders WHERE uid=? ORDER BY created DESC LIMIT 40').all(t.id),
          ledger: store.ledger.forUser(t.id),
          sessions: store.db.prepare('SELECT COUNT(*) c FROM sessions WHERE uid=?').get(t.id).c,
        });
      }
      if (p === '/api/user/credits' && req.method === 'POST') {
        if (!isAdmin) return json(res, 403, { error: 'Admin role required.' });
        const b = await body(1e5);
        const delta = Math.round(num(b.delta, -1000000, 1000000, 0));
        if (!delta) return json(res, 400, { error: 'delta is required.' });
        const t = store.users.byId(String(b.id || ''));
        if (!t) return json(res, 404, { error: 'User not found.' });
        store.adjustTx(t.id, delta);
        log('credits.adjust', t.email, { delta, reason: str(b.reason, 200) || '' });
        return json(res, 200, { ok: true, credits: store.users.byId(t.id).credits });
      }
      if (p === '/api/user/plan' && req.method === 'POST') {
        if (!isAdmin) return json(res, 403, { error: 'Admin role required.' });
        const b = await body(1e5);
        const t = store.users.byId(String(b.id || '')); if (!t) return json(res, 404, { error: 'User not found.' });
        t.plan = oneOf(String(b.plan), ['free', 'plus'], 'free');
        if (t.plan === 'free') t.trial_ends = null;
        store.users.save(t); log('plan.change', t.email, { plan: t.plan });
        return json(res, 200, { ok: true, plan: t.plan });
      }
      if (p === '/api/user/trial' && req.method === 'POST') {
        if (!isAdmin) return json(res, 403, { error: 'Admin role required.' });
        const b = await body(1e5);
        const t = store.users.byId(String(b.id || '')); if (!t) return json(res, 404, { error: 'User not found.' });
        if (b.grant) { t.plan = 'plus'; t.trial_used = 1; t.trial_ends = Date.now() + 7 * 864e5; }
        else { t.plan = 'free'; t.trial_ends = null; }
        store.users.save(t); log('trial.' + (b.grant ? 'grant' : 'end'), t.email, { trial_ends: t.trial_ends });
        return json(res, 200, { ok: true, plan: t.plan, trial_ends: t.trial_ends });
      }
      if (p === '/api/user/suspend' && req.method === 'POST') {
        if (!isAdmin) return json(res, 403, { error: 'Admin role required.' });
        const b = await body(1e5);
        const t = store.users.byId(String(b.id || '')); if (!t) return json(res, 404, { error: 'User not found.' });
        t.suspended = b.on ? 1 : 0;
        store.users.save(t);
        // suspension gates every request with 403; killing sessions is the separate
        // "force logout" action (and admin sessions die automatically via role/suspend check)
        if (t.suspended) store.adminSessions.delUser(t.id);
        log('user.' + (t.suspended ? 'suspend' : 'unsuspend'), t.email, { reason: str(b.reason, 200) || '' });
        return json(res, 200, { ok: true, suspended: !!t.suspended });
      }
      if (p === '/api/user/logout' && req.method === 'POST') {
        const b = await body(1e5);
        const t = store.users.byId(String(b.id || '')); if (!t) return json(res, 404, { error: 'User not found.' });
        store.sessions.delUser(t.id); store.adminSessions.delUser(t.id);
        log('user.forceLogout', t.email, null);
        return json(res, 200, { ok: true });
      }
      if (p === '/api/user/delete' && req.method === 'POST') {
        if (!isAdmin) return json(res, 403, { error: 'Admin role required.' });
        const b = await body(1e5);
        const t = store.users.byId(String(b.id || '')); if (!t) return json(res, 404, { error: 'User not found.' });
        if (t.id === me.id) return json(res, 400, { error: 'You cannot delete your own admin account.' });
        store.users.del(t.id); log('user.delete', t.email, { name: t.name });
        return json(res, 200, { ok: true });
      }
      /* deliberate, audited access to a user's renders / voice samples */
      if (p === '/api/sample' && req.method === 'GET') {
        if (u.searchParams.get('ack') !== '1') return json(res, 400, { error: 'Sample access must be explicitly acknowledged (ack=1).' });
        const file = path.basename(u.searchParams.get('file') || '');
        const fp = path.join(RENDER, file);
        if (!file || !store.renders.owner(file) || !fs.existsSync(fp)) return json(res, 404, { error: 'not found' });
        log('sample.access', file, { owner: store.renders.owner(file) });
        return wav(res, fs.readFileSync(fp), { 'Cache-Control': 'private, no-store' });
      }
      if (p === '/api/voicesample' && req.method === 'GET') {
        if (u.searchParams.get('ack') !== '1') return json(res, 400, { error: 'Sample access must be explicitly acknowledged (ack=1).' });
        const uid = str(u.searchParams.get('uid'), 40), id = str(u.searchParams.get('id'), 40);
        const fp = samplePath(uid, id);
        if (!uid || !id || !fs.existsSync(fp)) return json(res, 404, { error: 'not found' });
        log('sample.access', 'voice:' + id, { owner: uid });
        return wav(res, fs.readFileSync(fp), { 'Cache-Control': 'private, no-store' });
      }

      /* ---------- support inbox ---------- */
      if (p === '/api/support/threads' && req.method === 'GET') {
        const st = u.searchParams.get('status');
        const rows = store.support.threads(st && ['open', 'pending', 'closed'].includes(st) ? st : null).map(t => {
          const owner = store.users.byId(t.userId);
          const msgs = store.support.messages(t.id);
          const lastMsg = msgs[msgs.length - 1];
          return { ...t, userName: owner ? owner.name : '?', userEmail: owner ? owner.email : '?', userPlan: owner ? owner.plan : '?', preview: lastMsg ? (lastMsg.sender === 'note' ? '🔒 note' : lastMsg.text.slice(0, 70)) : '' };
        });
        return json(res, 200, { threads: rows, unread: store.support.unreadAdmin() });
      }
      if (p === '/api/support/thread' && req.method === 'GET') {
        const t = store.support.thread(u.searchParams.get('id') || '');
        if (!t) return json(res, 404, { error: 'Thread not found.' });
        const owner = store.users.byId(t.userId);
        store.support.markRead(t.id, 'admin');
        return json(res, 200, {
          thread: store.support.thread(t.id),
          user: owner ? { id: owner.id, name: owner.name, email: owner.email, plan: owner.plan, credits: owner.credits, minutes: Math.round((owner.minutes || 0) * 10) / 10, created: owner.created, last_seen: owner.last_seen, suspended: !!owner.suspended } : null,
          recent: owner ? store.history.list(owner.id).slice(0, 8) : [],
          messages: store.support.messages(t.id),
        });
      }
      if (p === '/api/support/reply' && req.method === 'POST') {
        if (!store.rateLimit('areply:' + me.id, 30, 60000)) return json(res, 429, { error: 'Slow down.' });
        const b = await body(1e5);
        const t = store.support.thread(String(b.threadId || '')); if (!t) return json(res, 404, { error: 'Thread not found.' });
        const text = String(b.text || '').trim().slice(0, 2000);
        if (!text) return json(res, 400, { error: 'Message is required.' });
        const m = store.support.addMessage(t.id, 'admin', text);
        store.support.updateThread(t.id, { lastMessageAt: m.createdAt, unreadByUser: (t.unreadByUser || 0) + 1, status: t.status === 'closed' ? 'open' : 'open', assignee: t.assignee || me.email });
        store.db.prepare('INSERT OR REPLACE INTO typing (threadId,side,at) VALUES (?,?,?)').run(t.id, 'admin', 0);
        const owner = store.users.byId(t.userId);
        const offline = !owner || !owner.last_seen || Date.now() - owner.last_seen > 2 * 60 * 1000;
        if (offline && owner && store.rateLimit('snotify:' + t.id, 1, 10 * 60 * 1000)) {
          mail.send({ to: owner.email, subject: 'Reachmark support replied to you', text: `Hi ${owner.name},\n\nOur support team replied to your conversation:\n\n"${text.slice(0, 400)}"\n\nOpen Reachmark Audio → Support → Live chat to continue.\n\n— Reachmark Audio` });
          mail.send({ to: SUPPORT_EMAIL, subject: `[offline reply] thread ${t.id}`, text: `Admin ${me.email} replied to an offline user (${owner.email}, plan ${owner.plan}).\nThread: ${t.id}\nMessage: ${text.slice(0, 400)}` });
        }
        log('support.reply', t.id, { chars: text.length, offlineNotified: offline && !!owner });
        return json(res, 200, { ok: true, message: m, thread: store.support.thread(t.id) });
      }
      if (p === '/api/support/note' && req.method === 'POST') {
        const b = await body(1e5);
        const t = store.support.thread(String(b.threadId || '')); if (!t) return json(res, 404, { error: 'Thread not found.' });
        const text = String(b.text || '').trim().slice(0, 2000);
        if (!text) return json(res, 400, { error: 'Note is required.' });
        const m = store.support.addMessage(t.id, 'note', text);
        log('support.note', t.id, { chars: text.length });
        return json(res, 200, { ok: true, message: m });
      }
      if (p === '/api/support/assign' && req.method === 'POST') {
        const b = await body(1e5);
        const t = store.support.thread(String(b.threadId || '')); if (!t) return json(res, 404, { error: 'Thread not found.' });
        store.support.updateThread(t.id, { assignee: b.me ? me.email : (str(b.assignee, 120) || null) });
        log('support.assign', t.id, { assignee: b.me ? me.email : (str(b.assignee, 120) || null) });
        return json(res, 200, { ok: true, thread: store.support.thread(t.id) });
      }
      if (p === '/api/support/status' && req.method === 'POST') {
        const b = await body(1e5);
        const t = store.support.thread(String(b.threadId || '')); if (!t) return json(res, 404, { error: 'Thread not found.' });
        const st = oneOf(String(b.status), ['open', 'pending', 'closed'], 'open');
        store.support.updateThread(t.id, { status: st });
        log('support.status', t.id, { status: st });
        return json(res, 200, { ok: true, thread: store.support.thread(t.id) });
      }
      if (p === '/api/support/typing' && req.method === 'POST') {
        const b = await body(1e5);
        store.db.prepare('INSERT OR REPLACE INTO typing (threadId,side,at) VALUES (?,?,?)').run(String(b.threadId || ''), 'admin', Date.now());
        return json(res, 200, { ok: true });
      }
      if (p === '/api/support/stream') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        res.write('retry: 3000\n\n');
        let last = Date.now() - 500;
        const qNew = store.db.prepare("SELECT m.*, t.userId, t.status AS tstatus, t.subject FROM support_messages m JOIN support_threads t ON t.id = m.threadId WHERE m.createdAt > ? AND m.sender IN ('user','bot') ORDER BY m.createdAt ASC LIMIT 50");
        const qTyp = store.db.prepare("SELECT threadId, at FROM typing WHERE side='user' AND at > ?");
        const iv = setInterval(() => {
          try {
            const msgs = qNew.all(last);
            for (const m of msgs) {
              const owner = store.users.byId(m.userId);
              res.write('event: message\ndata: ' + JSON.stringify({ id: m.id, threadId: m.threadId, sender: m.sender, text: m.text, createdAt: m.createdAt, subject: m.subject, userName: owner ? owner.name : '?', userEmail: owner ? owner.email : '?' }) + '\n\n');
            }
            if (msgs.length) last = msgs[msgs.length - 1].createdAt;
            const typ = qTyp.all(Date.now() - 4000);
            for (const t of typ) res.write('event: typing\ndata: ' + JSON.stringify({ threadId: t.threadId }) + '\n\n');
            res.write('event: unread\ndata: ' + JSON.stringify({ unread: store.support.unreadAdmin() }) + '\n\n');
            res.write(': ping\n\n');
          } catch {}
        }, 800);
        req.on('close', () => clearInterval(iv));
        return;
      }

      /* ---------- site control ---------- */
      if (p === '/api/config' && req.method === 'GET') {
        if (!isAdmin) return json(res, 403, { error: 'Admin role required.' });
        return json(res, 200, { config: store.config.all(), costs: store.config.costs(), flags: store.config.flags() });
      }
      if (p === '/api/config' && req.method === 'POST') {
        if (!isAdmin) return json(res, 403, { error: 'Admin role required.' });
        const b = await body(1e5);
        const key = String(b.key || '');
        const WHITELIST = ['maintenance', 'announcement', 'signup_on', 'costs', 'signup_credits', 'default_voice', 'flags'];
        if (!WHITELIST.includes(key)) return json(res, 400, { error: 'Unknown config key.' });
        let value = String(b.value ?? '');
        if (key === 'costs' || key === 'flags') { try { JSON.parse(value); } catch { return json(res, 400, { error: 'Must be valid JSON.' }); } }
        if (key === 'signup_credits' && !(Number(value) >= 0 && Number(value) <= 10000000)) return json(res, 400, { error: 'signup_credits out of range.' });
        if (key === 'maintenance' || key === 'signup_on') value = value === '1' ? '1' : '0';
        store.config.set(key, value);
        log('config.set', key, { value: value.slice(0, 500) });
        return json(res, 200, { ok: true, config: store.config.all() });
      }

      /* ---------- agents & voices (any user) ---------- */
      if (p === '/api/docs' && req.method === 'GET') {
        const type = u.searchParams.get('type') === 'agents' ? 'agents' : 'voices';
        const q = (u.searchParams.get('q') || '').toLowerCase();
        let rows = store[type].listAll().map(d => { const owner = store.users.byId(d.uid); return { ...d, userName: owner ? owner.name : '?', userEmail: owner ? owner.email : '?' }; });
        if (q) rows = rows.filter(r => (r.name || '').toLowerCase().includes(q) || (r.userEmail || '').toLowerCase().includes(q));
        return json(res, 200, { type, docs: rows });
      }
      if (p === '/api/docs/disable' && req.method === 'POST') {
        if (!isAdmin) return json(res, 403, { error: 'Admin role required.' });
        const b = await body(1e5);
        const type = b.type === 'agents' ? 'agents' : 'voices';
        const doc = store[type].getAny(String(b.id || ''));
        if (!doc) return json(res, 404, { error: 'Not found.' });
        doc.disabled = b.on ? 1 : 0;
        store[type].add(doc.uid, doc);
        log(type + '.disable', doc.uid + ':' + doc.id, { name: doc.name, on: !!b.on });
        return json(res, 200, { ok: true });
      }

      /* ---------- audit log ---------- */
      if (p === '/api/audit' && req.method === 'GET') {
        if (!isAdmin) return json(res, 403, { error: 'Admin role required.' });
        const rows = store.auditList({ limit: Math.min(500, Number(u.searchParams.get('limit')) || 200), action: u.searchParams.get('action') || null, actor: u.searchParams.get('actor') || null });
        return json(res, 200, { rows });
      }

      /* ---------- admin accounts ---------- */
      if (p === '/api/admins' && req.method === 'GET') {
        if (!isAdmin) return json(res, 403, { error: 'Admin role required.' });
        return json(res, 200, { admins: store.users.all().filter(x => x.role !== 'user').map(x => { const t = store.users.byId(x.id); return pubAdmin(t); }) });
      }
      if (p === '/api/admins/create' && req.method === 'POST') {
        if (!isAdmin) return json(res, 403, { error: 'Admin role required.' });
        const b = await body(1e5);
        const email = String(b.email || '').trim().toLowerCase();
        const role = oneOf(String(b.role), ['admin', 'support'], 'support');
        const pass = String(b.password || '');
        const name = str(b.name, 60) || email.split('@')[0];
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { error: 'Valid email required.' });
        if (pass.length < 8) return json(res, 400, { error: 'Password must be at least 8 characters.' });
        if (store.users.byEmail(email)) return json(res, 409, { error: 'An account with that email already exists.' });
        const salt = crypto.randomBytes(16).toString('hex');
        const nu = store.users.create({ id: 'a_' + crypto.randomBytes(4).toString('hex'), name, email, salt, pass: await hashPass(pass, salt), credits: 0, plan: 'plus', minutes: 0, trial_used: 1, trial_ends: null, created: Date.now(), role });
        log('admin.create', email, { role });
        return json(res, 200, { ok: true, admin: pubAdmin(nu) });
      }
      if (p === '/api/admins/disable' && req.method === 'POST') {
        if (!isAdmin) return json(res, 403, { error: 'Admin role required.' });
        const b = await body(1e5);
        const t = store.users.byId(String(b.id || ''));
        if (!t || t.role === 'user') return json(res, 404, { error: 'Admin account not found.' });
        if (t.id === me.id) return json(res, 400, { error: 'You cannot disable your own account.' });
        t.suspended = b.on ? 1 : 0;
        store.users.save(t);
        if (t.suspended) store.adminSessions.delUser(t.id);
        log('admin.' + (t.suspended ? 'disable' : 'enable'), t.email, null);
        return json(res, 200, { ok: true });
      }

      /* ---------- studio workspace (admin account, ZERO credit charges) ---------- */
      if (p === '/api/studio/status' && req.method === 'GET') {
        let eng = null; try { eng = await engines.status(); } catch {}
        return json(res, 200, { piper: tts.status(), engines: eng, catalog: tts.catalog().map(v => ({ id: v.id, label: v.label, gender: v.gender, lang: v.lang })), llm: llm.configured() });
      }
      if (p === '/api/studio/voices' && req.method === 'GET') return json(res, 200, { voices: store.voices.list(me.id) });
      if (p === '/api/studio/agents' && req.method === 'GET') return json(res, 200, { agents: store.agents.list(me.id) });
      if (p === '/api/studio/tts' && req.method === 'POST') {
        const b = await body(2e6);
        const text = str(b.text, 5000);
        if (!text || !text.trim()) return json(res, 400, { error: 'Text is required.' });
        let opts = { text: text.trim(), model: str(b.model, 60) || null, semitones: num(b.semitones, -24, 24, 0), rate: num(b.rate, 0.5, 2, 1), fx: oneOf(str(b.fx, 10), FX, 'none') };
        if (b.voiceId) {
          const v = store.voices.get(me.id, str(b.voiceId, 40));
          if (v) opts = { ...opts, model: v.model ?? opts.model, semitones: opts.semitones || v.semitones, rate: b.rate ? opts.rate : (v.rate || 1), fx: opts.fx === 'none' ? v.fx : opts.fx };
        }
        try {
          const buf = await tts.synthesize(opts, me.id);
          const file = saveRender(buf, 'adm_tts', me.id);
          log('studio.tts', file, { chars: text.length });
          return send(res, 200, buf, { 'Content-Type': 'audio/wav', 'X-Reachmark-File': file, 'Cache-Control': 'no-store' });
        } catch (e) { return json(res, e.code === 429 ? 429 : (e.status || 502), { error: e.message }); }
      }
      if (p === '/api/studio/voice-change' && req.method === 'POST') {
        const b = await body(MAX_BODY);
        try {
          const raw = b64ToBuf(b.audio);
          if (raw.length > MAX_UPLOAD) throw Object.assign(new Error('Upload too large — 20 MB max.'), { status: 413 });
          const audio = dsp.decodeWav(raw);
          let chans = audio.channels;
          const st = num(b.semitones, -24, 24, 0), rate = num(b.rate, 0.5, 2, 1), fx = oneOf(str(b.fx, 10), FX, 'none');
          if (st) chans = chans.map(c => dsp.pitchShift(c, audio.sampleRate, st));
          if (rate !== 1) chans = chans.map(c => dsp.rateChange(c, audio.sampleRate, rate));
          if (fx !== 'none') chans = chans.map(c => dsp.applyFx(c, audio.sampleRate, fx));
          const buf = dsp.encodeWav(chans, audio.sampleRate);
          const file = saveRender(buf, 'adm_vc', me.id);
          log('studio.voiceChange', file, null);
          return send(res, 200, buf, { 'Content-Type': 'audio/wav', 'X-Reachmark-File': file, 'Cache-Control': 'no-store' });
        } catch (e) { return json(res, e.status || 502, { error: e.message }); }
      }
      if (p === '/api/studio/separate' && req.method === 'POST') {
        const b = await body(MAX_BODY);
        try {
          const raw = b64ToBuf(b.audio);
          if (raw.length > MAX_UPLOAD) throw Object.assign(new Error('Upload too large — 20 MB max.'), { status: 413 });
          const sep = dsp.separate(dsp.decodeWav(raw));
          if (!sep) throw Object.assign(new Error('Stereo audio is required for Quick Vocal Remove.'), { status: 422 });
          const vocals = saveRender(dsp.encodeWav([sep.vocals], sep.sr), 'adm_sepv', me.id);
          const inst = saveRender(dsp.encodeWav([sep.inst], sep.sr), 'adm_sepi', me.id);
          log('studio.separate', vocals, null);
          return json(res, 200, { vocals, instrumental: inst });
        } catch (e) { return json(res, e.status || 502, { error: e.message }); }
      }
      if (p === '/api/studio/match' && req.method === 'POST') {
        const b = await body(MAX_BODY);
        try {
          const raw = b64ToBuf(b.sample);
          if (raw.length > MAX_UPLOAD) throw Object.assign(new Error('Upload too large — 20 MB max.'), { status: 413 });
          const audio = dsp.decodeWav(raw);
          const secs = audio.channels[0].length / audio.sampleRate;
          if (secs < 2) throw Object.assign(new Error('Sample too short — at least 2 seconds.'), { status: 422 });
          const mono = audio.channels.length > 1 ? audio.channels[0].map((v, i) => (v + audio.channels[1][i]) / 2) : audio.channels[0];
          const f0 = dsp.estimateF0(mono, audio.sampleRate);
          const rate = dsp.speechRate(mono, audio.sampleRate);
          const female = f0 > 165;
          const cats = tts.catalog();
          const model = (female ? cats.find(v => v.gender === 'female') : cats.find(v => v.gender === 'male')) || cats[0];
          const semitones = model && f0 ? Math.max(-12, Math.min(12, Math.round(12 * Math.log2(f0 / model.baseF0)))) : 0;
          const id = 'v_' + crypto.randomBytes(4).toString('hex');
          const dir = path.join(store.DATA_DIR, 'u', me.id, 'samples');
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, id + '.wav'), raw);
          const profile = { id, name: str(b.name, 60) || 'Matched voice', kind: 'clone', note: str(b.note, 200) || '', desc: 'Matched · F0 ' + Math.round(f0) + ' Hz · ' + (female ? 'female' : 'male') + ' range', model: model ? model.id : null, semitones, rate: +Math.max(0.85, Math.min(1.2, rate / 3.2 || 1)).toFixed(2), fx: 'none', f0: Math.round(f0), created: Date.now(), sample: '/api/studio/voicesample/' + id };
          store.voices.add(me.id, profile);
          log('studio.match', id, { f0: Math.round(f0) });
          return json(res, 200, { voice: profile });
        } catch (e) { return json(res, e.status || 502, { error: e.message }); }
      }
      if (p.startsWith('/api/studio/voicesample/')) {
        const id = path.basename(p);
        const fp = samplePath(me.id, id.replace(/\.wav$/, ''));
        if (fs.existsSync(fp)) return wav(res, fs.readFileSync(fp));
        return json(res, 404, { error: 'not found' });
      }
      if (p === '/api/studio/chat' && req.method === 'POST') {
        const b = await body(1e6);
        const agent = store.agents.get(me.id, str(b.agentId, 40));
        if (!agent) return json(res, 404, { error: 'Agent not found in admin workspace.' });
        const message = String(b.message || '').trim().slice(0, 2000);
        if (!message) return json(res, 400, { error: 'Message is required.' });
        const history = Array.isArray(b.history) ? b.history.slice(-12).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content || '').slice(0, 1500) })).filter(m => m.content) : [];
        let out = null;
        try { out = await llm.chat({ agent, history, message }); } catch {}
        if (!out) out = { content: brainS.respond(agent, message), source: 'local' };
        log('studio.chat', agent.id, { chars: message.length });
        return json(res, 200, out);
      }
      if (p === '/api/studio/save' && req.method === 'POST') {
        const b = await body(1e6);
        const type = b.type === 'agents' ? 'agents' : 'voices';
        const doc = b.doc;
        if (!doc || typeof doc !== 'object' || !str(doc.id, 40)) return json(res, 400, { error: 'doc with id required.' });
        doc.uid = undefined; doc.created = doc.created || Date.now();
        store[type].add(me.id, doc);
        log('studio.save', type + ':' + doc.id, { name: doc.name || '' });
        return json(res, 200, { ok: true });
      }
      if (p.startsWith('/api/studio/render/')) {
        const file = path.basename(p);
        if (store.renders.owner(file) !== me.id) return json(res, 404, { error: 'not found' });
        const fp = path.join(RENDER, file);
        if (fs.existsSync(fp)) return wav(res, fs.readFileSync(fp), { 'Cache-Control': 'private, max-age=3600' });
        return json(res, 404, { error: 'not found' });
      }

      return json(res, 404, { error: 'not found' });
    }

    /* ---------- static admin web app (own design, never referenced from web/) ---------- */
    if (req.method === 'GET') {
      let rel = decodeURIComponent(p).replace(/^\/+/, '');
      let fp = path.join(WEB, rel);
      if (!fp.startsWith(WEB) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) fp = path.join(WEB, 'index.html');
      const ext = path.extname(fp).toLowerCase();
      return send(res, 200, fs.readFileSync(fp), { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=300' });
    }
    return json(res, 405, { error: 'method not allowed' });
  } catch (e) {
    return json(res, e.status || 500, { error: e.status ? e.message : 'Internal error.' });
  }
});

setInterval(() => { store.adminSessions.purge(); store.sessions.purge(); for (const [k, v] of pending) if (v.exp < Date.now()) pending.delete(k); }, 3600 * 1000).unref();
server.listen(ADMIN_PORT, '0.0.0.0', () => console.log(`Reachmark Admin control room on http://0.0.0.0:${ADMIN_PORT} (ADMIN_PORT)`));
