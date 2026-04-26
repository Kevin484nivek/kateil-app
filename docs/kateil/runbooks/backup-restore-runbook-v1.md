# Backup Restore Runbook v1

Version: `v1-draft`  
Estado: `Draft`  
Owner: `Ops`  
Ultima actualizacion: `2026-04-17`

## 1. Objetivo

Ejecutar y validar restauracion de datos de forma segura.

## 2. Escenarios

- restauracion total por corrupcion/caida
- restauracion puntual de validacion (prueba mensual)

## 3. Precondiciones

- backup origen identificado
- ventana de mantenimiento aprobada (si produccion)
- responsable tecnico asignado

## 4. Procedimiento de restore (alto nivel)

1. confirmar backup objetivo (fecha/hora)
2. aislar o detener escrituras activas
3. preparar instancia/base destino
4. restaurar backup
5. validar integridad basica de datos
6. levantar aplicacion y ejecutar smoke test
7. habilitar trafico normal

## 5. Validaciones minimas post-restore

- login funcional
- conteo de entidades clave esperado
- consulta de operaciones recientes correcta
- flujo de negocio critico sin error

## 6. Criterio de exito

- restauracion completa
- servicio operativo
- evidencia registrada con tiempos reales (RTO/RPO)

## 7. Evidencia obligatoria

- backup usado
- tiempo total de restauracion
- estimacion de perdida de datos observada
- incidencias detectadas y acciones

