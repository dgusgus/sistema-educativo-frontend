import api, { TIMEOUT_IMPORT } from '@/api/axios'
import type { Estudiante, Inscripcion, EstadoInscripcion, ResultadoFinal, Nivel } from '@/types'
import type { ResultadoImport } from '@/types/import'

// ─── Historial académico ─────────────────────────────────────────────────────
// A qué curso le corresponde inscribirse (lo calcula el backend desde su
// historial y es la misma regla que valida al inscribir).
export type CursoEsperado =
  | { tipo: 'LIBRE';     motivo: string }
  | { tipo: 'FIJO';      nivel: Nivel; grado: number; etiqueta: string; corresponde: string; motivo: string }
  | { tipo: 'EGRESADO';  motivo: string }
  | { tipo: 'PENDIENTE'; motivo: string }

export interface EntradaHistorial {
  inscripcionId:    number
  gestionId:        number
  anio:             number
  curso:            string
  estado:           EstadoInscripcion
  resultado:        ResultadoFinal
  fechaInscripcion: string
  fechaRetiro:      string | null
  procedencia:      string | null
  promedioGeneral:  number | null
  desde:            string
  hacia:            string
}

export interface HistorialAcademico {
  estudiante: { id: number; nombre: string; ci: string | null }
  proximo:    CursoEsperado
  historial:  EntradaHistorial[]
}

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

// Respuesta del backend cuando se pide ?pagina=N (paginación opt-in).
export interface Paginada<T> {
  data: T[]
  meta: { pagina: number; limite: number; total: number; totalPaginas: number }
}

export interface FiltrosEstudiantes {
  search?: string
  cursoId?: number
  gestionId?: number
  estadoInscripcion?: EstadoInscripcion
}

export const estudianteApi = {
  // Una página de resultados (el servidor filtra y ordena). Usar esto en pantallas con listas largas.
  getPage: (params: FiltrosEstudiantes & { pagina: number; limite: number }) =>
    api.get<Paginada<Estudiante>>('/estudiantes', { params }).then(r => r.data),

  // Lista COMPLETA sin paginar. Solo para casos puntuales; con cientos de estudiantes prefiere getPage.
  getAll: (params?: {
    search?: string
    cursoId?: number
    gestionId?: number
    estadoInscripcion?: EstadoInscripcion
  }) => api.get<Estudiante[]>('/estudiantes', { params }).then(r => r.data),

  // Recorrido académico (una fila por gestión) y qué curso le corresponde a
  // continuación. Con gestionId, "lo que le corresponde" es para esa gestión.
  getHistorial: (id: number, gestionId?: number) =>
    api.get<HistorialAcademico>(`/estudiantes/${id}/historial`, { params: gestionId ? { gestionId } : undefined }).then(r => r.data),

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