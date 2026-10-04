# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Usuarios principales, los 5 roles en parejo sin jerarquia de prioridad de uso:

- Direccion: gestion integral en oficina (dashboard, docentes, usuarios, reportes, estructura, gestiones, institucion, horarios).
- Secretaria: operacion diaria en oficina (estudiantes, tutores, pagos, boletines, asistencia, correccion de notas, promocion).
- Docentes: trabajo en aula y fuera de ella (asistencia, calificaciones, bitacora, horario).
- Estudiantes: consulta de su perfil e historial.
- Tutores: seguimiento del estudiante a su cargo desde casa.

Un usuario puede tener varios roles a la vez. El sistema resuelve home y vista activa por prioridad: DIRECTOR > SECRETARIA > DOCENTE > ESTUDIANTE > TUTOR.

## Product Purpose

Plataforma Academica web de la U.E. "Los Angeles de Nazaria Ignacia" (Oruro, Bolivia) para centralizar la gestion escolar bajo Ley N.º 070 en un solo portal por rol.

Exito significa gestion unificada: calificaciones, asistencia, pagos y boletines consultables y operables sin salir del sistema ni duplicar registros.

## Positioning

Portal unico por rol con rutas y guardias por rol, multi-rol real con vista activa conmutable, y anclaje normativo boliviano (Ley 070, RUE 81230370, Urb. Bustillos Zona Los Angeles Oruro).

Un producto vecino no podria copiar con verdad la combinacion de flujos por rol de esta unidad educativa mas su identidad institucional y su operacion bajo Ley 070.

## Operating Context

Flujos confirmados por router:

- Director: /director/dashboard, docentes, directores, secretarias, usuarios, reportes, estructura, dimensiones, gestiones, institucion, horarios.
- Secretaria (tambien accesible para Director): /secretaria/estudiantes, tutores, pagos, boletines, asistencia, correccion-notas, promocion.
- Docente: /docente/asistencia, calificaciones, bitacora, horario.
- Estudiante: /estudiante/perfil.
- Tutor: /tutor/seguimiento.

Sesion persistente en localStorage con token mas usuario, confirmada contra backend al abrir la app (refreshMe). Interceptor ante 401 limpia sesion y envia a /login con motivo en sessionStorage ("Sesion expirada", "cuenta desactivada"). Login redirige a ?redirect o a homeSegunRol.

Entornos: oficina (direccion, secretaria), aula (docentes), casa (familias). Idioma espanol. Gestion activa 2026.

## Capabilities and Constraints

Confirmado:

- Auth con username mas password, JWT, roles multiples, cambio de password propio con rotacion de token.
- RBAC en frontend (meta.requiresAuth, meta.roles) espejando requireRol del backend; basta con tener uno de los roles.
- Stack existente Vue 3 + TypeScript + Vite, Pinia, Vue Router, Tailwind v4 + daisyUI con temas colegio y colegio-dark, persistencia de tema en localStorage.
- Terminologia: Rol (DIRECTOR, SECRETARIA, DOCENTE, ESTUDIANTE, TUTOR), RUE, Ley 070, Gestion, Boletin, Promocion.

Restricciones:

- No inventar testimonios, cifras oficiales ni normativa. Las cifras del login (1.2k+, 48, 100%) son presentacionales y deben verificarse antes de reusarse fuera del login.
- Credenciales de prueba solo en DEV; nunca en bundle de produccion.

Sin decidir: estandar de accesibilidad formal, alcance offline, notificaciones.

## Brand Commitments

Preservar identidad, mejora solo funcional sin rebrand:

- Nombre: U.E. "Los Angeles de Nazaria Ignacia", Plataforma Academica.
- Voz institucional en espanol: "Formamos con disciplina, fe y excelencia academica".
- Activos visuales existentes: azul institucional #0C2743 / #1A3C5E, dorado #C9A227 / #E8C86A, tipografias Plus Jakarta Sans (display) + Inter (body).
- Datos: Oruro Bolivia, RUE 81230370, Ley N.º 070, Urb. Bustillos Zona Los Angeles.

## Evidence on Hand

Codigo y copy reales en src/: LoginView.vue, router/index.ts, stores/auth.store.ts, layouts/DashboardLayout.vue, vistas por rol, style.css con temas colegio.

Ausencias que no deben fabricarse: testimonios, casos de exito, metricas oficiales, prensa, logos externos.

## Product Principles

1. Un portal, cada rol en su lugar: cada usuario entra a su flujo sin ver lo ajeno.
2. Normativa primero: Ley 070 y datos institucionales mandan sobre atajos.
3. Operacion diaria simple: secretaria y docentes resuelven en pocos pasos.
4. Sesion explicable: todo cierre o redireccion dice motivo y destino.
5. Identidad preservada: mejorar uso sin cambiar marca.
