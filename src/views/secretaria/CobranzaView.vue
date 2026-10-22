<script setup lang="ts">
// Control de cobranza: quién debe, quién pagó y cuánto, por gestión, trimestre o curso.
//
// ¿Para qué? La pantalla "Pagos" sirve para COBRAR a un estudiante. Esta sirve para CONTROLAR:
// ver de un vistazo cuánto se esperaba, cuánto se cobró, qué cursos van atrasados y a quién hay
// que llamar. Todo se calcula en el servidor con la misma regla que el cobro (abonos, descuentos).
import { ref, computed, watch, onMounted } from 'vue'
import {
  cobranzaApi, type CobranzaResponse, type RecibidosResponse, type DeudorCobranza, type CeldaMatriz,
} from '@/api/cobranza.api'
import { descargarBlob } from '@/api/boletin.api'
import { useGestionStore } from '@/stores/gestion.store'
import { useAccion } from '@/composables/useAccion'
import { formatoFecha } from '@/lib/fechas'
import AppIcon from '@/components/AppIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const gestion = useGestionStore()

type Pestana = 'resumen' | 'deudores' | 'matriz' | 'cobrado'
const pestana = ref<Pestana>('resumen')

// ── Filtros ──────────────────────────────────────────────────────────────────
const trimestreId = ref<number | ''>('')
const cursoId     = ref<number | ''>('')
const conceptoId  = ref<number | ''>('')

const datos    = ref<CobranzaResponse | null>(null)
const cargando = ref(false)
const error    = ref<string | null>(null)

// Cada filtro nuevo vuelve a pedir; si llegan dos respuestas, solo vale la última
let ticket = 0
async function cargar() {
  if (!gestion.gestionId) return
  const mio = ++ticket
  cargando.value = true
  error.value = null
  try {
    const r = await cobranzaApi.get({
      gestionId:   gestion.gestionId,
      trimestreId: trimestreId.value || undefined,
      cursoId:     cursoId.value || undefined,
      conceptoId:  conceptoId.value || undefined,
    })
    if (mio === ticket) datos.value = r
  } catch (e) {
    if (mio === ticket) error.value = e instanceof Error ? e.message : 'No se pudo cargar la cobranza'
  } finally {
    if (mio === ticket) cargando.value = false
  }
}

onMounted(async () => { await gestion.cargar(); await cargar() })
// Al cambiar de periodo el concepto elegido puede no pertenecer: se limpia
watch(trimestreId, () => { conceptoId.value = '' })
watch([trimestreId, cursoId, conceptoId], () => { cargar(); if (pestana.value === 'cobrado') cargarCobrado() })
watch(() => gestion.gestionId, cargar)

const filtroActual = computed(() => ({
  gestionId:   gestion.gestionId ?? undefined,
  trimestreId: trimestreId.value || undefined,
  cursoId:     cursoId.value || undefined,
  conceptoId:  conceptoId.value || undefined,
}))

const excel = useAccion(async () => {
  const blob = await cobranzaApi.descargarExcel(filtroActual.value)
  descargarBlob(blob, `cobranza_${gestion.anio}.xlsx`)
}, { exito: 'Excel descargado', errorPorDefecto: 'No se pudo generar el Excel' })

// ── Formato ──────────────────────────────────────────────────────────────────
const bs = (n: number) => `Bs. ${n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('es-BO')}%`)

// Teléfono boliviano de 8 dígitos → enlace de WhatsApp (código de país 591)
function enlaceWhatsApp(tel: string): string | null {
  const d = tel.replace(/\D/g, '')
  if (d.length === 8) return `https://wa.me/591${d}`
  if (d.length === 11 && d.startsWith('591')) return `https://wa.me/${d}`
  return null
}

// ── Deudores ─────────────────────────────────────────────────────────────────
const busqueda    = ref('')
const soloVencido = ref(false)

const deudoresFiltrados = computed<DeudorCobranza[]>(() => {
  const q = busqueda.value.trim().toLowerCase()
  return (datos.value?.deudores ?? []).filter(d =>
    (!soloVencido.value || d.vencido > 0) &&
    (!q || d.estudiante.toLowerCase().includes(q) || d.ci.toLowerCase().includes(q) || d.contacto.nombre.toLowerCase().includes(q)))
})

