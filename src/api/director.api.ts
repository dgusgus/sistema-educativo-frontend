import api from '@/api/axios'
import type { Director } from '@/types'

// ⚠️ Director.usuarioId NO es nullable — siempre nace con cuenta. No existe
// un flujo "solo perfil" como en Docente/Estudiante/Tutor.
export interface DirectorConCuentaPayload {
  ci:         string
  nombre:     string
  apellido:   string
  telefono?:  string
  email?:     string
  gestionId?: number
  username:   string
  password:   string
}

export const directorApi = {
  getAll: () =>
    api.get<Director[]>('/directores').then(r => r.data),

  getActivo: () =>
    api.get<Director | null>('/directores/activo').then(r => r.data),

  getById: (id: number) =>
    api.get<Director>(`/directores/${id}`).then(r => r.data),

  crearConCuenta: (payload: DirectorConCuentaPayload) =>
    api.post<{ director: Director; credenciales: { username: string; password: string; nota: string } }>(
      '/directores/con-cuenta', payload
    ).then(r => r.data),

  update: (id: number, data: { ci?: string; nombre?: string; apellido?: string; telefono?: string; email?: string; activo?: boolean }) =>
    api.put<Director>(`/directores/${id}`, data).then(r => r.data),

  // Reasigna el director a OTRA cuenta ya existente con rol DIRECTOR
  // (caso raro — ej. la cuenta original se dio de baja)
  asignarCuenta: (id: number, usuarioId: number) =>
    api.put(`/directores/${id}/cuenta`, { usuarioId }).then(r => r.data),
}