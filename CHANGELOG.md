# Changelog

Todos los cambios relevantes del proyecto se documentarán aquí.

## [0.1.0] - 2026-03-30

### Added

- estructura inicial del repositorio
- README base del proyecto
- documentación inicial de producto, arquitectura y backups
- `docker-compose.yml` y `Dockerfile`
- esquema Prisma inicial del MVP
- script inicial de backup PostgreSQL
- preparación para Traefik compartido y dominio configurable
- base de automatización para GitHub
- nota operativa sobre deuda técnica de secretos y rotación de credenciales
- home inicial en Next.js para eliminar el `404` del despliegue
- auth interna básica, shell privada y seed inicial
- migración inicial de Prisma añadida al repositorio
- generación de Prisma asegurada en instalación y build del contenedor
- copia temprana de `prisma/` en Docker para evitar fallo de `postinstall`
- configuración estándar de `prisma db seed` en `package.json`
- módulos base funcionales de proveedores, clientes y productos
- entradas de mercancía y movimientos de stock conectados a backend
- flujo base de ventas, histórico y detalle conectados a backend

### Backlog próximo

- subtipos de prenda y temporada como catálogos editables reutilizables en productos, ventas y entradas

## [0.1.1] - 2026-03-31

### Added

- catálogos editables de subtipos de prenda y temporadas
- integración de subtipo y temporada en productos, ventas y entradas

## [0.2.0] - 2026-04-02

### Added

- taxonomía final cargada en sistema desde revisión empírica del Excel
- dashboard dividido en vistas: general, ventas, proveedor y operativa
- pantalla de usuarios con gestión básica
- roles internos `SUPERADMIN`, `ADMIN` y `SUPERUSER`
- acceso remoto SSH por Cloudflare Tunnel + Access documentado
- documentación viva del proyecto con estado actual y lecciones aprendidas
- importadores remotos para proveedores, productos y ventas históricas
- carga de proveedores reales normalizados
- carga de catálogo histórico normalizado
- carga de ventas históricas enlazadas con producto

### Changed

- despliegue pasado a modo producción real con `next build` + `next start`
- menú lateral plegable, con footer de sesión y logout
- títulos y cabeceras más contenidos
- estrategia de importación histórica cerrada por fases: proveedores -> productos -> ventas
- generación de productos legacy auxiliares para cerrar líneas de venta sin producto en el catálogo principal

### Fixed

- varios errores de tipado que solo aparecían en build de producción
- varios enlaces dinámicos adaptados a `typedRoutes`
- warning de Prisma por `package.json#prisma` resuelto con `prisma.config.ts`
- problemas de codificación de tildes en importación de proveedores
- mapeos de proveedor y taxonomía necesarios para cerrar la normalización

## [0.2.1] - 2026-04-03

### Added

- selector de periodo en dashboard con vistas mensual y anual
- navegación rápida por años y meses para revisar histórico comercial
- paginación server-side en `Productos`
- paginación server-side en `Histórico de ventas`
- alta de usuario mediante pop-up desde la pantalla de usuarios

### Changed

- dashboard ajustado para trabajar con el periodo seleccionado en lugar del mes actual fijo
- histórico de ventas resumido en listado, dejando el detalle completo en la vista individual
- listado de usuarios convertido en acordeón plegable
- sesión activa en sidebar mostrando nombre en vez de email

### Fixed

- dashboard vacío cuando el mes actual no tenía ventas importadas
- cuello de botella principal en `Productos` por cargar y renderizar el listado completo
- cuello de botella principal en `Histórico` por cargar ventas y líneas completas de una vez
- primera fase responsive cerrada para tablet, dejando móvil como siguiente fase UX prioritaria

## [0.2.2] - 2026-04-04

### Added