function verCurso(id: number, a: Pestana = 'deudores') {
  cursoId.value = id
  pestana.value = a
}

// ── Matriz ───────────────────────────────────────────────────────────────────
function textoCelda(c: CeldaMatriz | undefined): string {
  if (!c) return ''
  if (c.estado === 'PAGADO') return '✓'
  if (c.estado === 'PARCIAL') return `−${c.saldo.toLocaleString('es-BO')}`
  return c.saldo.toLocaleString('es-BO')
}
function claseCelda(c: CeldaMatriz | undefined): string {
  if (!c) return ''
  if (c.estado === 'PAGADO') return 'bg-success/15 text-success'
  if (c.vencido) return 'bg-error/15 text-error font-semibold'
  if (c.estado === 'PARCIAL') return 'bg-info/15 text-info'
  return 'bg-base-200 text-base-content/60'
}

// ── Cobrado ──────────────────────────────────────────────────────────────────
const recibidos      = ref<RecibidosResponse | null>(null)
const cargandoCobrado = ref(false)
const errorCobrado   = ref<string | null>(null)
const desde  = ref('')
const hasta  = ref('')
const metodo = ref<'' | 'EFECTIVO' | 'TRANSFERENCIA' | 'QR'>('')

async function cargarCobrado() {
  if (!gestion.gestionId) return
  cargandoCobrado.value = true
  errorCobrado.value = null
  try {
    recibidos.value = await cobranzaApi.getRecibidos({
      gestionId:  gestion.gestionId,
      cursoId:    cursoId.value || undefined,
      conceptoId: conceptoId.value || undefined,
      desde:      desde.value || undefined,
      hasta:      hasta.value || undefined,
      metodo:     metodo.value || undefined,
    })
  } catch (e) {
    errorCobrado.value = e instanceof Error ? e.message : 'No se pudieron cargar los pagos'
  } finally {
    cargandoCobrado.value = false
  }
}
watch(pestana, p => { if (p === 'cobrado') cargarCobrado() })
watch([desde, hasta, metodo], () => { if (pestana.value === 'cobrado') cargarCobrado() })

