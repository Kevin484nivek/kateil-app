# MVP Roadmap

## Fase 1. Base técnica

Estado: `hecha`

- inicializar Next.js con App Router y TypeScript
- configurar Prisma y PostgreSQL
- crear esquema inicial y seed
- montar autenticación interna
- preparar layout privado con sidebar
- desplegar en host Ubuntu 24.04 Linux nativo
- habilitar acceso remoto por Cloudflare SSH
- pasar de `next dev` a `next build + next start`

## Fase 2. Core business

Estado: `muy avanzada`

- productos y categorías
- proveedores
- clientes
- ventas y líneas de venta
- entradas de mercancía
- movimientos de stock y ajustes
- usuarios internos con gestión básica de roles

## Fase 3. Dashboard y pulido

Estado: `hecha`

- KPIs del día y del periodo
- analítica por categoría y proveedor
- tops de productos y clientes
- dashboard dividido en vistas
- selector mensual y anual en dashboard
- paginación de listados masivos críticos
- refinado visual y mejoras tablet
- primera fase responsive para tablet cerrada
- precio final objetivo en `Nueva venta` con cálculo automático del descuento global
- albarán imprimible para entradas reales de mercancía
- soporte base de gastos mensuales con recurrencia simple y generación automática desde entradas de mercancía
- motor común de búsqueda inteligente aplicado en ventas, mercancía, histórico, productos y proveedores
- filtros vivos en listados principales de catálogo y proveedores

Pendiente dentro de esta fase:

- pulido visual adicional del dashboard
- pulido final de iconografía y microinteracciones
- adaptación específica a móvil
- revisión de rendimiento residual en pantallas secundarias
- integrar gastos del periodo y resultado neto en dashboard
- revisar traducciones pendientes al español en estados y etiquetas
- revisar el flujo de adjuntos grandes en `Mercancía` antes de dar por cerrada la gestión documental
- extender el buscador inteligente a listados secundarios que sigan usando filtros simples
- incorporar devoluciones/cambios dentro de `Nueva venta`, con referencia a ticket original y saldo neto

## Fase 4. Importación histórica

Estado: `hecha`

- cargar proveedores reales con códigos
- importar catálogo histórico revisado
- importar ventas históricas revisadas
- generar productos legacy auxiliares cuando el histórico apuntaba a códigos ya no presentes en catálogo
- dejar dashboard listo para validación con datos reales

## Fase 5. Operación real

Estado: `en curso`

- QA funcional con datos reales ya cargados, delegado en uso real por Nieves y resuelto por iteraciones
- documentación operativa completa
- restauración documentada
- refinado de permisos
- backlog nice to have
- seguimiento de mejoras UX y rendimiento tras uso real
- fase responsive móvil queda pospuesta frente a estabilidad operativa, finanzas, backups y Google Drive
- consolidar `Gastos` como módulo operativo
- primera versión de la regla de IVA sobre mercancía entrante aplicada por proveedor
- completar la gestión documental de mercancía con albaranes y futura integración a Google Drive
- cerrar Google Drive como almacenamiento configurable para backups, adjuntos de mercancía y adjuntos de proveedores
- cerrar flujo de devoluciones/cambios operativo en `Nueva venta` sin módulo adicional
- integrar gastos, ingresos y resultado neto en dashboard
- revisar el caso de consigna con importe fijo de liquidación al proveedor
- preparar proceso seguro para corregir ventas históricas de enero, febrero y marzo de 2026

Pendiente dentro de esta fase:

- mejorar el login cuando llegue el diseño final de marca
- revisar el comportamiento real de PDFs grandes en adjuntos de `Mercancía`
- decidir si la regla `Aplicar IVA al coste` necesita evolucionar a escenarios fiscales más complejos
- validar si los backups actuales se están ejecutando realmente, dónde quedan guardados y cómo se restaura
- implementar validación real de Google Drive: OAuth ya conectado, carpeta raíz validada, subcarpetas creadas si faltan y estados actualizados
- subir adjuntos documentales a Google Drive en vez de dejarlos solo como metadata local
- subir backups PostgreSQL a Google Drive o dejar preparada la salida remota configurable
- mejorar selectores de mes/año
- crear vista por defecto de dashboard para ventas del día y, si procede, semana laboral actual
- ampliar base documental del asistente y activar proveedor IA de producción
- replantear la columna `Tienda` en detalle/histórico de ventas para que muestre margen o comisión real según el tipo de producto, evitando que en producto propio parezca beneficio cuando actualmente representa importe de venta

## Fase 6. Ayuda, datos históricos y automatización

Estado: `en curso`

- manual de uso para operación diaria
- chatbot interno base ya integrado en UI con arquitectura multi-provider (`openai`, `groq`, `anthropic`)
- pendiente conectar proveedor IA de producción y ampliar conocimiento operativo
- revisión controlada de ventas históricas con backup previo y trazabilidad
- automatizaciones documentales sobre Google Drive
- mejoras NTH de IA, etiquetas y permisos finos
