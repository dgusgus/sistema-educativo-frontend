import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useRouter } from 'vue-router'
import api from '@/api/axios'
import type { UsuarioAuth, Rol } from '@/types/index.ts'

// ─── Auth Store ───────────────────────────────────────────────────────────────
//
// Responsabilidades:
//   1. Guardar token y datos del usuario autenticado
//   2. Persistir en localStorage para sobrevivir recargas
//   3. Exponer helpers de rol para que layouts y guards puedan
//      preguntar "¿puede este usuario ver esta sección?"

export const useAuthStore = defineStore('auth', () => {
  // ── Estado ──────────────────────────────────────────────────────────────────
  //
  // Inicializamos desde localStorage si ya había una sesión activa.
  // Así el usuario no pierde la sesión al recargar la página.

  const token = ref<string | null>(localStorage.getItem('token'))

  const usuario = ref<UsuarioAuth | null>(
    (() => {
      const guardado = localStorage.getItem('usuario')
      if (!guardado) return null
      try {
        return JSON.parse(guardado) as UsuarioAuth
      } catch {
        // Si el JSON está corrupto, ignoramos y empezamos limpio
        return null
      }
    })(),
  )

  // ── Getters (computed) ───────────────────────────────────────────────────────

  // ¿Hay sesión activa?
  const estaAutenticado = computed(() => !!token.value && !!usuario.value)

  // El rol del usuario actual (o null si no hay sesión)
  const rol = computed(() => usuario.value?.rol ?? null)

  // Helpers por rol — los usan los guards del router y el sidebar
  // para mostrar/ocultar secciones según quién está logueado
  const esDirector    = computed(() => rol.value === 'DIRECTOR')
  const esSecretaria  = computed(() => rol.value === 'SECRETARIA')
  const esDocente     = computed(() => rol.value === 'DOCENTE')
  const esEstudiante  = computed(() => rol.value === 'ESTUDIANTE')
  const esTutor       = computed(() => rol.value === 'TUTOR')

  // ¿Tiene alguno de los roles indicados?
  // Uso: tieneRol(['DIRECTOR', 'SECRETARIA'])
  function tieneRol(roles: Rol[]): boolean {
    return rol.value !== null && roles.includes(rol.value)
  }

  // ── Acciones ─────────────────────────────────────────────────────────────────

  // login: llama al backend, guarda el token y los datos del usuario
  async function login(username: string, password: string): Promise<void> {
    // POST /api/auth/login → { token, usuario }
    const { data } = await api.post<{ token: string; usuario: UsuarioAuth }>(
      '/auth/login',
      { username, password },
    )

    // Guardamos en memoria (reactivo → todos los componentes se actualizan)
    token.value = data.token
    usuario.value = data.usuario

    // Guardamos en localStorage (persiste entre recargas)
    localStorage.setItem('token', data.token)
    localStorage.setItem('usuario', JSON.stringify(data.usuario))
  }

  // logout: limpia todo y manda al login
  function logout(): void {
    token.value = null
    usuario.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')

    // Usamos window.location para evitar importar el router acá
    // (mismo motivo que en axios.ts — evitar dependencias circulares)
    window.location.href = '/login'
  }

  // refreshMe: actualiza los datos del usuario desde el backend.
  // Útil si el director cambia datos de su propio perfil.
  async function refreshMe(): Promise<void> {
    if (!token.value) return
    const { data } = await api.get<UsuarioAuth>('/auth/me')
    usuario.value = data
    localStorage.setItem('usuario', JSON.stringify(data))
  }

  return {
    // Estado
    token,
    usuario,
    // Getters
    estaAutenticado,
    rol,
    esDirector,
    esSecretaria,
    esDocente,
    esEstudiante,
    esTutor,
    // Acciones
    tieneRol,
    login,
    logout,
    refreshMe,
  }
})