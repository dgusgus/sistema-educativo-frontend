<script setup lang="ts">
/**
 * DimensionesView — cada GESTIÓN tiene su propio set de dimensiones,
 * independiente de las demás (DimensionEvaluacion está atada a
 * gestionId en el schema). Por eso no hace falta "migrar" nada entre
 * años: una gestión puede tener 4 dimensiones (Ser/Saber/Hacer/Decidir)
 * y la siguiente 3, sin ningún conflicto — simplemente se configuran
 * de cero para cada gestión nueva.
 */
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { gestionApi, type GestionResumen } from '@/api/gestion.api'
import { evaluacionApi, type DimensionPayload } from '@/api/evaluacion.api'
import { useGestionStore } from '@/stores/gestion.store'
import { useConfirm } from '@/composables/useConfirm'
import { useToastStore } from '@/stores/toast.store'
import AppIcon from '@/components/AppIcon.vue'
import type { DimensionEvaluacion } from '@/types'

const gestionStore = useGestionStore()
const { confirmar } = useConfirm()
const toast = useToastStore()

const gestiones           = ref<GestionResumen[]>([])
const gestionSeleccionada = ref<number | ''>('')
const dimensiones         = ref<DimensionEvaluacion[]>([])
const cargando            = ref(true)
const error               = ref<string | null>(null)

onMounted(async () => {
  await gestionStore.cargar()
  gestionSeleccionada.value = gestionStore.gestionId ?? ''
  try {
    gestiones.value = await gestionApi.getAll()
  } catch {
    gestiones.value = []
  }
  await cargarDimensiones()
})

watch(gestionSeleccionada, cargarDimensiones)

async function cargarDimensiones() {
  if (!gestionSeleccionada.value) { dimensiones.value = []; return }
  cargando.value = true
  error.value = null
  try {
    dimensiones.value = await evaluacionApi.getDimensiones(Number(gestionSeleccionada.value))
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar dimensiones'
  } finally {
    cargando.value = false
  }
}

// ─── Suma de porcentajes — el indicador clave de esta pantalla ──────────────
const sumaPorcentaje = computed(() =>
  Math.round(dimensiones.value.reduce((s, d) => s + d.pesoEnPromedio, 0) * 1000) / 10
)
const sumaOk = computed(() => Math.abs(sumaPorcentaje.value - 100) < 0.05)

// Sugerencia para el próximo % al crear una dimensión nueva: lo que falta
// para llegar a 100, o si ya se pasó, 0.
const porcentajeSugerido = computed(() => Math.max(0, Math.round((100 - sumaPorcentaje.value) * 10) / 10))

const distribuyendo = ref(false)
async function distribuirEquitativamente() {
  if (!dimensiones.value.length) return
  distribuyendo.value = true
  error.value = null
  try {
    const pct = 1 / dimensiones.value.length
    await Promise.all(dimensiones.value.map(d => evaluacionApi.updateDimension(d.id, { pesoEnPromedio: pct })))
    await cargarDimensiones()
    toast.success('Porcentajes distribuidos equitativamente')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al distribuir'
  } finally {
    distribuyendo.value = false
  }
}

// ─── Crear/editar ─────────────────────────────────────────────────────────────
const modalAbierto = ref(false)
const guardando    = ref(false)
const errorModal   = ref<string | null>(null)
const idEditando   = ref<number | null>(null)

const formVacio = () => ({ nombre: '', puntajeMaximo: 100, porcentaje: porcentajeSugerido.value, orden: dimensiones.value.length, esAutoevaluada: false })
const form = ref(formVacio())

const dialogoDimension = ref<HTMLDialogElement | null>(null)
const inputNombreDimension = ref<HTMLInputElement | null>(null)
let focoPrevio: HTMLElement | null = null

function abrirModal() {
  focoPrevio = document.activeElement as HTMLElement | null
  errorModal.value = null
  modalAbierto.value = true
}

function cerrarModal() {
  modalAbierto.value = false
  focoPrevio?.focus?.()
}

watch(modalAbierto, async (abierto) => {
  if (!abierto) return
  await nextTick()
  inputNombreDimension.value?.focus()
})

function atraparTeclas(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    cerrarModal()
    return
  }
  if (e.key !== 'Tab' || !dialogoDimension.value) return
  const focos = Array.from(
    dialogoDimension.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )
  ).filter(el => el.offsetParent !== null)
  if (!focos.length) return
  const primero = focos[0]
  const ultimo = focos[focos.length - 1]
  if (e.shiftKey && document.activeElement === primero) {
    e.preventDefault()
    ultimo.focus()
  } else if (!e.shiftKey && document.activeElement === ultimo) {
    e.preventDefault()
    primero.focus()
  }
}

