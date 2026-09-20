<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
    { label: 'Pagos', to: '/secretaria/pagos', grupo: 'Administración', icon: 'pagos' },
    { label: 'Boletines', to: '/secretaria/boletines', grupo: 'Administración', icon: 'documento' },
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

function abrirModalPassword() {
  passwordActual.value = ''
  passwordNueva.value = ''
  passwordConfirma.value = ''
  errorPassword.value = null
  exitoPassword.value = false
  modalPassword.value = true
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
      <nav class="navbar bg-base-100 border-b border-base-300 sticky top-0 z-10">
        <div class="flex-none lg:hidden">
          <label for="drawer-toggle" class="btn btn-square btn-ghost">
            <AppIcon nombre="menu" class="h-5 w-5" />
          </label>
        </div>

        <div class="flex-1 px-2">
          <span class="text-lg font-semibold text-base-content">
            {{menuItems.find(i => esActivo(i.to))?.label ?? 'Sistema Educativo'}}
          </span>
        </div>

        <div class="flex-none gap-2">
          <!-- ── agregar dentro de <div class="flex-none gap-2">, ANTES del dropdown de usuario ── -->
          <button type="button" class="btn btn-ghost btn-circle"
            :aria-label="tema === 'colegio' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'" @click="alternar">
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
            <div tabindex="0" role="button" class="btn btn-ghost gap-2">
              <div class="avatar placeholder">
                <div class="bg-primary text-primary-content rounded-full w-8">
                  <span class="text-xs">{{ auth.usuario?.nombre?.charAt(0) ?? '?' }}</span>
                </div>
              </div>
              <span class="hidden sm:inline text-sm">{{ auth.usuario?.nombre }}</span>
            </div>
            <ul tabindex="0"
              class="dropdown-content menu bg-base-100 rounded-box z-10 w-52 p-2 shadow-lg border border-base-300">
              <li class="menu-title text-xs opacity-60">{{ rolesTexto }}</li>
              <li>
                <button @click="abrirModalPassword">
                  <AppIcon nombre="candado" class="h-4 w-4" />
                  Cambiar contraseña
                </button>
              </li>
              <li>
                <button class="text-error" @click="auth.logout()">
                  <AppIcon nombre="salir" class="h-4 w-4" />
                  Cerrar sesión
                </button>
              </li>
            </ul>
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
      <label for="drawer-toggle" class="drawer-overlay"></label>

      <aside class="bg-base-100 border-r border-base-300 w-64 min-h-full flex flex-col">

        <div class="p-4 border-b border-base-300">
          <h1 class="font-bold text-sm leading-tight text-base-content">Unidad Educativa</h1>
          <p class="text-xs text-primary font-semibold mt-0.5">Los Ángeles de Nazaria Ignacia</p>
        </div>

        <!-- Selector de vista — solo aparece si el usuario tiene más de un rol -->
        <div v-if="auth.roles.length > 1" class="px-3 pt-3">
          <label class="text-[10px] uppercase tracking-wide text-base-content/40 px-1">Viendo como</label>
          <select class="select select-bordered select-sm w-full mt-1" :value="auth.vistaEfectiva ?? ''"
            @change="cambiarVista(($event.target as HTMLSelectElement).value)">
            <option v-for="r in auth.roles" :key="r" :value="r">{{ NOMBRE_ROL[r] }}</option>
          </select>
        </div>

        <!-- Ítems del menú, agrupados -->
        <ul class="menu menu-sm p-3 flex-1 gap-1 overflow-y-auto">
          <template v-for="grupo in grupos" :key="grupo ?? '_sin_grupo'">
            <li v-if="grupo"
              class="menu-title text-[10px] uppercase tracking-wide text-base-content/40 mt-2 first:mt-0">
              <span>{{ grupo }}</span>
            </li>
            <li v-for="item in itemsDelGrupo(grupo)" :key="item.to">
              <RouterLink :to="item.to" :class="esActivo(item.to) ? 'active' : ''">
                <AppIcon :nombre="item.icon" class="h-4 w-4" />
                <span class="flex-1">{{ item.label }}</span>
                <span v-if="badgeDe(item)" class="badge badge-error badge-sm">{{ badgeDe(item) }}</span>
              </RouterLink>
            </li>
          </template>
        </ul>

        <div class="p-4 border-t border-base-300 flex items-center justify-between">
          <span class="text-xs text-base-content/40">Sistema Educativo v1.0</span>
          <button type="button" class="btn btn-ghost btn-sm btn-circle"
            :aria-label="tema === 'colegio' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'" @click="alternar">
            <svg v-if="tema === 'colegio'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none"
              viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>
        </div>
      </aside>
    </div>
  </div>

  <!-- ── Modal cambiar contraseña ─────────────────────────────────────────── -->
  <dialog :open="modalPassword" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">Cambiar contraseña</h3>

      <div v-if="exitoPassword" class="space-y-4">
        <div role="alert" class="alert alert-success">
          <span>Contraseña actualizada correctamente</span>
        </div>
        <div class="modal-action">
          <button class="btn btn-primary" @click="modalPassword = false">Cerrar</button>
        </div>
      </div>

      <form v-else class="space-y-3" @submit.prevent="guardarPassword">
        <div v-if="errorPassword" role="alert" class="alert alert-error py-2 text-sm">
          <span>{{ errorPassword }}</span>
        </div>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Contraseña actual</legend>
          <input v-model="passwordActual" type="password" autocomplete="current-password"
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
            @click="modalPassword = false">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="cambiandoPassword">
            <span v-if="cambiandoPassword" class="loading loading-spinner loading-sm"></span>
            Guardar
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalPassword = false"><button>cerrar</button></form>
  </dialog>
</template>