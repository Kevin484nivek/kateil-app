#!/bin/sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
APP_URL="${APP_URL:-http://127.0.0.1:3010}"

if [ -z "${INTERNAL_AUTOMATION_TOKEN:-}" ]; then
  echo "ERROR: INTERNAL_AUTOMATION_TOKEN no está definido"
  exit 1
fi

cd "${ROOT_DIR}"

docker compose run --rm backup

curl -fsS -X POST \
  -H "x-internal-token: ${INTERNAL_AUTOMATION_TOKEN}" \
  "${APP_URL}/api/internal/backups/upload-latest" >/tmp/mimarca-backup-upload.json

cat /tmp/mimarca-backup-upload.json
