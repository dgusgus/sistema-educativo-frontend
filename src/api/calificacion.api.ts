import api from '@/api/axios'

// Refleja GET /calificaciones (calificacion.controller.ts → getCalificaciones)
// ✅ Ya NO hay "nota" — el promedio sale de dimensiones (Ser/Saber/Hacer),
// cada una con sus propias ActividadEvaluativa/NotaActividad (ver
// evaluacion.api.ts para registrar notas).
export interface DimensionResumen {
  nombre:   string
  promedio: number
}

export interface PlanillaItem {
  inscripcionId:  number
  estudiante:     { id: number; nombre: string; apellido: string; ci: string }
  calificacionId: number | null
  promedio:       number | null   // = Calificacion.promedioTrimestral
  dimensiones:    DimensionResumen[]
  registrado:     boolean
}

export interface PlanillaResponse {
  dmc: {
    id:      number
    materia: { id: number; nombre: string }
    curso:   { id: number; nivel: string; grado: number; paralelo: string }
    gestion: { id: number; anio: number }
  }
  trimestre:        { id: number; numero: number; nombre: string; cerrado: boolean }
  trimestreCerrado: boolean
  totalEstudiantes: number
  notasRegistradas: number
  planilla:         PlanillaItem[]
}

export interface HistorialItem {
  id:               number
  promedioAnterior: number | null
  promedioNuevo:    number
  motivo:           string
  fecha:            string
  usuario:          { id: number; username: string; roles: string[] }
}

export const calificacionApi = {
  // GET /calificaciones?docenteMateriaCursoId=&trimestreId=
  getPlanilla: (docenteMateriaCursoId: number, trimestreId: number) =>
    api.get<PlanillaResponse>('/calificaciones', {
      params: { docenteMateriaCursoId, trimestreId },
    }).then(r => r.data),

  // ⚠️ Ya NO existe POST /calificaciones. Las notas se registran por
  // actividad evaluativa: evaluacionApi.registrarNotas() en evaluacion.api.ts.
  // El promedio (promedioTrimestral) se recalcula solo — nunca se escribe
  // directo mientras el trimestre está abierto.

  // Corrección MANUAL de un promedio — solo funciona con el trimestre
  // CERRADO, y exige "motivo" (queda en HistorialCalificacion, nunca
  // pisa el valor directo).
  corregirPromedio: (id: number, promedioTrimestral: number, motivo: string) =>
    api.put(`/calificaciones/${id}`, { promedioTrimestral, motivo }).then(r => r.data),

  // GET /calificaciones/estudiante — estudianteId/gestionId opcionales
  // si el usuario autenticado ES el estudiante (el backend resuelve
  // su propia inscripción por RBAC interno)
  getDeEstudiante: (params?: { estudianteId?: number; gestionId?: number }) =>
    api.get('/calificaciones/estudiante', { params }).then(r => r.data),

  getHistorial: (calificacionId: number) =>
    api.get<HistorialItem[]>(`/calificaciones/${calificacionId}/historial`).then(r => r.data),
}