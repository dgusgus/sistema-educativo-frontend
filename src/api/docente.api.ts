import api from '@/api/axios'
import type { Docente } from '@/types'

export interface DocentePayload {
  nombre:       string
  apellido:     string
  ci:           string
  email?:       string
  telefono?:    string
  especialidad?: string
}

export interface AsignacionPayload {
  materiaId: number
  cursoId:   number
  gestionId: number
}

export const docenteApi = {
  // GET /docentes — solo el Director ve la lista completa
  // ¿Por qué no usa el store de docentes?
  // El store de docentes (docente.store.ts) es para el rol DOCENTE —
  // carga "mis cursos" del docente autenticado.
  // Esta función es para el Director que gestiona todos los docentes.
  getAll: (params?: { search?: string; activo?: boolean }) =>
    api.get<Docente[]>('/docentes', { params }).then(r => r.data),

  getById: (id: number) =>
    api.get<Docente>(`/docentes/${id}`).then(r => r.data),

  // POST /docentes — crea solo el perfil (sin cuenta de acceso)
  // ¿Cuándo usar este vs POST /usuarios/con-perfil?
  // Este endpoint sirve si el Director quiere registrar al docente
  // primero y crear la cuenta más tarde (ej: el docente aún no tiene CI).
  // POST /usuarios/con-perfil crea ambos en una sola operación (lo más común).
  create: (payload: DocentePayload) =>
    api.post<Docente>('/docentes', payload).then(r => r.data),

  update: (id: number, payload: Partial<DocentePayload> & { activo?: boolean }) =>
    api.put<Docente>(`/docentes/${id}`, payload).then(r => r.data),

  // POST /docentes/:id/asignacion — asignar materia + curso al docente
  // ¿Por qué es una operación aparte y no parte de createDocente?
  // Porque las asignaciones cambian cada gestión (año escolar).
  // El docente existe una vez, pero su carga horaria se reasigna cada año.
  asignar: (docenteId: number, payload: AsignacionPayload) =>
    api.post(`/docentes/${docenteId}/asignacion`, payload).then(r => r.data),

  // DELETE /docentes/:id/asignacion/:asignacionId
  // ¿Para qué? Si se asignó la materia incorrecta o el docente cambia.
  removeAsignacion: (docenteId: number, asignacionId: number) =>
    api.delete(`/docentes/${docenteId}/asignacion/${asignacionId}`).then(r => r.data),
}