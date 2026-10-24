<script setup lang="ts">
// Historial académico: todas las gestiones de un estudiante, con filtro por
// gestión y trimestre. Lo usan Director/Secretaría (buscando al estudiante),
// el propio estudiante (modo="mio") y el tutor (estudianteId de su vinculado).
import { ref, computed, watch } from 'vue'
import { historialApi, type HistorialEstudiante, type HistorialGestion } from '@/api/historial.api'
import { descargarBlob } from '@/api/boletin.api'

const props = defineProps<{ estudianteId?: number; modo?: 'mio' }>()

const datos       = ref<HistorialEstudiante | null>(null)
const cargando    = ref(false)
const error       = ref<string | null>(null)
const descargando = ref(false)

const filtroGestion   = ref<number | ''>('')   // gestionId
const filtroTrimestre = ref<number | ''>('')   // número de trimestre (1, 2, 3)

let seq = 0
async function cargar() {
  datos.value = null
  error.value = null
  filtroGestion.value = ''
  filtroTrimestre.value = ''
  if (props.modo !== 'mio' && !props.estudianteId) return
  const mio = ++seq
  cargando.value = true
  try {
    const r = props.modo === 'mio' ? await historialApi.getMio() : await historialApi.get(props.estudianteId!)
    if (mio === seq) datos.value = r
  } catch (e) {
    if (mio === seq) error.value = e instanceof Error ? e.message : 'No se pudo cargar el historial'
  } finally {
    if (mio === seq) cargando.value = false
  }
}
watch(() => [props.estudianteId, props.modo], cargar, { immediate: true })

// Más reciente primero
const gestionesVisibles = computed<HistorialGestion[]>(() => {
  const todas = [...(datos.value?.gestiones ?? [])].sort((a, b) => b.anio - a.anio)
  return filtroGestion.value ? todas.filter(g => g.gestionId === filtroGestion.value) : todas
})

// Columnas de trimestre a mostrar en una gestión según el filtro
const trimestresDe = (g: HistorialGestion) =>
  filtroTrimestre.value ? g.trimestres.filter(t => t.numero === filtroTrimestre.value) : g.trimestres

const nota = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toFixed(0))
const claseNota = (n: number | null | undefined, minima: number) =>
  n === null || n === undefined ? 'text-base-content/30' : n < minima ? 'text-error font-semibold' : ''

