import api from '@/api/axios'
import type { ResultadoFinal, Nivel, Turno } from '@/types'

// ── Boletín General (JSON, para pintar tabla en pantalla) ────────────────────
export interface BoletinGeneralMateria {
  docenteMateriaCursoId: number
  materiaId: number
  nombre: string
  codigo: string
  campoSaber: string | null
}

export interface BoletinGeneralNotaMateria {
  docenteMateriaCursoId: number
  notasPorTrimestre: Record<number, number | null>
  promedioAnual: number | null
  resultado: ResultadoFinal
}

export interface BoletinGeneralEstudiante {
  inscripcionId: number
  estudianteId: number
  rude: string | null
  nombreCompleto: string
  materias: BoletinGeneralNotaMateria[]
  promedioGeneralAnual: number | null
  promedioGeneralPorTrimestre: Record<number, number | null>
}

export interface BoletinGeneralResponse {
  curso: { id: number; nivel: Nivel; grado: number; paralelo: string; turno: Turno; gestionId: number; anioGestion: number }
  trimestres: { id: number; numero: number; nombre: string }[]
  materias: BoletinGeneralMateria[]
  estudiantes: BoletinGeneralEstudiante[]
}

// ── Mejores Estudiantes (JSON) ────────────────────────────────────────────────
export interface MejorEstudianteItem {
  puesto: number
  inscripcionId: number
  nombreCompleto: string
  promedio: number
}

export interface MejoresEstudiantesResponse {
  curso: BoletinGeneralResponse['curso']
  trimestres: BoletinGeneralResponse['trimestres']
  porTrimestre: Record<number, MejorEstudianteItem[]>
  anual: MejorEstudianteItem[]
}

// El backend devuelve un blob PDF en estos tres
export const boletinApi = {
  // GET /boletin/general/:cursoId → JSON, todas las materias x todos los trimestres
  getGeneral: (cursoId: number) =>
    api.get<BoletinGeneralResponse>(`/boletin/general/${cursoId}`).then(r => r.data),

  // GET /boletin/mejores/:cursoId?limite= → JSON, ranking por trimestre + anual
  getMejores: (cursoId: number, limite = 3) =>
    api.get<MejoresEstudiantesResponse>(`/boletin/mejores/${cursoId}`, { params: { limite } }).then(r => r.data),

  // GET /boletin/:estudianteId/:trimestreId → PDF individual (1 trimestre)
  getIndividual: (estudianteId: number, trimestreId: number) =>
    api.get<Blob>(`/boletin/${estudianteId}/${trimestreId}`, {
      responseType: 'blob',
    }).then(r => r.data),

  // GET /boletin/curso/:cursoId/:trimestreId → PDF masivo (1 trimestre, todo el curso)
  getMasivo: (cursoId: number, trimestreId: number) =>
    api.get<Blob>(`/boletin/curso/${cursoId}/${trimestreId}`, {
      responseType: 'blob',
    }).then(r => r.data),

  // GET /boletin/libreta/:estudianteId/:gestionId → PDF libreta anual (los 3 trimestres + anual)
  getLibreta: (estudianteId: number, gestionId: number) =>
    api.get<Blob>(`/boletin/libreta/${estudianteId}/${gestionId}`, {
      responseType: 'blob',
    }).then(r => r.data),
}

// Helper: recibe un blob y lo descarga en el navegador
export function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}