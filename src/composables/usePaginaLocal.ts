// src/composables/usePaginaLocal.ts
//
// Paginación EN EL NAVEGADOR para listas que ya llegaron completas (docentes, secretarias,
// directores, deudores de cobranza…). Es la hermana chica de useListaPaginada.
//
// ¿Para qué? No todas las listas justifican paginar en el servidor: las de pocas decenas
// de filas se descargan enteras sin costo. Pero mostrar 400 filas de golpe en un celular
// sigue siendo pesado y difícil de leer. Esto recorta lo que se DIBUJA y reutiliza el mismo
// PaginadorTabla que las listas del servidor, así toda la app pagina igual.
//
// Cuando la lista de origen cambia (otro filtro, otra búsqueda), vuelve a la página 1;
// si solo se actualizó un elemento (misma cantidad) se queda donde estaba.
import { ref, computed, watch, type Ref } from 'vue'

export function usePaginaLocal<T>(origen: Ref<readonly T[]>, limiteInicial = 25) {
  const pagina = ref(1)
  const limite = ref(limiteInicial)

  const total = computed(() => origen.value.length)
  const totalPaginas = computed(() => Math.max(1, Math.ceil(total.value / limite.value)))

  const visibles = computed(() => {
    const ini = (Math.min(pagina.value, totalPaginas.value) - 1) * limite.value
    return origen.value.slice(ini, ini + limite.value)
  })

  const desde = computed(() => (total.value === 0 ? 0 : (Math.min(pagina.value, totalPaginas.value) - 1) * limite.value + 1))
  const hasta = computed(() => Math.min(Math.min(pagina.value, totalPaginas.value) * limite.value, total.value))

  // Cambió la cantidad (otro filtro) → página 1. Evita quedarse en una página que ya no existe.
  watch(total, () => { pagina.value = 1 })

  function irAPagina(n: number) { pagina.value = Math.min(Math.max(1, n), totalPaginas.value) }
  function cambiarLimite(n: number) { limite.value = n; pagina.value = 1 }

  return { pagina, limite, total, totalPaginas, visibles, desde, hasta, irAPagina, cambiarLimite }
}