<script setup lang="ts">
import AsignacionCabecera from '@/components/AsignacionCabecera.vue'
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

// Un solo punto de entrada para marcar: si el día ya está guardado corrige en el servidor,
// si no, solo cambia el estado local hasta que se pulse "Guardar".
function elegir(item: ListaItem, estado: EstadoAsistencia) {
  if (respuesta.value?.yaRegistrado) void corregir(item, estado)
  else estadoLocal.value[item.inscripcionId] = estado
}

const ETIQUETA: Record<EstadoAsistencia, string> = {
  PRESENTE: 'Presente', RETRASO: 'Retraso', AUSENTE: 'Ausente', JUSTIFICADO: 'Justificado',
}

// ✅ faltaba RETRASO — v6 tiene 4 estados, no 3
const ESTADOS: EstadoAsistencia[] = ['PRESENTE', 'RETRASO', 'AUSENTE', 'JUSTIFICADO']

const btnClase: Record<EstadoAsistencia, string> = {
  PRESENTE:    'btn-success',
  RETRASO:     'btn-info',
  AUSENTE:     'btn-error',
  JUSTIFICADO: 'btn-warning',
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
      <AsignacionCabecera v-if="asignacion" :materia="asignacion.materia.nombre"
        :curso="nombreCursoCorto(asignacion.curso)" :total-estudiantes="asignacion.totalEstudiantes">
        <label class="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none">
          <span class="text-xs text-base-content/50">Fecha</span>
          <input v-model="fecha" type="date" :max="hoy" class="input input-bordered input-sm w-full" @change="cambiarFecha" />
        </label>
        <button class="btn btn-primary btn-sm" :disabled="cargando" @click="cargar">
          <span v-if="cargando" class="loading loading-spinner loading-xs"></span>
          <span v-else>Cargar</span>
        </button>
      </AsignacionCabecera>

      <!-- Feedback -->
      <div v-if="error" role="alert" class="alert alert-error"><span>{{ error }}</span></div>

      <!-- Lista de estudiantes -->
      <template v-if="respuesta">
        <div v-if="respuesta.yaRegistrado" role="alert" class="alert alert-info text-sm">
          <span>Ya registrado para esta fecha. Podés corregir estados individuales.</span>
        </div>

        <!-- Un solo control para escritorio y móvil: botones grandes P/R/A/J por estudiante.
             Antes eran 4 radios diminutos en una tabla ancha, imposibles de acertar con el dedo. -->
        <p class="text-xs text-base-content/50 sm:hidden">
          <strong>P</strong> Presente · <strong>R</strong> Retraso · <strong>A</strong> Ausente · <strong>J</strong> Justificado
        </p>
        <div class="card bg-base-100 shadow">
          <ul class="divide-y divide-base-200" aria-label="Lista de estudiantes">
            <li v-for="(item, idx) in respuesta.lista" :key="item.inscripcionId"
              class="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4">
              <div class="flex min-w-0 items-baseline gap-2 sm:flex-1">
                <span class="w-6 shrink-0 text-sm text-base-content/40">{{ Number(idx) + 1 }}</span>
                <span class="truncate font-medium">{{ item.estudiante.apellido }}, {{ item.estudiante.nombre }}</span>
              </div>
              <div class="join w-full sm:w-auto" role="radiogroup"
                :aria-label="`Asistencia de ${item.estudiante.nombre} ${item.estudiante.apellido}`">
                <button
                  v-for="estado in ESTADOS"
                  :key="estado"
                  type="button"
                  role="radio"
                  :aria-checked="(estadoLocal[item.inscripcionId] ?? 'PRESENTE') === estado"
                  :title="ETIQUETA[estado]"
                  class="join-item btn h-11 min-h-11 flex-1 px-2 sm:h-9 sm:min-h-9 sm:flex-none sm:px-3"
                  :class="(estadoLocal[item.inscripcionId] ?? 'PRESENTE') === estado ? btnClase[estado] : 'btn-ghost bg-base-200/60'"
                  :disabled="respuesta.yaRegistrado && corrigiendoId === item.asistenciaId"
                  @click="elegir(item, estado)"
                >
                  <span class="sm:hidden">{{ ETIQUETA[estado][0] }}</span>
                  <span class="hidden sm:inline">{{ ETIQUETA[estado] }}</span>
                </button>
              </div>
            </li>
          </ul>
        </div>

        <!-- Stats + guardar -->
        <div class="sticky bottom-[4.5rem] z-10 flex flex-wrap items-center gap-2 rounded-box bg-base-100/95 p-3 shadow-lg backdrop-blur lg:bottom-2">
          <template v-if="stats">
            <span class="badge badge-success badge-outline"><span class="sm:hidden">P</span><span class="hidden sm:inline">Presentes</span>: {{ stats.presente }}</span>
            <span class="badge badge-info badge-outline"><span class="sm:hidden">R</span><span class="hidden sm:inline">Retrasos</span>: {{ stats.retraso }}</span>
            <span class="badge badge-error badge-outline"><span class="sm:hidden">A</span><span class="hidden sm:inline">Ausentes</span>: {{ stats.ausente }}</span>
            <span class="badge badge-warning badge-outline"><span class="sm:hidden">J</span><span class="hidden sm:inline">Justificados</span>: {{ stats.justificado }}</span>
          </template>
          <button v-if="!respuesta.yaRegistrado" class="btn btn-primary w-full sm:ml-auto sm:w-auto"
            :disabled="guardando" @click="guardar">
            <span v-if="guardando" class="loading loading-spinner loading-sm"></span>
            Guardar asistencia<span class="hidden sm:inline">&nbsp;del {{ fecha }}</span>
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