# Deploy Prod Runbook v1

Version: `v1-draft`  
Estado: `Draft`  
Owner: `Ops`  
Ultima actualizacion: `2026-04-17`

## 1. Objetivo

Desplegar cambios en produccion de forma controlada y reversible.

## 2. Precondiciones

- checklist de prod readiness en `GO`
- ventana de cambio aprobada
- responsable de despliegue asignado
- snapshot/backup reciente disponible

## 3. Procedimiento

1. confirmar commit/tag objetivo
2. verificar estado de servicios en prod
3. crear snapshot de seguridad previo
4. aplicar despliegue segun pipeline definido
5. ejecutar migraciones aprobadas (si aplica)
6. reiniciar/recargar servicio de aplicacion
7. ejecutar smoke test post-deploy
8. validar metricas, logs y alertas durante 15 minutos

## 4. Smoke test minimo

- login correcto
- acceso a dashboard
- creacion/edicion de entidad basica
- flujo critico de negocio sin error

## 5. Criterio de exito

- smoke test en verde
- sin alertas criticas nuevas
- latencia y error rate en rango esperado

## 6. Fallback

Si falla cualquier punto critico:

1. detener despliegue
2. ejecutar rollback runbook
3. notificar a on-call y registrar incidente si aplica

## 7. Evidencia obligatoria

- fecha/hora inicio-fin
- responsable
- version desplegada
- resultado de smoke test
- decision final (`SUCCESS` o `ROLLBACK`)

