<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDocenteStore, type Asignacion, type CursoAsignacion } from '@/stores/docente.store'
import { useGestionStore } from '@/stores/gestion.store'
import { asistenciaApi, type AsistenciaDiaResponse, type ListaItem } from '@/api/asistencia.api'
import { useToastStore } from '@/stores/toast.store'
import type { EstadoAsistencia, Nivel } from '@/types'
import { hoyLocal } from '@/lib/fechas'

const toast = useToastStore()

const docenteStore = useDocenteStore()
const gestionStore = useGestionStore()

// ── Fecha ─────────────────────────────────────────────────────────────────────
const hoy  = hoyLocal()
const fecha = ref(hoy)

// ── Asignación seleccionada ───────────────────────────────────────────────────
const asignacion = computed({
  get: () => docenteStore.asignacionActiva,
  set: (a) => { if (a) docenteStore.seleccionar(a) },
})

// ✅ el curso de la asignación (docente.store) no trae "nombre" calculado
// (el backend no le corre conNombre() en este endpoint) — lo armamos acá
// sin turno, que tampoco viene.
const NIVEL_TEXTO: Record<Nivel, string> = { PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
function nombreCursoCorto(c: CursoAsignacion): string {
  return `${c.grado}° ${NIVEL_TEXTO[c.nivel]} "${c.paralelo}"`
}

// ── Datos del día ─────────────────────────────────────────────────────────────
const respuesta   = ref<AsistenciaDiaResponse | null>(null)
const cargando    = ref(false)
const guardando   = ref(false)
const error       = ref<string | null>(null)
const estadoLocal = ref<Record<number, EstadoAsistencia>>({})

onMounted(async () => {
  await docenteStore.cargar()
  if (docenteStore.asignacionActiva) {
    await cargar()
  }
})

async function cargar() {
  if (!asignacion.value) return
  cargando.value = true
  error.value = null
  respuesta.value = null

  try {
    respuesta.value = await asistenciaApi.getDelDia(
      asignacion.value.docenteMateriaCursoId,
      fecha.value,
    )
    estadoLocal.value = {}
    respuesta.value.lista.forEach((item: ListaItem) => {
      estadoLocal.value[item.inscripcionId] = item.estado ?? 'PRESENTE'
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar lista'
  } finally {
    cargando.value = false
  }
}

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
  // ✅ trimestreId es obligatorio en v6 — lo tomamos del trimestre activo
  // de la gestión (el que aún no está cerrado).
  const trimestreId = gestionStore.trimestreActivo?.id
  if (!trimestreId) {
    error.value = 'No hay un trimestre activo en esta gestión'
    return
  }

  guardando.value = true
  error.value = null
  try {
    const resultado = await asistenciaApi.registrar({
      docenteMateriaCursoId: asignacion.value.docenteMateriaCursoId,
      trimestreId,
      fecha: fecha.value,
      registros: respuesta.value.lista.map((item: ListaItem) => ({
        inscripcionId: item.inscripcionId,
        estado: estadoLocal.value[item.inscripcionId] ?? 'PRESENTE',
      })),
    })
    toast.success('Asistencia guardada correctamente')
    if (resultado.alertas.length > 0) {
      toast.warning(`Atención: ${resultado.alertas.length} estudiante(s) por debajo del 80% de asistencia`)
    }
    await cargar()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    guardando.value = false
  }
}

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

// ✅ faltaba RETRASO — v6 tiene 4 estados, no 3
const ESTADOS: EstadoAsistencia[] = ['PRESENTE', 'RETRASO', 'AUSENTE', 'JUSTIFICADO']

const badgeClase: Record<EstadoAsistencia, string> = {
  PRESENTE:    'badge-success',
  RETRASO:     'badge-info',
  AUSENTE:     'badge-error',
  JUSTIFICADO: 'badge-warning',
}

const btnClase: Record<EstadoAsistencia, string> = {
  PRESENTE:    'btn-success',
  RETRASO:     'btn-info',
  AUSENTE:     'btn-error',
  JUSTIFICADO: 'btn-warning',
}

const radioClase: Record<EstadoAsistencia, string> = {
  PRESENTE:    'radio-success',
  RETRASO:     'radio-info',
  AUSENTE:     'radio-error',
  JUSTIFICADO: 'radio-warning',
}

const stats = computed(() => {
  const vals = Object.values(estadoLocal.value)
  if (!vals.length) return null
  return {
    presente:    vals.filter(e => e === 'PRESENTE').length,
    retraso:     vals.filter(e => e === 'RETRASO').length,
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
              {{ asig.materia.nombre }} — {{ nombreCursoCorto(asig.curso) }}
            </button>
          </div>
        </div>
      </div>

      <!-- Info de la asignación activa -->
      <div v-if="asignacion" class="card bg-base-100 shadow">
        <div class="card-body py-3 flex flex-wrap gap-4 items-center">
          <div><p class="text-xs text-base-content/50">Materia</p><p class="font-semibold">{{ asignacion.materia.nombre }}</p></div>
          <div><p class="text-xs text-base-content/50">Curso</p><p class="font-semibold">{{ nombreCursoCorto(asignacion.curso) }}</p></div>
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
                <th class="text-center" colspan="4">Marcar</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in respuesta.lista" :key="item.inscripcionId" class="hover">
                <td class="text-base-content/40 text-sm">{{ Number(idx) + 1 }}</td>
                <td class="font-medium">{{ item.estudiante.apellido }}, {{ item.estudiante.nombre }}</td>

                <!-- Ya registrado → botones de corrección -->
                <template v-if="respuesta.yaRegistrado">
                  <td colspan="4" class="text-center">
                    <div class="join">
                      <button
                        v-for="estado in ESTADOS"
                        :key="estado"
                        class="join-item btn btn-xs"
                        :class="estadoLocal[item.inscripcionId] === estado ? btnClase[estado] : 'btn-ghost'"
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
                  <td v-for="estado in ESTADOS" :key="estado" class="text-center">
                    <input type="radio" class="radio radio-sm" :class="radioClase[estado]"
                      :name="`e-${item.inscripcionId}`"
                      :checked="estadoLocal[item.inscripcionId] === estado"
                      @change="estadoLocal[item.inscripcionId] = estado" />
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
            <span class="badge badge-info badge-outline">Retrasos: {{ stats.retraso }}</span>
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