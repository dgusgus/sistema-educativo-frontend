<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useGestionStore } from '@/stores/gestion.store'

const auth    = useAuthStore()
const route   = useRoute()
const gestion = useGestionStore()

// Import condicional del store del docente
import { useDocenteStore } from '@/stores/docente.store'
const docenteStore = useDocenteStore()

onMounted(() => {
  // Siempre cargamos la gestión activa
  gestion.cargar()
  // Si es docente, cargamos sus asignaciones automáticamente
  if (auth.esDocente) docenteStore.cargar()
})

// ─── Menú según rol ───────────────────────────────────────────────────────────
//
// Cada ítem tiene: label, ruta named, e ícono SVG inline.
// computed() hace que si el rol cambia, el menú se recalcula solo.
// ✅ v6: un usuario puede tener varios roles a la vez, así que el menú
// combina los de TODOS sus roles (sin duplicar rutas repetidas).

interface MenuItem {
  label: string
  to: string
  icon: string
}

const menusPorRol: Record<string, MenuItem[]> = {
  DIRECTOR: [
    { label: 'Dashboard',   to: '/director/dashboard',  icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { label: 'Docentes',    to: '/director/docentes',   icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { label: 'Estructura',  to: '/director/estructura', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { label: 'Usuarios',    to: '/director/usuarios',   icon: 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z' },
    { label: 'Reportes',    to: '/director/reportes',   icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { label: 'Gestiones',   to: '/director/gestiones',  icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  ],
  SECRETARIA: [
    { label: 'Estudiantes',   to: '/secretaria/estudiantes',   icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { label: 'Inscripciones', to: '/secretaria/inscripciones', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { label: 'Pagos',         to: '/secretaria/pagos',         icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z' },
    { label: 'Boletines',     to: '/secretaria/boletines',     icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
  ],
  DOCENTE: [
    { label: 'Asistencia',     to: '/docente/asistencia',     icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { label: 'Calificaciones', to: '/docente/calificaciones', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  ],
  ESTUDIANTE: [
    { label: 'Mi Perfil', to: '/estudiante/perfil', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  ],
  TUTOR: [
    { label: 'Seguimiento', to: '/tutor/seguimiento', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
  ],
}

const menuItems = computed<MenuItem[]>(() => {
  const items = auth.roles.flatMap(r => menusPorRol[r] ?? [])
  // dedup por "to" — por si dos roles del mismo usuario compartieran ruta
  const vistos = new Set<string>()
  return items.filter(i => (vistos.has(i.to) ? false : (vistos.add(i.to), true)))
})

// Compara la ruta activa para resaltar el ítem del menú
function esActivo(path: string): boolean {
  return route.path.startsWith(path)
}

// Etiqueta legible de los roles en el dropdown (ej. "Director, Docente")
const rolesTexto = computed(() => {
  const nombres: Record<string, string> = {
    DIRECTOR: 'Director', SECRETARIA: 'Secretaria', DOCENTE: 'Docente',
    ESTUDIANTE: 'Estudiante', TUTOR: 'Tutor',
  }
  return auth.roles.map(r => nombres[r] ?? r).join(', ')
})
</script>

<template>
  <div class="drawer lg:drawer-open min-h-screen">
    <input id="drawer-toggle" type="checkbox" class="drawer-toggle" />

    <!-- ── Contenido principal ────────────────────────────────────────────── -->
    <div class="drawer-content flex flex-col">

      <!-- Navbar -->
      <nav class="navbar bg-base-100 border-b border-base-300 sticky top-0 z-10">
        <!-- Botón hamburguesa (solo mobile) -->
        <div class="flex-none lg:hidden">
          <label for="drawer-toggle" class="btn btn-square btn-ghost">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </label>
        </div>

        <!-- Título de la ruta actual -->
        <div class="flex-1 px-2">
          <span class="text-lg font-semibold text-base-content">
            {{ menuItems.find(i => esActivo(i.to))?.label ?? 'Sistema Educativo' }}
          </span>
        </div>

        <!-- Usuario + logout -->
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
              <li class="menu-title text-xs opacity-60">
                {{ rolesTexto }}
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

      <!-- Vista actual (el <RouterView> hijo) -->
      <main class="flex-1 p-4 bg-base-200">
        <RouterView />
      </main>
    </div>

    <!-- ── Sidebar ────────────────────────────────────────────────────────── -->
    <div class="drawer-side z-20">
      <label for="drawer-toggle" class="drawer-overlay"></label>

      <aside class="bg-base-100 border-r border-base-300 w-64 min-h-full flex flex-col">

        <!-- Logo / nombre del colegio -->
        <div class="p-4 border-b border-base-300">
          <h1 class="font-bold text-sm leading-tight text-base-content">
            Unidad Educativa
          </h1>
          <p class="text-xs text-primary font-semibold mt-0.5">
            Los Ángeles de Nazaria Ignacia
          </p>
        </div>

        <!-- Ítems del menú -->
        <ul class="menu menu-sm p-3 flex-1 gap-1">
          <li v-for="item in menuItems" :key="item.to">
            <RouterLink
              :to="item.to"
              :class="esActivo(item.to) ? 'active' : ''"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="item.icon" />
              </svg>
              {{ item.label }}
            </RouterLink>
          </li>
        </ul>

        <!-- Versión al fondo -->
        <div class="p-4 border-t border-base-300 text-xs text-base-content/40">
          Sistema Educativo v1.0
        </div>
      </aside>
    </div>
  </div>
</template>