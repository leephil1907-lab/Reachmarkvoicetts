// Reachmark Audio — unified server (zero-framework Node + better-sqlite3)
// Hardened build: atomic billing with refunds, one-time expiring trials, async scrypt +
// rate-limited auth, security headers, same-origin cookies, per-user concurrency on the
// TTS queue, whitelisted inputs, render ownership, real 404s, 20 MB upload cap.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const dsp = require('./dsp');
const tts = require('./tts');
const engines = require('./engines');
const store = require('./db');
const llm = require('./llm');
const brainS = require('./brain');
const mail = require('./mail');
const tpl = require('./templates');
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@reachmarkdigital.com';
const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:8001';
const originOf = req => (req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http') + '://' + (req.headers.host || 'localhost:' + (process.env.PORT || 8000));
store.db.exec('CREATE TABLE IF NOT EXISTS typing (threadId TEXT PRIMARY KEY, side TEXT, at INTEGER)');

const WEB = path.join(__dirname, '..', 'web');
const RENDER = tts.RENDER_DIR;
fs.mkdirSync(RENDER, { recursive: true });

const SIGNUP_CREDITS = 10000;
const MAX_UPLOAD = 20 * 1024 * 1024;           // 20 MB decoded
const MAX_BODY = 28 * 1024 * 1024;             // base64 overhead allowance
const CREDITS_MSG = 'Not enough credits. Start the 7-day Plus trial from Account → Upgrade, or email support@reachmarkdigital.com.';
const FX = ['none', 'robot', 'radio', 'echo'];
const KINDS = ['tts', 'vc', 'sep', 'dub', 'lip', 'clone', 'design', 'agent'];
const scryptAsync = promisify(crypto.scrypt);
const hashPass = async (pass, salt) => (await scryptAsync(pass, salt, 32, { N: 16384, r: 8, p: 1 })).toString('hex');
const sameHash = (a, b) => { const ba = Buffer.from(a, 'hex'), bb = Buffer.from(b, 'hex'); return ba.length === bb.length && crypto.timingSafeEqual(ba, bb); };

/* ---------- whitelist helpers ---------- */
const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : undefined);
const num = (v, min, max, def) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
const arrStr = (v, n, len) => (Array.isArray(v) ? v.slice(0, n).map(x => String(x).slice(0, len)) : []);
const oneOf = (v, list, def) => (list.includes(v) ? v : def);
function voiceDoc(b) {
  return {
    kind: oneOf(str(b.kind, 12), ['clone', 'design', 'discover', 'preset'], 'design'),
    name: str(b.name, 60) || 'Untitled voice',
    desc: str(b.desc, 500) || '',
    tags: arrStr(b.tags, 10, 24),
    model: str(b.model, 64) || null,
    semitones: num(b.semitones, -12, 12, 0),
    rate: num(b.rate, 0.5, 2, 1),
    fx: oneOf(str(b.fx, 10), FX, 'none'),
  };
}
function agentDoc(b) {
  return {
    name: str(b.name, 60), role: str(b.role, 120) || 'Reachmark assistant',
    persona: str(b.persona, 2000) || '', knowledge: arrStr(b.knowledge, 100, 300),
    greeting: str(b.greeting, 300) || 'Hi! How can I help?',
    voiceId: str(b.voiceId, 40) || null, model: str(b.model, 64) || null,
    av: oneOf(str(b.av, 8), ['', 'warm', 'vio'], ''),
    emoji: str(b.emoji, 8) || '', traits: arrStr(b.traits, 8, 24),
    language: oneOf(str(b.language, 8), ['auto', 'en', 'fr', 'es', 'de'], 'auto'),
  };
}
function historyDoc(b) {
  const url = str(b.url, 200);
  return {
    kind: oneOf(str(b.kind, 12), KINDS, 'tts'),
    title: str(b.title, 120) || 'Render',
    url: url && url.startsWith('/api/render/') ? url : null,
    meta: str(b.meta, 120) || '',
  };
}

