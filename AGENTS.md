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

## 3. Skills operativas

Las skills viven en `Projects/_skills/skills/` y el catálogo canónico está en `Projects/_skills/INDEX.md`.

Regla para agentes: si la intención del usuario coincide con una skill, lee y aplica su `SKILL.md` antes de actuar. `AGENTS.md` mantiene contexto y reglas específicas; los workflows largos viven en skills.

| Intención / evento | Skill |
|---|---|
| Fin de sesión | `close-session` |
| Actualizar docs/estado/backlog/decisiones | `update-project-state` |
| Commit + push GitHub | `publish-changes` |
| Deploy al server | No aplica todavía; no hay producción activa |
| Sincronizar docs + GitHub + Notion + server | `workspace-sync` |
| Drift en server | `reconcile-server` |
| Revisión pre-commit/pre-deploy | `code-review` |

Al cerrar un hito, evalúa checkpoint: docs necesarias, commit/push y sync externo si cambió Notion/server/inventario. Este repo no tiene producción activa ni `.deploy/config.json`; no usar `deploy-to-server` hasta preparar server, dominio, healthchecks y backup. Si el cambio es pequeño o incompleto, acumular hasta el siguiente checkpoint.

---

## 4. Protocolo de trabajo

1. **Antes de implementar**: confirmar cambios de alcance, deploy, secretos o acciones destructivas. Para fixes pequeños y tareas ya acordadas, avanzar.
2. `git status` antes de tocar nada.
3. **Validación**: `npm install && npm run build` antes de cambios grandes. Si requiere DB, usar `.env.example` o `.env.supabase.dev.example` como referencia (sin commitear secretos).
4. **Commits pequeños** con prefijo: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `ops:`.
5. **No tocar lo que está fuera del alcance pedido**.

---

## 5. Mantenimiento de documentación

Usa `update-project-state` para mantener la documentación viva. `docs/01-current-status.md` debe ser un dashboard conciso, no un diario completo.

### Documentos calientes vs fríos

- **Calientes** (`docs/01-current-status.md`, `docs/03-backlog.md`): se leen al entrar, escaneables en <2 min. Solo estado vivo: qué pasa ahora, qué está abierto, próximo paso, bloqueos. Cero historial, cero ítems cerrados.
- **Fríos** (`docs/09-changelog.md`, `docs/05-decisions.md`): append-only, on-demand. Aquí va lo cerrado y el histórico.

Reglas anti-drift (las aplica `update-project-state`; protocolo completo ahí):
1. **Un dato -> un doc.** Métricas/estados viven en UN sitio; los demás enlazan, no transcriben.
2. **Lo cerrado sale del caliente.** Ítem hecho -> se mueve a `docs/09-changelog.md` con fecha, no se tacha en sitio.
3. **Verificar contra git/CI**, nunca copiar estado de un doc hermano.
4. **Compactar en el checkpoint**, no cuando ya duele.

### Actualiza documentación tras cualquiera de estos eventos:

- Commit con cambio de comportamiento (feat/fix/refactor relevante) o cambio operativo.
- Decisión técnica relevante.
- Item significativo del backlog completado.
- Bloqueo o riesgo nuevo detectado.
- Despliegue ejecutado o roto, si aplica.
- **Cierre de sesión** (backstop garantizado).

### Actualiza adicionalmente según el evento:

| Evento | Doc |
|---|---|
| Decisión técnica con fecha y razón | `docs/05-decisions.md` |
| Item completado | mover a `docs/09-changelog.md` con fecha y quitar de `docs/03-backlog.md` |
| Nueva tarea detectada | añadir a `docs/03-backlog.md` |
| Cambio de roadmap | `docs/02-roadmap.md` |
| Cambio de arquitectura | `docs/04-architecture.md` |
| Cambio de setup/dev | `docs/06-development.md` |
| Cambio operativo / despliegue | `docs/07-operations.md` |
| Nuevo enlace externo relevante | `docs/08-links.md` |

### NO actualices tras:
Lecturas, edits sin commit, commits triviales, cada turno de conversación.

### Regla práctica
> **Si la próxima IA que entre necesita saberlo para no romper algo, actualízalo. Si no, no.**

---

## 6. Cierre de sesión

1. Update final de `docs/01-current-status.md` si aplica.
2. Commit final con mensaje claro.
3. Si cambió el "Siguiente paso", actualizar ficha Notion.

---

## 7. Conexión con el workspace

- **Server**: no desplegado aún. Cuando se despliegue, será en `~/docker-services/kateil-app`.
- **Notion DB**: `Base de datos de proyectos`. Ficha: "Kateil App".
- **Inventario homelab**: `server-overview`.
- **Plantilla origen**: [project-template-kevbeaoca](https://github.com/Kevin484nivek/project-template-kevbeaoca).
- **Skills disponibles**: catálogo en [agent-skills-kevbeaoca](https://github.com/Kevin484nivek/agent-skills-kevbeaoca) o `Projects/_skills/INDEX.md`. Auto-loaded en `~/.codex/skills/` y `~/.claude/skills/` (junctions). Invoca con `/skill-name` (Claude Code) o por referencia (Codex).

---

## 8. Específico de este proyecto

- **Multi-tenant es el norte**: cualquier cambio nuevo se clasifica como `core` o `module` cuando afecte a producto. Mantener compatibilidad con el objetivo multi-tenant.
- **Legacy intacto**: `C:\Users\kevin\Documents\Playground\repos\kateil-app` no se toca.
- **Scripts heredados de MiMarca**: `scripts/*.ps1` y `scripts/*.py`. Usan `$PSScriptRoot\..` para rutas. No introducir rutas absolutas.
- **Warning ESLint conocido**: `src/components/ui/expense-form-panel.tsx` tiene aviso de React hooks deps. No bloquea build.
