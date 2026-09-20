<script setup lang="ts">
import { computed } from 'vue'
import { DIAS_SEMANA, DIA_TEXTO, type HorarioDetalle } from '@/api/horario.api'

// Tabla de solo lectura del horario semanal — reutilizada en MiPerfilView
// (Estudiante), SeguimientoView (Tutor) y HorarioView (Docente). La
// columna extra cambia según quién mira: al Estudiante/Tutor les importa
// QUIÉN dicta (docente); al Docente le importa EN QUÉ CURSO está cada
// bloque (curso) — mostrar ambas sería redundante para cada uno.
const props = withDefaults(defineProps<{
  horarios: HorarioDetalle[]
  cargando?: boolean
  columnaExtra?: 'docente' | 'curso'
}>(), {
  cargando: false,
  columnaExtra: 'docente',
})

const NIVEL_TEXTO: Record<string, string> = { PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }

const horarioPorDia = computed(() => {
  const mapa = new Map<string, HorarioDetalle[]>()
  for (const dia of DIAS_SEMANA) mapa.set(dia, [])
  for (const h of props.horarios) mapa.get(h.diaSemana)?.push(h)
  return mapa
})
</script>

<template>
  <div class="overflow-x-auto">
    <table class="table table-sm">
      <thead>
        <tr>
          <th class="w-28">Día</th>
          <th>Hora</th>
          <th>Materia</th>
          <th v-if="columnaExtra === 'docente'">Docente</th>
          <th v-if="columnaExtra === 'curso'">Curso</th>
          <th>Aula</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="cargando">
          <td colspan="5"><div class="skeleton h-4 w-full"></div></td>
        </tr>
        <tr v-else-if="horarios.length === 0">
          <td colspan="5" class="text-center text-base-content/40 py-6">
            Sin horario cargado todavía.
          </td>
        </tr>
        <template v-else v-for="dia in DIAS_SEMANA" :key="dia">
          <tr v-for="(h, i) in horarioPorDia.get(dia)" :key="h.id" class="hover">
            <td class="font-medium">{{ i === 0 ? DIA_TEXTO[dia] : '' }}</td>
            <td class="font-mono text-sm">{{ h.horaInicio }}–{{ h.horaFin }}</td>
            <td>{{ h.materia.nombre }}</td>
            <td v-if="columnaExtra === 'docente'">{{ h.docente.nombre }} {{ h.docente.apellido }}</td>
            <td v-if="columnaExtra === 'curso'">
              {{ h.curso.grado }}° {{ NIVEL_TEXTO[h.curso.nivel] }} "{{ h.curso.paralelo }}"
            </td>
            <td>{{ h.aula ?? '—' }}</td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>