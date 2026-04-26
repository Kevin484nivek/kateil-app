# KATEIL Roadmap de Ejecucion (Vercel + Supabase) v1

Version: `v1`  
Estado: `Draft operativo`  
Base analizada: repo actual `mimarca-backoffice` + docs `docs/kateil/*`  
Fecha: `2026-04-26`

## 1. Diagnostico Git actual

- El workspace actual esta en `mimarca-backoffice` (`main` -> `origin/main`).
- `docs/kateil/` existe en este repo y todavia no esta commiteado.
- No hay clon local separado llamado `kateil` en `repos/`.
- La base funcional ya existe en MiMarca (catalogo, ventas, stock, clientes, proveedores, gastos, dashboard).

Implicacion:

- El arranque mas seguro es `MiMarca -> KATEIL` por extraccion de bloques.
- No conviene reescribir desde cero.

## 2. Decisiones que hay que cerrar (gates)

### Gate D0 - Repositorio fuente de verdad

Decision:

- Opcion A: KATEIL nace como repo nuevo y MiMarca migra por fases.
- Opcion B: KATEIL vive temporalmente en este repo hasta extraer core.

Recomendacion:

- A corto plazo, B para velocidad.
- En cuanto exista Core multi-tenant estable, mover a repo KATEIL dedicado.

### Gate D1 - Modelo de tenancy

Decision:

- Modelo inicial: BD compartida + `organization_id` en tablas de negocio.

Recomendacion:

- Aceptado en blueprint y docs actuales. Mantenerlo.

### Gate D2 - Auth inicial

Decision:

- Seguir auth propia temporalmente o pasar ya a Supabase Auth.

Recomendacion:

- Fase inicial: mantener auth actual y anadir `activeOrgId`.
- Fase posterior: migrar a Supabase Auth sin bloquear paquetizacion.

### Gate D3 - Catalogo de modulos minimo

Decision:

- Que entra en CORE minimo y que va como PLUS.

Recomendacion:

- CORE: `core-platform`, `catalog-core`, `merchant-core`, `stock-core`, `sales-core`, `merchandise-core`, `search-core`.
- PLUS: `customers-plus`, `suppliers-plus`, `inventory-plus`, `purchase-orders-plus`, `expenses-plus`, `analytics-plus`, `documents-plus`.

### Gate D4 - Estrategia de marca por cliente

Decision:

- Sistema de estilos por tenant por tokens.

Recomendacion:

- `organization_theme` + CSS variables en `AppShell`.
- Mismos componentes para todos los clientes.

## 3. Arquitectura objetivo (esqueleto)

## 3.1 Backend

- PostgreSQL en Supabase.
- Prisma como acceso principal de app.
- RLS habilitada en tablas sensibles.
- Guard server-side obligatorio por `activeOrgId`.
- `ModuleRegistry` para habilitar/denegar modulos por tenant.

Tablas Core iniciales:

- `organization`
- `organization_membership`
- `organization_module`
- `organization_theme`
- `feature_flag` (opcional en fase temprana, recomendado)

## 3.2 Frontend

- Un `AppShell` unico.
- Navegacion construida segun modulos activos.
- Rutas protegidas por modulo + permiso.
- Sistema de componentes unico.
- Tema por tenant (tipografia, colores, radios, logo) inyectado por tokens.

## 4. Roadmap por fases

## Fase 0 - Setup cloud y baseline (1 semana)

Objetivo:

- Tener pipeline real `GitHub -> Vercel -> Supabase` funcionando.

Entregables:

- proyecto Vercel conectado al repo
- proyecto Supabase creado
- variables de entorno definidas (`dev`, `preview`, `prod`)
- deploy preview por PR

Done:

- una PR dispara preview en Vercel y conecta a Supabase dev

## Fase 1 - Core multi-tenant minimo (1-2 semanas)

Objetivo:

- introducir tenancy sin romper flujos actuales.

Entregables:

- migraciones Prisma de tablas Core
- `activeOrgId` en sesion
- middleware/guard por tenant
- bootstrap script: crear org + admin + modulos base

Done:

- un usuario entra y aterriza en su org

## Fase 2 - Registry de modulos (1 semana)

Objetivo:

- habilitar/deshabilitar paquetes por organizacion.

Entregables:

- `ModuleRegistry` tecnico
- chequeo server-side por modulo activo
- construccion dinamica de menu/rutas segun modulos

Done:

- dos orgs en el mismo deploy ven capacidades diferentes

## Fase 3 - Extraccion por bloques desde MiMarca (4-8 semanas)

Objetivo:

- paquetizar sin reescritura total.

Orden:

1. `catalog-core`
2. `stock-core`
3. `sales-core`
4. `suppliers-plus` y `customers-plus`
5. `merchandise-core` + `inventory-plus`
6. `expenses-plus`
7. `analytics-plus`

Done:

- MiMarca funciona como tenant piloto sobre KATEIL modular

## Fase 4 - Branding multi-cliente (1-2 semanas)

Objetivo:

- mismo producto, estilos por cliente.

Entregables:

- tabla `organization_theme`
- tokens de tema por tenant
- loader de tema en `AppShell`

Done:

- cliente A y B con identidad visual distinta sin fork

## Fase 5 - Hardening de produccion (2 semanas)

Objetivo:

- dejar operacion segura y repetible.

Entregables:

- backup/restore probado
- observabilidad minima
- release policy
- checklist de readiness por tenant nuevo

Done:

- runbook de alta de cliente ejecutable de punta a punta

## 5. Paquetizacion concreta desde codigo actual

Mapeo inicial (origen actual):

- `src/app/(private)/products` + `catalogs` -> `catalog-core`
- `src/app/(private)/stock-movements` -> `stock-core`
- `src/app/(private)/sales/*` -> `sales-core`
- `src/app/(private)/suppliers/*` -> `suppliers-plus`
- `src/app/(private)/customers/*` -> `customers-plus`
- `src/app/(private)/inventory-entries/*` -> `merchandise-core` + `inventory-plus`
- `src/app/(private)/expenses/*` -> `expenses-plus`
- `src/app/(private)/dashboard/*` -> `analytics-plus`
- `src/app/(private)/users/*` + `src/lib/auth/*` -> `core-platform`

## 6. Riesgos y como controlarlos

- Riesgo: mezclar rediseno Lovable y refactor multi-tenant.
- Control: separar workstreams.

- Riesgo: regresion en stock y ventas.
- Control: tests de regresion sobre casos reales antes de cada release.

- Riesgo: meter logica de modulos solo en frontend.
- Control: validacion de modulo en backend obligatoria.

## 7. Primer sprint recomendado (arranque)

1. crear branch de trabajo KATEIL base
2. configurar Vercel + Supabase dev
3. anadir tablas Core + migracion
4. extender sesion con `activeOrgId`
5. implementar guard multi-tenant server-side
6. extraer `catalog-core` como primer modulo registrable

Resultado del sprint:

- KATEIL arranca sobre base MiMarca con tenancy minimo y primer modulo paquetizado.
