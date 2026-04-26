#!/bin/sh

set -eu

ROOT_DIR="${BACKUP_DIR:-/backups}"
POSTGRES_BACKUP_DIR="${ROOT_DIR%/}/postgres"

LATEST_BACKUP_FILE="$(find "${POSTGRES_BACKUP_DIR}" -maxdepth 1 -type f \( -name "backup-*.dump" -o -name "backup-*.sql" \) | sort -r | head -n 1)"

if [ -z "${LATEST_BACKUP_FILE}" ]; then
  echo "No backups found in ${POSTGRES_BACKUP_DIR}"
  exit 1
fi

TEST_DB="restore_check_$(date +%Y%m%d_%H%M%S)"
EXTENSION="${LATEST_BACKUP_FILE##*.}"

cleanup() {
  PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h db \
    -U "${POSTGRES_USER}" \
    -d postgres \
    -c "DROP DATABASE IF EXISTS \"${TEST_DB}\";" >/dev/null 2>&1 || true
}

trap cleanup EXIT

echo "Creating temporary database ${TEST_DB}"
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h db \
  -U "${POSTGRES_USER}" \
  -d postgres \
  -c "CREATE DATABASE \"${TEST_DB}\";"

echo "Restoring ${LATEST_BACKUP_FILE} into ${TEST_DB}"
if [ "${EXTENSION}" = "sql" ]; then
  PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h db \
    -U "${POSTGRES_USER}" \
    -d "${TEST_DB}" \
    -f "${LATEST_BACKUP_FILE}" >/dev/null
else
  PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore \
    -h db \
    -U "${POSTGRES_USER}" \
    -d "${TEST_DB}" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    "${LATEST_BACKUP_FILE}" >/dev/null
fi

USER_COUNT="$(PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h db \
  -U "${POSTGRES_USER}" \
  -d "${TEST_DB}" \
  -tAc "SELECT COUNT(*) FROM \"User\";")"

PRODUCT_COUNT="$(PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h db \
  -U "${POSTGRES_USER}" \
  -d "${TEST_DB}" \
  -tAc "SELECT COUNT(*) FROM \"Product\";")"

SALE_COUNT="$(PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h db \
  -U "${POSTGRES_USER}" \
  -d "${TEST_DB}" \
  -tAc "SELECT COUNT(*) FROM \"Sale\";")"

echo "Restore smoke check:"
echo "- Users: ${USER_COUNT}"
echo "- Products: ${PRODUCT_COUNT}"
echo "- Sales: ${SALE_COUNT}"
echo "Restore test finished successfully"
