import api from '@/api/axios'

// Refleja GET /api/historial/:estudianteId (historial.service.ts)
export interface HistorialMateria {
  materia:       string
  codigo:        string
  campoSaber:    string | null
  notas:         Record<number, number | null>   // por id de trimestre
  promedioFinal: number | null
  resultado:     string
}

export interface HistorialGestion {
  gestionId:     number
  anio:          number
  inscripcionId: number
  curso:         { nivel: string; grado: number; paralelo: string; turno: string }
  estadoInscripcion: string
  resultado:     string
  notaMinima:    number
  trimestres:    { id: number; numero: number; nombre: string }[]
  materias:      HistorialMateria[]
  promedioPorTrimestre:   Record<number, number | null>
  promedioAnual:          number | null
  asistenciaPorTrimestre: Record<number, number | null>
  asistenciaGeneral:      number | null
}

export interface HistorialEstudiante {
  estudiante: { id: number; nombre: string; apellido: string; ci: string | null; rude: string | null }
  gestiones:  HistorialGestion[]
}

export const historialApi = {
  // Director / Secretaria (cualquiera), Estudiante (solo el suyo), Tutor (sus vinculados)
  get: (estudianteId: number) =>
    api.get<HistorialEstudiante>(`/historial/${estudianteId}`).then(r => r.data),

  // El estudiante autenticado ve el suyo sin conocer su id
  getMio: () =>
    api.get<HistorialEstudiante>('/historial/mio').then(r => r.data),

  // Certificado de calificaciones (PDF)
  pdf: (estudianteId: number) =>
    api.get<Blob>(`/historial/${estudianteId}/pdf`, { responseType: 'blob' }).then(r => r.data),
}