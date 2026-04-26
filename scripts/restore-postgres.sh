#!/bin/sh

set -eu

BACKUP_FILE="${BACKUP_FILE:-}"
RESTORE_DB="${RESTORE_DB:-${POSTGRES_DB}}"

if [ -z "${BACKUP_FILE}" ]; then
  echo "BACKUP_FILE is required"
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

EXTENSION="${BACKUP_FILE##*.}"

echo "Restoring PostgreSQL backup from ${BACKUP_FILE}"

if [ "${EXTENSION}" = "sql" ]; then
  PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h db \
    -U "${POSTGRES_USER}" \
    -d "${RESTORE_DB}" \
    -f "${BACKUP_FILE}"
else
  PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore \
    -h db \
    -U "${POSTGRES_USER}" \
    -d "${RESTORE_DB}" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    "${BACKUP_FILE}"
fi

echo "Restore finished successfully"
