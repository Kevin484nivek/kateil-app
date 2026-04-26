# Annex Local Validation Playbook v1

Version: `v1-draft`  
Estado: `Draft`  
Owner: `Engineering + Security`  
Ultima actualizacion: `2026-04-17`

## 1. Objetivo

Definir el procedimiento obligatorio de validacion local antes de cualquier despliegue a produccion.

## 2. Alcance

- cambios funcionales
- cambios de seguridad
- cambios de infraestructura y migraciones
- hotfixes (con circuito reducido, pero siempre con validacion minima)

## 3. Flujo local obligatorio (orden)

1. actualizar rama y dependencias
2. ejecutar lint y tipos
3. ejecutar tests unitarios
4. ejecutar pruebas de regresion de negocio critico
5. validar migraciones en entorno local
6. ejecutar analisis de seguridad requeridos
7. smoke test manual de flujos clave
8. documentar evidencia

## 4. Comprobaciones minimas por bloque

- Auth y permisos:
- login/logout correctos
- control de acceso por rol
- rechazo de accesos no autorizados

- Negocio critico (MiMarca/KATEIL pilot):
- no venta con stock 0
- trazabilidad de movimiento de stock
- numeraciones y snapshots correctos

- Datos:
- migracion aplica y revierte (cuando proceda)
- integridad de datos tras cambios

## 5. Resultado esperado

- `PASS`: apto para evaluar paso a `prod`
- `FAIL`: despliegue bloqueado hasta correccion

## 6. Evidencia requerida

- hash/commit evaluado
- resultados de pruebas (resumen)
- resultados de analisis de seguridad
- checklist de smoke test completado
- aprobador tecnico

## 7. Pendientes abiertos

- estandarizar ejecucion automatica de este playbook en CI
- definir bateria end-to-end base por modulo

