import api from '@/api/axios'
import type { Curso, Materia, Trimestre, Nivel, Turno, EstadoInscripcion } from '@/types'

// Helper de display — espeja curso.helper.ts → nombreCurso() del backend.
// Úsalo donde el backend te devuelva un curso SIN pasar por conNombre()
// (ej. los cursos embebidos dentro de Gestion — ver gestion.api.ts).
const NIVEL_TEXTO: Record<Nivel, string> = { PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
const TURNO_TEXTO: Record<Turno, string> = { MANANA: 'Mañana', TARDE: 'Tarde', NOCHE: 'Noche' }
export function nombreCurso(c: { nivel: Nivel; grado: number; paralelo: string; turno: Turno }): string {
  return `${c.grado}° ${NIVEL_TEXTO[c.nivel]} "${c.paralelo}" (${TURNO_TEXTO[c.turno]})`
}

// ── Cursos ────────────────────────────────────────────────────────────────────
// ✅ v6: no existe Curso.nombre como campo editable — se identifica por
// nivel+grado+paralelo+turno (único por gestión). El backend SIEMPRE
// devuelve "nombre" ya calculado en las respuestas de este módulo
// (curso.controller.ts sí llama a conNombre()).

export interface CursoPayload {
  nivel:      Nivel
  grado:      number
  paralelo:   string
  turno?:     Turno       // default MANANA en el backend
  capacidad?: number
  gestionId:  number
}

export interface CursoUpdatePayload {
  grado?:          number
  paralelo?:       string
  turno?:          Turno
  capacidad?:      number
  activo?:         boolean
  tutorDocenteId?: number | null
  // ⚠️ "nivel" NO se puede editar a propósito (rompería el historial
  // académico si el curso ya tiene inscripciones) — crea un curso nuevo.
}

export const cursoApi = {
  // Sin gestionId devuelve los de la gestión ACTIVA
  getAll: (gestionId?: number) =>
    api.get<Curso[]>('/cursos', { params: gestionId ? { gestionId } : undefined }).then(r => r.data),

  getById: (id: number) =>
    api.get<Curso & {
      inscripciones: Array<{ id: number; estadoInscripcion: EstadoInscripcion; estudiante: { id: number; nombre: string; apellido: string } }>
      asignaciones: Array<{ id: number; materia: { id: number; nombre: string }; docente: { id: number; nombre: string; apellido: string } }>
    }>(`/cursos/${id}`).then(r => r.data),

  create: (data: CursoPayload) =>
    api.post<Curso>('/cursos', data).then(r => r.data),

  update: (id: number, data: CursoUpdatePayload) =>
    api.put<Curso>(`/cursos/${id}`, data).then(r => r.data),

  // El backend rechaza el delete (400) si el curso tiene inscritos,
  // devolviendo el conteo en el mensaje de error.
  delete: (id: number) =>
    api.delete(`/cursos/${id}`).then(r => r.data),
}

// ── Materias ──────────────────────────────────────────────────────────────────
// Institucionales — no llevan gestionId. Lo que cambia cada gestión es la
// ASIGNACIÓN docente+materia+curso (DocenteMateriaCurso), no la materia en sí.

export const materiaApi = {
  getAll: () =>
    api.get<Materia[]>('/materias').then(r => r.data),

  getById: (id: number) =>
    api.get<Materia & {
      asignaciones: Array<{ id: number; docente: { nombre: string; apellido: string }; curso: Curso; gestion: { id: number; anio: number } }>
    }>(`/materias/${id}`).then(r => r.data),

  create: (data: { nombre: string; codigo: string; horasSemanales?: number; campoSaberId?: number }) =>
    api.post<Materia>('/materias', data).then(r => r.data),

  update: (id: number, data: { nombre?: string; horasSemanales?: number; campoSaberId?: number; activo?: boolean }) =>
    api.put<Materia>(`/materias/${id}`, data).then(r => r.data),

  // Rechaza el delete (400) si tiene asignaciones activas
  delete: (id: number) =>
    api.delete(`/materias/${id}`).then(r => r.data),
}

// ── Trimestres ────────────────────────────────────────────────────────────────
// numero: 1|2|3 (Reglamento de Evaluación boliviano). "cerrado" es
// irreversible — bloquea edición de notas/asistencia de ese período.

export const trimestreApi = {
  // Sin gestionId devuelve los de la gestión activa
  getAll: (gestionId?: number) =>
    api.get<Trimestre[]>('/trimestres', { params: gestionId ? { gestionId } : undefined }).then(r => r.data),

  getById: (id: number) =>
    api.get<Trimestre>(`/trimestres/${id}`).then(r => r.data),

  create: (data: { numero: 1 | 2 | 3; nombre: string; gestionId: number; fechaInicio?: string; fechaFin?: string }) =>
    api.post<Trimestre>('/trimestres', data).then(r => r.data),

  // No se puede editar un trimestre ya cerrado (400 del backend)
  update: (id: number, data: { nombre?: string; fechaInicio?: string; fechaFin?: string }) =>
    api.put<Trimestre>(`/trimestres/${id}`, data).then(r => r.data),

  // Acción irreversible. El backend valida que TODAS las materias tengan
  // promedio calculado para cada estudiante activo antes de dejarlo cerrar,
  // y devuelve el detalle de lo que falta si rechaza.
  cerrar: (id: number) =>
    api.post<{ message: string; trimestre: Trimestre }>(`/trimestres/${id}/cerrar`).then(r => r.data),

  // Qué falta para poder cerrar (solo lectura — no modifica nada).
  // Misma regla que `cerrar`, pero con nombres para el Dashboard.
  getPendientes: (id: number) =>
    api.get<PendientesCierre>(`/trimestres/${id}/pendientes`).then(r => r.data),
}

export interface PendienteFaltante {
  inscripcionId: number
  nombreCompleto: string
}

export interface PendienteMateria {
  docenteMateriaCursoId: number
  materia: { nombre: string; codigo: string }
  curso: { grado: number; paralelo: string; nivel: string }
  docente: string
  totalEsperados: number
  registrados: number
  faltantes: PendienteFaltante[]
}

export interface PendientesCierre {
  trimestre: { id: number; numero: number; nombre: string; cerrado: boolean; gestionId: number }
  resumen: {
    totalMaterias: number
    materiasCompletas: number
    totalEsperados: number
    totalRegistrados: number
    totalFaltantes: number
  }
  pendientes: PendienteMateria[]
}