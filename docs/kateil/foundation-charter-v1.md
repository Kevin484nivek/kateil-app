# KATEIL Foundation Charter v1

## 0. Proposito del documento

Este documento es la base oficial de KATEIL.

Su funcion es:

- definir el marco unico de decisiones para construir y operar KATEIL
- alinear arquitectura, seguridad, estabilidad, operacion y cumplimiento
- dejar explicito que esta definido hoy y que queda pendiente

Regla de gobierno:

- si hay conflicto entre documentos, prevalece este Charter
- todo anexo debe referenciar este Charter

## 1. Alcance

Este Charter cubre:

- nivel tecnico (arquitectura, datos, despliegue, observabilidad)
- nivel operativo (cambios, incidentes, continuidad, soporte)
- nivel de seguridad (controles, accesos, vulnerabilidades)
- nivel legal/compliance (privacidad, retencion, auditoria)

Fuera de alcance por ahora:

- contratos comerciales finales por tipo de cliente
- politicas fiscales por pais (se definiran por jurisdiccion)

## 2. Vision y principios de KATEIL

Vision:

- KATEIL sera una plataforma modular multiempresa para crear software de gestion configurable por organizacion.

Principios no negociables:

- seguridad por defecto
- estabilidad antes que velocidad
- aislamiento de datos por organizacion
- trazabilidad completa de cambios criticos
- despliegues reversibles y controlados
- evolucion sin forks por cliente

## 3. Modelo documental oficial

Decision:

- no usar un unico documento gigante
- usar un modelo de 1 documento rector + anexos especializados

Motivo:

- mantiene claridad ejecutiva en el Charter
- permite evolucionar cada area sin romper la base

Estructura:

1. `foundation-charter-v1.md` (este documento)
2. anexos normativos (obligatorios)
3. anexos tecnicos y operativos (obligatorios)
4. anexos de contexto o guias (recomendados)

## 4. Matriz de definicion (definido vs pendiente)

### 4.1 Arquitectura y plataforma

- Definido:
- modelo `core + modules`
- login comun KATEIL
- personalizacion por tenant mediante modulos y configuracion
- desarrollo local con camino a cloud
- proveedor cloud inicial: `AWS`
- despliegue MVP inicial: `AWS Lightsail Linux` con `IPv4 publica`
- topologia MVP inicial: `dev` en local y `prod` en cloud (sin staging cloud en fase piloto)

- Pendiente por definir:
- estrategia final de networking (VPC/subredes/WAF)
- patron de despliegue gestionado para fase de madurez (ECS/Fargate o equivalente)

### 4.2 Datos y aislamiento

- Definido:
- arquitectura multi-tenant desde inicio
- toda entidad de negocio debe incluir `organizationId`
- migracion futura posible a tenants dedicados
- criterios de paso a BD dedicada por cliente definidos y auditables

- Pendiente por definir:
- estrategia de cifrado de columnas sensibles
- retencion final por tipo de dato

### 4.3 Seguridad

- Definido:
- MFA para administracion y accesos privilegiados
- minimo privilegio en accesos e identidades
- secretos fuera de repositorio
- escaneo continuo de vulnerabilidades
- politica formal de excepciones de seguridad (aprobacion, caducidad y control)
- politica formal de acceso de soporte a produccion (JIT, auditoria y break-glass)

- Pendiente por definir:
- objetivos de parcheo por severidad (SLA interno)

### 4.4 Calidad, release y cambios

- Definido:
- flujo MVP `dev -> prod` con puertas de calidad
- aprobacion explicita para produccion
- rollback obligatorio documentado por release

- Pendiente por definir:
- umbrales concretos de bloqueo (cobertura, severidad vuln, performance)
- estrategia exacta de despliegue progresivo (canary/blue-green)
- momento de reintroduccion de `staging` cloud dedicado

### 4.5 Observabilidad e incidentes

- Definido:
- logs estructurados centralizados
- metricas y alertas por salud del sistema
- runbooks operativos para incidentes
- postmortem obligatorio en incidentes severos

- Pendiente por definir:
- catalogo de SLI/SLO por modulo
- rotacion de guardias y on-call
- presupuesto de error por entorno y plan de cliente

### 4.6 Legal, privacidad y cumplimiento

- Definido:
- privacidad y proteccion de datos como requisito base
- trazabilidad de acciones criticas
- evidencias de auditoria conservadas

- Pendiente por definir:
- marco legal primario por jurisdiccion (RGPD + paises objetivo)
- DPA y clausulas de tratamiento por tipo de cliente
- politica de borrado definitivo por solicitud legal

## 5. Anexos obligatorios de KATEIL

Estos anexos deben existir para declarar KATEIL "listo para operar":

1. Arquitectura de referencia (`ADR-001+`).
2. Politica de identidad y accesos (IAM).
3. Estandar SDLC seguro (PR, testing, scans, aprobaciones).
4. Politica de gestion de vulnerabilidades.
5. Politica de despliegue y gestion de cambios.
6. Politica de backup, restore y continuidad.
7. Estandar de observabilidad y alertado.
8. Protocolo de gestion de incidentes.
9. Politica de privacidad, retencion y borrado.
10. Matriz RACI de responsabilidades.

## 6. Estandares minimos de entrada a produccion

Ningun modulo/tenant pasa a produccion sin:

- pruebas criticas en verde
- sin vulnerabilidades criticas abiertas sin excepcion aprobada
- plan de rollback probado
- dashboards y alertas activos
- backup y restore verificado
- runbook operativo disponible

## 7. Gobernanza y control de cambios

Roles minimos:

- Product Owner KATEIL
- Responsable Tecnico de Plataforma
- Responsable de Seguridad
- Responsable de Operaciones

Reglas:

- cambios a este Charter requieren aprobacion de Plataforma + Seguridad
- cada cambio se registra con fecha, motivo e impacto

## 8. Estado actual v1 (2026-04-17)

Definido:

- direccion de plataforma modular multi-tenant
- enfoque de seguridad y estabilidad como prioridad
- necesidad de control estricto de cambios y observabilidad
- cloud inicial aprobado: `AWS Lightsail`
- plan de arranque aprobado: `12 USD/mes`, Linux, `IPv4 publica`, `2 vCPU`, `2 GB RAM`, `60 GB SSD`
- alcance piloto inicial: hasta `2 clientes` en plataforma compartida

Pendiente inmediato:

- sin pendientes criticos abiertos en esta iteracion de definicion

## 9. Proximos pasos de definicion

1. Aprobar este Charter como documento rector de KATEIL.
2. Crear los 10 anexos obligatorios en version `v1-draft`.
3. Marcar cada anexo con estado: `Draft`, `Approved`, `Deprecated`.
4. Revisar semanalmente pendientes criticos hasta cierre de base.
