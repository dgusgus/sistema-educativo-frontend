import api, { TIMEOUT_IMPORT } from '@/api/axios'
import type { Docente, DocenteMateriaCurso } from '@/types'
import type { ResultadoImport } from '@/types/import'

export interface DocentePayload {
  ci:            string
  nombre:        string
  apellido:      string
  especialidad?: string
  telefono?:     string
  email?:        string
}

export interface AsignacionPayload {
  materiaId: number
  cursoId:   number
  gestionId: number
}

export const docenteApi = {
  // Solo el Director ve la lista completa. Distinto del rol DOCENTE
  // autenticado, que usa GET /docentes/mis-cursos (ver docente.store.ts).
  getAll: (params?: { search?: string; activo?: boolean }) =>
    api.get<Docente[]>('/docentes', { params }).then(r => r.data),

  getById: (id: number) =>
    api.get<Docente>(`/docentes/${id}`).then(r => r.data),

  // Crea solo el perfil (sin cuenta de acceso) — para vincular cuenta
  // después con POST /usuarios/con-perfil o PUT /usuarios/:id/vincular.
  create: (payload: DocentePayload) =>
    api.post<Docente>('/docentes', payload).then(r => r.data),

  update: (id: number, payload: Partial<DocentePayload> & { activo?: boolean }) =>
    api.put<Docente>(`/docentes/${id}`, payload).then(r => r.data),

  // Las asignaciones cambian cada gestión — por eso es una operación
  // aparte y no parte de create(). El backend valida que el curso
  // pertenezca a la gestión enviada.
  asignar: (docenteId: number, payload: AsignacionPayload) =>
    api.post<DocenteMateriaCurso & { advertencia?: string }>(
      `/docentes/${docenteId}/asignacion`, payload
    ).then(r => r.data),

  removeAsignacion: (docenteId: number, asignacionId: number) =>
    api.delete(`/docentes/${docenteId}/asignacion/${asignacionId}`).then(r => r.data),

  importar: (archivo: File) => {
    const form = new FormData()
    form.append('archivo', archivo)
    return api.post<ResultadoImport>('/docentes/import', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: TIMEOUT_IMPORT }).then(r => r.data)
  },
  exportar: () => api.get<Blob>('/docentes/export', { responseType: 'blob' }).then(r => r.data),
  plantilla: () => api.get<Blob>('/docentes/plantilla', { responseType: 'blob' }).then(r => r.data),
}