<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDocenteStore, type Asignacion } from '@/stores/docente.store'
import { asistenciaApi } from '@/api/asistencia.api'
import type { EstadoAsistencia } from '@/types'

const docenteStore = useDocenteStore()

// ── Fecha ─────────────────────────────────────────────────────────────────────
const hoy  = new Date().toISOString().split('T')[0]
const fecha = ref(hoy)

// ── Asignación seleccionada ───────────────────────────────────────────────────
// Si el docente tiene varias materias/cursos, puede cambiar entre ellas
const asignacion = computed({
  get: () => docenteStore.asignacionActiva,
  set: (a) => { if (a) docenteStore.seleccionar(a) },
})

// ── Datos del día ─────────────────────────────────────────────────────────────
const respuesta   = ref<any | null>(null)
const cargando    = ref(false)
const guardando   = ref(false)
const error       = ref<string | null>(null)
const exito       = ref(false)
const estadoLocal = ref<Record<number, EstadoAsistencia>>({})

onMounted(async () => {
  await docenteStore.cargar()
  // Si ya hay una asignación activa, cargar la lista del día automáticamente
  if (docenteStore.asignacionActiva) {
    await cargar()
  }
})

async function cargar() {
  if (!asignacion.value) return
  cargando.value = true
  error.value = null
  exito.value = false
  respuesta.value = null

  try {
    respuesta.value = await asistenciaApi.getDelDia(
      asignacion.value.docenteMateriaCursoId,
      fecha.value,
    )
    estadoLocal.value = {}
    respuesta.value.lista.forEach((item: any) => {
      estadoLocal.value[item.inscripcionId] = item.estado ?? 'PRESENTE'
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar lista'
  } finally {
    cargando.value = false
  }
}

// Cuando cambia la asignación o la fecha, recargar
async function cambiarAsignacion(asig: Asignacion) {
  docenteStore.seleccionar(asig)
  await cargar()
}

async function cambiarFecha() {
  if (asignacion.value) await cargar()
}

async function guardar() {
  if (!respuesta.value || !asignacion.value) return
  if (respuesta.value.yaRegistrado) {
    error.value = 'Ya registrado. Usá los botones de corrección individuales.'
    return
  }
  guardando.value = true
  error.value = null
  exito.value = false
  try {
    await asistenciaApi.registrar({
      docenteMateriaCursoId: asignacion.value.docenteMateriaCursoId,
      fecha: fecha.value,
      registros: respuesta.value.lista.map((item: any) => ({
        inscripcionId: item.inscripcionId,
        estado: estadoLocal.value[item.inscripcionId] ?? 'PRESENTE',
      })),
    })
    exito.value = true
    await cargar()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    guardando.value = false
  }
}

const corrigiendoId = ref<number | null>(null)
async function corregir(item: any, nuevoEstado: EstadoAsistencia) {
  if (!item.asistenciaId) return
  corrigiendoId.value = item.asistenciaId
  try {
    await asistenciaApi.actualizar(item.asistenciaId, nuevoEstado)
    estadoLocal.value[item.inscripcionId] = nuevoEstado
    const idx = respuesta.value.lista.findIndex((i: any) => i.inscripcionId === item.inscripcionId)
    if (idx !== -1) respuesta.value.lista[idx].estado = nuevoEstado
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al corregir'
  } finally {
    corrigiendoId.value = null
  }
}

const badgeClase: Record<EstadoAsistencia, string> = {
  PRESENTE:    'badge-success',
  AUSENTE:     'badge-error',
  JUSTIFICADO: 'badge-warning',
}

const stats = computed(() => {
  const vals = Object.values(estadoLocal.value)
  if (!vals.length) return null
  return {
    presente:    vals.filter(e => e === 'PRESENTE').length,
    ausente:     vals.filter(e => e === 'AUSENTE').length,
    justificado: vals.filter(e => e === 'JUSTIFICADO').length,
  }
})
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-2xl font-bold">Registro de Asistencia</h2>

    <!-- Cargando asignaciones -->
    <div v-if="docenteStore.cargando" class="flex items-center gap-2 text-base-content/60">
      <span class="loading loading-spinner loading-sm"></span>
      Cargando tus asignaciones...
    </div>

    <!-- Sin asignaciones -->
    <div v-else-if="!docenteStore.tieneAsignaciones" role="alert" class="alert alert-warning">
      <span>No tenés asignaciones activas en la gestión actual. Contactá al director.</span>
    </div>

    <template v-else>

      <!-- Selector de asignación (solo si tiene más de una) -->
      <div v-if="docenteStore.asignaciones.length > 1" class="card bg-base-100 shadow">
        <div class="card-body py-3">
          <p class="text-xs text-base-content/50 mb-2">Seleccioná tu materia/curso:</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="asig in docenteStore.asignaciones"
              :key="asig.docenteMateriaCursoId"
              class="btn btn-sm"
              :class="asignacion?.docenteMateriaCursoId === asig.docenteMateriaCursoId
                ? 'btn-primary' : 'btn-ghost'"
              @click="cambiarAsignacion(asig)"
            >
              {{ asig.materia.nombre }} — {{ asig.curso.nombre }}
            </button>
          </div>
        </div>
      </div>

      <!-- Info de la asignación activa -->
      <div v-if="asignacion" class="card bg-base-100 shadow">
        <div class="card-body py-3 flex flex-wrap gap-4 items-center">
          <div><p class="text-xs text-base-content/50">Materia</p><p class="font-semibold">{{ asignacion.materia.nombre }}</p></div>
          <div><p class="text-xs text-base-content/50">Curso</p><p class="font-semibold">{{ asignacion.curso.nombre }}</p></div>
          <div><p class="text-xs text-base-content/50">Estudiantes</p><p class="font-semibold">{{ asignacion.totalEstudiantes }}</p></div>
          <!-- Selector de fecha -->
          <div class="ml-auto flex items-center gap-2">
            <label class="text-xs text-base-content/50">Fecha:</label>
            <input v-model="fecha" type="date" :max="hoy"
              class="input input-bordered input-sm"
              @change="cambiarFecha" />
            <button class="btn btn-primary btn-sm" :disabled="cargando" @click="cargar">
              <span v-if="cargando" class="loading loading-spinner loading-xs"></span>
              <span v-else>Cargar</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Feedback -->
      <div v-if="error" role="alert" class="alert alert-error"><span>{{ error }}</span></div>
      <div v-if="exito" role="alert" class="alert alert-success"><span>Asistencia guardada correctamente</span></div>

      <!-- Lista de estudiantes -->
      <template v-if="respuesta">
        <div v-if="respuesta.yaRegistrado" role="alert" class="alert alert-info text-sm">
          <span>Ya registrado para esta fecha. Podés corregir estados individuales.</span>
        </div>

        <div class="card bg-base-100 shadow overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Estudiante</th>
                <th class="text-center">P</th>
                <th class="text-center">A</th>
                <th class="text-center">J</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in respuesta.lista" :key="item.inscripcionId" class="hover">
                <td class="text-base-content/40 text-sm">{{ Number(idx) + 1 }}</td>
                <td class="font-medium">{{ item.estudiante.apellido }}, {{ item.estudiante.nombre }}</td>

                <!-- Ya registrado → botones de corrección -->
                <template v-if="respuesta.yaRegistrado">
                  <td colspan="3" class="text-center">
                    <div class="join">
                      <button
                        v-for="estado in (['PRESENTE','AUSENTE','JUSTIFICADO'] as EstadoAsistencia[])"
                        :key="estado"
                        class="join-item btn btn-xs"
                        :class="estadoLocal[item.inscripcionId] === estado
                          ? estado === 'PRESENTE' ? 'btn-success'
                          : estado === 'AUSENTE' ? 'btn-error' : 'btn-warning'
                          : 'btn-ghost'"
                        :disabled="corrigiendoId === item.asistenciaId"
                        @click="corregir(item, estado)"
                      >
                        {{ estado[0] }}
                      </button>
                    </div>
                  </td>
                </template>

                <!-- Primer registro → radios -->
                <template v-else>
                  <td class="text-center">
                    <input type="radio" class="radio radio-success radio-sm"
                      :name="`e-${item.inscripcionId}`"
                      :checked="estadoLocal[item.inscripcionId] === 'PRESENTE'"
                      @change="estadoLocal[item.inscripcionId] = 'PRESENTE'" />
                  </td>
                  <td class="text-center">
                    <input type="radio" class="radio radio-error radio-sm"
                      :name="`e-${item.inscripcionId}`"
                      :checked="estadoLocal[item.inscripcionId] === 'AUSENTE'"
                      @change="estadoLocal[item.inscripcionId] = 'AUSENTE'" />
                  </td>
                  <td class="text-center">
                    <input type="radio" class="radio radio-warning radio-sm"
                      :name="`e-${item.inscripcionId}`"
                      :checked="estadoLocal[item.inscripcionId] === 'JUSTIFICADO'"
                      @change="estadoLocal[item.inscripcionId] = 'JUSTIFICADO'" />
                  </td>
                </template>

                <td>
                  <span class="badge badge-sm" :class="badgeClase[estadoLocal[item.inscripcionId] ?? 'PRESENTE']">
                    {{ estadoLocal[item.inscripcionId] ?? 'PRESENTE' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Stats + guardar -->
        <div class="flex flex-wrap items-center gap-3">
          <template v-if="stats">
            <span class="badge badge-success badge-outline">Presentes: {{ stats.presente }}</span>
            <span class="badge badge-error badge-outline">Ausentes: {{ stats.ausente }}</span>
            <span class="badge badge-warning badge-outline">Justificados: {{ stats.justificado }}</span>
          </template>
          <button v-if="!respuesta.yaRegistrado" class="btn btn-primary ml-auto"
            :disabled="guardando" @click="guardar">
            <span v-if="guardando" class="loading loading-spinner loading-sm"></span>
            Guardar asistencia del {{ fecha }}
          </button>
        </div>
      </template>

      <!-- Estado vacío -->
      <div v-else-if="!cargando && asignacion" class="text-center text-base-content/40 py-8">
        Seleccioná una fecha y presioná "Cargar"
      </div>

    </template>
  </div>
</template>