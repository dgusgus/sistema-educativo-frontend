<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useGestionStore } from '@/stores/gestion.store'
import { useDocenteStore } from '@/stores/docente.store'
import { reporteApi } from '@/api/reporte.api'
import type { Rol } from '@/types'
import { useTheme } from '@/composables/useTheme'
import AppIcon from '@/components/AppIcon.vue'
import type { NombreIcono } from '@/lib/icons'


const auth = useAuthStore()
const { tema, alternar } = useTheme()
const route = useRoute()
const router = useRouter()
const gestion = useGestionStore()
const docenteStore = useDocenteStore()
const itemsPrincipales = computed(() => menuItems.value.slice(0, 4))
const hayMasItems = computed(() => menuItems.value.length > 4)

// Badge de "Pagos pendientes" en el sidebar — GET /dashboard es Director-only,
// así que solo se pide (y se muestra) cuando la vista activa es Director.
const pagosPendientes = ref<number | null>(null)

async function cargarIndicadores() {
  try {
    const data = await reporteApi.getDashboard()
    pagosPendientes.value = data.indicadores.pagosPendientes
  } catch {
    pagosPendientes.value = null
  }
}

onMounted(() => {
  gestion.cargar()
  if (auth.esDocente) docenteStore.cargar()
  if (auth.esDirector) cargarIndicadores()
})

// ─── Menú por rol ─────────────────────────────────────────────────────────────
// "grupo" agrupa visualmente los ítems bajo un encabezado mudo (no
// clickeable). Sin "grupo" el ítem va suelto, fuera de cualquier sección.
interface MenuItem {
  label: string
  to: string
  icon: NombreIcono   // antes: string (el path del svg)
  grupo?: string
}

const menusPorRol: Record<Rol, MenuItem[]> = {
  DIRECTOR: [
    { label: 'Dashboard', to: '/director/dashboard', icon: 'dashboard' },

    { label: 'Estructura', to: '/director/estructura', grupo: 'Académico', icon: 'estructura' },
    { label: 'Dimensiones', to: '/director/dimensiones', grupo: 'Académico', icon: 'dimensiones' },
    { label: 'Docentes', to: '/director/docentes', grupo: 'Académico', icon: 'personas' },
    { label: 'Estudiantes', to: '/secretaria/estudiantes', grupo: 'Académico', icon: 'estudiantes' },
    { label: 'Tutores', to: '/secretaria/tutores', grupo: 'Académico', icon: 'personas' },
    { label: 'Corrección de Notas', to: '/secretaria/correccion-notas', grupo: 'Académico', icon: 'correccion' },
    { label: 'Promoción de Gestión', to: '/secretaria/promocion', grupo: 'Académico', icon: 'promocion' },

    { label: 'Directores', to: '/director/directores', grupo: 'Administración', icon: 'personas' },
    { label: 'Secretarias', to: '/director/secretarias', grupo: 'Administración', icon: 'personas' },
    { label: 'Usuarios', to: '/director/usuarios', grupo: 'Administración', icon: 'personas' },
    { label: 'Pagos', to: '/secretaria/pagos', grupo: 'Administración', icon: 'pagos' },
    { label: 'Boletines', to: '/secretaria/boletines', grupo: 'Administración', icon: 'documento' },
    { label: 'Asistencia', to: '/secretaria/asistencia', grupo: 'Administración', icon: 'asistencia' },
    { label: 'Institución', to: '/director/institucion', grupo: 'Administración', icon: 'institucion' },

    { label: 'Reportes', to: '/director/reportes', icon: 'reportes' },
    { label: 'Gestiones', to: '/director/gestiones', icon: 'gestiones' },
    { label: 'Horarios', to: '/director/horarios', icon: 'horario' },
    
  ],
  SECRETARIA: [
    { label: 'Estudiantes', to: '/secretaria/estudiantes', icon: 'estudiantes' },
    { label: 'Tutores', to: '/secretaria/tutores', icon: 'personas' },
    { label: 'Pagos', to: '/secretaria/pagos', icon: 'pagos' },
    { label: 'Boletines', to: '/secretaria/boletines', icon: 'documento' },
    { label: 'Asistencia', to: '/secretaria/asistencia', icon: 'asistencia' },
    { label: 'Corrección de Notas', to: '/secretaria/correccion-notas', icon: 'correccion' },
    { label: 'Promoción de Gestión', to: '/secretaria/promocion', icon: 'promocion' },
  ],
  DOCENTE: [
    { label: 'Asistencia', to: '/docente/asistencia', icon: 'asistencia' },
    { label: 'Calificaciones', to: '/docente/calificaciones', icon: 'correccion' },
    { label: 'Bitácora', to: '/docente/bitacora', icon: 'documento' },
    { label: 'Mi Horario', to: '/docente/horario', icon: 'horario' },
  ],
  ESTUDIANTE: [
    { label: 'Mi Perfil', to: '/estudiante/perfil', icon: 'perfil' },
  ],
  TUTOR: [
    { label: 'Seguimiento', to: '/tutor/seguimiento', icon: 'seguimiento' },
  ],
}

