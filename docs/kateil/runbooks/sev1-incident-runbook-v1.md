# Sev1 Incident Runbook v1

Version: `v1-draft`  
Estado: `Draft`  
Owner: `Ops + Security`  
Ultima actualizacion: `2026-04-17`

## 1. Objetivo

Coordinar respuesta inmediata ante incidente critico (`Sev1`).

## 2. Definicion Sev1

- servicio caido o inutilizable para operacion principal
- posible brecha de seguridad grave
- perdida o corrupcion critica de datos

## 3. Protocolo de activacion (primeros 15 minutos)

1. declarar incidente `Sev1`
2. asignar Incident Commander
3. abrir canal unico de crisis
4. informar estado inicial a stakeholders internos
5. iniciar contencion tecnica

## 4. Contencion y recuperacion

1. detener impacto activo
2. priorizar recuperacion de servicio minimo viable
3. aplicar rollback/restore si procede
4. verificar estabilidad inicial
5. mantener comunicacion periodica

## 5. Comunicacion minima

- actualizacion interna cada 15-30 minutos
- comunicacion externa a clientes segun impacto y SLA
- registro cronologico de decisiones

## 6. Cierre de incidente

- servicio estable recuperado
- causa raiz preliminar identificada
- acciones inmediatas asignadas

## 7. Postmortem

- obligatorio en menos de 72h
- sin culpabilizacion
- con acciones preventivas y due dates

