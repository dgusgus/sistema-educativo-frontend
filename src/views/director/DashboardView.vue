<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { reporteApi } from '@/api/reporte.api'
import { cursoApi, materiaApi, trimestreApi, nombreCurso } from '@/api/estructura.api'
import { evaluacionApi } from '@/api/evaluacion.api'
import type { DashboardResponse, DimensionEvaluacion, Materia, Curso } from '@/types'
import PendientesCierre from '@/components/dashboard/PendientesCierre.vue'
import CursoExplorer from '@/components/dashboard/CursoExplorer.vue'
import type { PendientesCierre as Pendientes } from '@/api/estructura.api'

// Dashboard en 3 bloques: alertas (lo que exige acción) → indicadores y
// estado → explorador por curso. Cada bloque carga independiente: si un
// endpoint falla, los demás igual se muestran.
const datos    = ref<DashboardResponse | null>(null)
const cargando = ref(true)
const error    = ref<string | null>(null)

const dimensiones = ref<DimensionEvaluacion[] | null>(null)
const materias    = ref<Materia[] | null>(null)
const cursos      = ref<Curso[] | null>(null)
const pendientes  = ref<Pendientes | null>(null)

const trimestreActivo = computed(() => datos.value?.trimestres.find(t => !t.cerrado) ?? null)

const sumaDimensiones = computed(() =>
  Math.round((dimensiones.value ?? []).reduce((s, d) => s + d.pesoEnPromedio, 0) * 1000) / 10
)
const dimensionesOk = computed(() => Math.abs(sumaDimensiones.value - 100) < 0.05)

const cursosSinInscritos = computed(() =>
  (cursos.value ?? []).filter(c => (c._count?.inscripciones ?? 0) === 0)
)

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
  if (trim) {
    trimestreApi.getPendientes(trim.id).then(r => { pendientes.value = r }).catch(() => {})
  }
})
</script>

<template>
  <div class="space-y-6">

    <!-- Encabezado con gestión activa -->
    <div class="flex items-baseline gap-3">
      <h2 class="text-2xl font-bold">Dashboard Institucional</h2>
      <span v-if="datos" class="badge badge-neutral">
        Gestión {{ datos.gestion.anio }}
      </span>
    </div>

    <!-- Error -->
    <div v-if="error" role="alert" class="alert alert-error">
      <span>{{ error }}</span>
    </div>

    <!-- Skeleton mientras carga -->
    <div v-if="cargando" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <div v-for="i in 6" :key="i" class="skeleton h-28 rounded-xl"></div>
    </div>

    <template v-else-if="datos">
      <!-- ── 1. ALERTAS (lo que exige acción) ─────────────────────────────── -->
      <div class="space-y-4">
        <PendientesCierre v-if="pendientes" :datos="pendientes" />
        <div v-else-if="trimestreActivo" class="flex items-center gap-2 text-sm text-base-content/50">
          <span class="loading loading-spinner loading-xs"></span> Revisando pendientes de cierre…
        </div>
        <div v-else role="alert" class="alert alert-success py-2 text-sm">
          <span>Los 3 trimestres están cerrados — gestión completa.</span>
        </div>

        <div v-if="cursos && cursosSinInscritos.length" role="alert" class="alert alert-warning py-2 text-sm">
          <span>
            {{ cursosSinInscritos.length }} curso(s) sin inscritos:
            <strong>{{ cursosSinInscritos.map(c => nombreCurso(c)).join(', ') }}</strong>
          </span>
        </div>

        <div v-if="dimensiones && !dimensionesOk" role="alert" class="alert alert-warning py-2 text-sm">
          <span>
            Las dimensiones suman <strong>{{ sumaDimensiones }}%</strong> (deberían dar 100%) — revisá los pesos en Dimensiones.
          </span>
        </div>
      </div>

      <!-- ── 2. INDICADORES ───────────────────────────────────────────────── -->
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <p class="text-sm text-base-content/60">Total Estudiantes</p>
            <p class="text-4xl font-bold text-primary">{{ datos.indicadores.totalEstudiantes }}</p>
          </div>
        </div>

        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <p class="text-sm text-base-content/60">Total Docentes</p>
            <p class="text-4xl font-bold text-secondary">{{ datos.indicadores.totalDocentes }}</p>
          </div>
        </div>

        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <p class="text-sm text-base-content/60">Cursos Activos</p>
            <p class="text-4xl font-bold text-accent">{{ datos.indicadores.totalCursos }}</p>
          </div>
        </div>

        <div class="card bg-base-100 shadow border border-warning/30">
          <div class="card-body">
            <p class="text-sm text-base-content/60">Estudiantes en Riesgo</p>
            <p class="text-4xl font-bold text-warning">{{ datos.indicadores.estudiantesEnRiesgo }}</p>
            <p class="text-xs text-base-content/40">asistencia o rendimiento bajo</p>
          </div>
        </div>

        <div class="card bg-base-100 shadow sm:col-span-2">
          <div class="card-body">
            <p class="text-sm text-base-content/60">Promedio General</p>
            <p class="text-4xl font-bold text-info">{{ datos.indicadores.promedioGeneral.toFixed(1) }}</p>
            <p class="text-xs text-base-content/40">escala 1–100 (Ley 070)</p>
          </div>
        </div>

        <div class="card bg-base-100 shadow sm:col-span-2">
          <div class="card-body">
            <p class="text-sm text-base-content/60">Monto Recaudado</p>
            <p class="text-4xl font-bold text-success">
              Bs. {{ datos.indicadores.totalRecaudado.toLocaleString('es-BO') }}
            </p>
            <p class="text-xs text-base-content/40">
              {{ datos.indicadores.pagosPendientes }} pago(s) pendiente(s)
            </p>
          </div>
        </div>

      </div>

      <!-- ── Estado de trimestres ─────────────────────────────────────────── -->
      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <h3 class="font-semibold mb-3">Trimestres</h3>
          <div class="flex flex-wrap gap-3">
            <div
              v-for="t in datos.trimestres"
              :key="t.numero"
              class="flex items-center gap-2 px-3 py-2 rounded-lg border"
              :class="t.cerrado ? 'border-base-300 bg-base-200' : 'border-primary/30 bg-primary/5'"
            >
              <span class="font-medium text-sm">{{ t.nombre }}</span>
              <span class="badge badge-sm" :class="t.cerrado ? 'badge-ghost' : 'badge-primary'">
                {{ t.cerrado ? 'Cerrado' : 'Activo' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Estructura + dimensiones (estático) ──────────────────────────── -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <h3 class="font-semibold mb-1">Estructura</h3>
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

      <!-- ── 3. EXPLORADOR POR CURSO ──────────────────────────────────────── -->
      <CursoExplorer v-if="cursos" :cursos="cursos" />
      <div v-else class="skeleton h-32 w-full rounded-xl"></div>

    </template>

  </div>
</template>
