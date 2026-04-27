# KATEIL Module Packaging and Control Matrix v1

Version: `v1.1`  
Estado: `Draft operativo`  
Owner: `Product + Platform`  
Ultima actualizacion: `2026-04-27`

## 1. Objetivo

Definir la matriz final de modulos para:

- empaquetar el producto de forma consistente
- activar/desactivar capacidades por tenant
- implementar el futuro centro de control sin ambiguedad

## 2. Regla principal

- `CORE`: siempre activo, no desactivable desde UI
- `MODULE`: opcional, activable por tenant

## 3. Matriz v1.1

| Clave tecnica | Tipo | Incluido por defecto | Desactivable | Ambito funcional |
|---|---|---|---|---|
| `DASHBOARD_CORE` | CORE | Si | No | Resumen operativo basico |
| `SALES_CORE` | CORE | Si | No | Venta, devolucion, historico de ventas |
| `STOCK_CORE` | CORE | Si | No | Stock y movimientos base |
| `MERCHANDISE_CORE` | CORE | Si | No | Entradas de mercancia base |
| `USERS_CORE` | CORE | Si | No | Usuarios y accesos internos |
| `CATALOG_PLUS` | MODULE | No | Si | Gestion de catalogo avanzada |
| `SUPPLIERS_PLUS` | MODULE | No | Si | Proveedores y reglas avanzadas |
| `CUSTOMERS_PLUS` | MODULE | No | Si | Clientes y trazabilidad comercial |
| `INVENTORY_PLUS` | MODULE | No | Si | Adjuntos, documentos y procesos avanzados de mercancia |
| `EXPENSES_PLUS` | MODULE | No | Si | Finanzas operativas (gastos/ingresos) |
| `ANALYTICS_PLUS` | MODULE | No | Si | Analitica avanzada y cuadros adicionales |
| `DOCUMENTS_PLUS` | MODULE | No | Si | Integraciones documentales externas |

## 4. Mapeo inicial de rutas (v1)

| Ruta / area | Modulo requerido |
|---|---|
| `/dashboard` | `DASHBOARD_CORE` |
| `/sales/new` | `SALES_CORE` |
| `/sales/history` | `SALES_CORE` |
| `/stock-movements` | `STOCK_CORE` |
| `/inventory-entries` | `MERCHANDISE_CORE` |
| `/users` | `USERS_CORE` |
| `/products` | `CATALOG_PLUS` |
| `/catalogs` | `CATALOG_PLUS` |
| `/suppliers` | `SUPPLIERS_PLUS` |
| `/customers` | `CUSTOMERS_PLUS` |
| `/expenses` | `EXPENSES_PLUS` |

## 5. Reglas de control

1. Frontend:
- ocultar navegacion de modulos no activos

2. Backend:
- bloquear rutas y server actions si el modulo no esta activo

3. Seguridad:
- nunca confiar solo en ocultacion visual

4. Core:
- no se permite desactivar modulos CORE desde el centro de control

## 6. Estados de modulo para control center

Estados previstos:

- `enabled`
- `disabled`
- `readonly` (futuro)
- `beta` (futuro)

## 7. Auditoria minima obligatoria

Cada cambio de modulo por tenant debe guardar:

- `organizationId`
- `moduleKey`
- estado anterior y nuevo
- usuario operador
- fecha/hora
- motivo

## 8. Siguiente paso tecnico

1. alinear enum Prisma a esta nomenclatura v1.1
2. crear panel MVP `Platform > Tenants > Modules`
3. aplicar gating total en todas las rutas y acciones mapeadas
