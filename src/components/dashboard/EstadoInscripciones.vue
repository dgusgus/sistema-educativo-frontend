<script setup lang="ts">
import { computed } from 'vue'
import type { ReporteAcademicoDetalle } from '@/api/reporte.api'
import type { EstadoInscripcion } from '@/types'
import AppIcon from '@/components/AppIcon.vue'

// Dona de estados de inscripción (ACTIVA/RETIRADA/TRANSFERIDA/CONCLUIDA)
// con CSS puro — sin librerías. Recibe el detalle ya cargado por el Dashboard.
const props = defineProps<{ detalle: ReporteAcademicoDetalle[] }>()

const COLORES: Record<EstadoInscripcion, string> = {
  ACTIVA: '#3F8F5F',
  RETIRADA: '#E2A63D',
  TRANSFERIDA: '#2E6DA4',
  CONCLUIDA: '#9AA0A6',
}

const segmentos = computed(() => {
  const conteo = new Map<EstadoInscripcion, number>()
  for (const d of props.detalle) conteo.set(d.estadoInscripcion, (conteo.get(d.estadoInscripcion) ?? 0) + 1)
  const total = props.detalle.length || 1
  let acc = 0
  return Array.from(conteo.entries()).map(([estado, n]) => {
    const desde = (acc / total) * 360
    acc += n
    const hasta = (acc / total) * 360
    return { estado, n, pct: Math.round((n / total) * 100), color: COLORES[estado] ?? '#6B7280', desde, hasta }
  })
})

const fondoDona = computed(() => {
  if (!segmentos.value.length) return undefined
  const partes = segmentos.value.map(s => `${s.color} ${s.desde}deg ${s.hasta}deg`).join(', ')
  return `conic-gradient(${partes})`
})
</script>

<template>
  <div class="card bg-base-100 shadow">
    <div class="card-body space-y-3">
      <div class="flex items-center gap-2">
        <AppIcon nombre="personas" class="h-5 w-5 text-primary" />
        <h3 class="font-semibold flex-1">Inscripciones</h3>
        <router-link to="/secretaria/estudiantes" class="link link-primary text-xs">Estudiantes →</router-link>
      </div>

      <p v-if="!detalle.length" class="text-xs text-base-content/40 text-center py-4">
        Sin inscripciones en la gestión todavía
      </p>
      <div v-else class="flex items-center gap-4">
        <span class="w-24 h-24 rounded-full shrink-0 mx-auto"
          :style="{ background: fondoDona, mask: 'radial-gradient(circle, transparent 55%, black 56%)', WebkitMask: 'radial-gradient(circle, transparent 55%, black 56%)' }" />
        <ul class="flex-1 space-y-1 text-xs">
          <li v-for="s in segmentos" :key="s.estado" class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: s.color }"></span>
            <span class="flex-1">{{ s.estado }}</span>
            <strong class="font-mono">{{ s.n }} ({{ s.pct }}%)</strong>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
