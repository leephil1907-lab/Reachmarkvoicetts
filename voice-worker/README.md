# Reachmark private voice-cloning worker

This is an experimental self-hosted backend for the admin-only Voice Lab. It uses the official CosyVoice 3 model stack for zero-shot voice cloning and natural-language instruction-controlled delivery, including style, speed and emotion directions. The upstream project is Apache-2.0 licensed; review all upstream and model terms before distributing a product built on it.

## Important limits

- This worker is not installed or running on Railway merely because its code is in this repository. The Admin service needs a reachable worker URL and shared secret.
- A CUDA-capable NVIDIA GPU is strongly recommended. The RTX 4050 laptop is a reasonable test target, but first-generation startup, VRAM use, and generation speed must be tested locally.
- Model/package compatibility and voice quality must be tested on the target machine. The Docker build is a starting point and may need dependency adjustments for the host driver.
- Clone only your own voice or a voice for which you have explicit permission. Keep the worker private and use a long random token.

## Run with Docker and NVIDIA GPU

1. Install Docker and NVIDIA Container Toolkit for your operating system.
2. Generate a long random secret. Use the same value as VOICE_WORKER_TOKEN for the worker and VOICE_CLONE_WORKER_TOKEN in the Reachmark Admin service.
3. Build from the repository root:

    docker build -f voice-worker/Dockerfile -t reachmark-voice-worker .

4. Start the worker, keeping its HTTP port bound to localhost:

    docker run --rm --gpus all -p 127.0.0.1:7860:7860 -e VOICE_WORKER_TOKEN='REPLACE_WITH_A_LONG_RANDOM_SECRET' -v reachmark-voice-data:/data/voice-worker reachmark-voice-worker

5. The worker downloads the CosyVoice 3 model on first start and loads it into memory. This needs internet access and several gigabytes of disk space. Check container logs for the CosyVoice ready message.
6. Configure the Reachmark Admin service with VOICE_CLONE_WORKER_URL (an HTTPS-reachable URL for the worker) and VOICE_CLONE_WORKER_TOKEN (the same secret as VOICE_WORKER_TOKEN).

Networking note: a worker bound to localhost is intentionally not reachable from Railway. To connect a laptop worker to Railway, use a private authenticated tunnel or run the worker on a trusted GPU host. Do not change the Docker port binding to public access as a shortcut. While the laptop worker is offline, the Voice Lab remains unavailable.

## Endpoints

All endpoints require the X-Worker-Token header.

- GET /v1/health — model readiness and device
- GET /v1/voices — saved private profiles
- POST /v1/clone — JSON containing name, notes, sample_base64 and consent=true
- POST /v1/synthesize — JSON containing voice_id, text, style and pacing; returns WAV audio

The admin proxy enforces an authenticated admin session, CSRF protection, sample size and duration limits, and records clone/generation actions in the existing audit log.
