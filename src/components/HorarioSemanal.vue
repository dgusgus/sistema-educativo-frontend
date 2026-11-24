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
  <!-- Móvil: lista agrupada por día (la tabla de 5 columnas no cabe en 390 px y se corta). -->
  <div class="sm:hidden">
    <div v-if="cargando" class="skeleton h-16 w-full"></div>
    <p v-else-if="horarios.length === 0" class="py-6 text-center text-base-content/40">Sin horario cargado todavía.</p>
    <template v-else>
      <section v-for="dia in DIAS_SEMANA.filter(d => horarioPorDia.get(d)?.length)" :key="dia" class="mb-3 last:mb-0">
        <h4 class="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">{{ DIA_TEXTO[dia] }}</h4>
        <ul class="divide-y divide-base-200 rounded-box border border-base-300">
          <li v-for="h in horarioPorDia.get(dia)" :key="h.id" class="flex items-start gap-3 px-3 py-2">
            <span class="w-[5.2rem] shrink-0 pt-0.5 font-mono text-xs text-base-content/60">{{ h.horaInicio }}–{{ h.horaFin }}</span>
            <span class="min-w-0 flex-1">
              <span class="block font-medium leading-snug">{{ h.materia.nombre }}</span>
              <span class="block text-xs text-base-content/60">
                <template v-if="columnaExtra === 'docente'">{{ h.docente.nombre }} {{ h.docente.apellido }}</template>
                <template v-else>{{ h.curso.grado }}° {{ NIVEL_TEXTO[h.curso.nivel] }} "{{ h.curso.paralelo }}"</template>
                <template v-if="h.aula"> · {{ h.aula }}</template>
              </span>
            </span>
          </li>
        </ul>
      </section>
    </template>
  </div>

  <div class="hidden overflow-x-auto sm:block">
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