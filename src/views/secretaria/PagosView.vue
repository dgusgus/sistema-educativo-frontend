<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { pagoApi, type PagosInscripcionResponse, type PagoPayload, type ConceptoPago } from '@/api/pago.api'
import { useBuscadorEstudiante } from '@/composables/useBuscadorEstudiante'
import { useGestionStore } from '@/stores/gestion.store'
import { useConfirm } from '@/composables/useConfirm'
import { useToastStore } from '@/stores/toast.store'
import type { Nivel } from '@/types'

const { confirmar } = useConfirm()
const toast = useToastStore()

const gestion = useGestionStore()
const buscador = useBuscadorEstudiante()

onMounted(() => gestion.cargar())

// La inscripción activa es la más reciente del estudiante elegido — el
// buscador ya trae take:1 ordenado por gestión desc, así que alcanza con
// el primero. Si el estudiante no tiene inscripción, no hay nada que cobrar.
const inscripcionId = computed(() => buscador.seleccionado.value?.inscripciones?.[0]?.id ?? null)

const NIVEL_TEXTO: Record<Nivel, string> = { PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
const cursoDelSeleccionado = computed(() => {
  const c = buscador.seleccionado.value?.inscripciones?.[0]?.curso
  return c ? `${c.grado}° ${NIVEL_TEXTO[c.nivel]} "${c.paralelo}"` : null
})

const datos     = ref<PagosInscripcionResponse | null>(null)
const cargando  = ref(false)
const error     = ref<string | null>(null)

// Al elegir un estudiante con inscripción, se carga solo — sin botón extra
watch(inscripcionId, async (id) => {
  datos.value = null
  error.value = null
  if (!id) return
  cargando.value = true
  try {
    datos.value = await pagoApi.getDeInscripcion(id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar pagos'
  } finally {
    cargando.value = false
  }
})

async function recargar() {
  if (!inscripcionId.value) return
  cargando.value = true
  try {
    datos.value = await pagoApi.getDeInscripcion(inscripcionId.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar pagos'
  } finally {
    cargando.value = false
  }
}

// ── Modal registrar pago ──────────────────────────────────────────────────────
const modalAbierto = ref(false)
const guardando    = ref(false)
const errorModal   = ref<string | null>(null)

const formVacio = (): PagoPayload => ({
  inscripcionId:  0,
  conceptoPagoId: 0,
  montoPagado:    0,
  metodoPago:     'EFECTIVO',
  observaciones:  '',
})
const form = ref<PagoPayload>(formVacio())

function abrirModal(conceptoPagoId = 0, monto = 0) {
  if (!inscripcionId.value) return
  form.value = { ...formVacio(), inscripcionId: inscripcionId.value, conceptoPagoId, montoPagado: monto }
  errorModal.value = null
  modalAbierto.value = true
}

async function registrar() {
  if (!form.value.conceptoPagoId) { errorModal.value = 'Seleccioná un concepto'; return }
  if (form.value.montoPagado <= 0) { errorModal.value = 'El monto debe ser mayor a 0'; return }
  guardando.value = true
  errorModal.value = null
  try {
    await pagoApi.registrar(form.value)
    modalAbierto.value = false
    toast.success('Pago registrado')
    await recargar()
  } catch (e) {
    errorModal.value = e instanceof Error ? e.message : 'Error al registrar'
  } finally {
    guardando.value = false
  }
}

// ── Anular ────────────────────────────────────────────────────────────────────
const anulando = ref<number | null>(null)

async function anular(id: number) {
  const ok = await confirmar({ mensaje: '¿Anular este pago? Quedará en el historial como ANULADO.', peligroso: true })
  if (!ok) return
  anulando.value = id
  try {
    await pagoApi.anular(id)
    await recargar()
    toast.success('Pago anulado')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al anular'
  } finally {
    anulando.value = null
  }
}

const badgeEstado: Record<string, string> = {
  PAGADO:   'badge-success',
  PENDIENTE:'badge-warning',
  ANULADO:  'badge-ghost',
}

// ── Conceptos de pago (gestión aparte — usaba una API que no se llamaba
// desde ningún lado) ──────────────────────────────────────────────────────
const modalConceptos    = ref(false)
const conceptos         = ref<ConceptoPago[]>([])
const cargandoConceptos = ref(false)
const guardandoConcepto = ref(false)
const errorConcepto     = ref<string | null>(null)

const formConcepto = ref({ nombre: '', descripcion: '', monto: 0, obligatorio: true, fechaVencimiento: '' })

async function abrirConceptos() {
  modalConceptos.value = true
  errorConcepto.value  = null
  if (!gestion.gestionId) return
  cargandoConceptos.value = true
  try {
    conceptos.value = await pagoApi.getConceptos(gestion.gestionId)
  } catch (e) {
    errorConcepto.value = e instanceof Error ? e.message : 'Error al cargar conceptos'
  } finally {
    cargandoConceptos.value = false
  }
}

async function crearConcepto() {
  if (!formConcepto.value.nombre || formConcepto.value.monto <= 0) {
    errorConcepto.value = 'Nombre y monto (mayor a 0) son obligatorios'
    return
  }
  if (!gestion.gestionId) return
  guardandoConcepto.value = true
  errorConcepto.value     = null
  try {
    const nuevo = await pagoApi.crearConcepto({
      nombre:            formConcepto.value.nombre,
      descripcion:       formConcepto.value.descripcion || undefined,
      monto:             formConcepto.value.monto,
      obligatorio:       formConcepto.value.obligatorio,
      gestionId:         gestion.gestionId,
      fechaVencimiento:  formConcepto.value.fechaVencimiento || undefined,
    })
    conceptos.value.push(nuevo)
    formConcepto.value = { nombre: '', descripcion: '', monto: 0, obligatorio: true, fechaVencimiento: '' }
    toast.success('Concepto de pago creado')
  } catch (e) {
    errorConcepto.value = e instanceof Error ? e.message : 'Error al crear concepto'
  } finally {
    guardandoConcepto.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold">Pagos</h2>
      <button class="btn btn-outline btn-sm" @click="abrirConceptos">
        Conceptos de pago
      </button>
    </div>

    <!-- Buscador de estudiante -->
    <div class="card bg-base-100 shadow">
      <div class="card-body py-3">
        <div class="relative max-w-md">
         <label class="input input-bordered flex items-center gap-2">
            <AppIcon nombre="buscar" class="h-4 w-4 opacity-50" />
            <input
              v-model="buscador.query.value"
              type="search"
              placeholder="Buscar estudiante por nombre o CI..."
              class="grow"
              @input="buscador.onInput"
            />
            <span v-if="buscador.buscando.value" class="loading loading-spinner loading-xs"></span>
          </label>

          <!-- Dropdown de resultados -->
          <ul v-if="buscador.resultados.value.length"
            class="absolute z-10 mt-1 w-full bg-base-100 rounded-box shadow-lg border border-base-300 max-h-64 overflow-y-auto">
            <li v-for="e in buscador.resultados.value" :key="e.id">
              <button
                class="w-full text-left px-4 py-2 hover:bg-base-200 flex justify-between items-center"
                @click="buscador.seleccionar(e)"
              >
                <span>{{ e.apellido }}, {{ e.nombre }}</span>
                <span class="font-mono text-xs text-base-content/50">{{ e.ci }}</span>
              </button>
            </li>
          </ul>
        </div>

        <!-- Info del seleccionado -->
        <div v-if="buscador.seleccionado.value" class="flex flex-wrap gap-6 items-center mt-3 pt-3 border-t border-base-300">
          <div>
            <p class="text-xs text-base-content/50">Estudiante</p>
            <p class="font-semibold">{{ buscador.seleccionado.value.nombre }} {{ buscador.seleccionado.value.apellido }}</p>
          </div>
          <div>
            <p class="text-xs text-base-content/50">Curso</p>
            <p class="font-semibold">{{ cursoDelSeleccionado ?? 'Sin inscripción activa' }}</p>
          </div>
          <button class="btn btn-ghost btn-xs ml-auto" @click="buscador.limpiar">Cambiar estudiante</button>
        </div>
      </div>
    </div>

    <div v-if="error" role="alert" class="alert alert-error"><span>{{ error }}</span></div>

    <div v-if="buscador.seleccionado.value && !inscripcionId" role="alert" class="alert alert-warning text-sm">
      <span>Este estudiante no tiene una inscripción activa en la gestión actual — no se pueden registrar pagos.</span>
    </div>

    <div v-if="cargando" class="skeleton h-32 rounded-xl"></div>

    <template v-if="datos">

      <!-- Resumen -->
      <div class="card bg-base-100 shadow">
        <div class="card-body py-3 flex flex-wrap gap-6 items-center">
          <div>
            <p class="text-xs text-base-content/50">Gestión</p>
            <p class="font-semibold">{{ datos.inscripcion.gestion.anio }}</p>
          </div>
          <div class="ml-auto text-right">
            <p class="text-xs text-base-content/50">Saldo pendiente</p>
            <p class="text-2xl font-bold" :class="datos.resumen.alDia ? 'text-success' : 'text-error'">
              Bs. {{ datos.resumen.saldo.toLocaleString('es-BO') }}
            </p>
            <StatusBadge :estado="datos.resumen.alDia ? 'AL_DIA' : 'MOROSO'" :texto="datos.resumen.alDia ? 'Al día' : 'Con deuda'" />
          </div>
        </div>
      </div>

      <!-- Estado por concepto -->
      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <h3 class="font-semibold mb-3">Estado por concepto</h3>
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr><th>Concepto</th><th>Monto</th><th>Estado</th><th>Recibo</th><th></th></tr>
              </thead>
              <tbody>
                <tr v-for="c in datos.estadoPorConcepto" :key="c.concepto.id" class="hover">
                  <td>
                    {{ c.concepto.nombre }}
                    <span v-if="c.obligatorio" class="badge badge-xs badge-ghost ml-1">obligatorio</span>
                  </td>
                  <td>Bs. {{ c.concepto.monto }}</td>
                  <td>
                    <StatusBadge :estado="c.estado" />
                  </td>
                  <td class="font-mono text-xs text-base-content/60">{{ c.numeroRecibo ?? '—' }}</td>
                  <td>
                    <button v-if="c.estado === 'PENDIENTE'"
                      class="btn btn-primary btn-xs"
                      @click="abrirModal(c.concepto.id, c.concepto.monto)">
                      Pagar
                    </button>
                  </td>
                </tr>
                <tr v-if="!datos.estadoPorConcepto.length">
                  <td colspan="5" class="text-center text-base-content/40 py-4">
                    No hay conceptos de pago definidos para esta gestión —
                    <button class="link link-primary" @click="abrirConceptos">creá uno</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Historial -->
      <div class="card bg-base-100 shadow overflow-x-auto">
        <div class="card-body">
          <h3 class="font-semibold mb-3">Historial de pagos</h3>
          <table class="table table-sm">
            <thead>
              <tr><th>Recibo</th><th>Concepto</th><th>Monto</th><th>Método</th><th>Fecha</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-if="datos.historialPagos.length === 0">
                <td colspan="7" class="text-center text-base-content/40 py-6">Sin pagos registrados</td>
              </tr>
              <tr v-else v-for="p in datos.historialPagos" :key="p.id" class="hover"
                :class="p.estado === 'ANULADO' ? 'opacity-50' : ''">
                <td class="font-mono text-xs">{{ p.numeroRecibo ?? '—' }}</td>
                <td>{{ p.conceptoPago.nombre }}</td>
                <td class="font-semibold">Bs. {{ p.montoPagado.toLocaleString('es-BO') }}</td>
                <td class="text-sm">{{ p.metodoPago }}</td>
                <td class="text-sm text-base-content/60">{{ new Date(p.fechaPago).toLocaleDateString('es-BO') }}</td>
                <td><StatusBadge :estado="p.estado" /></td>
                <td>
                  <button v-if="p.estado === 'PAGADO'"
                    class="btn btn-ghost btn-xs text-error"
                    :disabled="anulando === p.id"
                    @click="anular(p.id)">
                    <span v-if="anulando === p.id" class="loading loading-xs loading-spinner"></span>
                    <span v-else>Anular</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </template>

    <div v-else-if="!cargando && !buscador.seleccionado.value" class="text-center text-base-content/40 py-12">
      Buscá un estudiante para ver su estado de pagos
    </div>
  </div>

  <!-- Modal registrar pago -->
  <dialog :open="modalAbierto" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">Registrar pago</h3>
      <div v-if="errorModal" role="alert" class="alert alert-error mb-4 py-2 text-sm">
        <span>{{ errorModal }}</span>
      </div>
      <form class="space-y-3" @submit.prevent="registrar">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Concepto *</legend>
          <select v-model="form.conceptoPagoId" class="select select-bordered w-full" :disabled="guardando">
            <option :value="0" disabled>Seleccioná un concepto</option>
            <option v-for="c in datos?.estadoPorConcepto" :key="c.concepto.id" :value="c.concepto.id">
              {{ c.concepto.nombre }} — Bs. {{ c.concepto.monto }}
            </option>
          </select>
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Monto (Bs.) *</legend>
          <input v-model="form.montoPagado" type="number" min="0.01" step="0.01"
            class="input input-bordered w-full" :disabled="guardando" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Método de pago</legend>
          <select v-model="form.metodoPago" class="select select-bordered w-full" :disabled="guardando">
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="QR">QR</option>
          </select>
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Observaciones</legend>
          <input v-model="form.observaciones" type="text" placeholder="Opcional"
            class="input input-bordered w-full" :disabled="guardando" />
        </fieldset>
        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="guardando" @click="modalAbierto = false">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="guardando">
            <span v-if="guardando" class="loading loading-spinner loading-sm"></span>
            Registrar pago
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalAbierto = false"><button>cerrar</button></form>
  </dialog>

  <!-- Modal conceptos de pago -->
  <dialog :open="modalConceptos" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box max-w-2xl">
      <h3 class="font-bold text-lg mb-1">Conceptos de pago</h3>
      <p class="text-sm text-base-content/60 mb-4">Gestión {{ gestion.anio }}</p>

      <div v-if="errorConcepto" role="alert" class="alert alert-error mb-4 py-2 text-sm">
        <span>{{ errorConcepto }}</span>
      </div>

      <div v-if="cargandoConceptos" class="skeleton h-20 rounded-lg mb-4"></div>
      <table v-else class="table table-sm mb-4">
        <thead><tr><th>Nombre</th><th>Monto</th><th>Tipo</th></tr></thead>
        <tbody>
          <tr v-for="c in conceptos" :key="c.id">
            <td>{{ c.nombre }}</td>
            <td>Bs. {{ c.monto }}</td>
            <td><span class="badge badge-xs" :class="c.obligatorio ? 'badge-primary' : 'badge-ghost'">{{ c.obligatorio ? 'Obligatorio' : 'Opcional' }}</span></td>
          </tr>
          <tr v-if="!conceptos.length"><td colspan="3" class="text-center text-base-content/40 py-4">Sin conceptos aún</td></tr>
        </tbody>
      </table>

      <div class="divider text-xs">Nuevo concepto</div>
      <form class="grid grid-cols-2 gap-3 items-end" @submit.prevent="crearConcepto">
        <fieldset class="fieldset col-span-2">
          <legend class="fieldset-legend text-xs">Nombre *</legend>
          <input v-model="formConcepto.nombre" type="text" placeholder="Ej: Matrícula" class="input input-bordered w-full" :disabled="guardandoConcepto" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Monto (Bs.) *</legend>
          <input v-model.number="formConcepto.monto" type="number" min="1" class="input input-bordered w-full" :disabled="guardandoConcepto" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Vencimiento</legend>
          <input v-model="formConcepto.fechaVencimiento" type="date" class="input input-bordered w-full" :disabled="guardandoConcepto" />
        </fieldset>
        <label class="label cursor-pointer justify-start gap-2 col-span-2">
          <input v-model="formConcepto.obligatorio" type="checkbox" class="checkbox checkbox-sm" />
          <span class="text-xs">Obligatorio</span>
        </label>
        <button type="submit" class="btn btn-primary btn-sm col-span-2" :disabled="guardandoConcepto">
          <span v-if="guardandoConcepto" class="loading loading-spinner loading-xs"></span>
          Crear concepto
        </button>
      </form>

      <div class="modal-action mt-4">
        <button class="btn btn-ghost" @click="modalConceptos = false">Cerrar</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalConceptos = false"><button>cerrar</button></form>
  </dialog>
</template>