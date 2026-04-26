#!/bin/sh

set -eu

ROOT_DIR="${BACKUP_DIR:-/backups}"
POSTGRES_BACKUP_DIR="${ROOT_DIR%/}/postgres"
LOG_DIR="${ROOT_DIR%/}/logs"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
KEEP_LATEST="${BACKUP_KEEP_LATEST:-14}"
FORMAT="${BACKUP_FORMAT:-custom}"
COMPRESSION_LEVEL="${BACKUP_COMPRESSION_LEVEL:-9}"
REMOTE_PROVIDER="${BACKUP_REMOTE_PROVIDER:-none}"

mkdir -p "${POSTGRES_BACKUP_DIR}" "${LOG_DIR}"

TIMESTAMP="$(date +%Y-%m-%d-%H-%M-%S)"
RUN_ID="$(date +%Y-%m-%d_%H-%M-%S)"
FILE_BASENAME="backup-${TIMESTAMP}"
FILE_EXTENSION=".dump"
PG_DUMP_FORMAT_FLAG="-Fc"
PG_DUMP_COMPRESSION_ARGS="-Z ${COMPRESSION_LEVEL}"

if [ "${FORMAT}" = "plain" ]; then
  FILE_EXTENSION=".sql"
  PG_DUMP_FORMAT_FLAG="-Fp"
  PG_DUMP_COMPRESSION_ARGS=""
fi

FILE_PATH="${POSTGRES_BACKUP_DIR}/${FILE_BASENAME}${FILE_EXTENSION}"
METADATA_PATH="${POSTGRES_BACKUP_DIR}/${FILE_BASENAME}.json"
CHECKSUM_PATH="${POSTGRES_BACKUP_DIR}/${FILE_BASENAME}.sha256"
RUN_LOG_PATH="${LOG_DIR}/backup-${TIMESTAMP}.log"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "${RUN_LOG_PATH}"
}

BYTES_TO_GB_DIVISOR=1073741824

log "Starting PostgreSQL backup"
log "Destination: ${FILE_PATH}"
log "Format: ${FORMAT}"

PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h db \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  ${PG_DUMP_FORMAT_FLAG} \
  ${PG_DUMP_COMPRESSION_ARGS} \
  -f "${FILE_PATH}"

FILE_SIZE_BYTES="$(wc -c < "${FILE_PATH}" | tr -d ' ')"
FILE_SIZE_GB="$(awk -v bytes="${FILE_SIZE_BYTES}" -v divisor="${BYTES_TO_GB_DIVISOR}" 'BEGIN { printf "%.4f", bytes / divisor }')"

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${FILE_PATH}" > "${CHECKSUM_PATH}"
  log "Checksum generated: ${CHECKSUM_PATH}"
fi

cat > "${METADATA_PATH}" <<EOF
{
  "runId": "${RUN_ID}",
  "timestamp": "${TIMESTAMP}",
  "provider": "postgresql",
  "database": "${POSTGRES_DB}",
  "format": "${FORMAT}",
  "compressionLevel": ${COMPRESSION_LEVEL},
  "filePath": "${FILE_PATH}",
  "fileName": "${FILE_BASENAME}${FILE_EXTENSION}",
  "fileSizeBytes": ${FILE_SIZE_BYTES},
  "fileSizeGb": ${FILE_SIZE_GB},
  "remoteProvider": "${REMOTE_PROVIDER}"
}
EOF

log "Metadata written: ${METADATA_PATH}"

find "${POSTGRES_BACKUP_DIR}" -type f \( -name "backup-*.dump" -o -name "backup-*.sql" -o -name "backup-*.json" -o -name "backup-*.sha256" \) -mtime +"${RETENTION_DAYS}" -delete

LISTING_FILE="$(mktemp)"
find "${POSTGRES_BACKUP_DIR}" -maxdepth 1 -type f \( -name "backup-*.dump" -o -name "backup-*.sql" \) | sort -r > "${LISTING_FILE}"

if [ "${KEEP_LATEST}" -gt 0 ]; then
  tail -n +"$((KEEP_LATEST + 1))" "${LISTING_FILE}" | while read -r old_file; do
    [ -n "${old_file}" ] || continue
    base_without_ext="${old_file%.*}"
    rm -f "${old_file}" "${base_without_ext}.json" "${base_without_ext}.sha256"
  done
fi

rm -f "${LISTING_FILE}"

if [ "${REMOTE_PROVIDER}" != "none" ]; then
  log "Remote upload configured for provider: ${REMOTE_PROVIDER}"
  log "Pending implementation: provider-specific upload step will hook in here"
else
  log "Remote upload not handled in this script (orchestrator may upload afterwards)"
fi

log "Backup finished successfully"
log "Backup file size: ${FILE_SIZE_GB} GB"
log "Run log: ${RUN_LOG_PATH}"
