# MiMarca to KATEIL Packaging Plan v1

Version: `v1-draft`  
Estado: `Draft`  
Owner: `Platform + Engineering`  
Ultima actualizacion: `2026-04-17`

## 1. Objetivo

Convertir MiMarca en piloto de KATEIL paquetizado, migrando por bloques sin reescritura total.

## 2. Estrategia de migracion

- enfoque `strangler`: extraer bloques gradualmente
- mantener operacion estable en cada paso
- priorizar compatibilidad de datos y reglas de negocio

## 3. Fases de paquetizacion

### Fase A - Preparacion base

- introducir entidades CORE: `Organization`, `OrganizationMembership`, `OrganizationModule`
- extender sesion con `activeOrgId`
- definir guard multi-tenant server-side

Salida de fase:

- app funciona con contexto de organizacion

### Fase B - Extraccion de paquete `catalog`

- mover logica y UI de catalogo a paquete `catalog`
- asegurar permisos y filtros por tenant

Salida de fase:

- `catalog` activable por tenant

### Fase C - Extraccion de `suppliers`, `customers`, `stock`

- separar dominios en paquetes independientes
- conservar reglas actuales de MiMarca

Salida de fase:

- bloques principales de datos maestros e inventario paquetizados

### Fase D - Extraccion de `sales` + `inventory`

- mover flujos de venta y entradas de mercancia
- garantizar integridad de stock y snapshots economicos

Salida de fase:

- operativa principal de negocio en paquetes

### Fase E - Extraccion de `expenses` + `analytics`

- desacoplar finanzas basicas y dashboard
- homogeneizar contratos de metricas por paquete

Salida de fase:

- capa analitica modular y activable por tenant

## 4. Definicion de Done por paquete

Un paquete se considera listo cuando cumple:

- manifiesto de paquete
- permisos por accion
- aislamiento por tenant
- pruebas minimas en verde
- migraciones validadas
- documentacion funcional/tecnica actualizada

## 5. Mapa MiMarca -> KATEIL (inicial)

- `src/features/products` -> `package: catalog`
- `src/features/suppliers` -> `package: suppliers`
- `src/features/customers` -> `package: customers`
- `src/features/stock` -> `package: stock`
- `src/features/sales` -> `package: sales`
- `src/features/dashboard` -> `package: analytics`
- `src/app/(private)/inventory-entries` -> `package: inventory`
- `src/app/(private)/expenses` -> `package: expenses`

## 6. Riesgos y controles

- riesgo: mezclar refactor con nuevas features
- control: congelar alcance por fase y evitar cambios cruzados

- riesgo: regresion en reglas criticas de venta/stock
- control: suite de regresion obligatoria por fase

- riesgo: deriva de arquitectura
- control: revision de contratos de paquete en cada PR

## 7. Prioridad de ejecucion recomendada

1. CORE multi-tenant
2. `catalog`
3. `stock`
4. `sales`
5. `suppliers` y `customers`
6. `inventory`
7. `expenses`
8. `analytics`

