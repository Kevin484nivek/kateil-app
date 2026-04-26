# Rollback Runbook v1

Version: `v1-draft`  
Estado: `Draft`  
Owner: `Ops`  
Ultima actualizacion: `2026-04-17`

## 1. Objetivo

Restaurar rapidamente el servicio estable anterior tras un despliegue fallido.

## 2. Triggers de rollback

- error critico en login o flujo principal
- incremento severo de errores en produccion
- degradacion clara de rendimiento tras despliegue
- fallo de migracion con impacto operativo

## 3. Procedimiento

1. declarar estado `ROLLBACK IN PROGRESS`
2. detener promocion de nuevas versiones
3. volver a la version estable anterior
4. revertir migracion solo si el plan lo permite de forma segura
5. reiniciar servicios
6. ejecutar smoke test minimo
7. monitorizar 15-30 minutos

## 4. Criterio de recuperacion

- servicio accesible
- flujos criticos operativos
- errores y latencia en nivel previo

## 5. Escalado

- si rollback no recupera servicio en 30 minutos:
- escalar a incidente `Sev1`
- activar `sev1-incident-runbook-v1.md`

## 6. Evidencia obligatoria

- motivo de rollback
- version fallida y version restaurada
- tiempo total de recuperacion
- acciones preventivas acordadas

