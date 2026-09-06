// ─── Roles del sistema (RBAC — un usuario puede tener VARIOS roles) ──────────
// v6: Usuario.roles es Rol[], no un solo campo "rol". Un mismo usuario puede
// ser DIRECTOR y DOCENTE a la vez (ver persona.helper.ts → crearPerfilesParaRoles).

export type Rol = 'DIRECTOR' | 'SECRETARIA' | 'DOCENTE' | 'ESTUDIANTE' | 'TUTOR'

// ─── Persona (compartida) ────────────────────────────────────────────────────
// v6 centralizó nombre/apellido/ci/... en una tabla Persona única. Los
// controllers la "aplanan" (aplanarPersona()) para que el frontend siga
// leyendo docente.nombre en vez de docente.persona.nombre.

export interface PersonaFlat {
  id:              number
  ci:              string
  nombre:          string
  apellido:        string
  sexo?:           'MASCULINO' | 'FEMENINO' | null
  fechaNacimiento?: string | null
  direccion?:      string | null
  telefono?:       string | null
  email?:          string | null
  nacionalidad?:   string | null
  fotoUrl?:        string | null
}

// ─── Auth ────────────────────────────────────────────────────────────────────
// Refleja exactamente auth.controller.ts → login() / me()

export interface UsuarioAuth {
  id:       number
  username: string
  roles:    Rol[]        // ✅ antes "rol" (uno solo)
  nombre:   string
}

export interface LoginResponse {
  token:   string
  usuario: UsuarioAuth
}

// perfil "principal" (el primero que exista) + todos los perfiles que tenga.
// Solo lo devuelve GET /auth/me, no el login.
export interface PerfilesUsuario {
  director?:   PersonaFlat & { id: number } | null
  secretaria?: PersonaFlat | null
  docente?:    PersonaFlat & { especialidad?: string | null } | null
  estudiante?: PersonaFlat & { rude?: string | null } | null
  tutor?:      PersonaFlat & { ocupacion?: string | null; gradoInstruccion?: string | null } | null
}

export interface UsuarioMeResponse {
  id:       number
  username: string
  roles:    Rol[]
  activo:   boolean
  perfil:   PersonaFlat | null
  perfiles: PerfilesUsuario
}

// ─── Estructura académica ────────────────────────────────────────────────────

export interface Gestion {
  id:                    number
  anio:                  number
  activa:                boolean
  descripcion?:          string | null
  fechaInicio?:          string | null
  fechaFin?:             string | null
  directorId?:           number | null
  notaMinimaAprobacion?: number
  director?:             (PersonaFlat & { id: number }) | null
  cursos?:               Curso[]
  trimestres?:           Trimestre[]
  conceptosPago?:        ConceptoPago[]
  _count?:               { inscripciones: number; cursos?: number; trimestres?: number; asignaciones?: number }
}

// ✅ v6 eliminó Curso.nombre como campo de BD — se calcula con
// nivel+grado+paralelo+turno (ver curso.helper.ts → conNombre()). El backend
// SIEMPRE lo devuelve ya calculado como "nombre", pero al CREAR/EDITAR hay
// que mandar los campos reales, no un "nombre" suelto.
export type Nivel = 'PRIMARIA' | 'SECUNDARIA'
export type Turno = 'MANANA' | 'TARDE' | 'NOCHE'

export interface Curso {
  id:         number
  nivel:      Nivel
  grado:      number          // 1..6
  paralelo:   string
  turno:      Turno
  capacidad?: number | null
  activo:     boolean
  gestionId:  number
  nombre:     string          // calculado por el backend, solo lectura
  gestion?:   { id: number; anio: number }
  tutorDocenteId?: number | null
  tutorDocente?: (PersonaFlat & { id: number }) | null
  _count?:    { inscripciones: number; asignaciones: number }
}

export interface CampoSaber {
  id:     number
  nombre: string
}

export interface Materia {
  id:              number
  nombre:          string
  codigo:          string
  horasSemanales:  number
  activo:          boolean
  campoSaberId?:   number | null
  campoSaber?:     CampoSaber | null
  _count?:         { asignaciones: number }
}

export interface Trimestre {
  id:          number
  numero:      number         // 1 | 2 | 3
  nombre:      string
  cerrado:     boolean
  gestionId:   number
  fechaInicio?: string | null
  fechaFin?:    string | null
  gestion?:    { id: number; anio: number }
  _count?:     { calificaciones?: number; resumenAsistencias?: number }
}

// DocenteMateriaCurso — la asignación (antes a veces llamada "carga horaria")
export interface Horario {
  id:          number
  diaSemana:   string
  horaInicio:  string
  horaFin:     string
  aula?:       string | null
}

