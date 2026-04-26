# KATEIL Blueprint v0

## 1. Vision

KATEIL nace como plataforma modular para construir software de gestion por empresa (tenant), reutilizando una base comun y activando solo los bloques necesarios por cliente.

Objetivo practico:

- superar el modelo actual de MiMarca sin tirar lo construido
- paquetizar funcionalidades para activar/desactivar por organizacion
- mantener upgrades continuos sin forks por cliente
- empezar en local con camino claro a cloud

## 2. Resultado de producto buscado

KATEIL debe permitir:

- login comun de KATEIL
- entrada directa del usuario a su organizacion
- control de modulos contratados por organizacion
- configuracion por cliente (branding, reglas, permisos, integraciones)
- releases incrementales compatibles con clientes simples y avanzados

## 3. Principios de arquitectura

- Core primero: auth, tenants, usuarios, permisos, auditoria, billing/planes, configuracion
- Modulos desacoplados: cada dominio funcional vive en su paquete/carpeta propia
- Contratos estables: APIs internas con interfaces y eventos de dominio
- Datos por tenant: todas las entidades de negocio ligadas a `organizationId`
- Feature gates: funcionalidades activadas por plan/modulo/flag
- Upgrade seguro: migraciones versionadas, backward compatibility y kill switches

## 4. Arquitectura funcional (alto nivel)

### 4.1 Core KATEIL

- Identity + Session Service
- Organization Service (tenants, membership, rol base)
- Authorization Service (RBAC por modulo y accion)
- Module Registry (catalogo de bloques instalables)
- Configuration Service (parametros por tenant)
- Audit Service (trazabilidad transversal)

### 4.2 Modulos de negocio (pilotados desde MiMarca)

Bloques iniciales para porting:

- Catalogo (productos, categorias, temporadas, proveedor)
- Ventas (tickets, lineas, descuentos, cobros)
- Stock (movimientos, entradas, validaciones)
- Clientes
- Compras/Mercancia
- Dashboard/Analitica
- Finanzas basicas (gastos/ingresos del periodo)

Cada modulo expone:

- dominio (reglas)
- application services (casos de uso)
- infra/data (Prisma/repositorios)
- UI (pantallas/componentes)
- permisos por accion

## 5. Multi-tenant y aislamiento de datos

Modelo recomendado para esta etapa:

- una sola base PostgreSQL
- tablas compartidas con `organizationId`
- indices compuestos por tenant en tablas criticas
- politicas de acceso obligatorias en backend (nunca confiar en frontend)

Evolucion futura posible:

- mover tenants grandes a schema o DB dedicada sin romper contratos del Core

### 5.1 Politica de paso a BD dedicada (aprobada)

Regla base:

- por defecto, todo cliente nuevo entra en modelo de BD compartida multi-tenant
- BD dedicada se habilita solo con criterio justificado y aprobado

Criterios de paso por cumplimiento o contrato (cualquiera activa evaluacion inmediata):

- exigencia contractual de aislamiento fisico/logico estricto
- requisito legal o de auditoria que no acepte BD compartida
- necesidad explicita de claves o politicas de cifrado dedicadas por cliente

Criterios de paso por escala tecnica (evaluar en ventana de 30 dias):

- consumo sostenido de recursos del cliente superior al `20%` del total de la BD compartida
- crecimiento de datos del cliente que comprometa capacidad o mantenimiento del entorno comun
- carga del cliente que degrade SLO global del resto de tenants de forma repetida

Criterios de paso por riesgo operativo:

- historial de incidentes donde el aislamiento compartido incremente riesgo de continuidad
- necesidad de ventanas de mantenimiento especificas incompatibles con operacion compartida

### 5.2 Niveles de aislamiento soportados

- `Nivel A`: BD compartida con `organizationId` (modelo por defecto)
- `Nivel B`: schema dedicado por cliente en misma instancia (opcional intermedio)
- `Nivel C`: BD dedicada por cliente (modo enterprise)

### 5.3 Proceso de decision

1. apertura de evaluacion tecnica/comercial con evidencia
2. analisis de impacto en coste, riesgo y operacion
3. aprobacion conjunta `PlatformOwner + SecurityAdmin + ProductOwner`
4. plan de migracion y validacion
5. cierre con evidencia de integridad y rendimiento

### 5.4 Regla economica de sostenibilidad

