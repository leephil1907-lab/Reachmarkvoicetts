// Reachmark Audio — Web Push (VAPID) delivery for admin announcements.
// Keys live in DATA_DIR/vapid.json (volume-persisted) or env overrides; never in git.
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');
const store = require('./db');

const KEYFILE = path.join(store.DATA_DIR, 'vapid.json');
let keys = null;

function load() {
  if (keys) return keys;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else if (fs.existsSync(KEYFILE)) {
    try { keys = JSON.parse(fs.readFileSync(KEYFILE, 'utf8')); } catch { keys = null; }
  }
  if (!keys || !keys.publicKey || !keys.privateKey) {
    keys = webpush.generateVAPIDKeys();
    try { fs.writeFileSync(KEYFILE, JSON.stringify(keys)); } catch {}
  }
  webpush.setVapidDetails('mailto:support@reachmarkdigital.com', keys.publicKey, keys.privateKey);
  return keys;
}

async function sendAll(title, body, url) {
  load();
  const subs = store.pushSubs.all();
  let sent = 0, failed = 0;
  await Promise.all(subs.map(async (row) => {
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: JSON.parse(row.keys) },
        JSON.stringify({ title: title || 'Reachmark Audio', body: body || '', url: url || '/' }));
      sent++;
    } catch (e) {
      failed++;
      if (e && (e.statusCode === 404 || e.statusCode === 410)) store.pushSubs.del(row.endpoint);
    }
  }));
  return { sent, failed, total: subs.length };
}

module.exports = { load, sendAll, publicKey: () => load().publicKey };
