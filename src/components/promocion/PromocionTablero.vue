<script setup lang="ts">
// Tablero de Promoción: un renglón por curso de la gestión de origen con su avance.
import { computed } from 'vue'
import type { TableroPromocion, CursoPromocion } from '@/api/gestion.api'

const props = defineProps<{ tablero: TableroPromocion | null; cargando: boolean; seleccionadoId: number | null }>()
const emit = defineEmits<{ (e: 'abrir', curso: CursoPromocion): void }>()

const ESTADO_TEXTO = {
  RESULTADOS_PENDIENTES: 'Faltan resultados',
  LISTO_MATRICULAR:      'Listo para matricular',
  COMPLETO:              'Completo',
} as const
const ESTADO_CLASE = {
  RESULTADOS_PENDIENTES: 'badge-warning',
  LISTO_MATRICULAR:      'badge-info',
  COMPLETO:              'badge-success',
} as const

const totales = computed(() => {
  const cursos = props.tablero?.cursos ?? []
  const suma = (f: (c: CursoPromocion) => number) => cursos.reduce((a, c) => a + f(c), 0)
  return {
    estudiantes: suma(c => c.estudiantes), sinResultado: suma(c => c.sinResultado),
    promovidos: suma(c => c.promovidos), repiten: suma(c => c.repiten), egresan: suma(c => c.egresan),
    matriculados: suma(c => c.matriculados), porMatricular: suma(c => c.porMatricular),
  }
})
</script>

<template>
<div class="card bg-base-100 shadow">
  <div class="card-body py-3">
    <div class="flex items-center gap-2 mb-2">
      <h3 class="font-semibold">Cursos</h3>
      <span v-if="cargando" class="loading loading-spinner loading-sm"></span>
    </div>
    <div v-if="tablero && !tablero.cursos.length" class="text-sm text-base-content/50 py-4">
      La gestión de origen no tiene estudiantes inscritos.
    </div>
    <div v-else-if="tablero" class="overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Curso</th>
            <th class="text-right">Estudiantes</th>
            <th class="text-right">Sin resultado</th>
            <th class="text-right">Promovidos</th>
            <th class="text-right">Repiten</th>
            <th class="text-right">Egresan</th>
            <th class="text-right">Matriculados</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in tablero.cursos" :key="c.cursoId" class="hover" :class="seleccionadoId === c.cursoId ? 'bg-base-200' : ''">
            <td class="font-medium">{{ c.curso }}</td>
            <td class="text-right">{{ c.estudiantes }}</td>
            <td class="text-right" :class="c.sinResultado ? 'text-warning font-semibold' : 'text-base-content/40'">{{ c.sinResultado }}</td>
            <td class="text-right">{{ c.promovidos }}</td>
            <td class="text-right">{{ c.repiten }}</td>
            <td class="text-right">{{ c.egresan }}</td>
            <td class="text-right">{{ c.matriculados }}<span class="text-base-content/40"> / {{ c.matriculados + c.porMatricular }}</span></td>
            <td><span class="badge badge-sm whitespace-nowrap h-auto py-0.5" :class="ESTADO_CLASE[c.estado]">{{ ESTADO_TEXTO[c.estado] }}</span></td>
            <td class="text-right">
              <button class="btn btn-sm btn-primary min-h-11" @click="emit('abrir', c)">
                {{ seleccionadoId === c.cursoId ? 'Abierto' : 'Abrir' }}
              </button>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="font-semibold">
            <td>Total</td>
            <td class="text-right">{{ totales.estudiantes }}</td>
            <td class="text-right">{{ totales.sinResultado }}</td>
            <td class="text-right">{{ totales.promovidos }}</td>
            <td class="text-right">{{ totales.repiten }}</td>
            <td class="text-right">{{ totales.egresan }}</td>
            <td class="text-right">{{ totales.matriculados }}<span class="text-base-content/40"> / {{ totales.matriculados + totales.porMatricular }}</span></td>
            <td colspan="2"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</div>
</template>