// ✅ Antes se fusionaban los menús de TODOS los roles del usuario en una
// sola lista larga (con Estudiantes/Pagos/etc. duplicados si tenía más de
// un rol). Ahora se muestra el menú de UN rol a la vez — "vista activa"
// (ver auth.store.ts) — con un selector si tiene más de uno.
const menuItems = computed<MenuItem[]>(() =>
  auth.vistaEfectiva ? menusPorRol[auth.vistaEfectiva] ?? [] : []
)

// Grupos en el orden en que aparecen (Set preserva orden de inserción)
const grupos = computed(() => {
  const vistos = new Set<string | undefined>()
  menuItems.value.forEach(i => vistos.add(i.grupo))
  return Array.from(vistos)
})
function itemsDelGrupo(grupo: string | undefined) {
  return menuItems.value.filter(i => i.grupo === grupo)
}

function esActivo(path: string): boolean {
  return route.path.startsWith(path)
}

// Badge numérico junto al ítem del menú — hoy solo "Pagos" tiene una
// fuente de datos barata (el dashboard, que ya se carga si es Director).
// Ampliar acá cuando haya más endpoints de conteo disponibles.
function badgeDe(item: MenuItem): number | null {
  if (item.to === '/secretaria/pagos' && pagosPendientes.value) return pagosPendientes.value
  return null
}

// ─── Selector de vista (solo si tiene más de un rol) ─────────────────────────
const NOMBRE_ROL: Record<Rol, string> = {
  DIRECTOR: 'Director', SECRETARIA: 'Secretaria', DOCENTE: 'Docente',
  ESTUDIANTE: 'Estudiante', TUTOR: 'Tutor',
}

function cambiarVista(rol: string) {
  auth.setVista(rol as Rol)
  // Si la ruta actual no pertenece al menú del rol recién elegido, lo
  // mandamos a su primer ítem — evita quedar en una pantalla "huérfana"
  // de la vista anterior.
  const items = menusPorRol[rol as Rol] ?? []
  if (!items.some(i => esActivo(i.to)) && items.length) {
    router.push(items[0].to)
  }
}

const rolesTexto = computed(() => auth.roles.map(r => NOMBRE_ROL[r] ?? r).join(', '))

// ─── Cambiar mi contraseña ────────────────────────────────────────────────────
// PUT /auth/password existía en el backend sin ningún consumidor en el
// frontend — cualquier rol puede cambiarla acá, sin depender de que
// Director/Secretaria se la resetee.
const modalPassword = ref(false)
const passwordActual = ref('')
const passwordNueva = ref('')
const passwordConfirma = ref('')
const cambiandoPassword = ref(false)
const errorPassword = ref<string | null>(null)
const exitoPassword = ref(false)

const dialogoPassword = ref<HTMLDialogElement | null>(null)
const inputPasswordActual = ref<HTMLInputElement | null>(null)
let focoPrevio: HTMLElement | null = null

function abrirModalPassword() {
  focoPrevio = document.activeElement as HTMLElement | null
  passwordActual.value = ''
  passwordNueva.value = ''
  passwordConfirma.value = ''
  errorPassword.value = null
  exitoPassword.value = false
  modalPassword.value = true
}

function cerrarModalPassword() {
  modalPassword.value = false
  focoPrevio?.focus?.()
}

// Al abrir: foco al primer campo. Trampa de foco simple + Esc dentro del diálogo.
watch(modalPassword, async (abierto) => {
  if (!abierto) return
  await nextTick()
  inputPasswordActual.value?.focus()
})

