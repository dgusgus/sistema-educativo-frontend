import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import api from '@/api/axios'

// ─── Tipos ────────────────────────────────────────────────────────────────────
// Reflejan EXACTAMENTE lo que devuelve GET /docentes/mis-cursos
// (docente.controller.ts → getMisCursos)

export interface EstudianteAsignado {
  inscripcionId: number
  id:            number
  nombre:        string
  apellido:      string
  ci:            string
}

export interface Asignacion {
  docenteMateriaCursoId: number
  materia:  { id: number; nombre: string }
  curso:    { id: number; nombre: string }
  gestion:  { id: number; anio: number }
  // ¿Por qué horarios es array? Un docente puede tener múltiples
  // horarios para la misma materia/curso (lunes y miércoles, por ej.)
  horarios: Array<{
    id:        number
    diaSemana: string
    horaInicio: string
    horaFin:   string
    aula:      string | null
  }>
  totalEstudiantes: number
  estudiantes: EstudianteAsignado[]
  // ✅ _stats eliminado — el backend NO lo devuelve
}

export interface MisCursosResponse {
  docente: {
    id:           number
    nombre:       string
    apellido:     string
    especialidad: string | null
  }
  totalAsignaciones: number
  asignaciones: Asignacion[]
}

// ─── Store ────────────────────────────────────────────────────────────────────
//
// ¿Por qué un store separado para el docente?
// Las vistas AsistenciaView y CalificacionesView necesitan las mismas
// asignaciones. Sin el store, cada vista haría su propio GET /docentes/mis-cursos
// al montar — dos llamadas idénticas al backend por cada cambio de pestaña.
// El store las centraliza: se carga una vez y queda disponible para ambas vistas.

export const useDocenteStore = defineStore('docente', () => {
  const datos    = ref<MisCursosResponse | null>(null)
  const cargando = ref(false)
  const error    = ref<string | null>(null)

  // Asignación seleccionada actualmente (compartida entre Asistencia y Calificaciones)
  // ¿Por qué la guardamos en el store? Para que si el docente cambia de materia
  // en AsistenciaView y luego va a CalificacionesView, ya esté pre-seleccionada.
  const asignacionActiva = ref<Asignacion | null>(null)

  const asignaciones      = computed(() => datos.value?.asignaciones ?? [])
  const docente           = computed(() => datos.value?.docente ?? null)
  const tieneAsignaciones = computed(() => asignaciones.value.length > 0)

  async function cargar() {
    if (datos.value) return   // ya cargado — evitar llamadas duplicadas
    cargando.value = true
    error.value = null
    try {
      const { data } = await api.get<MisCursosResponse>('/docentes/mis-cursos')
      datos.value = data
      // Si solo tiene una asignación, seleccionarla automáticamente
      // para que no tenga que elegirla manualmente cada vez que entra
      if (data.asignaciones.length === 1) {
        asignacionActiva.value = data.asignaciones[0]
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error al cargar asignaciones'
    } finally {
      cargando.value = false
    }
  }

  function seleccionar(asig: Asignacion) {
    asignacionActiva.value = asig
  }

  // limpiar() se llama al hacer logout para no dejar datos del docente anterior
  function limpiar() {
    datos.value = null
    asignacionActiva.value = null
  }

  return {
    datos, cargando, error,
    asignaciones, docente, tieneAsignaciones, asignacionActiva,
    cargar, seleccionar, limpiar,
  }
})