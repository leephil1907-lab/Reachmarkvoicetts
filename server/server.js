// Reachmark Audio — unified server (zero-dependency Node)
// Real-usage control plane: accounts, sessions, per-user studios, credit billing,
// merged engine hub (Piper runtime + Core DSP + clone/separation pipelines).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dsp = require('./dsp');
const tts = require('./tts');
const engines = require('./engines');

const WEB = path.join(__dirname, '..', 'web');
const DATA = path.join(__dirname, '..', 'data');
const RENDER = path.join(DATA, 'renders');
const USERS_DB = path.join(DATA, 'users.json');
const SESSIONS_DB = path.join(DATA, 'sessions.json');
for (const d of [DATA, RENDER]) fs.mkdirSync(d, { recursive: true });

/* ---------------- storage ---------------- */
const readJson = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } };
const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2));
const loadUsers = () => readJson(USERS_DB, {});
const saveUsers = u => writeJson(USERS_DB, u);
const loadSessions = () => readJson(SESSIONS_DB, {});
const saveSessions = s => writeJson(SESSIONS_DB, s);
const userDir = uid => { const d = path.join(DATA, 'u', uid); for (const s of ['', 'samples']) fs.mkdirSync(path.join(d, s), { recursive: true }); return d; };
const uVoices = uid => readJson(path.join(userDir(uid), 'voices.json'), []);
const sVoices = (uid, v) => writeJson(path.join(userDir(uid), 'voices.json'), v);
const uAgents = uid => readJson(path.join(userDir(uid), 'agents.json'), []);
const sAgents = (uid, v) => writeJson(path.join(userDir(uid), 'agents.json'), v);
const uHistory = uid => readJson(path.join(userDir(uid), 'history.json'), []);
const sHistory = (uid, v) => writeJson(path.join(userDir(uid), 'history.json'), v);

const SIGNUP_CREDITS = 10000;
const hashPass = (pass, salt) => crypto.scryptSync(pass, salt, 32).toString('hex');
const pubUser = u => ({ id: u.id, name: u.name, email: u.email, credits: u.credits, plan: u.plan, minutes: Math.round((u.minutes || 0) * 10) / 10, trialEnds: u.trialEnds || null, created: u.created });

/* ---------------- guide agent (platform assistant) ---------------- */
function guideAgent() {
  return {
    id: 'guide', name: 'Reachmark Guide', role: 'Official platform assistant · knows every studio',
    persona: 'warm, concise, helpful', system: true, av: '',
    greeting: 'Hi! I am the Reachmark Guide — I know every studio, engine and shortcut on this platform. What would you like to do today?',
    voiceId: null, model: null, created: Date.now(),
    knowledge: [
      'Credits: every new account starts with 10,000 credits. TTS costs about 1 credit per 40 characters, voice change 20, cloning 150, separation 30, dubbing 15 per take.',
      'Plans: Free includes 3 voice slots and core studios. Plus adds 200 minutes of generation, 10 private voice slots, Voice Design priority and commercial use — start the 7-day trial from Account → Upgrade.',
      'Voice cloning: open Create → Instant Voice Clone, record 10 seconds (or upload a clean sample), name it, and the encoder analyses pitch and pace to match the nearest neural voice. The clone then works in every studio.',
      'Voice translation: any voice — including clones — can speak in English, French, Spanish or German. Pick the output language in Text to Speech before generating; your voice character (pitch, pace, colour) carries across languages.',
      'Voice Changer: upload or record, then apply presets (Deep, Sub, Bright, Air), fine pitch in semitones, speed and expression colours (Robot, Radio, Echo). Conversion runs on the Core DSP engine.',
      'Voice Design: describe a voice in plain text — e.g. warm deep male narrator with vintage radio colour — and the trait parser builds it. Preview before saving.',
      'Dubbing Studio: write one line per language, choose a neural voice per take, render all, play the sequence and download each WAV.',
      'Lip Sync Studio: synthesize or upload audio, pick a scene, press Perform — the character lips, brows and blinks follow the audio. Export video downloads a WebM file.',
      'Audio Separation: upload a stereo mix to split a center-extracted vocal bus and an instrumental (karaoke) bus.',
      'Character agents: build a persona with a name, role, personality and knowledge base, then chat or place a live voice call — the agent answers from its brief and speaks with your chosen voice.',
      'Downloads: every render shows a download button. Renders are WAV files; lip sync exports are WebM video.',
      'History: everything you render is stored per account under Home → History tabs (TTS, Voice Changer, Separation, Dubbing, Lip Sync, Clones).',
      'Engines: Reachmark Audio merges five engine codebases — Reachmark Core, Piper neural TTS, Real-Time-Voice-Cloning, MockingBird and ChatterBox — plus VoiceStudio patterns. Live status is in Account → Engine Hub.',
      'Privacy: voice samples and renders are stored only in your account workspace. Clone only voices you have rights to.',
      'Support: live chat and support sessions are in the Support Center (life-buoy button). Email reachmarkofficial@gmail.com or support@reachmarkdigital.com.',
      'Keyboard: press Ctrl or Cmd + K anywhere for the command palette; it jumps to any studio or action.',
      'Troubleshooting playback: if a browser blocks audio, tap play once more — browsers require one user gesture before sound.',
      'Troubleshooting microphone: recording needs microphone permission; on mobile allow it in site settings, or upload a file instead.',
    ],
  };
}

