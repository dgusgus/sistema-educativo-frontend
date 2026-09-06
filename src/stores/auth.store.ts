import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import api from '@/api/axios'
import type { UsuarioAuth, Rol } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  // ── Estado ──────────────────────────────────────────────────────────────────
  // Inicializar desde localStorage — sin esto, cada recarga cerraría la
  // sesión porque ref() empieza en null.
  const token = ref<string | null>(localStorage.getItem('token'))

  const usuario = ref<UsuarioAuth | null>(
    (() => {
      const guardado = localStorage.getItem('usuario')
      if (!guardado) return null
      try {
        return JSON.parse(guardado) as UsuarioAuth
      } catch {
        return null
      }
    })()
  )

  // ── Getters ──────────────────────────────────────────────────────────────────
  const estaAutenticado = computed(() => !!token.value && !!usuario.value)

  // ✅ v6: un usuario puede tener VARIOS roles a la vez (ej. Director que
  // también es Docente). Ya no existe un "rol" singular — todo lo que antes
  // comparaba contra un solo valor ahora es un arreglo.
  const roles = computed<Rol[]>(() => usuario.value?.roles ?? [])

  const esDirector   = computed(() => roles.value.includes('DIRECTOR'))
  const esSecretaria = computed(() => roles.value.includes('SECRETARIA'))
  const esDocente    = computed(() => roles.value.includes('DOCENTE'))
  const esEstudiante = computed(() => roles.value.includes('ESTUDIANTE'))
  const esTutor      = computed(() => roles.value.includes('TUTOR'))

  // true si tiene AL MENOS UNO de los roles pedidos (mismo criterio que
  // requireRol() en el backend — ver rbac.middleware.ts)
  function tieneRol(rolesPermitidos: Rol[]): boolean {
    return roles.value.some(r => rolesPermitidos.includes(r))
  }

  // ── Acciones ─────────────────────────────────────────────────────────────────
  async function login(username: string, password: string): Promise<void> {
    const { data } = await api.post<{ token: string; usuario: UsuarioAuth }>(
      '/auth/login',
      { username, password }
    )
    token.value   = data.token
    usuario.value = data.usuario

    localStorage.setItem('token', data.token)
    localStorage.setItem('usuario', JSON.stringify(data.usuario))
  }

  function logout(): void {
    token.value   = null
    usuario.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')

    // window.location.href evita el ciclo router → store → api → router
    window.location.href = '/login'
  }

  // Si el usuario cambia sus propios datos, el JWT sigue con el nombre
  // viejo hasta que expire — refreshMe() actualiza sin logout/login.
  async function refreshMe(): Promise<void> {
    if (!token.value) return
    const { data } = await api.get<{ id: number; username: string; roles: Rol[]; perfil: { nombre: string; apellido: string } | null }>('/auth/me')
    const nombre = data.perfil ? `${data.perfil.nombre} ${data.perfil.apellido}` : data.username
    usuario.value = { id: data.id, username: data.username, roles: data.roles, nombre }
    localStorage.setItem('usuario', JSON.stringify(usuario.value))
  }

  return {
    token, usuario,
    estaAutenticado, roles,
    esDirector, esSecretaria, esDocente, esEstudiante, esTutor,
    tieneRol, login, logout, refreshMe,
  }
})