// Reachmark Audio — outbound mail via SMTP (nodemailer), with graceful fallback.
// Configure with env (never in code, never in git):
//   SMTP_HOST (e.g. smtp.gmail.com)  SMTP_PORT (587 STARTTLS / 465 TLS)
//   SMTP_USER (e.g. reachmarkofficial@gmail.com)  SMTP_PASS (app password)
//   — or a single SMTP_URL (smtps://user:pass@host:port)
//   MAIL_FROM (optional display-from; Gmail rewrites to the authenticated account)
// Without SMTP config, messages are appended to data/outbox.log so nothing is lost
// and any MTA/relay can be wired later.
'use strict';
const fs = require('fs');
const path = require('path');
const store = require('./db');

const OUTBOX = path.join(store.DATA_DIR, 'outbox.log');
let transporter = null, probed = false;

function transport() {
  if (probed) return transporter;
  probed = true;
  try {
    const nodemailer = require('nodemailer');
    if (process.env.SMTP_URL) {
      transporter = nodemailer.createTransport(process.env.SMTP_URL);
    } else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const port = Number(process.env.SMTP_PORT || 587);
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST, port,
        secure: port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        tls: { minVersion: 'TLSv1.2' },
        pool: true, maxConnections: 3,
      });
    }
  } catch (e) { console.error('[mail] transport init failed:', e.message); }
  return transporter;
}
const fromAddr = () => process.env.MAIL_FROM || ('Reachmark Audio <' + (process.env.SMTP_USER || 'no-reply@reachmark.audio') + '>');

async function send({ to, subject, html, text }) {
  const t = transport();
  if (t && to) {
    try {
      await t.sendMail({ from: fromAddr(), to, subject, html, text });
      return { sent: true };
    } catch (e) {
      console.error('[mail] SMTP send failed for', to, '-', e.message);
    }
  }
  try { fs.appendFileSync(OUTBOX, `Date: ${new Date().toISOString()}\nTo: ${to}\nSubject: ${subject}\n\n${text || ''}\n--\n`); } catch {}
  return { sent: false };
}
const configured = () => !!transport();

module.exports = { send, configured };
