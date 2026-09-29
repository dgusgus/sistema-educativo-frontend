<script setup lang="ts">
import { computed } from 'vue'
import type { ReporteCursoItem } from '@/api/asistencia.api'

const props = defineProps<{ reporte: ReporteCursoItem[] }>()

// Umbral de alerta ya viene del backend (< 80% = alertaCritica), acá solo
// coloreamos: mismo umbral para consistencia visual con el badge del backend.
function claseParaPorcentaje(p: number | null): string {
  if (p === null) return 'text-base-content/30'
  if (p >= 90) return 'text-success font-semibold'
  if (p >= 80) return 'text-warning font-semibold'
  return 'text-error font-semibold'
}

// Materias y trimestres únicos, derivados del propio reporte (no hay un
// endpoint separado que los liste — el curso ya trae todo lo que necesitamos).
const materias = computed(() => {
  const map = new Map<number, { id: number; nombre: string }>()
  for (const est of props.reporte) {
    for (const d of est.detalleXMateria) {
      map.set(d.docenteMateriaCursoId, { id: d.docenteMateriaCursoId, nombre: d.docenteMateriaCurso.materia.nombre })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
})

const trimestres = computed(() => {
  const map = new Map<number, { id: number; numero: number; nombre: string }>()
  for (const est of props.reporte) {
    for (const d of est.detalleXMateria) {
      map.set(d.trimestre.id, { id: d.trimestre.id, numero: d.trimestre.numero, nombre: d.trimestre.nombre })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.numero - b.numero)
})

function porcentaje(est: ReporteCursoItem, materiaId: number, trimestreId: number): number | null {
  return est.detalleXMateria.find(
    d => d.docenteMateriaCursoId === materiaId && d.trimestre.id === trimestreId
  )?.porcentaje ?? null
}
</script>

<template>
  <div class="overflow-x-auto hidden md:block">
    <table class="table table-xs table-pin-rows">
      <thead>
        <tr>
          <th rowspan="2" class="align-bottom">Estudiante</th>
          <th v-for="m in materias" :key="m.id"
            :colspan="trimestres.length" class="text-center border-l border-base-300">
            {{ m.nombre }}
          </th>
          <th rowspan="2" class="align-bottom text-center border-l border-base-300">% General</th>
        </tr>
        <tr>
          <template v-for="m in materias" :key="`h-${m.id}`">
            <th v-for="t in trimestres" :key="`h-${m.id}-${t.id}`"
              class="text-center font-normal text-xs border-l border-base-300">
              T{{ t.numero }}
            </th>
          </template>
        </tr>
      </thead>
      <tbody>
        <tr v-for="est in reporte" :key="est.inscripcionId" class="hover">
          <td class="font-medium whitespace-nowrap">
            {{ est.estudiante.apellido }}, {{ est.estudiante.nombre }}
          </td>
          <template v-for="m in materias" :key="`c-${est.inscripcionId}-${m.id}`">
            <td v-for="t in trimestres" :key="`c-${est.inscripcionId}-${m.id}-${t.id}`"
              class="text-center border-l border-base-300" :class="claseParaPorcentaje(porcentaje(est, m.id, t.id))">
              {{ porcentaje(est, m.id, t.id) !== null ? `${porcentaje(est, m.id, t.id)}%` : '—' }}
            </td>
          </template>
          <td class="text-center border-l border-base-300" :class="claseParaPorcentaje(est.promedioGeneral)">
            <div class="flex items-center justify-center gap-1">
              <span>{{ est.promedioGeneral }}%</span>
              <span v-if="est.alertaCritica" class="badge badge-error badge-outline badge-xs">Riesgo</span>
            </div>
          </td>
        </tr>
        <tr v-if="!reporte.length">
          <td :colspan="2 + materias.length * trimestres.length" class="text-center text-base-content/40 py-8">
            Este curso no tiene registros de asistencia todavía
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>