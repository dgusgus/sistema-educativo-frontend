<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { reporteApi, type ReporteAcademicoDetalle } from '@/api/reporte.api'
import { cursoApi, materiaApi, trimestreApi, nombreCurso } from '@/api/estructura.api'
import { evaluacionApi } from '@/api/evaluacion.api'
import { institucionApi } from '@/api/institucion.api'
import { docenteApi } from '@/api/docente.api'
import { useGestionStore } from '@/stores/gestion.store'
import type { DashboardResponse, DimensionEvaluacion, Materia, Curso, Institucion, Docente } from '@/types'
import AppIcon from '@/components/AppIcon.vue'
import PendientesCierre from '@/components/dashboard/PendientesCierre.vue'
import CursoExplorer from '@/components/dashboard/CursoExplorer.vue'
import RendimientoCursos from '@/components/dashboard/RendimientoCursos.vue'
import MejoresGestion from '@/components/dashboard/MejoresGestion.vue'
import EstadoInscripciones from '@/components/dashboard/EstadoInscripciones.vue'
import type { PendientesCierre as Pendientes } from '@/api/estructura.api'
import { diasHasta, formatoFecha } from '@/lib/fechas'

// Dashboard en 3 bloques: hero + alertas (lo que exige acción) → indicadores
// y estado → rendimiento y explorador por curso. Cada bloque carga
// independiente: si un endpoint falla, los demás igual se muestran.
const gestionStore = useGestionStore()

const datos    = ref<DashboardResponse | null>(null)
const cargando = ref(true)
const error    = ref<string | null>(null)

const dimensiones = ref<DimensionEvaluacion[] | null>(null)
const materias    = ref<Materia[] | null>(null)
const cursos      = ref<Curso[] | null>(null)
const pendientes  = ref<Pendientes | null>(null)
const institucion = ref<Institucion | null>(null)
// Detalle académico completo (1 sola request compartida por Rendimiento,
// Mejores y Dona de inscripciones) + docentes para alerta de asignación.
const detalleAcademico = ref<ReporteAcademicoDetalle[] | null>(null)
const docentesSinAsignar = ref<string[]>([])

const trimestreActivo = computed(() => datos.value?.trimestres.find(t => !t.cerrado) ?? null)

const trimestresCerrados = computed(() => datos.value?.trimestres.filter(t => t.cerrado).length ?? 0)
const avanceGestion = computed(() => {
  const total = datos.value?.trimestres.length ?? 0
  return total ? Math.round((trimestresCerrados.value / total) * 100) : 0
})

const sumaDimensiones = computed(() =>
  Math.round((dimensiones.value ?? []).reduce((s, d) => s + d.pesoEnPromedio, 0) * 1000) / 10
)
const dimensionesOk = computed(() => Math.abs(sumaDimensiones.value - 100) < 0.05)

const cursosSinInscritos = computed(() =>
  (cursos.value ?? []).filter(c => (c._count?.inscripciones ?? 0) === 0)
)

const materiasSinAsignar = computed(() =>
  (materias.value ?? []).filter(m => (m._count?.asignaciones ?? 0) === 0)
)

const inicialesUE = computed(() =>
  (institucion.value?.nombre ?? 'UE').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()
)

function diasRestantes(fechaFin: string | null | undefined): number | null {
  if (!fechaFin) return null
  return diasHasta(fechaFin)
}

function fechaCorta(fecha: string | null | undefined): string {
  if (!fecha) return '—'
  return formatoFecha(fecha, { day: 'numeric', month: 'short' })
}

// Errores por bloque con reintento — ningún bloque tumba al resto,
// pero ninguno falla en silencio: cada uno muestra su error y su reintento.
const erroresBloque = ref({
  dimensiones: null as string | null,
  estructura: null as string | null,
  academico: null as string | null,
  pendientes: null as string | null,
})

function mensajeError(e: unknown): string {
  return e instanceof Error ? e.message : 'Error al cargar los datos'
}

