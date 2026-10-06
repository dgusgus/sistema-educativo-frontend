<script setup lang="ts">
import { computed } from 'vue'
import type { ReporteAcademicoDetalle } from '@/api/reporte.api'
import AppIcon from '@/components/AppIcon.vue'

// Ranking de mejores estudiantes. Dos modos:
//  - Trimestral (trimestreNumero !== null): mejor alumno por curso según el
//    promedio del trimestre activo, ordenado desc; cada curso se expande
//    (estilo PendientesCierre) para ver su top-3. Útil todo el año.
//  - Anual (trimestreNumero === null, gestión completa): top-5 global por
//    promedio final, como antes. Recibe el detalle ya cargado por el
//    Dashboard — no pide nada por su cuenta.
const props = defineProps<{
  detalle: ReporteAcademicoDetalle[]
  trimestreNumero: number | null
  trimestreNombre: string
}>()

interface TopItem {
  nombre: string
  curso: string
  promedio: number
}

interface AlumnoCurso {
  nombre: string
  promedio: number
  materias: number
}

interface CursoTop {
  curso: string
  mejor: AlumnoCurso
  top3: AlumnoCurso[]
}

const topAnual = computed<TopItem[]>(() => {
  const items: TopItem[] = []
  for (const d of props.detalle) {
    if (!d.promediosFinales.length) continue
    const prom = d.promediosFinales.reduce((s, p) => s + p.promedioFinal, 0) / d.promediosFinales.length
    items.push({
      nombre: `${d.estudiante.apellido}, ${d.estudiante.nombre}`,
      curso: `${d.curso.grado}° "${d.curso.paralelo}"`,
      promedio: Math.round(prom * 10) / 10,
    })
  }
  return items.sort((a, b) => b.promedio - a.promedio).slice(0, 5)
})

const porCurso = computed<CursoTop[]>(() => {
  const trim = props.trimestreNumero
  if (trim === null) return []
  const cursos = new Map<number, { etiqueta: string; alumnos: AlumnoCurso[] }>()
  for (const d of props.detalle) {
    const notas = d.calificaciones.filter(
      c => c.trimestre?.numero === trim && c.promedioTrimestral !== null,
    )
    if (!notas.length) continue
    const prom = notas.reduce((s, c) => s + (c.promedioTrimestral ?? 0), 0) / notas.length
    const grupo = cursos.get(d.cursoId) ?? {
      etiqueta: `${d.curso.grado}° "${d.curso.paralelo}"`,
      alumnos: [],
    }
    grupo.alumnos.push({
      nombre: `${d.estudiante.apellido}, ${d.estudiante.nombre}`,
      promedio: Math.round(prom * 10) / 10,
      materias: notas.length,
    })
    cursos.set(d.cursoId, grupo)
  }
  return [...cursos.values()]
    .map(g => {
      const top3 = [...g.alumnos].sort((a, b) => b.promedio - a.promedio).slice(0, 3)
      return { curso: g.etiqueta, mejor: top3[0], top3 }
    })
    .sort((a, b) => b.mejor.promedio - a.mejor.promedio)
})

function estiloPuesto(puesto: number): string {
  if (puesto === 1) return 'bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950'
  if (puesto === 2) return 'bg-gradient-to-b from-slate-200 to-slate-400 text-slate-800'
  if (puesto === 3) return 'bg-gradient-to-b from-orange-300 to-orange-500 text-orange-950'
  return 'bg-base-300 text-base-content'
}

function clasePromedio(promedio: number): string {
  if (promedio >= 71) return 'text-success'
  if (promedio >= 51) return 'text-warning'
  return 'text-error'
}
</script>

<template>
  <div class="card bg-base-100 shadow">
    <div class="card-body space-y-3">
      <div class="flex items-center gap-2">
        <AppIcon nombre="escuela" class="h-5 w-5 text-amber-500" />
        <h3 class="font-semibold flex-1">
          {{ trimestreNumero !== null ? `Mejores — ${trimestreNombre}` : 'Mejores de la gestión' }}
        </h3>
        <router-link to="/secretaria/boletines" class="link link-primary text-xs">Boletines →</router-link>
      </div>

      <!-- ── Modo trimestral: mejor por curso, expandible al top-3 ── -->
      <template v-if="trimestreNumero !== null">
        <p v-if="!porCurso.length" class="text-xs text-base-content/40 text-center py-4">
          Aún no hay promedios del {{ trimestreNombre }}
        </p>
        <div v-else class="space-y-2 max-h-96 overflow-y-auto">
          <details v-for="c in porCurso" :key="c.curso"
            class="rounded-box border border-base-300">
            <summary class="cursor-pointer px-3 py-2 flex items-center gap-2 text-sm">
              <span class="font-medium flex-1 min-w-0">
                <span class="block truncate">{{ c.mejor.nombre }}</span>
                <span class="block text-[11px] text-base-content/50">{{ c.curso }} · {{ c.mejor.materias }} mat.</span>
              </span>
              <span class="font-mono font-bold" :class="clasePromedio(c.mejor.promedio)">
                {{ c.mejor.promedio.toFixed(1) }}
              </span>
            </summary>
            <ul class="px-3 pb-2 space-y-1.5">
              <li v-for="(t, i) in c.top3" :key="`${t.nombre}-${i}`"
                class="flex items-center gap-2.5 rounded-lg px-2 py-1"
                :class="i === 0 ? 'bg-amber-400/10 border border-amber-400/30' : ''">
                <span class="badge badge-sm font-bold shrink-0" :class="estiloPuesto(i + 1)">{{ i + 1 }}°</span>
                <span class="flex-1 min-w-0 text-sm truncate">{{ t.nombre }}</span>
                <span class="font-mono font-bold text-sm" :class="clasePromedio(t.promedio)">
                  {{ t.promedio.toFixed(1) }}
                </span>
              </li>
            </ul>
          </details>
        </div>
      </template>

      <!-- ── Modo anual (gestión completa): top-5 global ── -->
      <template v-else>
        <p v-if="!topAnual.length" class="text-xs text-base-content/40 text-center py-4">
          Aún no hay promedios finales registrados
        </p>
        <ul v-else class="space-y-1.5">
          <li v-for="(t, i) in topAnual" :key="`${t.nombre}-${i}`"
            class="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
            :class="i === 0 ? 'bg-amber-400/10 border border-amber-400/30' : ''">
            <span class="badge font-bold shrink-0" :class="estiloPuesto(i + 1)">{{ i + 1 }}°</span>
            <span class="flex-1 min-w-0">
              <span class="block text-sm font-medium truncate">{{ t.nombre }}</span>
              <span class="block text-[11px] text-base-content/50">{{ t.curso }}</span>
            </span>
            <span class="font-mono font-bold" :class="clasePromedio(t.promedio)">
              {{ t.promedio.toFixed(1) }}
            </span>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>
