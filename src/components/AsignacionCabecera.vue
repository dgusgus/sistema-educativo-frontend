<script setup lang="ts">
// Cabecera de las pantallas del docente (Asistencia, Calificaciones): qué materia y curso
// está trabajando y, a la derecha, sus controles (fecha o trimestre + "Cargar") en el slot.
//
// ¿Para qué? Antes eran tres etiquetas sueltas dentro de un card-body (que ya es una columna
// centrada), y en escritorio quedaban desalineadas y de anchos distintos. Aquí la materia es el
// título, curso y cantidad de estudiantes son datos secundarios, y los controles van juntos.
defineProps<{ materia: string; curso: string; totalEstudiantes: number }>()
</script>

<template>
  <div class="card bg-base-100 shadow">
    <div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <p class="text-[11px] font-semibold uppercase tracking-wider text-base-content/50">Materia</p>
        <h2 class="truncate text-xl font-bold leading-tight">{{ materia }}</h2>
        <div class="mt-2 flex flex-wrap gap-2">
          <span class="badge badge-primary badge-soft font-medium">{{ curso }}</span>
          <span class="badge badge-ghost">{{ totalEstudiantes }} estudiantes</span>
        </div>
      </div>
      <div class="flex items-end gap-2 sm:shrink-0">
        <slot />
      </div>
    </div>
  </div>
</template>