function atraparTab(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    cerrarModalPassword()
    return
  }
  if (e.key !== 'Tab' || !dialogoPassword.value) return
  const focos = Array.from(
    dialogoPassword.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )
  ).filter(el => el.offsetParent !== null)
  if (!focos.length) return
  const primero = focos[0]
  const ultimo = focos[focos.length - 1]
  if (e.shiftKey && document.activeElement === primero) {
    e.preventDefault()
    ultimo.focus()
  } else if (!e.shiftKey && document.activeElement === ultimo) {
    e.preventDefault()
    primero.focus()
  }
}

async function guardarPassword() {
  if (!passwordActual.value || !passwordNueva.value) {
    errorPassword.value = 'Completá ambos campos'
    return
  }
  if (passwordNueva.value.length < 8) {
    errorPassword.value = 'La contraseña nueva debe tener al menos 8 caracteres'
    return
  }
  if (passwordNueva.value !== passwordConfirma.value) {
    errorPassword.value = 'La confirmación no coincide'
    return
  }
  cambiandoPassword.value = true
  errorPassword.value = null
  try {
    await auth.cambiarPassword(passwordActual.value, passwordNueva.value)
    exitoPassword.value = true
    passwordActual.value = ''
    passwordNueva.value = ''
    passwordConfirma.value = ''
  } catch (e) {
    errorPassword.value = e instanceof Error ? e.message : 'Error al cambiar la contraseña'
  } finally {
    cambiandoPassword.value = false
  }
}
</script>

