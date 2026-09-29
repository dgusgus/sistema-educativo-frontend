<script setup lang="ts">
import { ref, computed } from 'vue'
import { boletinApi, type BoletinGeneralResponse, type DetalleBoletinEstudiante } from '@/api/boletin.api'
import StatusBadge from '../StatusBadge.vue'

// Lista presentacional: recibe el Boletín General ya cargado por la vista.
// El detalle por dimensión (SER/SABER/HACER + actividades) se pide lazy al
// expandir cada estudiante. NUNCA renderiza un modal: el único modal de
// detalle vive en BoletinEstudianteCard (tab Individual, con v-if + @close).
const props = defineProps<{ boletin: BoletinGeneralResponse }>()

// ── Filtros locales (no tocan el backend) ─────────────────────────────────────
const query = ref('')
const materiaFiltro = ref<number | ''>('')
const expandido = ref<number | null>(null)

// ── Detalle por estudiante (lazy: solo al expandir) ───────────────────────────
// GET /boletin/detalle/:inscripcionId → materias × trimestres × dimensiones
// (promedio) × actividades (nota / puntajeMaximo). Se cachea por inscripción.
const detalles = ref<Record<number, DetalleBoletinEstudiante>>({})
const cargando = ref<Record<number, boolean>>({})
const errorDet = ref<Record<number, string | null>>({})
const trimSel = ref<Record<number, number>>({})

const estudiantesFiltrados = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.boletin.estudiantes
  return props.boletin.estudiantes.filter(e => e.nombreCompleto.toLowerCase().includes(q))
})

function claseNota(nota: number | null): string {
  if (nota === null) return 'text-base-content/30'
  if (nota >= 71) return 'text-success font-semibold'
  if (nota >= 51) return 'text-warning font-semibold'
  return 'text-error font-semibold'
}

function inicial(nombre: string): string {
  return (nombre.trim()[0] ?? '•').toUpperCase()
}

async function toggle(inscripcionId: number) {
  expandido.value = expandido.value === inscripcionId ? null : inscripcionId
  if (expandido.value !== inscripcionId) return
  // Trimestre por defecto: el primero con nota, si no el primero
  if (!trimSel.value[inscripcionId] && props.boletin.trimestres.length) {
    const est = props.boletin.estudiantes.find(e => e.inscripcionId === inscripcionId)
    const conNota = props.boletin.trimestres.find(t => est?.promedioGeneralPorTrimestre[t.id] != null)
    trimSel.value[inscripcionId] = (conNota ?? props.boletin.trimestres[0]).id
  }
  if (detalles.value[inscripcionId] || cargando.value[inscripcionId]) return
  cargando.value[inscripcionId] = true
  errorDet.value[inscripcionId] = null
  try {
    detalles.value[inscripcionId] = await boletinApi.getDetalle(inscripcionId)
  } catch (e) {
    errorDet.value[inscripcionId] = e instanceof Error ? e.message : 'Error al cargar el detalle'
  } finally {
    cargando.value[inscripcionId] = false
  }
}

function reintentar(inscripcionId: number) {
  delete detalles.value[inscripcionId]
  cargando.value[inscripcionId] = false
  errorDet.value[inscripcionId] = null
  const abierto = expandido.value === inscripcionId
  expandido.value = null
  if (abierto) void toggle(inscripcionId)
}

function materiasVisibles(inscripcionId: number) {
  const det = detalles.value[inscripcionId]
  if (!det) return []
  return det.materias.filter(m => materiaFiltro.value === '' || m.docenteMateriaCursoId === materiaFiltro.value)
}

function nombreTrim(det: DetalleBoletinEstudiante, inscripcionId: number): string {
  return det.materias[0]?.trimestres.find(t => t.trimestreId === trimSel.value[inscripcionId])?.nombre ?? ''
}

function totalMateria(det: DetalleBoletinEstudiante, dmcId: number, trimestreId: number): number | null {
  const mat = det.materias.find(m => m.docenteMateriaCursoId === dmcId)
  return mat?.trimestres.find(t => t.trimestreId === trimestreId)?.total ?? null
}
</script>

