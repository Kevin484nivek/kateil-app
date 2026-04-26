# Devoluciones y cambios en `Nueva venta`

## Objetivo

Resolver devoluciones sin crear un módulo nuevo, usando el flujo actual de `Nueva venta`.

## Flujo operativo

1. En `Nueva venta`, seleccionar modo `Devolución-cambio`.
2. Buscar y seleccionar el ticket original.
3. Añadir líneas devueltas desde ese ticket (con control de cantidad disponible real).
4. Añadir, si aplica, nuevas líneas de venta en el mismo ticket.
5. Confirmar operación:
   - la devolución incrementa stock
   - la nueva venta descuenta stock
   - el total final del ticket queda como saldo neto (`venta - devolución`)

## Reglas clave

- No se permite devolver más unidades que las vendidas y no devueltas previamente.
- Toda devolución queda vinculada a un ticket original.
- En modo `NORMAL` no se aceptan líneas de devolución.
- El histórico identifica el ticket como `devolución-cambio` y muestra ticket origen.

## Datos que guarda el sistema

- Tipo de venta (`saleKind`): `NORMAL` o `RETURN_EXCHANGE`.
- Totales separados:
  - `saleItemsTotalAmount` (líneas vendidas)
  - `returnTotalAmount` (líneas devueltas)
  - `totalAmount` (saldo neto)
- Líneas devueltas en tabla dedicada `SaleReturnLine`.

## Impacto funcional

- `Nueva venta`: selector de modo + selector de ticket original + editor de líneas devueltas.
- `Histórico de ventas`: búsqueda y etiquetas de devoluciones/cambios.
- `Detalle de venta`: desglose de líneas devueltas y enlace al ticket original.
- `Stock`: movimientos positivos en devolución y negativos en venta dentro de la misma operación.
