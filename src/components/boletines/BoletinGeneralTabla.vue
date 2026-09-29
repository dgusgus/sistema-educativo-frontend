<script setup lang="ts">
import type { BoletinGeneralResponse } from '@/api/boletin.api'
import StatusBadge from '../StatusBadge.vue'

defineProps<{ boletin: BoletinGeneralResponse }>()

function claseNota(nota: number | null): string {
  if (nota === null) return 'text-base-content/30'
  if (nota >= 71) return 'text-success font-semibold'
  if (nota >= 51) return 'text-warning font-semibold'
  return 'text-error font-semibold'
}
</script>

<template>
  <div class="overflow-x-auto hidden md:block">
    <table class="table table-xs table-pin-rows">
      <thead>
        <tr>
          <th rowspan="2" class="align-bottom">Estudiante</th>
          <th v-for="m in boletin.materias" :key="m.docenteMateriaCursoId"
            :colspan="boletin.trimestres.length + 1" class="text-center border-l border-base-300">
            {{ m.nombre }}
          </th>
          <th :colspan="boletin.trimestres.length + 1" class="text-center border-l border-base-300">
            Promedio General
          </th>
        </tr>
        <tr>
          <template v-for="m in boletin.materias" :key="`h-${m.docenteMateriaCursoId}`">
            <th v-for="t in boletin.trimestres" :key="`h-${m.docenteMateriaCursoId}-${t.id}`"
              class="text-center font-normal text-xs border-l border-base-300">
              T{{ t.numero }}
            </th>
            <th class="text-center text-xs">Anual</th>
          </template>
          <th v-for="t in boletin.trimestres" :key="`hg-${t.id}`"
            class="text-center font-normal text-xs border-l border-base-300">
            T{{ t.numero }}
          </th>
          <th class="text-center text-xs">Anual</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="est in boletin.estudiantes" :key="est.inscripcionId" class="hover">
          <td class="font-medium whitespace-nowrap">{{ est.nombreCompleto }}</td>
          <template v-for="m in est.materias" :key="`c-${est.inscripcionId}-${m.docenteMateriaCursoId}`">
            <td v-for="t in boletin.trimestres" :key="`c-${est.inscripcionId}-${m.docenteMateriaCursoId}-${t.id}`"
              class="text-center border-l border-base-300" :class="claseNota(m.notasPorTrimestre[t.id])">
              {{ m.notasPorTrimestre[t.id] ?? '—' }}
            </td>
            <td class="text-center" :class="claseNota(m.promedioAnual)">
              {{ m.promedioAnual ?? '—' }}
            </td>
          </template>
          <td v-for="t in boletin.trimestres" :key="`cg-${est.inscripcionId}-${t.id}`"
            class="text-center border-l border-base-300" :class="claseNota(est.promedioGeneralPorTrimestre[t.id])">
            {{ est.promedioGeneralPorTrimestre[t.id] ?? '—' }}
          </td>
          <td class="text-center" :class="claseNota(est.promedioGeneralAnual)">
            <div class="flex items-center justify-center gap-1">
              <span>{{ est.promedioGeneralAnual ?? '—' }}</span>
              <StatusBadge v-if="est.promedioGeneralAnual !== null"
                :estado="est.promedioGeneralAnual >= 51 ? 'PROMOVIDO' : 'REPROBADO'" tamano="xs" />
            </div>
          </td>
        </tr>
        <tr v-if="!boletin.estudiantes.length">
          <td :colspan="1 + boletin.materias.length * (boletin.trimestres.length + 1) + boletin.trimestres.length + 1"
            class="text-center text-base-content/40 py-8">
            Este curso no tiene estudiantes activos
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
