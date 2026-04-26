# Annex Secure SDLC v1

Version: `v1-draft`  
Estado: `Draft`  
Owner: `Platform + Security + Engineering`  
Ultima actualizacion: `2026-04-17`

## 1. Objetivo

Definir el flujo de desarrollo seguro y estable desde commit hasta produccion.

## 2. Flujo de ramas

- `main`: solo cambios aprobados y desplegables
- ramas de trabajo con prefijo `feature/`, `fix/`, `chore/`
- merge solo mediante Pull Request

## 3. Puertas obligatorias de calidad

- lint en verde
- test unitario en verde
- build de produccion en verde
- migraciones verificadas en entorno de pruebas
- revisiones de codigo aprobadas

## 4. Controles de seguridad en CI

- SAST en cada PR
- SCA de dependencias en cada PR
- escaneo de imagen contenedor en cada release candidate
- escaneo IaC en cambios de infraestructura

## 5. Politica de aprobacion

- minimo 1 aprobacion tecnica para cambios no criticos
- minimo 2 aprobaciones para cambios en auth, permisos, facturacion o datos sensibles
- Security puede bloquear merge por riesgo alto

## 6. Reglas de pruebas minimas

- pruebas de regresion para reglas de negocio criticas heredadas de MiMarca
- pruebas de permisos por rol y organizacion
- pruebas de integridad de stock/ventas
- pruebas de migracion en staging antes de prod

## 7. Pendientes abiertos

- fijar cobertura minima por modulo
- definir conjunto exacto de pruebas end-to-end obligatorias
- decidir politica de pruebas de carga por release

