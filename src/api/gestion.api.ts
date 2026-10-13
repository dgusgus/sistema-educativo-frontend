import api, { TIMEOUT_LOTE } from '@/api/axios'
import type { Nivel, Turno } from '@/types'

// ⚠️ OJO: a diferencia de GET /cursos (que sí pasa por conNombre()), los
// cursos embebidos dentro de Gestion NO traen "nombre" calculado — el
// controller los incluye crudos. Si necesitas mostrar el nombre acá,
// usa el helper nombreCurso() de estructura.api.ts.
export interface CursoEmbebido {
  id:        number
  nivel:     Nivel
  grado:     number
  paralelo:  string
  turno:     Turno
  activo:    boolean
  gestionId: number
}

export interface GestionActiva {
  id:                    number
  anio:                  number
  activa:                boolean
  descripcion:           string | null
  directorId:            number | null
  notaMinimaAprobacion:  number
  director: {
    id:       number
    nombre:   string
    apellido: string
    telefono: string | null
    email:    string | null
  } | null
  cursos:      CursoEmbebido[]
  trimestres: Array<{
    id:          number
    numero:      number
    nombre:      string
    cerrado:     boolean
    fechaInicio: string | null
    fechaFin:    string | null
  }>
  _count: { inscripciones: number }
}

export interface GestionResumen {
  id:          number
  anio:        number
  activa:      boolean
  descripcion: string | null
  notaMinimaAprobacion?: number
  director:    { id: number; nombre: string; apellido: string } | null
  _count:      { cursos: number; inscripciones: number; trimestres: number }
}

// Qué copiar de otra gestión (todo opcional; el backend copia lo que no se desactive).
export interface CopiarDePayload {
  origenId:       number
  cursos?:        boolean
  asignaciones?:  boolean
  trimestres?:    boolean
  dimensiones?:   boolean
  conceptosPago?: boolean
}

// Estado del formulario (origenId vacío hasta que se elige)
export interface OpcionesCopiaForm {
  origenId:      number | ''
  cursos:        boolean
  asignaciones:  boolean
  trimestres:    boolean
  dimensiones:   boolean
  conceptosPago: boolean
}

export interface ContadorCopia {
  copiados:   number
  yaExistian: number
  omitidos:   number
}

export interface ResultadoCopia {
  origen:        { id: number; anio: number }
  destino:       { id: number; anio: number }
  cursos:        ContadorCopia
  asignaciones:  ContadorCopia
  trimestres:    ContadorCopia
  dimensiones:   ContadorCopia
  conceptosPago: ContadorCopia
  avisos:        string[]
}

export interface GestionPayload {
  anio:                   number
  descripcion?:           string
  fechaInicio?:           string
  fechaFin?:              string
  directorId?:            number
  notaMinimaAprobacion?:  number
  copiarDe?:              CopiarDePayload
}

// ─── Paso 1 de Promoción: resultado final del año ────────────────────────────
// Lo calcula el backend desde los promedios finales (reprueba quien tenga
// alguna materia bajo la nota mínima). El navegador nunca elige el resultado.
export interface MateriaReprobada {
  materia:  string
  promedio: number
}

export interface PromedioMateria {
  materia:  string
  /** null si todavía faltan trimestres de esa materia. */
  promedio: number | null
}

export interface CalculoResultado {
  inscripcionId:       number
  estudianteId:        number
  estudiante:          string
  ci:                  string | null
  curso:               string
  resultadoActual:     'PENDIENTE' | 'PROMOVIDO' | 'REPROBADO'
  estado:              'LISTO' | 'INCOMPLETO'
  sugerido:            'PROMOVIDO' | 'REPROBADO' | null
  promedioGeneral:     number | null
  totalMaterias:       number
  /** Todas las materias del curso con su promedio final (para verificar a simple vista). */
  materias:            PromedioMateria[]
  materiasReprobadas:  MateriaReprobada[]
  materiasSinPromedio: string[]
  detalle:             string | null
}

