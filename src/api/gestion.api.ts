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
}