<template>
  <div class="space-y-3">
    <!-- Buscador + filtro materia -->
    <div class="flex flex-col sm:flex-row gap-2">
      <label class="input input-bordered flex items-center gap-2 w-full sm:max-w-xs">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="h-4 w-4 opacity-50">
          <path fill-rule="evenodd" d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" clip-rule="evenodd" />
        </svg>
        <input v-model="query" type="search" placeholder="Buscar estudiante..." class="grow" />
      </label>
      <select v-model="materiaFiltro" class="select select-bordered select-sm w-full sm:w-auto sm:min-w-52">
        <option :value="''">Todas las materias</option>
        <option v-for="m in boletin.materias" :key="m.docenteMateriaCursoId" :value="m.docenteMateriaCursoId">
          Ver solo: {{ m.nombre }}
        </option>
      </select>
    </div>

    <p class="text-xs text-base-content/50">{{ estudiantesFiltrados.length }} estudiante(s) — tocá un card para ver SER / SABER / HACER por trimestre</p>

    <!-- Cards por estudiante: 1 col en celular, 2 en desktop -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
      <div v-for="est in estudiantesFiltrados" :key="est.inscripcionId"
        class="rounded-box border border-base-300 bg-base-100 shadow-sm overflow-hidden h-fit">
        <button class="w-full flex items-center gap-3 p-3 text-left" @click="toggle(est.inscripcionId)">
          <span class="avatar placeholder">
            <span class="bg-primary/10 text-primary rounded-full w-9 h-9 flex items-center justify-center font-bold">
              {{ inicial(est.nombreCompleto) }}
            </span>
          </span>
          <span class="flex-1 min-w-0">
            <span class="block font-medium text-sm truncate">{{ est.nombreCompleto }}</span>
            <span class="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-base-content/60 mt-0.5">
              <span v-for="t in boletin.trimestres" :key="`mini-${est.inscripcionId}-${t.id}`" :class="claseNota(est.promedioGeneralPorTrimestre[t.id])">
                T{{ t.numero }}: {{ est.promedioGeneralPorTrimestre[t.id] ?? '—' }}
              </span>
            </span>
          </span>
          <span class="text-right shrink-0">
            <span class="block font-bold text-lg leading-none" :class="claseNota(est.promedioGeneralAnual)">
              {{ est.promedioGeneralAnual ?? '—' }}
            </span>
            <StatusBadge v-if="est.promedioGeneralAnual !== null" class="mt-1"
              :estado="est.promedioGeneralAnual >= 51 ? 'PROMOVIDO' : 'REPROBADO'" tamano="xs" />
          </span>
          <span class="text-base-content/40 text-sm">{{ expandido === est.inscripcionId ? '▲' : '▼' }}</span>
        </button>

        <!-- Detalle expandible -->
        <div v-if="expandido === est.inscripcionId" class="border-t border-base-300">
          <!-- Cargando -->
          <div v-if="cargando[est.inscripcionId]" class="p-3 space-y-2">
            <div class="skeleton h-8 w-full"></div>
            <div class="skeleton h-16 w-full"></div>
            <div class="skeleton h-16 w-full"></div>
          </div>
          <!-- Error -->
          <div v-else-if="errorDet[est.inscripcionId]" class="p-3">
            <div role="alert" class="alert alert-error py-2 text-sm">
              <span>{{ errorDet[est.inscripcionId] }}</span>
              <button class="btn btn-sm btn-ghost ml-auto" @click.stop="reintentar(est.inscripcionId)">Reintentar</button>
            </div>
          </div>
          <!-- Detalle: SER(ex1,ex2) SABER(...) HACER(...) + total T -->
          <div v-else-if="detalles[est.inscripcionId]" class="p-3 space-y-3">
            <!-- Tabs de trimestre -->
            <div role="tablist" class="tabs tabs-boxed w-fit">
              <a v-for="t in detalles[est.inscripcionId].materias[0]?.trimestres ?? []" :key="t.trimestreId"
                role="tab" class="tab tab-sm"
                :class="trimSel[est.inscripcionId] === t.trimestreId ? 'tab-active' : ''"
                @click.stop="trimSel[est.inscripcionId] = t.trimestreId">
                T{{ t.numero }}
              </a>
            </div>

            <!-- Total del trimestre seleccionado -->
            <div class="stats stats-horizontal w-full shadow">
              <div class="stat py-2 px-3">
                <div class="stat-title text-xs">Total {{ nombreTrim(detalles[est.inscripcionId], est.inscripcionId) }}</div>
                <div class="stat-value text-2xl" :class="claseNota(est.promedioGeneralPorTrimestre[trimSel[est.inscripcionId]])">
                  {{ est.promedioGeneralPorTrimestre[trimSel[est.inscripcionId]] ?? '—' }}
                </div>
                <div class="stat-desc text-xs">promedio del trimestre (todas las materias)</div>
              </div>
            </div>

            <!-- Materias del trimestre -->
            <div v-for="mat in materiasVisibles(est.inscripcionId)" :key="mat.docenteMateriaCursoId"
              class="collapse collapse-arrow border border-base-300 bg-base-200/40">
              <input type="checkbox" class="peer" />
              <div class="collapse-title py-2 px-3 flex items-center gap-2 text-sm">
                <span class="font-medium flex-1">{{ mat.nombre }}</span>
                <span class="badge badge-sm font-mono"
                  :class="(totalMateria(detalles[est.inscripcionId], mat.docenteMateriaCursoId, trimSel[est.inscripcionId]) ?? 0) >= 51 ? 'badge-success badge-outline' : 'badge-error badge-outline'">
                  T: {{ totalMateria(detalles[est.inscripcionId], mat.docenteMateriaCursoId, trimSel[est.inscripcionId]) ?? '—' }}
                </span>
              </div>
              <div class="collapse-content px-3 space-y-2">
                <div v-for="dim in (mat.trimestres.find(t => t.trimestreId === trimSel[est.inscripcionId])?.dimensiones ?? [])"
                  :key="dim.dimensionId" class="rounded-lg bg-base-100 border border-base-200 p-2">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-xs font-bold uppercase tracking-wide">{{ dim.nombre }}</span>
                    <span class="badge badge-sm badge-ghost font-mono">prom {{ dim.promedio ?? '—' }}</span>
                  </div>
                  <div v-if="dim.actividades.length" class="flex flex-wrap gap-1 mt-1.5">
                    <span v-for="act in dim.actividades" :key="act.actividadEvaluativaId"
                      class="badge badge-sm badge-outline font-normal"
                      :title="`${act.nombre} (máx ${act.puntajeMaximo})`">
                      {{ act.nombre }}: <strong class="ml-1 font-mono">{{ act.nota ?? '—' }}/{{ act.puntajeMaximo }}</strong>
                    </span>
                  </div>
                  <p v-else class="text-xs text-base-content/40 mt-1">Sin actividades registradas</p>
                </div>
              </div>
            </div>
            <p v-if="!materiasVisibles(est.inscripcionId).length" class="text-xs text-base-content/40 text-center py-2">
              Sin materias para este filtro
            </p>
          </div>
        </div>
      </div>
    </div>

    <p v-if="!estudiantesFiltrados.length" class="text-center text-base-content/40 py-8 text-sm">
      Sin coincidencias para "{{ query }}"
    </p>
  </div>
</template>