export interface PropuestaResultados {
  gestion: { id: number; anio: number; notaMinima: number }
  resumen: {
    total:         number
    promovidos:    number
    reprobados:    number
    incompletos:   number
    yaRegistrados: number
    porRegistrar:  number
  }
  resultados: CalculoResultado[]
}

export interface ResultadoLote {
  solicitados:  number
  actualizados: number
  promovidos:   number
  reprobados:   number
  sinCambios:   number
  errores:      { inscripcionId: number; estudiante: string; error: string }[]
}

// ─── Promoción por curso ─────────────────────────────────────────────────────
export type GrupoEstudiante = 'PROMOVIDO' | 'REPITE' | 'EGRESA' | 'SIN_RESULTADO' | 'NO_APLICA'

export interface CursoPromocion {
  cursoId:       number
  curso:         string
  nivel:         string
  grado:         number
  paralelo:      string
  turno:         string
  estudiantes:   number
  sinResultado:  number
  promovidos:    number
  repiten:       number
  egresan:       number
  matriculados:  number
  porMatricular: number
  estado:        'RESULTADOS_PENDIENTES' | 'LISTO_MATRICULAR' | 'COMPLETO'
}

export interface TableroPromocion {
  origen:  { id: number; anio: number }
  destino: { id: number; anio: number } | null
  cursos:  CursoPromocion[]
}

export interface CursoDestino {
  id:        number
  nombre:    string
  paralelo:  string
  turno:     string
  capacidad: number | null
  inscritos: number
}

export interface EstudiantePropuesta {
  inscripcionId:   number
  estudianteId:    number
  estudiante:      string
  ci:              string | null
  resultado:       'PENDIENTE' | 'PROMOVIDO' | 'REPROBADO'
  grupo:           GrupoEstudiante
  yaMatriculadoEn: string | null
}

export interface PropuestaMatricula {
  origen:    { id: number; anio: number }
  destino:   { id: number; anio: number }
  curso:     { id: number; nombre: string; paralelo: string; turno: string }
  /** null = los promovidos de este curso egresan. */
  siguiente: { etiqueta: string } | null
  repite:    { etiqueta: string }
  cursosPromovidos:     CursoDestino[]
  cursosRepiten:        CursoDestino[]
  sugeridoPromovidosId: number | null
  sugeridoRepitenId:    number | null
  estudiantes:          EstudiantePropuesta[]
  resumen: {
    total: number; promovidos: number; repiten: number; egresan: number
    sinResultado: number; noAplica: number; yaMatriculados: number; porMatricular: number
  }
}

export interface PedidoMatricula {
  destinoId:          number
  cursoOrigenId:      number
  cursoPromovidosId?: number
  cursoRepitenId?:    number
  inscripcionIds:     number[]
}

export interface ResultadoMatricula {
  solicitados:  number
  matriculados: number
  promovidos:   number
  repiten:      number
  errores:      { inscripcionId: number; estudiante: string; error: string }[]
}

