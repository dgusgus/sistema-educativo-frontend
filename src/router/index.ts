import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import type { Rol } from '@/types'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    roles?: Rol[]
  }
}

// ─── Helper: ruta de inicio según rol ────────────────────────────────────────
// ✅ v6: un usuario puede tener varios roles a la vez — homeSegunRol ahora
// recibe el arreglo completo y elige el primero según esta prioridad.
// Orden pensado por alcance del rol (quien administra ve primero su panel
// de administración, no el de docente aunque también lo sea).
const PRIORIDAD: Rol[] = ['DIRECTOR', 'SECRETARIA', 'DOCENTE', 'ESTUDIANTE', 'TUTOR']

const HOMES: Record<Rol, string> = {
  DIRECTOR:   '/director/dashboard',
  SECRETARIA: '/secretaria/estudiantes',
  DOCENTE:    '/docente/asistencia',
  ESTUDIANTE: '/estudiante/perfil',
  TUTOR:      '/tutor/seguimiento',
}

export function homeSegunRol(roles: Rol[]): string {
  const principal = PRIORIDAD.find(r => roles.includes(r)) ?? roles[0]
  return principal ? HOMES[principal] : '/login'
}

// ─── Rutas ────────────────────────────────────────────────────────────────────

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [

    { path: '/', redirect: '/login' },

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
        { path: 'dashboard',    name: 'director-dashboard',    component: () => import('@/views/director/DashboardView.vue') },
        { path: 'docentes',     name: 'director-docentes',     component: () => import('@/views/director/DocentesView.vue') },
        { path: 'directores',   name: 'director-directores',   component: () => import('@/views/director/Directoresview.vue') },
        { path: 'secretarias',  name: 'director-secretarias',  component: () => import('@/views/director/Secretariasview.vue') },
        { path: 'reportes',     name: 'director-reportes',     component: () => import('@/views/director/ReportesView.vue') },
        { path: 'estructura',   name: 'director-estructura',   component: () => import('@/views/director/EstructuraView.vue') },
        { path: 'dimensiones',  name: 'director-dimensiones',  component: () => import('@/views/director/Dimensionesview.vue') },
        { path: 'gestiones',    name: 'director-gestiones',    component: () => import('@/views/director/GestionesView.vue') },
        { path: 'institucion',  name: 'director-institucion',  component: () => import('@/views/director/InstitucionView.vue') },
      ],
    },

    // ── SECRETARIA (también accesible para DIRECTOR — backend ya lo permite
    // en estudiante/inscripcion/pago/boletin/tutor.routes.ts) ────────────────
    {
      path: '/secretaria',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true, roles: ['SECRETARIA', 'DIRECTOR'] },
      children: [
        // Estudiantes + Inscripciones fusionadas — ver comentario al
        // principio de EstudiantesView.vue
        { path: 'estudiantes',      name: 'secretaria-estudiantes',   component: () => import('@/views/secretaria/EstudiantesView.vue') },
        { path: 'tutores',          name: 'secretaria-tutores',       component: () => import('@/views/secretaria/Tutoresview.vue') },
        { path: 'pagos',            name: 'secretaria-pagos',         component: () => import('@/views/secretaria/PagosView.vue') },
        { path: 'boletines',        name: 'secretaria-boletines',     component: () => import('@/views/secretaria/BoletinesView.vue') },
        { path: 'correccion-notas', name: 'correccion-notas',         component: () => import('@/views/secretaria/CorreccionNotasView.vue') },
        { path: 'promocion',        name: 'promocion',                component: () => import('@/views/secretaria/Promocionview.vue') },
      ],
    },

    // ── DOCENTE ───────────────────────────────────────────────────────────────
    {
      path: '/docente',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true, roles: ['DOCENTE'] },
      children: [
        { path: 'asistencia',     name: 'docente-asistencia',     component: () => import('@/views/docente/AsistenciaView.vue') },
        { path: 'calificaciones', name: 'docente-calificaciones', component: () => import('@/views/docente/CalificacionesView.vue') },
        { path: 'bitacora',       name: 'docente-bitacora',       component: () => import('@/views/docente/BitacoraView.vue') },
      ],
    },

    // ── ESTUDIANTE ────────────────────────────────────────────────────────────
    {
      path: '/estudiante',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true, roles: ['ESTUDIANTE'] },
      children: [
        { path: 'perfil', name: 'estudiante-perfil', component: () => import('@/views/estudiante/MiPerfilView.vue') },
      ],
    },

    // ── TUTOR ─────────────────────────────────────────────────────────────────
    {
      path: '/tutor',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true, roles: ['TUTOR'] },
      children: [
        { path: 'seguimiento', name: 'tutor-seguimiento', component: () => import('@/views/tutor/SeguimientoView.vue') },
      ],
    },

    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') },
  ],
})

// ─── Navigation Guard global ──────────────────────────────────────────────────
router.beforeEach((to) => {
  const auth = useAuthStore()

  // 1. Ruta pública (ej: login) → si ya tiene sesión, a su dashboard
  if (to.meta.requiresAuth === false) {
    if (auth.estaAutenticado && auth.roles.length > 0) {
      return { path: homeSegunRol(auth.roles) }
    }
    return true
  }

  // 2. Ruta protegida sin sesión → al login
  if (!auth.estaAutenticado) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  // 3. Ruta con roles específicos → basta con tener UNO de ellos
  //    (mismo criterio que requireRol() en el backend)
  if (to.meta.roles && to.meta.roles.length > 0) {
    if (!auth.tieneRol(to.meta.roles) && auth.roles.length > 0) {
      return { path: homeSegunRol(auth.roles) }
    }
  }

  return true
})

export default router