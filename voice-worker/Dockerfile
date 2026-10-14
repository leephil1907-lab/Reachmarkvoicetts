FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    VOICE_WORKER_DATA=/data/voice-worker \
    OPENVOICE_CHECKPOINTS=/app/checkpoints_v2

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-dev git ffmpeg libsndfile1 build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY voice-worker/requirements.txt /app/requirements.txt
RUN python3 -m pip install --upgrade pip \
    && python3 -m pip install torch==2.1.0 torchaudio==2.1.0 --index-url https://download.pytorch.org/whl/cu121 \
    && python3 -m pip install -r /app/requirements.txt \
    && python3 -m pip install git+https://github.com/myshell-ai/OpenVoice.git \
    && python3 -m pip install git+https://github.com/myshell-ai/MeloTTS.git

COPY voice-worker/app.py /app/app.py
RUN mkdir -p /data/voice-worker
EXPOSE 7860
CMD ["python3", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
