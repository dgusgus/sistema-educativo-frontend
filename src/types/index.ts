// ─── Roles del sistema (RBAC flat) ──────────────────────────────────────────

export type Rol = 'DIRECTOR' | 'SECRETARIA' | 'DOCENTE' | 'ESTUDIANTE' | 'TUTOR'

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface UsuarioAuth {
  id: number
  username: string
  rol: Rol
  nombre: string
}

export interface LoginResponse {
  token: string
  usuario: UsuarioAuth
}

// ─── Estructura académica ────────────────────────────────────────────────────

export interface Gestion {
  id: number
  anio: number
  activa: boolean
  cursos?: Curso[]
  trimestres?: Trimestre[]
}

export interface Curso {
  id: number
  nombre: string        // "1ro Sec A", "2do Sec B", etc.
  gestionId: number
  nivel?: string
}

export interface Materia {
  id: number
  nombre: string
  codigo?: string
}

export interface Trimestre {
  id: number
  numero: number        // 1, 2 o 3
  nombre: string
  cerrado: boolean
  gestionId: number
  fechaInicio?: string
  fechaFin?: string
}

// ─── Personas ────────────────────────────────────────────────────────────────

export interface Docente {
  id: number
  nombre: string
  apellido: string
  ci: string
  email?: string
  telefono?: string
  especialidad?: string
  activo: boolean
}

export interface Estudiante {
  id: number
  nombre: string
  apellido: string
  ci: string
  fechaNacimiento?: string
  email?: string
  telefono?: string
  activo: boolean
}

export interface Tutor {
  id: number
  nombre: string
  apellido: string
  ci: string
  telefono?: string
  email?: string
  parentesco?: string
}

export interface Inscripcion {
  id: number
  estudianteId: number
  cursoId: number
  gestionId: number
  estudiante?: Estudiante
  curso?: Curso
  resultado?: 'APROBADO' | 'REPROBADO' | 'EN_CURSO'
}

// ─── Asistencia ──────────────────────────────────────────────────────────────

export type EstadoAsistencia = 'PRESENTE' | 'AUSENTE' | 'JUSTIFICADO'

export interface RegistroAsistencia {
  id: number
  inscripcionId: number
  fecha: string
  estado: EstadoAsistencia
  justificacion?: string
  estudiante?: Estudiante
}

export interface ResumenAsistencia {
  inscripcionId: number
  total: number
  presentes: number
  ausentes: number
  justificados: number
  porcentaje: number          // 0–100, alerta si < 80
}

// ─── Calificaciones ──────────────────────────────────────────────────────────

export interface Calificacion {
  id: number
  inscripcionId: number
  trimestreId: number
  docenteMateriaCursoId: number
  nota: number                // Escala 1–100 (Ley 070)
  estudiante?: Estudiante
}

export interface PlanillaNotas {
  docenteMateriaCursoId: number
  materia: Materia
  trimestre: Trimestre
  notas: Calificacion[]
}

// ─── Pagos ───────────────────────────────────────────────────────────────────

export type MetodoPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'QR'
export type EstadoPago = 'PENDIENTE' | 'PAGADO' | 'ANULADO'

export interface ConceptoPago {
  id: number
  nombre: string              // "Matrícula", "Mensualidad Marzo", etc.
  monto: number
  gestionId: number
}

export interface Pago {
  id: number
  inscripcionId: number
  conceptoPagoId: number
  montoPagado: number
  metodoPago: MetodoPago
  estado: EstadoPago
  nroRecibo?: string          // Auto-generado por el backend
  fecha: string
  concepto?: ConceptoPago
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
// Estructura real que devuelve GET /api/dashboard

export interface DashboardIndicadoresData {
  totalEstudiantes: number
  totalDocentes: number
  totalCursos: number
  promedioGeneral: number
  promedioAsistencia: number
  estudiantesEnRiesgo: number
  bajosRendimiento: number
  totalRecaudado: number
  pagosPendientes: number
}

export interface DashboardTrimestre {
  numero: number
  nombre: string
  cerrado: boolean
}

export interface DashboardResponse {
  gestion: { id: number; anio: number }
  indicadores: DashboardIndicadoresData
  trimestres: DashboardTrimestre[]
  generadoEn: string
}

// ─── Helpers de API ──────────────────────────────────────────────────────────

// Respuesta genérica cuando el backend devuelve { message: '...' }
export interface MensajeResponse {
  message: string
}

// Para paginación futura
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}