const PESTANAS: Array<{ id: Pestana; nombre: string }> = [
  { id: 'resumen',  nombre: 'Resumen' },
  { id: 'deudores', nombre: 'Deudores' },
  { id: 'matriz',   nombre: 'Matriz por curso' },
  { id: 'cobrado',  nombre: 'Cobrado' },
]
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold">Control de cobranza</h2>
        <p class="text-sm text-base-content/60">
          Gestión {{ gestion.anio }} · {{ datos?.periodo.nombre ?? '…' }}
          <span v-if="datos" class="text-base-content/40">· al {{ formatoFecha(datos.hoy) }}</span>
        </p>
      </div>
      <button class="btn btn-outline btn-sm" :disabled="!datos || excel.ejecutando.value" @click="excel.ejecutar()">
        <span v-if="excel.ejecutando.value" class="loading loading-spinner loading-xs"></span>
        <AppIcon v-else nombre="descargar" class="h-4 w-4" />
        Descargar Excel
      </button>
    </div>

    <!-- Filtros -->
    <div class="card bg-base-100 shadow">
      <div class="card-body py-3 grid gap-3 sm:grid-cols-3">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Periodo</legend>
          <select v-model="trimestreId" class="select select-bordered w-full">
            <option value="">Toda la gestión</option>
            <option v-for="t in gestion.trimestres" :key="t.id" :value="t.id">{{ t.nombre }}</option>
          </select>
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Curso</legend>
          <select v-model="cursoId" class="select select-bordered w-full">
            <option value="">Todos los cursos</option>
            <option v-for="c in gestion.cursos" :key="c.id" :value="c.id">{{ c.nombre }}</option>
          </select>
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Concepto</legend>
          <select v-model="conceptoId" class="select select-bordered w-full">
            <option value="">Todos los conceptos</option>
            <option v-for="c in datos?.conceptos ?? []" :key="c.id" :value="c.id">{{ c.nombre }}</option>
          </select>
        </fieldset>
      </div>
    </div>

    <div v-if="error" role="alert" class="alert alert-error"><span>{{ error }}</span></div>

    <div v-if="datos && datos.conceptos.length === 0 && !cargando" role="alert" class="alert alert-warning text-sm">
      <span>
        No hay conceptos obligatorios para este periodo. Crea las cuotas en
        <RouterLink to="/secretaria/pagos" class="link font-semibold">Pagos → Conceptos de pago</RouterLink>
        (puedes generar la pensión de todos los meses de una vez).
      </span>
    </div>

    <div v-if="cargando && !datos" class="skeleton h-40 rounded-xl"></div>

    <template v-if="datos">
      <!-- Indicadores -->
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-3" :class="cargando ? 'opacity-60' : ''">
        <div class="card bg-base-100 shadow"><div class="card-body p-4">
          <p class="text-xs text-base-content/50">Esperado</p>
          <p class="text-xl font-bold">{{ bs(datos.kpis.esperado) }}</p>
          <p class="text-xs text-base-content/40">{{ datos.kpis.estudiantes }} estudiantes</p>
        </div></div>
        <div class="card bg-base-100 shadow"><div class="card-body p-4">
          <p class="text-xs text-base-content/50">Cobrado</p>
          <p class="text-xl font-bold text-success">{{ bs(datos.kpis.recaudado) }}</p>
          <progress class="progress progress-success w-full" :value="datos.kpis.porcentajeCobrado ?? 0" max="100"></progress>
          <p class="text-xs text-base-content/40">{{ pct(datos.kpis.porcentajeCobrado) }} del esperado</p>
        </div></div>
        <div class="card bg-base-100 shadow"><div class="card-body p-4">
          <p class="text-xs text-base-content/50">Por cobrar</p>
          <p class="text-xl font-bold">{{ bs(datos.kpis.porCobrar) }}</p>
          <p class="text-xs text-base-content/40">{{ datos.kpis.deudores }} estudiantes con saldo</p>
        </div></div>
        <div class="card bg-base-100 shadow"><div class="card-body p-4">
          <p class="text-xs text-base-content/50">Vencido</p>
          <p class="text-xl font-bold" :class="datos.kpis.vencido > 0 ? 'text-error' : ''">{{ bs(datos.kpis.vencido) }}</p>
          <p class="text-xs text-base-content/40">{{ datos.kpis.morosos }} estudiantes morosos</p>
        </div></div>
        <div class="card bg-base-100 shadow col-span-2 lg:col-span-1"><div class="card-body p-4">
          <p class="text-xs text-base-content/50">Al día</p>
          <p class="text-xl font-bold text-success">{{ datos.kpis.alDia }}</p>
          <p class="text-xs text-base-content/40">sin saldo en el periodo</p>
        </div></div>
      </div>

      <!-- Pestañas -->
      <div role="tablist" class="tabs tabs-border">
        <button v-for="p in PESTANAS" :key="p.id" role="tab" class="tab" :class="pestana === p.id ? 'tab-active font-semibold' : ''" @click="pestana = p.id">
          {{ p.nombre }}
          <span v-if="p.id === 'deudores' && datos.kpis.deudores" class="badge badge-sm badge-error ml-2">{{ datos.kpis.deudores }}</span>
        </button>
      </div>

      <!-- RESUMEN por curso -->
      <div v-if="pestana === 'resumen'" class="card bg-base-100 shadow overflow-x-auto">
        <div class="card-body">
          <h3 class="font-semibold">Por curso</h3>
          <table class="table table-sm">
            <thead><tr><th>Curso</th><th class="text-right">Estudiantes</th><th class="text-right">Esperado</th><th class="text-right">Cobrado</th><th class="w-40">% cobrado</th><th class="text-right">Por cobrar</th><th class="text-right">Vencido</th><th class="text-right">Con deuda</th></tr></thead>
            <tbody>
              <tr v-for="c in datos.porCurso" :key="c.cursoId" class="hover cursor-pointer" @click="verCurso(c.cursoId)">
                <td class="font-medium">{{ c.curso }}</td>
                <td class="text-right">{{ c.estudiantes }}</td>
                <td class="text-right">{{ bs(c.esperado) }}</td>
                <td class="text-right text-success">{{ bs(c.recaudado) }}</td>
                <td>
                  <div class="flex items-center gap-2">
                    <progress class="progress w-24" :class="(c.porcentajeCobrado ?? 0) >= 80 ? 'progress-success' : (c.porcentajeCobrado ?? 0) >= 50 ? 'progress-warning' : 'progress-error'" :value="c.porcentajeCobrado ?? 0" max="100"></progress>
                    <span class="text-xs">{{ pct(c.porcentajeCobrado) }}</span>
                  </div>
                </td>
                <td class="text-right">{{ bs(c.porCobrar) }}</td>
                <td class="text-right" :class="c.vencido > 0 ? 'text-error font-semibold' : 'text-base-content/40'">{{ bs(c.vencido) }}</td>
                <td class="text-right">{{ c.deudores }}</td>
              </tr>
              <tr v-if="!datos.porCurso.length"><td colspan="8" class="text-center text-base-content/40 py-6">No hay estudiantes inscritos</td></tr>
            </tbody>
          </table>
          <p class="text-xs text-base-content/40">Toca un curso para ver sus deudores.</p>
        </div>
      </div>

      <!-- DEUDORES -->
      <div v-if="pestana === 'deudores'" class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex flex-wrap items-center gap-3">
            <label class="input input-bordered input-sm flex items-center gap-2 w-full sm:w-72">
              <AppIcon nombre="buscar" class="h-4 w-4 opacity-50" />
              <input v-model="busqueda" type="search" placeholder="Estudiante, CI o tutor..." class="grow" />
            </label>
            <label class="label cursor-pointer gap-2">
              <input v-model="soloVencido" type="checkbox" class="checkbox checkbox-sm" />
              <span class="text-sm">Solo con deuda vencida</span>
            </label>
            <span class="ml-auto text-sm text-base-content/50">{{ deudoresFiltrados.length }} de {{ datos.deudores.length }}</span>
          </div>
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead><tr><th>Estudiante</th><th>Curso</th><th>Tutor</th><th class="text-right">Saldo</th><th class="text-right">Vencido</th><th class="text-right">Mora</th><th>Debe</th></tr></thead>
              <tbody>
                <tr v-for="d in deudoresFiltrados" :key="d.inscripcionId" class="hover">
                  <td class="font-medium whitespace-nowrap">{{ d.estudiante }}</td>
                  <td class="whitespace-nowrap text-sm">{{ d.curso }}</td>
                  <td class="text-sm">
                    <div>{{ d.contacto.nombre || '—' }}</div>
                    <div v-if="d.contacto.telefono" class="flex gap-2 text-xs">
                      <a :href="`tel:${d.contacto.telefono}`" class="link link-hover">{{ d.contacto.telefono }}</a>
                      <a v-if="enlaceWhatsApp(d.contacto.telefono)" :href="enlaceWhatsApp(d.contacto.telefono)!" target="_blank" rel="noopener" class="link link-success">WhatsApp</a>
                    </div>
                    <div v-else class="text-xs text-warning">sin teléfono</div>
                  </td>
                  <td class="text-right font-semibold">{{ bs(d.saldo) }}</td>
                  <td class="text-right" :class="d.vencido > 0 ? 'text-error font-semibold' : 'text-base-content/40'">{{ d.vencido > 0 ? bs(d.vencido) : '—' }}</td>
                  <td class="text-right text-sm">{{ d.maxDiasMora > 0 ? `${d.maxDiasMora} d` : '—' }}</td>
                  <td>
                    <div class="flex flex-wrap gap-1">
                      <span v-for="p in d.pendientes" :key="p.conceptoId" class="badge badge-sm" :class="p.vencido ? 'badge-error badge-outline' : 'badge-ghost'" :title="`Bs. ${p.saldo}`">{{ p.nombre }}</span>
                    </div>
                  </td>
                </tr>
                <tr v-if="!deudoresFiltrados.length">
                  <td colspan="7" class="text-center py-8 text-base-content/40">
                    {{ datos.deudores.length ? 'Ningún resultado con esos filtros' : 'Nadie tiene deudas en este periodo 🎉' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- MATRIZ por curso -->
      <div v-if="pestana === 'matriz'" class="card bg-base-100 shadow">
        <div class="card-body">
          <div v-if="!datos.matriz" class="text-center py-8 text-base-content/50">
            Elige un <strong>curso</strong> en los filtros para ver la matriz de pagos de sus estudiantes.
          </div>
          <template v-else>
            <div class="flex flex-wrap gap-3 text-xs">
              <span class="badge badge-success badge-soft">✓ pagado</span>
              <span class="badge badge-info badge-soft">−saldo parcial</span>
              <span class="badge badge-error badge-soft">saldo vencido</span>
              <span class="badge badge-ghost">saldo aún no vence</span>
            </div>
            <div class="overflow-x-auto">
              <table class="table table-xs">
                <thead>
                  <tr>
                    <th class="sticky left-0 bg-base-100 z-10">Estudiante</th>
                    <th v-for="c in datos.conceptos" :key="c.id" class="text-center whitespace-nowrap" :title="`Bs. ${c.monto}`">
                      {{ c.nombre }}
                      <div v-if="c.fechaVencimiento" class="font-normal text-base-content/40">vence {{ formatoFecha(c.fechaVencimiento) }}</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="f in datos.matriz" :key="f.inscripcionId">
                    <td class="sticky left-0 bg-base-100 font-medium whitespace-nowrap">{{ f.estudiante }}</td>
                    <td v-for="c in datos.conceptos" :key="c.id" class="text-center" :class="claseCelda(f.celdas[c.id])">{{ textoCelda(f.celdas[c.id]) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>
      </div>

      <!-- COBRADO -->
      <div v-if="pestana === 'cobrado'" class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex flex-wrap items-end gap-3">
            <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Desde</legend>
              <input v-model="desde" type="date" class="input input-bordered input-sm" /></fieldset>
            <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Hasta</legend>
              <input v-model="hasta" type="date" class="input input-bordered input-sm" /></fieldset>
            <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Método</legend>
              <select v-model="metodo" class="select select-bordered select-sm">
                <option value="">Todos</option><option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option><option value="QR">QR</option>
              </select></fieldset>
          </div>

          <div v-if="errorCobrado" role="alert" class="alert alert-error py-2 text-sm"><span>{{ errorCobrado }}</span></div>
          <div v-if="cargandoCobrado && !recibidos" class="skeleton h-24 rounded-lg"></div>

          <template v-if="recibidos">
            <div class="flex flex-wrap gap-6 text-sm">
              <div><p class="text-xs text-base-content/50">Total cobrado</p><p class="text-lg font-bold text-success">{{ bs(recibidos.totales.monto) }}</p></div>
              <div><p class="text-xs text-base-content/50">Pagos</p><p class="text-lg font-bold">{{ recibidos.totales.cantidad }}</p></div>
              <div v-for="(v, m) in recibidos.totales.porMetodo" :key="m">
                <p class="text-xs text-base-content/50">{{ m }}</p><p class="font-semibold">{{ bs(v.monto) }} <span class="text-xs text-base-content/40">({{ v.cantidad }})</span></p>
              </div>
            </div>
            <div v-if="recibidos.truncado" class="text-xs text-warning">Se muestran los 1000 pagos más recientes; los totales incluyen todos. Acota las fechas para ver el resto.</div>
            <div class="overflow-x-auto" :class="cargandoCobrado ? 'opacity-60' : ''">
              <table class="table table-sm">
                <thead><tr><th>Recibo</th><th>Fecha</th><th>Estudiante</th><th>Curso</th><th>Concepto</th><th class="text-right">Monto</th><th>Método</th><th>Cajero</th></tr></thead>
                <tbody>
                  <tr v-for="p in recibidos.pagos" :key="p.id" class="hover" :class="p.estado === 'ANULADO' ? 'opacity-50' : ''">
                    <td class="font-mono text-xs">{{ p.numeroRecibo ?? '—' }}</td>
                    <td class="text-sm whitespace-nowrap">{{ formatoFecha(p.fecha) }}</td>
                    <td class="whitespace-nowrap">{{ p.estudiante }}</td>
                    <td class="text-sm whitespace-nowrap">{{ p.curso }}</td>
                    <td>{{ p.concepto }} <StatusBadge v-if="p.estado === 'PARCIAL'" estado="PARCIAL" tamano="xs" /></td>
                    <td class="text-right font-semibold">{{ bs(p.monto) }}</td>
                    <td class="text-sm">{{ p.metodo }}</td>
                    <td class="text-sm text-base-content/60">{{ p.cajero }}</td>
                  </tr>
                  <tr v-if="!recibidos.pagos.length"><td colspan="8" class="text-center py-8 text-base-content/40">No hay pagos con esos filtros</td></tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>
