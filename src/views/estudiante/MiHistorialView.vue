<script setup lang="ts">
import HistorialAcademico from '@/components/historial/HistorialAcademico.vue'
</script>

<template>
  <div class="space-y-4">
    <div>
      <h2 class="text-2xl font-bold">Mi historial académico</h2>
      <p class="text-sm text-base-content/60">Tus notas de todas las gestiones, por trimestre.</p>
    </div>
    <HistorialAcademico modo="mio" />
  </div>
</template>