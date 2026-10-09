# Engine Merge Map — five repos, one runtime

How each imported repository contributes to Reachmark Audio, and where its DNA lives in this build.

## 1. `leephil1907-lab/Reachmarkvoicetts` (your project — the control plane)
- **Adapter contract** (`lib/server/backend.ts`, `app/api/tts/route.ts`) → `server/server.js` keeps the same shape: UI → Reachmark routes → normalized engine responses; errors mapped to 503/502 like the original proxy.
- **Design system** (`docs/DESIGN_SYSTEM.md`) → motion rules implemented in `web/css/app.css`: entry fade+rise, state-driven waveform/pulse motion, instrument-panel surfaces, no perpetual decoration.
- **Product hierarchy** (create → test → agents → conversations → automate) → home FAB/create sheet order and agent → chat → call flow.
- **Agent chat route contract** (`app/api/agent/chat`) → `web/js/brain.js` stands in for the llama.cpp adapter with the same `{content}` contract; swap `REACHMARK_AGENT_URL` in later without UI changes.
- **Systemd daemon layout** (`infra/systemd`) → documented path for hosting Piper/GPU services as always-on daemons.

## 2. `CorentinJ/Real-Time-Voice-Cloning` (SV2TTS pipeline)
- **Encoder → synthesizer → vocoder split** → clone flow stages in `#/studio/clone` (Sample → Encoder → Embed → Match → Clone).
- **`utils/audio.py` mel/window conventions** (22–48 kHz windows, hop ratios) → window/hop constants in `server/dsp.js` (`stretchOLA`, frame sizes).
- **F0-based embedding idea** → `dsp.estimateF0` (autocorrelation, 60–400 Hz gate) drives clone matching: sample F0 → nearest neural voice + semitone offset.
- Standby GPU adapter registered in Engine Hub (`rtvc`).

## 3. `babysor/MockingBird`
- **Toolbox UX flow** (record → embed → preview → synthesize) → recorder ring + live level meter + instant preview in Clone studio.
- **`gen_voice.py` one-shot pipeline** → server `/api/clone` single-call contract.
- **Web UI state machine** (preprocess/synthesize/vocoder steps) → progress + stage chips in clone & dub views.
- Standby GPU adapter (`mockingbird`).

## 4. `filliptm/ComfyUI_Fill-ChatterBox`
- **Expression/emotion parameters** of `chatterbox_node.py` (exaggeration, pace, tone colour) → Reachmark *expression knobs*: pitch semitones, speed, FX colour (Clean/Robot/Radio/Echo) in `exprControls()`.
- **Dialog node turn structure** (`chatterbox_dialog_node.py`) → agent call turn loop (user turn → agent turn → speak).
- Standby GPU adapter (`chatterbox`).

## 5. `debpalash/VoiceStudio`
- **Studio workspace pattern** (projects + history tabs) → home History tabs (TTS / Separation / Changer / Dubbing / Lip Sync) and per-studio project cards.
- **Separation service shape** (backend stem service) → `/api/separate` mid/side mask pipeline.
- **Electron packaging** (`electron/`) → `desktop/main.js` + `desktop/package.json` wrapper that spawns the same server and loads the same UI.

## 6. Runtime added: **Piper neural TTS** (CPU ONNX)
- Live synthesis engine behind TTS, dubbing, agents, calls; `--length-scale` prosody = speed knob; voice catalogue en/fr/es/de under `engines/piper-voices/`.
- Queue + SHA1 render cache (`server/tts.js`) keep a 2 GB box responsive.

## Merged pipeline (today, CPU)

```
text ──► Piper TTS ──► Core DSP (pitch / rate / FX) ──► WAV render ──► players / history / exports
sample ─► F0+pace analysis ─► voice profile (model match + semitones) ─► TTS/agents/calls
stereo ─► mid/side mask ─► vocals + instrumental
audio ──► analyser ─► LipRenderer (visemes/blinks) ─► canvas + MediaRecorder ─► WebM
```

## GPU hot-swap (when torch present)
`server/engines.js` probes `import torch`; Engine Hub shows `ready` and clone/design can route to
RTVC/MockingBird/ChatterBox adapters with the same request contracts — no UI change required.

## v1.1 — product layer added on the merged runtime
- **Real accounts**: scrypt-hashed credentials, 30-day HttpOnly sessions, per-user workspaces (`data/u/<uid>/` for voices, agents, history, samples). Signup gifts **10,000 ✦**.
- **Server-side billing**: every engine call charges credits (TTS ≈1/40 chars, change 20, clone 150, separate 30, dub 15/take) and returns the new balance via `X-Reachmark-Credits`; studio minutes are metered from rendered WAV duration.
- **Voice translation**: cross-lingual voice transfer — a clone/design profile (pitch, pace, FX colour) re-targets any installed neural language (en/fr/es/de) from the TTS language picker.
- **Platform Guide agent**: seeded into every account at signup with an 18-fact product knowledge base; reachable via Support Center live chat and support-session calls.
- **Support Center**: live chat, voice support sessions, FAQ accordion, and the contact addresses reachmarkofficial@gmail.com / support@reachmarkdigital.com.
- **UX layer**: command palette (Ctrl/Cmd+K), animated dropdown menus, loading skeletons, dashboard stats, onboarding sheet, focus-visible rings — motion rules still follow `docs/DESIGN_SYSTEM.md` from the original repo.

## v1.2 — production hardening (post-audit)
- SQLite (better-sqlite3) replaces whole-file JSON: users, sessions, voices, agents, history, renders, rate limits; WAL mode; `DATA_DIR` env for persistent disks.
- Atomic credit transactions with exact refunds on any paid-route failure; inputs validated/decoded **before** charging.
- Trials: one per account (`trial_used`), expiry enforced on every authenticated request; slot limits from the effective plan.
- Auth: async scrypt (N=16384) + `timingSafeEqual`, 8+ char passwords, 5-attempt/15-min rate limits per IP+email, `Secure` cookies behind HTTPS.
- Headers: CSP, nosniff, X-Frame-Options DENY, Referrer-Policy, HSTS on HTTPS; wildcard CORS removed; real 404s (SPA fallback only for extensionless routes).
- Piper: 30 s SIGKILL timeout, per-user concurrency 1, capped global queue → 429.
- Ownership: renders served only to their owner; whitelisted fields on voice/agent/history writes; 20 MB upload cap client + server.
- Deploy: Dockerfile (python3 + piper-tts), docker-entrypoint (voice download to persistent disk), render.yaml with 2 GB disk, root package.json, `/api/health` reports piper/db/dataDir.
- Honest labels: **Voice Match** and **Quick Vocal Remove** across UI, manifest, Guide knowledge and README; GPU engine slots (XTTS/OpenVoice/Demucs) documented as plug-in replacements on the same endpoints.
- PWA: padded maskable icons (80% safe zone), pinch-zoom enabled, flag emoji repaired.
