import api from '@/api/axios'
import type { Estudiante, Inscripcion } from '@/types'

export interface EstudiantePayload {
  nombre: string
  apellido: string
  ci: string
  fechaNacimiento?: string
  email?: string
  telefono?: string
}

export interface InscripcionPayload {
  estudianteId: number
  cursoId: number
  gestionId: number
}

export const estudianteApi = {
  getAll: (params?: { search?: string; cursoId?: number; gestionId?: number }) =>
    api.get<Estudiante[]>('/estudiantes', { params }).then(r => r.data),

  create: (payload: EstudiantePayload) =>
    api.post<Estudiante>('/estudiantes', payload).then(r => r.data),

  update: (id: number, payload: Partial<EstudiantePayload>) =>
    api.put<Estudiante>(`/estudiantes/${id}`, payload).then(r => r.data),

  inscribir: (payload: InscripcionPayload) =>
    api.post<Inscripcion>('/inscripciones', payload).then(r => r.data),

  getInscripcion: (id: number) =>
    api.get<Inscripcion>(`/inscripciones/${id}`).then(r => r.data),
}