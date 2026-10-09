FROM node:20-bookworm-slim
ENV PYTHONUNBUFFERED=1 PIPER_VOICES_DIR=/data/piper-voices DATA_DIR=/data PORT=8000 ADMIN_PORT=8001
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --break-system-packages --no-cache-dir piper-tts
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
RUN chmod +x engines/download-voices.sh docker-entrypoint.sh scripts/run-all.sh && mkdir -p /data
EXPOSE 8000 8001
HEALTHCHECK --interval=30s --timeout=6s --start-period=90s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8000)+'/api/health').then(r=>r.json()).then(j=>process.exit(j.piper&&j.piper.ready?0:1)).catch(()=>process.exit(1))"
CMD ["./docker-entrypoint.sh"]
