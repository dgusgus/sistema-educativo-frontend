import axios from 'axios'
import { ApiError, mensajeDesdeDetalles, type DetalleError } from '@/lib/errores'

// ─── Instancia base ───────────────────────────────────────────────────────────
//
// baseURL: gracias al proxy de vite.config.ts, '/api' se reenvía
// automáticamente a 'http://localhost:4000/api' en desarrollo.
// En producción apuntaría a la URL real del servidor.
//
// timeout: si el backend no responde en 10s, la petición falla
// con un error claro en vez de colgarse indefinidamente.

const api = axios.create({
  baseURL: '/api',
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Interceptor de REQUEST ───────────────────────────────────────────────────
//
// Se ejecuta ANTES de cada petición.
// Lee el token del localStorage y lo agrega al header Authorization.
//
// ¿Por qué localStorage y no el store de Pinia?
// Porque este archivo se importa antes de que Pinia esté inicializado
// (el store no existe hasta que se monta la app). El store va a leer
// de localStorage también, así que ambos están sincronizados.

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// ─── Interceptor de RESPONSE ──────────────────────────────────────────────────
//
// Se ejecuta DESPUÉS de cada respuesta.
//
// Caso exitoso (2xx): devuelve la respuesta sin tocarla.
//
// Caso error:
//   401 Unauthorized → el token venció o es inválido.
//              Limpiamos localStorage y mandamos al login.
//              Sin esto, el usuario vería errores raros en todas las vistas.
//
//   403 Forbidden → el token es válido pero el rol no tiene permiso.
//              No cerramos sesión, solo rechazamos la petición.
//
//   Otros errores → los dejamos pasar para que cada vista
//              los maneje como prefiera (mostrar toast, etc.)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status: number | undefined = error.response?.status
    const data = error.response?.data
    const esLogin = error.config?.url === '/auth/login'

    // Texto que envió el backend (o uno propio si ni siquiera hubo respuesta).
    // Desde que el backend valida con zod, un 400 puede traer `detalles` con
    // TODOS los campos inválidos: se traducen a etiquetas legibles
    // ("Fecha de inicio: es obligatorio"). El login conserva su frase propia.
    const detalles: DetalleError[] = Array.isArray(data?.detalles) ? data.detalles : []

    let mensaje: string
    if (detalles.length > 0 && !esLogin) {
      mensaje = mensajeDesdeDetalles(detalles)
    } else if (data?.message || data?.error) {
      mensaje = data.message || data.error
    } else if (error.code === 'ECONNABORTED') {
      mensaje = 'El servidor tardó demasiado en responder. Intenta de nuevo.'
    } else if (!error.response) {
      mensaje = 'No se pudo conectar con el servidor. Revisa tu conexión.'
    } else {
      mensaje = error.message || 'Error desconocido'
    }

    if (status === 401 && !esLogin) {
      // Sesión inválida: token vencido, contraseña cambiada, cuenta
      // desactivada o eliminada (el backend ahora lo comprueba en cada petición).
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')

      // Se guarda el motivo para que el login explique por qué se cerró la
      // sesión (sessionStorage y no la URL: un texto en la URL podría ser
      // manipulado para mostrar mensajes falsos en la pantalla de login).
      if (window.location.pathname !== '/login') {
        sessionStorage.setItem('motivoSesion', mensaje)
        // window.location y no el router: evita el ciclo router → store → api → router
        window.location.href = '/login'
      }
    }

    return Promise.reject(new ApiError(mensaje, status, detalles))
  },
)

// Las importaciones de Excel procesan fila por fila en el servidor y pueden tardar
// más que los 10 s generales: con el tiempo global, la pantalla decía "tardó
// demasiado" mientras el servidor seguía importando, y al reintentar todo salía "Ya existe".
export const TIMEOUT_IMPORT = 120_000

export default api