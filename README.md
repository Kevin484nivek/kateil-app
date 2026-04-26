# Kateil App

Kateil App es el baseline técnico para evolucionar desde MiMarca hacia una plataforma modular multi-tenant.

## Objetivo

- Mantener compatibilidad con el piloto actual (MiMarca)
- Introducir core multi-tenant (`organization`, membresías, módulos)
- Habilitar paquetización por cliente sin forks
- Soportar personalización de marca por tenant

## Stack

- Next.js
- Prisma
- PostgreSQL (Supabase)
- Vercel

## Estado del repositorio

Este repositorio nace como plantilla operativa basada en MiMarca:

- estructura funcional completa (ventas, stock, catálogo, proveedores, clientes, finanzas)
- documentación de transición en `docs/kateil/`
- branding base ajustado a Kateil en shell principal

## Variables de entorno

Usa estos archivos como referencia:

- `.env.example` para local/Docker
- `.env.supabase.dev.example` para entorno Supabase + Vercel

Variables mínimas para arrancar:

- `DATABASE_URL`
- `DIRECT_URL` (Prisma migraciones/introspección)
- `AUTH_SECRET`

## Comandos

```bash
npm install
npm run dev
npm run build
npx prisma migrate deploy
npx prisma db seed
```

## Próximo paso recomendado

Seguir el roadmap de ejecución en:

- `docs/kateil/roadmap-execution-vercel-supabase-v1.md`