/* ---------------- http helpers ---------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.wav': 'audio/wav', '.webm': 'audio/webm', '.ico': 'image/x-icon', '.json': 'application/json' };
function send(res, code, body, headers = {}) { res.writeHead(code, headers); res.end(body); }
function json(res, code, obj, headers = {}) { send(res, code, JSON.stringify(obj), { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }); }
function wav(res, buf, extra = {}) { send(res, 200, buf, { 'Content-Type': 'audio/wav', 'Content-Length': buf.length, 'Cache-Control': 'no-store', ...extra }); }
function readBody(req, limit = 40 * 1024 * 1024) {
  return new Promise((res, rej) => {
    let n = 0; const chunks = [];
    req.on('data', c => { n += c.length; if (n > limit) { rej(new Error('body too large')); req.destroy(); } chunks.push(c); });
    req.on('end', () => res(Buffer.concat(chunks)));
    req.on('error', rej);
  });
}
const b64ToBuf = s => Buffer.from(String(s).split(',')[1] || String(s), 'base64');
const saveRender = (buf, tag) => { const f = tag + '_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex') + '.wav'; fs.writeFileSync(path.join(RENDER, f), buf); return '/api/render/' + f; };
const wavSeconds = buf => { try { const sr = buf.readUInt32LE(24), ch = buf.readUInt16LE(22); return (buf.length - 44) / (sr * 2 * ch); } catch { return 0; } };

function cookieUser(req) {
  const m = /(?:^|;\s*)rm=([a-f0-9]{64})/.exec(req.headers.cookie || '');
  if (!m) return null;
  const s = loadSessions()[m[1]];
  if (!s || s.exp < Date.now()) return null;
  const u = loadUsers()[s.uid];
  return u ? { user: u, token: m[1] } : null;
}
function startSession(res, uid) {
  const token = crypto.randomBytes(32).toString('hex');
  const s = loadSessions(); s[token] = { uid, exp: Date.now() + 30 * 864e5 }; saveSessions(s);
  return `rm=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}`;
}
function charge(user, n) {
  if (user.credits < n) return false;
  const users = loadUsers(); users[user.id].credits -= n; users[user.id].minutes = (users[user.id].minutes || 0); saveUsers(users);
  user.credits -= n;
  return true;
}
function addMinutes(user, secs) { const users = loadUsers(); users[user.id].minutes = (users[user.id].minutes || 0) + secs / 60; saveUsers(users); user.minutes = users[user.id].minutes; }
const creditHeader = user => ({ 'X-Reachmark-Credits': String(user.credits) });

/* ---------------- voice clone ---------------- */
function cloneProfile(uid, name, sampleBuf, note) {
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
  fs.writeFileSync(path.join(userDir(uid), 'samples', id + '.wav'), sampleBuf);
  const profile = { id, name, kind: 'clone', note: note || '', desc: 'Cloned · F0 ' + Math.round(f0) + ' Hz · ' + (female ? 'female' : 'male') + ' range', model: model ? model.id : null, semitones, rate: +pace.toFixed(2), fx: 'none', f0: Math.round(f0), created: Date.now(), sample: '/api/voices/' + id + '/sample' };
  const all = uVoices(uid); all.push(profile); sVoices(uid, all);
  return profile;
}

