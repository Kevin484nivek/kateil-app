# Project Brief

## Objetivo

Desarrollar una aplicación web de gestión de stock, ventas, clientes y analítica para una tienda física, reemplazando el flujo actual en Excel.

## Alcance MVP

- productos
- proveedores
- clientes
- ventas
- entradas de mercancía
- movimientos de stock
- dashboard analítico
- usuarios internos

## Contexto operativo

- despliegue inicial en host Ubuntu 24.04 Linux nativo
- ejecución con Docker
- código y documentación en GitHub
- backups automáticos de PostgreSQL con copia externa

## Reglas de negocio esenciales

- sin stock no hay venta
- el agotado sigue visible
- el proveedor es obligatorio para producto
- el stock se mueve con trazabilidad completa
- no se elimina información operativa: se desactiva
- consignación calcula reparto tienda/proveedor en backend

## Pagos soportados

- efectivo
- tarjeta
- bizum
