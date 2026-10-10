# 🎙️ Reachmark Audio

**One engine. Every voice. Every language.**
Reachmark Audio is a product of **Reachmark Digital** — the completed, merged build of the *Reachmark Voice* project (`leephil1907-lab/Reachmarkvoicetts`) — a single product fusing five imported codebases into one runtime, shipped as a **responsive web app** (mobile + desktop browsers, installable PWA) and a **desktop application** (Electron shell in `desktop/`).

Built for **worldwide use**: accounts, voice translation across languages, and support channels for every region.

---

## New in v1.3

- **Real character agents** — every agent chat & voice call now runs through the server
  (`POST /api/agent/chat`): the agent's persona/role/knowledge become a system prompt for an
  OpenAI-compatible LLM (`LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` env). History is capped
  (12 messages), the route is rate-limited (30 msgs/min/user) and charged server-side
  (2 ✦ per reply, atomic refund on failure — the platform Guide stays free). With no LLM key
  configured, agents fall back to the built-in persona brain (`server/brain.js`) — replies are
  still spoken with the agent's own voice via `/api/tts` in the agent's language.
  Builder fields: name, **avatar (emoji)**, role, **personality traits**, greeting, knowledge
  notes, voice (stock / matched / designed), **language**.
- **Separate admin app** (`admin/`) — its own server (`admin/server.js`, `ADMIN_PORT`, meant for
  its own subdomain), its own dark control-room UI, zero links/routes/service-worker entries from
  the public app. Protection is authentication, not hiding: role `admin`/`support` only, first
  admin seeded **only** from `ADMIN_EMAIL` + `ADMIN_PASSWORD` env, **mandatory TOTP 2FA**,
  separate `rm_admin` cookie (HttpOnly, SameSite=Strict, Secure on HTTPS, 8 h), lockout after
  5 failures, optional `ADMIN_IP_ALLOWLIST`, CSRF token on every state-changing call, strict
  CSP + `X-Robots-Tag: noindex`. Pages: Dashboard · Users (credits/plan/trial/suspend/force
  logout/delete — never exposes hashes or tokens) · Support inbox · Studio workspace (no credit
  charges) · Site control (maintenance, announcement, signups, costs, signup credits, flags) ·
  Agents & voices moderation · Audit log · Admins. **Every admin write is audit-logged**
  (who, action, target, IP, time, meta); listening to a user's samples/renders requires a
  click-confirmed `ack=1` that is itself audited.
- **Live support chat** — Support → *Live chat* starts with the Guide bot; a **"Talk to a
  human"** button (or two unanswered questions) escalates to a real thread in the admin inbox.
  Real-time SSE both ways (typing indicators, delivered/read ticks, unread badges + sound in the
  inbox, auto-reconnect, 5 s polling fallback), internal notes invisible to users, quick-reply
  templates, assign/close/reopen, offline users get their reply in-app on next open plus an
  email notification (`SUPPORT_EMAIL`). Messages are rate-limited (10/min), escaped and capped
  (2 000 chars).

## Honest feature labelling (v1.2)

- **Voice Match** (not "voice clone"): analyses pitch + pace from a 10-second sample and tunes the nearest neural voice to you. True speaker-embedding cloning (XTTS / OpenVoice) plugs into the **same endpoint** (`/api/clone`) automatically when a GPU engine is attached via `server/engines.js`.
- **Quick Vocal Remove** (not "AI separation"): center-channel reduction for stereo mixes (vocal bus + karaoke bus). A Demucs-class engine plugs into the same endpoint (`/api/separate`) when attached.
- Everything else (neural TTS, voice translation, changer DSP, dubbing, lip sync, agents, calls) runs on real engines today.

## Accounts & credits (real usage)

- **Sign up** grants **10,000 ✦ credits** instantly.
- Scrypt-hashed passwords (async, constant-time compare), 30-day HttpOnly cookies (`Secure` behind HTTPS), rate-limited login/signup (5 per 15 min per IP+email), 8+ char passwords.
- **Server-side billing with atomic refunds**: any failed render refunds the exact charge. TTS ≈ 1 ✦ / 40 chars · voice change 20 ✦ · Voice Match 150 ✦ · Quick Vocal Remove 30 ✦ · dubbing 15 ✦ / take.
- **Plus**: one 7-day trial per account (`trialUsed` enforced server-side, expiry checked on every request). Sales: support@reachmarkdigital.com.
- Storage: **SQLite** (better-sqlite3) in `DATA_DIR` (env-configurable for persistent disks).

## Run it