function gestionIdActual(): number | null {
  return datos.value?.gestion.id ?? gestionStore.gestionId
}

async function cargarDimensiones() {
  const id = gestionIdActual()
  if (!id) return
  erroresBloque.value.dimensiones = null
  try {
    dimensiones.value = await evaluacionApi.getDimensiones(id)
  } catch (e) {
    erroresBloque.value.dimensiones = mensajeError(e)
  }
}

async function cargarEstructura() {
  const id = gestionIdActual()
  if (!id) return
  erroresBloque.value.estructura = null
  try {
    const [ms, cs] = await Promise.all([materiaApi.getAll(), cursoApi.getAll(id)])
    materias.value = ms
    cursos.value = cs
  } catch (e) {
    erroresBloque.value.estructura = mensajeError(e)
  }
}

async function cargarAcademico() {
  const id = gestionIdActual()
  if (!id) return
  erroresBloque.value.academico = null
  try {
    const [rep, ds] = await Promise.all([
      reporteApi.getReporteAcademico({ gestionId: id }),
      docenteApi.getAll(),
    ])
    detalleAcademico.value = rep.detalle
    docentesSinAsignar.value = (ds as Docente[])
      .filter(d => !(d.asignaciones ?? []).length)
      .map(d => `${d.nombre} ${d.apellido}`)
  } catch (e) {
    erroresBloque.value.academico = mensajeError(e)
  }
}

async function cargarPendientes() {
  const trim = datos.value?.trimestres.find(t => !t.cerrado)
    ?? gestionStore.trimestreActivo
  if (!trim) return
  erroresBloque.value.pendientes = null
  try {
    pendientes.value = await trimestreApi.getPendientes(trim.id)
  } catch (e) {
    erroresBloque.value.pendientes = mensajeError(e)
  }
}

onMounted(async () => {
  try {
    datos.value = await reporteApi.getDashboard()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar el dashboard'
    cargando.value = false
    return
  }
  cargando.value = false

  institucionApi.get().then(r => { institucion.value = r }).catch(() => {})
  gestionStore.cargar().catch(() => {})
  cargarDimensiones()
  cargarEstructura()
  cargarAcademico()
  cargarPendientes()
})
</script>

