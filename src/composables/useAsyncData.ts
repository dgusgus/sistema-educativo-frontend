// src/composables/useAsyncData.ts (archivo nuevo)
import { ref } from 'vue'

// Reemplaza el trío cargando/error/datos + try/catch que se repite en
// las ~20 vistas. No reemplaza la lógica de negocio de cada vista, solo
// el boilerplate de "pedir algo a la API y llevar el estado de eso".
export function useAsyncData<T>(fetcher: () => Promise<T>, inicial: T | null = null) {
  const datos    = ref<T | null>(inicial) as { value: T | null }
  const cargando = ref(false)
  const error    = ref<string | null>(null)

  async function ejecutar() {
    cargando.value = true
    error.value = null
    try {
      datos.value = await fetcher()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error al cargar datos'
    } finally {
      cargando.value = false
    }
  }

  return { datos, cargando, error, ejecutar }
}