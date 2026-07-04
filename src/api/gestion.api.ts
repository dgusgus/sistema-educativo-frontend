import api from '@/api/axios'

// ¿Por qué una interface separada para GestionActiva?
// Porque GET /gestiones/activa devuelve MÁS datos que GET /gestiones/:id —
// incluye director, cursos y trimestres embebidos para que el frontend
// no tenga que hacer 3 llamadas extra al cargar el dashboard.
// Tiparlo exactamente evita que el frontend asuma campos que no existen.
export interface GestionActiva {
  id:          number
  anio:        number
  activa:      boolean
  descripcion: string | null
  directorId:  number | null
  // ¿Para qué director embebido?
  // El DashboardLayout y el DashboardView muestran el nombre del director
  // en el encabezado. Sin esto habría que hacer un GET /directores/activo aparte.
  director: {
    id:       number
    nombre:   string
    apellido: string
    telefono: string | null
    email:    string | null
  } | null
  cursos: Array<{
    id:       number
    nombre:   string
    nivel:    string
    paralelo: string
  }>
  trimestres: Array<{
    id:      number
    numero:  number
    nombre:  string
    cerrado: boolean
  }>
  _count: { inscripciones: number }
}

export interface GestionResumen {
  id:          number
  anio:        number
  activa:      boolean
  descripcion: string | null
  director: { id: number; nombre: string; apellido: string } | null
  _count: { cursos: number; inscripciones: number; trimestres: number }
}

export const gestionApi = {
  // GET /gestiones/activa — cargado UNA vez al login y compartido vía gestion.store
  getActiva: () =>
    api.get<GestionActiva>('/gestiones/activa').then(r => r.data),

  // GET /gestiones — solo el Director necesita la lista histórica
  getAll: () =>
    api.get<GestionResumen[]>('/gestiones').then(r => r.data),

  // GET /gestiones/:id — detalle completo con trimestres, conceptos de pago, etc.
  getById: (id: number) =>
    api.get<GestionActiva>(`/gestiones/${id}`).then(r => r.data),

  create: (data: { anio: number; descripcion?: string; fechaInicio?: string; fechaFin?: string }) =>
    api.post<GestionResumen>('/gestiones', data).then(r => r.data),

  update: (id: number, data: { descripcion?: string; fechaInicio?: string; fechaFin?: string }) =>
    api.put<GestionResumen>(`/gestiones/${id}`, data).then(r => r.data),

  // ¿Por qué endpoint separado para asignar director?
  // Porque es una acción institucional importante — asignar o cambiar
  // quién dirige el año académico merece su propio endpoint con su propia
  // validación (que el director esté activo, que no haya otro, etc.)
  asignarDirector: (id: number, directorId: number) =>
    api.put(`/gestiones/${id}/director`, { directorId }).then(r => r.data),

  activar: (id: number) =>
    api.put(`/gestiones/${id}/activar`).then(r => r.data),

  cerrar: (id: number) =>
    api.post(`/gestiones/${id}/cerrar`).then(r => r.data),

  // ¿Para qué propuestaInscripciones?
  // Al cerrar el año, la secretaria necesita saber a qué curso
  // inscribir a cada estudiante el año siguiente (promovidos suben,
  // reprobados repiten). El backend calcula la sugerencia automáticamente.
  getPropuestaInscripciones: (id: number) =>
    api.get(`/gestiones/${id}/propuesta-inscripciones`).then(r => r.data),
}