- módulo de `Gastos` con alta manual, edición y recurrencia simple
- generación automática de gasto `MERCHANDISE` al registrar entradas reales de mercancía
- navegación desde `Histórico de ventas` al producto vendido y vuelta directa a la venta
- justificante imprimible por proveedor con filtros por mes/año o año completo
- albarán imprimible para entradas reales de mercancía
- precio final objetivo en `Nueva venta`, recalculando el descuento global equivalente

### Changed

- `Dashboard` deja preparado el terreno para cruzar gastos y beneficio en una fase posterior
- `Mercancía` refuerza su papel documental con adjuntos, confirmación previa y acceso a albarán
- `next.config.ts` amplía el límite de `Server Actions` a `10mb` para soportar mejor formularios con adjuntos

### Fixed

- fechas y horas visibles ajustadas a `Europe/Madrid`
- guardado de mercancía con confirmación previa y navegación posterior más clara
- despliegue bloqueado por tipos `Decimal` en el albarán de mercancía

### Pending

- validar bien el flujo de PDFs grandes en adjuntos de `Mercancía`; con ficheros reales de varios MB sigue siendo un punto a revisar
- definir la regla contable del IVA soportado en mercancía antes de tocar beneficio y coste efectivo
- documentar y extender el nuevo motor común de búsqueda inteligente al resto de listados que todavía no lo usen

## [0.2.3] - 2026-04-04

### Added

- motor común de búsqueda inteligente con normalización, eliminación de tildes, tokenización y ranking básico compartido
- buscador en `Histórico de ventas` por número de venta, clienta, producto, código y proveedor
- filtros vivos en `Productos` y `Proveedores`, con autoenvío y debounce reutilizable

### Changed

- `Nueva venta`, `Mercancía` y el justificante de proveedor pasan a usar el mismo criterio de búsqueda por palabras y campos cruzados
- `Histórico de ventas` conserva el término de búsqueda al entrar y volver desde el detalle
- `Productos` mantiene el contexto de vuelta a venta también al cambiar filtros en vivo

### Fixed

- búsquedas compuestas como `Vestido Alma Blanca` ya no dependen de que la frase exista seguida en un solo campo
- incoherencias entre buscadores que antes mezclaban `includes` simples y filtros aislados según la pantalla

## [0.2.4] - 2026-04-05

### Added

- check `Aplicar IVA al coste` en proveedores para marcar proveedores cuyo producto propio debe calcularse con `coste base * 1,21`
- helper financiero común para calcular coste efectivo de producto propio según proveedor

### Changed

- `Mercancía` mantiene la entrada de coste base, pero ya calcula internamente el gasto automático con IVA cuando el proveedor así lo requiere
- `Nueva venta` guarda `unitCostSnapshot` con coste efectivo para productos `OWNED` si el proveedor tiene activado `Aplicar IVA al coste`
- la UI de `Mercancía` aclara mejor la diferencia entre coste base introducido y coste efectivo usado por el sistema

### Fixed

- primera fase de la regla contable del IVA soportado implementada sin alterar la lógica de consigna

### Pending

- revisar si conviene extender esta misma regla a más vistas contables o informes futuros
- decidir si más adelante hace falta modelar IVA distinto al 21% o escenarios fiscales más complejos

## [0.2.5] - 2026-04-07

### Changed

- `mimarca` deja de depender del `Traefik` y de `Authentik` compartidos del homelab para su exposición pública
- `docker-compose.yml` publica la app en `127.0.0.1:3010` y `cloudflared` apunta directamente a `http://localhost:3010`

### Added

- mantenimiento automático de Docker en el servidor con logs persistentes, cron semanal y alerta a `n8n` y Telegram para proteger la capacidad del host donde vive `mimarca`

### Fixed

- caída de PostgreSQL durante la migración por disco lleno en la VM, resuelta tras limpieza agresiva de caché e imágenes de Docker

### Pending

- ampliar el disco de la VM para reducir riesgo de saturación durante builds futuros
- validar una restauración completa de backup PostgreSQL y definir si Google Drive cubrirá backups, adjuntos o ambos
