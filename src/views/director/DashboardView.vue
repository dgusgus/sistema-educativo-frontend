<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { reporteApi } from '@/api/reporte.api'
import { cursoApi, materiaApi, trimestreApi, nombreCurso } from '@/api/estructura.api'
import { evaluacionApi } from '@/api/evaluacion.api'
import { institucionApi } from '@/api/institucion.api'
import { useGestionStore } from '@/stores/gestion.store'
import type { DashboardResponse, DimensionEvaluacion, Materia, Curso, Institucion } from '@/types'
import AppIcon from '@/components/AppIcon.vue'
import PendientesCierre from '@/components/dashboard/PendientesCierre.vue'
import CursoExplorer from '@/components/dashboard/CursoExplorer.vue'
import RendimientoCursos from '@/components/dashboard/RendimientoCursos.vue'
import type { PendientesCierre as Pendientes } from '@/api/estructura.api'

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

const inicialesUE = computed(() =>
  (institucion.value?.nombre ?? 'UE').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()
)

function diasRestantes(fechaFin: string | null | undefined): number | null {
  if (!fechaFin) return null
  return Math.ceil((new Date(fechaFin).getTime() - Date.now()) / 86400000)
}

function fechaCorta(fecha: string | null | undefined): string {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleDateString('es-BO', { day: 'numeric', month: 'short' })
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

  const gestionId = datos.value.gestion.id
  const trim = datos.value.trimestres.find(t => !t.cerrado) ?? null

  // Bloques independientes — cada uno falla por su cuenta sin tumbar al resto
  evaluacionApi.getDimensiones(gestionId).then(r => { dimensiones.value = r }).catch(() => {})
  materiaApi.getAll().then(r => { materias.value = r }).catch(() => {})
  cursoApi.getAll(gestionId).then(r => { cursos.value = r }).catch(() => {})
  institucionApi.get().then(r => { institucion.value = r }).catch(() => {})
  gestionStore.cargar().catch(() => {})
  if (trim) {
    trimestreApi.getPendientes(trim.id).then(r => { pendientes.value = r }).catch(() => {})
  }
})
</script>