```bash
npm install                 # better-sqlite3
./engines/download-voices.sh   # Piper neural voices (en/fr/es/de)
pip install piper-tts       # CPU neural TTS runtime
npm start                   # runs BOTH apps (scripts/run-all.sh)
                            #   public PWA → http://localhost:8000
                            #   admin app  → http://localhost:8001
```

Admin app env (first admin is seeded from these — never from public signup):

```bash
ADMIN_EMAIL=you@reachmarkdigital.com ADMIN_PASSWORD='strong-temp-pass' \
ADMIN_PORT=8001 \
ADMIN_IP_ALLOWLIST=            # optional: comma-separated IPs allowed to reach /admin APIs
SUPPORT_EMAIL=support@reachmarkdigital.com \
LLM_API_KEY=sk-...             # optional: OpenAI-compatible key for character agents
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
npm run start:admin            # admin only · npm run start:web → public only
```

At first admin login the gate shows a TOTP secret (scan/paste into any authenticator);
2FA is mandatory from then on.

### Transactional email (SMTP)

Branded HTML templates (with the Reachmark Digital company footer) are sent for:
**welcome/signup**, **password reset** (single-use 30-min link → `/#/reset/<token>`),
**password-changed security notice**, **support reply while the user is offline**,
**suspension / reinstatement notices** and **support-inbox notifications**.

```bash
SMTP_HOST=smtp.gmail.com SMTP_PORT=587 \
SMTP_USER=reachmarkofficial@gmail.com SMTP_PASS='<gmail app password>' \
MAIL_FROM='Reachmark Audio <reachmarkofficial@gmail.com>'   # optional
```

Any SMTP server works (SES, Postmark, Mailgun…) — port 465 switches to implicit TLS.
Without SMTP config nothing is lost: messages append to `data/outbox.log`. Gmail note:
use an **App Password** (2-step verification → app passwords); the From address is always
rewritten to the authenticated account. The password lives in env only — never in git.

### Tests

```bash
npm test          # integration suite: spawns BOTH servers on test ports w/ throwaway DATA_DIR
                  # asserts: non-admin → 401/403 on admin APIs · 2FA required · lockout after 5
                  # failures · credit changes audit-logged · support roundtrip < 2 s each way
                  # + CSRF, maintenance/signup/flag gates, SSE delivery, suspension, moderation
npm run audit:pwa # PWA checklist (29/29)
```

### Deploy (Render / Docker)

```bash
docker build -t reachmark-audio .
docker run -p 8000:8000 -p 8001:8001 -v reachmark-data:/data \
  -e ADMIN_EMAIL=you@reachmarkdigital.com -e ADMIN_PASSWORD='strong-temp-pass' reachmark-audio
# or: render.yaml (Docker runtime + 2 GB persistent disk at /data)
```

### Deploy (Railway)

`railway.json` + `Dockerfile` are Railway-ready: the Docker build installs Piper in a venv,
bakes the en/fr/es/de voices **and a render smoke-test** into the image (the build fails if
Piper or the voices are broken), installs native deps (`npm ci`), then symlinks `/app/data`
to the Railway volume mounted at `/data` so accounts, voices and renders persist.
`railway.json` sets the healthcheck (`/api/health`), restart policy and start command
(`node server/server.js` — the public app; run the admin app as its own service when you
split storage, see below). Attach a volume with mount path `/data` in the Railway dashboard.

**Two services, one database — the honest constraint:** both apps share ONE SQLite file on ONE
persistent disk (WAL makes multi-process access safe), and Render attaches a disk to exactly one
service. `render.yaml` therefore deploys **one container running both processes**
(`scripts/run-all.sh`: public on `$PORT`, admin on `ADMIN_PORT=8001`); point a reverse proxy
(nginx/Caddy/Cloudflare Tunnel) at :8001 for `admin.yourdomain.com`. True two-service split with
separate subdomains requires migrating to a shared Postgres — the Blueprint skeleton for that is
commented inside `render.yaml`.

The Docker image installs python3 + `piper-tts`; the entrypoint downloads voices into
`$PIPER_VOICES_DIR` (on the persistent disk) on first boot. `/api/health` reports
`piper.ready`, voice count, db engine and `DATA_DIR`.

## Studios