const NIVEL: Record<string, string> = { PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria', INICIAL: 'Inicial' }
const cursoTxt = (g: HistorialGestion) => `${g.curso.grado}° ${NIVEL[g.curso.nivel] ?? g.curso.nivel} "${g.curso.paralelo}"`

function estado(g: HistorialGestion): { texto: string; clase: string } {
  if (g.resultado === 'PROMOVIDO')  return { texto: 'Promovido',  clase: 'badge-success' }
  if (g.resultado === 'REPROBADO')  return { texto: 'Reprobado',  clase: 'badge-error' }
  if (g.estadoInscripcion === 'RETIRADA') return { texto: 'Retirado', clase: 'badge-warning' }
  return { texto: 'En curso', clase: 'badge-info' }
}

async function descargarPdf() {
  if (!datos.value) return
  descargando.value = true
  try {
    const blob = await historialApi.pdf(datos.value.estudiante.id)
    descargarBlob(blob, `historial_${datos.value.estudiante.apellido}_${datos.value.estudiante.nombre}.pdf`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo generar el PDF'
  } finally {
    descargando.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="cargando" class="space-y-3">
      <div class="skeleton h-16 w-full"></div>
      <div class="skeleton h-40 w-full"></div>
    </div>

    <div v-else-if="error" role="alert" class="alert alert-error text-sm"><span>{{ error }}</span></div>

    <template v-else-if="datos">
      <!-- Cabecera + filtros -->
      <div class="card bg-base-100 shadow">
        <div class="card-body gap-3 p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 class="font-semibold text-lg">{{ datos.estudiante.apellido }}, {{ datos.estudiante.nombre }}</h3>
              <p class="text-xs text-base-content/60">
                CI {{ datos.estudiante.ci ?? '—' }} · RUDE {{ datos.estudiante.rude ?? '—' }} ·
                {{ datos.gestiones.length }} gestión(es) registrada(s)
              </p>
            </div>
            <button class="btn btn-primary btn-sm" :disabled="descargando || datos.gestiones.length === 0" @click="descargarPdf">
              <span v-if="descargando" class="loading loading-spinner loading-xs"></span>
              Descargar historial (PDF)
            </button>
          </div>

          <div v-if="datos.gestiones.length" class="flex flex-wrap gap-3">
            <fieldset class="fieldset">
              <legend class="fieldset-legend text-xs">Gestión</legend>
              <select v-model="filtroGestion" class="select select-bordered select-sm">
                <option value="">Todas</option>
                <option v-for="g in [...datos.gestiones].sort((a, b) => b.anio - a.anio)" :key="g.gestionId" :value="g.gestionId">{{ g.anio }}</option>
              </select>
            </fieldset>
            <fieldset class="fieldset">
              <legend class="fieldset-legend text-xs">Trimestre</legend>
              <select v-model="filtroTrimestre" class="select select-bordered select-sm">
                <option value="">Todos</option>
                <option :value="1">1.er trimestre</option>
                <option :value="2">2.º trimestre</option>
                <option :value="3">3.er trimestre</option>
              </select>
            </fieldset>
          </div>
        </div>
      </div>

      <p v-if="datos.gestiones.length === 0" class="text-center text-base-content/50 py-8">
        Este estudiante aún no tiene gestiones registradas.
      </p>

      <!-- Una tarjeta por gestión -->
      <div v-for="g in gestionesVisibles" :key="g.gestionId" class="card bg-base-100 shadow">
        <div class="card-body gap-3 p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 class="font-semibold">Gestión {{ g.anio }} — {{ cursoTxt(g) }}</h4>
              <p class="text-xs text-base-content/60">
                Promedio anual: <strong>{{ g.promedioAnual === null ? '—' : g.promedioAnual.toFixed(2) }}</strong>
                · Asistencia: <strong>{{ g.asistenciaGeneral === null ? '—' : g.asistenciaGeneral.toFixed(1) + '%' }}</strong>
                · Nota mínima: {{ g.notaMinima }}
              </p>
            </div>
            <span class="badge" :class="estado(g).clase">{{ estado(g).texto }}</span>
          </div>

          <div v-if="g.materias.length === 0" class="text-sm text-base-content/50">Sin materias ni notas registradas en esta gestión.</div>
          <div v-else class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Materia</th>
                  <th v-for="t in trimestresDe(g)" :key="t.id" class="text-center">T{{ t.numero }}</th>
                  <th v-if="!filtroTrimestre" class="text-center">Anual</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in g.materias" :key="m.codigo" class="hover">
                  <td>
                    {{ m.materia }}
                    <span v-if="m.campoSaber" class="block text-[10px] text-base-content/40">{{ m.campoSaber }}</span>
                  </td>
                  <td v-for="t in trimestresDe(g)" :key="t.id" class="text-center" :class="claseNota(m.notas[t.id], g.notaMinima)">{{ nota(m.notas[t.id]) }}</td>
                  <td v-if="!filtroTrimestre" class="text-center font-bold" :class="claseNota(m.promedioFinal, g.notaMinima)">{{ nota(m.promedioFinal) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="font-semibold bg-base-200/60">
                  <td>Promedio general</td>
                  <td v-for="t in trimestresDe(g)" :key="t.id" class="text-center">
                    {{ g.promedioPorTrimestre[t.id] === null || g.promedioPorTrimestre[t.id] === undefined ? '—' : g.promedioPorTrimestre[t.id]!.toFixed(1) }}
                  </td>
                  <td v-if="!filtroTrimestre" class="text-center">{{ g.promedioAnual === null ? '—' : g.promedioAnual.toFixed(2) }}</td>
                </tr>
                <tr class="text-xs text-base-content/60">
                  <td>Asistencia</td>
                  <td v-for="t in trimestresDe(g)" :key="t.id" class="text-center">
                    {{ g.asistenciaPorTrimestre[t.id] === null || g.asistenciaPorTrimestre[t.id] === undefined ? '—' : g.asistenciaPorTrimestre[t.id]!.toFixed(0) + '%' }}
                  </td>
                  <td v-if="!filtroTrimestre" class="text-center">{{ g.asistenciaGeneral === null ? '—' : g.asistenciaGeneral.toFixed(0) + '%' }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>