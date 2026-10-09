// Reachmark Audio — TOTP (RFC 6238) in pure Node: base32 secrets + 6-digit codes.
'use strict';
const crypto = require('crypto');
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function newSecret(bytes = 20) {
  const buf = crypto.randomBytes(bytes);
  let bits = 0, value = 0, out = '';
  for (const b of buf) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function decodeB32(s) {
  let bits = 0, value = 0; const out = [];
  for (const c of s.toUpperCase().replace(/=+$/, '')) {
    const idx = B32.indexOf(c); if (idx === -1) continue;
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
function codeAt(secret, t) {
  const counter = Math.floor(t / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', decodeB32(secret)).update(buf).digest();
  const off = hmac[hmac.length - 1] & 15;
  const bin = ((hmac[off] & 127) << 24) | (hmac[off + 1] << 16) | (hmac[off + 2] << 8) | hmac[off + 3];
  return String(bin % 1000000).padStart(6, '0');
}
function verify(secret, code, window = 1) {
  const now = Date.now() / 1000;
  for (let w = -window; w <= window; w++) {
    if (codeAt(secret, now + w * 30) === String(code).padStart(6, '0')) return true;
  }
  return false;
}
const otpauthUri = (secret, email, issuer = 'Reachmark Audio') =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;

module.exports = { newSecret, verify, otpauthUri, codeAt };
