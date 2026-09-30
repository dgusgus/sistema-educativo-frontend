<script setup lang="ts">
import { computed } from 'vue'
import type { PendientesCierre } from '@/api/estructura.api'

// Widget de pendientes de cierre: qué materia-curso le falta qué
// estudiantes para poder cerrar el trimestre. Solo lectura — el cierre
// se hace desde Gestiones/Estructura como hasta ahora.
const props = defineProps<{ datos: PendientesCierre }>()

const progreso = computed(() => {
  const r = props.datos.resumen
  if (!r.totalEsperados) return 100
  return Math.round((r.totalRegistrados / r.totalEsperados) * 100)
})

const incompletas = computed(() => props.datos.pendientes.filter(p => p.faltantes.length > 0))
</script>

<template>
  <div class="card bg-base-100 shadow">
    <div class="card-body space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="font-semibold flex-1">Pendientes de cierre — {{ datos.trimestre.nombre }}</h3>
        <span class="badge" :class="datos.resumen.totalFaltantes === 0 ? 'badge-success' : 'badge-warning'">
          {{ datos.resumen.materiasCompletas }}/{{ datos.resumen.totalMaterias }} materias listas
        </span>
      </div>

      <!-- Progreso global -->
      <div>
        <div class="flex justify-between text-xs text-base-content/60 mb-1">
          <span>{{ datos.resumen.totalRegistrados }}/{{ datos.resumen.totalEsperados }} promedios</span>
          <span class="font-mono font-bold">{{ progreso }}%</span>
        </div>
        <progress class="progress w-full" :class="progreso === 100 ? 'progress-success' : 'progress-warning'" :value="progreso" max="100" />
      </div>

      <div v-if="datos.resumen.totalFaltantes === 0" role="alert" class="alert alert-success py-2 text-sm">
        <span>Todo registrado — el trimestre se puede cerrar.</span>
      </div>

      <div v-else class="space-y-2 max-h-96 overflow-y-auto">
        <details v-for="p in incompletas" :key="p.docenteMateriaCursoId"
          class="rounded-box border border-base-300">
          <summary class="cursor-pointer px-3 py-2 flex items-center gap-2 text-sm">
            <span class="font-medium flex-1 truncate">{{ p.materia.nombre }} · {{ p.curso.grado }}° "{{ p.curso.paralelo }}"</span>
            <span class="badge badge-sm badge-error badge-outline whitespace-nowrap">faltan {{ p.faltantes.length }}</span>
          </summary>
          <div class="px-3 pb-2">
            <p class="text-xs text-base-content/50 mb-1">Docente: {{ p.docente }} · {{ p.registrados }}/{{ p.totalEsperados }}</p>
            <ul class="text-xs space-y-0.5">
              <li v-for="f in p.faltantes" :key="f.inscripcionId" class="truncate">
                • {{ f.nombreCompleto }}
              </li>
            </ul>
          </div>
        </details>
      </div>
    </div>
  </div>
</template>
