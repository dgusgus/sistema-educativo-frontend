import api from '@/api/axios'
import type { BitacoraClase } from '@/types'

// Cubre actividad.controller.ts / actividad.routes.ts — el "tema del día"
// de cada clase (BitacoraClase, no confundir con ActividadEvaluativa de
// evaluacion.api.ts, que sí lleva nota).

export interface BitacoraPayload {
  docenteMateriaCursoId: number
  trimestreId?:           number
  fecha?:                 string
  tema:                   string
  descripcion?:           string
  tareaAsignada?:         string
}

export const bitacoraApi = {
  getAll: (docenteMateriaCursoId: number, params?: { desde?: string; hasta?: string }) =>
    api.get<BitacoraClase[]>('/actividades', {
      params: { docenteMateriaCursoId, ...params },
    }).then(r => r.data),

  getById: (id: number) =>
    api.get<BitacoraClase>(`/actividades/${id}`).then(r => r.data),

  create: (payload: BitacoraPayload) =>
    api.post<BitacoraClase>('/actividades', payload).then(r => r.data),

  update: (id: number, payload: { tema?: string; descripcion?: string; tareaAsignada?: string }) =>
    api.put<BitacoraClase>(`/actividades/${id}`, payload).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/actividades/${id}`).then(r => r.data),
}