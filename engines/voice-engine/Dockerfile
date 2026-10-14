# Reachmark Voice Engine — GPU image (NVIDIA). For CPU-only hosts use python:3.11-slim as the base
# and expect slow generation. Build:  docker build -t reachmark-voice-engine engines/voice-engine
# Run:    docker run --gpus all -p 8100:8100 -e VOICE_ENGINE_TOKEN=<long-random> -v hf:/root/.cache/huggingface reachmark-voice-engine
FROM pytorch/pytorch:2.6.0-cuda12.4-cudnn9-runtime
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libsndfile1 && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
EXPOSE 8100
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8100/health')" || exit 1
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8100"]