- el paso a BD dedicada debe estar cubierto por plan/comercial del cliente
- no se aprueba BD dedicada sin modelo de costes y operacion viable

## 6. Login comun KATEIL y entrada por organizacion

Flujo recomendado:

1. usuario autentica en `auth.kateil.local` (o dominio cloud)
2. sistema resuelve memberships del usuario
3. si tiene una sola organizacion, redirige directo a `/{orgSlug}/dashboard`
4. si tiene varias, muestra selector de organizacion
5. session token incluye `userId`, `activeOrgId`, `roles`, `enabledModules`

Regla clave:

- toda request autenticada valida `activeOrgId` + permisos del modulo

## 7. Modularidad y empaquetado

Separar claramente tres niveles:

- `platform/core`: auth, tenant, permisos, modulos, auditoria
- `platform/modules/*`: bloques funcionales enchufables
- `apps/web`: shell UI que compone core + modulos activos

Activacion de modulos por tenant:

- tabla `OrganizationModule` con estado, fecha activacion y version minima
- feature flags por tenant para rollout gradual
- bloqueo de rutas/acciones cuando modulo no esta activo

## 8. Compatibilidad con MiMarca (pilot)

Estrategia recomendada:

- no rehacer todo de golpe
- extraer de MiMarca por "strangler pattern" en bloques

Orden de extraccion sugerido:

1. Auth + Organization Core
2. Catalogo + Stock base
3. Ventas
4. Dashboard + Finanzas
5. Bloques secundarios y hardening

Cada bloque migrado debe mantener:

- mismas reglas criticas de backend (stock, numeraciones, snapshots)
- pruebas de regresion de flujos reales de MiMarca

## 9. Entorno local con dominio (y salto a cloud)

Fase local recomendada:

- `app.kateil.local` -> frontend/web
- `auth.kateil.local` -> login
- `api.kateil.local` -> endpoints internos si se separan
- reverse proxy local (Caddy/Nginx) y certificados locales con mkcert

Modelo MVP cloud aprobado (fase piloto):

- proveedor: `AWS`
- servicio inicial: `AWS Lightsail Linux` con `IPv4 publica`
- plan inicial: `12 USD/mes` (`2 vCPU`, `2 GB RAM`, `60 GB SSD`)
- topologia: `dev` local + `prod` cloud
- alcance inicial previsto: `1-2 clientes`
- uso de arquitectura compartida multi-tenant (una app + una BD)

Regla de escalado MVP:

- iniciar en `12 USD`
- subir a `24 USD` cuando se detecte saturacion real
- siguiente salto a `44 USD` y luego `84 USD` solo por necesidad medida

Umbrales operativos para escalar:

- RAM > `75%` sostenida
- CPU > `70%` sostenida
- disco > `70%` de uso
- degradacion sostenida de latencia en operaciones criticas

Paridad minima de seguridad/operacion en cloud:

- variables de entorno por servicio
- secretos fuera del repo
- backups verificados
- observabilidad basica (logs + metricas + alertas)

## 10. Modelo de datos minimo inicial (Core)

Entidades base:

- `User`
- `Organization`
- `OrganizationMembership`
- `Role`
- `Permission`
- `OrganizationModule`
- `FeatureFlag`
- `AuditLog`

Entidades de negocio de modulos siempre incluyen:

- `organizationId`
- `createdBy` / `updatedBy`
- timestamps
- soft delete cuando aplique

## 11. Seguridad y gobernanza

- control de acceso en server actions / APIs
- validacion Zod en borde de entrada
- auditoria de cambios sensibles (stock, ventas, configuracion fiscal)
- politicas de backup y restore testeadas
- estrategia de migraciones reversible cuando sea posible

## 12. KPIs de exito para KATEIL

- tiempo de alta de un nuevo cliente (objetivo: horas, no dias)
- porcentaje de codigo compartido entre clientes
- numero de modulos activables sin cambios de codigo
- lead time de upgrade entre versiones
- defectos por regresion tras upgrades

## 13. Decision para arrancar ya

Para iniciar rapido sin sobrearquitectura:

- mantener stack Next.js + Prisma + PostgreSQL
- introducir `organizationId` de forma sistematica
- crear `Module Registry` y `OrganizationModule` desde el inicio
- separar carpetas por `core` y `modules`
- migrar MiMarca por bloques prioritarios
