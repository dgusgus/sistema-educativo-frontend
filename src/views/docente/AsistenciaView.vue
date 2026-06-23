<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { asistenciaApi, type AsistenciaPayload } from '@/api/asistencia.api'
import type { RegistroAsistencia, EstadoAsistencia } from '@/types'

// ── Fecha de hoy como default ─────────────────────────────────────────────────
const hoy = new Date().toISOString().split('T')[0]
const fecha = ref(hoy)

// El docente necesita seleccionar su docenteMateriaCursoId.
// En una implementación completa vendría de /auth/me con sus asignaciones.
// Por ahora lo dejamos como input manual para que sea funcional de inmediato.
const docenteMateriaCursoId = ref<number | ''>('')

const registros   = ref<RegistroAsistencia[]>([])
const cargando    = ref(false)
const guardando   = ref(false)
const error       = ref<string | null>(null)
const exito       = ref(false)

// Estado local de cada estudiante — empieza todo en PRESENTE
const estadoLocal = ref<Record<number, EstadoAsistencia>>({})

async function cargarAsistencia() {
  if (!docenteMateriaCursoId.value) {
    error.value = 'Seleccioná el ID de tu asignación'
    return
  }
  cargando.value = true
  error.value = null
  exito.value = false
  try {
    registros.value = await asistenciaApi.getDelDia(
      Number(docenteMateriaCursoId.value),
      fecha.value,
    )
    // Inicializar estado local con lo que ya existe en el backend
    estadoLocal.value = {}
    registros.value.forEach(r => {
      estadoLocal.value[r.inscripcionId] = r.estado
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar asistencia'
  } finally {
    cargando.value = false
  }
}

function setEstado(inscripcionId: number, estado: EstadoAsistencia) {
  estadoLocal.value[inscripcionId] = estado
}

async function guardarAsistencia() {
  if (!docenteMateriaCursoId.value || registros.value.length === 0) return

  guardando.value = true
  error.value = null
  exito.value = false
  try {
    const payload: AsistenciaPayload = {
      docenteMateriaCursoId: Number(docenteMateriaCursoId.value),
      fecha: fecha.value,
      registros: registros.value.map(r => ({
        inscripcionId: r.inscripcionId,
        estado: estadoLocal.value[r.inscripcionId] ?? 'PRESENTE',
      })),
    }
    await asistenciaApi.registrar(payload)
    exito.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar asistencia'
  } finally {
    guardando.value = false
  }
}

// Colores de badge según estado
const badgeClase: Record<EstadoAsistencia, string> = {
  PRESENTE:    'badge-success',
  AUSENTE:     'badge-error',
  JUSTIFICADO: 'badge-warning',
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-2xl font-bold">Registro de Asistencia</h2>

    <!-- Filtros -->
    <div class="card bg-base-100 shadow">
      <div class="card-body flex flex-col sm:flex-row gap-3 items-end">
        <fieldset class="fieldset flex-1">
          <legend class="fieldset-legend text-xs">ID Asignación (docenteMateriaCursoId)</legend>
          <input
            v-model="docenteMateriaCursoId"
            type="number"
            placeholder="Ej: 1"
            class="input input-bordered w-full"
            min="1"
          />
        </fieldset>
        <fieldset class="fieldset flex-1">
          <legend class="fieldset-legend text-xs">Fecha</legend>
          <input
            v-model="fecha"
            type="date"
            :max="hoy"
            class="input input-bordered w-full"
          />
        </fieldset>
        <button class="btn btn-primary" :disabled="cargando" @click="cargarAsistencia">
          <span v-if="cargando" class="loading loading-spinner loading-sm"></span>
          Cargar lista
        </button>
      </div>
    </div>

    <!-- Feedback -->
    <div v-if="error" role="alert" class="alert alert-error">
      <span>{{ error }}</span>
    </div>
    <div v-if="exito" role="alert" class="alert alert-success">
      <span>Asistencia guardada correctamente</span>
    </div>

    <!-- Lista de estudiantes -->
    <div v-if="registros.length > 0" class="space-y-3">
      <div class="card bg-base-100 shadow overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Estudiante</th>
              <th class="text-center">Presente</th>
              <th class="text-center">Ausente</th>
              <th class="text-center">Justificado</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in registros" :key="r.inscripcionId" class="hover">
              <td class="font-medium">
                {{ r.estudiante ? `${r.estudiante.nombre} ${r.estudiante.apellido}` : `Inscripción #${r.inscripcionId}` }}
              </td>
              <td class="text-center">
                <input
                  type="radio"
                  class="radio radio-success radio-sm"
                  :name="`estado-${r.inscripcionId}`"
                  value="PRESENTE"
                  :checked="estadoLocal[r.inscripcionId] === 'PRESENTE'"
                  @change="setEstado(r.inscripcionId, 'PRESENTE')"
                />
              </td>
              <td class="text-center">
                <input
                  type="radio"
                  class="radio radio-error radio-sm"
                  :name="`estado-${r.inscripcionId}`"
                  value="AUSENTE"
                  :checked="estadoLocal[r.inscripcionId] === 'AUSENTE'"
                  @change="setEstado(r.inscripcionId, 'AUSENTE')"
                />
              </td>
              <td class="text-center">
                <input
                  type="radio"
                  class="radio radio-warning radio-sm"
                  :name="`estado-${r.inscripcionId}`"
                  value="JUSTIFICADO"
                  :checked="estadoLocal[r.inscripcionId] === 'JUSTIFICADO'"
                  @change="setEstado(r.inscripcionId, 'JUSTIFICADO')"
                />
              </td>
              <td>
                <span class="badge badge-sm" :class="badgeClase[estadoLocal[r.inscripcionId] ?? 'PRESENTE']">
                  {{ estadoLocal[r.inscripcionId] ?? 'PRESENTE' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Resumen rápido -->
      <div class="flex gap-3 text-sm">
        <span class="badge badge-success badge-outline">
          Presentes: {{ Object.values(estadoLocal).filter(e => e === 'PRESENTE').length }}
        </span>
        <span class="badge badge-error badge-outline">
          Ausentes: {{ Object.values(estadoLocal).filter(e => e === 'AUSENTE').length }}
        </span>
        <span class="badge badge-warning badge-outline">
          Justificados: {{ Object.values(estadoLocal).filter(e => e === 'JUSTIFICADO').length }}
        </span>
      </div>

      <button
        class="btn btn-primary"
        :disabled="guardando"
        @click="guardarAsistencia"
      >
        <span v-if="guardando" class="loading loading-spinner loading-sm"></span>
        Guardar asistencia del {{ fecha }}
      </button>
    </div>

    <!-- Estado vacío -->
    <div v-else-if="!cargando && !error" class="text-center text-base-content/40 py-12">
      Ingresá el ID de asignación y la fecha para cargar la lista
    </div>

  </div>
</template>