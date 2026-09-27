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

// ── Detalle por estudiante (JSON, dimensiones + actividades) ─────────────────
export interface DetalleActividad {
  actividadEvaluativaId: number
  nombre: string
  nota: number | null
  puntajeMaximo: number
}

export interface DetalleDimension {
  dimensionId: number
  nombre: string
  promedio: number | null
  actividades: DetalleActividad[]
}

export interface DetalleTrimestre {
  trimestreId: number
  numero: number
  nombre: string
  dimensiones: DetalleDimension[]
  total: number | null
}

export interface DetalleMateria {
  docenteMateriaCursoId: number
  nombre: string
  campoSaber: string | null
  trimestres: DetalleTrimestre[]
  promedioAnual: number | null
  resultado: ResultadoFinal
}

export interface DetalleBoletinEstudiante {
  inscripcionId: number
  estudianteId: number
  nombreCompleto: string
  curso: BoletinGeneralResponse['curso']
  materias: DetalleMateria[]
}

export const boletinApi = {
  getGeneral: (cursoId: number) =>
    api.get<BoletinGeneralResponse>(`/boletin/general/${cursoId}`).then(r => r.data),

  getMejores: (cursoId: number, limite = 3) =>
    api.get<MejoresEstudiantesResponse>(`/boletin/mejores/${cursoId}`, { params: { limite } }).then(r => r.data),

  // GET /boletin/detalle/:inscripcionId → JSON, dimensiones + actividades por trimestre
  getDetalle: (inscripcionId: number) =>
    api.get<DetalleBoletinEstudiante>(`/boletin/detalle/${inscripcionId}`).then(r => r.data),

  getIndividual: (estudianteId: number, trimestreId: number) =>
    api.get<Blob>(`/boletin/${estudianteId}/${trimestreId}`, { responseType: 'blob' }).then(r => r.data),

  getMasivo: (cursoId: number, trimestreId: number) =>
    api.get<Blob>(`/boletin/curso/${cursoId}/${trimestreId}`, { responseType: 'blob' }).then(r => r.data),

  getLibreta: (estudianteId: number, gestionId: number) =>
    api.get<Blob>(`/boletin/libreta/${estudianteId}/${gestionId}`, { responseType: 'blob' }).then(r => r.data),
}

export function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}