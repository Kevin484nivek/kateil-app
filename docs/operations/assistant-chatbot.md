# Asistente IA de ayuda (base multi-provider)

## Estado

Base implementada a fecha `2026-04-23`:

- widget `Ayuda IA` en zona privada
- endpoint interno `POST /api/assistant/chat`
- arquitectura de proveedor desacoplada:
  - `openai`
  - `groq`
  - `anthropic`
  - `none` (fallback local sin IA externa)
- control por rol para delimitar dominios de datos que puede usar el asistente
- conocimiento base cargado desde documentación Markdown

## Configuración

Variables:

- `ASSISTANT_AI_PROVIDER` (`none`, `openai`, `groq`, `anthropic`)
- `ASSISTANT_AI_MODEL`
- `ASSISTANT_AI_API_KEY`
- `ASSISTANT_AI_BASE_URL` (opcional)
- `ASSISTANT_AI_TEMPERATURE`
- `ASSISTANT_AI_MAX_OUTPUT_TOKENS`
- `ASSISTANT_AI_TIMEOUT_MS`

## Seguridad y alcance por rol

El asistente:

- requiere sesión activa
- construye contexto con dominios permitidos por rol
- no ejecuta acciones de escritura
- responde solo con datos del contexto y la base de conocimiento

Nota: el sistema queda preparado para endurecer permisos por módulo en futuras iteraciones sin cambiar la API del asistente.

## Ruta técnica

- UI: `src/components/ui/help-assistant.tsx`
- API: `src/app/api/assistant/chat/route.ts`
- Servicio: `src/lib/assistant/service.ts`
- Proveedores: `src/lib/assistant/providers.ts`
- Contexto + control de rol: `src/lib/assistant/context.ts`, `src/lib/assistant/permissions.ts`

## Siguiente fase recomendada

1. Registrar telemetría de preguntas sin respuesta útil.
2. Añadir historial por usuario.
3. Introducir modo RAG con embeddings si crece la base documental.
4. Definir matriz formal de permisos por rol/módulo para reutilizar en toda la app.

