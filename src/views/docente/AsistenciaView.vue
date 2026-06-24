<script setup lang="ts">
import { ref, computed } from 'vue'
import { asistenciaApi, type AsistenciaDiaResponse, type ListaItem } from '@/api/asistencia.api'
import type { EstadoAsistencia } from '@/types'

const hoy = new Date().toISOString().split('T')[0]
const fecha                 = ref(hoy)
const docenteMateriaCursoId = ref<number | ''>('')

const respuesta  = ref<AsistenciaDiaResponse | null>(null)
const cargando   = ref(false)
const guardando  = ref(false)
const error      = ref<string | null>(null)
const exito      = ref(false)

// Estado local: inscripcionId → EstadoAsistencia
const estadoLocal = ref<Record<number, EstadoAsistencia>>({})

async function cargar() {
  if (!docenteMateriaCursoId.value) { error.value = 'Ingresá el ID de asignación'; return }
  cargando.value = true
  error.value = null
  exito.value = false
  respuesta.value = null

  try {
    respuesta.value = await asistenciaApi.getDelDia(
      Number(docenteMateriaCursoId.value), fecha.value
    )
    // Poblar estado local con lo que ya existe (null → PRESENTE por defecto)
    estadoLocal.value = {}
    respuesta.value.lista.forEach(item => {
      estadoLocal.value[item.inscripcionId] = item.estado ?? 'PRESENTE'
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar la lista'
  } finally {
    cargando.value = false
  }
}

async function guardar() {
  if (!respuesta.value) return
  if (respuesta.value.yaRegistrado) {
    error.value = 'Esta fecha ya fue registrada. Usá el botón "Corregir" para modificar entradas individuales.'
    return
  }
  guardando.value = true
  error.value = null
  exito.value = false
  try {
    await asistenciaApi.registrar({
      docenteMateriaCursoId: Number(docenteMateriaCursoId.value),
      fecha: fecha.value,
      registros: respuesta.value.lista.map(item => ({
        inscripcionId: item.inscripcionId,
        estado: estadoLocal.value[item.inscripcionId] ?? 'PRESENTE',
      })),
    })
    exito.value = true
    // Recargar para reflejar el estado guardado
    await cargar()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    guardando.value = false
  }
}

// Corregir un registro ya guardado individualmente
const corrigiendoId = ref<number | null>(null)
async function corregir(item: ListaItem, nuevoEstado: EstadoAsistencia) {
  if (!item.asistenciaId) return
  corrigiendoId.value = item.asistenciaId
  try {
    await asistenciaApi.actualizar(item.asistenciaId, nuevoEstado)
    estadoLocal.value[item.inscripcionId] = nuevoEstado
    if (respuesta.value) {
      const idx = respuesta.value.lista.findIndex(i => i.inscripcionId === item.inscripcionId)
      if (idx !== -1) respuesta.value.lista[idx].estado = nuevoEstado
    }
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
  if (!respuesta.value) return null
  const vals = Object.values(estadoLocal.value)
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

    <!-- Selector -->
    <div class="card bg-base-100 shadow">
      <div class="card-body flex flex-col sm:flex-row gap-3 items-end">
        <fieldset class="fieldset flex-1">
          <legend class="fieldset-legend text-xs">ID Asignación (docenteMateriaCursoId)</legend>
          <input v-model="docenteMateriaCursoId" type="number" min="1" placeholder="Ej: 4"
            class="input input-bordered w-full" @keyup.enter="cargar" />
        </fieldset>
        <fieldset class="fieldset flex-1">
          <legend class="fieldset-legend text-xs">Fecha</legend>
          <input v-model="fecha" type="date" :max="hoy" class="input input-bordered w-full" />
        </fieldset>
        <button class="btn btn-primary" :disabled="cargando" @click="cargar">
          <span v-if="cargando" class="loading loading-spinner loading-sm"></span>
          Cargar lista
        </button>
      </div>
    </div>

    <!-- Feedback -->
    <div v-if="error" role="alert" class="alert alert-error"><span>{{ error }}</span></div>
    <div v-if="exito" role="alert" class="alert alert-success"><span>Asistencia guardada correctamente</span></div>

    <template v-if="respuesta">

      <!-- Info de la asignación -->
      <div class="card bg-base-100 shadow">
        <div class="card-body py-3 flex flex-wrap gap-6 items-center">
          <div><p class="text-xs text-base-content/50">Materia</p><p class="font-semibold">{{ respuesta.dmc.materia.nombre }}</p></div>
          <div><p class="text-xs text-base-content/50">Curso</p><p class="font-semibold">{{ respuesta.dmc.curso.nombre }}</p></div>
          <div><p class="text-xs text-base-content/50">Fecha</p><p class="font-semibold">{{ respuesta.fecha }}</p></div>
          <div class="ml-auto">
            <span class="badge" :class="respuesta.yaRegistrado ? 'badge-ghost' : 'badge-primary'">
              {{ respuesta.yaRegistrado ? '✓ Ya registrado' : 'Nuevo registro' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Alerta si ya fue registrado -->
      <div v-if="respuesta.yaRegistrado" role="alert" class="alert alert-info text-sm">
        <span>Esta fecha ya fue registrada. Podés corregir estados individuales usando los controles de la tabla.</span>
      </div>

      <!-- Tabla -->
      <div class="card bg-base-100 shadow overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Estudiante</th>
              <th class="text-center">Presente</th>
              <th class="text-center">Ausente</th>
              <th class="text-center">Justificado</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, idx) in respuesta.lista" :key="item.inscripcionId" class="hover">
              <td class="text-base-content/40 text-sm">{{ idx + 1 }}</td>
              <td class="font-medium">{{ item.estudiante.apellido }}, {{ item.estudiante.nombre }}</td>

              <!-- Si ya está registrado → botones de corrección -->
              <template v-if="respuesta.yaRegistrado">
                <td colspan="3" class="text-center">
                  <div class="join">
                    <button
                      v-for="estado in (['PRESENTE','AUSENTE','JUSTIFICADO'] as EstadoAsistencia[])"
                      :key="estado"
                      class="join-item btn btn-xs"
                      :class="estadoLocal[item.inscripcionId] === estado
                        ? estado === 'PRESENTE' ? 'btn-success' : estado === 'AUSENTE' ? 'btn-error' : 'btn-warning'
                        : 'btn-ghost'"
                      :disabled="corrigiendoId === item.asistenciaId"
                      @click="corregir(item, estado)"
                    >
                      {{ estado === 'PRESENTE' ? 'P' : estado === 'AUSENTE' ? 'A' : 'J' }}
                    </button>
                  </div>
                </td>
              </template>

              <!-- Primer registro → radios -->
              <template v-else>
                <td class="text-center">
                  <input type="radio" class="radio radio-success radio-sm"
                    :name="`estado-${item.inscripcionId}`"
                    :checked="estadoLocal[item.inscripcionId] === 'PRESENTE'"
                    @change="estadoLocal[item.inscripcionId] = 'PRESENTE'" />
                </td>
                <td class="text-center">
                  <input type="radio" class="radio radio-error radio-sm"
                    :name="`estado-${item.inscripcionId}`"
                    :checked="estadoLocal[item.inscripcionId] === 'AUSENTE'"
                    @change="estadoLocal[item.inscripcionId] = 'AUSENTE'" />
                </td>
                <td class="text-center">
                  <input type="radio" class="radio radio-warning radio-sm"
                    :name="`estado-${item.inscripcionId}`"
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
        <span v-if="stats" class="badge badge-success badge-outline">Presentes: {{ stats.presente }}</span>
        <span v-if="stats" class="badge badge-error badge-outline">Ausentes: {{ stats.ausente }}</span>
        <span v-if="stats" class="badge badge-warning badge-outline">Justificados: {{ stats.justificado }}</span>
        <button v-if="!respuesta.yaRegistrado" class="btn btn-primary ml-auto"
          :disabled="guardando" @click="guardar">
          <span v-if="guardando" class="loading loading-spinner loading-sm"></span>
          Guardar asistencia
        </button>
      </div>

    </template>

    <div v-else-if="!cargando" class="text-center text-base-content/40 py-12">
      Ingresá el ID de asignación y la fecha para cargar la lista
    </div>
  </div>
</template>