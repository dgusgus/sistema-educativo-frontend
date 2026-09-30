<script setup lang="ts">
import { computed } from 'vue'
import type { ReporteAcademicoDetalle } from '@/api/reporte.api'
import AppIcon from '@/components/AppIcon.vue'

// Top 5 estudiantes de la gestión por promedio anual (media de sus
// promedios finales). Recibe el detalle ya cargado por el Dashboard —
// no pide nada por su cuenta.
const props = defineProps<{ detalle: ReporteAcademicoDetalle[] }>()

interface TopItem {
  nombre: string
  curso: string
  promedio: number
}

const top = computed<TopItem[]>(() => {
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

function estiloPuesto(puesto: number): string {
  if (puesto === 1) return 'bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950'
  if (puesto === 2) return 'bg-gradient-to-b from-slate-200 to-slate-400 text-slate-800'
  if (puesto === 3) return 'bg-gradient-to-b from-orange-300 to-orange-500 text-orange-950'
  return 'bg-base-300 text-base-content'
}
</script>

<template>
  <div class="card bg-base-100 shadow">
    <div class="card-body space-y-3">
      <div class="flex items-center gap-2">
        <AppIcon nombre="escuela" class="h-5 w-5 text-amber-500" />
        <h3 class="font-semibold flex-1">Mejores de la gestión</h3>
        <router-link to="/secretaria/boletines" class="link link-primary text-xs">Boletines →</router-link>
      </div>

      <p v-if="!top.length" class="text-xs text-base-content/40 text-center py-4">
        Aún no hay promedios finales registrados
      </p>
      <ul v-else class="space-y-1.5">
        <li v-for="(t, i) in top" :key="`${t.nombre}-${i}`"
          class="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
          :class="i === 0 ? 'bg-amber-400/10 border border-amber-400/30' : ''">
          <span class="badge font-bold shrink-0" :class="estiloPuesto(i + 1)">{{ i + 1 }}°</span>
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-medium truncate">{{ t.nombre }}</span>
            <span class="block text-[11px] text-base-content/50">{{ t.curso }}</span>
          </span>
          <span class="font-mono font-bold" :class="t.promedio >= 71 ? 'text-success' : t.promedio >= 51 ? 'text-warning' : 'text-error'">
            {{ t.promedio.toFixed(1) }}
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