export const gestionApi = {
  // Cargado una vez al login y compartido vía gestion.store.
  // Devuelve null (HTTP 200) cuando no hay gestión activa — p. ej. justo después
  // de cerrar una —; ya no es un error 404.
  getActiva: () =>
    api.get<GestionActiva | null>('/gestiones/activa').then(r => r.data),

  getAll: () =>
    api.get<GestionResumen[]>('/gestiones').then(r => r.data),

  // Detalle completo — incluye conceptosPago (no viene en getActiva)
  getById: (id: number) =>
    api.get<GestionActiva & { conceptosPago: unknown[] }>(`/gestiones/${id}`).then(r => r.data),

  // Si se envía copiarDe, la respuesta incluye el resumen de lo copiado.
  create: (data: GestionPayload) =>
    api.post<GestionResumen & { copia?: ResultadoCopia | null }>('/gestiones', data, { timeout: TIMEOUT_LOTE }).then(r => r.data),

  // Copia cursos, asignaciones, trimestres, dimensiones y conceptos de pago de
  // otra gestión a ésta. Aditivo: no pisa ni borra lo que ya exista.
  copiarEstructura: (id: number, data: CopiarDePayload) =>
    api.post<ResultadoCopia>(`/gestiones/${id}/copiar-estructura`, data, { timeout: TIMEOUT_LOTE }).then(r => r.data),

  update: (id: number, data: Omit<GestionPayload, 'anio' | 'directorId'>) =>
    api.put<GestionResumen>(`/gestiones/${id}`, data).then(r => r.data),

  asignarDirector: (id: number, directorId: number) =>
    api.put(`/gestiones/${id}/director`, { directorId }).then(r => r.data),

  activar: (id: number) =>
    api.put(`/gestiones/${id}/activar`).then(r => r.data),

  // Requiere todos los trimestres cerrados y todos los estudiantes con
  // resultado registrado — el backend devuelve el detalle si falla algo.
  cerrar: (id: number) =>
    api.post(`/gestiones/${id}/cerrar`, undefined, { timeout: TIMEOUT_LOTE }).then(r => r.data),

  // Sugerencia de promoción/repitencia para la siguiente gestión
  getPropuestaInscripciones: (id: number) =>
    api.get<{
      gestion:  { id: number; anio: number }
      resumen:  { promover: number; repetir: number; egresados: number; noContinua: number; revisarManualmente: number }
      propuesta: Array<{
        estudianteId: number
        estudiante:   string
        ci:           string | null
        cursoActual:  string
        estado:       string
        resultado:    string
        accion:       string
        cursoSugerido: string | null
      }>
    }>(`/gestiones/${id}/propuesta-inscripciones`).then(r => r.data),

  // Paso 1 de Promoción: calcula (sin escribir) el resultado del año de cada
  // estudiante. Requiere los trimestres de la gestión cerrados.
  // Con cursoId calcula solo ese curso (Promoción por curso).
  getPropuestaResultados: (id: number, cursoId?: number) =>
    api.get<PropuestaResultados>(`/gestiones/${id}/propuesta-resultados`, { params: cursoId ? { cursoId } : undefined }).then(r => r.data),

  // Registra en lote el resultado del año. Se envían SOLO los ids: el
  // servidor recalcula y escribe el resultado que corresponde.
  registrarResultados: (id: number, inscripcionIds: number[], cursoId?: number) =>
    api.post<ResultadoLote>(`/gestiones/${id}/resultados`, { inscripcionIds, cursoId }, { timeout: TIMEOUT_LOTE }).then(r => r.data),

  // ─── Promoción por curso ───────────────────────────────────────────────────
  // Tablero: un renglón por curso de la gestión de origen (con la de destino se
  // cuentan además los ya matriculados).
  getCursosPromocion: (origenId: number, destinoId?: number) =>
    api.get<TableroPromocion>(`/gestiones/${origenId}/promocion/cursos`, { params: destinoId ? { destinoId } : undefined }).then(r => r.data),

  // Paso 2 de UN curso: sus estudiantes por grupo y los cursos de destino posibles.
  getPropuestaMatricula: (origenId: number, cursoId: number, destinoId: number) =>
    api.get<PropuestaMatricula>(`/gestiones/${origenId}/promocion/matricula`, { params: { cursoId, destinoId } }).then(r => r.data),

  // Matricula en lote a estudiantes de UN curso. El servidor valida todo y
  // devuelve los que fallaron uno por uno.
  matricularCurso: (origenId: number, pedido: PedidoMatricula) =>
    api.post<ResultadoMatricula>(`/gestiones/${origenId}/promocion/matricular`, pedido, { timeout: TIMEOUT_LOTE }).then(r => r.data),
}