export interface DocenteMateriaCurso {
  id:         number
  docenteId:  number
  materiaId:  number
  cursoId:    number
  gestionId:  number
  materia?:   Materia
  curso?:     Curso
  docente?:   PersonaFlat & { id: number }
  gestion?:   { id: number; anio: number }
  horarios?:  Horario[]
}

// ─── Evaluación (dimensiones SER/SABER/HACER — configurable por gestión) ────
// ARCHIVO NUEVO EN v6 — no existía en el frontend viejo. Reemplaza el modelo
// de "una sola nota por materia/trimestre".

export interface DimensionEvaluacion {
  id:              number
  gestionId:       number
  nombre:          string
  puntajeMaximo:   number
  pesoEnPromedio:  number     // fracción 0–1 (ej. 0.45), NO porcentaje entero
  orden:           number
  esAutoevaluada:  boolean
}

export interface ActividadEvaluativa {
  id:                     number
  docenteMateriaCursoId:  number
  trimestreId:            number
  dimensionId:            number
  nombre:                 string
  fecha:                  string
  puntajeMaximo:          number
  peso:                   number   // fracción 0–1, dentro de la dimensión
  esRecuperatorio:        boolean
  activo:                 boolean
  dimension?:             { id: number; nombre: string }
  _count?:                { notas: number }
}

export interface NotaActividad {
  actividadEvaluativaId: number
  inscripcionId:         number
  nota:                  number
  observacion?:          string | null
}

// Payload para POST /actividades-evaluativas/:id/notas
export interface NotaActividadPayload {
  inscripcionId: number
  nota:          number
  observacion?:  string
}

// ─── Bitácora de clase (antes "Actividad", renombrado en v6) ────────────────
// No confundir con ActividadEvaluativa — esto es el registro de qué se vio
// en clase (tema/tarea), sin nota asociada.

export interface BitacoraClase {
  id:                    number
  docenteMateriaCursoId: number
  trimestreId?:          number | null
  fecha:                 string
  tema:                  string
  descripcion?:          string | null
  tareaAsignada?:        string | null
  docenteMateriaCurso?:  {
    materia: { nombre: string }
    curso:   { nivel: Nivel; grado: number; paralelo: string }
  }
  trimestre?:            { id: number; numero: number; nombre: string } | null
}

// ─── Personas ────────────────────────────────────────────────────────────────

export interface Docente extends PersonaFlat {
  activo:        boolean
  especialidad?: string | null
  usuario?:      { id: number; username: string; activo: boolean } | null
  asignaciones?: DocenteMateriaCurso[]
}

export interface TutorVinculo {
  tutorId:            number
  estudianteId:       number
  parentesco:         string
  esTutorPrincipal:   boolean
  esApoderado:        boolean
  viveConEstudiante:  boolean
  tutor?:             PersonaFlat & { id: number }
  estudiante?:        PersonaFlat & { id: number }
}

export interface Estudiante extends PersonaFlat {
  activo:          boolean
  rude?:           string | null
  lugarNacimiento?: string | null
  discapacidad?:   boolean
  // ✅ "inscripciones" solo viene completo en GET /estudiantes/:id.
  // En la lista (GET /estudiantes) solo trae la última (take: 1).
  inscripciones?:  Inscripcion[]
  tutores?:        TutorVinculo[]
  usuario?:        { id: number; username: string; roles?: Rol[]; activo: boolean } | null
}

export interface Tutor extends PersonaFlat {
  ocupacion?:        string | null
  gradoInstruccion?: string | null
  // ⚠️ el parentesco YA NO vive en Tutor — vive en TutorEstudiante (es un
  // dato de la relación con CADA estudiante, no un atributo del tutor).
  estudiantes?:      TutorVinculo[]
  usuario?:          { id: number; username: string; activo: boolean } | null
}

export interface Director extends PersonaFlat {
  activo:     boolean
  usuario?:   { id: number; username: string; activo: boolean; roles: Rol[] } | null
  gestiones?: Array<{ id: number; anio: number; activa: boolean }>
}

export interface Secretaria extends PersonaFlat {
  activo:   boolean
  usuario?: { id: number; username: string; activo: boolean; roles: Rol[] } | null
}

// ─── Inscripción ─────────────────────────────────────────────────────────────

export type EstadoInscripcion = 'ACTIVA' | 'RETIRADA' | 'TRANSFERIDA' | 'CONCLUIDA'
export type ResultadoFinal    = 'PENDIENTE' | 'PROMOVIDO' | 'REPROBADO'

export interface Inscripcion {
  id:                 number
  estudianteId:       number
  cursoId:            number
  gestionId:          number
  estadoInscripcion:  EstadoInscripcion
  resultado:          ResultadoFinal
  procedencia?:       string | null
  fechaRetiro?:       string | null
  observaciones?:     string | null
  estudiante?:        PersonaFlat & { id: number }
  curso?:             Curso
  gestion?:           Gestion
  pagos?:             Pago[]
  calificaciones?:    Calificacion[]
  promediosFinales?:  PromedioFinal[]
}

