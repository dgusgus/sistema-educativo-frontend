import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import api from '@/api/axios'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface EstudianteAsignado {
  inscripcionId: number
  nombre:        string
  apellido:      string
  ci:            string
}

export interface Asignacion {
  docenteMateriaCursoId: number
  materia:  { id: number; nombre: string; codigo: string }
  curso:    { id: number; nombre: string; nivel: string; paralelo: string }
  gestion:  { id: number; anio: number }
  horarios: Array<{ id: number; diaSemana: string; horaInicio: string; horaFin: string; aula: string | null }>
  totalEstudiantes: number
  estudiantes: EstudianteAsignado[]
  _stats: { totalAsistencias: number; totalCalificaciones: number }
}

export interface MisCursosResponse {
  docente:           { id: number; nombre: string; apellido: string; especialidad: string | null }
  totalAsignaciones: number
  asignaciones:      Asignacion[]
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useDocenteStore = defineStore('docente', () => {
  const datos    = ref<MisCursosResponse | null>(null)
  const cargando = ref(false)
  const error    = ref<string | null>(null)

  // Asignación seleccionada actualmente (para asistencia y calificaciones)
  const asignacionActiva = ref<Asignacion | null>(null)

  // Shortcuts
  const asignaciones    = computed(() => datos.value?.asignaciones ?? [])
  const docente         = computed(() => datos.value?.docente ?? null)
  const tieneAsignaciones = computed(() => asignaciones.value.length > 0)

  async function cargar() {
    if (datos.value) return  // ya cargado
    cargando.value = true
    error.value = null
    try {
      const { data } = await api.get<MisCursosResponse>('/docentes/mis-cursos')
      datos.value = data
      // Auto-seleccionar la primera asignación si solo hay una
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