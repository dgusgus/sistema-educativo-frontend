import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import type { Rol } from '@/types'

// ─── Tipado del meta de rutas ─────────────────────────────────────────────────
//
// Vue Router permite agregar datos arbitrarios a cada ruta en "meta".
// Declaramos la forma de esos datos acá para que TypeScript nos ayude.
// requiresAuth: la ruta necesita sesión activa
// roles: qué roles pueden entrar (vacío = cualquier rol autenticado)

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    roles?: Rol[]
  }
}

// ─── Helper: ruta de inicio según rol ────────────────────────────────────────
//
// Cada rol tiene su propia "home". Cuando alguien entra a "/" o
// intenta ir a una ruta que no le corresponde, lo mandamos acá.

export function homeSegunRol(rol: Rol): string {
  const homes: Record<Rol, string> = {
    DIRECTOR:   '/director/dashboard',
    SECRETARIA: '/secretaria/estudiantes',
    DOCENTE:    '/docente/asistencia',
    ESTUDIANTE: '/estudiante/perfil',
    TUTOR:      '/tutor/seguimiento',
  }
  return homes[rol]
}

// ─── Rutas ────────────────────────────────────────────────────────────────────

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [

    // ── Raíz ──────────────────────────────────────────────────────────────────
    {
      path: '/',
      redirect: '/login',
    },

    // ── Auth (sin layout de dashboard) ────────────────────────────────────────
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: { requiresAuth: false },
    },

    // ── DIRECTOR ──────────────────────────────────────────────────────────────
    {
      path: '/director',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true, roles: ['DIRECTOR'] },
      children: [
        {
          path: 'dashboard',
          name: 'director-dashboard',
          component: () => import('@/views/director/DashboardView.vue'),
        },
        {
          path: 'docentes',
          name: 'director-docentes',
          component: () => import('@/views/director/DocentesView.vue'),
        },
        {
          path: 'reportes',
          name: 'director-reportes',
          component: () => import('@/views/director/ReportesView.vue'),
        },
        {
          path: 'usuarios',
          name: 'director-usuarios',
          component: () => import('@/views/director/UsuariosView.vue'),
        },
        {
          path: 'estructura',
          name: 'director-estructura',
          component: () => import('@/views/director/EstructuraView.vue'),
        },
        {
          path: 'gestiones',
          name: 'director-gestiones',
          component: () => import('@/views/director/GestionesView.vue'),
        },
      ],
    },

    // ── SECRETARIA ────────────────────────────────────────────────────────────
    {
      path: '/secretaria',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true, roles: ['SECRETARIA'] },
      children: [
        {
          path: 'estudiantes',
          name: 'secretaria-estudiantes',
          component: () => import('@/views/secretaria/EstudiantesView.vue'),
        },
        {
          path: 'inscripciones',
          name: 'secretaria-inscripciones',
          component: () => import('@/views/secretaria/InscripcionesView.vue'),
        },
        {
          path: 'pagos',
          name: 'secretaria-pagos',
          component: () => import('@/views/secretaria/PagosView.vue'),
        },
        {
          path: 'boletines',
          name: 'secretaria-boletines',
          component: () => import('@/views/secretaria/BoletinesView.vue'),
        },
      ],
    },

    // ── DOCENTE ───────────────────────────────────────────────────────────────
    {
      path: '/docente',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true, roles: ['DOCENTE'] },
      children: [
        {
          path: 'asistencia',
          name: 'docente-asistencia',
          component: () => import('@/views/docente/AsistenciaView.vue'),
        },
        {
          path: 'calificaciones',
          name: 'docente-calificaciones',
          component: () => import('@/views/docente/CalificacionesView.vue'),
        },
      ],
    },

    // ── ESTUDIANTE ────────────────────────────────────────────────────────────
    {
      path: '/estudiante',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true, roles: ['ESTUDIANTE'] },
      children: [
        {
          path: 'perfil',
          name: 'estudiante-perfil',
          component: () => import('@/views/estudiante/MiPerfilView.vue'),
        },
      ],
    },

    // ── TUTOR ─────────────────────────────────────────────────────────────────
    {
      path: '/tutor',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true, roles: ['TUTOR'] },
      children: [
        {
          path: 'seguimiento',
          name: 'tutor-seguimiento',
          component: () => import('@/views/tutor/SeguimientoView.vue'),
        },
      ],
    },

    // ── 404 ───────────────────────────────────────────────────────────────────
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
})

// ─── Navigation Guard global ──────────────────────────────────────────────────
//
// Se ejecuta ANTES de cada cambio de ruta.
// El orden importa:
//   1. Ruta pública → si ya está autenticado, redirigir a su home
//   2. Ruta protegida sin sesión → al login (guardando ?redirect=)
//   3. Rol sin permiso → a su propia home

router.beforeEach((to) => {
  const auth = useAuthStore()

  // 1. Ruta pública (ej: login) → si ya tiene sesión, a su dashboard
  if (to.meta.requiresAuth === false) {
    if (auth.estaAutenticado && auth.rol) {
      return { path: homeSegunRol(auth.rol) }
    }
    return true
  }

  // 2. Ruta protegida sin sesión → al login
  if (!auth.estaAutenticado) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  // 3. Ruta con roles específicos → verificar permiso
  if (to.meta.roles && to.meta.roles.length > 0) {
    if (!auth.tieneRol(to.meta.roles) && auth.rol) {
      return { path: homeSegunRol(auth.rol) }
    }
  }

  return true
})

export default router