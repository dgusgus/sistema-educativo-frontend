<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useGestionStore } from '@/stores/gestion.store'
import { useDocenteStore } from '@/stores/docente.store'
import { reporteApi } from '@/api/reporte.api'
import type { Rol } from '@/types'

const auth    = useAuthStore()
const route   = useRoute()
const router  = useRouter()
const gestion = useGestionStore()
const docenteStore = useDocenteStore()

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
  icon: string
  grupo?: string
}

const menusPorRol: Record<Rol, MenuItem[]> = {
  DIRECTOR: [
    { label: 'Dashboard', to: '/director/dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },

    { label: 'Estructura',    to: '/director/estructura',         grupo: 'Académico', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { label: 'Dimensiones',   to: '/director/dimensiones',        grupo: 'Académico', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14' },
    { label: 'Docentes',      to: '/director/docentes',           grupo: 'Académico', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { label: 'Estudiantes',   to: '/secretaria/estudiantes',      grupo: 'Académico', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { label: 'Tutores',       to: '/secretaria/tutores',          grupo: 'Académico', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { label: 'Corrección de Notas', to: '/secretaria/correccion-notas', grupo: 'Académico', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
    { label: 'Promoción de Gestión', to: '/secretaria/promocion', grupo: 'Académico', icon: 'M13 7l5 5m0 0l-5 5m5-5H6' },

    { label: 'Directores',   to: '/director/directores',    grupo: 'Administración', icon: 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z' },
    { label: 'Secretarias',  to: '/director/secretarias',   grupo: 'Administración', icon: 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z' },
    { label: 'Pagos',        to: '/secretaria/pagos',       grupo: 'Administración', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z' },
    { label: 'Boletines',    to: '/secretaria/boletines',   grupo: 'Administración', icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
    { label: 'Institución',  to: '/director/institucion',   grupo: 'Administración', icon: 'M3 21h18M5 21V7l8-4v18M19 21V10l-6-3m-4 6h.01M9 16h.01M13 12h.01M13 16h.01' },

    { label: 'Reportes',  to: '/director/reportes',  icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { label: 'Gestiones', to: '/director/gestiones', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
    { label: 'Horarios', to: '/director/horarios', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  ],
  SECRETARIA: [
    { label: 'Estudiantes', to: '/secretaria/estudiantes', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { label: 'Tutores',     to: '/secretaria/tutores',     icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { label: 'Pagos',       to: '/secretaria/pagos',       icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z' },
    { label: 'Boletines',   to: '/secretaria/boletines',   icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
    { label: 'Corrección de Notas', to: '/secretaria/correccion-notas', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
    { label: 'Promoción de Gestión', to: '/secretaria/promocion', icon: 'M13 7l5 5m0 0l-5 5m5-5H6' },
  ],
  DOCENTE: [
    { label: 'Asistencia',     to: '/docente/asistencia',     icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { label: 'Calificaciones', to: '/docente/calificaciones', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
    { label: 'Bitácora',       to: '/docente/bitacora',       icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  ],
  ESTUDIANTE: [
    { label: 'Mi Perfil', to: '/estudiante/perfil', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  ],
  TUTOR: [
    { label: 'Seguimiento', to: '/tutor/seguimiento', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
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
const modalPassword    = ref(false)
const passwordActual   = ref('')
const passwordNueva    = ref('')
const passwordConfirma = ref('')
const cambiandoPassword = ref(false)
const errorPassword    = ref<string | null>(null)
const exitoPassword     = ref(false)

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
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </label>
        </div>

        <div class="flex-1 px-2">
          <span class="text-lg font-semibold text-base-content">
            {{ menuItems.find(i => esActivo(i.to))?.label ?? 'Sistema Educativo' }}
          </span>
        </div>

        <div class="flex-none gap-2">
          <div class="dropdown dropdown-end">
            <div tabindex="0" role="button" class="btn btn-ghost gap-2">
              <div class="avatar placeholder">
                <div class="bg-primary text-primary-content rounded-full w-8">
                  <span class="text-xs">{{ auth.usuario?.nombre?.charAt(0) ?? '?' }}</span>
                </div>
              </div>
              <span class="hidden sm:inline text-sm">{{ auth.usuario?.nombre }}</span>
            </div>
            <ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box z-10 w-52 p-2 shadow-lg border border-base-300">
              <li class="menu-title text-xs opacity-60">{{ rolesTexto }}</li>
              <li>
                <button @click="abrirModalPassword">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  Cambiar contraseña
                </button>
              </li>
              <li>
                <button class="text-error" @click="auth.logout()">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Cerrar sesión
                </button>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      <main class="flex-1 p-4 bg-base-200">
        <RouterView />
      </main>
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
          <select
            class="select select-bordered select-sm w-full mt-1"
            :value="auth.vistaEfectiva ?? ''"
            @change="cambiarVista(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="r in auth.roles" :key="r" :value="r">{{ NOMBRE_ROL[r] }}</option>
          </select>
        </div>

        <!-- Ítems del menú, agrupados -->
        <ul class="menu menu-sm p-3 flex-1 gap-1 overflow-y-auto">
          <template v-for="grupo in grupos" :key="grupo ?? '_sin_grupo'">
            <li v-if="grupo" class="menu-title text-[10px] uppercase tracking-wide text-base-content/40 mt-2 first:mt-0">
              <span>{{ grupo }}</span>
            </li>
            <li v-for="item in itemsDelGrupo(grupo)" :key="item.to">
              <RouterLink :to="item.to" :class="esActivo(item.to) ? 'active' : ''">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="item.icon" />
                </svg>
                <span class="flex-1">{{ item.label }}</span>
                <span v-if="badgeDe(item)" class="badge badge-error badge-sm">{{ badgeDe(item) }}</span>
              </RouterLink>
            </li>
          </template>
        </ul>

        <div class="p-4 border-t border-base-300 text-xs text-base-content/40">
          Sistema Educativo v1.0
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
          <input v-model="passwordNueva" type="password" autocomplete="new-password"
            class="input input-bordered w-full" :disabled="cambiandoPassword" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Confirmar contraseña nueva</legend>
          <input v-model="passwordConfirma" type="password" autocomplete="new-password"
            class="input input-bordered w-full" :disabled="cambiandoPassword" />
        </fieldset>
        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="cambiandoPassword" @click="modalPassword = false">Cancelar</button>
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