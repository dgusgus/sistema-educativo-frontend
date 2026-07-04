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
  descripcion?: string
  directorId?: number
  director?: { id: number; nombre: string; apellido: string }
  cursos?: Curso[]
  trimestres?: Trimestre[]
  _count?: { inscripciones: number; cursos: number; trimestres: number }
}

export interface Curso {
  id: number
  nombre: string
  nivel: string
  paralelo: string
  gestionId: number
  gestion?: { id: number; anio: number }
  _count?: { inscripciones: number; asignaciones: number }
}

export interface Materia {
  id: number
  nombre: string
  codigo: string
  horasSemanales: number
  _count?: { asignaciones: number }
}

export interface Trimestre {
  id: number
  numero: number
  nombre: string
  cerrado: boolean
  gestionId: number
  fechaInicio?: string | null
  fechaFin?: string | null
  _count?: { calificaciones: number }
}

// ─── Personas ────────────────────────────────────────────────────────────────

export interface Docente {
  id: number
  nombre: string
  apellido: string
  ci: string
  email?: string | null
  telefono?: string | null
  especialidad?: string | null
  activo: boolean
  usuario?: { id: number; username: string; activo: boolean } | null
}

export interface Estudiante {
  id: number
  nombre: string
  apellido: string
  ci: string
  fechaNacimiento?: string | null
  direccion?: string | null
  activo: boolean
  // ¿Para qué "inscripciones"? Cuando llamamos GET /estudiantes/:id
  // el backend incluye el historial de inscripciones del estudiante.
  // La lista (GET /estudiantes) solo trae la última inscripción (take:1).
  inscripciones?: Inscripcion[]
  tutores?: Array<{ tutor: Tutor }>
  usuario?: { id: number; username: string } | null
}

export interface Tutor {
  id: number
  nombre: string
  apellido: string
  ci: string
  telefono?: string | null
  email?: string | null
  parentesco?: string | null
  usuario?: { id: number; username: string; activo: boolean } | null
}

// ─── Inscripción ─────────────────────────────────────────────────────────────
// ¿Por qué dos campos de resultado?
// "estadoInscripcion" es el estado OPERATIVO (si el estudiante sigue activo,
// se retiró, etc). "resultado" es la CALIFICACIÓN FINAL del año (PROMOVIDO
// o REPROBADO). Son dos conceptos distintos que el backend maneja por separado.

export type EstadoInscripcion = 'ACTIVA' | 'RETIRADA' | 'TRANSFERIDA' | 'CONCLUIDA'
export type ResultadoFinal    = 'PENDIENTE' | 'PROMOVIDO' | 'REPROBADO'

export interface Inscripcion {
  id: number
  estudianteId: number
  cursoId: number
  gestionId: number
  estadoInscripcion: EstadoInscripcion  // ✅ antes era solo 'estado'
  resultado: ResultadoFinal             // ✅ antes usaba 'APROBADO'/'EN_CURSO'
  fechaRetiro?: string | null
  observaciones?: string | null
  estudiante?: Estudiante
  curso?: Curso
  gestion?: Gestion
  pagos?: Pago[]
}

// ─── Asistencia ──────────────────────────────────────────────────────────────

export type EstadoAsistencia = 'PRESENTE' | 'AUSENTE' | 'JUSTIFICADO'

export interface RegistroAsistencia {
  id: number
  inscripcionId: number
  docenteMateriaCursoId: number
  fecha: string
  estado: EstadoAsistencia
  justificacion?: string | null
}

export interface ResumenAsistencia {
  inscripcionId: number
  docenteMateriaCursoId: number
  trimestreId: number
  totalClases: number
  totalPresente: number
  totalAusente: number
  totalJustificado: number
  porcentaje: number          // 0–100 — alerta si < 80
}

// ─── Calificaciones ──────────────────────────────────────────────────────────

export interface Calificacion {
  id: number
  inscripcionId: number
  trimestreId: number
  docenteMateriaCursoId: number
  nota: number                // Escala 1–100 (Ley 070)
  promedioTrimestral: number
}

export interface PromedioFinal {
  inscripcionId: number
  docenteMateriaCursoId: number
  promedioFinal: number
  aprobado: boolean           // true si promedioFinal >= 51
}

// ─── Pagos ───────────────────────────────────────────────────────────────────

export type MetodoPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'QR'
export type EstadoPago = 'PENDIENTE' | 'PAGADO' | 'ANULADO'

export interface ConceptoPago {
  id: number
  nombre: string
  descripcion?: string | null
  monto: number
  obligatorio: boolean
  gestionId: number
}

export interface Pago {
  id: number
  inscripcionId: number
  conceptoPagoId: number
  montoPagado: number
  metodoPago: MetodoPago
  estado: EstadoPago
  numeroRecibo: string | null   // ✅ antes era 'nroRecibo'
  fechaPago: string
  observaciones?: string | null
  conceptoPago?: ConceptoPago
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
// Estructura exacta que devuelve GET /api/dashboard

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

export interface MensajeResponse {
  message: string
}