'use strict';

const crypto = require('crypto');

const accountSid = () => process.env.TWILIO_ACCOUNT_SID || '';
const authToken = () => process.env.TWILIO_AUTH_TOKEN || '';
const fromNumber = () => process.env.TWILIO_FROM_NUMBER || '';
const publicUrl = () => (process.env.PUBLIC_URL || '').replace(/\/$/, '');

function configured() {
  return /^AC[0-9a-f]{32}$/i.test(accountSid()) && authToken().length >= 20 && /^\+[1-9]\d{7,14}$/.test(fromNumber()) && /^https:\/\//i.test(publicUrl());
}

function normalizeE164(value) {
  const phone = String(value || '').trim().replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw Object.assign(new Error('Enter a valid international phone number in E.164 format, for example +14155550123.'), { status: 422 });
  return phone;
}

async function createCall({ to, url, statusCallback, timeLimit }) {
  if (!configured()) throw Object.assign(new Error('Outbound calling is not connected yet. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER and an HTTPS PUBLIC_URL in the hosting environment.'), { status: 503 });
  const endpoint = 'https://api.twilio.com/2010-04-01/Accounts/' + accountSid() + '/Calls.json';
  const body = new URLSearchParams({
    To: normalizeE164(to),
    From: fromNumber(),
    Url: url,
    Method: 'POST',
    StatusCallback: statusCallback,
    StatusCallbackMethod: 'POST',
    StatusCallbackEvent: 'initiated ringing answered completed',
    TimeLimit: String(Math.max(30, Math.min(300, Number(timeLimit) || 60))),
  });
  const auth = Buffer.from(accountSid() + ':' + authToken()).toString('base64');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { authorization: 'Basic ' + auth, 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.message || 'The phone provider could not start this call.');
    err.status = response.status === 429 ? 429 : 502;
    throw err;
  }
  return { sid: data.sid, status: data.status || 'queued' };
}

function validateSignature(req, fullUrl, params) {
  const token = authToken();
  const signature = req.headers['x-twilio-signature'];
  if (!token || typeof signature !== 'string' || !signature) return false;
  let value = fullUrl;
  for (const key of Object.keys(params || {}).sort()) value += key + String(params[key] ?? '');
  const expected = crypto.createHmac('sha1', token).update(value, 'utf8').digest('base64');
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function xmlEscape(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function responseXml(inner) {
  return '<?xml version="1.0" encoding="UTF-8"?><Response>' + inner + '</Response>';
}
function play(url) { return '<Play>' + xmlEscape(url) + '</Play>'; }
function hangup() { return '<Hangup/>'; }
function say(text, voice = 'Polly.Joanna') {
  return '<Say voice="' + xmlEscape(voice) + '">' + xmlEscape(text) + '</Say>';
}
function gather(actionUrl, prompt, language = 'en-US') {
  return '<Gather input="speech" action="' + xmlEscape(actionUrl) + '" method="POST" speechTimeout="auto" timeout="5" language="' + xmlEscape(language) + '">' + prompt + '</Gather>';
}
function redirect(url) { return '<Redirect method="POST">' + xmlEscape(url) + '</Redirect>'; }

module.exports = { configured, normalizeE164, createCall, validateSignature, xmlEscape, responseXml, play, hangup, say, gather, redirect, publicUrl };
