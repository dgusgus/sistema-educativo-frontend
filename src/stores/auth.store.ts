import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import api from '@/api/axios'
import type { UsuarioAuth, Rol } from '@/types/index.ts'

export const useAuthStore = defineStore('auth', () => {
  // ── Estado ──────────────────────────────────────────────────────────────────
  // ¿Por qué inicializar desde localStorage?
  // Sin esto, cada recarga de página cerraría la sesión automáticamente
  // porque ref() empieza en null. Al leer de localStorage, el usuario
  // sigue "logueado" aunque haya recargado el navegador.
  const token = ref<string | null>(localStorage.getItem('token'))

  const usuario = ref<UsuarioAuth | null>(
    (() => {
      const guardado = localStorage.getItem('usuario')
      if (!guardado) return null
      try {
        return JSON.parse(guardado) as UsuarioAuth
      } catch {
        // JSON corrupto (ej: localStorage editado manualmente) → empezamos limpio
        return null
      }
    })()
  )

  // ── Getters ──────────────────────────────────────────────────────────────────
  const estaAutenticado = computed(() => !!token.value && !!usuario.value)
  const rol             = computed(() => usuario.value?.rol ?? null)

  // ¿Por qué helpers individuales (esDirector, esDocente, etc.) además de tieneRol()?
  // En el template de DashboardLayout se usan en v-if directamente:
  // v-if="auth.esDirector" es más legible que v-if="auth.tieneRol(['DIRECTOR'])".
  // tieneRol() sirve para guards del router donde necesitamos comparar un array.
  const esDirector   = computed(() => rol.value === 'DIRECTOR')
  const esSecretaria = computed(() => rol.value === 'SECRETARIA')
  const esDocente    = computed(() => rol.value === 'DOCENTE')
  const esEstudiante = computed(() => rol.value === 'ESTUDIANTE')
  const esTutor      = computed(() => rol.value === 'TUTOR')

  function tieneRol(roles: Rol[]): boolean {
    return rol.value !== null && roles.includes(rol.value)
  }

  // ── Acciones ─────────────────────────────────────────────────────────────────
  async function login(username: string, password: string): Promise<void> {
    const { data } = await api.post<{ token: string; usuario: UsuarioAuth }>(
      '/auth/login',
      { username, password }
    )
    token.value   = data.token
    usuario.value = data.usuario

    // ¿Por qué guardar en localStorage además del ref?
    // El ref vive en memoria — se pierde al recargar la página.
    // El localStorage persiste entre recargas pero no es reactivo.
    // Necesitamos ambos: el ref para que Vue reaccione a los cambios,
    // y el localStorage para sobrevivir recargas.
    localStorage.setItem('token', data.token)
    localStorage.setItem('usuario', JSON.stringify(data.usuario))
  }

  function logout(): void {
    token.value   = null
    usuario.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')

    // ¿Por qué window.location.href en lugar de router.push('/login')?
    // Si importáramos el router acá crearíamos una dependencia circular:
    // router importa auth.store → auth.store importa router → loop infinito.
    // window.location.href lo evita completamente y además limpia el estado
    // reactivo de Vue al hacer una recarga completa de la página.
    window.location.href = '/login'
  }

  // ¿Para qué refreshMe?
  // Si el Director cambia sus propios datos de perfil (nombre, etc.),
  // el JWT sigue teniendo el nombre viejo hasta que expire.
  // refreshMe actualiza el usuario en memoria y localStorage sin
  // necesitar hacer logout/login.
  async function refreshMe(): Promise<void> {
    if (!token.value) return
    const { data } = await api.get<UsuarioAuth>('/auth/me')
    usuario.value = data
    localStorage.setItem('usuario', JSON.stringify(data))
  }

  return {
    token, usuario,
    estaAutenticado, rol,
    esDirector, esSecretaria, esDocente, esEstudiante, esTutor,
    tieneRol, login, logout, refreshMe,
  }
})