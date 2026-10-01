<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { asistenciaApi, type ReporteCursoItem } from '@/api/asistencia.api'
import { useBuscadorEstudiante } from '@/composables/useBuscadorEstudiante.ts'
import { useGestionStore } from '@/stores/gestion.store'
import AppIcon from '@/components/AppIcon.vue'
import AsistenciaReporteCursoCards from '@/components/asistencia/Asistenciareportecursocards.vue'
import AsistenciaReporteCursoTabla from '@/components/asistencia/Asistenciareportecursotabla.vue'
import AsistenciaDetalleVista, { type RegistroAsistencia } from '@/components/asistencia/AsistenciaDetalleVista.vue'
import RankingPodio from '@/components/boletines/RankingPodio.vue'

const gestion = useGestionStore()
const route = useRoute()
onMounted(() => gestion.cargar())

// ── Tabs (1 acción por pantalla, igual que Boletines) ─────────────────────────
type Tab = 'individual' | 'curso' | 'general' | 'ranking'
const tab = ref<Tab>('individual')

// ── Individual: días por materia y trimestre ──────────────────────────────────
const buscadorInd = useBuscadorEstudiante()
const registros = ref<RegistroAsistencia[]>([])
const cargandoInd = ref(false)
const errorInd = ref<string | null>(null)

watch(
  () => buscadorInd.seleccionado.value?.id,
  async (estudianteId) => {
    registros.value = []
    errorInd.value = null
    if (!estudianteId) return
    cargandoInd.value = true
    try {
      const todos = await asistenciaApi.getHistorial({ estudianteId }) as RegistroAsistencia[]
      // El historial trae todas las gestiones — quedarse con la activa
      const ids = new Set(gestion.trimestres.map(t => t.id))
      registros.value = todos.filter(r => ids.has(r.trimestreId))
    } catch (e) {
      errorInd.value = e instanceof Error ? e.message : 'Error al cargar la asistencia'
    } finally {
      cargandoInd.value = false
    }
  },
)

// ── Reportes por curso (1 fetch por tab, lazy como en Boletines) ──────────────
interface RespuestaCurso {
  cursoId: number
  gestionId: number
  totalEstudiantes: number
  estudiantesEnRiesgo: number
  reporte: ReporteCursoItem[]
}

async function fetchReporte(cursoId: number) {
  if (!gestion.gestionId) throw new Error('No hay una gestión activa')
  return asistenciaApi.getReporteCurso(cursoId, gestion.gestionId)
}

// Por curso: matriz % por materia
const cursoId = ref<number | ''>('')
const respuesta = ref<RespuestaCurso | null>(null)
const cargando = ref(false)
const error = ref<string | null>(null)

async function verReporte() {
  if (!cursoId.value) { error.value = 'Elegí un curso'; return }
  cargando.value = true
  error.value = null
  respuesta.value = null
  try {
    respuesta.value = await fetchReporte(Number(cursoId.value))
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar el reporte'
  } finally {
    cargando.value = false
  }
}

// General: consolidado + alertas
const cursoIdGeneral = ref<number | ''>('')
const respuestaGeneral = ref<RespuestaCurso | null>(null)
const cargandoGeneral = ref(false)
const errorGeneral = ref<string | null>(null)

async function verGeneral() {
  if (!cursoIdGeneral.value) { errorGeneral.value = 'Elegí un curso'; return }
  cargandoGeneral.value = true
  errorGeneral.value = null
  respuestaGeneral.value = null
  try {
    respuestaGeneral.value = await fetchReporte(Number(cursoIdGeneral.value))
  } catch (e) {
    errorGeneral.value = e instanceof Error ? e.message : 'Error al cargar el consolidado'
  } finally {
    cargandoGeneral.value = false
  }
}

