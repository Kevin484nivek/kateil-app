# Current Project Status

## Snapshot

Estado a fecha de `2026-04-23`.

El proyecto ya no está en fase de arranque. La base técnica, el despliegue, la shell privada y el MVP funcional principal están resueltos. La carga principal de datos reales ya se ha ejecutado, el dashboard ya trabaja con periodos navegables, la vista tablet queda ya operativa, `mimarca` ya está desacoplada del `Traefik` y `Authentik` del homelab, y la siguiente fase importante es validar operación real y abordar la adaptación móvil.

## Qué está conseguido

### Infraestructura

- host Ubuntu 24.04 Linux nativo operativo
- despliegue con Docker
- PostgreSQL funcionando en contenedor dedicado
- acceso público por dominio
- exposición pública directa por `Cloudflare Tunnel -> localhost:3010`
- acceso SSH remoto desde cualquier red con Cloudflare Access + Tunnel
- aplicación corriendo en modo producción real con `next build` + `next start`
- stack desacoplada del `Traefik` y `Authentik` compartidos del homelab

### App funcional

- login interno
- layout privado con menú lateral
- dashboard dividido en vistas
- dashboard con selector mensual y anual
- productos
- mercancía
- movimientos
- proveedores
- clientes
- ventas
- devoluciones/cambios integrados dentro de `Nueva venta`
- histórico de ventas
- histórico de entradas/pedidos
- usuarios internos
- usuarios con alta vía pop-up y listado plegable
- asistente de ayuda integrado en UI privada con fallback local y capa multi-provider IA
- proveedores reales cargados
- catálogo histórico cargado
- ventas históricas cargadas
- rendimiento inicial saneado en `Productos` e `Histórico de ventas`
- primera fase responsive de tablet cerrada
- albarán imprimible para entradas reales de mercancía
- gastos mensuales con soporte de recurrencia simple
- gasto automático de mercancía al registrar entradas reales
- nueva venta con precio final objetivo y descuento equivalente
- motor común de búsqueda inteligente en los flujos principales
- histórico de ventas con buscador por operación, clienta, producto, código y proveedor
- filtros vivos en productos y proveedores
- IVA al coste configurable por proveedor para producto propio (`OWNED`)

### Catálogo

- taxonomía final cargada en sistema desde análisis del Excel
- categorías activas:
  - `Ropa`
  - `Accesorios`
  - `Bolsos`
  - `Hogar`
  - `Joyería`
- subtipos ligados a categoría
- temporadas ligadas a categoría

### Operativa clave resuelta

- una venta puede incluir varias líneas
- una entrada puede incluir varios productos del mismo proveedor
- creación de producto nuevo dentro de mercancía
- confirmación de venta previa al registro
- notificaciones de guardado
- stock y movimientos trazados desde backend
- importación histórica en tres pasos:
  - proveedores
  - productos
  - ventas
- navegación temporal de dashboard por año y por mes
- paginación real en listados masivos
- navegación documental de mercancía con acceso a albarán desde detalle, histórico y confirmación
- `Nueva venta` permite fijar precio final deseado y recalcula el descuento global equivalente
- `Nueva venta` permite modo `devolución-cambio` sobre ticket original, con total neto y control de cantidades devolvibles
- `Mercancía` crea automáticamente gasto mensual de tipo `MERCHANDISE` al registrar una entrada real
- los buscadores principales ya comparten una misma lógica por tokens, tildes y campos cruzados
- `Histórico de ventas` ya permite localizar operaciones sin depender solo de mes/año
- el coste introducido en `Mercancía` sigue siendo coste base, pero el sistema aplica `x1,21` al coste efectivo de `OWNED` cuando el proveedor tiene marcado `Aplicar IVA al coste`
- asistente preparado para cambiar proveedor IA por configuración (`openai`, `groq`, `anthropic`) y limitar contexto por rol

### Datos históricos cargados

- `36` proveedores importados
- `2380` productos principales importados
- `39` productos legacy auxiliares creados para completar histórico
- `1028` ventas importadas
- `1856` líneas de venta importadas

## Qué falta por cerrar

### Fase inmediata

