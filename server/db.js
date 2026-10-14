// Reachmark Audio — SQLite storage layer (better-sqlite3)
// v1.3: roles + suspension, TOTP secrets, admin sessions, audit log, support threads &
// messages, site config. Atomic credit transactions, render ownership, rate limits.
'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'reachmark.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  salt TEXT NOT NULL, pass TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 0, plan TEXT NOT NULL DEFAULT 'free',
  minutes REAL NOT NULL DEFAULT 0, trial_used INTEGER NOT NULL DEFAULT 0,
  trial_ends INTEGER, created INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', suspended INTEGER NOT NULL DEFAULT 0,
  last_seen INTEGER, totp_secret TEXT, totp_enabled INTEGER NOT NULL DEFAULT 0,
  email_verified INTEGER NOT NULL DEFAULT 0, verify_token TEXT, verify_code TEXT, verify_exp INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, uid TEXT NOT NULL, exp INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS admin_sessions (token TEXT PRIMARY KEY, uid TEXT NOT NULL, exp INTEGER NOT NULL, csrf TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS voices (id TEXT PRIMARY KEY, uid TEXT NOT NULL, data TEXT NOT NULL, created INTEGER);
CREATE TABLE IF NOT EXISTS agents (id TEXT PRIMARY KEY, uid TEXT NOT NULL, data TEXT NOT NULL, created INTEGER);
CREATE TABLE IF NOT EXISTS history (id TEXT PRIMARY KEY, uid TEXT NOT NULL, at INTEGER NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS renders (file TEXT PRIMARY KEY, uid TEXT NOT NULL, created INTEGER);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, ip TEXT, meta TEXT);
CREATE TABLE IF NOT EXISTS support_threads (
  id TEXT PRIMARY KEY, userId TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
  assignee TEXT, subject TEXT, lastMessageAt INTEGER NOT NULL,
  unreadByAdmin INTEGER NOT NULL DEFAULT 0, unreadByUser INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY, threadId TEXT NOT NULL, sender TEXT NOT NULL, text TEXT NOT NULL,
  createdAt INTEGER NOT NULL, readAt INTEGER
);
CREATE TABLE IF NOT EXISTS site_config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT NOT NULL, at INTEGER NOT NULL, delta INTEGER NOT NULL, kind TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_ledger_at ON ledger(at);
CREATE TABLE IF NOT EXISTS password_resets (token TEXT PRIMARY KEY, uid TEXT NOT NULL, exp INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_voices_uid ON voices(uid);
CREATE INDEX IF NOT EXISTS idx_agents_uid ON agents(uid);
CREATE INDEX IF NOT EXISTS idx_history_uid ON history(uid, at);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit(at);
CREATE INDEX IF NOT EXISTS idx_thr_user ON support_threads(userId, lastMessageAt);
CREATE INDEX IF NOT EXISTS idx_msg_thread ON support_messages(threadId, createdAt);
`);
// v1.2 databases migration
for (const [col, ddl] of [
  ['role', "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'"],
  ['suspended', 'ALTER TABLE users ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0'],
  ['last_seen', 'ALTER TABLE users ADD COLUMN last_seen INTEGER'],
  ['totp_secret', 'ALTER TABLE users ADD COLUMN totp_secret TEXT'],
  ['totp_enabled', 'ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0'],
  ['email_verified', 'ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0'],
  ['verify_token', 'ALTER TABLE users ADD COLUMN verify_token TEXT'],
  ['verify_code', 'ALTER TABLE users ADD COLUMN verify_code TEXT'],
  ['verify_exp', 'ALTER TABLE users ADD COLUMN verify_exp INTEGER'],
]) { try { if (!db.prepare('SELECT ' + col + ' FROM users LIMIT 1').get()) {} } catch { try { db.exec(ddl); } catch {} } }

/* ---------- users ---------- */
const qUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const qUserByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const qUserInsert = db.prepare(`INSERT INTO users (id,name,email,salt,pass,credits,plan,minutes,trial_used,trial_ends,created,role,suspended,last_seen,totp_secret,totp_enabled,email_verified,verify_token,verify_code,verify_exp)
  VALUES (@id,@name,@email,@salt,@pass,@credits,@plan,@minutes,@trial_used,@trial_ends,@created,@role,@suspended,@last_seen,@totp_secret,@totp_enabled,@email_verified,@verify_token,@verify_code,@verify_exp)`);
const qUserSave = db.prepare(`UPDATE users SET name=@name, email=@email, salt=@salt, pass=@pass, credits=@credits, plan=@plan, minutes=@minutes,
  trial_used=@trial_used, trial_ends=@trial_ends, role=@role, suspended=@suspended, last_seen=@last_seen,
  totp_secret=@totp_secret, totp_enabled=@totp_enabled, email_verified=@email_verified, verify_token=@verify_token,
  verify_code=@verify_code, verify_exp=@verify_exp WHERE id=@id`);
const users = {
  byId: id => qUserById.get(id) || null,
  byEmail: email => qUserByEmail.get(email) || null,
  create: u => { qUserInsert.run({ role: 'user', suspended: 0, last_seen: null, totp_secret: null, totp_enabled: 0, email_verified: 0, verify_token: null, verify_code: null, verify_exp: null, ...u }); return qUserById.get(u.id); },
  save: u => { qUserSave.run(u); return qUserById.get(u.id); },
  all: () => db.prepare('SELECT id,name,email,credits,plan,minutes,trial_used,trial_ends,created,role,suspended,last_seen FROM users ORDER BY created DESC').all(),
  del: id => db.transaction(uid => {
    db.prepare('DELETE FROM users WHERE id=?').run(uid);
    db.prepare('DELETE FROM sessions WHERE uid=?').run(uid);
    db.prepare('DELETE FROM admin_sessions WHERE uid=?').run(uid);
    db.prepare('DELETE FROM voices WHERE uid=?').run(uid);
    db.prepare('DELETE FROM agents WHERE uid=?').run(uid);
    db.prepare('DELETE FROM agent_channels WHERE uid=?').run(uid);
    db.prepare('DELETE FROM channel_conversations WHERE uid=?').run(uid);
    db.prepare('DELETE FROM history WHERE uid=?').run(uid);
    db.prepare('DELETE FROM renders WHERE uid=?').run(uid);
    db.prepare('DELETE FROM ledger WHERE uid=?').run(uid);
    db.prepare('DELETE FROM support_messages WHERE threadId IN (SELECT id FROM support_threads WHERE userId=?)').run(uid);
    db.prepare('DELETE FROM support_threads WHERE userId=?').run(uid);
  })(id),
};
function enforceTrial(u) {
  if (u.plan === 'plus' && u.trial_ends && u.trial_ends < Date.now()) { u.plan = 'free'; u.trial_ends = null; users.save(u); }
  return u;
}

/* ---------- atomic credits (every movement hits the ledger for admin stats) ---------- */
const led = (uid, delta, kind) => { try { db.prepare('INSERT INTO ledger (uid,at,delta,kind) VALUES (?,?,?,?)').run(uid, Date.now(), delta, kind); } catch {} };
const chargeTx = db.transaction((uid, cost) => { const ok = db.prepare('UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?').run(cost, uid, cost).changes === 1; if (ok) led(uid, -cost, 'charge'); return ok; });
const refundTx = db.transaction((uid, cost) => { const ok = db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(cost, uid).changes === 1; if (ok) led(uid, cost, 'refund'); return ok; });
const adjustTx = db.transaction((uid, delta) => { const ok = db.prepare('UPDATE users SET credits = MAX(0, credits + ?) WHERE id = ?').run(delta, uid).changes === 1; if (ok) led(uid, delta, 'adjust'); return ok; });
const ledger = {
  sums: () => db.prepare('SELECT SUM(CASE WHEN delta>0 THEN delta ELSE 0 END) issued, SUM(CASE WHEN delta<0 THEN -delta ELSE 0 END) spent FROM ledger').get() || { issued: 0, spent: 0 },
  forUser: uid => db.prepare('SELECT at,delta,kind FROM ledger WHERE uid=? ORDER BY at DESC LIMIT 50').all(uid),
  since: t => db.prepare('SELECT SUM(CASE WHEN delta>0 THEN delta ELSE 0 END) issued, SUM(CASE WHEN delta<0 THEN -delta ELSE 0 END) spent FROM ledger WHERE at >= ?').get(t) || { issued: 0, spent: 0 },
};
const addMinutesTx = db.transaction((uid, secs) => db.prepare('UPDATE users SET minutes = minutes + ? WHERE id = ?').run(secs / 60, uid));

/* ---------- sessions ---------- */
const sessions = {
  get: t => db.prepare('SELECT * FROM sessions WHERE token = ?').get(t) || null,
  add: (t, uid, exp) => db.prepare('INSERT OR REPLACE INTO sessions (token,uid,exp) VALUES (?,?,?)').run(t, uid, exp),
  del: t => db.prepare('DELETE FROM sessions WHERE token = ?').run(t),
  delUser: uid => db.prepare('DELETE FROM sessions WHERE uid = ?').run(uid),
  purge: () => db.prepare('DELETE FROM sessions WHERE exp < ?').run(Date.now()),
};
const adminSessions = {
  get: t => db.prepare('SELECT * FROM admin_sessions WHERE token = ?').get(t) || null,
  add: (t, uid, exp, csrf) => db.prepare('INSERT OR REPLACE INTO admin_sessions (token,uid,exp,csrf) VALUES (?,?,?,?)').run(t, uid, exp, csrf),
  del: t => db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(t),
  delUser: uid => db.prepare('DELETE FROM admin_sessions WHERE uid = ?').run(uid),
  purge: () => db.prepare('DELETE FROM admin_sessions WHERE exp < ?').run(Date.now()),
};

/* ---------- rate limits & lockout ---------- */
function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const row = db.prepare('SELECT * FROM rate_limits WHERE key = ?').get(key);
  if (!row || row.reset_at < now) { db.prepare('INSERT OR REPLACE INTO rate_limits (key,count,reset_at) VALUES (?,?,?)').run(key, 1, now + windowMs); return true; }
  if (row.count >= limit) return false;
  db.prepare('INSERT OR REPLACE INTO rate_limits (key,count,reset_at) VALUES (?,?,?)').run(key, row.count + 1, row.reset_at);
  return true;
}
function lockout(key, fails = 5, ms = 15 * 60 * 1000) {
  const row = db.prepare('SELECT * FROM rate_limits WHERE key = ?').get(key);
  if (row && row.reset_at > Date.now() && row.count >= fails) return true;
  return false;
}
function registerFailure(key, fails = 5, ms = 15 * 60 * 1000) {
  const now = Date.now();
  const row = db.prepare('SELECT * FROM rate_limits WHERE key = ?').get(key);
  if (!row || row.reset_at < now) db.prepare('INSERT OR REPLACE INTO rate_limits (key,count,reset_at) VALUES (?,?,?)').run(key, 1, now + ms);
  else db.prepare('INSERT OR REPLACE INTO rate_limits (key,count,reset_at) VALUES (?,?,?)').run(key, row.count + 1, row.reset_at);
}
function clearFailures(key) { db.prepare('DELETE FROM rate_limits WHERE key = ?').run(key); }

/* ---------- per-user docs ---------- */
function docTable(table) {
  return {
    list: uid => db.prepare(`SELECT data FROM ${table} WHERE uid = ? ORDER BY created ASC`).all(uid).map(r => JSON.parse(r.data)),
    listAll: () => db.prepare(`SELECT uid, data FROM ${table} ORDER BY created DESC`).all().map(r => ({ uid: r.uid, ...JSON.parse(r.data) })),
    get: (uid, id) => { const r = db.prepare(`SELECT data FROM ${table} WHERE uid = ? AND id = ?`).get(uid, id); return r ? JSON.parse(r.data) : null; },
    getAny: id => { const r = db.prepare(`SELECT uid, data FROM ${table} WHERE id = ?`).get(id); return r ? { uid: r.uid, ...JSON.parse(r.data) } : null; },
    add: (uid, doc) => { db.prepare(`INSERT OR REPLACE INTO ${table} (id,uid,data,created) VALUES (?,?,?,?)`).run(doc.id, uid, JSON.stringify(doc), doc.created || Date.now()); return doc; },
    del: (uid, id) => db.prepare(`DELETE FROM ${table} WHERE uid = ? AND id = ?`).run(uid, id).changes === 1,
  };
}
const voices = docTable('voices');
const agents = docTable('agents');
const history = {
  list: uid => db.prepare('SELECT data FROM history WHERE uid = ? ORDER BY at DESC LIMIT 80').all(uid).map(r => JSON.parse(r.data)),
  add: (uid, item) => { db.prepare('INSERT OR REPLACE INTO history (id,uid,at,data) VALUES (?,?,?,?)').run(item.id, uid, item.at, JSON.stringify(item)); return item; },
  del: (uid, id) => db.prepare('DELETE FROM history WHERE uid = ? AND id = ?').run(uid, id).changes === 1,
};
const renders = {
  add: (file, uid) => db.prepare('INSERT OR REPLACE INTO renders (file,uid,created) VALUES (?,?,?)').run(file, uid, Date.now()),
  owner: file => { const r = db.prepare('SELECT uid FROM renders WHERE file = ?').get(file); return r ? r.uid : null; },
  count: () => db.prepare('SELECT COUNT(*) c FROM renders').get().c,
};

/* ---------- audit ---------- */
const audit = (actor, action, target, ip, meta) =>
  db.prepare('INSERT INTO audit (at,actor,action,target,ip,meta) VALUES (?,?,?,?,?,?)').run(Date.now(), actor, action, target, ip || '', meta ? JSON.stringify(meta) : '');
const auditList = ({ limit = 200, action, actor } = {}) =>
  db.prepare('SELECT * FROM audit WHERE (? IS NULL OR action = ?) AND (? IS NULL OR actor = ?) ORDER BY at DESC LIMIT ?').all(action || null, action || null, actor || null, actor || null, limit);

/* ---------- support ---------- */
const support = {
  threadForUser: uid => db.prepare("SELECT * FROM support_threads WHERE userId = ? AND status != 'closed' ORDER BY lastMessageAt DESC LIMIT 1").get(uid) || null,
  thread: id => db.prepare('SELECT * FROM support_threads WHERE id = ?').get(id) || null,
  createThread: (uid, subject) => { const t = { id: 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), userId: uid, status: 'open', assignee: null, subject: subject || '', lastMessageAt: Date.now(), unreadByAdmin: 0, unreadByUser: 0, created: Date.now() }; db.prepare('INSERT INTO support_threads (id,userId,status,assignee,subject,lastMessageAt,unreadByAdmin,unreadByUser,created) VALUES (@id,@userId,@status,@assignee,@subject,@lastMessageAt,@unreadByAdmin,@unreadByUser,@created)').run(t); return t; },
  updateThread: (id, patch) => { const t = support.thread(id); if (!t) return null; Object.assign(t, patch); db.prepare('UPDATE support_threads SET status=@status, assignee=@assignee, subject=@subject, lastMessageAt=@lastMessageAt, unreadByAdmin=@unreadByAdmin, unreadByUser=@unreadByUser WHERE id=@id').run(t); return t; },
  threads: (status) => db.prepare("SELECT * FROM support_threads WHERE (? IS NULL OR status = ?) ORDER BY lastMessageAt DESC").all(status || null, status || null),
  messages: threadId => db.prepare('SELECT * FROM support_messages WHERE threadId = ? ORDER BY createdAt ASC').all(threadId),
  addMessage: (threadId, sender, text) => { const m = { id: 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), threadId, sender, text: String(text).slice(0, 2000), createdAt: Date.now(), readAt: null }; db.prepare('INSERT INTO support_messages (id,threadId,sender,text,createdAt,readAt) VALUES (@id,@threadId,@sender,@text,@createdAt,@readAt)').run(m); return m; },
  markRead: (threadId, by) => { const now = Date.now(); db.prepare('UPDATE support_messages SET readAt = ? WHERE threadId = ? AND readAt IS NULL AND sender != ?').run(now, threadId, by); const t = support.thread(threadId); if (t) support.updateThread(threadId, by === 'admin' ? { unreadByAdmin: 0 } : { unreadByUser: 0 }); },
  unreadAdmin: () => db.prepare('SELECT SUM(unreadByAdmin) c FROM support_threads WHERE status != \'closed\'').get().c || 0,
};

/* ---------- plus upgrade requests (staff-approved only) ---------- */
db.exec('CREATE TABLE IF NOT EXISTS upgrade_requests (uid TEXT PRIMARY KEY, method TEXT NOT NULL, note TEXT, at INTEGER NOT NULL)');
const upgradeReq = {
  get: uid => { const r = db.prepare('SELECT * FROM upgrade_requests WHERE uid = ?').get(uid); return r ? { ...r, status: 'pending' } : null; },
  set: (uid, r) => { db.prepare('INSERT OR REPLACE INTO upgrade_requests (uid,method,note,at) VALUES (?,?,?,?)').run(uid, r.method, String(r.note || '').slice(0, 300), r.at || Date.now()); return upgradeReq.get(uid); },
  del: uid => db.prepare('DELETE FROM upgrade_requests WHERE uid = ?').run(uid),
  list: () => db.prepare('SELECT * FROM upgrade_requests ORDER BY at ASC').all().map(r => ({ ...r, status: 'pending' })),
};

/* ---------- push subscriptions ---------- */
db.exec('CREATE TABLE IF NOT EXISTS push_subscriptions (endpoint TEXT PRIMARY KEY, uid TEXT, keys TEXT NOT NULL, created INTEGER)');
const pushSubs = {
  all: () => db.prepare('SELECT * FROM push_subscriptions').all(),
  forUser: uid => db.prepare('SELECT * FROM push_subscriptions WHERE uid = ?').all(uid),
  add: (endpoint, uid, keys) => db.prepare('INSERT OR REPLACE INTO push_subscriptions (endpoint,uid,keys,created) VALUES (?,?,?,?)').run(endpoint, uid || null, JSON.stringify(keys || {}), Date.now()),
  del: endpoint => db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint),
  count: () => db.prepare('SELECT COUNT(*) c FROM push_subscriptions').get().c,
};

/* ---------- site config ---------- */
const DEFAULT_CONFIG = {
  maintenance: '0', announcement: '', signup_on: '1', require_verified: '0',
  costs: JSON.stringify({ ttsPer40: 1, ttsMin: 5, vc: 20, match: 150, separate: 30, dub: 15, chat: 2, design: 25, designSave: 50 }),
  signup_credits: '10000', default_voice: '',
  flags: JSON.stringify({ tts: 1, changer: 1, match: 1, design: 1, dub: 1, lip: 1, sep: 1, agents: 1, support: 1 }),
};
const config = {
  get(key) { const r = db.prepare('SELECT value FROM site_config WHERE key = ?').get(key); return r ? r.value : (DEFAULT_CONFIG[key] ?? ''); },
  set(key, value) { db.prepare('INSERT OR REPLACE INTO site_config (key,value) VALUES (?,?)').run(key, String(value)); },
  all() { const o = { ...DEFAULT_CONFIG }; for (const r of db.prepare('SELECT key,value FROM site_config').all()) o[r.key] = r.value; return o; },
  costs() { try { return { ...JSON.parse(DEFAULT_CONFIG.costs), ...JSON.parse(config.get('costs')) }; } catch { return JSON.parse(DEFAULT_CONFIG.costs); } },
  flags() { try { return JSON.parse(config.get('flags')); } catch { return JSON.parse(DEFAULT_CONFIG.flags); } },
};



/* ---------- encrypted messaging integrations + persistent per-contact context ---------- */
db.exec(`
CREATE TABLE IF NOT EXISTS agent_channels (
  uid TEXT NOT NULL, agentId TEXT NOT NULL, provider TEXT NOT NULL, data TEXT NOT NULL, updated INTEGER NOT NULL,
  PRIMARY KEY(uid, agentId, provider)
);
CREATE INDEX IF NOT EXISTS idx_agent_channels_agent ON agent_channels(agentId, provider);
CREATE TABLE IF NOT EXISTS channel_conversations (
  uid TEXT NOT NULL, agentId TEXT NOT NULL, provider TEXT NOT NULL, remoteId TEXT NOT NULL, data TEXT NOT NULL, updated INTEGER NOT NULL,
  PRIMARY KEY(provider, agentId, remoteId)
);
CREATE INDEX IF NOT EXISTS idx_channel_conversations_owner ON channel_conversations(uid, agentId, updated);
`);
const channels = {
  set: (uid, agentId, provider, data) => { db.prepare('INSERT OR REPLACE INTO agent_channels (uid,agentId,provider,data,updated) VALUES (?,?,?,?,?)').run(uid, agentId, provider, JSON.stringify(data), Date.now()); return data; },
  get: (uid, agentId, provider) => { const r = db.prepare('SELECT data FROM agent_channels WHERE uid=? AND agentId=? AND provider=?').get(uid, agentId, provider); return r ? JSON.parse(r.data) : null; },
  getAny: (agentId, provider) => { const r = db.prepare('SELECT uid,data FROM agent_channels WHERE agentId=? AND provider=?').get(agentId, provider); return r ? { uid: r.uid, data: JSON.parse(r.data) } : null; },
  list: (uid, agentId) => db.prepare('SELECT provider,data,updated FROM agent_channels WHERE uid=? AND agentId=?').all(uid, agentId).map(r => ({ provider: r.provider, data: JSON.parse(r.data), updated: r.updated })),
  del: (uid, agentId, provider) => db.prepare('DELETE FROM agent_channels WHERE uid=? AND agentId=? AND provider=?').run(uid, agentId, provider).changes === 1,
  delAgent: (uid, agentId) => { db.prepare('DELETE FROM agent_channels WHERE uid=? AND agentId=?').run(uid, agentId); db.prepare('DELETE FROM channel_conversations WHERE uid=? AND agentId=?').run(uid, agentId); },
};
const conversations = {
  get: (provider, agentId, remoteId) => { const r = db.prepare('SELECT uid,data FROM channel_conversations WHERE provider=? AND agentId=? AND remoteId=?').get(provider, agentId, String(remoteId)); return r ? { uid: r.uid, ...JSON.parse(r.data) } : null; },
  save: (uid, agentId, provider, remoteId, data) => db.prepare('INSERT OR REPLACE INTO channel_conversations (uid,agentId,provider,remoteId,data,updated) VALUES (?,?,?,?,?,?)').run(uid, agentId, provider, String(remoteId), JSON.stringify(data), Date.now()),
};

/* ---------- outbound voice calls + short-lived audio media ---------- */
db.exec(`
CREATE TABLE IF NOT EXISTS outbound_calls (
  id TEXT PRIMARY KEY, uid TEXT NOT NULL, data TEXT NOT NULL, created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_calls_uid ON outbound_calls(uid, created);
CREATE TABLE IF NOT EXISTS call_media (
  token TEXT PRIMARY KEY, callId TEXT NOT NULL, file TEXT NOT NULL, mime TEXT NOT NULL, created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_call_media_call ON call_media(callId);
`);
const calls = {
  add: (uid, call) => { db.prepare('INSERT INTO outbound_calls (id,uid,data,created) VALUES (?,?,?,?)').run(call.id, uid, JSON.stringify(call), call.created || Date.now()); return call; },
  get: (uid, id) => { const r = db.prepare('SELECT data FROM outbound_calls WHERE uid=? AND id=?').get(uid, id); return r ? JSON.parse(r.data) : null; },
  getAny: id => { const r = db.prepare('SELECT uid,data FROM outbound_calls WHERE id=?').get(id); return r ? { uid: r.uid, ...JSON.parse(r.data) } : null; },
  list: uid => db.prepare('SELECT data FROM outbound_calls WHERE uid=? ORDER BY created DESC LIMIT 30').all(uid).map(r => JSON.parse(r.data)),
  patch: (uid, id, patch) => { const call = calls.get(uid, id); if (!call) return null; Object.assign(call, patch); db.prepare('UPDATE outbound_calls SET data=? WHERE id=? AND uid=?').run(JSON.stringify(call), id, uid); return call; },
  patchAny: (id, patch) => { const found = calls.getAny(id); if (!found) return null; Object.assign(found, patch); db.prepare('UPDATE outbound_calls SET data=? WHERE id=?').run(JSON.stringify(found), id); return found; },
  addMedia: (token, callId, file, mime) => db.prepare('INSERT OR REPLACE INTO call_media (token,callId,file,mime,created) VALUES (?,?,?,?,?)').run(token, callId, file, mime, Date.now()),
  media: token => db.prepare('SELECT * FROM call_media WHERE token=?').get(token) || null,
  removeMediaForCall: callId => db.prepare('DELETE FROM call_media WHERE callId=?').run(callId),
};

module.exports = { calls, channels, conversations, db, DATA_DIR, users, enforceTrial, chargeTx, refundTx, adjustTx, addMinutesTx, ledger, sessions, adminSessions, rateLimit, lockout, registerFailure, clearFailures, voices, agents, history, renders, audit, auditList, support, config, pushSubs, upgradeReq };
