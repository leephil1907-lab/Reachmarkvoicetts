# 🎙️ Reachmark Audio

**One engine. Every voice. Every language.**
Reachmark Audio is the completed, merged build of the *Reachmark Voice* project (`leephil1907-lab/Reachmarkvoicetts`) — a single product fusing five imported codebases into one runtime, shipped as a **responsive web app** (mobile + desktop browsers, installable PWA) and a **desktop application** (Electron shell in `desktop/`).

Built for **worldwide use**: accounts, voice translation across languages, and support channels for every region.

---

## Accounts & credits (real usage)

- **Sign up** grants **10,000 ✦ credits** instantly — no demo modes anywhere.
- Sessions are real: scrypt-hashed passwords, 30-day HttpOnly cookies, per-user workspaces (voices, agents, history, samples stored per account).
- **Server-side billing** on every engine call: TTS ≈ 1 ✦ / 40 chars · voice change 20 ✦ · clone 150 ✦ · separation 30 ✦ · dubbing 15 ✦ / take. Balances update live in the top bar.
- **Plus plan**: 7-day trial from Account → Upgrade (200 minutes, 10 voice slots, commercial use). Sales: support@reachmarkdigital.com.
- **Logout** from the avatar menu, sidebar, or Account.

## Quick start

```bash
node server/server.js            # → http://localhost:8000  (sign up in the browser)
cd desktop && npm i && npm start # Electron desktop app wrapping the same stack
```

Neural TTS runtime (Piper, CPU ONNX) ships installed under `engines/piper-voices/`
(en · fr · es · de). GPU engines hot-swap in when a torch runtime exists.

## What you can do

| Studio | Route | Engine path |
|---|---|---|
| Dashboard | `#/home` | Credits, voices, renders, studio minutes + quick actions + history |
| Text to Speech | `#/studio/tts` | Piper voices → Core DSP → **output language picker (voice translation)** |
| Voice Changer | `#/studio/changer` | Upload/record → pitch/OLA + robot/radio/echo chains |
| Instant Voice Clone | `#/studio/clone` | 10 s sample → F0 + pace analysis → matched neural profile, speaks all languages |
| Voice Design | `#/studio/design` | Plain-text description → trait parser → parameterized voice |
| Dubbing Studio | `#/studio/dub` | Multilingual takes, sequence playback, downloads |
| Lip Sync Studio | `#/studio/lip` | Audio-driven character + **WebM video export** |
| Audio Separation | `#/studio/separate` | Mid/side mask → vocal + instrumental buses |
| Character Agents | `#/agents` · `#/agent/:id` · `#/call/:id` | Persona + knowledge brain, chat, live voice calls |
| Discover Voices | `#/discover` | Worldwide catalogue → My Voices |
| Support Center | `#/support` | Live chat + support session with the **Reachmark Guide**, FAQ, email contacts |
| Engine Hub | `#/engines` | Live status of every merged engine |
| Account | `#/account` | Profile, credits, Plus trial, appearance, language, terms, logout |

**Platform Guide**: every account ships with an AI assistant agent that knows every studio,
price and shortcut — chat or call it from the Support Center or the life-buoy button.

**Command palette**: Ctrl / Cmd + K anywhere.

## Motion & UX

Splash intro, view enter/exit transitions, staggered reveals, spring bottom sheets, animated
dropdown menus, loading skeletons, ripples, live waveforms, pulse rings, FAQ accordions,
shake-on-error auth, onboarding sheet — all state-driven per the Reachmark design rules.
Dark / light / system themes. Full keyboard focus rings.

## Repository layout

```
reachmark-audio/
├── server/            # control plane: auth, billing, per-user stores, engines
│   ├── server.js  dsp.js  tts.js  engines.js
├── web/               # responsive app (vanilla ES modules, no build step)
│   ├── index.html  css/app.css  manifest.webmanifest
│   ├── js/ core.js audio.js brain.js auth.js views-a.js views-b.js main.js
│   └── assets/ icon.png favicon.svg
├── desktop/           # Electron shell (VoiceStudio packaging pattern)
├── engines/piper-voices/   # neural ONNX voices (en/fr/es/de)
├── vendor/            # the five imported repositories (pristine clones)
├── data/              # users, sessions, per-user workspaces, renders
├── ENGINE_MERGE.md    # which component came from which repo
└── README.md
```

## Contact

- reachmarkofficial@gmail.com — general & account enquiries
- support@reachmarkdigital.com — technical support & billing

---

*Reachmark Digital · worldwide · merged build v1.1*
