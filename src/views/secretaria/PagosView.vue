<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { pagoApi, type PagosInscripcionResponse, type PagoPayload, type ConceptoPago } from '@/api/pago.api'
import { cobranzaApi } from '@/api/cobranza.api'
import CobranzaPanel from '@/components/pagos/CobranzaPanel.vue'
import { useBuscadorEstudiante } from '@/composables/useBuscadorEstudiante'
import { useGestionStore } from '@/stores/gestion.store'
import { useConfirm } from '@/composables/useConfirm'
import { useToastStore } from '@/stores/toast.store'
import type { Nivel } from '@/types'
import { formatoFecha } from '@/lib/fechas'

const { confirmar } = useConfirm()
const toast = useToastStore()

const gestion = useGestionStore()
const buscador = useBuscadorEstudiante()

onMounted(() => gestion.cargar())

// La inscripción activa es la más reciente del estudiante elegido — el
// buscador ya trae take:1 ordenado por gestión desc, así que alcanza con
// el primero. Si el estudiante no tiene inscripción, no hay nada que cobrar.
// También se puede llegar desde el panel de cobranza (botón "Cobrar" de un deudor): ahí ya se conoce la inscripción.
const inscripcionDirecta = ref<number | null>(null)
const inscripcionId = computed(() => inscripcionDirecta.value ?? buscador.seleccionado.value?.inscripciones?.[0]?.id ?? null)

function cobrar(id: number) { inscripcionDirecta.value = id; window.scrollTo({ top: 0, behavior: 'smooth' }) }
function volverAlPanel() { inscripcionDirecta.value = null; buscador.limpiar() }

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

// Saldo pendiente del concepto elegido en el modal (lo máximo que se puede cobrar)
const conceptoElegido = computed(() => datos.value?.estadoPorConcepto.find(c => c.concepto.id === form.value.conceptoPagoId))
const saldoElegido    = computed(() => conceptoElegido.value?.saldo ?? 0)

// Al elegir otro concepto, se sugiere cobrar lo que falta (el cajero puede bajar el monto para un abono)
function alElegirConcepto() {
  if (conceptoElegido.value) form.value.montoPagado = conceptoElegido.value.saldo
}

