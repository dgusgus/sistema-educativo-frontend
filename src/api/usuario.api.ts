import api from '@/api/axios'
import type { Rol } from '@/types'

export interface Usuario {
  id:       number
  username: string
  rol:      Rol
  activo:   boolean
  creadoEn: string
  // ¿Por qué perfil nullable?
  // Un usuario puede existir sin perfil vinculado (caso raro pero posible
  // si se crea manualmente). El frontend debe manejar perfil === null.
  perfil: { id: number; nombre: string; apellido: string; ci: string } | null
}

export interface UsuarioPayload {
  username: string
  password: string
  rol:      Rol
}

// ¿Por qué ConPerfilPayload separado?
// POST /usuarios/con-perfil crea usuario + perfil en una sola transacción.
// El campo "perfil" varía según el rol: un Director puede incluir gestionId,
// un Docente puede incluir especialidad, un Estudiante incluye fechaNacimiento.
// Tiparlo con un objeto genérico permite enviar lo que corresponda sin forzar
// todos los campos opcionales en un único type rígido.
export interface ConPerfilPayload {
  rol:      Rol
  username: string
  password: string
  perfil: {
    ci:              string
    nombre:          string
    apellido:        string
    telefono?:       string
    email?:          string
    // Solo DOCENTE
    especialidad?:   string
    // Solo DIRECTOR
    gestionId?:      number
    // Solo ESTUDIANTE
    fechaNacimiento?: string
    direccion?:       string
    // Solo TUTOR
    parentesco?:      string
  }
}

export const usuarioApi = {
  // GET /usuarios — solo Director
  getAll: (params?: { rol?: Rol; activo?: boolean }) =>
    api.get<Usuario[]>('/usuarios', { params }).then(r => r.data),

  getById: (id: number) =>
    api.get<Usuario>(`/usuarios/${id}`).then(r => r.data),

  // POST /usuarios — crea solo la cuenta sin perfil
  create: (payload: UsuarioPayload) =>
    api.post<Usuario>('/usuarios', payload).then(r => r.data),

  // POST /usuarios/con-perfil — crea cuenta + perfil en una transacción
  // ¿Por qué preferir este sobre POST /usuarios?
  // Porque el flujo normal del Director es crear a alguien con todo listo:
  // cuenta de acceso + datos personales al mismo tiempo. Usar dos endpoints
  // separados obligaría a manejar el rollback manual si el segundo falla.
  createConPerfil: (payload: ConPerfilPayload) =>
    api.post<{ usuario: Usuario; credenciales: { username: string; password: string } }>(
      '/usuarios/con-perfil', payload
    ).then(r => r.data),

  update: (id: number, data: { rol?: Rol; activo?: boolean }) =>
    api.put<Usuario>(`/usuarios/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/usuarios/${id}`).then(r => r.data),

  // ¿Por qué resetearPassword en lugar de PUT /auth/password?
  // PUT /auth/password requiere que el usuario sepa su contraseña actual —
  // es para cuando el propio usuario quiere cambiarla.
  // PUT /usuarios/:id/resetear es para cuando el Director/Secretaria
  // necesita darle acceso a alguien que olvidó su contraseña, sin conocerla.
  resetearPassword: (id: number, nuevaPassword: string) =>
    api.put(`/usuarios/${id}/resetear`, { nuevaPassword }).then(r => r.data),

  vincularPerfil: (id: number, data: {
    docenteId?:    number
    estudianteId?: number
    tutorId?:      number
    directorId?:   number
    secretariaId?: number
  }) => api.put(`/usuarios/${id}/vincular`, data).then(r => r.data),
}