<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDocenteStore, type Asignacion } from '@/stores/docente.store'
import { useGestionStore } from '@/stores/gestion.store'
import { calificacionApi, type PlanillaResponse, type NotaPayload } from '@/api/calificacion.api'

const docenteStore = useDocenteStore()
const gestion      = useGestionStore()

const asignacion = computed({
  get: () => docenteStore.asignacionActiva,
  set: (a) => { if (a) docenteStore.seleccionar(a) },
})

// Trimestre seleccionado — default: el primer trimestre no cerrado
const trimestreId = ref<number | ''>('')

const planilla  = ref<PlanillaResponse | null>(null)
const cargando  = ref(false)
const guardando = ref(false)
const error     = ref<string | null>(null)
const exito     = ref(false)

const notasLocales = ref<Record<number, string>>({})
const trimCerrado  = computed(() => planilla.value?.trimestreCerrado ?? false)

onMounted(async () => {
  await docenteStore.cargar()
  await gestion.cargar()
  // Auto-seleccionar el trimestre activo
  const trimActivo = gestion.trimestreActivo
  if (trimActivo) trimestreId.value = trimActivo.id
  // Si hay asignación activa y trimestre, cargar automáticamente
  if (docenteStore.asignacionActiva && trimestreId.value) {
    await cargar()
  }
})

async function cambiarAsignacion(asig: Asignacion) {
  docenteStore.seleccionar(asig)
  if (trimestreId.value) await cargar()
}

