<script setup lang="ts">
import { ref } from 'vue'
import { pagoApi, type PagosInscripcionResponse, type PagoPayload } from '@/api/pago.api'

const inscripcionId = ref<number | ''>('')
const datos     = ref<PagosInscripcionResponse | null>(null)
const cargando  = ref(false)
const error     = ref<string | null>(null)

async function buscar() {
  if (!inscripcionId.value) { error.value = 'Ingresá el ID de inscripción'; return }
  cargando.value = true
  error.value = null
  datos.value = null
  try {
    datos.value = await pagoApi.getDeInscripcion(Number(inscripcionId.value))
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al buscar'
  } finally {
    cargando.value = false
  }
}

// ── Modal registrar pago ──────────────────────────────────────────────────────
const modalAbierto = ref(false)
const guardando    = ref(false)
const errorModal   = ref<string | null>(null)

const formVacio = (): PagoPayload => ({
  inscripcionId:  Number(inscripcionId.value) || 0,
  conceptoPagoId: 0,
  montoPagado:    0,
  metodoPago:     'EFECTIVO',
  observaciones:  '',
})
const form = ref<PagoPayload>(formVacio())

function abrirModal(conceptoPagoId = 0, monto = 0) {
  form.value = { ...formVacio(), conceptoPagoId, montoPagado: monto }
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
    await buscar() // recargar para mostrar el nuevo pago
  } catch (e) {
    errorModal.value = e instanceof Error ? e.message : 'Error al registrar'
  } finally {
    guardando.value = false
  }
}

// ── Anular ────────────────────────────────────────────────────────────────────
const anulando = ref<number | null>(null)

async function anular(id: number) {
  if (!confirm('¿Anular este pago? Quedará en el historial como ANULADO.')) return
  anulando.value = id
  try {
    await pagoApi.anular(id)
    await buscar()
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
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-2xl font-bold">Pagos</h2>

    <!-- Buscador -->
    <div class="card bg-base-100 shadow">
      <div class="card-body flex flex-col sm:flex-row gap-3 items-end">
        <fieldset class="fieldset flex-1">
          <legend class="fieldset-legend text-xs">ID de Inscripción</legend>
          <input v-model="inscripcionId" type="number" min="1" placeholder="Ej: 1"
            class="input input-bordered w-full" @keyup.enter="buscar" />
        </fieldset>
        <button class="btn btn-primary" :disabled="cargando" @click="buscar">
          <span v-if="cargando" class="loading loading-spinner loading-sm"></span>
          Buscar
        </button>
      </div>
    </div>

    <div v-if="error" role="alert" class="alert alert-error"><span>{{ error }}</span></div>

    <template v-if="datos">

      <!-- Resumen del estudiante -->
      <div class="card bg-base-100 shadow">
        <div class="card-body py-3 flex flex-wrap gap-6 items-center">
          <div>
            <p class="text-xs text-base-content/50">Estudiante</p>
            <p class="font-semibold">{{ datos.inscripcion.estudiante.nombre }} {{ datos.inscripcion.estudiante.apellido }}</p>
          </div>
          <div>
            <p class="text-xs text-base-content/50">CI</p>
            <p class="font-mono">{{ datos.inscripcion.estudiante.ci }}</p>
          </div>
          <div>
            <p class="text-xs text-base-content/50">Curso</p>
            <p class="font-semibold">{{ datos.inscripcion.curso.nombre }}</p>
          </div>
          <div>
            <p class="text-xs text-base-content/50">Gestión</p>
            <p class="font-semibold">{{ datos.inscripcion.gestion.anio }}</p>
          </div>
          <div class="ml-auto text-right">
            <p class="text-xs text-base-content/50">Saldo pendiente</p>
            <p class="text-2xl font-bold" :class="datos.resumen.alDia ? 'text-success' : 'text-error'">
              Bs. {{ datos.resumen.saldo.toLocaleString('es-BO') }}
            </p>
            <span class="badge badge-sm" :class="datos.resumen.alDia ? 'badge-success' : 'badge-error'">
              {{ datos.resumen.alDia ? 'Al día' : 'Con deuda' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Estado por concepto -->
      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold">Estado por concepto</h3>
            <button class="btn btn-primary btn-sm" @click="abrirModal()">+ Registrar pago</button>
          </div>
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
                    <span class="badge badge-sm" :class="badgeEstado[c.estado]">{{ c.estado }}</span>
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
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Historial completo -->
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
                <td><span class="badge badge-sm" :class="badgeEstado[p.estado]">{{ p.estado }}</span></td>
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

    <div v-else-if="!cargando && !error" class="text-center text-base-content/40 py-12">
      Ingresá el ID de inscripción para ver el estado de pagos
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
</template>