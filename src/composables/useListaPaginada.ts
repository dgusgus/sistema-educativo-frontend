// src/composables/useListaPaginada.ts
//
// Lista con paginación y búsqueda EN EL SERVIDOR.
//
// ¿Para qué? EstudiantesView descargaba TODOS los estudiantes (con tutores e
// inscripciones) y filtraba en el navegador. Con ~900 estudiantes eso son cientos de KB
// por cada recarga, y crece cada año. Ahora se pide solo la página visible (25–100 filas) y
// el servidor busca y ordena.
//
// Cuidados que ya trae resueltos:
//   • Búsqueda con espera (350 ms sin teclear) para no mandar una petición por letra.
//   • Guard anti-carrera: si llegan respuestas fuera de orden, solo vale la última pedida.
//   • Cualquier cambio de búsqueda o filtros vuelve a la página 1.
//   • Si al borrar el último elemento de la última página esta queda vacía, retrocede una.
import { ref, computed, watch, onScopeDispose } from 'vue'

export interface PaginaRespuesta<T> {
  data: T[]
  meta: { pagina: number; limite: number; total: number; totalPaginas: number }
}

interface Opciones<T> {
  /** Pide una página. Recibe la búsqueda actual; los filtros los arma el que llama. */
  pedir: (p: { pagina: number; limite: number; search: string }) => Promise<PaginaRespuesta<T>>
  limiteInicial?: number
  esperaMs?: number
}

export function useListaPaginada<T>({ pedir, limiteInicial = 25, esperaMs = 350 }: Opciones<T>) {
  const items       = ref<T[]>([]) as { value: T[] }
  const cargando    = ref(false)
  const error       = ref<string | null>(null)
  const busqueda    = ref('')
  const pagina      = ref(1)
  const limite      = ref(limiteInicial)
  const total       = ref(0)
  const totalPaginas = ref(1)

  let seq = 0
  let temporizador: ReturnType<typeof setTimeout> | null = null

  async function cargar() {
    const miTurno = ++seq
    cargando.value = true
    error.value = null
    try {
      const r = await pedir({ pagina: pagina.value, limite: limite.value, search: busqueda.value.trim() })
      if (miTurno !== seq) return
      items.value = r.data
      total.value = r.meta.total
      totalPaginas.value = r.meta.totalPaginas
      // La página pedida ya no existe (se borraron filas): se vuelve a la última que sí.
      if (r.data.length === 0 && pagina.value > r.meta.totalPaginas) {
        pagina.value = r.meta.totalPaginas
        await cargar()
        return
      }
    } catch (e) {
      if (miTurno !== seq) return
      error.value = e instanceof Error ? e.message : 'Error al cargar la lista'
    } finally {
      if (miTurno === seq) cargando.value = false
    }
  }

  /** Para cuando cambia un filtro: vuelve a la página 1 y recarga. */
  function refiltrar() {
    pagina.value = 1
    return cargar()
  }

  function irAPagina(n: number) {
    pagina.value = Math.min(Math.max(1, n), totalPaginas.value)
    return cargar()
  }

  function cambiarLimite(n: number) {
    limite.value = n
    return refiltrar()
  }

  watch(busqueda, () => {
    if (temporizador) clearTimeout(temporizador)
    temporizador = setTimeout(() => { void refiltrar() }, esperaMs)
  })
  onScopeDispose(() => { if (temporizador) clearTimeout(temporizador) })

  const desde = computed(() => (total.value === 0 ? 0 : (pagina.value - 1) * limite.value + 1))
  const hasta = computed(() => Math.min(pagina.value * limite.value, total.value))

  return { items, cargando, error, busqueda, pagina, limite, total, totalPaginas, desde, hasta, cargar, refiltrar, irAPagina, cambiarLimite }
}