function abrirCrear() {
  idEditando.value = null
  form.value = formVacio()
  abrirModal()
}

function abrirEditar(d: DimensionEvaluacion) {
  idEditando.value = d.id
  form.value = {
    nombre: d.nombre, puntajeMaximo: d.puntajeMaximo,
    porcentaje: Math.round(d.pesoEnPromedio * 1000) / 10,
    orden: d.orden, esAutoevaluada: d.esAutoevaluada,
  }
  abrirModal()
}

async function guardar() {
  if (!form.value.nombre.trim()) { errorModal.value = 'El nombre es obligatorio'; return }
  if (form.value.porcentaje < 0 || form.value.porcentaje > 100) { errorModal.value = 'El porcentaje debe estar entre 0 y 100'; return }
  if (!gestionSeleccionada.value) return

  guardando.value = true
  errorModal.value = null
  try {
    const pesoEnPromedio = form.value.porcentaje / 100
    if (idEditando.value) {
      const actualizada = await evaluacionApi.updateDimension(idEditando.value, {
        nombre: form.value.nombre.trim(), puntajeMaximo: form.value.puntajeMaximo,
        pesoEnPromedio, orden: form.value.orden, esAutoevaluada: form.value.esAutoevaluada,
      })
      const idx = dimensiones.value.findIndex(d => d.id === idEditando.value)
      if (idx !== -1) dimensiones.value[idx] = actualizada
      toast.success('Dimensión actualizada')
    } else {
      const payload: DimensionPayload = {
        gestionId: Number(gestionSeleccionada.value),
        nombre: form.value.nombre.trim(), puntajeMaximo: form.value.puntajeMaximo,
        pesoEnPromedio, orden: form.value.orden, esAutoevaluada: form.value.esAutoevaluada,
      }
      const nueva = await evaluacionApi.createDimension(payload)
      dimensiones.value.push(nueva)
      toast.success('Dimensión creada')
    }
    modalAbierto.value = false
  } catch (e) {
    errorModal.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    guardando.value = false
  }
}

