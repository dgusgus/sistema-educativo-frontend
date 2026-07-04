import api from '@/api/axios'
import type { Estudiante, Inscripcion, EstadoInscripcion, ResultadoFinal } from '@/types'

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface EstudiantePayload {
  nombre: string
  apellido: string
  ci: string
  fechaNacimiento?: string
  direccion?: string        // ✅ el backend usa 'direccion', no 'email'/'telefono'
}

export interface InscripcionPayload {
  estudianteId: number
  cursoId: number
  gestionId: number
}

// ¿Por qué payload separado para estado?
// Porque cambiar el estado de una inscripción (RETIRADA, TRANSFERIDA)
// es una acción administrativa distinta a crear la inscripción.
// Endpoint: PUT /inscripciones/:id/estado
export interface CambiarEstadoPayload {
  estadoInscripcion: EstadoInscripcion
  fechaRetiro?: string
  observaciones?: string
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const estudianteApi = {
  // GET /estudiantes — lista con filtros opcionales
  getAll: (params?: { search?: string; cursoId?: number; gestionId?: number; estadoInscripcion?: EstadoInscripcion }) =>
    api.get<Estudiante[]>('/estudiantes', { params }).then(r => r.data),

  // GET /estudiantes/:id — detalle con inscripciones y tutores
  getById: (id: number) =>
    api.get<Estudiante>(`/estudiantes/${id}`).then(r => r.data),

  // POST /estudiantes — crea perfil (sin cuenta de acceso)
  create: (payload: EstudiantePayload) =>
    api.post<Estudiante>('/estudiantes', payload).then(r => r.data),

  // PUT /estudiantes/:id
  update: (id: number, payload: Partial<EstudiantePayload> & { activo?: boolean }) =>
    api.put<Estudiante>(`/estudiantes/${id}`, payload).then(r => r.data),

  // ── Inscripciones ──────────────────────────────────────────────────────────

  // POST /inscripciones
  inscribir: (payload: InscripcionPayload) =>
    api.post<Inscripcion>('/inscripciones', payload).then(r => r.data),

  // GET /inscripciones/:id — detalle con pagos
  getInscripcion: (id: number) =>
    api.get<Inscripcion>(`/inscripciones/${id}`).then(r => r.data),

  // PUT /inscripciones/:id/estado — registrar retiro o transferencia
  // ¿Para qué? Si un estudiante se retira a mitad del año, no se borra
  // la inscripción — se marca como RETIRADA para mantener el historial.
  cambiarEstado: (id: number, payload: CambiarEstadoPayload) =>
    api.put<Inscripcion>(`/inscripciones/${id}/estado`, payload).then(r => r.data),

  // POST /inscripciones/:id/resultado — PROMOVIDO o REPROBADO al cerrar el año
  // Requisito del backend: todos los trimestres deben estar cerrados primero.
  registrarResultado: (id: number, resultado: ResultadoFinal, observaciones?: string) =>
    api.post<Inscripcion>(`/inscripciones/${id}/resultado`, { resultado, observaciones }).then(r => r.data),
}