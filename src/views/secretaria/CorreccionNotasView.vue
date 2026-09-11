<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useGestionStore } from '@/stores/gestion.store'
import { cursoApi } from '@/api/estructura.api'
import { calificacionApi, type PlanillaResponse, type PlanillaItem, type HistorialItem } from '@/api/calificacion.api'
import { useToastStore } from '@/stores/toast.store'

const toast = useToastStore()

// ⚠️ Solo tiene sentido corregir un promedio con el trimestre CERRADO — con
// el trimestre abierto, la nota se corrige registrando/editando la
// actividad evaluativa correspondiente (eso lo hace el docente en
// CalificacionesView, dispara recálculo automático). Este flujo es la
// corrección MANUAL, auditada, para después del cierre.

const gestion = useGestionStore()
onMounted(() => gestion.cargar())

// ── Selección: curso → asignación (materia+docente) → trimestre cerrado ──────
const cursoId = ref<number | ''>('')
interface AsignacionCurso {
  id: number
  materia: { id: number; nombre: string }
  docente: { id: number; nombre: string; apellido: string }
}
const asignaciones      = ref<AsignacionCurso[]>([])
const cargandoAsig      = ref(false)
const dmcId              = ref<number | ''>('')
const trimestreId        = ref<number | ''>('')

watch(cursoId, async (id) => {
  asignaciones.value = []
  dmcId.value = ''
  planilla.value = null
  if (!id) return
  cargandoAsig.value = true
  try {
    const curso = await cursoApi.getById(Number(id))
    asignaciones.value = curso.asignaciones.map(a => ({
      id: a.id, materia: a.materia, docente: { id: a.docente.id, nombre: a.docente.nombre, apellido: a.docente.apellido },
    }))
  } catch {
    asignaciones.value = []
  } finally {
    cargandoAsig.value = false
  }
})

const trimestresCerrados = computed(() => gestion.trimestres.filter(t => t.cerrado))

// ── Planilla ──────────────────────────────────────────────────────────────────
const planilla  = ref<PlanillaResponse | null>(null)
const cargando  = ref(false)
const error     = ref<string | null>(null)