/* ---------------- router ---------------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return send(res, 204, '');

  try {
    /* ---- public ---- */
    if (p === '/api/health') return json(res, 200, { ok: true, app: 'Reachmark Audio', version: '1.1.0', time: Date.now() });

    if (p === '/api/auth/signup' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req, 1e6));
      const name = String(b.name || '').trim(), email = String(b.email || '').trim().toLowerCase(), pass = String(b.password || '');
      if (name.length < 2) return json(res, 422, { error: 'Please enter your name.' });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res, 422, { error: 'That email address does not look valid.' });
      if (pass.length < 6) return json(res, 422, { error: 'Password must be at least 6 characters.' });
      const users = loadUsers();
      if (Object.values(users).some(u => u.email === email)) return json(res, 409, { error: 'An account with this email already exists. Log in instead.' });
      const salt = crypto.randomBytes(8).toString('hex');
      const uid = 'u_' + crypto.randomBytes(6).toString('hex');
      users[uid] = { id: uid, name, email, salt, pass: hashPass(pass, salt), credits: SIGNUP_CREDITS, plan: 'free', minutes: 0, created: Date.now() };
      saveUsers(users);
      userDir(uid);
      sAgents(uid, [guideAgent()]);
      const cookie = startSession(res, uid);
      return json(res, 200, { user: pubUser(users[uid]), fresh: true }, { 'Set-Cookie': cookie });
    }
    if (p === '/api/auth/login' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req, 1e6));
      const email = String(b.email || '').trim().toLowerCase(), pass = String(b.password || '');
      const users = loadUsers();
      const u = Object.values(users).find(x => x.email === email);
      if (!u || hashPass(pass, u.salt) !== u.pass) return json(res, 401, { error: 'Incorrect email or password.' });
      const cookie = startSession(res, u.id);
      return json(res, 200, { user: pubUser(u) }, { 'Set-Cookie': cookie });
    }
    if (p === '/api/auth/logout' && req.method === 'POST') {
      const c = cookieUser(req);
      if (c) { const s = loadSessions(); delete s[c.token]; saveSessions(s); }
      return json(res, 200, { ok: true }, { 'Set-Cookie': 'rm=; Path=/; HttpOnly; Max-Age=0' });
    }
    if (p === '/api/auth/me') {
      const c = cookieUser(req);
      return c ? json(res, 200, { user: pubUser(c.user) }) : json(res, 401, { error: 'not signed in' });
    }

    /* ---- static (public: the app shell + login page must load pre-auth) ---- */
    if (!p.startsWith('/api/')) {
      let file = p === '/' ? '/index.html' : p;
      file = path.normalize(file).replace(/^(\.\.[\/\\])+/, '');
      let fp = path.join(WEB, file);
      if (!fp.startsWith(WEB)) return json(res, 403, { error: 'no' });
      if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) fp = path.join(WEB, 'index.html');
      const ext = path.extname(fp);
      return send(res, 200, fs.readFileSync(fp), { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600' });
    }

    /* ---- protected ---- */
    const cu = cookieUser(req);
    if (!cu) return json(res, 401, { error: 'not signed in' });
    const user = cu.user, uid = user.id;

    if (p === '/api/me') return json(res, 200, { user: pubUser(user) });
    if (p === '/api/plan/trial' && req.method === 'POST') {
      if (user.plan === 'plus' && !user.trialEnds) return json(res, 409, { error: 'Plus is already active on this account.' });
      const users = loadUsers();
      users[uid].plan = 'plus'; users[uid].trialEnds = Date.now() + 7 * 864e5; saveUsers(users);
      return json(res, 200, { user: pubUser(users[uid]) });
    }
    if (p === '/api/models') return json(res, 200, { models: tts.catalog() });
    if (p === '/api/engines') return json(res, 200, { engines: await engines.status() });

    if (p === '/api/voices' && req.method === 'GET') return json(res, 200, { voices: uVoices(uid) });
    if (p === '/api/voices' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req, 1e6));
      const slots = user.plan === 'plus' ? 10 : 3;
      if (uVoices(uid).length >= slots) return json(res, 402, { error: 'Voice slot limit reached on Free (3). Start the Plus trial from Account → Upgrade.' });
      const profile = { id: 'v_' + crypto.randomBytes(4).toString('hex'), kind: b.kind || 'design', name: b.name || 'Untitled voice', desc: b.desc || '', tags: b.tags || [], model: b.model || null, semitones: +b.semitones || 0, rate: +b.rate || 1, fx: b.fx || 'none', created: Date.now() };
      const all = uVoices(uid); all.push(profile); sVoices(uid, all);
      return json(res, 200, { voice: profile });
    }
    if (p.startsWith('/api/voices/') && req.method === 'DELETE') {
      const id = p.split('/')[3];
      sVoices(uid, uVoices(uid).filter(v => v.id !== id));
      try { fs.unlinkSync(path.join(userDir(uid), 'samples', id + '.wav')); } catch {}
      return json(res, 200, { ok: true });
    }
    if (p.startsWith('/api/voices/') && p.endsWith('/sample')) {
      const f = path.join(userDir(uid), 'samples', path.basename(p.split('/')[3]) + '.wav');
      if (fs.existsSync(f)) return wav(res, fs.readFileSync(f));
      return json(res, 404, { error: 'no sample' });
    }

    if (p === '/api/agents' && req.method === 'GET') return json(res, 200, { agents: uAgents(uid) });
    if (p === '/api/agents' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req, 1e6));
      const a = { id: 'a' + crypto.randomBytes(4).toString('hex'), created: Date.now(), system: false, ...b };
      const all = uAgents(uid); all.push(a); sAgents(uid, all);
      return json(res, 200, { agent: a });
    }
    if (p.startsWith('/api/agents/') && req.method === 'PUT') {
      const id = p.split('/')[3]; const b = JSON.parse(await readBody(req, 1e6));
      const all = uAgents(uid).map(a => a.id === id ? { ...a, ...b, id } : a);
      sAgents(uid, all); return json(res, 200, { agent: all.find(a => a.id === id) });
    }
    if (p.startsWith('/api/agents/') && req.method === 'DELETE') {
      const id = p.split('/')[3];
      const a = uAgents(uid).find(x => x.id === id);
      if (a?.system) return json(res, 403, { error: 'The platform Guide cannot be removed.' });
      sAgents(uid, uAgents(uid).filter(x => x.id !== id));
      return json(res, 200, { ok: true });
    }

    if (p === '/api/history' && req.method === 'GET') return json(res, 200, { history: uHistory(uid) });
    if (p === '/api/history' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req, 1e6));
      const item = { id: 'h_' + crypto.randomBytes(4).toString('hex'), at: Date.now(), ...b };
      const all = uHistory(uid); all.unshift(item); sHistory(uid, all.slice(0, 80));
      return json(res, 200, { item });
    }
    if (p.startsWith('/api/history/') && req.method === 'DELETE') {
      const id = p.split('/')[3];
      sHistory(uid, uHistory(uid).filter(x => x.id !== id));
      return json(res, 200, { ok: true });
    }

    if (p === '/api/tts' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req, 2e6));
      if (!b.text || !String(b.text).trim()) return json(res, 400, { error: 'Text is required.' });
      const cost = Math.max(5, Math.ceil(String(b.text).length / 40));
      if (!charge(user, cost)) return json(res, 402, { error: 'Not enough credits. Top up or start the Plus trial from Account.' });
      let opts = { text: String(b.text).trim(), model: b.model, lang: b.lang, semitones: +b.semitones || 0, rate: +b.rate || 1, fx: b.fx || 'none' };
      if (b.voiceId) {
        const v = uVoices(uid).find(x => x.id === b.voiceId);
        if (v) opts = { ...opts, model: v.model ?? opts.model, semitones: opts.semitones || v.semitones, rate: b.rate ? opts.rate : (v.rate || 1), fx: opts.fx === 'none' ? v.fx : opts.fx };
      }
      try {
        const { buf, voice } = await tts.synthesize(opts);
        addMinutes(user, wavSeconds(buf));
        const out = { voice: voice.id, url: b.save ? saveRender(buf, 'tts') : null };
        return send(res, 200, buf, { 'Content-Type': 'audio/wav', 'X-Reachmark-Url': out.url || '', 'X-Reachmark-Cost': String(cost), ...creditHeader(user), 'Cache-Control': 'no-store' });
      } catch (e) {
        const users = loadUsers(); users[uid].credits += cost; saveUsers(users);
        return json(res, 502, { error: e.message });
      }
    }
    if (p === '/api/voice-change' && req.method === 'POST') {
      if (!charge(user, 20)) return json(res, 402, { error: 'Not enough credits.' });
      const b = JSON.parse(await readBody(req));
      const audio = dsp.decodeWav(b64ToBuf(b.audio));
      const st = +b.semitones || 0, fx = b.fx || 'none', rate = +b.rate || 1;
      let chans = audio.channels;
      if (st) chans = chans.map(c => dsp.pitchShift(c, audio.sampleRate, st));
      if (rate !== 1) chans = chans.map(c => dsp.rateChange(c, audio.sampleRate, rate));
      if (fx !== 'none') chans = chans.map(c => dsp.applyFx(c, audio.sampleRate, fx));
      const buf = dsp.encodeWav(chans, audio.sampleRate);
      addMinutes(user, wavSeconds(buf));
      return send(res, 200, buf, { 'Content-Type': 'audio/wav', 'X-Reachmark-Url': b.save ? saveRender(buf, 'vc') : '', ...creditHeader(user), 'Cache-Control': 'no-store' });
    }
    if (p === '/api/separate' && req.method === 'POST') {
      if (!charge(user, 30)) return json(res, 402, { error: 'Not enough credits.' });
      const b = JSON.parse(await readBody(req));
      const audio = dsp.decodeWav(b64ToBuf(b.audio));
      const sep = dsp.separate(audio);
      if (!sep) return json(res, 422, { error: 'Stereo audio is required for center-channel separation.' });
      return json(res, 200, { vocals: saveRender(dsp.encodeWav([sep.vocals], sep.sr), 'sep_v'), instrumental: saveRender(dsp.encodeWav([sep.inst], sep.sr), 'sep_i'), credits: user.credits }, creditHeader(user));
    }
    if (p === '/api/clone' && req.method === 'POST') {
      const slots = user.plan === 'plus' ? 10 : 3;
      if (uVoices(uid).length >= slots) return json(res, 402, { error: 'Voice slot limit reached on Free (3). Start the Plus trial from Account → Upgrade.' });
      if (!charge(user, 150)) return json(res, 402, { error: 'Not enough credits for cloning (150).' });
      const b = JSON.parse(await readBody(req));
      const profile = cloneProfile(uid, b.name || 'Cloned voice', b64ToBuf(b.sample), b.note);
      return json(res, 200, { voice: profile }, creditHeader(user));
    }
    if (p.startsWith('/api/render/')) {
      const fp = path.join(RENDER, path.basename(p));
      if (fs.existsSync(fp)) return wav(res, fs.readFileSync(fp), { 'Cache-Control': 'public, max-age=86400' });
      return json(res, 404, { error: 'not found' });
    }
    return json(res, 404, { error: 'not found' });
  } catch (e) {
    json(res, 500, { error: e.message || 'server error' });
  }
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, '0.0.0.0', () => console.log('Reachmark Audio serving on :' + PORT));
