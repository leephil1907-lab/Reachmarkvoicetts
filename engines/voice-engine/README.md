# Reachmark Voice Engine

Self-hosted **zero-shot voice cloning + multilingual TTS** (23 languages) — your own engine, no third-party voice API.
Model: [Chatterbox Multilingual](https://github.com/resemble-ai/chatterbox) by Resemble AI, **MIT licence** (commercial use OK).
Generated audio carries Resemble's imperceptible "Perth" watermark.

## Hardware
- **Recommended:** NVIDIA GPU, 8 GB+ VRAM (RunPod, Vast.ai, Lambda, Modal, your own box) → ~1–3 s per sentence.
- **CPU-only:** works, but expect tens of seconds per sentence — fine for testing, not for live agent calls.
- Railway/Render standard instances have **no GPU**: run the engine elsewhere and point the app at it.

## Run
```bash
docker build -t reachmark-voice-engine engines/voice-engine
docker run --gpus all -p 8100:8100 \
  -e VOICE_ENGINE_TOKEN="$(openssl rand -hex 32)" \
  -v hf-cache:/root/.cache/huggingface reachmark-voice-engine
```
First start downloads the model (~a few GB) — `GET /health` returns 503 until it is loaded.

## Connect the app
Set on the Reachmark Audio server (Railway → Variables):
```
VOICE_ENGINE_URL=https://your-engine-host:8100     # use HTTPS or a private network
VOICE_ENGINE_TOKEN=<same secret as the engine>
```
Engine Hub then shows **Reachmark Voice Engine · online**, and *Voice Match* becomes real cloning.

## API
`POST /v1/tts` (multipart, `Authorization: Bearer <token>`): `text` (≤1000 chars), `language` (ISO-639-1),
optional `sample` (reference audio, 3–30 s used), `exaggeration` (0.25–2), `cfg_weight` (0–1) → `audio/wav`.
`GET /health` → `{ok, device, languages}`.

Only clone voices you have the right to clone — add consent language to your Terms.
