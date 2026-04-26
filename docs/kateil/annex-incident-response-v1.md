# Annex Incident Response v1

Version: `v1-draft`  
Estado: `Draft`  
Owner: `Ops + Security`  
Ultima actualizacion: `2026-04-17`

## 1. Objetivo

Establecer protocolo unico de deteccion, respuesta, comunicacion y cierre de incidentes.

## 2. Severidades

- Sev1: servicio caido o brecha grave de seguridad
- Sev2: degradacion severa con impacto operativo alto
- Sev3: incidencia relevante sin bloqueo total
- Sev4: incidencia menor o localizada

## 3. Tiempos objetivo iniciales

- Sev1: respuesta en <= 15 min
- Sev2: respuesta en <= 30 min
- Sev3: respuesta en <= 4h
- Sev4: siguiente ciclo operativo

## 4. Flujo de incidente

- detectar y clasificar
- contener impacto
- recuperar servicio
- comunicar estado
- ejecutar postmortem y acciones preventivas

## 5. Comunicacion

- canal interno unico para incidentes
- estado periodico hasta cierre
- comunicacion externa a clientes segun severidad y SLA

## 6. Postmortem

- obligatorio para Sev1 y Sev2
- sin culpabilizacion personal
- con acciones correctivas y fecha de cierre

## 7. Pendientes abiertos

- definir rotacion on-call oficial
- cerrar plantilla final de comunicacion a clientes
- fijar criterios de apertura de crisis room

