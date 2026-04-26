# Annex Backup and DR v1

Version: `v1-draft`  
Estado: `Draft`  
Owner: `Ops`  
Ultima actualizacion: `2026-04-17`

## 1. Objetivo

Garantizar continuidad operativa y recuperacion ante perdida o corrupcion de datos.

## 2. Objetivos base aprobados (fase inicial conservadora)

- RTO base: `<= 24h`
- RPO base: `<= 48h`

Nota:

- estos valores son de arranque y priorizan simplicidad operativa
- se revisaran por fase de madurez y por plan de cliente

## 3. Alcance de backup

- base de datos de plataforma
- base de datos de negocio
- configuracion critica de despliegue
- evidencias de auditoria

## 4. Reglas operativas

- backups automaticos diarios
- retencion minima de 30 dias
- copia fuera del entorno principal
- cifrado en reposo y en transito

## 5. Restauracion y pruebas

- prueba de restore mensual obligatoria
- prueba trimestral de DR de extremo a extremo
- documentar resultado y tiempos reales

## 6. Pendientes abiertos

- definir proveedor final de almacenamiento de backups
- fijar retenciones por plan de cliente
- decidir si ciertos tenants tendran politicas de backup premium
- definir objetivo de evolucion recomendado para `RTO` y `RPO` por fase
