<script setup lang="ts">
import { computed } from 'vue'
import type { ReporteAcademicoDetalle } from '@/api/reporte.api'
import { nombreCurso } from '@/api/estructura.api'
import AppIcon from '@/components/AppIcon.vue'

// Rendimiento por curso derivado del detalle del reporte académico:
// promedio general del curso + tasa de aprobación. Recibe los datos ya
// cargados por el Dashboard (1 sola request compartida con MejoresGestion
// y EstadoInscripciones) — no pide nada por su cuenta.
const props = defineProps<{ detalle: ReporteAcademicoDetalle[] }>()

interface FilaCurso {
  cursoId: number
  nombre: string
  n: number
  promedio: number | null
  tasa: number | null
}

function promedioEstudiante(d: ReporteAcademicoDetalle): number | null {
  if (!d.promediosFinales.length) return null
  return d.promediosFinales.reduce((s, p) => s + p.promedioFinal, 0) / d.promediosFinales.length
}

function aprobado(d: ReporteAcademicoDetalle): boolean {
  return d.promediosFinales.length > 0 && d.promediosFinales.every(p => p.resultado === 'PROMOVIDO')
}

const filas = computed<FilaCurso[]>(() => {
  const porCurso = new Map<number, { nombre: string; detalle: ReporteAcademicoDetalle[] }>()
  for (const d of props.detalle) {
    const g = porCurso.get(d.cursoId) ?? { nombre: nombreCurso(d.curso), detalle: [] }
    g.detalle.push(d)
    porCurso.set(d.cursoId, g)
  }
  return Array.from(porCurso.values())
    .map(g => {
      const proms = g.detalle.map(promedioEstudiante).filter((v): v is number => v !== null)
      const conNota = g.detalle.filter(d => promedioEstudiante(d) !== null)
      return {
        cursoId: g.detalle[0].cursoId,
        nombre: g.nombre,
        n: g.detalle.length,
        promedio: proms.length ? proms.reduce((s, v) => s + v, 0) / proms.length : null,
        tasa: conNota.length ? (conNota.filter(aprobado).length / conNota.length) * 100 : null,
      }
    })
    .sort((a, b) => (b.promedio ?? -1) - (a.promedio ?? -1))
})

function claseNota(nota: number | null): string {
  if (nota === null) return 'text-base-content/30'
  if (nota >= 71) return 'text-success'
  if (nota >= 51) return 'text-warning'
  return 'text-error'
}
</script>

<template>
  <div class="card bg-base-100 shadow">
    <div class="card-body space-y-3">
      <div class="flex items-center gap-2">
        <AppIcon nombre="reportes" class="h-5 w-5 text-primary" />
        <h3 class="font-semibold flex-1">Rendimiento por curso</h3>
        <router-link to="/director/reportes" class="link link-primary text-xs">Reporte completo →</router-link>
      </div>

      <p v-if="!filas.length" class="text-xs text-base-content/40 text-center py-4">
        Sin inscripciones en la gestión todavía
      </p>
      <ul v-else class="space-y-2.5">
        <li v-for="f in filas" :key="f.cursoId">
          <div class="flex items-baseline justify-between gap-2 text-sm">
            <span class="font-medium truncate">{{ f.nombre }}</span>
            <span class="text-xs text-base-content/50 whitespace-nowrap">
              <strong class="font-mono" :class="claseNota(f.promedio)">{{ f.promedio !== null ? f.promedio.toFixed(1) : '—' }}</strong>
              ·
              {{ f.tasa !== null ? `${f.tasa.toFixed(0)}% aprob.` : 'sin notas' }}
              · {{ f.n }} est.
            </span>
          </div>
          <progress class="progress h-2 w-full" :class="(f.promedio ?? 0) >= 51 ? 'progress-success' : 'progress-error'"
            :value="f.promedio ?? 0" max="100" />
        </li>
      </ul>
    </div>
  </div>
</template>
