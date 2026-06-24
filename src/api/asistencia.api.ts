import api from '@/api/axios'
import type { EstadoAsistencia } from '@/types'

// Refleja GET /asistencia (asistencia.controller.ts → getAsistencia)
export interface ListaItem {
  inscripcionId:  number
  estudiante:     { id: number; nombre: string; apellido: string; ci: string }
  asistenciaId:   number | null   // null = aún no registrado
  estado:         EstadoAsistencia | null
  justificacion:  string | null
  registrado:     boolean
}

export interface AsistenciaDiaResponse {
  dmc: {
    id:      number
    materia: { id: number; nombre: string }
    curso:   { id: number; nombre: string }
    gestion: { id: number; anio: number }
  }
  fecha:            string
  totalEstudiantes: number
  yaRegistrado:     boolean
  lista:            ListaItem[]
}

export interface AsistenciaPayload {
  docenteMateriaCursoId: number
  fecha:                 string
  registros: Array<{ inscripcionId: number; estado: EstadoAsistencia }>
}

export const asistenciaApi = {
  getDelDia: (docenteMateriaCursoId: number, fecha: string) =>
    api.get<AsistenciaDiaResponse>('/asistencia', {
      params: { docenteMateriaCursoId, fecha },
    }).then(r => r.data),

  registrar: (payload: AsistenciaPayload) =>
    api.post('/asistencia', payload).then(r => r.data),

  actualizar: (id: number, estado: EstadoAsistencia, justificacion?: string) =>
    api.put(`/asistencia/${id}`, { estado, justificacion }).then(r => r.data),
}