# Annex IAM Policy v1

Version: `v1-draft`  
Estado: `Draft`  
Owner: `Platform + Security`  
Ultima actualizacion: `2026-04-17`

## 1. Objetivo

Definir como se gestionan identidades, accesos y privilegios en KATEIL.

## 2. Principios

- minimo privilegio por defecto
- acceso temporal para tareas elevadas
- trazabilidad completa de accesos sensibles
- MFA obligatorio para cuentas administrativas

## 3. Ambito

- usuarios internos KATEIL
- usuarios de empresas cliente
- cuentas de servicio y automatizaciones

## 4. Reglas obligatorias

- MFA obligatorio para `admins`, `owners` y acceso a produccion
- prohibido uso de cuentas compartidas
- cada accion critica debe quedar en `AuditLog`
- toda cuenta de servicio debe tener alcance minimo y rotacion de secreto

## 5. Modelo de roles minimo

- `PlatformOwner`: control total de plataforma
- `SecurityAdmin`: politicas de seguridad y respuesta a incidentes
- `OpsAdmin`: despliegues, monitoreo y continuidad
- `TenantAdmin`: administracion de su organizacion
- `TenantUser`: operacion de negocio sin privilegios de plataforma
- `ReadOnly`: consulta sin modificacion

## 6. Ciclo de vida de accesos

- alta: aprobacion por responsable del area
- cambio: requiere ticket y justificacion
- baja: revocacion en menos de 24h tras salida o cambio de rol
- revision: auditoria trimestral de permisos efectivos

## 7. Acceso a produccion

- acceso solo por necesidad operativa
- aprobacion doble para tareas de alto impacto (Ops + Security)
- sesiones registradas y con tiempo limitado
- acceso de soporte a datos sensibles solo con aprobacion explicita

### 7.1 Protocolo de acceso de soporte (JIT)

- el acceso a `prod` se concede bajo modelo `just-in-time` (no permanente)
- cada acceso requiere ticket con:
- motivo
- alcance tecnico exacto
- entorno afectado
- tiempo estimado
- responsable

### 7.2 Niveles de aprobacion

- soporte operativo sin datos sensibles: `OpsAdmin`
- soporte con posible acceso a datos sensibles: `OpsAdmin + SecurityAdmin`
- cambios con riesgo alto en `prod`: `OpsAdmin + SecurityAdmin + PlatformOwner`

### 7.3 Duracion y caducidad

- acceso estandar: maximo `2 horas`
- extension excepcional: maximo `8 horas` con nueva aprobacion
- al caducar, el acceso debe revocarse automaticamente

### 7.4 Reglas de seguridad de sesion

- MFA obligatoria
- cuenta personal nominativa (sin cuentas compartidas)
- registro de inicio/fin y comandos o acciones criticas
- prohibido exportar datos sensibles fuera de canales autorizados

### 7.5 Break-glass (emergencia)

- permitido solo para incidentes `Sev1`
- habilitacion por `OpsAdmin` con notificacion inmediata a `SecurityAdmin`
- validez maxima `60 minutos`
- post-analisis obligatorio en menos de `24h`
- rotacion de credenciales de emergencia tras uso

## 8. Pendientes abiertos

- definir proveedor de IAM/SSO final
- decidir politica exacta de duracion de sesion por perfil
- automatizar revocacion JIT en herramienta IAM objetivo