/* ---------- guide agent (platform assistant) — honest labels ---------- */
function guideAgent() {
  return {
    id: 'guide', name: 'Reachmark Guide', role: 'Official platform assistant · knows every studio',
    persona: 'warm, concise, helpful', system: true, av: '',
    greeting: 'Hi! I am the Reachmark Guide — I know every studio, engine and shortcut on this platform. What would you like to do today?',
    voiceId: null, model: null, created: Date.now(),
    knowledge: [
      'Credits: every new account starts with 10,000 credits. TTS costs about 1 credit per 40 characters, voice change 20, Voice Match 150, Quick Vocal Remove 30, dubbing 15 per take.',
      'Plans: Free includes 3 voice slots and core studios. Plus adds 200 minutes of generation, 10 private voice slots and commercial use — one 7-day trial per account, from Account → Upgrade.',
      'Voice Match (Create → Voice Match): records 10 seconds (or an upload), analyses pitch and pace, and configures the nearest neural voice to sound like you. It is a fast voice match, not a speaker-embedding clone — true cloning engines (XTTS/OpenVoice) plug into the same endpoint when a GPU runtime is attached.',
      'Voice translation: any voice — including matched voices — can speak in English, French, Spanish or German. Pick the output language in Text to Speech; your voice character (pitch, pace, colour) carries across languages.',
      'Voice Changer: upload or record, then apply presets (Deep, Sub, Bright, Air), fine pitch in semitones, speed and expression colours (Robot, Radio, Echo). Conversion runs on the Core DSP engine.',
      'Voice Design: describe a voice in plain text — e.g. warm deep male narrator with vintage radio colour — and the trait parser builds it. Preview before saving.',
      'Dubbing Studio: write one line per language, choose a neural voice per take, render all, play the sequence and download each WAV.',
      'Lip Sync Studio: synthesize or upload audio, pick a scene, press Perform — the character lips, brows and blinks follow the audio. Export video downloads a WebM file.',
      'Quick Vocal Remove: center-channel reduction for stereo mixes — it pulls centered vocals out and leaves a karaoke bus. Best on mixes with centered lead vocals; a Demucs-class separation engine plugs into the same endpoint when attached.',
      'Character agents: build a persona with a name, role, personality and knowledge base, then chat or place a live voice call — the agent answers from its brief and speaks with your chosen voice.',
      'Downloads: every render shows a download button. Renders are WAV files owned by your account; lip sync exports are WebM video.',
      'History: everything you render is stored per account under Home → History tabs (TTS, Voice Changer, Quick Vocal Remove, Dubbing, Lip Sync, Voice Matches).',
      'Engines: Reachmark Audio merges five engine codebases — Reachmark Core, Piper neural TTS, Real-Time-Voice-Cloning, MockingBird and ChatterBox — plus VoiceStudio patterns. Live status is in Account → Engine Hub.',
      'Privacy: voice samples and renders are stored only in your account workspace. Match or clone only voices you have rights to.',
      'Support: live chat and support sessions are in the Support Center (life-buoy button). Email reachmarkofficial@gmail.com or support@reachmarkdigital.com.',
      'Keyboard: press Ctrl or Cmd + K anywhere for the command palette; it jumps to any studio or action.',
      'Troubleshooting playback: if a browser blocks audio, tap play once more — browsers require one user gesture before sound.',
      'Troubleshooting microphone: recording needs microphone permission; on mobile allow it in site settings, or upload a file instead (20 MB max).',
    ],
  };
}

/* ---------- http helpers ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.wav': 'audio/wav', '.webm': 'audio/webm', '.ico': 'image/x-icon', '.json': 'application/json' };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

function send(res, code, body, headers = {}) { res.writeHead(code, headers); res.end(body); }
function json(res, code, obj, headers = {}) { send(res, code, JSON.stringify(obj), { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }); }
function wav(res, buf, extra = {}) { send(res, 200, buf, { 'Content-Type': 'audio/wav', 'Content-Length': buf.length, 'Cache-Control': 'no-store', ...extra }); }
function readBody(req, limit = MAX_BODY) {
  return new Promise((res, rej) => {
    let n = 0; const chunks = [];
    req.on('data', c => { n += c.length; if (n > limit) { rej(Object.assign(new Error('Upload too large — 20 MB max.'), { status: 413 })); req.destroy(); } chunks.push(c); });
    req.on('end', () => res(Buffer.concat(chunks)));
    req.on('error', rej);
  });
}
const b64ToBuf = s => Buffer.from(String(s).split(',')[1] || String(s), 'base64');
const saveRender = (buf, tag, uid) => { const f = tag + '_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex') + '.wav'; fs.writeFileSync(path.join(RENDER, f), buf); store.renders.add(f, uid); return '/api/render/' + f; };
const wavSeconds = buf => { try { const sr = buf.readUInt32LE(24), ch = buf.readUInt16LE(22); return (buf.length - 44) / (sr * 2 * ch); } catch { return 0; } };

function securityHeaders(res, req) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket?.encrypted === true;
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'microphone=(self), camera=()');
  if (secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  return secure;
}
function cookieUser(req) {
  const m = /(?:^|;\s*)rm=([a-f0-9]{64})/.exec(req.headers.cookie || '');
  if (!m) return null;
  const s = store.sessions.get(m[1]);
  if (!s || s.exp < Date.now()) { if (s) store.sessions.del(m[1]); return null; }
  const u = store.users.byId(s.uid);
  return u ? { user: store.enforceTrial(u), token: m[1] } : null;
}
function startSession(res, uid, secure) {
  const token = crypto.randomBytes(32).toString('hex');
  store.sessions.add(token, uid, Date.now() + 30 * 864e5);
  return `rm=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}${secure ? '; Secure' : ''}`;
}
const pubUser = u => ({ id: u.id, name: u.name, email: u.email, credits: u.credits, plan: u.plan, minutes: Math.round(u.minutes * 10) / 10, trialEnds: u.trial_ends || null, created: u.created, verified: !!u.email_verified });
/* email verification: single 24h window carrying BOTH a link token and a 6-digit code */
function issueVerification(u) {
  const token = crypto.randomBytes(24).toString('hex');
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  u.email_verified = u.email_verified || 0; u.verify_token = token; u.verify_code = code; u.verify_exp = Date.now() + 24 * 3600 * 1000;
  store.users.save(u);
  return { token, code };
}
const creditHeader = user => ({ 'X-Reachmark-Credits': String(user.credits) });
const clientIp = req => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'local';

