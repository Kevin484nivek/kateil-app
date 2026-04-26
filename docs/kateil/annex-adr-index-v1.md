# Annex ADR Index v1

Version: `v1-draft`  
Estado: `Draft`  
Owner: `Platform`  
Ultima actualizacion: `2026-04-17`

## 1. Objetivo

Registrar decisiones arquitectonicas relevantes con contexto, alternativas e impacto.

## 2. Formato ADR obligatorio

Cada ADR debe incluir:

- ID (ejemplo: `ADR-001`)
- titulo
- estado (`Proposed`, `Accepted`, `Deprecated`, `Superseded`)
- contexto
- decision
- alternativas consideradas
- consecuencias
- fecha y aprobadores

## 3. ADR iniciales a crear

- `ADR-001`: modelo multi-tenant inicial (shared DB con `organizationId`)
- `ADR-002`: estrategia de evolucion a tenants con DB dedicada
- `ADR-003`: login comun y resolucion por organizacion
- `ADR-004`: arquitectura `core + modules`
- `ADR-005`: estrategia de despliegue progresivo y rollback
- `ADR-006`: stack de observabilidad
- `ADR-007`: politica de backup y restore

## 4. Pendientes abiertos

- definir carpeta final para ADRs (`docs/kateil/adrs/`)
- decidir plantilla markdown unica para todos los ADR
- fijar proceso de aprobacion de ADR

