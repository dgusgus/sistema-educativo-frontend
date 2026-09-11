import { ref } from 'vue'
import { estudianteApi } from '@/api/estudiante.api'
import type { Estudiante } from '@/types'

// Buscador de estudiante por nombre/CI con debounce — reutilizado en
// PagosView y BoletinesView para reemplazar los inputs de "ID a mano".
// Centralizado acá para no duplicar la misma lógica dos veces (ya
// aprendimos con DocentesView lo caro que sale arreglar un bug en dos
// copias distintas del mismo código).
export function useBuscadorEstudiante() {
  const query        = ref('')
  const resultados    = ref<Estudiante[]>([])
  const buscando      = ref(false)
  const seleccionado  = ref<Estudiante | null>(null)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let buscaSeq = 0   // guard anti-carrera, mismo patrón que en DocentesView

  function onInput() {
    seleccionado.value = null
    if (debounceTimer) clearTimeout(debounceTimer)

    const texto = query.value.trim()
    if (texto.length < 2) {
      resultados.value = []
      return
    }

    debounceTimer = setTimeout(async () => {
      const miTurno = ++buscaSeq
      buscando.value = true
      try {
        const lista = await estudianteApi.getAll({ search: texto })
        if (miTurno !== buscaSeq) return
        resultados.value = lista
      } catch {
        if (miTurno === buscaSeq) resultados.value = []
      } finally {
        if (miTurno === buscaSeq) buscando.value = false
      }
    }, 300)
  }

  function seleccionar(estudiante: Estudiante) {
    seleccionado.value = estudiante
    query.value        = `${estudiante.nombre} ${estudiante.apellido}`
    resultados.value   = []
  }

  function limpiar() {
    query.value       = ''
    resultados.value  = []
    seleccionado.value = null
  }

  return { query, resultados, buscando, seleccionado, onInput, seleccionar, limpiar }
}