/* paid-route wrapper: validate BEFORE charging; refund the exact charge on ANY failure */
async function paid(res, user, cost, validate, run) {
  let ctx;
  try { ctx = await validate(); } catch (e) { return json(res, e.status || 400, { error: e.message }); }
  if (!store.chargeTx(user.id, cost)) return json(res, 402, { error: CREDITS_MSG });
  try {
    const out = await run(ctx);
    store.addMinutesTx(user.id, out.seconds || 0);
    return out.respond();
  } catch (e) {
    store.refundTx(user.id, cost);
    return json(res, e.code === 429 ? 429 : (e.status || 502), { error: e.message });
  }
}

/* ---------- voice match ---------- */
function matchProfile(uid, name, sampleBuf, note) {
  const audio = dsp.decodeWav(sampleBuf);
  const mono = audio.channels.length > 1 ? audio.channels[0].map((v, i) => (v + audio.channels[1][i]) / 2) : audio.channels[0];
  const f0 = dsp.estimateF0(mono, audio.sampleRate);
  const rate = dsp.speechRate(mono, audio.sampleRate);
  const female = f0 > 165;
  const cats = tts.catalog();
  const model = (female ? cats.find(v => v.gender === 'female') : cats.find(v => v.gender === 'male')) || cats[0];
  const semitones = model && f0 ? Math.max(-12, Math.min(12, Math.round(12 * Math.log2(f0 / model.baseF0)))) : 0;
  const pace = Math.max(0.85, Math.min(1.2, rate / 3.2 || 1));
  const id = 'v_' + crypto.randomBytes(4).toString('hex');
  fs.writeFileSync(path.join(store.DATA_DIR, 'u', uid, 'samples', id + '.wav'), sampleBuf);
  const profile = { id, name, kind: 'clone', note: note || '', desc: 'Matched · F0 ' + Math.round(f0) + ' Hz · ' + (female ? 'female' : 'male') + ' range', model: model ? model.id : null, semitones, rate: +pace.toFixed(2), fx: 'none', f0: Math.round(f0), created: Date.now(), sample: '/api/voices/' + id + '/sample' };
  store.voices.add(uid, profile);
  return profile;
}
const userSamplesDir = uid => { const d = path.join(store.DATA_DIR, 'u', uid, 'samples'); fs.mkdirSync(d, { recursive: true }); return d; };

