# Reachmark private voice-cloning worker

This is an experimental self-hosted backend for the admin-only Voice Lab. It uses OpenVoice V2 for voice-tone conversion and MeloTTS for base speech. It does not require an ElevenLabs API key.

## Important limits

- This worker is not installed or running on Railway just because its code is in this repository. The Admin service needs a reachable worker URL and a shared secret.
- A CUDA-capable NVIDIA GPU is strongly recommended. The RTX 4050 laptop is a reasonable test target if its driver and available VRAM support the model stack.
- Current delivery choices are best-effort pacing and punctuation presets. This version does not claim human-level emotional acting or guaranteed emotion-level prosody control.
- Only clone your own voice or a voice for which you have explicit permission. Keep the worker private and use a long random token.
- Model/package compatibility and voice quality must be tested on the target machine. The Docker build is a starting point and may need dependency adjustments for the host driver.

## Run with Docker and NVIDIA GPU

1. Install Docker and NVIDIA Container Toolkit for your operating system.
2. Generate a long random secret. Use the same value as VOICE_WORKER_TOKEN for the worker and VOICE_CLONE_WORKER_TOKEN in the Reachmark Admin service.
3. Build from the repository root:

    docker build -f voice-worker/Dockerfile -t reachmark-voice-worker .

4. Start the worker, keeping its HTTP port bound to localhost:

    docker run --rm --gpus all -p 127.0.0.1:7860:7860 -e VOICE_WORKER_TOKEN='REPLACE_WITH_A_LONG_RANDOM_SECRET' -v reachmark-voice-data:/data/voice-worker reachmark-voice-worker

5. On first start, the worker downloads OpenVoice V2 checkpoints and loads MeloTTS. First startup can take time and needs internet access. Check container logs for the OpenVoice ready message.
6. Configure the Reachmark Admin service with VOICE_CLONE_WORKER_URL (an HTTPS-reachable URL for the worker) and VOICE_CLONE_WORKER_TOKEN (the same secret as VOICE_WORKER_TOKEN).

Networking note: a worker bound to localhost is intentionally not reachable from Railway. To connect a laptop worker to Railway, use a private authenticated tunnel or run the worker on a trusted GPU host. Do not change the Docker port binding to public access as a shortcut. While the laptop worker is offline, the Voice Lab remains unavailable.

## Endpoints

All endpoints require the X-Worker-Token header.

- GET /v1/health — model readiness and device
- GET /v1/voices — saved private profiles
- POST /v1/clone — JSON containing name, notes, sample_base64 and consent=true
- POST /v1/synthesize — JSON containing voice_id, text, style and pacing; returns WAV audio

The admin proxy enforces an authenticated admin session, CSRF protection, sample size and duration limits, and records clone/generation actions in the existing audit log.
