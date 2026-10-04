#!/usr/bin/env bash
set -euo pipefail

SOURCE_REPO="https://github.com/leephil1907-lab/balletsite.git"
SOURCE_BRANCH="main"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

git clone --depth 1 --branch "$SOURCE_BRANCH" "$SOURCE_REPO" "$TMP_DIR/source"

rsync -a --delete \
  --exclude '.git/' \
  --exclude '.github/' \
  "$TMP_DIR/source/" ./

echo "Reachmark Voice application synchronized from balletsite/main."
