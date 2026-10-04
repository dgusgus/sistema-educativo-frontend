import api from '@/api/axios'
import type { EstadoAsistencia } from '@/types'

// Refleja GET /asistencia (asistencia.controller.ts → getAsistencia)
export interface ListaItem {
  inscripcionId: number
  estudiante:    { id: number; nombre: string; apellido: string; ci: string }
  asistenciaId:  number | null
  estado:        EstadoAsistencia | null
  justificacion: string | null
  registrado:    boolean
}

export interface AsistenciaDiaResponse {
  dmc: {
    id:      number
    materia: { id: number; nombre: string }
    curso:   { id: number; nivel: string; grado: number; paralelo: string }
    gestion: { id: number; anio: number }
  }
  fecha:            string
  totalEstudiantes: number
  yaRegistrado:     boolean
  lista:            ListaItem[]
}

// ✅ trimestreId es OBLIGATORIO en v6 — antes se inferia por rango de fechas
export interface AsistenciaPayload {
  docenteMateriaCursoId: number
  trimestreId:           number
  fecha:                 string
  registros: Array<{ inscripcionId: number; estado: EstadoAsistencia; justificacion?: string }>
}

export interface AlertaAsistencia {
  inscripcionId: number
  estudiante:    string
  porcentaje:    number
}

export interface ResumenPorMateria {
  docenteMateriaCursoId: number
  trimestreId:           number
  totalClases:           number
  totalPresente:         number
  totalAusente:          number
  totalRetraso:          number
  totalJustificado:      number
  porcentaje:            number
  docenteMateriaCurso: {
    materia: { id: number; nombre: string }
    docente?: { id: number; nombre: string; apellido: string }   // el reporte del curso no lo incluye
  }
  trimestre: { id: number; numero: number; nombre: string }
}

export interface ReporteCursoItem {
  estudiante:      { id: number; nombre: string; apellido: string; ci: string }
  inscripcionId:   number
  promedioGeneral: number
  alertaCritica:   boolean   // true si promedioGeneral < 80
  detalleXMateria: ResumenPorMateria[]
}

export const asistenciaApi = {
  getDelDia: (docenteMateriaCursoId: number, fecha: string) =>
    api.get<AsistenciaDiaResponse>('/asistencia', {
      params: { docenteMateriaCursoId, fecha },
    }).then(r => r.data),

  registrar: (payload: AsistenciaPayload) =>
    api.post<{ registrados: number; fecha: string; alertas: AlertaAsistencia[] }>(
      '/asistencia', payload
    ).then(r => r.data),

  actualizar: (id: number, estado: EstadoAsistencia, justificacion?: string) =>
    api.put(`/asistencia/${id}`, { estado, justificacion }).then(r => r.data),

  // ⚠️ Faltaban en el archivo original — el backend sí los expone.

  // Historial crudo (registro por registro). Sin estudianteId, el propio
  // backend resuelve el estudiante/tutor autenticado vía RBAC interno.
  getHistorial: (params?: { estudianteId?: number; docenteMateriaCursoId?: number }) =>
    api.get('/asistencia/historial', { params }).then(r => r.data),

  // % de asistencia por materia de una inscripción — para el estudiante/tutor
  getResumen: (inscripcionId: number) =>
    api.get<ResumenPorMateria[]>(`/asistencia/resumen/${inscripcionId}`).then(r => r.data),

  // Consolidado del curso completo — solo Director/Secretaria
  getReporteCurso: (cursoId: number, gestionId: number) =>
    api.get<{ cursoId: number; gestionId: number; totalEstudiantes: number; estudiantesEnRiesgo: number; reporte: ReporteCursoItem[] }>(
      `/asistencia/reporte/${cursoId}`, { params: { gestionId } }
    ).then(r => r.data),
}