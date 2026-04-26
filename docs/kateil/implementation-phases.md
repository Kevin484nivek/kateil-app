# KATEIL - Plan de Implementacion por Fases

## Fase 0 - Fundacion (1-2 semanas)

Objetivo: preparar base tecnica sin romper MiMarca.

Entregables:

- carpeta `docs/kateil` con blueprint y decisiones
- convencion de estructura `core` + `modules`
- definicion inicial de entidades Core (`Organization`, `Membership`, `OrganizationModule`)
- checklist de reglas backend criticas heredadas de MiMarca

Criterio de salida:

- existe diseño validado para multi-tenant + modularidad

## Fase 1 - Core de tenants + login comun (2-4 semanas)

Objetivo: habilitar login central y contexto de organizacion.

Entregables:

- login comun KATEIL
- selector de organizacion (solo si usuario tiene mas de una)
- session con `activeOrgId`
- middleware y guards de permisos por org
- base de permisos por modulo

Criterio de salida:

- un usuario entra y aterriza en su organizacion correctamente

## Fase 2 - Registro de modulos y feature gates (1-2 semanas)

Objetivo: activar/desactivar bloques por cliente.

Entregables:

- `Module Registry` tecnico y funcional
- tabla `OrganizationModule`
- bloqueo de rutas y acciones si modulo inactivo
- panel simple interno para ver modulos activos por org

Criterio de salida:

- dos organizaciones pueden ver diferentes capacidades con el mismo deploy

## Fase 3 - Migracion de modulos piloto desde MiMarca (4-8 semanas)

Objetivo: extraer valor real sin reescritura total.

Orden recomendado:

1. Catalogo + Proveedores
2. Stock + Movimientos
3. Ventas
4. Dashboard + Finanzas basicas

Reglas:

- mover por bloques completos y testeables
- mantener compatibilidad de datos
- no degradar flujos actuales ya usados en MiMarca

Criterio de salida:

- cliente piloto funcionando sobre KATEIL con modulos activables

## Fase 4 - Preparacion cloud y operacion (2-4 semanas)

Objetivo: dejar listo el salto de local a nube.

Entregables:

- pipeline CI/CD basico
- gestion de secretos y entornos
- backup/restore probado
- logs y metricas basicas
- estrategia de dominios y TLS en cloud

Criterio de salida:

- despliegue reproducible fuera de local, con runbook operativo

## Riesgos principales y mitigacion

- Riesgo: mezclar refactor y nuevas features.
- Mitigacion: workstreams separados (core vs negocio).

- Riesgo: regressiones en reglas de stock/ventas.
- Mitigacion: tests de regresion sobre casos reales importados.

- Riesgo: sobre-diseno temprano.
- Mitigacion: contratos minimos y evolucion iterativa.

## Backlog tecnico inicial (accionable)

1. Definir entidades Core en Prisma sin romper esquema actual.
2. Introducir `organizationId` en nuevas tablas primero.
3. Crear capa `src/core` y `src/modules` para nuevo codigo.
4. Implementar guard server-side por `activeOrgId`.
5. Crear primer modulo registrable: `catalog`.
6. Preparar script de bootstrap para crear organizacion + admin.

