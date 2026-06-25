import api from '@/api/axios'

// ── Cursos ────────────────────────────────────────────────────────────────────
export interface Curso {
  id:       number
  nombre:   string
  nivel:    string
  paralelo: string
  gestionId: number
  gestion:  { id: number; anio: number }
  _count:   { inscripciones: number; asignaciones: number }
}

export const cursoApi = {
  getAll: (gestionId?: number) =>
    api.get<Curso[]>('/cursos', { params: { gestionId } }).then(r => r.data),

  create: (data: { nombre: string; nivel: string; paralelo: string; gestionId: number }) =>
    api.post<Curso>('/cursos', data).then(r => r.data),

  update: (id: number, data: { nombre?: string; nivel?: string; paralelo?: string }) =>
    api.put<Curso>(`/cursos/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/cursos/${id}`).then(r => r.data),
}

// ── Materias ──────────────────────────────────────────────────────────────────
export interface Materia {
  id:             number
  nombre:         string
  codigo:         string
  horasSemanales: number
  _count:         { asignaciones: number }
}

export const materiaApi = {
  getAll: () =>
    api.get<Materia[]>('/materias').then(r => r.data),

  create: (data: { nombre: string; codigo: string; horasSemanales?: number }) =>
    api.post<Materia>('/materias', data).then(r => r.data),

  update: (id: number, data: { nombre?: string; horasSemanales?: number }) =>
    api.put<Materia>(`/materias/${id}`, data).then(r => r.data),
}

// ── Trimestres ────────────────────────────────────────────────────────────────
export interface Trimestre {
  id:          number
  numero:      number
  nombre:      string
  cerrado:     boolean
  gestionId:   number
  fechaInicio: string | null
  fechaFin:    string | null
  _count:      { calificaciones: number }
}

export const trimestreApi = {
  getAll: (gestionId?: number) =>
    api.get<Trimestre[]>('/trimestres', { params: { gestionId } }).then(r => r.data),

  create: (data: { numero: number; nombre: string; gestionId: number; fechaInicio?: string; fechaFin?: string }) =>
    api.post<Trimestre>('/trimestres', data).then(r => r.data),

  update: (id: number, data: { nombre?: string; fechaInicio?: string; fechaFin?: string }) =>
    api.put<Trimestre>(`/trimestres/${id}`, data).then(r => r.data),

  cerrar: (id: number) =>
    api.post(`/trimestres/${id}/cerrar`).then(r => r.data),
}