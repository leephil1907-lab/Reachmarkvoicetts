// Reachmark Audio — outbound mail hook.
// Uses sendmail binary when present; otherwise appends RFC-822 messages to
// data/outbox.log so deployments can wire any MTA/relay (Postmark, SES sendmail mode).
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const store = require('./db');

const OUTBOX = path.join(store.DATA_DIR, 'outbox.log');

function send({ to, subject, text }) {
  const body = `From: Reachmark Audio <no-reply@reachmark.audio>\nTo: ${to}\nSubject: ${subject}\nDate: ${new Date().toUTCString()}\n\n${text}\n`;
  try {
    const sm = spawn('sendmail', ['-t'], { stdio: ['pipe', 'ignore', 'ignore'] });
    sm.on('error', () => fs.appendFileSync(OUTBOX, body + '\n--\n'));
    sm.stdin.end(body);
  } catch {
    try { fs.appendFileSync(OUTBOX, body + '\n--\n'); } catch {}
  }
}
module.exports = { send };
