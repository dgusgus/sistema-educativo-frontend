// src/composables/useAccion.ts
//
// Envuelve una acción async del usuario (guardar, crear, borrar...) con el estado que
// TODAS las vistas repetían a mano: "ejecutando" (para deshabilitar el botón y mostrar
// el spinner), "error" (para el mensaje del modal) y el try/catch/finally.
//
//   const guardar = useAccion(async () => estudianteApi.create(form.value), { exito: 'Estudiante creado' })
//   const r = await guardar.ejecutar()      // r = resultado, o undefined si falló
//   if (r) emit('guardado', r)
//   // en el template:  :disabled="guardar.ejecutando.value"   {{ guardar.error.value }}
//
// ¿Para qué? 127 bloques try/catch casi idénticos en el proyecto: cada uno es una
// oportunidad de olvidar el `finally` (botón trabado en "guardando") o de mostrar el
// error de otra manera. Con esto el comportamiento es uno solo.
//
// Si `ejecutar` se llama mientras ya hay una en curso (doble clic), la segunda se ignora:
// el segundo clic ya no manda otra petición.
import { ref } from 'vue'
import { useToastStore } from '@/stores/toast.store'

interface OpcionesAccion {
  /** Mensaje de éxito (toast). Sin esto no se muestra ninguno. */
  exito?: string
  /** Si es true, el error también se muestra como toast (útil cuando no hay modal donde mostrarlo). */
  errorEnToast?: boolean
  /** Texto cuando el error no trae mensaje propio. */
  errorPorDefecto?: string
}

export function useAccion<A extends unknown[], R>(
  accion: (...args: A) => Promise<R>,
  opciones: OpcionesAccion = {},
) {
  const toast      = useToastStore()
  const ejecutando = ref(false)
  const error      = ref<string | null>(null)

  async function ejecutar(...args: A): Promise<R | undefined> {
    if (ejecutando.value) return undefined
    ejecutando.value = true
    error.value = null
    try {
      const resultado = await accion(...args)
      if (opciones.exito) toast.success(opciones.exito)
      return resultado
    } catch (e) {
      error.value = e instanceof Error && e.message ? e.message : (opciones.errorPorDefecto ?? 'Ocurrió un error')
      if (opciones.errorEnToast) toast.error(error.value)
      return undefined
    } finally {
      ejecutando.value = false
    }
  }

  function limpiarError() { error.value = null }

  return { ejecutando, error, ejecutar, limpiarError }
}
