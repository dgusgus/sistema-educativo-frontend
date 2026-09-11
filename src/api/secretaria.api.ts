import api from '@/api/axios'
import type { Secretaria } from '@/types'

// ⚠️ Secretaria.usuarioId NO es nullable — siempre nace con cuenta,
// igual que Director. No existe flujo "solo perfil".
export interface SecretariaConCuentaPayload {
  ci:        string
  nombre:    string
  apellido:  string
  telefono?: string
  email?:    string
  username:  string
  password:  string
}

export const secretariaApi = {
  getAll: () =>
    api.get<Secretaria[]>('/secretarias').then(r => r.data),

  getById: (id: number) =>
    api.get<Secretaria>(`/secretarias/${id}`).then(r => r.data),

  crearConCuenta: (payload: SecretariaConCuentaPayload) =>
    api.post<{ secretaria: Secretaria; credenciales: { username: string; password: string; nota: string } }>(
      '/secretarias/con-cuenta', payload
    ).then(r => r.data),

  update: (id: number, data: { ci?: string; nombre?: string; apellido?: string; telefono?: string; email?: string; activo?: boolean }) =>
    api.put<Secretaria>(`/secretarias/${id}`, data).then(r => r.data),

  asignarCuenta: (id: number, usuarioId: number) =>
    api.put(`/secretarias/${id}/cuenta`, { usuarioId }).then(r => r.data),
}