async function registrar() {
  if (!form.value.conceptoPagoId) { errorModal.value = 'Seleccioná un concepto'; return }
  if (form.value.montoPagado <= 0) { errorModal.value = 'El monto debe ser mayor a 0'; return }
  guardando.value = true
  errorModal.value = null
  try {
    const pago = await pagoApi.registrar(form.value)
    modalAbierto.value = false
    toast.success(pago.saldoPendiente > 0
      ? `Abono registrado. Saldo del concepto: Bs. ${pago.saldoPendiente.toLocaleString('es-BO')}`
      : 'Pago registrado: concepto saldado')
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

// ── Generador de cuotas (pensión mensual / por trimestre) ────────────────────
const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const formGenerar = ref({ tipo: 'MENSUAL' as 'MENSUAL' | 'TRIMESTRAL', nombreBase: 'Pensión', monto: 0, mesDesde: 2, mesHasta: 11, diaVencimiento: 10, diasPlazo: 15 })
const generando = ref(false)

async function generarCuotas() {
  const f = formGenerar.value
  if (!gestion.gestionId) return
  if (!f.nombreBase.trim() || f.monto <= 0) { errorConcepto.value = 'Escribe el nombre y un monto mayor a 0'; return }
  generando.value = true
  errorConcepto.value = null
  try {
    const r = await cobranzaApi.generarConceptos({
      gestionId: gestion.gestionId, tipo: f.tipo, nombreBase: f.nombreBase.trim(), monto: f.monto,
      ...(f.tipo === 'MENSUAL' ? { mesDesde: f.mesDesde, mesHasta: f.mesHasta, diaVencimiento: f.diaVencimiento } : { diasPlazo: f.diasPlazo }),
    })
    conceptos.value = await pagoApi.getConceptos(gestion.gestionId)
    toast.success(r.yaExistian ? `${r.creados} cuota(s) creada(s); ${r.yaExistian} ya existían` : `${r.creados} cuota(s) creada(s)`)
    await recargar()
  } catch (e) {
    errorConcepto.value = e instanceof Error ? e.message : 'No se pudieron generar las cuotas'
  } finally {
    generando.value = false
  }
}

// Desactivar = dejar de cobrarlo sin borrar los pagos ya hechos
async function alternarActivo(c: ConceptoPago) {
  const nuevo = !(c.activo ?? true)
  try {
    await cobranzaApi.actualizarConcepto(c.id, { activo: nuevo })
    c.activo = nuevo
    await recargar()
  } catch (e) {
    errorConcepto.value = e instanceof Error ? e.message : 'No se pudo actualizar el concepto'
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
          <button class="btn btn-ghost btn-xs ml-auto" @click="volverAlPanel">← Volver al panel</button>
        </div>
      </div>
    </div>

    <div v-if="inscripcionDirecta && datos" class="card bg-base-100 shadow">
      <div class="card-body py-3 flex-row flex-wrap items-center gap-6">
        <div>
          <p class="text-xs text-base-content/50">Estudiante</p>
          <p class="font-semibold">{{ datos.inscripcion.estudiante.nombre }} {{ datos.inscripcion.estudiante.apellido }}</p>
        </div>
        <div>
          <p class="text-xs text-base-content/50">Curso</p>
          <p class="font-semibold">{{ datos.inscripcion.curso.grado }}° {{ NIVEL_TEXTO[datos.inscripcion.curso.nivel as Nivel] }} "{{ datos.inscripcion.curso.paralelo }}"</p>
        </div>
        <button class="btn btn-ghost btn-xs ml-auto" @click="volverAlPanel">← Volver al panel</button>
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
                <tr><th>Concepto</th><th>Monto</th><th>Pagado</th><th>Saldo</th><th>Estado</th><th>Último recibo</th><th></th></tr>
              </thead>
              <tbody>
                <tr v-for="c in datos.estadoPorConcepto" :key="c.concepto.id" class="hover">
                  <td>
                    {{ c.concepto.nombre }}
                    <span v-if="c.obligatorio" class="badge badge-xs badge-ghost ml-1">obligatorio</span>
                  </td>
                  <td>Bs. {{ c.concepto.monto }}</td>
                  <td class="text-base-content/70">
                    {{ c.montoPagado > 0 ? `Bs. ${c.montoPagado.toLocaleString('es-BO')}` : '—' }}
                    <span v-if="c.abonos > 1" class="text-xs text-base-content/40">({{ c.abonos }} pagos)</span>
                  </td>
                  <td :class="c.saldo > 0 ? 'font-semibold' : 'text-base-content/40'">
                    {{ c.saldo > 0 ? `Bs. ${c.saldo.toLocaleString('es-BO')}` : '—' }}
                  </td>
                  <td>
                    <StatusBadge :estado="c.estado" />
                  </td>
                  <td class="font-mono text-xs text-base-content/60">{{ c.numeroRecibo ?? '—' }}</td>
                  <td>
                    <button v-if="c.estado !== 'PAGADO'"
                      class="btn btn-primary btn-xs"
                      @click="abrirModal(c.concepto.id, c.saldo)">
                      {{ c.estado === 'PARCIAL' ? 'Abonar' : 'Pagar' }}
                    </button>
                  </td>
                </tr>
                <tr v-if="!datos.estadoPorConcepto.length">
                  <td colspan="7" class="text-center text-base-content/40 py-4">
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
                <td class="text-sm text-base-content/60">{{ formatoFecha(p.fechaPago) }}</td>
                <td><StatusBadge :estado="p.estado" /></td>
                <td>
                  <button v-if="p.estado === 'PAGADO' || p.estado === 'PARCIAL'"
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

    <!-- Sin estudiante elegido: se muestra el estado de la cobranza (quién debe, hasta cuándo, quién pagó) -->
    <CobranzaPanel v-else-if="!cargando && !buscador.seleccionado.value && !inscripcionDirecta" @cobrar="cobrar" />
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
          <select v-model="form.conceptoPagoId" class="select select-bordered w-full" :disabled="guardando" @change="alElegirConcepto">
            <option :value="0" disabled>Seleccioná un concepto</option>
            <option v-for="c in datos?.estadoPorConcepto" :key="c.concepto.id" :value="c.concepto.id" :disabled="c.estado === 'PAGADO'">
              {{ c.concepto.nombre }} — {{ c.estado === 'PAGADO' ? 'pagado' : `saldo Bs. ${c.saldo}` }}
            </option>
          </select>
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Monto (Bs.) *</legend>
          <input v-model="form.montoPagado" type="number" min="0.01" step="0.01" :max="saldoElegido || undefined"
            class="input input-bordered w-full" :disabled="guardando" />
          <p v-if="conceptoElegido" class="text-xs text-base-content/50 mt-1">
            Saldo pendiente: Bs. {{ saldoElegido.toLocaleString('es-BO') }}.
            Si cobras menos, queda como pago parcial y podrás registrar abonos después.
          </p>
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
        <thead><tr><th>Nombre</th><th>Monto</th><th>Vence</th><th>Tipo</th><th>Activo</th></tr></thead>
        <tbody>
          <tr v-for="c in conceptos" :key="c.id" :class="c.activo === false ? 'opacity-50' : ''">
            <td>{{ c.nombre }}</td>
            <td>Bs. {{ c.monto }}</td>
            <td class="text-xs">{{ c.fechaVencimiento ? formatoFecha(c.fechaVencimiento) : '—' }}</td>
            <td><span class="badge badge-xs" :class="c.obligatorio ? 'badge-primary' : 'badge-ghost'">{{ c.obligatorio ? 'Obligatorio' : 'Opcional' }}</span></td>
            <td><input type="checkbox" class="toggle toggle-xs toggle-success" :checked="c.activo !== false" @change="alternarActivo(c)" /></td>
          </tr>
          <tr v-if="!conceptos.length"><td colspan="5" class="text-center text-base-content/40 py-4">Sin conceptos aún</td></tr>
        </tbody>
      </table>

      <div class="divider text-xs">Generar cuotas del año</div>
      <form class="grid grid-cols-2 gap-3 items-end" @submit.prevent="generarCuotas">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Se cobra</legend>
          <select v-model="formGenerar.tipo" class="select select-bordered w-full" :disabled="generando">
            <option value="MENSUAL">Cada mes</option>
            <option value="TRIMESTRAL">Cada trimestre</option>
          </select>
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Monto de cada cuota (Bs.) *</legend>
          <input v-model.number="formGenerar.monto" type="number" min="1" class="input input-bordered w-full" :disabled="generando" />
        </fieldset>
        <fieldset class="fieldset col-span-2">
          <legend class="fieldset-legend text-xs">Nombre base *</legend>
          <input v-model="formGenerar.nombreBase" type="text" placeholder="Pensión" class="input input-bordered w-full" :disabled="generando" />
          <p class="text-xs text-base-content/40 mt-1">
            Se crea «{{ formGenerar.nombreBase || 'Pensión' }} {{ formGenerar.tipo === 'MENSUAL' ? MESES[formGenerar.mesDesde] : 'Primer trimestre' }}», etc.
          </p>
        </fieldset>
        <template v-if="formGenerar.tipo === 'MENSUAL'">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Desde</legend>
            <select v-model.number="formGenerar.mesDesde" class="select select-bordered w-full" :disabled="generando">
              <option v-for="m in 12" :key="m" :value="m">{{ MESES[m] }}</option>
            </select>
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Hasta</legend>
            <select v-model.number="formGenerar.mesHasta" class="select select-bordered w-full" :disabled="generando">
              <option v-for="m in 12" :key="m" :value="m">{{ MESES[m] }}</option>
            </select>
          </fieldset>
          <fieldset class="fieldset col-span-2">
            <legend class="fieldset-legend text-xs">Vence el día</legend>
            <input v-model.number="formGenerar.diaVencimiento" type="number" min="1" max="31" class="input input-bordered w-full" :disabled="generando" />
          </fieldset>
        </template>
        <fieldset v-else class="fieldset col-span-2">
          <legend class="fieldset-legend text-xs">Plazo: días después de empezar el trimestre</legend>
          <input v-model.number="formGenerar.diasPlazo" type="number" min="0" max="120" class="input input-bordered w-full" :disabled="generando" />
        </fieldset>
        <button type="submit" class="btn btn-secondary btn-sm col-span-2" :disabled="generando">
          <span v-if="generando" class="loading loading-spinner loading-xs"></span>
          Generar cuotas
        </button>
        <p class="col-span-2 text-xs text-base-content/40">Si algunas ya existen no se duplican: puedes volver a generar sin problema.</p>
      </form>

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