<template>
  <div class="space-y-5">

    <!-- ── HERO institucional ─────────────────────────────────────────────── -->
    <div v-if="cargando" class="skeleton h-36 w-full rounded-box"></div>
    <div v-else-if="datos" class="dash-hero bg-marino relative overflow-hidden rounded-3xl text-white shadow-[0_24px_60px_-28px_rgba(12,39,67,0.65)]">
      <div class="absolute inset-0" aria-hidden="true">
        <div class="absolute inset-0" style="background: radial-gradient(700px 260px at 12% 0%, #2E6DA455 0%, transparent 60%), radial-gradient(500px 300px at 105% 100%, #C9A22722 0%, transparent 55%); background: radial-gradient(700px 260px at 12% 0%, color-mix(in srgb, var(--color-secondary) 33%, transparent) 0%, transparent 60%), radial-gradient(500px 300px at 105% 100%, color-mix(in srgb, var(--color-dorado) 13%, transparent) 0%, transparent 55%);"></div>
        <div class="absolute -right-16 -bottom-20 h-64 w-64 rounded-full border-[22px] border-white/[0.05]"></div>
      </div>
      <div class="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-dorado via-dorado-claro to-dorado" aria-hidden="true"></div>
      <div class="relative p-5 sm:p-6 flex flex-wrap items-center gap-4">
        <span class="w-14 h-14 rounded-2xl bg-white/10 border border-dorado/30 flex items-center justify-center text-xl font-bold shrink-0 text-dorado-claro">
          {{ inicialesUE }}
        </span>
        <div class="min-w-0 flex-1">
          <h2 class="font-display text-lg sm:text-2xl font-bold leading-tight truncate text-white">
            {{ institucion?.nombre ?? 'Panel institucional' }}
          </h2>
          <p class="text-white/75 text-xs sm:text-sm mt-1">
            Gestión {{ datos.gestion.anio }}
            <span v-if="gestionStore.director"> · Dir. {{ gestionStore.director.nombre }} {{ gestionStore.director.apellido }}</span>
            <span v-if="trimestreActivo"> · {{ trimestreActivo.nombre }} en curso</span>
          </p>
        </div>
        <div class="text-right shrink-0">
          <p class="font-display text-3xl font-extrabold leading-none tabular-nums text-white">{{ avanceGestion }}<span class="text-dorado-claro">%</span></p>
          <p class="text-white/65 text-xs mt-1">año lectivo ({{ trimestresCerrados }}/{{ datos.trimestres.length }} trim.)</p>
        </div>
      </div>
      <progress class="progress h-1.5 w-full rounded-none [&::-webkit-progress-value]:bg-dorado [&::-moz-progress-bar]:bg-dorado" :value="avanceGestion" max="100" :aria-valuenow="avanceGestion" aria-label="Avance del año lectivo" />
    </div>

    <!-- Error -->
    <div v-if="error" role="alert" class="alert alert-error">
      <span>{{ error }}</span>
    </div>

    <template v-if="datos">
      <!-- ── 1. ALERTAS ───────────────────────────────────────────────────── -->
      <div class="space-y-3">
        <PendientesCierre v-if="pendientes" :datos="pendientes" />
        <div v-else-if="erroresBloque.pendientes" role="alert" class="alert alert-error py-2 text-sm">
          <AppIcon nombre="alerta" class="h-4 w-4 shrink-0" />
          <span class="flex-1">No se pudieron revisar los pendientes: {{ erroresBloque.pendientes }}</span>
          <button type="button" class="btn btn-sm min-h-11" @click="cargarPendientes">Reintentar</button>
        </div>
        <div v-else-if="trimestreActivo" class="flex items-center gap-2 text-sm text-base-content/50">
          <span class="loading loading-spinner loading-xs"></span> Revisando pendientes de cierre…
        </div>
        <div v-else role="alert" class="alert alert-success py-2 text-sm">
          <AppIcon nombre="check" class="h-4 w-4" />
          <span>Los trimestres están cerrados — gestión completa.</span>
        </div>

        <div v-if="cursos && cursosSinInscritos.length" role="alert" class="alert alert-warning py-2 text-sm">
          <AppIcon nombre="alerta" class="h-4 w-4 shrink-0" />
          <span>
            {{ cursosSinInscritos.length }} curso(s) sin inscritos:
            <strong>{{ cursosSinInscritos.map(c => nombreCurso(c)).join(', ') }}</strong>
          </span>
        </div>

        <div v-if="dimensiones && !dimensionesOk" role="alert" class="alert alert-warning py-2 text-sm">
          <AppIcon nombre="alerta" class="h-4 w-4 shrink-0" />
          <span>
            Las dimensiones suman <strong>{{ sumaDimensiones }}%</strong> (deberían dar 100%) — revisá los pesos en Dimensiones.
          </span>
        </div>

        <div v-if="materias && materiasSinAsignar.length" role="alert" class="alert alert-warning py-2 text-sm">
          <AppIcon nombre="estructura" class="h-4 w-4 shrink-0" />
          <span>
            {{ materiasSinAsignar.length }} materia(s) sin asignar a ningún curso:
            <strong>{{ materiasSinAsignar.map(m => m.nombre).join(', ') }}</strong>
          </span>
        </div>

        <div v-if="docentesSinAsignar.length" role="alert" class="alert alert-warning py-2 text-sm">
          <AppIcon nombre="personas" class="h-4 w-4 shrink-0" />
          <span>
            {{ docentesSinAsignar.length }} docente(s) sin asignación:
            <strong>{{ docentesSinAsignar.join(', ') }}</strong>
          </span>
        </div>
      </div>

      <!-- ── 2. INDICADORES ───────────────────────────────────────────────── -->
      <div class="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <div v-for="card in [
          { label: 'Estudiantes', valor: String(datos.indicadores.totalEstudiantes), icono: 'estudiantes', fondo: 'bg-primary/10 text-primary', nota: `${cursos?.length ?? 0} cursos` },
          { label: 'Docentes', valor: String(datos.indicadores.totalDocentes), icono: 'personas', fondo: 'bg-secondary/10 text-secondary', nota: 'planta activa' },
          { label: 'Promedio general', valor: datos.indicadores.promedioGeneral.toFixed(1), icono: 'reportes', fondo: 'bg-info/10 text-info', nota: 'escala 1–100' },
          { label: 'Recaudado', valor: `Bs. ${datos.indicadores.totalRecaudado.toLocaleString('es-BO')}`, icono: 'pagos', fondo: 'bg-success/10 text-success', nota: `${datos.indicadores.pagosPendientes} pago(s) pendiente(s)` },
        ]" :key="card.label" class="card bg-base-100 border border-base-300/60 shadow-[0_16px_36px_-24px_rgba(26,60,94,0.5)] hover:shadow-[0_20px_44px_-24px_rgba(26,60,94,0.55)] transition-shadow">
          <div class="card-body p-4 flex-row items-center gap-3">
            <span class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" :class="card.fondo">
              <AppIcon :nombre="card.icono" class="h-5 w-5" />
            </span>
            <span class="min-w-0">
              <span class="block text-xs font-medium text-base-content/60">{{ card.label }}</span>
              <span class="block font-display text-xl sm:text-2xl font-extrabold tabular-nums truncate">{{ card.valor }}</span>
              <span v-if="card.nota" class="block text-[11px] text-base-content/50 truncate">{{ card.nota }}</span>
            </span>
          </div>
        </div>
      </div>

      <div class="card bg-base-100 border border-base-300/60 shadow-sm overflow-hidden">
        <dl class="grid grid-cols-2 sm:grid-cols-4 gap-px bg-base-300">
          <div class="bg-base-100 px-4 py-3">
            <dt class="text-[11px] font-medium text-base-content/55">Cursos</dt>
            <dd class="font-display text-lg font-bold tabular-nums">{{ datos.indicadores.totalCursos }} <span class="text-xs font-medium text-base-content/50">· {{ cursosSinInscritos.length }} vacíos</span></dd>
          </div>
          <div class="bg-base-100 px-4 py-3">
            <dt class="text-[11px] font-medium text-base-content/55">En riesgo</dt>
            <dd class="font-display text-lg font-bold tabular-nums">{{ datos.indicadores.estudiantesEnRiesgo }} <span class="text-xs font-medium text-base-content/50">· asistencia o notas</span></dd>
          </div>
          <div class="bg-base-100 px-4 py-3">
            <dt class="text-[11px] font-medium text-base-content/55">Asistencia prom.</dt>
            <dd class="font-display text-lg font-bold tabular-nums">{{ datos.indicadores.promedioAsistencia.toFixed(0) }}% <span class="text-xs font-medium text-base-content/50">· todas las materias</span></dd>
          </div>
          <div class="bg-base-100 px-4 py-3">
            <dt class="text-[11px] font-medium text-base-content/55">Bajo rendimiento</dt>
            <dd class="font-display text-lg font-bold tabular-nums">{{ datos.indicadores.bajosRendimiento }} <span class="text-xs font-medium text-base-content/50">· bajo la mínima</span></dd>
          </div>
        </dl>
      </div>

      <!-- ── Línea de tiempo de trimestres ────────────────────────────────── -->
      <details class="card colapsable group bg-base-100 shadow" open>
        <summary class="flex cursor-pointer list-none items-center gap-2 p-4 font-semibold sm:p-5 [&::-webkit-details-marker]:hidden">
          <AppIcon nombre="gestiones" class="h-5 w-5 text-primary" />
          <span class="flex-1">Trimestres</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-base-content/40 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div class="px-4 pb-4 sm:px-5 sm:pb-5">
          <ol class="flex flex-col sm:flex-row sm:items-start gap-3">
            <li v-for="(t, i) in (gestionStore.trimestres.length ? gestionStore.trimestres : datos.trimestres)" :key="t.id ?? t.numero"
              class="flex sm:flex-col sm:flex-1 sm:text-center items-start sm:items-center gap-2 sm:gap-0">
              <span class="flex sm:w-full items-center">
                <span class="hidden sm:block h-px flex-1" :class="i === 0 ? 'bg-transparent' : (t.cerrado ? 'bg-success/50' : 'bg-base-300')"></span>
                <span class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  :class="t.cerrado ? 'bg-success text-success-content' : 'bg-primary text-primary-content ring-4 ring-primary/15'">
                  <AppIcon v-if="t.cerrado" nombre="check" class="h-4 w-4" />
                  <span v-else>{{ t.numero }}</span>
                </span>
                <span class="hidden sm:block h-px flex-1" :class="t.cerrado ? 'bg-success/50' : 'bg-base-300'"></span>
              </span>
              <span class="sm:mt-1">
                <span class="block font-medium text-sm">{{ t.nombre }}</span>
                <span class="block text-[11px] text-base-content/50">
                  {{ fechaCorta((t as any).fechaInicio) }} – {{ fechaCorta((t as any).fechaFin) }}
                </span>
                <span v-if="!t.cerrado && diasRestantes((t as any).fechaFin) !== null" class="badge badge-xs mt-0.5"
                  :class="(diasRestantes((t as any).fechaFin) ?? 0) < 0 ? 'badge-error' : 'badge-info'">
                  {{ (diasRestantes((t as any).fechaFin) ?? 0) < 0 ? 'venció hace' : 'faltan' }}
                  {{ Math.abs(diasRestantes((t as any).fechaFin) ?? 0) }} días
                </span>
                <span v-else-if="t.cerrado" class="badge badge-xs badge-ghost mt-0.5">Cerrado</span>
              </span>
            </li>
          </ol>
        </div>
      </details>

      <!-- ── Estructura + dimensiones ─────────────────────────────────────── -->
      <details class="colapsable group" open>
        <summary class="flex cursor-pointer list-none items-center gap-2 rounded-2xl px-1 py-2 font-semibold [&::-webkit-details-marker]:hidden">
          <AppIcon nombre="estructura" class="h-5 w-5 text-primary" />
          <span class="flex-1">Estructura y dimensiones</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-base-content/40 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <div class="flex items-center gap-2 mb-1">
              <AppIcon nombre="estructura" class="h-5 w-5 text-accent" />
              <h3 class="font-semibold">Estructura</h3>
            </div>
            <div v-if="cursos && materias" class="stats stats-vertical min-[480px]:stats-horizontal w-full shadow-none">
              <div class="stat px-0">
                <div class="stat-title text-xs">Cursos</div>
                <div class="stat-value text-3xl">{{ cursos.length }}</div>
              </div>
              <div class="stat px-0">
                <div class="stat-title text-xs">Materias</div>
                <div class="stat-value text-3xl">{{ materias.length }}</div>
              </div>
            </div>
            <div v-else-if="erroresBloque.estructura" role="alert" class="alert alert-error py-2 text-sm">
              <span class="flex-1">No se pudo cargar la estructura: {{ erroresBloque.estructura }}</span>
              <button type="button" class="btn btn-sm min-h-11" @click="cargarEstructura">Reintentar</button>
            </div>
            <div v-else class="skeleton h-12 w-full"></div>
            <router-link to="/director/estructura" class="link link-primary text-xs mt-2 inline-flex items-center gap-1">Ir a Estructura <AppIcon nombre="promocion" class="h-3.5 w-3.5" /></router-link>
          </div>
        </div>

        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <div class="flex items-center gap-2 mb-1">
              <AppIcon nombre="dimensiones" class="h-5 w-5 text-secondary" />
              <h3 class="font-semibold flex-1">Dimensiones</h3>
              <span v-if="dimensiones" class="badge badge-sm" :class="dimensionesOk ? 'badge-success' : 'badge-warning'">
                {{ sumaDimensiones }}%
              </span>
            </div>
            <div v-if="dimensiones" class="space-y-1.5">
              <div v-for="d in dimensiones" :key="d.id">
                <div class="flex justify-between text-xs mb-0.5">
                  <span>{{ d.nombre }}</span>
                  <span class="font-mono">{{ (d.pesoEnPromedio * 100).toFixed(0) }}%</span>
                </div>
                <progress class="progress progress-primary h-1.5 w-full" :value="d.pesoEnPromedio * 100" max="100" />
              </div>
            </div>
            <div v-else-if="erroresBloque.dimensiones" role="alert" class="alert alert-error py-2 text-sm">
              <span class="flex-1">No se pudieron cargar las dimensiones: {{ erroresBloque.dimensiones }}</span>
              <button type="button" class="btn btn-sm min-h-11" @click="cargarDimensiones">Reintentar</button>
            </div>
            <div v-else class="skeleton h-12 w-full"></div>
            <router-link to="/director/dimensiones" class="link link-primary text-xs mt-2 inline-flex items-center gap-1">Ir a Dimensiones <AppIcon nombre="promocion" class="h-3.5 w-3.5" /></router-link>
          </div>
        </div>
        </div>
      </details>

      <!-- ── 3. RENDIMIENTO + EXPLORADOR ──────────────────────────────────── -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <RendimientoCursos v-if="detalleAcademico" :detalle="detalleAcademico" />
        <div v-else-if="erroresBloque.academico" role="alert" class="alert alert-error">
          <AppIcon nombre="alerta" class="h-4 w-4 shrink-0" />
          <span class="flex-1 text-sm">No se pudo cargar el rendimiento: {{ erroresBloque.academico }}</span>
          <button type="button" class="btn btn-sm min-h-11" @click="cargarAcademico">Reintentar</button>
        </div>
        <div v-else class="skeleton h-48 w-full rounded-xl"></div>
        <CursoExplorer v-if="cursos" :cursos="cursos" />
        <div v-else-if="erroresBloque.estructura" role="alert" class="alert alert-error">
          <AppIcon nombre="alerta" class="h-4 w-4 shrink-0" />
          <span class="flex-1 text-sm">No se pudieron cargar los cursos: {{ erroresBloque.estructura }}</span>
          <button type="button" class="btn btn-sm min-h-11" @click="cargarEstructura">Reintentar</button>
        </div>
        <div v-else class="skeleton h-32 w-full rounded-xl"></div>
      </div>

      <!-- ── 4. MEJORES + INSCRIPCIONES ────────────────────────────────────── -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <template v-if="detalleAcademico">
          <MejoresGestion :detalle="detalleAcademico" />
          <EstadoInscripciones :detalle="detalleAcademico" />
        </template>
        <div v-else-if="erroresBloque.academico" role="alert" class="alert alert-error xl:col-span-2">
          <AppIcon nombre="alerta" class="h-4 w-4 shrink-0" />
          <span class="flex-1 text-sm">No se pudieron cargar los destacados ni inscripciones: {{ erroresBloque.academico }}</span>
          <button type="button" class="btn btn-sm min-h-11" @click="cargarAcademico">Reintentar</button>
        </div>
        <template v-else>
          <div class="skeleton h-48 w-full rounded-xl"></div>
          <div class="skeleton h-48 w-full rounded-xl"></div>
        </template>
      </div>

    </template>

  </div>
</template>

<style scoped>
.font-display { font-family: var(--font-display); }
.dash-hero ::selection { background: var(--color-dorado); color: var(--color-marino); }
.tabular-nums { font-variant-numeric: tabular-nums; }
.colapsable > summary:focus-visible {
  outline: 2px solid var(--color-dorado);
  outline-offset: 2px;
  border-radius: 0.75rem;
}
</style>