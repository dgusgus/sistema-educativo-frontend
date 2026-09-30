<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { reporteApi, type ReporteAcademicoDetalle } from '@/api/reporte.api'
import { nombreCurso } from '@/api/estructura.api'
import AppIcon from '@/components/AppIcon.vue'

// Rendimiento por curso derivado del reporte académico (1 sola request):
// promedio general del curso + tasa de aprobación, con link al reporte.
// Autocontenido: pide sus datos al montar para no engordar el Dashboard.
const props = defineProps<{ gestionId: number }>()

interface FilaCurso {
  cursoId: number
  nombre: string
  n: number
  promedio: number | null
  tasa: number | null
}

const filas = ref<FilaCurso[] | null>(null)
const error = ref<string | null>(null)

function promedioEstudiante(d: ReporteAcademicoDetalle): number | null {
  if (!d.promediosFinales.length) return null
  return d.promediosFinales.reduce((s, p) => s + p.promedioFinal, 0) / d.promediosFinales.length
}

function aprobado(d: ReporteAcademicoDetalle): boolean {
  return d.promediosFinales.length > 0 && d.promediosFinales.every(p => p.resultado === 'PROMOVIDO')
}

onMounted(async () => {
  try {
    const r = await reporteApi.getReporteAcademico({ gestionId: props.gestionId })
    const porCurso = new Map<number, { nombre: string; detalle: ReporteAcademicoDetalle[] }>()
    for (const d of r.detalle) {
      const g = porCurso.get(d.cursoId) ?? { nombre: nombreCurso(d.curso), detalle: [] }
      g.detalle.push(d)
      porCurso.set(d.cursoId, g)
    }
    filas.value = Array.from(porCurso.values())
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
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar el rendimiento por curso'
  }
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

      <div v-if="error" role="alert" class="alert alert-error py-2 text-sm"><span>{{ error }}</span></div>
      <div v-else-if="!filas" class="space-y-2">
        <div v-for="i in 3" :key="i" class="skeleton h-10 w-full"></div>
      </div>
      <p v-else-if="!filas.length" class="text-xs text-base-content/40 text-center py-4">
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
