import api from '@/api/axios'
import type { Rol } from '@/types'

export interface Usuario {
  id:       number
  username: string
  rol:      Rol
  activo:   boolean
  creadoEn: string
  perfil: { id: number; nombre: string; apellido: string; ci: string } | null
}

export interface UsuarioPayload {
  username: string
  password: string
  rol:      Rol
}

export const usuarioApi = {
  getAll: (params?: { rol?: Rol; activo?: boolean }) =>
    api.get<Usuario[]>('/usuarios', { params }).then(r => r.data),

  create: (payload: UsuarioPayload) =>
    api.post<Usuario>('/usuarios', payload).then(r => r.data),

  update: (id: number, data: { rol?: Rol; activo?: boolean }) =>
    api.put<Usuario>(`/usuarios/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/usuarios/${id}`).then(r => r.data),

  resetearPassword: (id: number, nuevaPassword: string) =>
    api.put(`/usuarios/${id}/resetear`, { nuevaPassword }).then(r => r.data),

  vincularPerfil: (id: number, data: { docenteId?: number; estudianteId?: number; tutorId?: number }) =>
    api.put(`/usuarios/${id}/vincular`, data).then(r => r.data),
}