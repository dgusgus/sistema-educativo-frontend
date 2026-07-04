import api from '@/api/axios'

// ── Cursos ────────────────────────────────────────────────────────────────────
// ¿Por qué "nivel" y "paralelo" además de "nombre"?
// El backend valida unicidad por nivel+paralelo+gestionId — no puede haber
// dos cursos "Primero Secundaria A" en la misma gestión. El nombre es solo
// un alias legible ("1ro A") para mostrar en la UI.
export interface Curso {
  id:        number
  nombre:    string
  nivel:     string
  paralelo:  string
  gestionId: number
  gestion?:  { id: number; anio: number }
  _count?:   { inscripciones: number; asignaciones: number }
}

export const cursoApi = {
  // GET /cursos — sin gestionId devuelve los de la gestión ACTIVA
  getAll: (gestionId?: number) =>
    api.get<Curso[]>('/cursos', { params: gestionId ? { gestionId } : undefined }).then(r => r.data),

  getById: (id: number) =>
    api.get<Curso>(`/cursos/${id}`).then(r => r.data),

  create: (data: { nombre: string; nivel: string; paralelo: string; gestionId: number }) =>
    api.post<Curso>('/cursos', data).then(r => r.data),

  update: (id: number, data: { nombre?: string; nivel?: string; paralelo?: string }) =>
    api.put<Curso>(`/cursos/${id}`, data).then(r => r.data),

  // ¿Por qué el backend puede rechazar el delete?
  // Si el curso tiene estudiantes inscritos, no se puede eliminar.
  // El backend devuelve un 400 con el conteo de inscritos para que
  // el frontend pueda mostrar un mensaje claro en vez de un error genérico.
  delete: (id: number) =>
    api.delete(`/cursos/${id}`).then(r => r.data),
}

// ── Materias ──────────────────────────────────────────────────────────────────
// ¿Por qué las materias no tienen gestionId?
// Porque las materias son institucionales — "Matemáticas" existe siempre.
// Lo que cambia cada gestión es la ASIGNACIÓN de un docente a esa materia
// en un curso específico (DocenteMateriaCurso). Las materias en sí son fijas.
export interface Materia {
  id:             number
  nombre:         string
  codigo:         string    // ej: "MAT", "LEN", "FIS" — único en el sistema
  horasSemanales: number
  _count?:        { asignaciones: number }
}

export const materiaApi = {
  getAll: () =>
    api.get<Materia[]>('/materias').then(r => r.data),

  getById: (id: number) =>
    api.get<Materia>(`/materias/${id}`).then(r => r.data),

  create: (data: { nombre: string; codigo: string; horasSemanales?: number }) =>
    api.post<Materia>('/materias', data).then(r => r.data),

  update: (id: number, data: { nombre?: string; horasSemanales?: number }) =>
    api.put<Materia>(`/materias/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/materias/${id}`).then(r => r.data),
}

// ── Trimestres ────────────────────────────────────────────────────────────────
// ¿Por qué numero va del 1 al 3 y no más?
// El sistema boliviano divide el año en 3 trimestres (art. 32 del Reglamento
// de Evaluación). El backend valida que número sea 1, 2 o 3.
// ¿Qué significa "cerrado"?
// Un trimestre cerrado bloquea la edición de notas y asistencias de ese período.
// Es irreversible — protege la integridad del historial académico.
export interface Trimestre {
  id:          number
  numero:      number
  nombre:      string
  cerrado:     boolean
  gestionId:   number
  fechaInicio: string | null
  fechaFin:    string | null
  _count?:     { calificaciones: number }
}

export const trimestreApi = {
  // Sin gestionId devuelve los de la gestión activa
  getAll: (gestionId?: number) =>
    api.get<Trimestre[]>('/trimestres', { params: gestionId ? { gestionId } : undefined }).then(r => r.data),

  getById: (id: number) =>
    api.get<Trimestre>(`/trimestres/${id}`).then(r => r.data),

  create: (data: {
    numero:      number
    nombre:      string
    gestionId:   number
    fechaInicio?: string
    fechaFin?:    string
  }) => api.post<Trimestre>('/trimestres', data).then(r => r.data),

  update: (id: number, data: {
    nombre?:      string
    fechaInicio?: string
    fechaFin?:    string
  }) => api.put<Trimestre>(`/trimestres/${id}`, data).then(r => r.data),

  // POST /trimestres/:id/cerrar — acción irreversible
  // ¿Por qué POST y no PUT?
  // Cerrar un trimestre es una ACCIÓN, no una actualización de datos.
  // Semánticamente POST /cerrar es más claro que PUT /trimestres/:id con { cerrado: true }.
  // Además el backend hace validaciones extra antes de cerrar (todos con nota, etc.)
  cerrar: (id: number) =>
    api.post(`/trimestres/${id}/cerrar`).then(r => r.data),
}