<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ReporteCursoItem } from '@/api/asistencia.api'
import StatusBadge from '../StatusBadge.vue'

// Lista presentacional: recibe el reporte ya cargado por la vista
// (AsistenciaReporteView → getReporteCurso). No hace fetch ni renderiza
// ningún modal: cada card se expande en línea con el detalle por materia.
const props = defineProps<{ reporte: ReporteCursoItem[] }>()

const query = ref('')
const expandido = ref<number | null>(null)

const estudiantesFiltrados = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.reporte
  return props.reporte.filter(e =>
    `${e.estudiante.apellido} ${e.estudiante.nombre}`.toLowerCase().includes(q)
  )
})

function clasePorcentaje(p: number): string {
  if (p >= 90) return 'text-success font-semibold'
  if (p >= 80) return 'text-warning font-semibold'
  return 'text-error font-semibold'
}

function inicial(apellido: string): string {
  return (apellido.trim()[0] ?? '•').toUpperCase()
}

function toggle(inscripcionId: number) {
  expandido.value = expandido.value === inscripcionId ? null : inscripcionId
}
</script>

<template>
  <div class="space-y-3">
    <label class="input input-bordered flex items-center gap-2 w-full sm:max-w-xs">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="h-4 w-4 opacity-50">
        <path fill-rule="evenodd" d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" clip-rule="evenodd" />
      </svg>
      <input v-model="query" type="search" placeholder="Buscar estudiante..." class="grow" />
    </label>

    <p class="text-xs text-base-content/50">{{ estudiantesFiltrados.length }} estudiante(s) — tocá un card para ver el detalle por materia</p>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
      <div v-for="est in estudiantesFiltrados" :key="est.inscripcionId"
        class="rounded-box border shadow-sm overflow-hidden h-fit"
        :class="est.alertaCritica ? 'border-error/40 bg-error/5' : 'border-base-300 bg-base-100'">
        <button class="w-full flex items-center gap-3 p-3 text-left" @click="toggle(est.inscripcionId)">
          <span class="avatar placeholder">
            <span class="rounded-full w-9 h-9 flex items-center justify-center font-bold"
              :class="est.alertaCritica ? 'bg-error/15 text-error' : 'bg-primary/10 text-primary'">
              {{ inicial(est.estudiante.apellido) }}
            </span>
          </span>
          <span class="flex-1 min-w-0">
            <span class="block font-medium text-sm truncate">{{ est.estudiante.apellido }}, {{ est.estudiante.nombre }}</span>
            <span class="block font-mono text-xs text-base-content/50">{{ est.estudiante.ci }}</span>
          </span>
          <span class="text-right shrink-0">
            <span class="block font-bold text-lg leading-none" :class="clasePorcentaje(est.promedioGeneral)">
              {{ est.promedioGeneral }}%
            </span>
            <StatusBadge class="mt-1" :estado="est.alertaCritica ? 'REPROBADO' : 'APROBADO'"
              :texto="est.alertaCritica ? 'En riesgo' : 'OK'" tamano="xs" />
          </span>
          <span class="text-base-content/40 text-sm">{{ expandido === est.inscripcionId ? '▲' : '▼' }}</span>
        </button>

        <!-- Detalle por materia, en línea (sin modal) -->
        <div v-if="expandido === est.inscripcionId" class="border-t border-base-300 divide-y divide-base-200">
          <div v-for="d in est.detalleXMateria" :key="`${d.docenteMateriaCursoId}-${d.trimestreId}`" class="px-3 py-2">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium truncate">{{ d.docenteMateriaCurso.materia.nombre }}</span>
              <span class="badge badge-sm font-mono"
                :class="Number(d.porcentaje) >= 80 ? 'badge-success badge-outline' : 'badge-error badge-outline'">
                {{ Number(d.porcentaje).toFixed(0) }}%
              </span>
            </div>
            <p class="text-xs text-base-content/60 mt-0.5">
              T{{ d.trimestre.numero }} · {{ d.trimestre.nombre }} ·
              P: {{ d.totalPresente }} · A: {{ d.totalAusente }} · R: {{ d.totalRetraso }} · J: {{ d.totalJustificado }}
              <span class="text-base-content/40">({{ d.totalClases }} clases)</span>
            </p>
          </div>
          <p v-if="!est.detalleXMateria.length" class="px-3 py-4 text-xs text-base-content/40 text-center">
            Sin registros de asistencia todavía
          </p>
        </div>
      </div>
    </div>

    <p v-if="!estudiantesFiltrados.length" class="text-center text-base-content/40 py-8 text-sm">
      Sin coincidencias para "{{ query }}"
    </p>
  </div>
</template>
