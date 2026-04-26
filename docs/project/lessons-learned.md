# Lessons Learned

## Producto y UX

- el producto se entiende mucho mejor cuando la navegación sigue el flujo real del negocio
- `Mercancía` debe ser el centro operativo para entradas y altas relacionadas con stock
- `Productos` funciona mejor como consulta, edición y catálogo
- para paneles analíticos con histórico importado, el usuario necesita navegar por periodos; asumir siempre “mes actual” deja el dashboard aparentemente roto
- `Nueva venta` necesitó varias iteraciones hasta separar bien:
  - configuración de venta
  - productos seleccionados
  - confirmación previa
- en `Usuarios`, el flujo de alta se entiende mejor como acción puntual en pop-up que como formulario fijo ocupando media pantalla
- en listados internos largos, las fichas plegables ayudan a mantener control visual sin perder acceso al detalle
- la vista tablet no se resuelve bien “por arrastre” desde desktop; necesita una pasada específica de layout y navegación
- en tablet, el menú lateral funciona mejor como barra lateral real y estable que como cabecera improvisada
- si un panel de navegación desplegado obliga a recalcular el ancho útil del contenido, suele introducir más problemas de usabilidad que los que resuelve
- en dashboards con muchos chips o selectores, tablet necesita reglas explícitas para evitar solapes, recortes y scroll lateral accidental
- cuando una vista lista datos filtrados y existe un detalle aparte, volver al listado debe conservar contexto de navegación: periodo, página y filtros
- cuando una operación genera un documento natural de negocio, merece la pena enlazarlo desde todos los puntos del flujo: confirmación, histórico y detalle
- en ventas, permitir fijar un precio final objetivo resulta más natural para el negocio que obligar a pensar siempre en porcentaje de descuento
- en buscadores internos, la frase exacta se queda corta muy rápido; para negocio funciona mucho mejor tokenizar, quitar tildes y cruzar campos como nombre, proveedor, código y categoría
- si la app tiene varios buscadores, merece la pena darles un mismo motor antes que ir parcheándolos uno a uno; la coherencia de resultados se nota enseguida

## Datos

- no conviene importar directamente desde Excel a producción
- la estrategia correcta es:
  - normalizar
  - revisar
  - importar
- proveedores y códigos son la clave para enlazar bien el catálogo histórico
- taxonomía mejor extraída de forma empírica desde los datos que forzada desde la UI
- incluso con un Excel “normalizado”, parte del histórico puede apuntar a códigos que ya no existen en el catálogo final
- para cerrar bien el histórico, conviene permitir una capa de `productos legacy auxiliares`
- la secuencia correcta de importación fue:
  - taxonomía
  - proveedores
  - productos
  - ventas
- las tildes y acentos pueden romperse al mover datos entre PowerShell, SSH, bash y PostgreSQL; para cargas críticas, Prisma dentro del servidor fue mucho más fiable que SQL raw por `stdin`
- si una entrada de mercancía genera una salida económica real, conviene automatizar el gasto al registrarla para no duplicar trabajo manual
- cuando el negocio piensa en margen real de caja y no en margen fiscal puro, conviene separar `coste base` de `coste efectivo` y decidir la regla a nivel proveedor antes de tocar el dashboard
- para un MVP contable, una regla simple por proveedor puede resolver mucho: mantener el coste base visible y aplicar el IVA internamente solo en producto propio evita romper la operativa diaria

## Infraestructura

- `next dev` puede dar sensación de estabilidad falsa
- el cambio a `next build` + `next start` destapó errores reales de tipado que en desarrollo no aparecían
- el build de producción ha servido como checklist técnico útil
- cuando una pantalla mezcla `findMany` sin límite + `include` profundos + render de todas las filas, el problema no es solo el scroll: el cuello real está en consulta, serialización y DOM
- la primera solución rentable en backoffices con datasets crecientes suele ser paginación server-side y resumir el listado, no virtualización prematura
- en ajustes responsive, conviene mantener una estrategia clara por tramos:
  - desktop como base
  - tablet como adaptación específica
  - móvil como fase propia, no como consecuencia automática
- los adjuntos en `Server Actions` parecen cómodos para arrancar, pero en cuanto entran PDFs reales conviene vigilar límites de tamaño y plantear uploads dedicados antes de depender del flujo en operación diaria

## Seguridad y acceso

- el acceso remoto con Cloudflare Tunnel SSH evita abrir el puerto 22 al exterior
- para operación real y continuidad del proyecto, esta decisión fue mejor que depender de red local

## Cómo repetir un proyecto similar

1. montar infraestructura mínima primero
2. dejar acceso remoto estable desde el principio
3. construir MVP operativo antes de dashboard avanzado
4. mover cuanto antes a modo producción real
5. preparar capa de staging para cualquier importación histórica
6. documentar decisiones y deuda técnica en GitHub durante el proceso, no al final
7. planificar la importación histórica por dependencias reales, no por comodidad técnica
8. revisar pronto las pantallas con listados largos y paginar antes de que el dataset real llegue a producción
9. validar cada cambio importante al menos en desktop y tablet antes de darlo por cerrado
