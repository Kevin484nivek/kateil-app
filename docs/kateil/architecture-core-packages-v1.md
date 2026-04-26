# KATEIL Core and Packages Architecture v1

Version: `v1-draft`  
Estado: `Draft`  
Owner: `Platform + Product`  
Ultima actualizacion: `2026-04-17`

## 1. Objetivo

Definir el modelo de producto y arquitectura de KATEIL basado en:

- `CORE` obligatorio para todos los clientes
- `PAQUETES` opcionales activables por necesidad

## 2. Regla principal del producto

Todo cliente KATEIL tiene siempre:

- CORE activo

Todo cliente puede tener ademas:

- uno o varios paquetes opcionales

No existe cliente sin CORE.

## 3. Que incluye el CORE (obligatorio)

### 3.1 Plataforma

- autenticacion y sesion
- organizacion (tenant) y membresias
- autorizacion por rol y permisos base
- registro de modulos/paquetes activos por cliente
- configuracion base por tenant
- auditoria transversal minima

### 3.2 Operacion

- health checks
- logs estructurados minimos
- backup/restore base
- gestion de usuarios internos del cliente
- busqueda inteligente transversal base

### 3.3 Datos y seguridad

- modelo multi-tenant por `organizationId`
- controles server-side de aislamiento
- validacion de entrada en backend

## 4. Que es un paquete opcional

Un paquete es un bloque funcional independiente que:

- tiene su propio dominio y casos de uso
- expone permisos por accion
- puede activarse/desactivarse por tenant
- depende del CORE, pero no al reves

## 5. Catalogo inicial de paquetes (derivado de MiMarca)

- `catalog-core`: productos, categorias, temporadas, subtipos
- `merchant-core`: entidad comercial propia del cliente (modo `self-supplier` por defecto)
- `sales-core`: ventas y lineas de venta
- `stock-core`: movimientos y validaciones de inventario
- `merchandise-core`: entradas de mercancia base
- `search-core`: busqueda inteligente transversal
- `suppliers-plus`: proveedores externos y reglas de compra/consigna
- `customers-plus`: clientes
- `inventory-plus`: adjuntos y albaranes avanzados
- `purchase-orders-plus`: pedidos de compra
- `expenses`: gastos/ingresos periodicos
- `analytics`: dashboard y metricas
- `documents` (futuro): gestion documental ampliada

## 6. Contrato tecnico de paquetes

Cada paquete debe tener:

- `manifest` (id, version, dependencias, permisos)
- migraciones propias
- feature flags por tenant
- guard de acceso por paquete activo
- pruebas minimas del paquete

## 7. Dependencias entre paquetes

Reglas:

- dependencias explicitas y declaradas
- evitar dependencias circulares
- CORE no depende de paquetes

Dependencias iniciales sugeridas:

- `sales-core` depende de `catalog-core`, `stock-core`
- `merchandise-core` depende de `catalog-core`, `stock-core`, `merchant-core`
- `suppliers-plus` extiende `merchant-core` para multiples proveedores externos
- `inventory-plus` depende de `merchandise-core`
- `purchase-orders-plus` depende de `catalog-core`, `suppliers-plus`
- `analytics` depende de `sales-core`, `stock-core`, `expenses`

## 8. Modos de producto por cliente (pack comercial)

- `KATEIL Base`: CORE + `catalog` + `sales` + `stock`
- `KATEIL Commerce`: Base + `suppliers-plus` + `inventory-plus` + `customers-plus`
- `KATEIL Business`: Commerce + `expenses` + `analytics`

Nota:

- los packs comerciales reutilizan los mismos paquetes tecnicos

## 9. Reglas de activacion por tenant

- activacion de paquete por `OrganizationModule`
- activacion efectiva por fecha/version
- bloqueo de rutas/actions si paquete inactivo
- datos historicos no se borran al desactivar; se bloquea operativa

## 10. Regla de evolucion

Todo desarrollo nuevo en KATEIL debe decidir primero:

1. si pertenece a CORE
2. si pertenece a un paquete existente
3. si requiere paquete nuevo

Si no hay decision explicita, el cambio no se aprueba.
