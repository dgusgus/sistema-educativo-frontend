import api from '@/api/axios'
import type { DimensionEvaluacion, ActividadEvaluativa, NotaActividadPayload } from '@/types'

// ARCHIVO NUEVO — cubre evaluacion.controller.ts / evaluacion.routes.ts, que
// no existían en el frontend v5. Es la pieza que reemplaza el viejo
// "POST /calificaciones" de nota única: ahora una nota es
// NotaActividad (dentro de una ActividadEvaluativa, dentro de una
// DimensionEvaluacion), y recalcularCalificacion() arma el promedio.

export interface DimensionPayload {
  gestionId:       number
  nombre:          string
  puntajeMaximo:   number
  // ⚠️ fracción (0.45 = 45%), NO porcentaje entero — el backend rechaza
  // valores > 9.999 (es Decimal(4,3) en el schema)
  pesoEnPromedio?: number
  orden?:          number
  esAutoevaluada?: boolean
}

export interface ActividadEvaluativaPayload {
  docenteMateriaCursoId: number
  trimestreId:           number
  dimensionId:           number
  nombre:                string
  fecha?:                string
  puntajeMaximo:         number
  peso?:                 number   // fracción 0–9.999, igual que arriba
  esRecuperatorio?:      boolean
}

export const evaluacionApi = {
  // Dimensiones (Ser/Saber/Hacer/Decidir) — las define Dirección por gestión
  getDimensiones: (gestionId: number) =>
    api.get<DimensionEvaluacion[]>('/dimensiones', { params: { gestionId } }).then(r => r.data),

  createDimension: (data: DimensionPayload) =>
    api.post<DimensionEvaluacion>('/dimensiones', data).then(r => r.data),

  updateDimension: (id: number, data: Partial<Omit<DimensionPayload, 'gestionId'>>) =>
    api.put<DimensionEvaluacion>(`/dimensiones/${id}`, data).then(r => r.data),

  // Rechaza (400) si la dimensión ya tiene actividades evaluativas registradas
  deleteDimension: (id: number) =>
    api.delete(`/dimensiones/${id}`).then(r => r.data),

  // Actividades evaluativas (lo que el docente califica dentro de una dimensión)
  getActividadesEvaluativas: (docenteMateriaCursoId: number, trimestreId: number) =>
    api.get<ActividadEvaluativa[]>('/actividades-evaluativas', {
      params: { docenteMateriaCursoId, trimestreId },
    }).then(r => r.data),

  createActividadEvaluativa: (data: ActividadEvaluativaPayload) =>
    api.post<ActividadEvaluativa>('/actividades-evaluativas', data).then(r => r.data),

  // Baja lógica (activo: false) — nunca se borra físicamente porque puede
  // tener notas asociadas que sustentan un promedio ya calculado.
  desactivarActividadEvaluativa: (id: number) =>
    api.delete(`/actividades-evaluativas/${id}`).then(r => r.data),

  // El docente registra las notas de TODA una actividad de una sola vez.
  // Dispara recalcularCalificacion() para cada estudiante — la respuesta
  // trae el promedioTrimestral ya actualizado por inscripción.
  registrarNotas: (actividadEvaluativaId: number, notas: NotaActividadPayload[]) =>
    api.post<{ registradas: number; resultados: Array<{ inscripcionId: number; promedioTrimestral: number | null }> }>(
      `/actividades-evaluativas/${actividadEvaluativaId}/notas`, { notas }
    ).then(r => r.data),
  
  // Notas ya registradas de una actividad — para precargar el formulario
  getNotasActividad: (actividadEvaluativaId: number) =>
    api.get<Array<{ inscripcionId: number; nota: number; observacion: string | null }>>(
      `/actividades-evaluativas/${actividadEvaluativaId}/notas`
    ).then(r => r.data),
}