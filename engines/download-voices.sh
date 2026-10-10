#!/usr/bin/env bash
# Downloads the Piper neural voices used by Reachmark Audio (en/fr/es/de).
set -e
dir="${PIPER_VOICES_DIR:-$(cd "$(dirname "$0")" && pwd)/piper-voices}"
mkdir -p "$dir" && cd "$dir"
base=https://huggingface.co/rhasspy/piper-voices/resolve/main
for v in en/en_US/lessac/medium/en_US-lessac-medium \
         en/en_US/amy/medium/en_US-amy-medium \
         fr/fr_FR/siwis/medium/fr_FR-siwis-medium \
         es/es_ES/davefx/medium/es_ES-davefx-medium \
         de/de_DE/thorsten/medium/de_DE-thorsten-medium; do
  f=$(basename "$v")
  [ -f "$f.onnx" ]      || curl -L -o "$f.onnx"      "$base/$v.onnx"
  [ -f "$f.onnx.json" ] || curl -L -o "$f.onnx.json" "$base/$v.onnx.json"
done
echo "✅ Voices installed in $dir"
