# Annex RACI v1

Version: `v1-draft`  
Estado: `Draft`  
Owner: `Product + Platform`  
Ultima actualizacion: `2026-04-17`

## 1. Objetivo

Definir responsabilidades de decision y ejecucion para operar KATEIL con estabilidad.

## 2. Roles base

- `PO`: Product Owner
- `PLAT`: Responsable de Plataforma
- `SEC`: Responsable de Seguridad
- `OPS`: Responsable de Operaciones
- `ENG`: Equipo de Ingenieria
- `LEGAL`: Responsable Legal/Compliance

## 3. Matriz RACI resumida

- Arquitectura de referencia: `A=PLAT`, `R=ENG`, `C=SEC`, `I=PO`
- Politicas de seguridad: `A=SEC`, `R=SEC`, `C=PLAT`, `I=PO`
- Despliegues a produccion: `A=OPS`, `R=OPS`, `C=PLAT+SEC`, `I=PO`
- Gestion de incidentes Sev1/Sev2: `A=OPS`, `R=OPS+SEC`, `C=PLAT`, `I=PO+LEGAL`
- Cambios funcionales criticos: `A=PO`, `R=ENG`, `C=PLAT+SEC`, `I=OPS`
- Cumplimiento privacidad: `A=LEGAL`, `R=LEGAL+SEC`, `C=PO`, `I=PLAT+OPS`

## 4. Pendientes abiertos

- nombrar personas concretas por rol
- definir suplencias en ausencias
- cerrar circuito de aprobacion fuera de horario

