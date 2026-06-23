import api from '@/api/axios'
import type { RegistroAsistencia, ResumenAsistencia, EstadoAsistencia } from '@/types'

export interface RegistroPayload {
  inscripcionId: number
  estado: EstadoAsistencia
}

export interface AsistenciaPayload {
  docenteMateriaCursoId: number
  fecha: string           // 'YYYY-MM-DD'
  registros: RegistroPayload[]
}

export const asistenciaApi = {
  getDelDia: (docenteMateriaCursoId: number, fecha: string) =>
    api.get<RegistroAsistencia[]>('/asistencia', {
      params: { docenteMateriaCursoId, fecha },
    }).then(r => r.data),

  registrar: (payload: AsistenciaPayload) =>
    api.post<RegistroAsistencia[]>('/asistencia', payload).then(r => r.data),

  justificar: (id: number, justificacion: string) =>
    api.put(`/asistencia/${id}`, { justificacion }).then(r => r.data),

  getResumen: (inscripcionId: number) =>
    api.get<ResumenAsistencia>(`/asistencia/resumen/${inscripcionId}`).then(r => r.data),

  getReporte: (cursoId: number, gestionId?: number) =>
    api.get(`/asistencia/reporte/${cursoId}`, { params: { gestionId } }).then(r => r.data),
}