<script setup lang="ts">
import { ref, computed } from 'vue'
import type { BoletinGeneralResponse, BoletinGeneralEstudiante } from '@/api/boletin.api'
import StatusBadge from '../StatusBadge.vue'

// Matriz materia × estudiante de UN trimestre: filas = estudiantes,
// columnas = materias, celda = nota del trimestre + columna Promedio.
// Recibe el Boletín General ya cargado (trae los 3 trimestres) y el
// trimestre a mostrar. Desktop = tabla, móvil = cards por estudiante.
const props = defineProps<{
  general: BoletinGeneralResponse
  trimestreId: number
}>()

const query = ref('')

const numeroTrim = computed(
  () => props.general.trimestres.find(t => t.id === props.trimestreId)?.numero ?? null
)

const estudiantes = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.general.estudiantes
  return props.general.estudiantes.filter(e => e.nombreCompleto.toLowerCase().includes(q))
})

function notaDe(est: BoletinGeneralEstudiante, dmcId: number): number | null {
  return est.materias.find(m => m.docenteMateriaCursoId === dmcId)?.notasPorTrimestre[props.trimestreId] ?? null
}

function claseNota(nota: number | null): string {
  if (nota === null) return 'text-base-content/30'
  if (nota >= 71) return 'text-success font-semibold'
  if (nota >= 51) return 'text-warning font-semibold'
  return 'text-error font-semibold'
}

function inicial(nombre: string): string {
  return (nombre.trim()[0] ?? '•').toUpperCase()
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center gap-2">
      <label class="input input-bordered flex items-center gap-2 w-full sm:max-w-xs">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="h-4 w-4 opacity-50">
          <path fill-rule="evenodd" d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" clip-rule="evenodd" />
        </svg>
        <input v-model="query" type="search" placeholder="Buscar estudiante..." class="grow" />
      </label>
      <p class="text-xs text-base-content/50">{{ estudiantes.length }} estudiante(s) · T{{ numeroTrim ?? '—' }}</p>
    </div>

    <!-- Desktop: matriz -->
    <div class="overflow-x-auto hidden md:block rounded-box border border-base-300">
      <table class="table table-xs table-pin-rows">
        <thead>
          <tr>
            <th class="align-bottom">Estudiante</th>
            <th v-for="m in general.materias" :key="m.docenteMateriaCursoId" class="text-center border-l border-base-300">
              {{ m.nombre }}
            </th>
            <th class="text-center border-l border-base-300">Promedio</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="est in estudiantes" :key="est.inscripcionId" class="hover">
            <td class="font-medium whitespace-nowrap">{{ est.nombreCompleto }}</td>
            <td v-for="m in general.materias" :key="`${est.inscripcionId}-${m.docenteMateriaCursoId}`"
              class="text-center border-l border-base-300" :class="claseNota(notaDe(est, m.docenteMateriaCursoId))">
              {{ notaDe(est, m.docenteMateriaCursoId) ?? '—' }}
            </td>
            <td class="text-center border-l border-base-300" :class="claseNota(est.promedioGeneralPorTrimestre[trimestreId])">
              <span class="font-bold">{{ est.promedioGeneralPorTrimestre[trimestreId] ?? '—' }}</span>
            </td>
          </tr>
          <tr v-if="!estudiantes.length">
            <td :colspan="2 + general.materias.length" class="text-center text-base-content/40 py-8">
              Sin coincidencias
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Móvil: cards por estudiante -->
    <div class="md:hidden grid grid-cols-1 gap-3">
      <div v-for="est in estudiantes" :key="est.inscripcionId"
        class="rounded-box border border-base-300 bg-base-100 shadow-sm p-3">
        <div class="flex items-center gap-3">
          <span class="avatar placeholder">
            <span class="bg-primary/10 text-primary rounded-full w-9 h-9 flex items-center justify-center font-bold">
              {{ inicial(est.nombreCompleto) }}
            </span>
          </span>
          <span class="flex-1 min-w-0 font-medium text-sm truncate">{{ est.nombreCompleto }}</span>
          <span class="text-right shrink-0">
            <span class="block font-bold text-lg leading-none" :class="claseNota(est.promedioGeneralPorTrimestre[trimestreId])">
              {{ est.promedioGeneralPorTrimestre[trimestreId] ?? '—' }}
            </span>
            <span class="text-[11px] text-base-content/50">promedio T{{ numeroTrim ?? '—' }}</span>
          </span>
        </div>
        <div class="flex flex-wrap gap-1.5 mt-2">
          <span v-for="m in general.materias" :key="`m-${est.inscripcionId}-${m.docenteMateriaCursoId}`"
            class="badge badge-sm badge-ghost font-normal" :title="m.nombre">
            {{ m.codigo ?? m.nombre.substring(0, 3) }}:
            <strong class="ml-1 font-mono" :class="claseNota(notaDe(est, m.docenteMateriaCursoId))">
              {{ notaDe(est, m.docenteMateriaCursoId) ?? '—' }}
            </strong>
          </span>
        </div>
        <div class="mt-2">
          <StatusBadge v-if="est.promedioGeneralPorTrimestre[trimestreId] !== null"
            :estado="est.promedioGeneralPorTrimestre[trimestreId]! >= 51 ? 'APROBADO' : 'REPROBADO'" tamano="xs" />
        </div>
      </div>
      <p v-if="!estudiantes.length" class="text-center text-base-content/40 py-8 text-sm">
        Sin coincidencias para "{{ query }}"
      </p>
    </div>
  </div>
</template>