// Consolidado por materia: % promedio del curso + totales P/A/R/J
const consolidado = computed(() => {
  if (!respuestaGeneral.value) return []
  const map = new Map<number, { nombre: string; pct: number[]; p: number; a: number; r: number; j: number }>()
  for (const est of respuestaGeneral.value.reporte) {
    for (const d of est.detalleXMateria) {
      const g = map.get(d.docenteMateriaCursoId) ?? {
        nombre: d.docenteMateriaCurso.materia.nombre, pct: [], p: 0, a: 0, r: 0, j: 0,
      }
      g.pct.push(Number(d.porcentaje))
      g.p += d.totalPresente; g.a += d.totalAusente; g.r += d.totalRetraso; g.j += d.totalJustificado
      map.set(d.docenteMateriaCursoId, g)
    }
  }
  return Array.from(map.values())
    .map(g => ({ ...g, promedio: g.pct.reduce((s, v) => s + v, 0) / g.pct.length }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
})

// Ranking: podio T1/T2/T3/General reutilizado de boletines
const cursoIdRanking = ref<number | ''>('')
const respuestaRanking = ref<RespuestaCurso | null>(null)
const cargandoRanking = ref(false)
const errorRanking = ref<string | null>(null)
const limiteRanking = ref(3)
const periodoRanking = ref<number | 'general'>('general')

async function verRanking() {
  if (!cursoIdRanking.value) { errorRanking.value = 'Elegí un curso'; return }
  cargandoRanking.value = true
  errorRanking.value = null
  respuestaRanking.value = null
  try {
    respuestaRanking.value = await fetchReporte(Number(cursoIdRanking.value))
  } catch (e) {
    errorRanking.value = e instanceof Error ? e.message : 'Error al cargar el ranking'
  } finally {
    cargandoRanking.value = false
  }
}

function promedioTrim(item: ReporteCursoItem, trimId: number): number | null {
  const ds = item.detalleXMateria.filter(d => d.trimestre.id === trimId)
  if (!ds.length) return null
  return ds.reduce((s, d) => s + Number(d.porcentaje), 0) / ds.length
}

interface RankItem { puesto: number; inscripcionId: number; nombreCompleto: string; promedio: number }

function rankear(items: Array<{ inscripcionId: number; nombreCompleto: string; valor: number | null }>, limite: number): RankItem[] {
  const conNota = items
    .filter((i): i is { inscripcionId: number; nombreCompleto: string; valor: number } => i.valor !== null)
    .sort((a, b) => b.valor - a.valor)
  const resultado: RankItem[] = []
  let puesto = 0
  let anterior: number | null = null
  for (let i = 0; i < conNota.length; i++) {
    const item = conNota[i]
    if (item.valor !== anterior) { puesto = i + 1; anterior = item.valor }
    if (puesto > limite) break
    resultado.push({ puesto, inscripcionId: item.inscripcionId, nombreCompleto: item.nombreCompleto, promedio: item.valor })
  }
  return resultado
}

const rankingItems = computed<RankItem[]>(() => {
  if (!respuestaRanking.value) return []
  return rankear(
    respuestaRanking.value.reporte.map(est => ({
      inscripcionId: est.inscripcionId,
      nombreCompleto: `${est.estudiante.apellido}, ${est.estudiante.nombre}`,
      valor: periodoRanking.value === 'general'
        ? est.promedioGeneral
        : promedioTrim(est, Number(periodoRanking.value)),
    })),
    limiteRanking.value
  )
})

function tituloRanking(): string {
  if (periodoRanking.value === 'general') return 'Promedio General'
  return gestion.trimestres.find(t => t.id === periodoRanking.value)?.nombre ?? ''
}

// ?cursoId= (ej: desde Boletines) → ir directo al tab Por curso y cargar
onMounted(async () => {
  await gestion.cargar()
  const q = route.query.cursoId
  const id = Array.isArray(q) ? q[0] : q
  if (id && gestion.cursos.some(c => c.id === Number(id))) {
    tab.value = 'curso'
    cursoId.value = Number(id)
    await verReporte()
  }
})
</script>

<template>
  <div class="space-y-4">
    <div>
      <h2 class="text-2xl font-bold">Reporte de Asistencia</h2>
      <p class="text-sm text-base-content/60">Elegí una pestaña según lo que necesites ver</p>
    </div>

    <!-- Tabs -->
    <div role="tablist" class="tabs tabs-boxed w-full overflow-x-auto sticky top-0 z-10 bg-base-200/80 backdrop-blur p-1">
      <a role="tab" class="tab whitespace-nowrap" :class="tab === 'individual' ? 'tab-active' : ''" @click="tab = 'individual'">Individual</a>
      <a role="tab" class="tab whitespace-nowrap" :class="tab === 'curso' ? 'tab-active' : ''" @click="tab = 'curso'">Por curso</a>
      <a role="tab" class="tab whitespace-nowrap" :class="tab === 'general' ? 'tab-active' : ''" @click="tab = 'general'">General</a>
      <a role="tab" class="tab whitespace-nowrap" :class="tab === 'ranking' ? 'tab-active' : ''" @click="tab = 'ranking'">Ranking</a>
    </div>

    <!-- ── TAB: Individual ───────────────────────────────────────────────── -->
    <section v-if="tab === 'individual'" class="card bg-base-100 shadow">
      <div class="card-body space-y-4">
        <div>
          <h3 class="font-semibold text-lg">Asistencia Individual</h3>
          <p class="text-sm text-base-content/60">Día por día, en cada materia y trimestre</p>
        </div>

        <div v-if="errorInd" role="alert" class="alert alert-error py-2 text-sm"><span>{{ errorInd }}</span></div>

        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Estudiante</legend>
          <div class="relative">
            <label class="input input-bordered flex items-center gap-2 w-full">
              <AppIcon nombre="buscar" class="h-4 w-4 opacity-50" />
              <input v-model="buscadorInd.query.value" type="search" placeholder="Nombre o CI..." class="grow"
                @input="buscadorInd.onInput" />
              <span v-if="buscadorInd.buscando.value" class="loading loading-spinner loading-xs"></span>
            </label>
            <ul v-if="buscadorInd.resultados.value.length"
              class="absolute z-10 mt-1 w-full bg-base-100 rounded-box shadow-lg border border-base-300 max-h-56 overflow-y-auto">
              <li v-for="e in buscadorInd.resultados.value" :key="e.id">
                <button class="w-full text-left px-4 py-2 hover:bg-base-200 flex justify-between items-center"
                  @click="buscadorInd.seleccionar(e)">
                  <span>{{ e.apellido }}, {{ e.nombre }}</span>
                  <span class="font-mono text-xs text-base-content/50">{{ e.ci }}</span>
                </button>
              </li>
            </ul>
          </div>
          <p v-if="buscadorInd.seleccionado.value" class="text-xs text-success mt-1">
            ✓ {{ buscadorInd.seleccionado.value.nombre }} {{ buscadorInd.seleccionado.value.apellido }}
            <button type="button" class="link ml-1" @click="buscadorInd.limpiar">cambiar</button>
          </p>
        </fieldset>

        <div v-if="buscadorInd.seleccionado.value">
          <div v-if="cargandoInd" class="space-y-2">
            <div class="skeleton h-8 w-full"></div>
            <div class="skeleton h-24 w-full"></div>
          </div>
          <AsistenciaDetalleVista v-else-if="registros.length" :registros="registros" :trimestres="gestion.trimestres" />
          <p v-else class="text-center text-base-content/40 text-sm py-4">
            Sin registros de asistencia en la gestión activa
          </p>
        </div>
        <p v-else class="text-center text-base-content/40 text-sm py-4">
          Buscá y elegí un estudiante para ver día por día
        </p>
      </div>
    </section>

    <!-- ── TAB: Por curso ────────────────────────────────────────────────── -->
    <section v-if="tab === 'curso'" class="card bg-base-100 shadow">
      <div class="card-body space-y-4">
        <div>
          <h3 class="font-semibold text-lg">Por curso</h3>
          <p class="text-sm text-base-content/60">Porcentaje por estudiante y materia, curso completo</p>
        </div>

        <div v-if="error" role="alert" class="alert alert-error py-2 text-sm"><span>{{ error }}</span></div>

        <div class="flex flex-col sm:flex-row gap-3 sm:items-end">
          <fieldset class="fieldset flex-1">
            <legend class="fieldset-legend text-xs">Curso</legend>
            <select v-model="cursoId" class="select select-bordered w-full">
              <option value="" disabled>Seleccionar curso</option>
              <option v-for="c in gestion.cursos" :key="c.id" :value="c.id">{{ c.nombre }}</option>
            </select>
          </fieldset>
          <button class="btn btn-primary w-full sm:w-auto" :disabled="cargando || !cursoId" @click="verReporte">
            <span v-if="cargando" class="loading loading-spinner loading-sm"></span>
            Ver reporte
          </button>
        </div>

        <div v-if="respuesta" class="space-y-3">
          <AsistenciaReporteCursoCards :reporte="respuesta.reporte" />

          <details class="hidden md:block rounded-box border border-base-300">
            <summary class="cursor-pointer px-4 py-2 text-sm font-medium text-base-content/70 hover:text-base-content">
              Vista tabla completa (comparar todo el curso)
            </summary>
            <div class="p-2">
              <AsistenciaReporteCursoTabla :reporte="respuesta.reporte" />
            </div>
          </details>
        </div>
      </div>
    </section>

    <!-- ── TAB: General ──────────────────────────────────────────────────── -->
    <section v-if="tab === 'general'" class="card bg-base-100 shadow">
      <div class="card-body space-y-4">
        <div>
          <h3 class="font-semibold text-lg">General</h3>
          <p class="text-sm text-base-content/60">Consolidado del curso: totales y promedio por materia</p>
        </div>

        <div v-if="errorGeneral" role="alert" class="alert alert-error py-2 text-sm"><span>{{ errorGeneral }}</span></div>

        <div class="flex flex-col sm:flex-row gap-3 sm:items-end">
          <fieldset class="fieldset flex-1">
            <legend class="fieldset-legend text-xs">Curso</legend>
            <select v-model="cursoIdGeneral" class="select select-bordered w-full">
              <option value="" disabled>Seleccionar curso</option>
              <option v-for="c in gestion.cursos" :key="c.id" :value="c.id">{{ c.nombre }}</option>
            </select>
          </fieldset>
          <button class="btn btn-primary w-full sm:w-auto" :disabled="cargandoGeneral || !cursoIdGeneral" @click="verGeneral">
            <span v-if="cargandoGeneral" class="loading loading-spinner loading-sm"></span>
            Ver consolidado
          </button>
        </div>

        <div v-if="respuestaGeneral" class="space-y-3">
          <div class="stats stats-horizontal shadow w-full">
            <div class="stat py-2 px-4">
              <div class="stat-title text-xs">Total estudiantes</div>
              <div class="stat-value text-xl">{{ respuestaGeneral.totalEstudiantes }}</div>
            </div>
            <div class="stat py-2 px-4">
              <div class="stat-title text-xs">En riesgo (&lt; 80%)</div>
              <div class="stat-value text-xl" :class="respuestaGeneral.estudiantesEnRiesgo > 0 ? 'text-error' : ''">
                {{ respuestaGeneral.estudiantesEnRiesgo }}
              </div>
            </div>
          </div>

          <div class="rounded-box border border-base-300 overflow-hidden">
            <table class="table table-sm">
              <thead>
                <tr><th>Materia</th><th class="text-center">% prom.</th><th class="text-center">P</th><th class="text-center">A</th><th class="text-center">R</th><th class="text-center">J</th></tr>
              </thead>
              <tbody>
                <tr v-for="m in consolidado" :key="m.nombre" class="hover">
                  <td class="font-medium">{{ m.nombre }}</td>
                  <td class="text-center font-mono font-bold" :class="m.promedio >= 80 ? 'text-success' : 'text-error'">
                    {{ m.promedio.toFixed(0) }}%
                  </td>
                  <td class="text-center font-mono">{{ m.p }}</td>
                  <td class="text-center font-mono">{{ m.a }}</td>
                  <td class="text-center font-mono">{{ m.r }}</td>
                  <td class="text-center font-mono">{{ m.j }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p class="text-xs text-base-content/40 text-center">
            ¿Necesitás las notas de este curso? Mirá los
            <router-link :to="{ name: 'secretaria-boletines' }" class="link link-primary">Boletines</router-link>
          </p>
        </div>
      </div>
    </section>

    <!-- ── TAB: Ranking ──────────────────────────────────────────────────── -->
    <section v-if="tab === 'ranking'" class="card bg-base-100 shadow">
      <div class="card-body space-y-4">
        <div>
          <h3 class="font-semibold text-lg">Ranking de asistencia</h3>
          <p class="text-sm text-base-content/60">Podio por trimestre y general, a partir del reporte del curso</p>
        </div>

        <div v-if="errorRanking" role="alert" class="alert alert-error py-2 text-sm"><span>{{ errorRanking }}</span></div>

        <div class="flex flex-col sm:flex-row gap-3 sm:items-end">
          <fieldset class="fieldset flex-1">
            <legend class="fieldset-legend text-xs">Curso</legend>
            <select v-model="cursoIdRanking" class="select select-bordered w-full">
              <option value="" disabled>Seleccionar curso</option>
              <option v-for="c in gestion.cursos" :key="c.id" :value="c.id">{{ c.nombre }}</option>
            </select>
          </fieldset>
          <fieldset class="fieldset w-full sm:w-24">
            <legend class="fieldset-legend text-xs">Puestos</legend>
            <input v-model.number="limiteRanking" type="number" min="1" max="10" class="input input-bordered w-full" />
          </fieldset>
          <button class="btn btn-primary w-full sm:w-auto" :disabled="cargandoRanking || !cursoIdRanking" @click="verRanking">
            <span v-if="cargandoRanking" class="loading loading-spinner loading-sm"></span>
            Ver ranking
          </button>
        </div>

        <div v-if="respuestaRanking" class="space-y-3">
          <div role="tablist" class="tabs tabs-boxed w-fit max-w-full overflow-x-auto">
            <a v-for="t in gestion.trimestres" :key="t.id" role="tab" class="tab tab-sm whitespace-nowrap"
              :class="periodoRanking === t.id ? 'tab-active' : ''" @click="periodoRanking = t.id">
              T{{ t.numero }}
            </a>
            <a role="tab" class="tab tab-sm whitespace-nowrap"
              :class="periodoRanking === 'general' ? 'tab-active' : ''" @click="periodoRanking = 'general'">
              General
            </a>
          </div>

          <RankingPodio :titulo="tituloRanking()" :items="rankingItems" :destacado="periodoRanking === 'general'" />
        </div>
      </div>
    </section>

  </div>
</template>
