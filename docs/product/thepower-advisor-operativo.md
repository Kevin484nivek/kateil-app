# ThePower Advisor Operativo (Notion + GPT)

## Objetivo

Convertir el contenido de `MBA` y `ThePowerSales` en un sistema operativo de decisiones:

- decidir siguiente paso por proyecto
- detectar riesgos y lagunas antes de ejecutar
- recomendar acciones comerciales concretas
- transformar teoría en criterio aplicado

## Arquitectura recomendada en Notion

Crear 4 bases de datos conectadas:

1. `Knowledge Units`
- propósito: unidad mínima de conocimiento (una lección, un framework, una táctica, una reflexión)
- propiedades:
  - `Title` (title)
  - `Domain` (select): `MBA`, `Sales`
  - `Topic` (multi-select): `Estrategia`, `Pricing`, `Pipeline`, `Objections`, etc.
  - `Source Type` (select): `Video`, `PDF`, `Spreadsheet`, `Note`
  - `Source Path` (text)
  - `Summary` (text)
  - `Core Insight` (text)
  - `Decision Rule` (text)
  - `Risks / Anti-patterns` (text)
  - `When to Use` (text)
  - `Confidence` (number 1-5)
  - `Status` (select): `Inbox`, `Transcribed`, `Synthesized`, `Published`

2. `Frameworks`
- propósito: marcos reutilizables para análisis
- propiedades:
  - `Name` (title)
  - `Category` (select): `Strategy`, `Sales`, `Operations`, `Finance`
  - `Trigger Question` (text)
  - `Steps` (text)
  - `Common Failures` (text)
  - `Linked Knowledge` (relation -> `Knowledge Units`)

3. `Decision OS`
- propósito: usar el conocimiento para decidir en proyectos reales
- propiedades:
  - `Project / Situation` (title)
  - `Decision Needed` (text)
  - `Missing Data` (text)
  - `Risks` (text)
  - `Recommended Next Step` (text)
  - `Why` (text)
  - `Linked Knowledge` (relation -> `Knowledge Units`)
  - `Linked Frameworks` (relation -> `Frameworks`)
  - `Execution Status` (select): `To do`, `Doing`, `Done`

4. `Sales Plays`
- propósito: ejecución comercial concreta
- propiedades:
  - `Play Name` (title)
  - `Use Case` (text)
  - `Qualification Criteria` (text)
  - `Talk Track` (text)
  - `Next Micro-Commitment` (text)
  - `KPIs` (text)
  - `Linked Knowledge` (relation -> `Knowledge Units`)

## Flujo operativo semanal

1. `Ingesta`
- ejecutar script de backlog para detectar nuevo material
- importar/actualizar items en `Knowledge Units` con estado `Inbox`

2. `Transcripción`
- priorizar videos de módulos activos
- generar transcript bruto

3. `Síntesis`
- aplicar plantilla de lección (ver `docs/product/templates/thepower-lesson-template.md`)
- extraer decisión aplicable, riesgo y siguiente paso
- pasar estado a `Synthesized`

4. `Publicación`
- mover los mejores insights a `Frameworks` o `Sales Plays`
- enlazar decisiones reales en `Decision OS`
- pasar estado a `Published`

## Instrucciones para tu GPT personalizado (advisor)

Pega este bloque como base en el GPT:

```text
Eres mi advisor operativo. Tu trabajo no es explicar teoría, sino ayudarme a decidir y ejecutar con criterio.

Contexto:
- Usa mi base de conocimiento en Notion (MBA + Sales) como fuente principal.
- Prioriza marcos y aprendizajes internos antes que respuestas genéricas.

Siempre responde en este formato:
1) Qué haría ahora (acción concreta en 24-72h)
2) Qué falta para decidir mejor (datos/validaciones)
3) Riesgos y señales tempranas (leading indicators)
4) Recomendación operativa (paso a paso corto)
5) Cómo venderlo/mejorar ejecución comercial (si aplica)

Reglas:
- Si falta contexto, no bloquees: propone hipótesis explícitas y plan de validación.
- Evita teoría abstracta.
- Da acciones accionables, medibles y con prioridad.
- Conecta cada recomendación con el conocimiento/fuente usada.
```

## Arranque recomendado (esta semana)

1. Crear las 4 bases de datos en Notion con las propiedades arriba.
2. Ejecutar el backlog automático y cargar `Knowledge Units`.
3. Procesar solo 10 piezas prioritarias (no todo el curso).
4. Validar el advisor con 3 casos reales de proyecto/ventas.

