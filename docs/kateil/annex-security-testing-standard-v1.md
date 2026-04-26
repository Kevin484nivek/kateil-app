# Annex Security Testing Standard v1

Version: `v1-draft`  
Estado: `Draft`  
Owner: `Security`  
Ultima actualizacion: `2026-04-17`

## 1. Objetivo

Definir pruebas y analisis de ciberseguridad obligatorios antes y despues de pasar a produccion.

## 2. Controles obligatorios

### 2.1 En cada Pull Request

- SAST (analisis estatico de codigo)
- SCA (dependencias vulnerables)
- escaneo de secretos

### 2.2 En cada release candidate

- escaneo de imagen contenedor
- validacion de configuraciones de seguridad relevantes

### 2.3 Periodico en entorno operativo

- DAST sobre superficie publica (al menos mensual)
- revisiones manuales de componentes criticos (trimestral)
- pentest externo (semestral o anual segun riesgo y plan)

## 3. Umbrales de bloqueo

- `Critica`: bloqueo automatico
- `Alta`: bloqueo salvo excepcion formal aprobada
- `Media/Baja`: plan de remediacion y seguimiento

## 4. Cobertura minima por dominio

- autenticacion y sesiones
- autorizacion por rol/tenant
- validacion de entradas
- gestion de secretos
- dependencias de terceros

## 5. Evidencia obligatoria

- reporte del analisis
- fecha/herramienta/version
- hallazgos y severidad
- decision de paso o bloqueo

## 6. Pendientes abiertos

- fijar herramientas concretas por tipo de analisis
- definir SLA de correccion final por severidad en todos los planes

