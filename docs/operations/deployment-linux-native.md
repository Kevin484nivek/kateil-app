# Deployment On Linux Native Host

## Objetivo

Desplegar la aplicación en el host Ubuntu 24.04 Linux nativo manteniéndola desacoplada del `Traefik` y de `Authentik` compartidos del homelab.

## Decisiones

- dominio inicial: `mimarca.kevbeaoca.uk`
- dominio configurable vía `APP_DOMAIN`
- publicación local del contenedor en `127.0.0.1:3010`
- exposición pública por `Cloudflare Tunnel` directo a `http://localhost:3010`
- ruta recomendada del proyecto: `/home/kevin/docker-services/stock-sales-app`
- GitHub como fuente principal de código y documentación

## Variables clave

- `APP_DOMAIN`: dominio público actual de la app
- `APP_URL`: URL pública base de la aplicación
- `DATABASE_URL`: conexión interna a PostgreSQL

## Compose

El contenedor `app`:

- publica `127.0.0.1:3010:3000`
- mantiene `3000` como puerto interno de Next.js
- se conecta solo a la red interna del proyecto
- no publica labels de `Traefik`

## Pasos recomendados

1. Clonar el repositorio en `/home/kevin/docker-services/stock-sales-app`.
2. Crear el archivo `.env` en el servidor sin versionarlo.
3. Configurar `APP_DOMAIN=mimarca.kevbeaoca.uk`.
4. Verificar en `/etc/cloudflared/config.yml` que `mimarca.kevbeaoca.uk` apunta a `http://localhost:3010`.
5. Levantar el stack con `docker compose up -d`.
6. Comprobar con `curl http://127.0.0.1:3010` que la app responde y redirige a `/login`.

## Estado actual del despliegue

- la app ya corre en modo producción real
- el contenedor construye con `next build`
- el arranque se hace con `next start`
- el build de producción ya se ha usado para limpiar errores reales de tipado
- `mimarca` ya no depende de `Traefik` como puerta de entrada
- `mimarca` ya no queda detrás de `Authentik`
- `cloudflared` publica la app directamente hacia `localhost:3010`

## Cambio futuro de dominio

Para migrar a un dominio propio futuro:

1. actualizar DNS hacia el servidor o proxy actual
2. cambiar `APP_DOMAIN`
3. ajustar `APP_URL`
4. recrear el servicio

No debería ser necesario cambiar la arquitectura del proyecto.

## Deuda técnica de secretos

- centralizar inventario de secretos y credenciales operativas en un documento seguro fuera del repositorio
- registrar qué contraseñas son temporales de arranque y cuáles deben rotarse antes de pasar a uso real
- sustituir credenciales placeholder o débiles en:
  - `AUTH_SECRET`
  - `ADMIN_PASSWORD`
  - `POSTGRES_PASSWORD`
  - credenciales de Google Drive
- mantener `.env` fuera de Git y no reutilizar contraseñas simples en producción

## Deuda técnica restante del despliegue

- mantener documentadas las validaciones necesarias cada vez que aparezcan nuevos errores de build de producción
- revisar periódicamente que la documentación de acceso remoto y despliegue siga alineada con el runtime real
- seguir usando limpieza programada de Docker con logs y alerta a `n8n` y Telegram
