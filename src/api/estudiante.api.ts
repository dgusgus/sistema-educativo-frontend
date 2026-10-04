import api, { TIMEOUT_IMPORT } from '@/api/axios'
import type { Estudiante, Inscripcion, EstadoInscripcion, ResultadoFinal } from '@/types'
import type { ResultadoImport } from '@/types/import'

export interface EstudiantePayload {
  ci:               string
  nombre:           string
  apellido:         string
  fechaNacimiento?: string
  direccion?:       string
  rude?:            string
}

export interface InscripcionPayload {
  estudianteId: number
  cursoId:      number
  gestionId:    number
  procedencia?: string
}

// Cambiar el estado de una inscripción (retiro/transferencia) es una
// acción administrativa distinta a crear la inscripción.
export interface CambiarEstadoPayload {
  estadoInscripcion: EstadoInscripcion
  fechaRetiro?:      string
  observaciones?:    string
}

export const estudianteApi = {
  getAll: (params?: {
    search?: string
    cursoId?: number
    gestionId?: number
    estadoInscripcion?: EstadoInscripcion
  }) => api.get<Estudiante[]>('/estudiantes', { params }).then(r => r.data),

  // Detalle con historial completo de inscripciones y tutores
  getById: (id: number) =>
    api.get<Estudiante>(`/estudiantes/${id}`).then(r => r.data),

  // Crea perfil (sin cuenta de acceso)
  create: (payload: EstudiantePayload) =>
    api.post<Estudiante>('/estudiantes', payload).then(r => r.data),

  update: (id: number, payload: Partial<EstudiantePayload> & { activo?: boolean }) =>
    api.put<Estudiante>(`/estudiantes/${id}`, payload).then(r => r.data),

  // ── Inscripciones (rutas separadas: /inscripciones) ──────────────────────

  inscribir: (payload: InscripcionPayload) =>
    api.post<Inscripcion>('/inscripciones', payload).then(r => r.data),

  // Detalle con historial de pagos
  getInscripcion: (id: number) =>
    api.get<Inscripcion>(`/inscripciones/${id}`).then(r => r.data),

  // Si un estudiante se retira a mitad de año no se borra la inscripción,
  // se marca RETIRADA/TRANSFERIDA para conservar el historial.
  cambiarEstado: (id: number, payload: CambiarEstadoPayload) =>
    api.put<Inscripcion>(`/inscripciones/${id}/estado`, payload).then(r => r.data),

  // PROMOVIDO/REPROBADO al cerrar el año — requiere todos los
  // trimestres de la gestión ya cerrados.
  registrarResultado: (id: number, resultado: ResultadoFinal, observaciones?: string) =>
    api.post<Inscripcion>(`/inscripciones/${id}/resultado`, { resultado, observaciones }).then(r => r.data),

  // "Desinscribir" — borra la inscripción de verdad (deshacer un error).
  // El backend rechaza (400) si ya tiene notas/asistencia/pagos cargados;
  // en ese caso corresponde usar cambiarEstado(RETIRADA) en su lugar.
  eliminarInscripcion: (id: number) =>
    api.delete(`/inscripciones/${id}`).then(r => r.data),

  importar: (archivo: File, gestionId: number) => {
    const form = new FormData()
    form.append('archivo', archivo)
    form.append('gestionId', String(gestionId))
    return api.post<ResultadoImport>(
      '/estudiantes/import', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: TIMEOUT_IMPORT }
    ).then(r => r.data)
  },

  exportar: (gestionId: number) =>
    api.get<Blob>('/estudiantes/export', { params: { gestionId }, responseType: 'blob' }).then(r => r.data),
  plantilla: () => api.get<Blob>('/estudiantes/plantilla', { responseType: 'blob' }).then(r => r.data),
}