/* ---------------- router ---------------- */
const server = http.createServer(async (req, res) => {
  const secure = securityHeaders(res, req);
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  if (process.env.CORS_ORIGIN) { res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN); res.setHeader('Vary', 'Origin'); }
  if (req.method === 'OPTIONS') return send(res, 204, '');

  try {
    /* ---- public ---- */
    if (p === '/api/health') return json(res, 200, { ok: true, app: 'Reachmark Audio', version: '1.3.0', piper: tts.status(), db: 'sqlite', dataDir: store.DATA_DIR, llm: llm.configured(), time: Date.now() });
    if (p === '/api/config') return json(res, 200, {
      announcement: store.config.get('announcement'),
      maintenance: store.config.get('maintenance') === '1',
      signup_on: store.config.get('signup_on') === '1',
      flags: store.config.flags(), costs: store.config.costs(),
      default_voice: store.config.get('default_voice'),
    });

    if (p === '/api/auth/signup' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req, 1e6));
      const name = str(b.name, 80)?.trim(), email = str(b.email, 200)?.trim().toLowerCase(), pass = String(b.password || '');
      const ip = clientIp(req);
      if (!store.rateLimit('signup:' + ip + ':' + email, 5, 15 * 60 * 1000)) return json(res, 429, { error: 'Too many attempts. Please try again in 15 minutes.' });
      if (store.config.get('signup_on') !== '1') return json(res, 403, { error: 'Signups are currently closed.' });
      if (!name || name.length < 2) return json(res, 422, { error: 'Please enter your name.' });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res, 422, { error: 'That email address does not look valid.' });
      if (pass.length < 8) return json(res, 422, { error: 'Password must be at least 8 characters.' });
      if (store.users.byEmail(email)) return json(res, 409, { error: 'An account with this email already exists. Log in instead.' });
      const salt = crypto.randomBytes(8).toString('hex');
      const uid = 'u_' + crypto.randomBytes(6).toString('hex');
      const user = store.users.create({ id: uid, name, email, salt, pass: await hashPass(pass, salt), credits: Number(store.config.get('signup_credits')) || 10000, plan: 'free', minutes: 0, trial_used: 0, trial_ends: null, created: Date.now() });
      try { store.db.prepare('INSERT INTO ledger (uid,at,delta,kind) VALUES (?,?,?,?)').run(user.id, Date.now(), user.credits, 'signup'); } catch {}
      userSamplesDir(uid);
      store.agents.add(uid, guideAgent());
      mail.send({ to: email, ...tpl.welcome({ name, email, credits: user.credits, url: originOf(req) }) }).catch(() => {});
      const vf = issueVerification(user);
      mail.send({ to: email, ...tpl.verifyEmail({ name, email, url: originOf(req), token: vf.token, code: vf.code }) }).catch(() => {});
      return json(res, 200, { user: pubUser(user), fresh: true }, { 'Set-Cookie': startSession(res, uid, secure) });
    }
    if (p === '/api/auth/login' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req, 1e6));
      const email = str(b.email, 200)?.trim().toLowerCase() || '', pass = String(b.password || '');
      const ip = clientIp(req);
      if (!store.rateLimit('login:' + ip + ':' + email, 5, 15 * 60 * 1000)) return json(res, 429, { error: 'Too many attempts. Please try again in 15 minutes.' });
      const u = store.users.byEmail(email);
      if (!u || !sameHash(await hashPass(pass, u.salt), u.pass)) return json(res, 401, { error: 'Incorrect email or password.' });
      return json(res, 200, { user: pubUser(store.enforceTrial(u)) }, { 'Set-Cookie': startSession(res, u.id, secure) });
    }
    if (p === '/api/auth/logout' && req.method === 'POST') {
      const c = cookieUser(req);
      if (c) store.sessions.del(c.token);
      return json(res, 200, { ok: true }, { 'Set-Cookie': 'rm=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' + (secure ? '; Secure' : '') });
    }
    /* ---- password reset by email (branded template, 30-min single-use token) ---- */
    if (p === '/api/auth/forgot' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req, 1e5));
      const email = str(b.email, 200)?.trim().toLowerCase() || '';
      if (!store.rateLimit('forgot:' + clientIp(req) + ':' + email, 3, 15 * 60 * 1000)) return json(res, 429, { error: 'Too many reset requests. Try again in 15 minutes.' });
      const u = email && store.users.byEmail(email);
      if (u) {
        const token = crypto.randomBytes(24).toString('hex');
        store.db.prepare('INSERT OR REPLACE INTO password_resets (token,uid,exp,used) VALUES (?,?,?,0)').run(token, u.id, Date.now() + 30 * 60 * 1000);
        mail.send({ to: u.email, ...tpl.passwordReset({ name: u.name, url: originOf(req), token }) }).catch(() => {});
      }
      return json(res, 200, { ok: true, message: 'If that email has an account, a reset link is on its way. It stays valid for 30 minutes.' });
    }
    if (p === '/api/auth/reset' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req, 1e5));
      const token = str(b.token, 64) || '', pass = String(b.password || '');
      if (!store.rateLimit('reset:' + clientIp(req), 10, 15 * 60 * 1000)) return json(res, 429, { error: 'Too many attempts. Try again later.' });
      const row = store.db.prepare('SELECT * FROM password_resets WHERE token=?').get(token);
      if (!row || row.used || row.exp < Date.now()) return json(res, 400, { error: 'This reset link is invalid or has expired.' });
      if (pass.length < 8) return json(res, 400, { error: 'Password must be at least 8 characters.' });
      const u = store.users.byId(row.uid);
      if (!u) return json(res, 400, { error: 'This reset link is invalid or has expired.' });
      const salt = crypto.randomBytes(16).toString('hex');
      u.salt = salt; u.pass = await hashPass(pass, salt);
      store.users.save(u);
      store.db.prepare('UPDATE password_resets SET used=1 WHERE token=?').run(token);
      store.sessions.delUser(u.id); // every other session dies with the old password
      mail.send({ to: u.email, ...tpl.passwordChanged({ name: u.name }) }).catch(() => {});
      return json(res, 200, { ok: true });
    }
    /* ---- email verification: link token OR 6-digit code, both single-window (24h) ---- */
    if (p === '/api/auth/verify' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req, 1e5));
      const token = str(b.token, 64) || '', code = String(b.code || '').trim();
      if (!store.rateLimit('verify:' + clientIp(req), 20, 15 * 60 * 1000)) return json(res, 429, { error: 'Too many attempts. Try again in 15 minutes.' });
      const u = token
        ? store.db.prepare('SELECT * FROM users WHERE verify_token = ?').get(token)
        : (/^\d{6}$/.test(code) ? store.db.prepare('SELECT * FROM users WHERE verify_code = ?').get(code) : null);
      if (!u || u.email_verified) {
        if (u && u.email_verified) return json(res, 200, { ok: true, verified: true, user: pubUser(u), already: true });
        return json(res, 400, { error: 'That verification link or code is invalid or has expired.' });
      }
      if (u.verify_exp && u.verify_exp < Date.now()) return json(res, 400, { error: 'That verification link or code has expired — resend from the app.' });
      u.email_verified = 1; u.verify_token = null; u.verify_code = null; u.verify_exp = null;
      store.users.save(u);
      mail.send({ to: u.email, ...tpl.verifiedNotice({ name: u.name }) }).catch(() => {});
      return json(res, 200, { ok: true, verified: true, user: pubUser(u) });
    }
    if (p === '/api/auth/verify/resend' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req, 1e5));
      const email = str(b.email, 200)?.trim().toLowerCase() || '';
      if (!store.rateLimit('vresend:' + clientIp(req) + ':' + email, 3, 15 * 60 * 1000)) return json(res, 429, { error: 'Too many resends. Try again in 15 minutes.' });
      const u = email && store.users.byEmail(email);
      if (u && !u.email_verified) {
        const v = issueVerification(u);
        mail.send({ to: u.email, ...tpl.verifyEmail({ name: u.name, email: u.email, url: originOf(req), token: v.token, code: v.code }) }).catch(() => {});
      }
      return json(res, 200, { ok: true, message: 'If that account is still unverified, a fresh link and code are on the way.' });
    }
    if (p === '/api/auth/me') {
      const c = cookieUser(req);
      return c ? json(res, 200, { user: pubUser(c.user) }) : json(res, 401, { error: 'not signed in' });
    }

    /* ---- static (public shell; real 404 for missing files with extensions) ---- */
    if (!p.startsWith('/api/')) {
      let file = p === '/' ? '/index.html' : p;
      file = path.normalize(file).replace(/^(\.\.[\/\\])+/, '');
      const fp = path.join(WEB, file);
      if (!fp.startsWith(WEB)) return json(res, 403, { error: 'forbidden' });
      const exists = fs.existsSync(fp) && fs.statSync(fp).isFile();
      if (exists) {
        const ext = path.extname(fp);
        return send(res, 200, fs.readFileSync(fp), { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600' });
      }
      if (!path.extname(file)) return send(res, 200, fs.readFileSync(path.join(WEB, 'index.html')), { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      return send(res, 404, '404 — not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    }

    /* ---- protected ---- */
    const cu = cookieUser(req);
    if (!cu) return json(res, 401, { error: 'not signed in' });
    const user = cu.user, uid = user.id;
    if (user.suspended) return json(res, 403, { error: 'This account is suspended. Contact support@reachmarkdigital.com.' });
    if (store.config.get('require_verified') === '1' && !user.email_verified && !p.startsWith('/api/support') && p !== '/api/me')
      return json(res, 403, { error: 'Please verify your email address to continue — the link and 6-digit code are in your inbox.', verify: true });
    if (!user.last_seen || Date.now() - user.last_seen > 60000) { user.last_seen = Date.now(); store.users.save(user); }
    const slots = user.plan === 'plus' ? 10 : 3;
    const costs = store.config.costs();
    const flags = store.config.flags();
    const needFlag = key => { if (!flags[key]) { json(res, 403, { error: 'This studio is temporarily disabled by the operator.' }); return false; } return true; };
    if (store.config.get('maintenance') === '1' && !p.startsWith('/api/support') && p !== '/api/me' && p !== '/api/agent/chat')
      return json(res, 503, { error: 'Reachmark Audio is under maintenance — please try again shortly.' });

    if (p === '/api/me') return json(res, 200, { user: pubUser(user) });
    if (p === '/api/plan/trial' && req.method === 'POST') {
      if (user.trial_used) return json(res, 409, { error: 'The free Plus trial has already been used on this account.' });
      user.plan = 'plus'; user.trial_used = 1; user.trial_ends = Date.now() + 7 * 864e5;
      store.users.save(user);
      return json(res, 200, { user: pubUser(user) });
    }
    if (p === '/api/models') return json(res, 200, { models: tts.catalog() });
    if (p === '/api/engines') return json(res, 200, { engines: await engines.status() });

    if (p === '/api/voices' && req.method === 'GET') return json(res, 200, { voices: store.voices.list(uid) });
    if (p === '/api/voices' && req.method === 'POST') {
      if (store.voices.list(uid).length >= slots) return json(res, 402, { error: 'Voice slot limit reached on Free (3). Start the Plus trial from Account → Upgrade.' });
      const d = voiceDoc(JSON.parse(await readBody(req, 1e6)));
      const profile = { id: 'v_' + crypto.randomBytes(4).toString('hex'), created: Date.now(), ...d };
      store.voices.add(uid, profile);
      return json(res, 200, { voice: profile });
    }
    if (p.startsWith('/api/voices/') && req.method === 'DELETE') {
      const id = path.basename(p.split('/')[3]);
      store.voices.del(uid, id);
      try { fs.unlinkSync(path.join(userSamplesDir(uid), id + '.wav')); } catch {}
      return json(res, 200, { ok: true });
    }
    if (p.startsWith('/api/voices/') && p.endsWith('/sample')) {
      const id = path.basename(p.split('/')[3]);
      if (!store.voices.get(uid, id)) return json(res, 404, { error: 'not found' });
      const f = path.join(userSamplesDir(uid), id + '.wav');
      if (fs.existsSync(f)) return wav(res, fs.readFileSync(f));
      return json(res, 404, { error: 'no sample' });
    }

    if (p === '/api/agents' && req.method === 'GET') return json(res, 200, { agents: store.agents.list(uid) });
    if (p === '/api/agents' && req.method === 'POST') {
      const d = agentDoc(JSON.parse(await readBody(req, 1e6)));
      if (!d.name) return json(res, 422, { error: 'Give the agent a name.' });
      const a = { id: 'a_' + crypto.randomBytes(4).toString('hex'), created: Date.now(), system: false, ...d };
      store.agents.add(uid, a);
      return json(res, 200, { agent: a });
    }
    if (p.startsWith('/api/agents/') && req.method === 'PUT') {
      const id = path.basename(p.split('/')[3]);
      const a = store.agents.get(uid, id);
      if (!a) return json(res, 404, { error: 'not found' });
      if (a.system) return json(res, 403, { error: 'The platform Guide cannot be modified.' });
      const merged = { ...a, ...agentDoc(JSON.parse(await readBody(req, 1e6))), id, system: false };
      store.agents.add(uid, merged);
      return json(res, 200, { agent: merged });
    }
    if (p.startsWith('/api/agents/') && req.method === 'DELETE') {
      const id = path.basename(p.split('/')[3]);
      const a = store.agents.get(uid, id);
      if (!a) return json(res, 404, { error: 'not found' });
      if (a.system) return json(res, 403, { error: 'The platform Guide cannot be removed.' });
      store.agents.del(uid, id);
      return json(res, 200, { ok: true });
    }

    if (p === '/api/history' && req.method === 'GET') return json(res, 200, { history: store.history.list(uid) });
    if (p === '/api/history' && req.method === 'POST') {
      const d = historyDoc(JSON.parse(await readBody(req, 1e6)));
      const item = { id: 'h_' + crypto.randomBytes(4).toString('hex'), at: Date.now(), ...d };
      store.history.add(uid, item);
      return json(res, 200, { item });
    }
    if (p.startsWith('/api/history/') && req.method === 'DELETE') {
      store.history.del(uid, path.basename(p.split('/')[3]));
      return json(res, 200, { ok: true });
    }

    /* ---- paid engine routes ---- */
    if (p === '/api/tts' && req.method === 'POST') {
      if (!needFlag('tts')) return;
      const b = JSON.parse(await readBody(req, 2e6));
      const cost = Math.max(costs.ttsMin || 5, Math.ceil(String(b.text || '').length / 40) * (costs.ttsPer40 || 1));
      return paid(res, user, cost,
        () => {
          const text = str(b.text, 4000)?.trim();
          if (!text) throw Object.assign(new Error('Text is required.'), { status: 400 });
          if (!tts.catalog().length) throw Object.assign(new Error('Speech engine has no voices installed on this server.'), { status: 503 });
          let opts = { text, model: str(b.model, 64), lang: str(b.lang, 8), semitones: num(b.semitones, -12, 12, 0), rate: num(b.rate, 0.5, 2, 1), fx: oneOf(str(b.fx, 10), FX, 'none') };
          if (b.voiceId) {
            const v = store.voices.get(uid, str(b.voiceId, 40));
            if (v && v.disabled) throw Object.assign(new Error('This voice has been disabled by support.'), { status: 403 });
            if (v) opts = { ...opts, model: v.model ?? opts.model, semitones: opts.semitones || v.semitones, rate: b.rate ? opts.rate : (v.rate || 1), fx: opts.fx === 'none' ? v.fx : opts.fx };
          }
          return opts;
        },
        async opts => {
          const { buf, voice } = await tts.synthesize(opts, uid);
          const saved = b.save ? saveRender(buf, 'tts', uid) : null;
          return { seconds: wavSeconds(buf), respond: () => send(res, 200, buf, { 'Content-Type': 'audio/wav', 'X-Reachmark-Url': saved || '', 'X-Reachmark-Voice': voice.id, ...creditHeader(user), 'Cache-Control': 'no-store' }) };
        });
    }
    if (p === '/api/voice-change' && req.method === 'POST') {
      if (!needFlag('changer')) return;
      const b = JSON.parse(await readBody(req));
      return paid(res, user, costs.vc || 20,
        () => {
          const raw = b64ToBuf(b.audio);
          if (raw.length > MAX_UPLOAD) throw Object.assign(new Error('Upload too large — 20 MB max.'), { status: 413 });
          const audio = dsp.decodeWav(raw); // throws before any charge
          return { audio, st: num(b.semitones, -24, 24, 0), rate: num(b.rate, 0.5, 2, 1), fx: oneOf(str(b.fx, 10), FX, 'none') };
        },
        async ctx => {
          let chans = ctx.audio.channels;
          if (ctx.st) chans = chans.map(c => dsp.pitchShift(c, ctx.audio.sampleRate, ctx.st));
          if (ctx.rate !== 1) chans = chans.map(c => dsp.rateChange(c, ctx.audio.sampleRate, ctx.rate));
          if (ctx.fx !== 'none') chans = chans.map(c => dsp.applyFx(c, ctx.audio.sampleRate, ctx.fx));
          const buf = dsp.encodeWav(chans, ctx.audio.sampleRate);
          const saved = b.save ? saveRender(buf, 'vc', uid) : null;
          return { seconds: wavSeconds(buf), respond: () => send(res, 200, buf, { 'Content-Type': 'audio/wav', 'X-Reachmark-Url': saved || '', ...creditHeader(user), 'Cache-Control': 'no-store' }) };
        });
    }
    if (p === '/api/separate' && req.method === 'POST') {
      if (!needFlag('sep')) return;
      const b = JSON.parse(await readBody(req));
      return paid(res, user, costs.separate || 30,
        () => {
          const raw = b64ToBuf(b.audio);
          if (raw.length > MAX_UPLOAD) throw Object.assign(new Error('Upload too large — 20 MB max.'), { status: 413 });
          const audio = dsp.decodeWav(raw);
          const sep = dsp.separate(audio);
          if (!sep) throw Object.assign(new Error('Stereo audio is required for Quick Vocal Remove.'), { status: 422 });
          return sep;
        },
        async sep => {
          const out = { vocals: saveRender(dsp.encodeWav([sep.vocals], sep.sr), 'sep_v', uid), instrumental: saveRender(dsp.encodeWav([sep.inst], sep.sr), 'sep_i', uid) };
          return { seconds: 0, respond: () => json(res, 200, out, creditHeader(user)) };
        });
    }
    if (p === '/api/clone' && req.method === 'POST') {
      if (!needFlag('match')) return;
      const b = JSON.parse(await readBody(req));
      return paid(res, user, costs.match || 150,
        () => {
          if (store.voices.list(uid).length >= slots) throw Object.assign(new Error('Voice slot limit reached on Free (3). Start the Plus trial from Account → Upgrade.'), { status: 402 });
          const raw = b64ToBuf(b.sample);
          if (raw.length > MAX_UPLOAD) throw Object.assign(new Error('Upload too large — 20 MB max.'), { status: 413 });
          const audio = dsp.decodeWav(raw);
          const secs = audio.channels[0].length / audio.sampleRate;
          if (secs < 2) throw Object.assign(new Error('Sample too short — record at least 2 seconds (10 recommended).'), { status: 422 });
          return { raw, name: str(b.name, 60) || 'Matched voice', note: str(b.note, 200) };
        },
        async ctx => {
          const profile = matchProfile(uid, ctx.name, ctx.raw, ctx.note);
          return { seconds: 0, respond: () => json(res, 200, { voice: profile }, creditHeader(user)) };
        });
    }
    if (p.startsWith('/api/render/')) {
      const file = path.basename(p);
      if (store.renders.owner(file) !== uid) return json(res, 404, { error: 'not found' });
      const fp = path.join(RENDER, file);
      if (fs.existsSync(fp)) return wav(res, fs.readFileSync(fp), { 'Cache-Control': 'private, max-age=86400' });
      return json(res, 404, { error: 'not found' });
    }

    /* ---- character agent chat (LLM with on-device fallback) ---- */
    if (p === '/api/agent/chat' && req.method === 'POST') {
      if (!needFlag('agents')) return;
      const b = JSON.parse(await readBody(req, 1e6));
      const message = str(b.message, 2000)?.trim();
      if (!message) return json(res, 400, { error: 'Message is required.' });
      if (!store.rateLimit('chat:' + uid, 30, 60000)) return json(res, 429, { error: 'Slow down — message limit reached.' });
      const agent = store.agents.get(uid, str(b.agentId, 40));
      if (!agent) return json(res, 404, { error: 'Agent not found.' });
      if (agent.disabled) return json(res, 403, { error: 'This agent has been disabled by support.' });
      const history = Array.isArray(b.history)
        ? b.history.slice(-12).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: str(m.content, 1500) })).filter(m => m.content)
        : [];
      const run = async () => {
        let out = null;
        try { out = await llm.chat({ agent, history, message }); } catch {}
        if (!out) out = { content: brainS.respond(agent, message), source: 'local' };
        return out;
      };
      if (agent.system) { const out = await run(); return json(res, 200, out); } // platform Guide is free
      const cost = costs.chat || 2;
      return paid(res, user, cost, () => ({}), async () => {
        const out = await run();
        return { seconds: 0, respond: () => json(res, 200, { ...out, ...creditHeader(user) }) };
      });
    }

    /* ---- live support (threads + SSE) ---- */
    if (p.startsWith('/api/support')) {
      if (!needFlag('support')) return;
      if (p === '/api/support/state' && req.method === 'GET') {
        const t = store.support.threadForUser(uid);
        return json(res, 200, { thread: t || null, messages: t ? store.support.messages(t.id).filter(m => m.sender !== 'note') : [] });
      }
      if (p === '/api/support/escalate' && req.method === 'POST') {
        const b = JSON.parse(await readBody(req, 1e5));
        let t = store.support.threadForUser(uid);
        if (!t) t = store.support.createThread(uid, str(b.subject, 60) || 'Support request');
        if (t.status !== 'open') store.support.updateThread(t.id, { status: 'open' });
        const m = store.support.addMessage(t.id, 'bot', 'You are now connected to the Reachmark support team. They can see your plan and recent activity to help you faster.');
        store.support.updateThread(t.id, { lastMessageAt: m.createdAt, unreadByAdmin: (t.unreadByAdmin || 0) + 1 });
        mail.send({ to: SUPPORT_EMAIL, ...tpl.adminThreadNotice({ adminEmail: SUPPORT_EMAIL, threadId: t.id, userEmail: user.email, preview: (t.subject || '').slice(0, 200), url: ADMIN_URL }) }).catch(() => {});
        return json(res, 200, { thread: store.support.thread(t.id), message: m });
      }
      if (p === '/api/support/message' && req.method === 'POST') {
        if (!store.rateLimit('sup:' + uid, 10, 60000)) return json(res, 429, { error: 'Too many messages — slow down a little.' });
        const b = JSON.parse(await readBody(req, 1e5));
        const text = str(b.text, 2000)?.trim();
        if (!text) return json(res, 400, { error: 'Message is required.' });
        let t = store.support.threadForUser(uid);
        if (!t) t = store.support.createThread(uid, text.slice(0, 60));
        const m = store.support.addMessage(t.id, 'user', text);
        store.support.updateThread(t.id, { lastMessageAt: m.createdAt, unreadByAdmin: (t.unreadByAdmin || 0) + 1, status: t.status === 'pending' ? 'open' : t.status });
        return json(res, 200, { thread: store.support.thread(t.id), message: m });
      }
      if (p === '/api/support/read' && req.method === 'POST') {
        const t = store.support.threadForUser(uid);
        if (t) store.support.markRead(t.id, 'user');
        return json(res, 200, { ok: true });
      }
      if (p === '/api/support/typing' && req.method === 'POST') {
        const t = store.support.threadForUser(uid);
        if (t) store.db.prepare('INSERT OR REPLACE INTO typing (threadId,side,at) VALUES (?,?,?)').run(t.id, 'user', Date.now());
        return json(res, 200, { ok: true });
      }
      if (p === '/api/support/stream' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        res.write('retry: 3000\n\n');
        let last = Date.now() - 1000;
        const iv = setInterval(() => {
          const t = store.support.threadForUser(uid);
          if (t) {
            const msgs = store.support.messages(t.id).filter(m => m.createdAt > last && m.sender !== 'note');
            for (const m of msgs) res.write('event: message\ndata: ' + JSON.stringify(m) + '\n\n');
            if (msgs.length) last = msgs[msgs.length - 1].createdAt;
            const typ = store.db.prepare('SELECT at FROM typing WHERE threadId=? AND side=?').get(t.id, 'admin');
            if (typ && Date.now() - typ.at < 4000) res.write('event: typing\ndata: {"side":"admin"}\n\n');
            const th = store.support.thread(t.id);
            res.write('event: state\ndata: ' + JSON.stringify({ status: th.status, unreadByUser: th.unreadByUser }) + '\n\n');
          }
          res.write(': ping\n\n');
        }, 1200);
        req.on('close', () => clearInterval(iv));
        return;
      }
    }
    return json(res, 404, { error: 'not found' });
  } catch (e) {
    if (e.status === 413) return json(res, 413, { error: e.message });
    json(res, 500, { error: e.message || 'server error' });
  }
});

store.sessions.purge();
const PORT = process.env.PORT || 8000;
server.listen(PORT, '0.0.0.0', () => console.log('Reachmark Audio serving on :' + PORT));
