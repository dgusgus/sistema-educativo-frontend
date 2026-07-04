import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { gestionApi, type GestionActiva } from '@/api/gestion.api'

export const useGestionStore = defineStore('gestion', () => {
  const gestion  = ref<GestionActiva | null>(null)
  const cargando = ref(false)
  const error    = ref<string | null>(null)

  // Shortcuts que usan las vistas directamente
  // ¿Por qué computed y no acceder a gestion.value.id directamente?
  // Porque si gestion.value es null (aún cargando), acceder a .id lanzaría
  // un error en runtime. El ?? null hace que sea seguro siempre.
  const gestionId      = computed(() => gestion.value?.id ?? null)
  const anio           = computed(() => gestion.value?.anio ?? null)
  const cursos         = computed(() => gestion.value?.cursos ?? [])
  const trimestres     = computed(() => gestion.value?.trimestres ?? [])
  const director       = computed(() => gestion.value?.director ?? null)

  // ¿Por qué trimestreActivo como computed?
  // El docente necesita saber en qué trimestre está parado ahora mismo
  // para pre-seleccionar el correcto en Asistencia y Calificaciones.
  // "Activo" = el primero que NO está cerrado todavía.
  const trimestreActivo = computed(() =>
    gestion.value?.trimestres.find(t => !t.cerrado) ?? null
  )

  async function cargar() {
    // Guard: si ya cargamos, no volvemos a llamar al backend.
    // ¿Por qué? DashboardLayout llama a cargar() cada vez que monta.
    // Sin este guard, cada cambio de ruta haría un GET /gestiones/activa
    // innecesario — con el guard solo se hace una vez por sesión.
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

  // ¿Para qué recargar()?
  // Si el Director activa una nueva gestión o asigna un director,
  // los datos cacheados quedan desactualizados. recargar() fuerza
  // una nueva llamada aunque gestion.value ya tenga datos.
  async function recargar() {
    gestion.value = null
    await cargar()
  }

  // limpiar() se llama en logout para que el próximo usuario
  // que inicie sesión no vea los datos del anterior.
  function limpiar() {
    gestion.value = null
  }

  return {
    gestion, cargando, error,
    gestionId, anio, cursos, trimestres, director, trimestreActivo,
    cargar, recargar, limpiar,
  }
})