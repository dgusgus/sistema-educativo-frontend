import api from '@/api/axios'
import type { Docente } from '@/types'

export interface DocentePayload {
  nombre: string
  apellido: string
  ci: string
  email?: string
  telefono?: string
  especialidad?: string
}

export const docenteApi = {
  getAll: (search?: string) =>
    api.get<Docente[]>('/docentes', { params: { search } }).then(r => r.data),

  create: (payload: DocentePayload) =>
    api.post<Docente>('/docentes', payload).then(r => r.data),

  update: (id: number, payload: Partial<DocentePayload>) =>
    api.put<Docente>(`/docentes/${id}`, payload).then(r => r.data),
}