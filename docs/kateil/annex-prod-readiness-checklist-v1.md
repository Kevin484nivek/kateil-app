# Annex Prod Readiness Checklist v1

Version: `v1-draft`  
Estado: `Draft`  
Owner: `Ops + Security + Platform`  
Ultima actualizacion: `2026-04-17`

## 1. Objetivo

Checklist `go/no-go` obligatorio para autorizar despliegue a produccion.

## 2. Criterios de aprobacion

Todos los puntos criticos deben estar en `OK`.

## 3. Checklist

### 3.1 Calidad tecnica

- `OK/NO`: build de produccion correcto
- `OK/NO`: lint/tipos/tests en verde
- `OK/NO`: regresion de flujos criticos validada

### 3.2 Seguridad

- `OK/NO`: sin vulnerabilidades criticas abiertas
- `OK/NO`: vulnerabilidades altas solo con excepcion vigente y aprobada
- `OK/NO`: escaneo de secretos sin hallazgos bloqueantes

### 3.3 Datos y continuidad

- `OK/NO`: migraciones validadas
- `OK/NO`: backup reciente verificado
- `OK/NO`: rollback documentado y comprobado

### 3.4 Operacion

- `OK/NO`: dashboards y alertas activos
- `OK/NO`: runbook de despliegue disponible
- `OK/NO`: responsable on-call asignado

### 3.5 Gobierno y evidencia

- `OK/NO`: ticket de cambio completo
- `OK/NO`: aprobaciones requeridas registradas
- `OK/NO`: evidencia adjunta en repositorio/canal oficial

## 4. Decision final

- `GO`: todos los criticos en `OK`
- `NO-GO`: cualquier critico en `NO`

## 5. Pendientes abiertos

- definir formato unico de registro de decisiones `GO/NO-GO`

