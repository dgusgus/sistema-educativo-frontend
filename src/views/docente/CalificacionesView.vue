<script setup lang="ts">
import { ref, computed } from 'vue'
import { calificacionApi, type PlanillaResponse, type PlanillaItem, type NotaPayload } from '@/api/calificacion.api'

const docenteMateriaCursoId = ref<number | ''>('')
const trimestreId           = ref<number | ''>('')
const planilla   = ref<PlanillaResponse | null>(null)
const cargando   = ref(false)
const guardando  = ref(false)
const error      = ref<string | null>(null)
const exito      = ref(false)

// notasLocales: inscripcionId → string (para que el input sea editable)
const notasLocales = ref<Record<number, string>>({})

const trimCerrado = computed(() => planilla.value?.trimestreCerrado ?? false)

async function cargar() {
  if (!docenteMateriaCursoId.value || !trimestreId.value) {
    error.value = 'Completá ambos campos'
    return
  }
  cargando.value = true
  error.value = null
  exito.value = false
  planilla.value = null

  try {
    planilla.value = await calificacionApi.getPlanilla(
      Number(docenteMateriaCursoId.value),
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

function notaValida(valor: string): boolean {
  if (valor === '' || valor === undefined) return true // vacío es permitido (sin nota)
  const n = Number(valor)
  return !isNaN(n) && n >= 1 && n <= 100
}

const erroresNota = computed(() => {
  if (!planilla.value) return {}
  const errs: Record<number, string> = {}
  planilla.value.planilla.forEach(item => {
    const v = notasLocales.value[item.inscripcionId]
    if (v !== '' && v !== undefined && !notaValida(v)) {
      errs[item.inscripcionId] = 'Debe ser 1–100'
    }
  })
  return errs
})

const hayErrores = computed(() => Object.keys(erroresNota.value).length > 0)

function claseNota(valor: string): string {
  if (!valor) return ''
  const n = Number(valor)
  if (isNaN(n)) return 'input-error'
  if (n >= 71) return 'input-success'
  if (n >= 51) return 'input-warning'
  return 'input-error'
}

async function guardar() {
  if (!planilla.value || trimCerrado.value || hayErrores.value) return

  const notas: NotaPayload[] = planilla.value.planilla
    .filter(item => notasLocales.value[item.inscripcionId] !== '')
    .map(item => ({
      inscripcionId: item.inscripcionId,
      nota: Number(notasLocales.value[item.inscripcionId]),
    }))

  if (notas.length === 0) { error.value = 'Ingresá al menos una nota'; return }

  guardando.value = true
  error.value = null
  exito.value = false
  try {
    await calificacionApi.guardarPlanilla(
      Number(docenteMateriaCursoId.value),
      Number(trimestreId.value),
      notas,
    )
    exito.value = true
    await cargar() // recargar para mostrar el estado actualizado
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
  const promedio   = notas.reduce((a, b) => a + b, 0) / notas.length
  const aprobados  = notas.filter(n => n >= 51).length
  return { promedio: promedio.toFixed(1), aprobados, reprobados: notas.length - aprobados, total: notas.length }
})
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-2xl font-bold">Planilla de Calificaciones</h2>

    <div class="card bg-base-100 shadow">
      <div class="card-body flex flex-col sm:flex-row gap-3 items-end">
        <fieldset class="fieldset flex-1">
          <legend class="fieldset-legend text-xs">ID Asignación (docenteMateriaCursoId)</legend>
          <input v-model="docenteMateriaCursoId" type="number" min="1" placeholder="Ej: 4"
            class="input input-bordered w-full" />
        </fieldset>
        <fieldset class="fieldset flex-1">
          <legend class="fieldset-legend text-xs">ID Trimestre</legend>
          <input v-model="trimestreId" type="number" min="1" placeholder="Ej: 1"
            class="input input-bordered w-full" />
        </fieldset>
        <button class="btn btn-primary" :disabled="cargando" @click="cargar">
          <span v-if="cargando" class="loading loading-spinner loading-sm"></span>
          Cargar planilla
        </button>
      </div>
    </div>

    <div v-if="error" role="alert" class="alert alert-error"><span>{{ error }}</span></div>
    <div v-if="exito" role="alert" class="alert alert-success"><span>Notas guardadas correctamente</span></div>

    <template v-if="planilla">

      <!-- Encabezado planilla -->
      <div class="card bg-base-100 shadow">
        <div class="card-body py-3 flex flex-wrap gap-4 items-center">
          <div><p class="text-xs text-base-content/50">Materia</p><p class="font-semibold">{{ planilla.dmc.materia.nombre }}</p></div>
          <div><p class="text-xs text-base-content/50">Curso</p><p class="font-semibold">{{ planilla.dmc.curso.nombre }}</p></div>
          <div><p class="text-xs text-base-content/50">Trimestre</p><p class="font-semibold">{{ planilla.trimestre.nombre }}</p></div>
          <div><p class="text-xs text-base-content/50">Gestión</p><p class="font-semibold">{{ planilla.dmc.gestion.anio }}</p></div>
          <span class="badge ml-auto" :class="trimCerrado ? 'badge-ghost' : 'badge-primary'">
            {{ trimCerrado ? '🔒 Cerrado' : '✏️ Editable' }}
          </span>
        </div>
      </div>

      <div v-if="trimCerrado" role="alert" class="alert alert-warning text-sm">
        <span>Trimestre cerrado — notas de solo lectura.</span>
      </div>

      <!-- Tabla -->
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

      <div v-if="stats" class="flex flex-wrap gap-3 text-sm">
        <span class="badge badge-outline">Promedio: {{ stats.promedio }}</span>
        <span class="badge badge-success badge-outline">Aprobados: {{ stats.aprobados }}</span>
        <span class="badge badge-error badge-outline">Reprobados: {{ stats.reprobados }}</span>
      </div>

      <button v-if="!trimCerrado" class="btn btn-primary" :disabled="guardando || hayErrores" @click="guardar">
        <span v-if="guardando" class="loading loading-spinner loading-sm"></span>
        Guardar calificaciones
      </button>

    </template>

    <div v-else-if="!cargando" class="text-center text-base-content/40 py-12">
      Ingresá el ID de asignación y el trimestre para cargar la planilla
    </div>
  </div>
</template>