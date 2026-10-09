#!/bin/sh
# Downloads Piper voices on first boot into the persistent disk (idempotent).
set -e
if [ ! -d "$PIPER_VOICES_DIR" ] || [ -z "$(ls -A "$PIPER_VOICES_DIR" 2>/dev/null | grep .onnx)" ]; then
  echo "[entrypoint] downloading Piper voices into $PIPER_VOICES_DIR ..."
  PIPER_VOICES_DIR="$PIPER_VOICES_DIR" ./engines/download-voices.sh
else
  echo "[entrypoint] Piper voices present in $PIPER_VOICES_DIR"
fi
exec node server/server.js
