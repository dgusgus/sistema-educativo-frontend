// src/lib/errores.ts
//
// Errores del backend en español legible.
//
// Desde que el backend valida con zod, un 400 trae:
//   { error: "fechaInicio: es obligatorio",
//     detalles: [{ campo: "fechaInicio", mensaje: "es obligatorio" }, ...] }
// Los nombres de campo son técnicos (fechaInicio, docenteMateriaCursoId...). Estas
// utilidades los traducen a etiquetas como "Fecha de inicio" para que el
// toast/alerta de cualquier vista muestre algo que una secretaria entienda,
// SIN tener que cambiar ninguna vista: todas leen `e.message`.

export interface DetalleError {
  campo:   string
  mensaje: string
}

const ETIQUETAS: Record<string, string> = {
  // persona
  ci: 'CI', nombre: 'Nombre', apellido: 'Apellido', sexo: 'Sexo',
  fechaNacimiento: 'Fecha de nacimiento', direccion: 'Dirección', telefono: 'Teléfono',
  email: 'Correo electrónico', nacionalidad: 'Nacionalidad', fotoUrl: 'Foto',
  rude: 'RUDE', especialidad: 'Especialidad', ocupacion: 'Ocupación',
  gradoInstruccion: 'Grado de instrucción', parentesco: 'Parentesco', procedencia: 'Procedencia',
  // cuenta
  username: 'Usuario', password: 'Contraseña', nuevaPassword: 'Contraseña nueva',
  passwordNueva: 'Contraseña nueva', passwordActual: 'Contraseña actual', roles: 'Roles',
  activo: 'Activo',
  // estructura académica
  anio: 'Año', descripcion: 'Descripción', fechaInicio: 'Fecha de inicio', fechaFin: 'Fecha de fin',
  notaMinimaAprobacion: 'Nota mínima de aprobación', numero: 'Número', nivel: 'Nivel',
  grado: 'Grado', paralelo: 'Paralelo', turno: 'Turno', capacidad: 'Capacidad',
  codigo: 'Código', horasSemanales: 'Horas semanales',
  // identificadores
  gestionId: 'Gestión', cursoId: 'Curso', materiaId: 'Materia', docenteId: 'Docente',
  estudianteId: 'Estudiante', tutorId: 'Tutor', directorId: 'Director', usuarioId: 'Usuario',
  inscripcionId: 'Inscripción', trimestreId: 'Trimestre', dimensionId: 'Dimensión',
  conceptoPagoId: 'Concepto de pago', docenteMateriaCursoId: 'Asignación del docente',
  // evaluación y asistencia
  puntajeMaximo: 'Puntaje máximo', pesoEnPromedio: 'Peso', peso: 'Peso', orden: 'Orden',
  nota: 'Nota', notas: 'Notas', observacion: 'Observación', observaciones: 'Observaciones',
  fecha: 'Fecha', estado: 'Estado', justificacion: 'Justificación', registros: 'Registros',
  promedioTrimestral: 'Promedio trimestral', motivo: 'Motivo', tema: 'Tema',
  tareaAsignada: 'Tarea asignada', resultado: 'Resultado', estadoInscripcion: 'Estado',
  fechaRetiro: 'Fecha de retiro',
  // horario
  diaSemana: 'Día', horaInicio: 'Hora de inicio', horaFin: 'Hora de fin', aula: 'Aula',
  // pagos
  monto: 'Monto', montoPagado: 'Monto pagado', descuento: 'Descuento',
  metodoPago: 'Método de pago', fechaVencimiento: 'Fecha de vencimiento',
}

// "notas.2.nota" → "Nota (fila 3)" · "persona.apellido" → "Apellido" · "(cuerpo)" → ""
export function etiquetaCampo(campo: string): string {
  if (!campo || campo === '(cuerpo)') return ''
  const partes = campo.split('.')
  const hoja = [...partes].reverse().find(p => !/^\d+$/.test(p)) ?? campo
  const indice = partes.find(p => /^\d+$/.test(p))
  const etiqueta = ETIQUETAS[hoja] ?? hoja
  return indice !== undefined ? `${etiqueta} (fila ${Number(indice) + 1})` : etiqueta
}

// Una frase legible a partir de TODOS los problemas (máximo 2 a la vista).
export function mensajeDesdeDetalles(detalles: DetalleError[]): string {
  const frases = detalles.map(d => {
    const etiqueta = etiquetaCampo(d.campo)
    return etiqueta ? `${etiqueta}: ${d.mensaje}` : d.mensaje
  })
  const visibles = frases.slice(0, 2).join('. ')
  return frases.length > 2 ? `${visibles} (y ${frases.length - 2} más)` : visibles
}

// Error lanzado por el cliente HTTP. Es un Error normal (las vistas que usan
// `e instanceof Error` / `e.message` siguen funcionando igual) pero conserva
// el código HTTP y el detalle por campo, por si una vista quiere marcar
// cada input con su problema.
export class ApiError extends Error {
  status?: number
  detalles: DetalleError[]

  constructor(mensaje: string, status?: number, detalles: DetalleError[] = []) {
    super(mensaje)
    this.name = 'ApiError'
    this.status = status
    this.detalles = detalles
  }
}