| Studio | Route | Engine path |
|---|---|---|
| Dashboard | `#/home` | Credits, voices, renders, studio minutes + quick actions + history |
| Text to Speech | `#/studio/tts` | Piper voices → Core DSP → **output language picker (voice translation)** |
| Voice Changer | `#/studio/changer` | Upload/record → pitch/OLA + robot/radio/echo chains |
| Voice Match | `#/studio/clone` | 10 s sample → F0 + pace → tuned neural profile (GPU cloning slot ready) |
| Voice Design | `#/studio/design` | Plain-text description → trait parser → parameterized voice |
| Dubbing Studio | `#/studio/dub` | Multilingual takes, sequence playback, downloads |
| Lip Sync Studio | `#/studio/lip` | Audio-driven character + **WebM video export** |
| Quick Vocal Remove | `#/studio/separate` | Mid/side mask → vocal + instrumental buses (Demucs slot ready) |
| Character Agents | `#/agents` · `#/agent/:id` · `#/call/:id` | Persona + knowledge brain, chat, live voice calls |
| Discover Voices | `#/discover` | Worldwide catalogue → My Voices |
| Support Center | `#/support` | Live chat + support session with the **Reachmark Guide**, FAQ, emails |
| Engine Hub | `#/engines` | Live status of every merged engine |
| Account | `#/account` | Profile, credits, Plus trial, appearance, language, terms, logout |

**Platform Guide**: every account ships with an AI assistant agent that knows every studio,
price and shortcut — chat or call it from the Support Center or the life-buoy button.

**Command palette**: Ctrl / Cmd + K anywhere. **Uploads**: 20 MB max, enforced client + server.

## Motion & UX

Splash intro, view enter/exit transitions, staggered reveals, spring bottom sheets, animated
dropdown menus, loading skeletons, ripples, live waveforms, pulse rings, FAQ accordions,
shake-on-error auth, onboarding sheet, focus-visible rings, pinch-zoom allowed.
Dark / light / system themes.

## Repository layout

```
reachmark-audio/
├── server/            # control plane: auth, billing, SQLite stores, engines
│   ├── server.js  db.js  dsp.js  tts.js  engines.js
│   ├── llm.js         # OpenAI-compatible agent brain (env-keyed, graceful fallback)
│   ├── brain.js       # local persona fallback brain (no API key needed)
│   ├── totp.js        # RFC-6238 TOTP for mandatory admin 2FA
│   └── mail.js        # sendmail hook → data/outbox.log fallback
├── admin/             # SEPARATE admin app (own server, own design, own cookie)
│   ├── server.js      # ADMIN_PORT · roles · 2FA · CSRF · lockout · audit · SSE inbox
│   └── web/ index.html  admin.css  admin.js
├── scripts/run-all.sh # one container → public :PORT + admin :ADMIN_PORT
├── web/               # responsive app (vanilla ES modules, no build step)
│   ├── index.html  sw.js  css/app.css  manifest.webmanifest
│   ├── js/ core.js audio.js brain.js auth.js views-a.js views-b.js main.js
│   └── assets/ icons (96/192/512 + maskable), favicon.svg
├── desktop/           # Electron shell (VoiceStudio packaging pattern)
├── engines/           # download-voices.sh (Piper models live on DATA_DIR disk)
├── tools/pwa-audit.js # local PWABuilder-style checklist (29/29)
├── tools/tests.js     # v1.3 integration suite (77 assertions, both servers)
├── vendor/            # the five imported repositories (pristine clones, not published)
├── Dockerfile  docker-entrypoint.sh  render.yaml  package.json
├── ENGINE_MERGE.md    # which component came from which repo
└── README.md
```

## Security notes

- CSP (no inline scripts, frame-ancestors none), X-Content-Type-Options, X-Frame-Options,
  Referrer-Policy, HSTS behind HTTPS; cookies HttpOnly + SameSite=Lax (+ Secure on HTTPS).
- No wildcard CORS (optional single origin via `CORS_ORIGIN` env).
- Renders are owned per account; `/api/render/*` serves only the owner.
- Inputs whitelisted on voice/agent/history create+update; mass assignment not possible.
- Piper children: 30 s hard timeout, per-user concurrency 1, capped global queue (429).
- **Admin app (v1.3)**: role-gated (`admin`/`support`), env-seeded first admin, mandatory TOTP
  2FA, separate HttpOnly/SameSite=Strict 8 h cookie, 5-failure lockout, optional IP allowlist,
  CSRF token on every write, `noindex` + strict CSP, and an audit row for **every** admin write.
  Admins can see emails/plans/credits/activity — never password hashes or session tokens.
  User sample/render playback requires a deliberate click-confirmed `ack=1`, itself audited.
- Support chat: server-side escaping, 2 000-char cap, 10 msgs/min rate limit; internal notes
  never leave the admin side.

## Contact

- reachmarkofficial@gmail.com — general & account enquiries
- support@reachmarkdigital.com — technical support & billing

---

*Reachmark Digital · worldwide · merged build v1.3*
