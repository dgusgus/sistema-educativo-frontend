import api from '@/api/axios'
import type { DashboardResponse, ResultadoFinal, EstadoInscripcion, Nivel, Turno } from '@/types'

// ✅ el controller hace `{ ...inscripcion, estudiante: aplanarPersona(...) }`
// — devuelve la Inscripcion COMPLETA, no un subconjunto. Faltaban
// id/estadoInscripcion/resultado en la versión anterior de este tipo.
export interface ReporteAcademicoDetalle {
  id:                 number
  estudianteId:       number
  cursoId:            number
  gestionId:          number
  estadoInscripcion:  EstadoInscripcion
  resultado:          ResultadoFinal
  estudiante:         { nombre: string; apellido: string; ci: string }
  curso:              { nivel: Nivel; grado: number; paralelo: string; turno: Turno }
  calificaciones:     Array<{ promedioTrimestral: number | null; docenteMateriaCurso: { materia: { nombre: string } }; trimestre: { numero: number; nombre: string } }>
  promediosFinales:   Array<{ promedioFinal: number; resultado: ResultadoFinal; docenteMateriaCurso: { materia: { nombre: string } } }>
  resumenAsistencias: Array<{ porcentaje: number; docenteMateriaCurso: { materia: { nombre: string } } }>
}

export interface ReporteAcademicoResponse {
  filtros: { gestionId?: string; cursoId?: string; materiaId?: string; trimestreId?: string }
  estadisticas: {
    totalEstudiantes: number
    promedioGeneral:  number
    aprobados:        number
    reprobados:       number
    tasaAprobacion:   number
  }
  detalle: ReporteAcademicoDetalle[]
}

export const reporteApi = {
  // Solo Director — indicadores generales de la gestión activa
  getDashboard: () =>
    api.get<DashboardResponse>('/dashboard').then(r => r.data),

  getReporteAcademico: (params: { gestionId: number; cursoId?: number; materiaId?: number; trimestreId?: number }) =>
    api.get<ReporteAcademicoResponse>('/reportes/academico', { params }).then(r => r.data),

  getReporteAcademicoPdf: (params: { gestionId: number; cursoId?: number }) =>
    api.get('/reportes/academico/pdf', { params, responseType: 'blob' }).then(r => r.data as Blob),
}