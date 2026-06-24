import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { gestionApi, type GestionActiva } from '@/api/gestion.api'

// ─── ¿Por qué este store? ─────────────────────────────────────────────────────
//
// Sin él, cada vista que necesita el gestionId, cursos o trimestres
// haría su propio GET /gestiones/activa al montar — eso son N llamadas
// duplicadas al backend. El store las centraliza: se llama una sola vez
// al hacer login (desde main.ts o DashboardLayout) y queda disponible
// para toda la app mientras dure la sesión.

export const useGestionStore = defineStore('gestion', () => {
  const gestion  = ref<GestionActiva | null>(null)
  const cargando = ref(false)
  const error    = ref<string | null>(null)

  // Shortcuts que usan las vistas
  const gestionId  = computed(() => gestion.value?.id ?? null)
  const anio       = computed(() => gestion.value?.anio ?? null)
  const cursos     = computed(() => gestion.value?.cursos ?? [])
  const trimestres = computed(() => gestion.value?.trimestres ?? [])

  // Trimestre activo = el primero que no esté cerrado
  const trimestreActivo = computed(() =>
    gestion.value?.trimestres.find(t => !t.cerrado) ?? null
  )

  async function cargar() {
    if (gestion.value) return  // ya cargado, no repetir
    cargando.value = true
    error.value = null
    try {
      gestion.value = await gestionApi.getActiva()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error al cargar gestión'
    } finally {
      cargando.value = false
    }
  }

  function limpiar() {
    gestion.value = null
  }

  return {
    gestion, cargando, error,
    gestionId, anio, cursos, trimestres, trimestreActivo,
    cargar, limpiar,
  }
})