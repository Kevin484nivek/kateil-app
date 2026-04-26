# Annex Observability v1

Version: `v1-draft`  
Estado: `Draft`  
Owner: `Ops + Platform`  
Ultima actualizacion: `2026-04-17`

## 1. Objetivo

Disponer de visibilidad en tiempo real de salud, rendimiento y errores del sistema.

## 1.1 SLO base aprobado (fase inicial conservadora)

- SLO base de disponibilidad mensual: `99.x%` en modalidad `best effort`
- referencia del SLO base: disponibilidad de servidor/infraestructura cloud
- este SLO base no sustituye SLAs contractuales futuros por plan de cliente

## 2. Capas obligatorias

- logs estructurados
- metricas de infraestructura y aplicacion
- trazas distribuidas para flujos criticos
- alertas accionables con responsable

## 2.1 Stack MVP aprobado

- stack base inicial: `CloudWatch` (logs, metricas y alarmas)
- instrumentacion avanzada y trazas completas: activacion progresiva por necesidad
- herramientas adicionales (ejemplo: Sentry) quedan para fase posterior

## 3. Requisitos de logs

- incluir `timestamp`, `service`, `env`, `traceId`, `organizationId` cuando aplique
- no exponer secretos ni datos sensibles en claro
- retencion con politica definida por compliance

## 4. SLI iniciales minimos

- disponibilidad por servicio
- latencia p95 de endpoints criticos
- tasa de error por endpoint
- saturacion de base de datos

## 5. Alertado minimo

- caida de servicio
- incremento anormal de errores
- degradacion de latencia
- fallos repetidos de jobs criticos

## 6. Pendientes abiertos

- fijar valor numerico exacto dentro de `99.x` y error budget asociado
- definir SLO y error budget por modulo
- definir dashboards ejecutivos y operativos estandar
