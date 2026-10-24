<script setup lang="ts">
// Comparativo entre gestiones: ¿mejoró el rendimiento de un año a otro?
import { ref, computed, onMounted } from 'vue'
import { reporteApi, type ComparativoResponse } from '@/api/reporte.api'

const datos    = ref<ComparativoResponse | null>(null)
const cargando = ref(true)
const error    = ref<string | null>(null)

onMounted(async () => {
  try { datos.value = await reporteApi.getComparativo() }
  catch (e) { error.value = e instanceof Error ? e.message : 'No se pudo cargar el comparativo' }
  finally { cargando.value = false }
})

const anios = computed(() => (datos.value?.gestiones ?? []).map(g => g.anio))
const fmt = (n: number | null | undefined, d = 1) => (n === null || n === undefined ? '—' : n.toFixed(d))

// Matriz materia × año
const materias = computed(() => {
  const mapa = new Map<string, Record<number, number | null>>()
  for (const r of datos.value?.porMateria ?? []) {
    if (!mapa.has(r.materia)) mapa.set(r.materia, {})
    mapa.get(r.materia)![r.anio] = r.promedio
  }
  return [...mapa.entries()].map(([materia, porAnio]) => ({ materia, porAnio }))
})

// Variación respecto al año anterior con datos
function variacion(porAnio: Record<number, number | null>, anio: number): number | null {
  const idx = anios.value.indexOf(anio)
  const actual = porAnio[anio]
  if (idx <= 0 || actual === null || actual === undefined) return null
  for (let i = idx - 1; i >= 0; i--) {
    const previo = porAnio[anios.value[i]]
    if (previo !== null && previo !== undefined) return actual - previo
  }
  return null
}
const claseNota = (n: number | null | undefined) =>
  n === null || n === undefined ? 'text-base-content/30' : n >= 71 ? 'text-success font-semibold' : n >= 51 ? 'text-warning font-semibold' : 'text-error font-semibold'

const NIVEL: Record<string, string> = { PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria', INICIAL: 'Inicial' }
const gradosPorAnio = computed(() => {
  const m = new Map<string, Record<number, { promedio: number | null; estudiantes: number }>>()
  for (const r of datos.value?.porGrado ?? []) {
    const k = `${r.grado}° ${NIVEL[r.nivel] ?? r.nivel}`
    if (!m.has(k)) m.set(k, {})
    m.get(k)![r.anio] = { promedio: r.promedio, estudiantes: r.estudiantes }
  }
  return [...m.entries()].map(([grado, porAnio]) => ({ grado, porAnio }))
})
</script>

<template>
  <div class="card bg-base-100 shadow">
    <div class="card-body gap-4 p-4">
      <div>
        <h3 class="font-semibold text-lg">Comparativo entre gestiones</h3>
        <p class="text-sm text-base-content/60">Cómo evolucionó el rendimiento año a año: aprobación, promedios y asistencia.</p>
      </div>

      <div v-if="cargando" class="skeleton h-32 w-full"></div>
      <div v-else-if="error" role="alert" class="alert alert-error text-sm"><span>{{ error }}</span></div>
      <p v-else-if="!datos || datos.gestiones.length === 0" class="text-center text-base-content/50 py-4">Aún no hay gestiones para comparar.</p>

      <template v-else>
        <!-- Resumen por gestión -->
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Gestión</th><th class="text-right">Inscritos</th><th class="text-right">Promovidos</th>
                <th class="text-right">Reprobados</th><th class="text-right">Retirados</th>
                <th class="min-w-40">Aprobación</th>
                <th class="text-center">T1</th><th class="text-center">T2</th><th class="text-center">T3</th>
                <th class="text-right">Prom. final</th><th class="text-right">Asistencia</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="g in datos.gestiones" :key="g.gestionId" class="hover">
                <td class="font-semibold">{{ g.anio }}</td>
                <td class="text-right">{{ g.inscritos }}</td>
                <td class="text-right">{{ g.promovidos }}</td>
                <td class="text-right">{{ g.reprobados }}</td>
                <td class="text-right">{{ g.retirados }}</td>
                <td>
                  <div v-if="g.tasaAprobacion !== null" class="flex items-center gap-2">
                    <progress class="progress progress-success w-24" :value="g.tasaAprobacion" max="100"></progress>
                    <span class="text-xs">{{ g.tasaAprobacion.toFixed(1) }}%</span>
                  </div>
                  <span v-else class="text-xs text-base-content/40">{{ g.pendientes ? 'en curso' : '—' }}</span>
                </td>
                <td v-for="n in [1, 2, 3]" :key="n" class="text-center" :class="claseNota(g.promedioPorTrimestre[n])">{{ fmt(g.promedioPorTrimestre[n]) }}</td>
                <td class="text-right" :class="claseNota(g.promedioGeneral)">{{ fmt(g.promedioGeneral, 2) }}</td>
                <td class="text-right">{{ g.asistencia === null ? '—' : g.asistencia.toFixed(1) + '%' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Materia × año -->
        <div v-if="materias.length">
          <h4 class="font-semibold text-sm mb-1">Promedio final por materia</h4>
          <div class="overflow-x-auto">
            <table class="table table-xs">
              <thead>
                <tr><th>Materia</th><th v-for="a in anios" :key="a" class="text-center">{{ a }}</th></tr>
              </thead>
              <tbody>
                <tr v-for="m in materias" :key="m.materia" class="hover">
                  <td>{{ m.materia }}</td>
                  <td v-for="a in anios" :key="a" class="text-center">
                    <span :class="claseNota(m.porAnio[a])">{{ fmt(m.porAnio[a]) }}</span>
                    <span v-if="variacion(m.porAnio, a) !== null" class="ml-1 text-[10px]"
                      :class="variacion(m.porAnio, a)! >= 0 ? 'text-success' : 'text-error'">
                      {{ variacion(m.porAnio, a)! >= 0 ? '▲' : '▼' }}{{ Math.abs(variacion(m.porAnio, a)!).toFixed(1) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Grado × año -->
        <div v-if="gradosPorAnio.length">
          <h4 class="font-semibold text-sm mb-1">Promedio final por grado</h4>
          <div class="overflow-x-auto">
            <table class="table table-xs">
              <thead>
                <tr><th>Grado</th><th v-for="a in anios" :key="a" class="text-center">{{ a }}</th></tr>
              </thead>
              <tbody>
                <tr v-for="r in gradosPorAnio" :key="r.grado" class="hover">
                  <td>{{ r.grado }}</td>
                  <td v-for="a in anios" :key="a" class="text-center">
                    <span :class="claseNota(r.porAnio[a]?.promedio)">{{ fmt(r.porAnio[a]?.promedio) }}</span>
                    <span v-if="r.porAnio[a]" class="ml-1 text-[10px] text-base-content/40">({{ r.porAnio[a].estudiantes }})</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="text-[11px] text-base-content/40 mt-1">Entre paréntesis: cantidad de estudiantes. ▲▼ = variación frente a la gestión anterior con datos.</p>
        </div>
      </template>
    </div>
  </div>
</template>