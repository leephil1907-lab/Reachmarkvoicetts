FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    VOICE_WORKER_DATA=/data/voice-worker \
    COSYVOICE_MODEL_ID=FunAudioLLM/Fun-CosyVoice3-0.5B-2512 \
    PYTHONPATH=/app/CosyVoice:/app/CosyVoice/third_party/Matcha-TTS

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-dev git ffmpeg sox libsox-dev libsndfile1 build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN git clone --depth 1 --recursive https://github.com/FunAudioLLM/CosyVoice.git /app/CosyVoice \
    && cd /app/CosyVoice && git submodule update --init --recursive
RUN python3 -m pip install --upgrade pip setuptools==69.5.1 \
    && python3 -m pip install torch==2.3.1 torchaudio==2.3.1 --index-url https://download.pytorch.org/whl/cu121 \
    && python3 -m pip install -r /app/CosyVoice/requirements.txt \
    && python3 -m pip install -r /app/voice-worker-requirements.txt

COPY voice-worker/requirements.txt /app/voice-worker-requirements.txt
COPY voice-worker/app.py /app/app.py
RUN mkdir -p /data/voice-worker
EXPOSE 7860
CMD ["python3", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
