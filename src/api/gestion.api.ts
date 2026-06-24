import api from '@/api/axios'

export interface GestionActiva {
  id:         number
  anio:       number
  activa:     boolean
  descripcion: string | null
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

export const gestionApi = {
  getActiva: () =>
    api.get<GestionActiva>('/gestiones/activa').then(r => r.data),

  getAll: () =>
    api.get('/gestiones').then(r => r.data),

  create: (data: { anio: number; descripcion?: string }) =>
    api.post('/gestiones', data).then(r => r.data),

  update: (id: number, data: { descripcion?: string }) =>
    api.put(`/gestiones/${id}`, data).then(r => r.data),

  activar: (id: number) =>
    api.put(`/gestiones/${id}/activar`).then(r => r.data),
}