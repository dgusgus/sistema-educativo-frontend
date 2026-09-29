<script setup lang="ts">
import { ref, computed } from 'vue'
import type { BoletinGeneralResponse, BoletinGeneralEstudiante } from '@/api/boletin.api'
import StatusBadge from '../StatusBadge.vue'

// Resumen anual: solo notas finales por materia (promedioAnual) + promedio
// general anual + estado. Lo trimestral vive en los tabs Individual y Por
// curso. Desktop = tabla anual, móvil = cards con anuales expandibles.
const props = defineProps<{ general: BoletinGeneralResponse }>()

const query = ref('')
const expandido = ref<number | null>(null)

const estudiantes = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.general.estudiantes
  return props.general.estudiantes.filter(e => e.nombreCompleto.toLowerCase().includes(q))
})

function anualDe(est: BoletinGeneralEstudiante, dmcId: number): number | null {
  return est.materias.find(m => m.docenteMateriaCursoId === dmcId)?.promedioAnual ?? null
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

function toggle(inscripcionId: number) {
  expandido.value = expandido.value === inscripcionId ? null : inscripcionId
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
      <p class="text-xs text-base-content/50">{{ estudiantes.length }} estudiante(s) · notas finales</p>
    </div>

    <!-- Desktop: tabla anual -->
    <div class="overflow-x-auto hidden md:block rounded-box border border-base-300">
      <table class="table table-xs table-pin-rows">
        <thead>
          <tr>
            <th class="align-bottom">Estudiante</th>
            <th v-for="m in general.materias" :key="m.docenteMateriaCursoId" class="text-center border-l border-base-300">
              {{ m.nombre }}
            </th>
            <th class="text-center border-l border-base-300">Promedio</th>
            <th class="text-center">Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="est in estudiantes" :key="est.inscripcionId" class="hover">
            <td class="font-medium whitespace-nowrap">{{ est.nombreCompleto }}</td>
            <td v-for="m in general.materias" :key="`${est.inscripcionId}-${m.docenteMateriaCursoId}`"
              class="text-center border-l border-base-300" :class="claseNota(anualDe(est, m.docenteMateriaCursoId))">
              {{ anualDe(est, m.docenteMateriaCursoId) ?? '—' }}
            </td>
            <td class="text-center border-l border-base-300 font-bold" :class="claseNota(est.promedioGeneralAnual)">
              {{ est.promedioGeneralAnual ?? '—' }}
            </td>
            <td class="text-center">
              <StatusBadge v-if="est.promedioGeneralAnual !== null"
                :estado="est.promedioGeneralAnual >= 51 ? 'PROMOVIDO' : 'REPROBADO'" tamano="xs" />
              <span v-else class="text-base-content/30 text-xs">—</span>
            </td>
          </tr>
          <tr v-if="!estudiantes.length">
            <td :colspan="3 + general.materias.length" class="text-center text-base-content/40 py-8">
              Sin coincidencias
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Móvil: cards anuales expandibles -->
    <div class="md:hidden grid grid-cols-1 gap-3">
      <div v-for="est in estudiantes" :key="est.inscripcionId"
        class="rounded-box border border-base-300 bg-base-100 shadow-sm overflow-hidden">
        <button class="w-full flex items-center gap-3 p-3 text-left" @click="toggle(est.inscripcionId)">
          <span class="avatar placeholder">
            <span class="bg-primary/10 text-primary rounded-full w-9 h-9 flex items-center justify-center font-bold">
              {{ inicial(est.nombreCompleto) }}
            </span>
          </span>
          <span class="flex-1 min-w-0 font-medium text-sm truncate">{{ est.nombreCompleto }}</span>
          <span class="text-right shrink-0">
            <span class="block font-bold text-lg leading-none" :class="claseNota(est.promedioGeneralAnual)">
              {{ est.promedioGeneralAnual ?? '—' }}
            </span>
            <StatusBadge v-if="est.promedioGeneralAnual !== null" class="mt-1"
              :estado="est.promedioGeneralAnual >= 51 ? 'PROMOVIDO' : 'REPROBADO'" tamano="xs" />
          </span>
          <span class="text-base-content/40 text-sm">{{ expandido === est.inscripcionId ? '▲' : '▼' }}</span>
        </button>
        <div v-if="expandido === est.inscripcionId" class="border-t border-base-300 px-3 py-2">
          <div class="flex flex-wrap gap-1.5">
            <span v-for="m in general.materias" :key="`a-${est.inscripcionId}-${m.docenteMateriaCursoId}`"
              class="badge badge-sm badge-ghost font-normal" :title="m.nombre">
              {{ m.codigo ?? m.nombre.substring(0, 3) }}:
              <strong class="ml-1 font-mono" :class="claseNota(anualDe(est, m.docenteMateriaCursoId))">
                {{ anualDe(est, m.docenteMateriaCursoId) ?? '—' }}
              </strong>
            </span>
          </div>
        </div>
      </div>
      <p v-if="!estudiantes.length" class="text-center text-base-content/40 py-8 text-sm">
        Sin coincidencias para "{{ query }}"
      </p>
    </div>
  </div>
</template>
