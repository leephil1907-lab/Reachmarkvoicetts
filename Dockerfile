FROM node:22-bookworm-slim

# Piper neural TTS runtime (CPU) + tools
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-venv python3-pip curl ca-certificates espeak-ng \
      build-essential \
    && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/venv \
 && /opt/venv/bin/pip install --no-cache-dir "piper-tts==1.2.0"

WORKDIR /app
COPY . .

# Native Node deps (better-sqlite3). node_modules is git- and docker-ignored, so it MUST be
# installed inside the image or the server crashes at boot. build-essential (above) is the
# fallback compiler if no prebuilt binary matches this Node/ABI; otherwise prebuild-install
# fetches one. --omit=dev keeps the runtime image lean.
RUN npm ci --omit=dev

# Download en/fr/es/de voices at build time, then fail the build if Piper or voices are broken
RUN bash engines/download-voices.sh \
 && test "$(find engines/piper-voices -name '*.onnx' -size +1M | wc -l)" -ge 5 \
 && echo "hello from reachmark" | /opt/venv/bin/python -m piper \
      --model engines/piper-voices/en_US-lessac-medium.onnx --output_file /tmp/smoke.wav \
 && test -s /tmp/smoke.wav && rm /tmp/smoke.wav

# All user data (accounts, sessions, voices, renders) lives on the Railway volume mounted at /data
RUN rm -rf /app/data && mkdir -p /data && ln -s /data /app/data

ENV NODE_ENV=production \
    PYTHON=/opt/venv/bin/python \
    PORT=8000
EXPOSE 8000
CMD ["node", "server/server.js"]
