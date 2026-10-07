import api from '@/api/axios'
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

export interface GestionPayload {
  anio:                   number
  descripcion?:           string
  fechaInicio?:           string
  fechaFin?:              string
  directorId?:            number
  notaMinimaAprobacion?:  number
}

// ─── Paso 1 de Promoción: resultado final del año ────────────────────────────
// Lo calcula el backend desde los promedios finales (reprueba quien tenga
// alguna materia bajo la nota mínima). El navegador nunca elige el resultado.
export interface MateriaReprobada {
  materia:  string
  promedio: number
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

export const gestionApi = {
  // Cargado una vez al login y compartido vía gestion.store
  getActiva: () =>
    api.get<GestionActiva>('/gestiones/activa').then(r => r.data),

  getAll: () =>
    api.get<GestionResumen[]>('/gestiones').then(r => r.data),

  // Detalle completo — incluye conceptosPago (no viene en getActiva)
  getById: (id: number) =>
    api.get<GestionActiva & { conceptosPago: unknown[] }>(`/gestiones/${id}`).then(r => r.data),

  create: (data: GestionPayload) =>
    api.post<GestionResumen>('/gestiones', data).then(r => r.data),

  update: (id: number, data: Omit<GestionPayload, 'anio' | 'directorId'>) =>
    api.put<GestionResumen>(`/gestiones/${id}`, data).then(r => r.data),

  asignarDirector: (id: number, directorId: number) =>
    api.put(`/gestiones/${id}/director`, { directorId }).then(r => r.data),

  activar: (id: number) =>
    api.put(`/gestiones/${id}/activar`).then(r => r.data),

  // Requiere todos los trimestres cerrados y todos los estudiantes con
  // resultado registrado — el backend devuelve el detalle si falla algo.
  cerrar: (id: number) =>
    api.post(`/gestiones/${id}/cerrar`).then(r => r.data),

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
  getPropuestaResultados: (id: number) =>
    api.get<PropuestaResultados>(`/gestiones/${id}/propuesta-resultados`).then(r => r.data),

  // Registra en lote el resultado del año. Se envían SOLO los ids: el
  // servidor recalcula y escribe el resultado que corresponde.
  registrarResultados: (id: number, inscripcionIds: number[]) =>
    api.post<ResultadoLote>(`/gestiones/${id}/resultados`, { inscripcionIds }).then(r => r.data),
}