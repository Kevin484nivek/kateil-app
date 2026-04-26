# KATEIL Source of Truth v1

Version: `v1`  
Estado: `Draft operativo`  
Owner: `Product + Platform`  
Ultima actualizacion: `2026-04-26`

## 1. Proposito

Este documento es la referencia unica para decisiones de producto, arquitectura y ejecucion de KATEIL durante la fase actual.

Si otro documento contradice este, prevalece este documento.

## 2. Estado actual del programa

- Entorno actual: `dev` (activo)
- Rama operativa actual: `main = dev`
- Produccion: `no activa` a corto plazo
- Objetivo inmediato: consolidar una base multi-tenant modular estable antes de separar entornos

## 3. Decisiones cerradas (a fecha 2026-04-26)

1. Stack de despliegue objetivo actual:
- Front y runtime: `Vercel`
- Base de datos y servicios de datos: `Supabase (PostgreSQL)`
- Codigo fuente y flujo de cambios: `GitHub`

2. Estrategia de entornos en esta fase:
- Se trabaja solo en `dev` sobre `main`
- No se activa aun separacion `DEV/PRO` hasta tener base mas madura

3. Estrategia de evolucion:
- No reescribir desde cero
- Evolucionar desde base MiMarca por extraccion progresiva de bloques

4. Arquitectura objetivo:
- `core` obligatorio + `packages` opcionales por tenant
- multi-tenant con `organizationId` y controles server-side obligatorios

## 4. Vision de producto KATEIL

KATEIL es una plataforma SaaS multi-tenant para operacion de negocio, donde cada cliente activa solo los modulos que necesita y mantiene su identidad de marca sin forks de codigo.

Resultados esperados:

- alta rapida de nuevos clientes
- despliegue unico con capacidades diferentes por tenant
- upgrades continuos sin ramificar producto por cliente

## 5. Modelo funcional (core + packages)

## 5.1 Core obligatorio

- autenticacion/sesion
- organizaciones y membresias
- autorizacion base y permisos por modulo
- registro de modulos activos por tenant
- configuracion base por tenant
- auditoria minima transversal

## 5.2 Paquetes iniciales

- `catalog-core`
- `stock-core`
- `sales-core`
- `merchandise-core`
- `search-core`
- `customers-plus`
- `suppliers-plus`
- `inventory-plus`
- `expenses-plus`
- `analytics-plus`

Regla:

- todo cambio nuevo debe clasificarse explicitamente como `core` o `package`

## 6. UX/UI y Lovable

Lovable se usara para elevar experiencia y consistencia visual, pero separado del trabajo estructural de tenancy/modularidad.

Regla de ejecucion:

- no mezclar en un mismo sprint cambios estructurales de backend con rediseno amplio de UI

## 7. Roadmap operativo (resumido)

## Fase A (actual): consolidacion dev

- estabilizar base Vercel + Supabase
- cerrar definicion de arquitectura y paquetes
- implementar primeros cimientos multi-tenant

## Fase B: base multi-tenant minima

- `Organization`
- `OrganizationMembership`
- `OrganizationModule`
- `activeOrgId` en sesion
- guard server-side por tenant

## Fase C: primer paquete activable

- paquetizar `catalog-core`
- feature gate por tenant en rutas y acciones

## Fase D: separacion de entornos

Cuando el sistema sea mas maduro:

- crear entorno `DEV` dedicado
- crear entorno `PRO` dedicado
- definir flujo de promocion de cambios `DEV -> PRO`

## 8. Criterios para activar separacion DEV/PRO

Se activa separacion cuando se cumplan estos minimos:

1. core multi-tenant minimo funcional
2. primer paquete activable por tenant en produccion tecnica (no comercial)
3. checklist de release y rollback definido
4. backup/restore verificado de forma repetible

## 9. Backlog inmediato de ejecucion (Sprint siguiente)

1. Crear migracion Prisma con:
- `Organization`
- `OrganizationMembership`
- `OrganizationModule`

2. Extender sesion:
- incluir `activeOrgId`

3. Implementar guard server-side:
- validacion de tenant en rutas privadas y server actions

4. Introducir registro de modulos:
- helper central para comprobar modulo activo

5. Aplicar primer gate real:
- bloquear acceso funcional de `catalog` si modulo inactivo

## 10. Gobernanza documental

Reglas:

- este documento se actualiza al cerrar cada decision relevante
- cualquier cambio de estrategia de entorno (por ejemplo DEV/PRO) debe reflejarse aqui primero
- fecha y version se actualizan en cada revision

## 11. Referencias

- `docs/kateil/roadmap-execution-vercel-supabase-v1.md`
- `docs/kateil/mimarca-to-kateil-packaging-plan-v1.md`
- `docs/kateil/architecture-core-packages-v1.md`
- `docs/kateil/implementation-phases.md`
