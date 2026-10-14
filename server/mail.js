// Reachmark Audio — transactional email via Resend HTTPS API, with SMTP fallback.
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
      transporter = nodemailer.createTransport(process.env.SMTP_URL, { family: 4, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000 });
    } else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const port = Number(process.env.SMTP_PORT || 587);
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST, port, secure: port === 465, family: 4,
        connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        tls: { minVersion: 'TLSv1.2' }, pool: true, maxConnections: 3,
      });
    }
  } catch (e) { console.error('[mail] SMTP transport init failed:', e.message); }
  return transporter;
}

const fromAddr = () => process.env.MAIL_FROM || 'Reachmark Voice <verification@reachmarkdigital.xyz>';

async function sendWithResend({ to, subject, html, text }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: fromAddr(), to: [to], subject, ...(html ? { html } : {}), ...(text ? { text } : {}) }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body.message || body.name || ('HTTP ' + response.status);
    throw new Error('Resend rejected email (' + response.status + '): ' + message);
  }
  if (!body.id) throw new Error('Resend returned no email ID');
  return { sent: true, provider: 'resend', id: body.id };
}

async function send({ to, subject, html, text }) {
  if (!to || !subject || (!html && !text)) {
    console.error('[mail] Refusing email with missing recipient, subject, or body.');
    return { sent: false, error: 'Missing recipient, subject, or body' };
  }

  // Prefer the transactional HTTPS API; SMTP remains a fallback for existing setups.
  if (process.env.RESEND_API_KEY) {
    try {
      const result = await sendWithResend({ to, subject, html, text });
      console.info('[mail] Resend accepted message:', result.id);
      return result;
    } catch (e) {
      console.error('[mail] Resend send failed:', e.message);
    }
  }

  const t = transport();
  if (t) {
    try {
      const result = await t.sendMail({ from: fromAddr(), to, subject, html, text });
      return { sent: true, provider: 'smtp', id: result.messageId || null };
    } catch (e) {
      console.error('[mail] SMTP send failed:', e.message);
    }
  }

  // Diagnostic archive only: writing here is NOT email delivery.
  try { fs.appendFileSync(OUTBOX, `Date: ${new Date().toISOString()}\nTo: ${to}\nSubject: ${subject}\n\n${text || ''}\n--\n`); } catch {}
  return { sent: false, error: 'All configured email providers failed' };
}

const configured = () => !!process.env.RESEND_API_KEY || !!transport();

module.exports = { send, configured };
