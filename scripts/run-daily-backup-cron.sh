#!/bin/sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
LOG_DIR="${ROOT_DIR}/backups/logs"
LOG_FILE="${LOG_DIR}/backup-cron.log"

mkdir -p "${LOG_DIR}"
cd "${ROOT_DIR}"

if [ -z "${INTERNAL_AUTOMATION_TOKEN:-}" ]; then
  INTERNAL_AUTOMATION_TOKEN="$(grep -E '^INTERNAL_AUTOMATION_TOKEN=' .env | head -n1 | cut -d= -f2-)"
  export INTERNAL_AUTOMATION_TOKEN
fi

{
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting daily backup+upload"
  ./scripts/run-backup-and-upload.sh
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Daily backup+upload finished OK"
} >>"${LOG_FILE}" 2>&1 || {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Daily backup+upload FAILED" >>"${LOG_FILE}"
  logger -t mimarca-backups "daily-backup-failed. Review ${LOG_FILE}"
  ./scripts/notify-telegram-mimarca.sh \
    "MiMarca backup diario fallido" \
    "Falló el backup diario o la subida a Drive. Revisa ${LOG_FILE} en el servidor."
  exit 1
}
