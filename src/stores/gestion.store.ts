import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { gestionApi, type GestionActiva } from '@/api/gestion.api'
import { nombreCurso } from '@/api/estructura.api'

export const useGestionStore = defineStore('gestion', () => {
  const gestion  = ref<GestionActiva | null>(null)
  const cargando = ref(false)
  const error    = ref<string | null>(null)

  const gestionId = computed(() => gestion.value?.id ?? null)
  const anio      = computed(() => gestion.value?.anio ?? null)
  const director  = computed(() => gestion.value?.director ?? null)

  // ✅ los cursos embebidos en GET /gestiones/activa NO traen "nombre"
  // calculado (a diferencia de GET /cursos) — se lo agregamos acá una
  // sola vez para que las vistas puedan seguir leyendo curso.nombre.
  const cursos = computed(() =>
    (gestion.value?.cursos ?? []).map(c => ({ ...c, nombre: nombreCurso(c) }))
  )

  const trimestres = computed(() => gestion.value?.trimestres ?? [])

  // "Activo" = el primer trimestre que NO está cerrado todavía — para
  // pre-seleccionar en Asistencia y Calificaciones.
  const trimestreActivo = computed(() =>
    gestion.value?.trimestres.find(t => !t.cerrado) ?? null
  )

  async function cargar() {
    // DashboardLayout llama a cargar() en cada montaje — este guard evita
    // repetir el GET /gestiones/activa en cada cambio de ruta.
    if (gestion.value) return
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

  // Fuerza una nueva llamada aunque ya haya datos cacheados — usar tras
  // activar una gestión o reasignar director.
  async function recargar() {
    gestion.value = null
    await cargar()
  }

  // Se llama en logout para que el próximo usuario no vea datos del anterior
  function limpiar() {
    gestion.value = null
  }

  return {
    gestion, cargando, error,
    gestionId, anio, cursos, trimestres, director, trimestreActivo,
    cargar, recargar, limpiar,
  }
})