- QA funcional delegado en Nieves mediante uso real; los errores se registrarán y se resolverán por iteraciones
- detectar y corregir cualquier ajuste residual de presentación o mapeo
- adaptar la experiencia a móvil queda con prioridad baja frente a operación, finanzas, Google Drive y backups
- decidir si algunos productos legacy deben fusionarse o dejarse como históricos auxiliares
- seguir documentando en GitHub cada bloque importante ya cerrado
- en `Dashboard`, aclarar el bloque de top productos para que muestre unidades vendidas y total acumulado, evitando interpretar el total como precio unitario
- en `Productos`, permitir edición manual de stock
- impedir guardados accidentales con `Intro` en formularios editables; el guardado debe pasar por botón explícito
- corregir `Nueva venta` para que el PVP editable permita vaciar el campo y escribir decimales con `,` y `.`
- añadir descuento global en `Nueva venta`, incluyendo la opción de fijar precio final y calcular el descuento equivalente
- traducir etiquetas y estados aún visibles en inglés como `OWNED`, `CONSIGNMENT`, `CASH`, `CARD` o `BIZUM`
- convertir selectores largos en buscadores vivos cuando el volumen de opciones lo justifique, empezando por proveedor en `Mercancía`
- revisar si la primera versión de `Aplicar IVA al coste` cubre bien todos los casos reales de compra o si hará falta un modelo fiscal más fino
- investigar el error al registrar mercancía tras crear la categoría `Ocio` y el subtipo `Vino`
- pulir la pantalla de `Gastos` para que el selector de mes muestre nombres de mes en lugar de números
- mantener pendiente la integración de adjuntos con Google Drive
- revisar el flujo de adjuntos pesados en `Mercancía`; con PDFs grandes sigue habiendo que validar el comportamiento real aunque el límite de Server Actions ya se ha ampliado
- integrar los gastos del periodo dentro del dashboard para mostrar resultado neto
- extender el buscador inteligente a cualquier listado secundario que siga usando lógica simple o búsqueda solo por un campo
- cerrar la integración de Google Drive cuando se decida si debe cubrir:
  - adjuntos documentales de `Mercancía`
  - backups PostgreSQL
- validar una restauración real de backup antes de dar por cerrada la continuidad operativa
- cerrar la integración real de Google Drive: validar carpeta raíz, crear subcarpetas faltantes y subir backups/adjuntos
- preparar un manual de uso o chatbot de ayuda para resolver dudas operativas frecuentes
- añadir una vista por defecto del dashboard centrada en ventas del día; si queda demasiado vacía, complementar con semana actual de lunes a viernes
- mejorar la experiencia visual de selectores de mes y año
- revisar el caso de proveedor que deja mercancía en tienda, fija un coste de liquidación y cobra ese importe cuando se vende, independientemente del PVP
- preparar ajuste controlado de ventas de enero, febrero y marzo de 2026 para corregir PVP, coste, descuento aplicado y cliente en operaciones históricas con descuento
- revisar la columna `Tienda` en el detalle/histórico de ventas: ahora es útil para consigna como comisión de tienda, pero en producto propio resulta redundante; debe renombrarse o sustituirse por una métrica más clara tipo `Margen / comisión tienda`, calculando `venta - coste efectivo` en producto propio y comisión en consigna

### Fase siguiente

- QA funcional punta a punta con datos reales
- documentación de operación diaria
- endurecer permisos por rol más allá de usuarios
- mejorar iconografía final del menú lateral
- cerrar adaptación móvil sin degradar escritorio ni tablet
- revisar el aspecto final del login con el diseño definitivo de marca
- reforzar la gestión documental de mercancía con albaranes y adjuntos mejor conectados
- convertir `Gastos e ingresos` en fuente financiera del dashboard con resultado neto consolidado
- validar si Google Drive debe cubrir simultáneamente backups PostgreSQL, adjuntos de mercancía y adjuntos de proveedores

## Deuda técnica abierta

### Alta prioridad

