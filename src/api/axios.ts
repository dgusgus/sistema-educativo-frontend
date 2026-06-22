import axios from 'axios'

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
    if (error.response?.status === 401) {
      // Token vencido o inválido → limpiar sesión y redirigir
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')

      // Redirigimos directamente con window.location para evitar
      // importar el router acá (evita dependencias circulares:
      // router → store → api → router)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    // Extraemos el mensaje de error del backend si existe,
    // o usamos el mensaje genérico de Axios como fallback.
    // Las vistas pueden leer error.message para mostrar en un toast.
    const mensaje =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Error desconocido'

    return Promise.reject(new Error(mensaje))
  },
)

export default api