import api from '@/api/axios'
import type { Tutor } from '@/types'
import type { ResultadoImport } from '@/types/import'

export interface TutorPayload {
  ci:                string
  nombre:            string
  apellido:          string
  telefono?:         string
  email?:            string
  ocupacion?:        string
  gradoInstruccion?: string
}

// ⚠️ El parentesco NO va acá — es un dato de la relación tutor↔estudiante
// (TutorEstudiante), no del perfil del tutor. Se define recién al vincular.
export interface VincularEstudiantePayload {
  parentesco:          string
  esTutorPrincipal?:   boolean
  esApoderado?:        boolean
  viveConEstudiante?:  boolean
}

export const tutorApi = {
  getAll: (search?: string) =>
    api.get<Tutor[]>('/tutores', { params: search ? { search } : undefined }).then(r => r.data),

  getById: (id: number) =>
    api.get<Tutor>(`/tutores/${id}`).then(r => r.data),

  create: (payload: TutorPayload) =>
    api.post<Tutor>('/tutores', payload).then(r => r.data),

  update: (id: number, payload: Partial<TutorPayload>) =>
    api.put<Tutor>(`/tutores/${id}`, payload).then(r => r.data),

  vincularEstudiante: (tutorId: number, estudianteId: number, payload: VincularEstudiantePayload) =>
    api.post(`/tutores/${tutorId}/vincular/${estudianteId}`, payload).then(r => r.data),

  desvincularEstudiante: (tutorId: number, estudianteId: number) =>
    api.delete(`/tutores/${tutorId}/vincular/${estudianteId}`).then(r => r.data),

  importar: (archivo: File) => {
    const form = new FormData()
    form.append('archivo', archivo)
    return api.post<ResultadoImport>('/tutores/import', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
  exportar: () => api.get<Blob>('/tutores/export', { responseType: 'blob' }).then(r => r.data),
  plantilla: () => api.get<Blob>('/tutores/plantilla', { responseType: 'blob' }).then(r => r.data),
}