async function cargarPlanilla() {
  if (!dmcId.value || !trimestreId.value) {
    error.value = 'Elegí materia/docente y trimestre'
    return
  }
  cargando.value = true
  error.value = null
  try {
    planilla.value = await calificacionApi.getPlanilla(Number(dmcId.value), Number(trimestreId.value))
    if (!planilla.value.trimestreCerrado) {
      error.value = 'Este trimestre no está cerrado — la corrección manual solo aplica después del cierre.'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar la planilla'
  } finally {
    cargando.value = false
  }
}

// ── Modal de corrección ────────────────────────────────────────────────────────
const modalAbierto  = ref(false)
const alumnoActivo  = ref<PlanillaItem | null>(null)
const historial     = ref<HistorialItem[]>([])
const cargandoHist  = ref(false)
const nuevoPromedio = ref<number | ''>('')
const motivo         = ref('')
const guardando       = ref(false)
const errorModal      = ref<string | null>(null)

async function abrirCorreccion(item: PlanillaItem) {
  if (!item.calificacionId) return
  alumnoActivo.value  = item
  nuevoPromedio.value = item.promedio ?? ''
  motivo.value        = ''
  errorModal.value    = null
  historial.value     = []
  modalAbierto.value  = true

  cargandoHist.value = true
  try {
    historial.value = await calificacionApi.getHistorial(item.calificacionId)
  } catch {
    historial.value = []
  } finally {
    cargandoHist.value = false
  }
}

async function guardarCorreccion() {
  if (!alumnoActivo.value?.calificacionId) return
  if (nuevoPromedio.value === '' || Number(nuevoPromedio.value) < 0 || Number(nuevoPromedio.value) > 100) {
    errorModal.value = 'El promedio debe estar entre 0 y 100'
    return
  }
  if (!motivo.value.trim()) {
    errorModal.value = 'El motivo es obligatorio — queda registrado en el historial'
    return
  }
  guardando.value = true
  errorModal.value = null
  try {
    await calificacionApi.corregirPromedio(alumnoActivo.value.calificacionId, Number(nuevoPromedio.value), motivo.value.trim())
    modalAbierto.value = false
    toast.success('Corrección guardada')
    await cargarPlanilla()
  } catch (e) {
    errorModal.value = e instanceof Error ? e.message : 'Error al corregir'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-2xl font-bold">Corrección de Notas</h2>
    <p class="text-sm text-base-content/60">
      Corrección manual de promedios con el trimestre ya cerrado — queda registrada con motivo en el historial.
    </p>

    <!-- Selección -->
    <div class="card bg-base-100 shadow">
      <div class="card-body py-3 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Curso</legend>
          <select v-model="cursoId" class="select select-bordered w-full">
            <option value="" disabled>Seleccionar curso</option>
            <option v-for="c in gestion.cursos" :key="c.id" :value="c.id">{{ c.nombre }}</option>
          </select>
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Materia / Docente</legend>
          <select v-model="dmcId" class="select select-bordered w-full" :disabled="!cursoId || cargandoAsig">
            <option value="" disabled>{{ cargandoAsig ? 'Cargando...' : 'Seleccionar' }}</option>
            <option v-for="a in asignaciones" :key="a.id" :value="a.id">
              {{ a.materia.nombre }} — {{ a.docente.nombre }} {{ a.docente.apellido }}
            </option>
          </select>
          <p v-if="cursoId && !cargandoAsig && !asignaciones.length" class="text-xs text-base-content/40 mt-1">
            Este curso no tiene materias asignadas.
          </p>
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Trimestre (solo cerrados)</legend>
          <select v-model="trimestreId" class="select select-bordered w-full">
            <option value="" disabled>Seleccionar</option>
            <option v-for="t in trimestresCerrados" :key="t.id" :value="t.id">{{ t.nombre }}</option>
          </select>
          <p v-if="!trimestresCerrados.length" class="text-xs text-base-content/40 mt-1">
            Ningún trimestre cerrado todavía.
          </p>
        </fieldset>

        <button class="btn btn-primary" :disabled="cargando || !dmcId || !trimestreId" @click="cargarPlanilla">
          <span v-if="cargando" class="loading loading-spinner loading-sm"></span>
          Cargar planilla
        </button>
      </div>
    </div>

    <div v-if="error" role="alert" class="alert" :class="error.includes('cerrado') ? 'alert-warning' : 'alert-error'">
      <span>{{ error }}</span>
    </div>

    <!-- Planilla -->
    <div v-if="planilla && planilla.trimestreCerrado" class="card bg-base-100 shadow overflow-x-auto">
      <div class="card-body">
        <table class="table table-sm">
          <thead><tr><th>Estudiante</th><th>Promedio actual</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            <tr v-for="item in planilla.planilla" :key="item.inscripcionId" class="hover">
              <td class="font-medium">{{ item.estudiante.apellido }}, {{ item.estudiante.nombre }}</td>
              <td class="font-semibold">{{ item.promedio !== null ? item.promedio.toFixed(1) : '—' }}</td>
              <td>
                <span v-if="item.promedio !== null" class="badge badge-sm" :class="item.promedio >= 51 ? 'badge-success' : 'badge-error'">
                  {{ item.promedio >= 51 ? 'Aprobado' : 'Reprobado' }}
                </span>
              </td>
              <td>
                <button class="btn btn-ghost btn-xs" :disabled="!item.calificacionId" @click="abrirCorreccion(item)">
                  Corregir
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Modal de corrección -->
  <dialog :open="modalAbierto" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Corregir promedio</h3>
      <p class="text-sm text-base-content/60 mb-4">
        {{ alumnoActivo?.estudiante.apellido }}, {{ alumnoActivo?.estudiante.nombre }}
        — actual: <strong>{{ alumnoActivo?.promedio?.toFixed(1) ?? '—' }}</strong>
      </p>

      <div v-if="errorModal" role="alert" class="alert alert-error mb-4 py-2 text-sm"><span>{{ errorModal }}</span></div>

      <form class="space-y-3" @submit.prevent="guardarCorreccion">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Nuevo promedio (0–100) *</legend>
          <input v-model.number="nuevoPromedio" type="number" min="0" max="100" step="0.1"
            class="input input-bordered w-full" :disabled="guardando" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Motivo * (queda en el historial)</legend>
          <textarea v-model="motivo" class="textarea textarea-bordered w-full" rows="2"
            placeholder="Ej: Error de transcripción en examen final" :disabled="guardando"></textarea>
        </fieldset>

        <div class="modal-action mt-4">
          <button type="button" class="btn btn-ghost" :disabled="guardando" @click="modalAbierto = false">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="guardando">
            <span v-if="guardando" class="loading loading-spinner loading-sm"></span>
            Guardar corrección
          </button>
        </div>
      </form>

      <!-- Historial -->
      <div class="divider text-xs mt-6">Historial de correcciones</div>
      <div v-if="cargandoHist" class="skeleton h-16 rounded-lg"></div>
      <div v-else-if="historial.length" class="space-y-2 max-h-48 overflow-y-auto">
        <div v-for="h in historial" :key="h.id" class="text-sm border-l-2 border-base-300 pl-3 py-1">
          <p>
            <span class="font-mono">{{ h.promedioAnterior ?? '—' }}</span>
            →
            <span class="font-mono font-semibold">{{ h.promedioNuevo }}</span>
            <span class="text-base-content/50 ml-2">{{ new Date(h.fecha).toLocaleDateString('es-BO') }}</span>
          </p>
          <p class="text-base-content/60">{{ h.motivo }} — <span class="italic">{{ h.usuario.username }}</span></p>
        </div>
      </div>
      <p v-else class="text-sm text-base-content/40">Sin correcciones previas.</p>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalAbierto = false"><button>cerrar</button></form>
  </dialog>
</template>