# Backups

## Objetivo

Asegurar backup diario completo de PostgreSQL con retención local y subida automática a Google Drive.

## Estrategia inicial

- dump completo diario con `pg_dump`
- persistencia en carpeta `backups/`
- limpieza automática por retención
- subida de backup, metadata y checksum a Google Drive

## Estado real hoy

- existe contenedor `backup` preparado en `docker-compose.yml`
- existe script base de backup PostgreSQL en el repositorio
- existe endpoint interno para subir el último backup local a Google Drive:
  - `POST /api/internal/backups/upload-latest`
- existe script de orquestación:
  - `scripts/run-backup-and-upload.sh`
- existe script de prueba segura de restauración:
  - `scripts/test-restore-latest.sh`
- existe script de ejecución semanal de restore check con registro de fallo:
  - `scripts/run-weekly-restore-check.sh`
- existe script de notificación por Telegram (canal `Server Status` vía Hermes):
  - `scripts/notify-telegram-mimarca.sh`
- existe wrapper diario con gestión de fallo + notificación:
  - `scripts/run-daily-backup-cron.sh`
- Google Drive valida raíz y subcarpetas desde `Usuarios > Almacenamiento`
- adjuntos de `Mercancía` y `Proveedores` se suben directamente a Google Drive al guardar
- queda pendiente programar una prueba periódica de restauración

## Restauración segura

Prueba no destructiva recomendada (usa base temporal y la elimina al terminar):

```bash
docker compose run --rm --entrypoint sh backup /scripts/test-restore-latest.sh
```

Restauración completa sobre base objetivo (operación de mantenimiento):

```bash
docker compose run --rm -e BACKUP_FILE=/backups/postgres/backup-YYYY-MM-DD-HH-MM-SS.dump backup sh /scripts/restore-postgres.sh
```

## Pendientes

- automatizar programación diaria con `cron` del host usando `scripts/run-backup-and-upload.sh`
- programar prueba periódica de restauración segura (`scripts/test-restore-latest.sh`)
- verificar cifrado o protección del almacenamiento si hay datos sensibles
- cerrar procedimiento operativo para restauración completa en incidencia real

## Programación recomendada en servidor

Ejecutar backup diario a las `03:30` y prueba de restore semanal el domingo a las `03:50` (hora de Madrid), usando el mismo lock para evitar solape:

```bash
30 3 * * * flock -n /tmp/mimarca-backup.lock sh -lc "cd /home/kevin/docker-services/mimarca-backoffice && ./scripts/run-daily-backup-cron.sh"
50 3 * * 0 flock -n /tmp/mimarca-backup.lock sh -lc "cd /home/kevin/docker-services/mimarca-backoffice && ./scripts/run-weekly-restore-check.sh"
```

Notas:

- `INTERNAL_AUTOMATION_TOKEN` debe coincidir con el valor de `.env`
- el contenedor `app` debe montar `./backups:/backups`
- antes de activar cron, validar en UI:
  - `Usuarios > Almacenamiento > Validar Drive y carpetas`
- si el restore check falla:
  - queda registrado en `backups/logs/restore-check.log`
  - se deja marca de último fallo en `backups/logs/restore-check.last-failure`
  - se emite evento en syslog con tag `mimarca-backups`
  - se envía notificación a Telegram (`Server Status`)
- si falla el backup diario:
  - queda registrado en `backups/logs/backup-cron.log`
  - se emite evento en syslog con tag `mimarca-backups` (`daily-backup-failed`)
  - se envía notificación a Telegram (`Server Status`)
