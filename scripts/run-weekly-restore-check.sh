#!/bin/sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
LOG_DIR="${ROOT_DIR}/backups/logs"
LOG_FILE="${LOG_DIR}/restore-check.log"
FAIL_FILE="${LOG_DIR}/restore-check.last-failure"

mkdir -p "${LOG_DIR}"

{
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting weekly restore check"
  cd "${ROOT_DIR}"
  docker compose run --rm --entrypoint sh backup /scripts/test-restore-latest.sh
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Weekly restore check finished OK"
} >>"${LOG_FILE}" 2>&1 || {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Weekly restore check FAILED" >>"${LOG_FILE}"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Weekly restore check FAILED" >"${FAIL_FILE}"
  logger -t mimarca-backups "Weekly restore check FAILED. Review ${LOG_FILE}"
  ./scripts/notify-telegram-mimarca.sh \
    "MiMarca restore semanal fallido" \
    "Falló la prueba semanal de restauración. Revisa ${LOG_FILE} y ${FAIL_FILE} en el servidor."
  exit 1
}
