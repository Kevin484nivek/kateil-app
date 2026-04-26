# MiMarca Core vs Packages Matrix v1

Version: `v1-draft`  
Estado: `Draft`  
Owner: `Platform + Product`  
Ultima actualizacion: `2026-04-17`

## 1. Fuentes usadas para esta matriz

GitHub:

- `README.md` del repo `Kevin484nivek/mimarca-backoffice`
- `docs/project/current-status.md`
- `docs/architecture/overview.md`
- `prisma/schema.prisma`

Notion:

- `SW para Mi Marca` (`24ece15967a080e3bdb7f88769be1428`)
- `Fase 4 — DevSecOps (definición y alcance)` (`343ce15967a081c4a1c8d5a93a153bff`)

## 2. Inventario real actual de MiMarca

Bloques funcionales detectados:

- login interno y usuarios
- dashboard analitico
- productos y taxonomia (categoria, subtipo, temporada)
- proveedores
- clientes
- ventas + lineas
- stock + movimientos
- entradas de mercancia
- pedidos de compra
- gastos e ingresos recurrentes/manuales
- integracion documental (estado inicial Google Drive)

Bloques operativos detectados:

- despliegue Docker (`app`, `db`, `backup`)
- backup PostgreSQL
- cloudflared/publicacion por dominio
- baseline DevSecOps en fase de consolidacion

## 3. Definicion de CORE minimo KATEIL (derivado de MiMarca)

### 3.1 CORE de plataforma (siempre activo)

- identidad, sesion y usuarios
- organizaciones (tenant), membresias y `activeOrgId`
- permisos base por rol
- registro de paquetes por tenant (`OrganizationModule`)
- auditoria minima transversal
- backup/restore base
- observabilidad minima (logs + metricas + alertas)

### 3.2 CORE funcional minimo de negocio (piloto MiMarca)

- `catalog-core`: producto + categoria + subtipo + temporada
- `merchant-core`: entidad comercial propia del cliente (modo `self-supplier` por defecto)
- `sales-core`: venta + lineas + numeracion + metodos de pago
- `stock-core`: stock actual + movimientos + validaciones criticas
- `merchandise-core`: entradas de mercancia base
- `search-core`: busqueda inteligente transversal

Reglas de negocio CORE obligatorias:

- no vender con stock 0
- bloquear stock negativo
- crear `StockMovement` en todo cambio real
- generar numeraciones en backend
- guardar snapshots economicos en `SaleLine`

## 4. Paquetes extra (opcionales por cliente)

- `customers-plus`: ficha de cliente y relacion opcional en venta
- `suppliers-plus`: proveedores externos (multi-proveedor, consigna, reglas avanzadas)
- `inventory-plus`: albaran y adjuntos avanzados de mercancia
- `purchase-orders-plus`: pedidos de compra y estados
- `expenses-plus`: gastos/ingresos recurrentes y manuales
- `analytics-plus`: dashboard avanzado, historicos y buscadores
- `documents-plus` (futuro): integraciones documentales completas (ej. Drive)

## 5. Matriz de paquetizacion MiMarca -> KATEIL

| MiMarca bloque | KATEIL paquete | Tipo | Estado actual MiMarca | Dependencias |
|---|---|---|---|---|
| Login + sesion + usuarios | `core-platform` | CORE | Implementado | - |
| Roles base | `core-platform` | CORE | Implementado | - |
| Productos + taxonomia | `catalog-core` | CORE | Implementado | `core-platform` |
| Entidad comercial propia (autoproveedor) | `merchant-core` | CORE | A formalizar en KATEIL | `core-platform` |
| Ventas + lineas | `sales-core` | CORE | Implementado | `catalog-core`, `stock-core` |
| Stock + movimientos | `stock-core` | CORE | Implementado | `catalog-core` |
| Entradas de mercancia base | `merchandise-core` | CORE | Implementado | `catalog-core`, `stock-core`, `merchant-core` |
| Busqueda inteligente transversal | `search-core` | CORE | Implementado | `core-platform` |
| Clientes | `customers-plus` | EXTRA | Implementado | `core-platform`, `sales-core` |
| Proveedores externos | `suppliers-plus` | EXTRA | Implementado | `merchant-core` |
| Albaran/adjuntos de mercancia | `inventory-plus` | EXTRA | Implementado | `merchandise-core` |
| Pedidos de compra | `purchase-orders-plus` | EXTRA | Implementado | `catalog-core`, `suppliers-plus` |
| Gastos/ingresos | `expenses-plus` | EXTRA | Implementado | `core-platform` |
| Dashboard/historicos | `analytics-plus` | EXTRA | Implementado | `sales-core`, `stock-core`, `expenses-plus` |
| Integracion Drive | `documents-plus` | EXTRA | Parcial/Pendiente | `inventory-plus` |

## 6. Dependencias funcionales clave

- no hay `sales-core` sin `catalog-core` y `stock-core`
- `catalog-core` no requiere proveedores externos; se apoya en `merchant-core`
- si el cliente necesita multi-proveedor real, se activa `suppliers-plus`
- `analytics-plus` debe ser opcional y leer de paquetes activos
- `customers-plus` no bloquea venta (cliente es opcional en MiMarca)
- `merchandise-core` permite operativa base incluso sin `suppliers-plus`

## 7. Configuraciones de producto sugeridas

- `KATEIL Starter`:
- `core-platform` + `merchant-core` + `catalog-core` + `stock-core` + `sales-core` + `merchandise-core` + `search-core`

- `KATEIL Operations`:
- Starter + `suppliers-plus` + `inventory-plus` + `purchase-orders-plus` + `customers-plus`

- `KATEIL Business`:
- Operations + `expenses-plus` + `analytics-plus`

## 8. Decisiones aplicables ya

- considerar `customers` como paquete opcional
- mover proveedores externos a `suppliers-plus`
- incluir modo `self-supplier` en CORE mediante `merchant-core`
- incluir `merchandise-core` en CORE funcional minimo
- incluir busqueda inteligente como `search-core`
- separar `analytics` y `expenses` como extras activables
- tratar `documents-plus` como addon independiente por riesgo operativo/integraciones

## 9. Siguiente paso tecnico recomendado

1. introducir tablas CORE (`Organization`, `OrganizationMembership`, `OrganizationModule`)
2. anadir `organizationId` a entidades de negocio
3. implementar guard server-side por tenant
4. extraer primero `catalog-core`, `stock-core`, `sales-core`
