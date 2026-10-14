'use strict';
const crypto = require('crypto');

function keyBytes() {
  const raw = process.env.APP_ENCRYPTION_KEY || '';
  if (raw.length < 32) return null;
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}
function configured() { return !!keyBytes(); }
function encrypt(value) {
  const key = keyBytes();
  if (!key) throw Object.assign(new Error('Secure channel storage is not configured. Set APP_ENCRYPTION_KEY (32+ characters) in the hosting environment.'), { status: 503 });
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64url')).join('.');
}
function decrypt(value) {
  const key = keyBytes();
  if (!key) throw Object.assign(new Error('Secure channel storage is not configured. Set APP_ENCRYPTION_KEY (32+ characters) in the hosting environment.'), { status: 503 });
  const parts = String(value || '').split('.');
  if (parts.length !== 3) throw new Error('Stored channel credentials are invalid.');
  const iv = Buffer.from(parts[0], 'base64url');
  const tag = Buffer.from(parts[1], 'base64url');
  const data = Buffer.from(parts[2], 'base64url');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'));
}
module.exports = { configured, encrypt, decrypt };
