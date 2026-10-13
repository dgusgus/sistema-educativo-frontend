<script setup lang="ts">
// Campos para elegir de qué gestión y qué partes de la estructura copiar.
// Se usa al crear una gestión y en el botón "Copiar estructura" de la tabla.
// El estado vive en el padre (v-model) para poder enviarlo tal cual a la API.
import type { OpcionesCopiaForm } from '@/api/gestion.api'

defineProps<{
  origenes:      { id: number; anio: number }[]
  deshabilitado?: boolean
}>()

const model = defineModel<OpcionesCopiaForm>({ required: true })

const partes: { clave: 'cursos' | 'asignaciones' | 'trimestres' | 'dimensiones' | 'conceptosPago'; texto: string }[] = [
  { clave: 'cursos',        texto: 'Cursos (sin estudiantes)' },
  { clave: 'asignaciones',  texto: 'Asignaciones docente-materia' },
  { clave: 'trimestres',    texto: 'Trimestres (fechas +1 año)' },
  { clave: 'dimensiones',   texto: 'Dimensiones de evaluación' },
  { clave: 'conceptosPago', texto: 'Conceptos de pago' },
]
</script>

<template>
  <div class="space-y-2">
    <fieldset class="fieldset">
      <legend class="fieldset-legend text-xs">Copiar desde la gestión</legend>
      <select v-model="model.origenId" class="select select-bordered w-full" :disabled="deshabilitado || !origenes.length">
        <option value="" disabled>Seleccionar</option>
        <option v-for="o in origenes" :key="o.id" :value="o.id">{{ o.anio }}</option>
      </select>
      <p v-if="!origenes.length" class="text-xs text-base-content/50 mt-1">
        No hay una gestión anterior de la cual copiar.
      </p>
    </fieldset>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
      <label v-for="p in partes" :key="p.clave" class="label cursor-pointer justify-start gap-2 py-1">
        <input v-model="model[p.clave]" type="checkbox" class="checkbox checkbox-sm" :disabled="deshabilitado" />
        <span class="text-sm">{{ p.texto }}</span>
      </label>
    </div>

    <p class="text-xs text-base-content/50">
      No se copian estudiantes, notas, asistencia, pagos ni horarios. Lo que ya exista en la gestión nueva se respeta.
    </p>
  </div>
</template>