async function cargar() {
  if (!asignacion.value || !trimestreId.value) return
  cargando.value = true
  error.value = null
  exito.value = false
  planilla.value = null
  try {
    planilla.value = await calificacionApi.getPlanilla(
      asignacion.value.docenteMateriaCursoId,
      Number(trimestreId.value),
    )
    notasLocales.value = {}
    planilla.value.planilla.forEach(item => {
      notasLocales.value[item.inscripcionId] = item.nota !== null ? String(item.nota) : ''
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar planilla'
  } finally {
    cargando.value = false
  }
}

function notaValida(v: string): boolean {
  if (!v) return true
  const n = Number(v)
  return !isNaN(n) && n >= 1 && n <= 100
}

const erroresNota = computed(() => {
  if (!planilla.value) return {}
  const errs: Record<number, string> = {}
  planilla.value.planilla.forEach(item => {
    const v = notasLocales.value[item.inscripcionId]
    if (v && !notaValida(v)) errs[item.inscripcionId] = 'Debe ser 1–100'
  })
  return errs
})

const hayErrores = computed(() => Object.keys(erroresNota.value).length > 0)

function claseNota(v: string): string {
  if (!v) return ''
  const n = Number(v)
  if (isNaN(n)) return 'input-error'
  if (n >= 71) return 'input-success'
  if (n >= 51) return 'input-warning'
  return 'input-error'
}

async function guardar() {
  if (!planilla.value || trimCerrado.value || hayErrores.value) return
  const notas: NotaPayload[] = planilla.value.planilla
    .filter(item => notasLocales.value[item.inscripcionId])
    .map(item => ({
      inscripcionId: item.inscripcionId,
      nota: Number(notasLocales.value[item.inscripcionId]),
    }))
  if (!notas.length) { error.value = 'Ingresá al menos una nota'; return }
  guardando.value = true
  error.value = null
  exito.value = false
  try {
    await calificacionApi.guardarPlanilla(
      asignacion.value!.docenteMateriaCursoId,
      Number(trimestreId.value),
      notas,
    )
    exito.value = true
    await cargar()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    guardando.value = false
  }
}

const stats = computed(() => {
  if (!planilla.value) return null
  const notas = planilla.value.planilla
    .map(item => Number(notasLocales.value[item.inscripcionId]))
    .filter(n => !isNaN(n) && n > 0)
  if (!notas.length) return null
  const promedio  = notas.reduce((a, b) => a + b, 0) / notas.length
  const aprobados = notas.filter(n => n >= 51).length
  return { promedio: promedio.toFixed(1), aprobados, reprobados: notas.length - aprobados }
})
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-2xl font-bold">Planilla de Calificaciones</h2>

    <div v-if="docenteStore.cargando" class="flex items-center gap-2 text-base-content/60">
      <span class="loading loading-spinner loading-sm"></span>
      Cargando tus asignaciones...
    </div>

    <div v-else-if="!docenteStore.tieneAsignaciones" role="alert" class="alert alert-warning">
      <span>No tenés asignaciones activas. Contactá al director.</span>
    </div>

    <template v-else>

      <!-- Selector de asignación -->
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

      <!-- Info + selector de trimestre -->
      <div v-if="asignacion" class="card bg-base-100 shadow">
        <div class="card-body py-3 flex flex-wrap gap-4 items-center">
          <div><p class="text-xs text-base-content/50">Materia</p><p class="font-semibold">{{ asignacion.materia.nombre }}</p></div>
          <div><p class="text-xs text-base-content/50">Curso</p><p class="font-semibold">{{ asignacion.curso.nombre }}</p></div>
          <div><p class="text-xs text-base-content/50">Estudiantes</p><p class="font-semibold">{{ asignacion.totalEstudiantes }}</p></div>
          <div class="ml-auto flex items-center gap-2">
            <select v-model="trimestreId" class="select select-bordered select-sm" @change="cargar">
              <option :value="''" disabled>Trimestre</option>
              <option v-for="t in gestion.trimestres" :key="t.id" :value="t.id">
                {{ t.nombre }} {{ t.cerrado ? '🔒' : '' }}
              </option>
            </select>
            <button class="btn btn-primary btn-sm" :disabled="cargando || !trimestreId" @click="cargar">
              <span v-if="cargando" class="loading loading-spinner loading-xs"></span>
              <span v-else>Cargar</span>
            </button>
          </div>
        </div>
      </div>

      <div v-if="error" role="alert" class="alert alert-error"><span>{{ error }}</span></div>
      <div v-if="exito" role="alert" class="alert alert-success"><span>Notas guardadas correctamente</span></div>

      <template v-if="planilla">
        <!-- Estado trimestre -->
        <div v-if="trimCerrado" role="alert" class="alert alert-warning text-sm">
          <span>Trimestre cerrado — solo lectura.</span>
        </div>

        <!-- Encabezado planilla -->
        <div class="card bg-base-100 shadow">
          <div class="card-body py-2 flex flex-wrap gap-4 items-center">
            <span class="text-sm">{{ planilla.trimestre.nombre }}</span>
            <span class="text-sm text-base-content/50">{{ planilla.notasRegistradas }} / {{ planilla.totalEstudiantes }} notas ingresadas</span>
            <span class="badge ml-auto" :class="trimCerrado ? 'badge-ghost' : 'badge-primary'">
              {{ trimCerrado ? '🔒 Cerrado' : '✏️ Editable' }}
            </span>
          </div>
        </div>

        <!-- Tabla de notas -->
        <div class="card bg-base-100 shadow overflow-x-auto">
          <table class="table">
            <thead>
              <tr><th>#</th><th>Estudiante</th><th>CI</th><th>Nota (1–100)</th><th>Estado</th></tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in planilla.planilla" :key="item.inscripcionId" class="hover">
                <td class="text-base-content/40 text-sm">{{ idx + 1 }}</td>
                <td class="font-medium">{{ item.estudiante.apellido }}, {{ item.estudiante.nombre }}</td>
                <td class="font-mono text-sm text-base-content/60">{{ item.estudiante.ci }}</td>
                <td>
                  <div class="space-y-1">
                    <input
                      v-model="notasLocales[item.inscripcionId]"
                      type="number" min="1" max="100" step="0.5"
                      placeholder="—"
                      class="input input-bordered input-sm w-24"
                      :class="claseNota(notasLocales[item.inscripcionId])"
                      :disabled="trimCerrado"
                    />
                    <p v-if="erroresNota[item.inscripcionId]" class="text-xs text-error">
                      {{ erroresNota[item.inscripcionId] }}
                    </p>
                  </div>
                </td>
                <td>
                  <span v-if="notasLocales[item.inscripcionId]" class="badge badge-sm"
                    :class="Number(notasLocales[item.inscripcionId]) >= 51 ? 'badge-success' : 'badge-error'">
                    {{ Number(notasLocales[item.inscripcionId]) >= 51 ? 'Aprobado' : 'Reprobado' }}
                  </span>
                  <span v-else class="text-base-content/30 text-sm">Sin nota</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Stats + guardar -->
        <div class="flex flex-wrap items-center gap-3">
          <template v-if="stats">
            <span class="badge badge-outline">Promedio: {{ stats.promedio }}</span>
            <span class="badge badge-success badge-outline">Aprobados: {{ stats.aprobados }}</span>
            <span class="badge badge-error badge-outline">Reprobados: {{ stats.reprobados }}</span>
          </template>
          <button v-if="!trimCerrado" class="btn btn-primary ml-auto"
            :disabled="guardando || hayErrores" @click="guardar">
            <span v-if="guardando" class="loading loading-spinner loading-sm"></span>
            Guardar calificaciones
          </button>
        </div>
      </template>

      <div v-else-if="!cargando && asignacion" class="text-center text-base-content/40 py-8">
        Seleccioná un trimestre para cargar la planilla
      </div>

    </template>
  </div>
</template>