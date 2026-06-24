import api from '@/api/axios'

// Refleja exactamente lo que devuelve GET /calificaciones (calificacion.controller.ts)
export interface PlanillaItem {
  inscripcionId:  number
  estudiante:     { id: number; nombre: string; apellido: string; ci: string }
  calificacionId: number | null   // null si aún no tiene nota
  nota:           number | null
  promedio:       number | null
  registrado:     boolean
}

export interface PlanillaResponse {
  dmc: {
    id:      number
    materia: { id: number; nombre: string }
    curso:   { id: number; nombre: string }
    gestion: { id: number; anio: number }
  }
  trimestre:        { id: number; numero: number; nombre: string; cerrado: boolean }
  trimestreCerrado: boolean
  totalEstudiantes: number
  notasRegistradas: number
  planilla:         PlanillaItem[]
}

export interface NotaPayload {
  inscripcionId: number
  nota:          number
}

export const calificacionApi = {
  // GET /calificaciones?docenteMateriaCursoId=&trimestreId=
  getPlanilla: (docenteMateriaCursoId: number, trimestreId: number) =>
    api.get<PlanillaResponse>('/calificaciones', {
      params: { docenteMateriaCursoId, trimestreId },
    }).then(r => r.data),

  // POST /calificaciones
  guardarPlanilla: (docenteMateriaCursoId: number, trimestreId: number, notas: NotaPayload[]) =>
    api.post('/calificaciones', { docenteMateriaCursoId, trimestreId, notas }).then(r => r.data),

  // PUT /calificaciones/:id
  actualizarNota: (id: number, nota: number) =>
    api.put(`/calificaciones/${id}`, { nota }).then(r => r.data),

  // GET /calificaciones/estudiante
  getDeEstudiante: (estudianteId: number, gestionId: number) =>
    api.get('/calificaciones/estudiante', {
      params: { estudianteId, gestionId },
    }).then(r => r.data),
}