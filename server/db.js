// Reachmark Audio — SQLite storage layer (better-sqlite3)
// Atomic credit transactions, per-user tables, session store, rate limits, render ownership.
// DATA_DIR is env-configurable so deployments can mount a persistent disk.
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
  trial_ends INTEGER, created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, uid TEXT NOT NULL, exp INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS voices (id TEXT PRIMARY KEY, uid TEXT NOT NULL, data TEXT NOT NULL, created INTEGER);
CREATE TABLE IF NOT EXISTS agents (id TEXT PRIMARY KEY, uid TEXT NOT NULL, data TEXT NOT NULL, created INTEGER);
CREATE TABLE IF NOT EXISTS history (id TEXT PRIMARY KEY, uid TEXT NOT NULL, at INTEGER NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS renders (file TEXT PRIMARY KEY, uid TEXT NOT NULL, created INTEGER);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_voices_uid ON voices(uid);
CREATE INDEX IF NOT EXISTS idx_agents_uid ON agents(uid);
CREATE INDEX IF NOT EXISTS idx_history_uid ON history(uid, at);
`);

/* ---------- users ---------- */
const qUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const qUserByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const qUserInsert = db.prepare(`INSERT INTO users (id,name,email,salt,pass,credits,plan,minutes,trial_used,trial_ends,created)
  VALUES (@id,@name,@email,@salt,@pass,@credits,@plan,@minutes,@trial_used,@trial_ends,@created)`);
const qUserUpdate = db.prepare(`UPDATE users SET name=@name, email=@email, credits=@credits, plan=@plan,
  minutes=@minutes, trial_used=@trial_used, trial_ends=@trial_ends WHERE id=@id`);
const users = {
  byId: id => qUserById.get(id) || null,
  byEmail: email => qUserByEmail.get(email) || null,
  create: u => { qUserInsert.run(u); return qUserById.get(u.id); },
  save: u => { qUserUpdate.run(u); return qUserById.get(u.id); },
};

// Plus trials expire: enforce on every authenticated request.
function enforceTrial(u) {
  if (u.plan === 'plus' && u.trial_ends && u.trial_ends < Date.now()) {
    u.plan = 'free'; u.trial_ends = null;
    users.save(u);
  }
  return u;
}

/* ---------- atomic credits ---------- */
const qCharge = db.prepare('UPDATE users SET credits = credits - @cost WHERE id = @uid AND credits >= @cost');
const qRefund = db.prepare('UPDATE users SET credits = credits + @cost WHERE id = @uid');
const chargeTx = db.transaction((uid, cost) => qCharge.run({ uid, cost }).changes === 1);
const refundTx = db.transaction((uid, cost) => qRefund.run({ uid, cost }).changes === 1);
const qMinutes = db.prepare('UPDATE users SET minutes = minutes + @m WHERE id = @uid');
const addMinutesTx = db.transaction((uid, secs) => qMinutes.run({ uid, m: secs / 60 }));

/* ---------- sessions ---------- */
const qSessGet = db.prepare('SELECT * FROM sessions WHERE token = ?');
const qSessAdd = db.prepare('INSERT OR REPLACE INTO sessions (token,uid,exp) VALUES (?,?,?)');
const qSessDel = db.prepare('DELETE FROM sessions WHERE token = ?');
const qSessPurge = db.prepare('DELETE FROM sessions WHERE exp < ?');
const sessions = {
  get: t => qSessGet.get(t) || null,
  add: (t, uid, exp) => qSessAdd.run(t, uid, exp),
  del: t => qSessDel.run(t),
  purge: () => qSessPurge.run(Date.now()),
};

/* ---------- rate limits ---------- */
const qRl = db.prepare('SELECT * FROM rate_limits WHERE key = ?');
const qRlSet = db.prepare('INSERT OR REPLACE INTO rate_limits (key,count,reset_at) VALUES (?,?,?)');
function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const row = qRl.get(key);
  if (!row || row.reset_at < now) { qRlSet.run(key, 1, now + windowMs); return true; }
  if (row.count >= limit) return false;
  qRlSet.run(key, row.count + 1, row.reset_at);
  return true;
}

/* ---------- per-user JSON documents ---------- */
function docTable(table) {
  const list = db.prepare(`SELECT data FROM ${table} WHERE uid = ? ORDER BY created ASC`);
  const get = db.prepare(`SELECT data FROM ${table} WHERE uid = ? AND id = ?`);
  const add = db.prepare(`INSERT OR REPLACE INTO ${table} (id,uid,data,created) VALUES (?,?,?,?)`);
  const del = db.prepare(`DELETE FROM ${table} WHERE uid = ? AND id = ?`);
  return {
    list: uid => list.all(uid).map(r => JSON.parse(r.data)),
    get: (uid, id) => { const r = get.get(uid, id); return r ? JSON.parse(r.data) : null; },
    add: (uid, doc) => { add.run(doc.id, uid, JSON.stringify(doc), doc.created || Date.now()); return doc; },
    del: (uid, id) => del.run(uid, id).changes === 1,
  };
}
const voices = docTable('voices');
const agents = docTable('agents');

const qHList = db.prepare('SELECT data FROM history WHERE uid = ? ORDER BY at DESC LIMIT 80');
const qHAdd = db.prepare('INSERT OR REPLACE INTO history (id,uid,at,data) VALUES (?,?,?,?)');
const qHDel = db.prepare('DELETE FROM history WHERE uid = ? AND id = ?');
const history = {
  list: uid => qHList.all(uid).map(r => JSON.parse(r.data)),
  add: (uid, item) => { qHAdd.run(item.id, uid, item.at, JSON.stringify(item)); return item; },
  del: (uid, id) => qHDel.run(uid, id).changes === 1,
};

/* ---------- render ownership ---------- */
const qRAdd = db.prepare('INSERT OR REPLACE INTO renders (file,uid,created) VALUES (?,?,?)');
const qRGet = db.prepare('SELECT uid FROM renders WHERE file = ?');
const renders = {
  add: (file, uid) => qRAdd.run(file, uid, Date.now()),
  owner: file => { const r = qRGet.get(file); return r ? r.uid : null; },
};

module.exports = { db, DATA_DIR, users, enforceTrial, chargeTx, refundTx, addMinutesTx, sessions, rateLimit, voices, agents, history, renders };
