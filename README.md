# 🎙️ Reachmark Audio

**One engine. Every voice. Every language.**
Reachmark Audio is the completed, merged build of the *Reachmark Voice* project (`leephil1907-lab/Reachmarkvoicetts`) — a single product fusing five imported codebases into one runtime, shipped as a **responsive web app** (mobile + desktop browsers, installable PWA) and a **desktop application** (Electron shell in `desktop/`).

Built for **worldwide use**: accounts, voice translation across languages, and support channels for every region.

---

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
npm start                   # → http://localhost:8000
```

### Deploy (Render / Docker)

```bash
docker build -t reachmark-audio . && docker run -p 8000:8000 -v reachmark-data:/data reachmark-audio
# or: render.yaml (Docker runtime + 2 GB persistent disk at /data)
```

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
├── web/               # responsive app (vanilla ES modules, no build step)
│   ├── index.html  sw.js  css/app.css  manifest.webmanifest
│   ├── js/ core.js audio.js brain.js auth.js views-a.js views-b.js main.js
│   └── assets/ icons (96/192/512 + maskable), favicon.svg
├── desktop/           # Electron shell (VoiceStudio packaging pattern)
├── engines/           # download-voices.sh (Piper models live on DATA_DIR disk)
├── tools/pwa-audit.js # local PWABuilder-style checklist (29/29)
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

## Contact

- reachmarkofficial@gmail.com — general & account enquiries
- support@reachmarkdigital.com — technical support & billing

---

*Reachmark Digital · worldwide · merged build v1.2*
