# Frontend — Sistema de gestión académica

Interfaz web de la **Unidad Educativa «Los Ángeles de Nazaria Ignacia»** (Oruro, Bolivia). Cinco roles —Director, Secretaría, Docente, Estudiante y Tutor— usan la misma aplicación y ven solo lo que les corresponde.

Proyecto de grado de Ingeniería de Sistemas, Universidad Técnica de Oruro (UTO). Necesita el backend (`back_end_educa`) en marcha.

---

## Tecnologías

| Capa | Herramienta |
|---|---|
| Framework | Vue 3 (`<script setup>`) · TypeScript |
| Empaquetado | Vite |
| Estado | Pinia |
| Rutas | Vue Router (guardas por rol) |
| HTTP | Axios |
| Estilos | Tailwind CSS 4 · DaisyUI 5 |

## Requisitos

- Node.js 22 o superior
- pnpm (`npm i -g pnpm`)
- Backend corriendo en `http://localhost:4000`

## Puesta en marcha

```bash
pnpm install
pnpm dev
```

Abre `http://localhost:3000`. En desarrollo, Vite reenvía todo lo que empiece con `/api` al backend (`vite.config.ts`), así que el navegador no tiene problemas de CORS y **no hace falta ninguna variable de entorno**.

Si el backend usa otro puerto, cambia el `target` del proxy en `vite.config.ts`.

### Cuentas de prueba

En desarrollo, la pantalla de login muestra un panel plegable «Credenciales de prueba (solo desarrollo)»: un clic en el usuario rellena el formulario.

| Rol | Usuario | Contraseña |
|---|---|---|
| Director | `director` | `admin1234` |
| Secretaria | `secretaria` | `sec1234` |
| Docente | `doc01` | `doc1234` |
| Estudiante | `est_v001` | `est1234` |
| Tutor | `tut_v001` | `tut1234` |

Existen cuando el backend cargó una semilla (`pnpm db:seed:perfil demo --limpiar`). Ese panel y sus contraseñas **no entran al build de producción**.

## Scripts

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo con recarga en caliente (puerto 3000) |
| `pnpm build` | Revisa tipos con `vue-tsc` y genera `dist/` |
| `pnpm preview` | Sirve `dist/` localmente para probar el build |

Antes de entregar cambios, ejecuta `pnpm build`: falla si hay errores de tipos.

## Estructura

```
src/
├── main.ts · App.vue
├── router/          Rutas y guardas por rol (home según el rol de mayor prioridad)
├── layouts/         DashboardLayout: menú lateral, menú inferior en móvil, selector de tema
├── views/
│   ├── auth/        Login
│   ├── director/    Dashboard, docentes, usuarios, reportes, estructura, gestiones, institución, horarios…
│   ├── secretaria/  Estudiantes, tutores, pagos, cobranza, boletines, promoción, historial…
│   ├── docente/     Asistencia, calificaciones, bitácora, cuaderno, horario
│   ├── estudiante/  Mi perfil, mi historial
│   └── tutor/       Seguimiento, historial
├── components/      Reutilizables (modales, paginador, CiInput, ThemeSelector…)
├── composables/     Lógica compartida (ver abajo)
├── stores/          Pinia: auth, gestión activa, docente, institución, catálogos, avisos
├── api/             Un archivo por módulo; todas las llamadas HTTP pasan por api/axios.ts
├── lib/             Utilidades puras (fechas, CI, abreviaturas…)
├── types/
└── style.css        Temas, tokens de marca y estilos móviles
```

## Roles y navegación

Un usuario puede tener varios roles. Al entrar se elige la pantalla inicial por prioridad: **Director > Secretaría > Docente > Estudiante > Tutor**. El router bloquea el acceso a pantallas de otros roles; el servidor vuelve a comprobarlo, así que escribir la dirección a mano no sirve para saltarse permisos.

## Cómo está resuelto…

### Listas largas
- **`useListaPaginada`** — paginación y búsqueda **en el servidor** (Estudiantes, Tutores y la pestaña de estudiantes en Usuarios). Espera 350 ms al teclear, descarta respuestas fuera de orden y vuelve a la página 1 al cambiar un filtro.
- **`usePaginaLocal`** — paginación **en el navegador** para listas que ya llegaron completas (Docentes, Secretarías, Directores, Cobranza).
- Ambas usan el mismo componente `PaginadorTabla`.

### Temas
Cinco temas (Colegio, Colegio oscuro, Esmeralda, Carnaval, Vino) con selector en el encabezado y en el login. La elección se guarda en el navegador. Para agregar uno:
1. Definir el tema DaisyUI en `src/style.css` con los tokens `--color-dorado` y `--color-marino*`.
2. Agregarlo al arreglo `TEMAS` de `src/composables/useTheme.ts`.

### Móvil
- Menú inferior (con «Más» cuando hay más de 4 secciones).
- Tablas convertidas en tarjetas apiladas con la clase `.tabla-cards` y `data-label` en cada `<td>`.
- Asistencia con botones grandes P/R/A/J por estudiante; calificaciones con Enter para pasar a la siguiente nota.
- Campos de 16 px en pantallas pequeñas (evita el zoom automático de iOS) y controles más grandes con puntero táctil.

### Formularios y avisos
- **`CiInput`** — avisa en ámbar si el CI no parece boliviano (7 dígitos + complemento opcional, p. ej. `5873210-1B`), **sin bloquear** el guardado: hay extranjeros y documentos antiguos.
- **`useConfirm` / `ConfirmDialog`** — confirmaciones propias en lugar de `confirm()`.
- **`useAccion`** — ejecuta una acción con estado de carga, aviso de éxito y manejo de error.
- **Toasts** — avisos con el store `toast`.

## Producción

```bash
pnpm build
```

Sube el contenido de `dist/` a cualquier servidor de archivos estáticos. Como la app usa rutas sin `#`, el servidor debe devolver `index.html` para cualquier ruta desconocida, y debe reenviar `/api` al backend (por ejemplo, con nginx):

```nginx
location /api/ { proxy_pass http://localhost:4000; }
location /     { try_files $uri /index.html; }
```

En el backend, `FRONTEND_URL` debe coincidir con el dominio desde el que se sirve la aplicación.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| Pantalla de login sin datos del colegio o errores de red | El backend no está corriendo en el puerto 4000 |
| «Credenciales inválidas» con las cuentas de prueba | No se cargó una semilla, o es de un perfil que no crea esa cuenta (`vacio` solo trae `director`) |
| Error 429 al iniciar sesión varias veces | Límite de intentos por IP del backend; espera o súbelo con `RATE_LIMIT_LOGIN` |
| Página en blanco tras cambiar de rol o de base | Sesión vieja: borra el almacenamiento local del navegador y entra de nuevo |
| `pnpm build` falla con errores de tipos | Corrige los que indica `vue-tsc`; el build no continúa con tipos rotos |
