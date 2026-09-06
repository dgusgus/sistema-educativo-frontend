import api from '@/api/axios'
import type { Rol, PersonaFlat, PerfilesUsuario } from '@/types'

// Refleja GET /usuarios y GET /usuarios/:id (usuario.controller.ts)
export interface Usuario {
  id:            number
  username:      string
  roles:         Rol[]              // ✅ antes "rol" (uno solo)
  activo:        boolean
  creadoEn:      string
  actualizadoEn: string
  perfil:        PersonaFlat | null   // el primero que exista, por compat
  perfiles:      PerfilesUsuario      // todos los que tenga vinculados
}

// POST /usuarios — crea SOLO la cuenta, sin Persona (para vincular después)
export interface UsuarioPayload {
  username: string
  password: string
  roles:    Rol[]
}

export interface PersonaInput {
  ci:               string
  nombre:           string
  apellido:         string
  sexo?:            'MASCULINO' | 'FEMENINO'
  fechaNacimiento?: string
  direccion?:       string
  telefono?:        string
  email?:           string
  nacionalidad?:    string
  fotoUrl?:         string
}

// Datos específicos por rol al crear perfiles (persona.helper.ts → DatosPorRol)
export interface DatosPorRol {
  DIRECTOR?:   { gestionId?: number }
  DOCENTE?:    { especialidad?: string }
  ESTUDIANTE?: {
    rude?:             string
    lugarNacimiento?:  string
    idiomaMaterno?:    string
    idiomaHablado?:    string
    discapacidad?:     boolean
    tipoDiscapacidad?: string
  }
  TUTOR?: { ocupacion?: string; gradoInstruccion?: string }
}

// POST /usuarios/con-perfil — crea cuenta + Persona + un perfil por cada rol,
// todos apuntando a la MISMA persona (ej. Director que también es Docente)
export interface ConPerfilPayload {
  roles:       Rol[]
  username:    string
  password:    string
  persona:     PersonaInput
  datosPorRol?: DatosPorRol
}

export const usuarioApi = {
  // GET /usuarios — solo Director
  getAll: (params?: { rol?: Rol; activo?: boolean; search?: string }) =>
    api.get<Usuario[]>('/usuarios', { params }).then(r => r.data),

  getById: (id: number) =>
    api.get<Usuario>(`/usuarios/${id}`).then(r => r.data),

  // Director → cualquier combinación de roles
  // Secretaria → solo ESTUDIANTE y/o TUTOR (validado en el backend)
  create: (payload: UsuarioPayload) =>
    api.post<Usuario>('/usuarios', payload).then(r => r.data),

  createConPerfil: (payload: ConPerfilPayload) =>
    api.post<{
      usuario: { id: number; username: string; roles: Rol[] }
      persona: PersonaFlat
      perfiles: Record<string, unknown>
      credenciales: { username: string; password: string; nota: string }
    }>('/usuarios/con-perfil', payload).then(r => r.data),

  // Editar SOLO roles/activo de la cuenta — no toca el perfil (Persona)
  update: (id: number, data: { roles?: Rol[]; activo?: boolean }) =>
    api.put<Usuario>(`/usuarios/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/usuarios/${id}`).then(r => r.data),

  // Resetear sin conocer la contraseña actual (Director/Secretaria)
  resetearPassword: (id: number, nuevaPassword: string) =>
    api.put(`/usuarios/${id}/resetear`, { nuevaPassword }).then(r => r.data),

  // Vincula una cuenta existente a un perfil (Docente/Estudiante/Tutor)
  // que ya existe sin cuenta. ⚠️ NO acepta directorId/secretariaId — esos
  // dos roles siempre nacen ya vinculados (ver director/secretaria.controller).
  vincularPerfil: (id: number, data: {
    docenteId?:    number
    estudianteId?: number
    tutorId?:      number
  }) => api.put(`/usuarios/${id}/vincular`, data).then(r => r.data),
}