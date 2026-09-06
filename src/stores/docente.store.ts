import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import api from '@/api/axios'
import type { Horario, Nivel } from '@/types'

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

// ✅ el curso acá viene SIN "nombre" calculado (el controller arma el
// objeto a mano: { id, nivel, grado, paralelo } — sin turno ni conNombre()).
export interface CursoAsignacion {
  id:       number
  nivel:    Nivel
  grado:    number
  paralelo: string
}

export interface Asignacion {
  docenteMateriaCursoId: number
  materia:  { id: number; nombre: string }
  curso:    CursoAsignacion
  gestion:  { id: number; anio: number }
  horarios: Horario[]
  totalEstudiantes: number
  estudiantes: EstudianteAsignado[]
}

export interface MisCursosResponse {
  // ⚠️ el backend NO devuelve "especialidad" acá (el select de Persona
  // solo trae nombre/apellido) — si la necesitas, usa authStore.usuario
  // o un GET /docentes/:id aparte.
  docente: {
    id:       number
    nombre:   string
    apellido: string
  }
  totalAsignaciones: number
  asignaciones: Asignacion[]
}

// ─── Store ────────────────────────────────────────────────────────────────────
// Centraliza "mis cursos" para que AsistenciaView y CalificacionesView no
// dupliquen la misma llamada al backend.

export const useDocenteStore = defineStore('docente', () => {
  const datos    = ref<MisCursosResponse | null>(null)
  const cargando = ref(false)
  const error    = ref<string | null>(null)

  // Compartida entre Asistencia y Calificaciones — si el docente ya eligió
  // materia en una vista, la otra la encuentra pre-seleccionada.
  const asignacionActiva = ref<Asignacion | null>(null)

  const asignaciones      = computed(() => datos.value?.asignaciones ?? [])
  const docente           = computed(() => datos.value?.docente ?? null)
  const tieneAsignaciones = computed(() => asignaciones.value.length > 0)

  async function cargar() {
    if (datos.value) return   // ya cargado — evita llamadas duplicadas
    cargando.value = true
    error.value = null
    try {
      const { data } = await api.get<MisCursosResponse>('/docentes/mis-cursos')
      datos.value = data
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

  // Se llama al hacer logout para no dejar datos del docente anterior
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