- revisar el sistema con datos reales ya cargados para detectar ajustes funcionales
- revisar tipados y enlaces dinámicos cada vez que se añadan nuevas rutas para evitar roturas en build de producción
- seguir vigilando rendimiento en otras pantallas que aún carguen demasiado contenido
- consolidar un patrón responsive estable para cambios futuros en desktop, tablet y móvil
- resolver el bug que impide guardar algunas entradas de mercancía tras crear nuevas combinaciones de categoría/subtipo
- vigilar si el modelo actual de `Aplicar IVA al coste` necesita evolucionar más adelante a porcentajes variables o tratamiento fiscal más detallado
- revisar el flujo de subida de adjuntos grandes en `Mercancía`; aunque el límite de `Server Actions` se ha subido a `10mb`, hace falta validar el comportamiento con PDFs reales de varios MB y decidir si conviene mover adjuntos a un upload dedicado
- homogeneizar la edición de formularios para que `Intro` no dispare guardados no deseados
- revisar todos los puntos donde todavía se mezclan etiquetas técnicas o términos en inglés con texto de usuario final
- decidir si merece la pena mover la búsqueda inteligente al backend de más módulos para mantener consistencia y rendimiento a medida que crezca el dataset
- vigilar capacidad de disco del host; durante la etapa pre-cutover PostgreSQL quedó temporalmente fuera por `No space left on device` (incidencia legacy ya mitigada)
- validar si actualmente los backups se ejecutan de forma programada y dónde se guardan antes de considerarlos operativos
- diseñar una estrategia de corrección de ventas históricas con trazabilidad y backup previo, evitando ediciones directas sin auditoría

### Media prioridad

- limpiar warnings de CSS que aún puedan aparecer en builds futuros
- revisar si conviene añadir `brand` o equivalente como entidad/campo formal ahora que el histórico ya está dentro
- definir mejor la matriz futura de permisos por rol
- decidir si el código de proveedor debe pasar a ser campo formal en `Supplier`
- valorar edición de producto bajo demanda si el listado vuelve a crecer bastante
- integrar `Gastos` con el dashboard para obtener gasto del periodo y resultado neto
- revisar si todos los selectores largos deberían compartir un patrón común de buscador vivo
- evaluar si la lógica de descuento global en ventas debe quedar a nivel ticket, línea o ambas
- revisar el top de productos del dashboard para evitar ambigüedad entre `precio unitario` y `ventas acumuladas`
- revisar si hace falta un nuevo tipo de liquidación para consigna con importe fijo pactado, distinto de consigna por porcentaje
- aclarar las métricas de detalle de venta (`Importe tienda`, `Tienda`, `Beneficio calculado`) para que no mezclen importe cobrado, margen real y comisión

### Baja prioridad

- recuperación de contraseña por email
- mejores iconos visuales del sidebar
- refinado visual continuo de dashboard, sidebar y usuarios
- adaptación específica a móvil, pospuesta tras cerrar tablet
- depuración eventual de productos legacy creados solo para cerrar histórico
- mejorar el aspecto final del login cuando esté el diseño definitivo
- hacer más sólida la gestión de adjuntos en mercancía y proveedores antes de conectarla a Google Drive
- afinar el diseño final del albarán de mercancía si aparecen necesidades específicas de proveedor o formato de impresión
- validar y documentar la política final de backups, restauración y retención fuera del servidor
- mejorar visualmente selectores de mes/año en dashboard y finanzas si se confirma el patrón final

## Nice to have

- reset de contraseña desde interfaz con UX más clara
- comparativas mensuales en dashboard
- comparativas anuales y variación interperiodos
- clientas recurrentes / ticket medio / rankings avanzados
- métricas por proveedor más profundas
- edición más avanzada de usuarios y auditoría de cambios
- roles y permisos más finos por módulo y acción
- automatizar la ingesta del catálogo con fotos e IA
- explorar una solución hardware + software para imprimir o escribir etiquetas y añadir productos a cesta
- chatbot o asistente de ayuda interna basado en manual operativo de MiMarca

## Regla operativa a partir de ahora

Todo avance relevante debe quedar documentado en GitHub cada pocas iteraciones importantes:

- estado del sistema
- decisiones tomadas
- deuda técnica
- fases pendientes
- lecciones aprendidas
- cambios de infraestructura

La documentación debe mantenerse viva, no solo al final del proyecto.