// ─── Asistencia ──────────────────────────────────────────────────────────────
// ✅ v6 tiene 4 estados, no 3 — falta RETRASO (falta parcial, no cuenta
// como presente para el % pero tampoco es AUSENTE completo).

export type EstadoAsistencia = 'PRESENTE' | 'AUSENTE' | 'RETRASO' | 'JUSTIFICADO'

export interface RegistroAsistencia {
  id:                     number
  inscripcionId:          number
  docenteMateriaCursoId:  number
  trimestreId:            number   // ✅ obligatorio en v6, antes se inferia por fecha
  fecha:                  string
  estado:                 EstadoAsistencia
  justificacion?:         string | null
}

export interface ResumenAsistencia {
  inscripcionId:          number
  docenteMateriaCursoId:  number
  trimestreId:            number
  totalClases:            number
  totalPresente:          number
  totalAusente:           number
  totalRetraso:           number   // ✅ faltaba
  totalJustificado:       number
  porcentaje:             number   // (PRESENTE + JUSTIFICADO) / totalClases * 100 — alerta si < 80
}

// ─── Calificaciones ──────────────────────────────────────────────────────────
// ✅ Reemplazo total del modelo v5. YA NO existe Calificacion.nota (única) —
// el promedio sale de dimensiones (Ser/Saber/Hacer...), cada una con N
// ActividadEvaluativa (ver calificacion.helper.ts). Calificacion.promedioTrimestral
// es el ÚNICO campo final, y solo lo escribe recalcularCalificacion().

export interface CalificacionDimension {
  dimensionId: number
  promedio:    number
  dimension?:  { nombre: string }
}

export interface Calificacion {
  id:                     number
  inscripcionId:          number
  trimestreId:            number
  docenteMateriaCursoId:  number
  promedioTrimestral:     number | null   // null hasta que haya al menos una nota
  dimensiones?:           CalificacionDimension[]
  docenteMateriaCurso?:   { materia: { nombre: string } }
  trimestre?:             { numero: number; nombre: string }
}

export interface PromedioFinal {
  inscripcionId:          number
  docenteMateriaCursoId:  number
  promedioFinal:          number
  resultado:              'PENDIENTE' | 'PROMOVIDO' | 'REPROBADO'  // ✅ antes "aprobado" boolean
  docenteMateriaCurso?:   { materia: { nombre: string } }
}

export interface HistorialCalificacion {
  id:                number
  calificacionId:    number
  promedioAnterior:  number | null
  promedioNuevo:     number
  motivo:            string
  fecha:             string
  usuario?:          { id: number; username: string; roles: Rol[] }
}

// ─── Pagos ───────────────────────────────────────────────────────────────────

export type MetodoPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'QR'
export type EstadoPago = 'PENDIENTE' | 'PAGADO' | 'PARCIAL' | 'ANULADO'   // ✅ faltaba PARCIAL

export interface ConceptoPago {
  id:                number
  nombre:            string
  descripcion?:      string | null
  monto:             number
  obligatorio:       boolean
  gestionId:         number
  fechaVencimiento?: string | null
  gestion?:          { id: number; anio: number }
}

export interface Pago {
  id:               number
  inscripcionId:    number
  conceptoPagoId:   number
  montoOriginal:    number
  descuento:        number
  montoPagado:      number
  metodoPago:       MetodoPago
  estado:           EstadoPago
  numeroRecibo:     string | null   // formato REC-YYYY-####
  fechaPago:        string
  observaciones?:   string | null
  conceptoPago?:    { nombre: string; monto: number }
  registradoPor?:   { username: string }
}

// ─── Institución ──────────────────────────────────────────────────────────────
// ARCHIVO NUEVO — no existía en el frontend viejo.

export interface Institucion {
  id:            number
  nombre:        string
  direccion:     string
  telefono?:     string | null
  email?:        string | null
  rue:           string
  logoUrl?:      string | null
  municipio:     string
  departamento:  string
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardIndicadoresData {
  totalEstudiantes:    number
  totalDocentes:       number
  totalCursos:         number
  promedioGeneral:     number
  promedioAsistencia:  number
  estudiantesEnRiesgo: number
  bajosRendimiento:    number
  totalRecaudado:      number
  pagosPendientes:     number
}

export interface DashboardTrimestre {
  numero:  number
  nombre:  string
  cerrado: boolean
}

export interface DashboardResponse {
  gestion:      { id: number; anio: number }
  indicadores:  DashboardIndicadoresData
  trimestres:   DashboardTrimestre[]
  generadoEn:   string
}

// ─── Helpers de API ──────────────────────────────────────────────────────────

export interface MensajeResponse {
  message: string
}

export interface ErrorResponse {
  error:       string
  sugerencia?: string
}