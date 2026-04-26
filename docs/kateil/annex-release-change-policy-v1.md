# Annex Release and Change Policy v1

Version: `v1-draft`  
Estado: `Draft`  
Owner: `Platform + Ops`  
Ultima actualizacion: `2026-04-17`

## 1. Objetivo

Establecer como se promueven cambios entre `dev`, `staging` y `prod`.

## 2. Cadena de promocion

- `dev`: validacion tecnica inicial
- `prod`: solo cambios aprobados y observables

Nota para fase MVP:

- no se mantiene `staging` cloud dedicado en esta fase
- la validacion pre-produccion se realiza en local con datos y pruebas controladas
- al superar fase piloto se evaluara reintroducir `staging` cloud

## 3. Requisitos para pasar a produccion

- CI completo en verde
- sin vulnerabilidades criticas
- migraciones validadas en entorno de prueba local antes de aplicarse en prod
- runbook de rollback disponible
- responsable de despliegue asignado

## 4. Estrategia de despliegue

- usar feature flags para cambios de alto riesgo
- preferir despliegue progresivo
- disponibilidad de rollback inmediato

## 5. Cambios de emergencia

- permitidos solo para incidentes severos
- aprobacion rapida por Ops + Security
- postmortem obligatorio en menos de 72h

## 6. Pendientes abiertos

- decidir despliegue canary o blue-green como estandar final
- definir ventana horaria oficial de cambios en prod
- fijar checklist final por tipo de release
