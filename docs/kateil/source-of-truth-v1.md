# KATEIL Source of Truth v1

Version: `v1.1`  
Estado: `Draft operativo`  
Owner: `Product + Platform`  
Ultima actualizacion: `2026-04-27`

## 1. Proposito

Este documento es la referencia unica para decisiones de negocio, producto, arquitectura y ejecucion de KATEIL durante la fase actual.

Si otro documento contradice este, prevalece este documento.

## 2. Estado actual del programa

- Entorno actual: `dev` (activo)
- Rama operativa actual: `main = dev`
- Produccion: `no activa` a corto plazo
- Objetivo inmediato: consolidar base multi-tenant modular estable antes de separar entornos

## 3. Decisiones cerradas (vigentes)

1. Stack objetivo:
- Front y runtime: `Vercel`
- Base de datos y servicios de datos: `Supabase (PostgreSQL)`
- Codigo fuente y flujo de cambios: `GitHub`

2. Estrategia de entornos:
- Se trabaja solo en `dev` sobre `main`
- La separacion `DEV/PRO` se activa en fase posterior

3. Estrategia de evolucion:
- No reescribir desde cero
- Evolucionar desde base MiMarca por extraccion progresiva de bloques

4. Arquitectura objetivo:
- `core` obligatorio + `modules` opcionales por tenant
- multi-tenant con `organizationId` y controles server-side obligatorios

5. Operativa de activacion:
- los modulos deben poder activarse/desactivarse sin tocar codigo
- se implementara un `Centro de Control` para gestion por tenant

## 4. Contexto de negocio validado

Fuente: material de negocio interno (`Resumen ejecutivo`, `BMC`, `Lean Canvas`, `PRD A+B`).

Hipotesis y direccion:

- problema principal del cliente: falta de control real de stock y ventas
- entry point correcto: `stock + ventas`
- crecimiento por valor incremental: modulos adicionales
- cliente objetivo: retail fisico independiente, pequeno/mediano, baja digitalizacion
- propuesta diferencial: simplicidad + visibilidad + modularidad + acompanamiento cercano

## 5. Vision de producto

KATEIL es una plataforma SaaS multi-tenant para retail fisico donde cada cliente activa solo los modulos que necesita y mantiene su identidad de marca sin forks.

Resultados esperados:

- alta rapida de nuevos clientes
- despliegue unico con capacidades diferentes por tenant
- upgrades continuos sin ramificar producto por cliente

## 6. Modelo funcional (core + modules)

## 6.1 Core funcional del producto (siempre activo)

Este core es la base de valor del producto y no se desactiva:

- `dashboard-core` (simple)
- `sales-core`
- `stock-core`
- `merchandise-core`
- `users-core`

Soporte de plataforma tambien siempre activo:

- autenticacion/sesion
- organizaciones y membresias
- autorizacion base y permisos por modulo
- registro de modulos por tenant
- configuracion base por tenant
- auditoria minima transversal

## 6.2 Modules extra (activables)

- `catalog-plus`
- `suppliers-plus`
- `customers-plus`
- `inventory-plus`
- `expenses-plus`
- `analytics-plus`
- `documents-plus` (futuro)

Regla:

- todo cambio nuevo debe clasificarse explicitamente como `core` o `module`

## 7. Modelo comercial y monetizacion (v1)

Modelo base:

- suscripcion mensual por tienda
- core + modulos adicionales
- escalado por tienda adicional

Referencia economica actual (sujeta a ajuste comercial):

- Core: `39,99 EUR / tienda / mes`
- Business Ops: `20 EUR / tienda / mes`
- Finanzas: `15 EUR / tienda / mes`
- Advanced Analytics: `20 EUR / tienda / mes`
- Tienda adicional: `+20-25 EUR`

## 8. KPI de producto y negocio

KPI prioritarios:

- numero de tiendas activas
- uso semanal/mensual por cliente
- numero de ventas registradas
- tiempo medio de operacion diaria
- MRR
- churn rate
- ticket medio por cliente
- numero medio de modulos activos por cliente

## 9. UX/UI y Lovable

Lovable se usara para elevar UX/UI y branding, separado del trabajo estructural de tenancy/modularidad.

Regla de ejecucion:

- no mezclar en un mismo sprint cambios estructurales de backend con rediseno amplio de UI

## 10. Centro de control de modulos (target)

Se construira un panel de plataforma para:

- activar/desactivar modulos por tenant sin codigo
- fijar estados (`enabled`, `disabled`, `readonly`, `beta`)
- registrar auditoria de cambios (quien, cuando, motivo)
- bloquear desactivacion de modulos `core`

Regla tecnica:

- frontend: ocultar navegacion no habilitada
- backend: bloquear rutas y acciones aunque se fuerce URL

## 11. Roadmap operativo (resumido)

## Fase A (actual): consolidacion dev

- estabilizar base Vercel + Supabase
- cerrar definicion de arquitectura y modulos
- implementar cimientos multi-tenant

## Fase B: base multi-tenant minima

- `Organization`
- `OrganizationMembership`
- `OrganizationModule`
- `activeOrgId` en sesion
- guard server-side por tenant

## Fase C: gates reales por modulo

- bloquear rutas/acciones por modulo en backend
- completar gating de core y extras prioritarios

## Fase D: control center MVP

- panel `Platform > Tenants > Modules`
- toggles por tenant
- auditoria basica

## Fase E: separacion de entornos

- crear entorno `DEV` dedicado
- crear entorno `PRO` dedicado
- definir flujo de promocion `DEV -> PRO`

## 12. Criterios para activar separacion DEV/PRO

Se activa separacion cuando se cumplan minimos:

1. core multi-tenant estable
2. gating real aplicado en modulos clave
3. control center MVP operativo
4. checklist release/rollback cerrado
5. backup/restore verificado de forma repetible

## 13. Backlog inmediato de ejecucion

1. completar matriz final `core vs modules` v1.1
2. cerrar nomenclatura final de modulos y estados
3. crear CRUD backend para gestionar `OrganizationModule`
4. construir UI MVP del centro de control
5. ampliar gating al resto de modulos

## 14. Gobernanza documental

Reglas:

- este documento se actualiza al cerrar cada decision relevante
- cualquier cambio de estrategia de entorno debe reflejarse aqui primero
- fecha y version se actualizan en cada revision

## 15. Referencias

- `docs/kateil/module-packaging-control-matrix-v1.md`
- `docs/kateil/roadmap-execution-vercel-supabase-v1.md`
- `docs/kateil/mimarca-to-kateil-packaging-plan-v1.md`
- `docs/kateil/architecture-core-packages-v1.md`
- `docs/kateil/implementation-phases.md`