const eliminando = ref<number | null>(null)
async function eliminar(d: DimensionEvaluacion) {
  const ok = await confirmar({ mensaje: `¿Eliminar la dimensión "${d.nombre}"?`, peligroso: true })
  if (!ok) return
  eliminando.value = d.id
  try {
    await evaluacionApi.deleteDimension(d.id)
    dimensiones.value = dimensiones.value.filter(x => x.id !== d.id)
    toast.success('Dimensión eliminada')
  } catch (e) {
    // El backend avisa si ya tiene actividades evaluativas registradas —
    // más útil que un mensaje genérico
    error.value = e instanceof Error ? e.message : 'Error al eliminar'
  } finally {
    eliminando.value = null
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h2 class="font-display text-2xl font-bold tracking-tight">Dimensiones de Evaluación</h2>
      <p class="mt-0.5 text-sm text-base-content/60">Ser / Saber / Hacer / Decidir — configurables por gestión, con pesos que deben sumar 100%.</p>
    </div>

    <div class="flex flex-wrap gap-3 items-end">
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">Gestión</legend>
        <select v-model="gestionSeleccionada" class="select select-bordered" aria-label="Gestión">
          <option value="" disabled>Seleccionar</option>
          <option v-for="g in gestiones" :key="g.id" :value="g.id">{{ g.anio }} {{ g.activa ? '(activa)' : '' }}</option>
        </select>
      </fieldset>
      <button class="btn btn-primary min-h-11" :disabled="!gestionSeleccionada" @click="abrirCrear">
        <AppIcon nombre="agregar" class="h-4 w-4" />
        Nueva dimensión
      </button>
      <button
        class="btn btn-outline min-h-11"
        :disabled="!dimensiones.length || distribuyendo"
        @click="distribuirEquitativamente"
      >
        <span v-if="distribuyendo" class="loading loading-spinner loading-xs"></span>
        Distribuir equitativamente
      </button>
    </div>

    <!-- Indicador de suma — el punto central de esta pantalla -->
    <div v-if="dimensiones.length" role="alert" class="alert" :class="sumaOk ? 'alert-success' : 'alert-warning'">
      <span>
        Suma actual: <strong>{{ sumaPorcentaje }}%</strong>
        <template v-if="!sumaOk"> — {{ sumaPorcentaje > 100 ? `sobran ${(sumaPorcentaje - 100).toFixed(1)}%` : `faltan ${(100 - sumaPorcentaje).toFixed(1)}%` }} para llegar a 100%</template>
        <template v-else> — perfecto, cierra en 100%</template>
      </span>
    </div>

    <div v-if="error" role="alert" class="alert alert-error">
      <span class="flex-1">{{ error }}</span>
      <button type="button" class="btn btn-sm btn-ghost min-h-11" @click="cargarDimensiones">Reintentar</button>
    </div>

    <div class="card bg-base-100 shadow overflow-x-auto">
      <table class="table table-sm">
        <thead><tr><th>Orden</th><th>Nombre</th><th>Puntaje máx.</th><th>Peso</th><th>Autoevaluada</th><th>Acciones</th></tr></thead>
        <tbody>
          <tr v-if="cargando" v-for="i in 4" :key="i"><td colspan="6"><div class="skeleton h-4 w-full"></div></td></tr>
          <tr v-else-if="!gestionSeleccionada">
            <td colspan="6" class="text-center text-base-content/40 py-8">Seleccioná una gestión</td>
          </tr>
          <tr v-else-if="dimensiones.length === 0">
            <td colspan="6" class="text-center text-base-content/40 py-8">
              Sin dimensiones configuradas todavía para esta gestión — creá la primera (ej. "Ser", 10%).
            </td>
          </tr>
          <tr v-else v-for="d in dimensiones.slice().sort((a,b) => a.orden - b.orden)" :key="d.id" class="hover">
            <td class="text-center text-base-content/40">{{ d.orden }}</td>
            <td class="font-medium">{{ d.nombre }}</td>
            <td class="text-center">{{ d.puntajeMaximo }}</td>
            <td class="text-center font-semibold">{{ (d.pesoEnPromedio * 100).toFixed(1) }}%</td>
            <td class="text-center">
              <span v-if="d.esAutoevaluada" class="badge badge-sm badge-info">Sí</span>
              <span v-else class="text-base-content/30 text-xs">No</span>
            </td>
            <td>
              <div class="flex gap-1">
                <button class="btn btn-ghost btn-sm min-h-11" @click="abrirEditar(d)">Editar</button>
                <button class="btn btn-ghost btn-sm min-h-11 text-error" :disabled="eliminando === d.id" @click="eliminar(d)">
                  <span v-if="eliminando === d.id" class="loading loading-xs loading-spinner"></span>
                  <span v-else>Eliminar</span>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Modal crear/editar -->
  <dialog ref="dialogoDimension" :open="modalAbierto" class="modal modal-bottom sm:modal-middle"
    role="dialog" aria-modal="true" aria-labelledby="dimension-titulo" @keydown="atraparTeclas">
    <div class="modal-box">
      <h3 id="dimension-titulo" class="font-bold text-lg mb-4">{{ idEditando ? 'Editar dimensión' : 'Nueva dimensión' }}</h3>
      <div v-if="errorModal" role="alert" class="alert alert-error mb-4 py-2 text-sm"><span>{{ errorModal }}</span></div>
      <form class="space-y-3" @submit.prevent="guardar">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Nombre *</legend>
          <input ref="inputNombreDimension" v-model="form.nombre" type="text" placeholder="Ej: Ser, Saber, Hacer, Decidir" class="input input-bordered w-full" :disabled="guardando" />
        </fieldset>
        <div class="grid grid-cols-2 gap-3">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Puntaje máximo</legend>
            <input v-model.number="form.puntajeMaximo" type="number" min="1" class="input input-bordered w-full" :disabled="guardando" />
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Peso en el promedio (%) *</legend>
            <input v-model.number="form.porcentaje" type="number" min="0" max="100" step="0.1" class="input input-bordered w-full" :disabled="guardando" />
            <p v-if="!idEditando" class="text-xs text-base-content/40 mt-1">Sugerido: {{ porcentajeSugerido }}% (lo que falta para 100%)</p>
          </fieldset>
        </div>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Orden</legend>
          <input v-model.number="form.orden" type="number" min="0" class="input input-bordered w-full" :disabled="guardando" />
        </fieldset>
        <label class="label cursor-pointer justify-start gap-2">
          <input v-model="form.esAutoevaluada" type="checkbox" class="checkbox checkbox-sm" />
          <span class="text-sm">Es autoevaluada por el estudiante</span>
        </label>
        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="guardando" @click="cerrarModal">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="guardando">
            <span v-if="guardando" class="loading loading-spinner loading-sm"></span>
            {{ idEditando ? 'Guardar cambios' : 'Crear dimensión' }}
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="cerrarModal"><button>cerrar</button></form>
  </dialog>
</template>