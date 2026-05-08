# AGENTS.md

## Proyecto

Kateil App es el baseline tecnico para evolucionar desde MiMarca hacia una plataforma modular multi-tenant para retail fisico.

## Antes de trabajar

1. Leer `README.md`.
2. Leer `docs/00-project-brief.md`.
3. Leer `docs/01-current-status.md`.
4. Leer `docs/kateil/source-of-truth-v1.md`.
5. Revisar `docs/03-backlog.md`.
6. Comprobar `git status`.

## Fuentes de verdad

- GitHub/repo: codigo, documentacion tecnica, decisiones, arquitectura y estado versionado.
- Notion: resumen ejecutivo, decisiones de negocio, prioridad y siguiente paso.
- Local: `.env`, pruebas, secretos y material temporal.

## Reglas de trabajo

- No subir `.env`, secretos, tokens ni credenciales.
- Cualquier cambio nuevo debe clasificarse como `core` o `module` cuando afecte a producto.
- Mantener compatibilidad con el objetivo multi-tenant.
- Actualizar `docs/05-decisions.md` cuando se cierre una decision tecnica o de producto relevante.
- Actualizar `docs/01-current-status.md` y `docs/03-backlog.md` si cambia el estado real.
- No tocar la copia legacy en `C:\Users\kevin\Documents\Playground\repos\kateil-app` salvo consulta historica.

## Validacion recomendada

```powershell
npm install
npm run build
git status
```

Si el build requiere variables reales, usar `.env.example` y `.env.supabase.dev.example` como referencia, sin commitear secretos.