<template>
  <div class="drawer lg:drawer-open min-h-screen">
    <input id="drawer-toggle" type="checkbox" class="drawer-toggle" />

    <!-- ── Contenido principal ────────────────────────────────────────────── -->
    <div class="drawer-content flex flex-col">

      <!-- Navbar -->
      <nav class="topbar navbar bg-base-100/90 backdrop-blur border-b border-base-300 sticky top-0 z-10 shadow-[0_1px_12px_-6px_rgba(26,60,94,0.25)]" aria-label="Barra superior">
        <div class="flex-none lg:hidden">
          <label for="drawer-toggle" class="btn btn-square btn-ghost" aria-label="Abrir menú">
            <AppIcon nombre="menu" class="h-5 w-5" />
          </label>
        </div>

        <div class="flex-1 min-w-0 px-2">
          <h1 class="font-display text-[17px] font-bold leading-tight text-base-content truncate">
            {{ menuItems.find(i => esActivo(i.to))?.label ?? 'Sistema Educativo' }}
          </h1>
          <p class="text-[11px] text-base-content/55 truncate">
            <span v-if="auth.vistaEfectiva">{{ NOMBRE_ROL[auth.vistaEfectiva] }}</span>
            <span v-if="gestion.anio"> · Gestión {{ gestion.anio }}</span>
            <span v-if="gestion.trimestreActivo"> · {{ gestion.trimestreActivo.nombre }}</span>
          </p>
        </div>

        <div class="flex-none items-center gap-1.5 flex">
          <button type="button" class="btn btn-ghost btn-circle"
            :aria-label="tema === 'colegio' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'"
            :aria-pressed="tema !== 'colegio'" title="Cambiar tema" @click="alternar">
            <svg v-if="tema === 'colegio'" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none"
              viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
              stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>
          <div class="dropdown dropdown-end">
            <div tabindex="0" role="button" aria-haspopup="menu" aria-label="Abrir menú de usuario" class="btn btn-ghost gap-2.5 rounded-2xl px-2 py-1.5 h-auto">
              <div class="avatar placeholder">
                <div class="bg-primary text-primary-content rounded-full w-9 ring-2 ring-primary/20">
                  <span class="text-xs font-bold">{{ (auth.usuario?.nombre ?? '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() }}</span>
                </div>
              </div>
              <span class="hidden sm:block text-left leading-tight">
                <span class="block max-w-[10rem] truncate text-[13px] font-semibold text-base-content">{{ auth.usuario?.nombre ?? 'Usuario' }}</span>
                <span class="block text-[11px] text-base-content/55">{{ auth.vistaEfectiva ? NOMBRE_ROL[auth.vistaEfectiva] : rolesTexto }}</span>
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" class="hidden sm:block h-4 w-4 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <div tabindex="0" role="menu" aria-label="Opciones de usuario"
              class="dropdown-content bg-base-100 rounded-2xl z-10 w-64 p-2 shadow-[0_24px_60px_-24px_rgba(26,60,94,0.45)] border border-base-300">
              <div class="flex items-center gap-3 px-3 pt-2 pb-3 border-b border-base-300">
                <div class="avatar placeholder">
                  <div class="bg-primary text-primary-content rounded-full w-10">
                    <span class="text-sm font-bold">{{ (auth.usuario?.nombre ?? '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() }}</span>
                  </div>
                </div>
                <div class="min-w-0">
                  <p class="truncate text-[13px] font-bold text-base-content">{{ auth.usuario?.nombre ?? 'Usuario' }}</p>
                  <p class="truncate text-[11px] text-base-content/55">{{ rolesTexto }}</p>
                </div>
              </div>
              <ul class="menu gap-0.5 mt-1">
                <li>
                  <button role="menuitem" @click="abrirModalPassword">
                    <AppIcon nombre="candado" class="h-4 w-4" />
                    Cambiar contraseña
                  </button>
                </li>
                <li>
                  <button role="menuitem" class="text-error hover:bg-error/10" @click="auth.logout()">
                    <AppIcon nombre="salir" class="h-4 w-4" />
                    Cerrar sesión
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </nav>

      <main class="flex-1 p-4 pb-20 lg:pb-4 bg-base-200">
        <RouterView />
      </main>

      <!-- ── Bottom navigation — solo mobile, el sidebar de siempre sigue en desktop ── -->
      <div class="dock lg:hidden">
        <RouterLink v-for="item in itemsPrincipales" :key="item.to" :to="item.to"
          :class="esActivo(item.to) ? 'dock-active' : ''">
          <AppIcon :nombre="item.icon" class="h-5 w-5" />
          <span class="dock-label">{{ item.label }}</span>
        </RouterLink>

        <label v-if="hayMasItems" for="drawer-toggle">
          <AppIcon nombre="mas" class="h-5 w-5" />
          <span class="dock-label">Más</span>
        </label>
      </div>
    </div>

    <!-- ── Sidebar ────────────────────────────────────────────────────────── -->
    <div class="drawer-side z-20">
      <label for="drawer-toggle" class="drawer-overlay" aria-label="Cerrar menú"></label>

      <aside class="side bg-base-100 border-r border-base-300 w-[17rem] min-h-full flex flex-col">
        <div class="h-[3px] bg-gradient-to-r from-dorado via-dorado-claro to-dorado" aria-hidden="true"></div>

        <div class="flex items-center gap-3 px-4 pt-4 pb-4 border-b border-base-300">
          <span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-content shadow-[0_10px_24px_-12px_rgba(26,60,94,0.7)]">
            <AppIcon nombre="escuela" class="h-5 w-5" />
          </span>
          <span class="min-w-0">
            <span class="block font-display text-[13px] font-bold leading-tight text-base-content truncate">U.E. Los Ángeles de Nazaria Ignacia</span>
            <span class="mt-0.5 block text-[11px] text-base-content/55">Oruro · Ley 070</span>
          </span>
        </div>

        <!-- Selector de vista — solo aparece si el usuario tiene más de un rol -->
        <div v-if="auth.roles.length > 1" class="px-3 pt-3">
          <label for="vista-activa" class="text-[10px] font-semibold uppercase tracking-[0.12em] text-base-content/50 px-1">Viendo como</label>
          <select id="vista-activa" class="select select-bordered w-full mt-1.5 border-base-300 focus:border-primary" :value="auth.vistaEfectiva ?? ''"
            @change="cambiarVista(($event.target as HTMLSelectElement).value)">
            <option v-for="r in auth.roles" :key="r" :value="r">{{ NOMBRE_ROL[r] }}</option>
          </select>
        </div>

        <!-- Ítems del menú, agrupados -->
        <nav class="flex-1 overflow-y-auto px-3 py-3" aria-label="Navegación principal">
          <ul class="menu menu-sm gap-0.5">
            <template v-for="grupo in grupos" :key="grupo ?? '_sin_grupo'">
              <li v-if="grupo"
                class="menu-title px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-base-content/45">
                <span>{{ grupo }}</span>
              </li>
              <li v-for="item in itemsDelGrupo(grupo)" :key="item.to">
                <RouterLink :to="item.to" class="side-link" :class="esActivo(item.to) ? 'side-active' : ''" :aria-current="esActivo(item.to) ? 'page' : undefined">
                  <AppIcon :nombre="item.icon" class="h-[18px] w-[18px] shrink-0" />
                  <span class="flex-1 min-w-0 truncate">{{ item.label }}</span>
                  <span v-if="badgeDe(item)" class="badge badge-error badge-sm tabular-nums">{{ badgeDe(item) }}</span>
                </RouterLink>
              </li>
            </template>
          </ul>
        </nav>

        <div class="border-t border-base-300 px-4 py-3">
          <p class="text-[11px] text-base-content/50">Sistema Educativo · v1.0</p>
          <p v-if="auth.vistaEfectiva" class="mt-0.5 text-[11px] font-medium text-base-content/70">Vista: {{ NOMBRE_ROL[auth.vistaEfectiva] }}</p>
        </div>
      </aside>
    </div>
  </div>

  <!-- ── Modal cambiar contraseña ─────────────────────────────────────────── -->
  <dialog ref="dialogoPassword" :open="modalPassword" class="modal modal-bottom sm:modal-middle"
    role="dialog" aria-modal="true" aria-labelledby="cambiar-pass-titulo" @keydown="atraparTab">
    <div class="modal-box">
      <h3 id="cambiar-pass-titulo" class="font-bold text-lg mb-4">Cambiar contraseña</h3>

      <div v-if="exitoPassword" class="space-y-4">
        <div role="alert" class="alert alert-success">
          <span>Contraseña actualizada correctamente</span>
        </div>
        <div class="modal-action">
          <button class="btn btn-primary" @click="cerrarModalPassword">Cerrar</button>
        </div>
      </div>

      <form v-else class="space-y-3" @submit.prevent="guardarPassword">
        <div v-if="errorPassword" role="alert" class="alert alert-error py-2 text-sm">
          <span>{{ errorPassword }}</span>
        </div>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Contraseña actual</legend>
          <input ref="inputPasswordActual" v-model="passwordActual" type="password" autocomplete="current-password"
            class="input input-bordered w-full" :disabled="cambiandoPassword" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Contraseña nueva (mín. 8 caracteres)</legend>
          <input v-model="passwordNueva" type="password" autocomplete="new-password" class="input input-bordered w-full"
            :disabled="cambiandoPassword" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Confirmar contraseña nueva</legend>
          <input v-model="passwordConfirma" type="password" autocomplete="new-password"
            class="input input-bordered w-full" :disabled="cambiandoPassword" />
        </fieldset>
        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="cambiandoPassword"
            @click="cerrarModalPassword">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="cambiandoPassword">
            <span v-if="cambiandoPassword" class="loading loading-spinner loading-sm"></span>
            Guardar
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="cerrarModalPassword"><button>cerrar</button></form>
  </dialog>
</template>

<style scoped>
.font-display { font-family: var(--font-display); }

/* Enlace lateral: indicador de activo a la izquierda, sin depender solo de color */
.side-link {
  position: relative;
  display: flex;
  width: 100%;
  border-radius: 0.75rem;
  font-weight: 500;
  min-height: 2.75rem;
  align-items: center;
}
/* Dock móvil: área táctil mínima + zona segura del notch */
.dock a, .dock label { min-height: 2.75rem; }
.dock { padding-bottom: max(0.5rem, env(safe-area-inset-bottom)); }
.side-link:hover { background: color-mix(in srgb, var(--color-primary) 7%, transparent); }
.side-link:focus-visible {
  outline: 2px solid var(--color-dorado);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(26, 60, 94, 0.28);
}
.side-link.side-active {
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  color: var(--color-primary);
  font-weight: 700;
}
.side-link.side-active::before {
  content: "";
  position: absolute;
  left: -12px;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 999px;
  background: var(--color-dorado);
}
.topbar :focus-visible {
  outline: 2px solid var(--color-dorado);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(26, 60, 94, 0.28);
}
.topbar ::selection { background: var(--color-dorado); color: var(--color-marino); }

.side nav::-webkit-scrollbar { width: 8px; }
.side nav::-webkit-scrollbar-thumb {
  background: var(--color-base-300);
  border-radius: 999px;
}
.side ::selection { background: var(--color-dorado); color: var(--color-marino); }

@media (prefers-reduced-motion: reduce) {
  .side * { transition: none !important; }
}
</style>