# AGENTS.md — kateil-app

> Manual operativo para cualquier IA (Claude Code, Codex, otros) que trabaje en este repo.
> **Léelo entero al entrar.** Es corto a propósito; el resto se lee on-demand.

## Contexto

Kateil App — baseline técnico para evolucionar desde MiMarca hacia una plataforma modular multi-tenant para retail físico.

Stack: `nextjs-app` (Next.js + Prisma + Postgres + TypeScript). No desplegado aún; entorno de desarrollo local.

---

## 1. Lectura obligatoria al entrar

1. **Este archivo** (`AGENTS.md`).
2. **`docs/01-current-status.md`** — estado vivo, fuente única de verdad.

Documento canónico adicional para entender la visión multi-tenant: `docs/kateil/source-of-truth-v1.md`.

## 2. Lectura on-demand (solo si la tarea lo requiere)

| Tarea | Leer también |
|---|---|
| Feature nueva | `docs/04-architecture.md`, `docs/03-backlog.md`, `docs/kateil/source-of-truth-v1.md` |
| Fix de bug | (nada extra) |
| Decisión histórica | `docs/05-decisions.md` |
| Setup local / dev | `docs/06-development.md` |
| Scope / visión | `docs/00-project-brief.md`, `docs/02-roadmap.md` |
| Buscar enlace externo | `docs/08-links.md` |

**No leas todo "por si acaso"**. Cada doc innecesario gasta contexto y tokens.

---

## 3. Protocolo de trabajo

1. **Antes de implementar**: confirmar siguiente paso con el usuario.
2. `git status` antes de tocar nada.
3. **Validación**: `npm install && npm run build` antes de cambios grandes. Si requiere DB, usar `.env.example` o `.env.supabase.dev.example` como referencia (sin commitear secretos).
4. **Commits pequeños** con prefijo: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `ops:`.
5. **No tocar lo que está fuera del alcance pedido**.

---

## 4. Mantenimiento de documentación

### Actualiza `docs/01-current-status.md` tras cualquiera de estos eventos:

- Commit con cambio de comportamiento.
- Decisión técnica relevante.
- Item significativo del backlog completado.
- Bloqueo o riesgo nuevo.
- **Cierre de sesión** (backstop).

### Disparadores adicionales:

| Evento | Doc |
|---|---|
| Decisión técnica con fecha y razón | `docs/05-decisions.md` |
| Item completado | quitar de `docs/03-backlog.md` |
| Nueva tarea | añadir a `docs/03-backlog.md` |
| Cambio de roadmap | `docs/02-roadmap.md` |
| Cambio de arquitectura | `docs/04-architecture.md` |
| Cambio de setup/dev | `docs/06-development.md` |
| Nuevo enlace externo | `docs/08-links.md` |

### Regla práctica
> **Si la próxima IA que entre necesita saberlo para no romper algo, actualiza. Si no, no.**

---

## 5. Cierre de sesión

1. Update final de `docs/01-current-status.md` si aplica.
2. Commit final con mensaje claro.
3. Si cambió el "Siguiente paso", actualizar ficha Notion.

---

## 6. Conexión con el workspace

- **Server**: no desplegado aún. Cuando se despliegue, será en `~/docker-services/kateil-app`.
- **Notion DB**: `Base de datos de proyectos`. Ficha: "Kateil App".
- **Inventario homelab**: `server-overview`.
- **Plantilla origen**: [project-template-kevbeaoca](https://github.com/Kevin484nivek/project-template-kevbeaoca).

---

## 7. Específico de este proyecto

- **Multi-tenant es el norte**: cualquier cambio nuevo se clasifica como `core` o `module` cuando afecte a producto. Mantener compatibilidad con el objetivo multi-tenant.
- **Legacy intacto**: `C:\Users\kevin\Documents\Playground\repos\kateil-app` no se toca.
- **Scripts heredados de MiMarca**: `scripts/*.ps1` y `scripts/*.py`. Usan `$PSScriptRoot\..` para rutas. No introducir rutas absolutas.
- **Warning ESLint conocido**: `src/components/ui/expense-form-panel.tsx` tiene aviso de React hooks deps. No bloquea build.
