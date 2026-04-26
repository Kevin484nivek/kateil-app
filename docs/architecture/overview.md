# Architecture Overview

## Principios

- una sola aplicación Next.js
- frontend y backend integrados
- acceso a datos con Prisma
- lógica de dominio aislada por servicios
- validaciones críticas en backend
- soft delete por `isActive`

## Contenedores

- `app`: aplicación Next.js
- `db`: PostgreSQL
- `backup`: ejecución de backup PostgreSQL

## Exposición web

- el proyecto no depende del `Traefik` ni del plano de acceso compartido del homelab
- la app publica `127.0.0.1:3010->3000` solo para el host local
- `cloudflared` enruta `mimarca.kevbeaoca.uk` directamente a `http://localhost:3010`
- el dominio público se controla mediante `APP_DOMAIN`
- el cambio a un dominio futuro debe requerir solo variables de entorno y DNS

## Capas recomendadas

- `src/app`: rutas, layouts y páginas
- `src/components`: UI reutilizable
- `src/features`: composición por módulo funcional
- `src/lib/services`: lógica de negocio
- `src/lib/db`: cliente Prisma y acceso a datos
- `src/lib/validators`: validación Zod

## Dominios iniciales

- auth
- dashboard
- products
- suppliers
- customers
- sales
- stock
- users

## Reglas backend obligatorias

- validar stock antes de vender
- bloquear stock negativo
- generar numeraciones en backend
- calcular `storeAmount` y `supplierAmount` en backend
- crear `StockMovement` en todo cambio real de inventario
- guardar snapshots en `SaleLine`
