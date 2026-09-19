import api from '@/api/axios'
import type { Nivel } from '@/types'

// ARCHIVO NUEVO — cubre horario.controller.ts / horario.routes.ts, el
// módulo que quedó diferido en el borrador de tesis. Un Horario es un
// bloque semanal (día + hora inicio/fin + aula opcional) asociado a una
// asignación DocenteMateriaCurso. horaInicio/horaFin viajan como texto
// "HH:mm" en ambas direcciones — el backend hace la conversión a/desde
// el tipo Time de Postgres.

export type DiaSemana = 'LUNES' | 'MARTES' | 'MIERCOLES' | 'JUEVES' | 'VIERNES' | 'SABADO'

export const DIAS_SEMANA: DiaSemana[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO']

export const DIA_TEXTO: Record<DiaSemana, string> = {
  LUNES: 'Lunes', MARTES: 'Martes', MIERCOLES: 'Miércoles',
  JUEVES: 'Jueves', VIERNES: 'Viernes', SABADO: 'Sábado',
}

// Refleja GET /horarios (horario.controller.ts → getHorarios)
export interface HorarioDetalle {
  id:                    number
  diaSemana:             DiaSemana
  horaInicio:            string // "HH:mm"
  horaFin:               string // "HH:mm"
  aula:                  string | null
  docenteMateriaCursoId: number
  materia:               { id: number; nombre: string }
  curso:                 { id: number; nivel: Nivel; grado: number; paralelo: string }
  docente:               { id: number; nombre: string; apellido: string }
}

export interface HorarioPayload {
  docenteMateriaCursoId: number
  diaSemana:  DiaSemana
  horaInicio: string // "HH:mm"
  horaFin:    string // "HH:mm"
  aula?:      string
}

export const horarioApi = {
  // Horario semanal completo de un curso — vista principal de gestión
  // (Director/Secretaria) y de consulta (Docente/Estudiante/Tutor).
  getByCurso: (cursoId: number, gestionId?: number) =>
    api.get<HorarioDetalle[]>('/horarios', { params: { cursoId, gestionId } }).then(r => r.data),

  // Horario semanal completo de un docente
  getByDocente: (docenteId: number, gestionId?: number) =>
    api.get<HorarioDetalle[]>('/horarios', { params: { docenteId, gestionId } }).then(r => r.data),

  // Bloques de una asignación puntual (una materia+curso+docente)
  getByAsignacion: (docenteMateriaCursoId: number) =>
    api.get<HorarioDetalle[]>('/horarios', { params: { docenteMateriaCursoId } }).then(r => r.data),

  // Estudiante/Tutor: sin cursoId — el backend resuelve la inscripción
  // propia (o vinculada, pasando estudianteId si es Tutor). Mismo patrón
  // que calificacionApi.getDeEstudiante.
  getPropio: (estudianteId?: number) =>
    api.get<HorarioDetalle[]>('/horarios', { params: estudianteId ? { estudianteId } : undefined }).then(r => r.data),

  create: (payload: HorarioPayload) =>
    api.post<HorarioDetalle>('/horarios', payload).then(r => r.data),

  update: (id: number, payload: Partial<HorarioPayload>) =>
    api.put<HorarioDetalle>(`/horarios/${id}`, payload).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/horarios/${id}`).then(r => r.data),
}