<template>
  <div class="space-y-5">

    <!-- ── HERO institucional ─────────────────────────────────────────────── -->
    <div v-if="cargando" class="skeleton h-36 w-full rounded-box"></div>
    <div v-else-if="datos" class="rounded-box overflow-hidden text-white shadow"
      style="background: linear-gradient(135deg, #1A3C5E 0%, #2E6DA4 60%, #3F8F5F 130%)">
      <div class="p-5 sm:p-6 flex flex-wrap items-center gap-4">
        <span class="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-xl font-bold shrink-0">
          {{ inicialesUE }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-white/70 text-xs uppercase tracking-wider">Unidad Educativa</p>
          <h2 class="text-lg sm:text-2xl font-bold leading-tight truncate">
            {{ institucion?.nombre ?? 'Panel institucional' }}
          </h2>
          <p class="text-white/70 text-xs sm:text-sm mt-0.5">
            Gestión {{ datos.gestion.anio }}
            <span v-if="gestionStore.director"> · Dir. {{ gestionStore.director.nombre }} {{ gestionStore.director.apellido }}</span>
            <span v-if="trimestreActivo"> · {{ trimestreActivo.nombre }} en curso</span>
          </p>
        </div>
        <div class="text-right shrink-0">
          <p class="text-3xl font-bold leading-none">{{ avanceGestion }}%</p>
          <p class="text-white/60 text-xs mt-1">año lectivo ({{ trimestresCerrados }}/{{ datos.trimestres.length }} trim.)</p>
        </div>
      </div>
      <progress class="progress progress-warning h-1.5 w-full rounded-none" :value="avanceGestion" max="100" />
    </div>

    <!-- Error -->
    <div v-if="error" role="alert" class="alert alert-error">
      <span>{{ error }}</span>
    </div>

    <template v-if="datos">
      <!-- ── 1. ALERTAS ───────────────────────────────────────────────────── -->
      <div class="space-y-3">
        <PendientesCierre v-if="pendientes" :datos="pendientes" />
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
      </div>

      <!-- ── 2. INDICADORES ───────────────────────────────────────────────── -->
      <div class="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <div v-for="card in [
          { label: 'Estudiantes', valor: String(datos.indicadores.totalEstudiantes), icono: 'estudiantes', fondo: 'bg-primary/10 text-primary', nota: `${cursos?.length ?? 0} cursos` },
          { label: 'Docentes', valor: String(datos.indicadores.totalDocentes), icono: 'personas', fondo: 'bg-secondary/10 text-secondary', nota: 'planta activa' },
          { label: 'Cursos', valor: String(datos.indicadores.totalCursos), icono: 'estructura', fondo: 'bg-accent/10 text-accent', nota: `${cursosSinInscritos.length} vacíos` },
          { label: 'En riesgo', valor: String(datos.indicadores.estudiantesEnRiesgo), icono: 'alerta', fondo: 'bg-warning/10 text-warning', nota: 'asistencia o notas' },
          { label: 'Promedio general', valor: datos.indicadores.promedioGeneral.toFixed(1), icono: 'reportes', fondo: 'bg-info/10 text-info', nota: 'escala 1–100' },
          { label: 'Asistencia prom.', valor: `${datos.indicadores.promedioAsistencia.toFixed(0)}%`, icono: 'asistencia', fondo: 'bg-success/10 text-success', nota: 'todas las materias' },
          { label: 'Bajo rendimiento', valor: String(datos.indicadores.bajosRendimiento), icono: 'escuela', fondo: 'bg-error/10 text-error', nota: 'bajo la nota mínima' },
          { label: 'Recaudado', valor: `Bs. ${datos.indicadores.totalRecaudado.toLocaleString('es-BO')}`, icono: 'pagos', fondo: 'bg-success/10 text-success', nota: `${datos.indicadores.pagosPendientes} pago(s) pendiente(s)` },
        ]" :key="card.label" class="card bg-base-100 shadow hover:shadow-md transition-shadow">
          <div class="card-body p-4 flex-row items-center gap-3">
            <span class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" :class="card.fondo">
              <AppIcon :nombre="card.icono" class="h-5 w-5" />
            </span>
            <span class="min-w-0">
              <span class="block text-xs text-base-content/60">{{ card.label }}</span>
              <span class="block text-xl sm:text-2xl font-bold truncate">{{ card.valor }}</span>
              <span v-if="card.nota" class="block text-[11px] text-base-content/40 truncate">{{ card.nota }}</span>
            </span>
          </div>
        </div>
      </div>

      <!-- ── Línea de tiempo de trimestres ────────────────────────────────── -->
      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <h3 class="font-semibold mb-3">Trimestres</h3>
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
      </div>

      <!-- ── Estructura + dimensiones ─────────────────────────────────────── -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <div class="flex items-center gap-2 mb-1">
              <AppIcon nombre="estructura" class="h-5 w-5 text-accent" />
              <h3 class="font-semibold">Estructura</h3>
            </div>
            <div v-if="cursos && materias" class="stats stats-horizontal w-full shadow-none">
              <div class="stat px-0">
                <div class="stat-title text-xs">Cursos</div>
                <div class="stat-value text-3xl">{{ cursos.length }}</div>
              </div>
              <div class="stat px-0">
                <div class="stat-title text-xs">Materias</div>
                <div class="stat-value text-3xl">{{ materias.length }}</div>
              </div>
            </div>
            <div v-else class="skeleton h-12 w-full"></div>
            <router-link to="/director/estructura" class="link link-primary text-xs mt-2">Ir a Estructura →</router-link>
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
            <div v-else class="skeleton h-12 w-full"></div>
            <router-link to="/director/dimensiones" class="link link-primary text-xs mt-2">Ir a Dimensiones →</router-link>
          </div>
        </div>
      </div>

      <!-- ── 3. RENDIMIENTO + EXPLORADOR ──────────────────────────────────── -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <RendimientoCursos v-if="datos" :gestion-id="datos.gestion.id" />
        <CursoExplorer v-if="cursos" :cursos="cursos" />
        <div v-else class="skeleton h-32 w-full rounded-xl"></div>
      </div>

    </template>

  </div>
</template>
