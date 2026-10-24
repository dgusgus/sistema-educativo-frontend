<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { tutorApi } from '@/api/tutor.api'
import HistorialAcademico from '@/components/historial/HistorialAcademico.vue'

const estudiantes = ref<Array<{ id: number; nombre: string; apellido: string }>>([])
const seleccionado = ref<number | null>(null)
const cargando = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const tutor = await tutorApi.getMisVinculados()
    estudiantes.value = tutor.estudiantes?.map(te => te.estudiante) ?? []
    if (estudiantes.value.length === 1) seleccionado.value = estudiantes.value[0].id
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar tus estudiantes'
  } finally {
    cargando.value = false
  }
})
</script>

<template>
  <div class="space-y-4">
    <div>
      <h2 class="text-2xl font-bold">Historial académico</h2>
      <p class="text-sm text-base-content/60">Notas por gestión y trimestre de tus estudiantes.</p>
    </div>

    <div v-if="error" role="alert" class="alert alert-error text-sm"><span>{{ error }}</span></div>
    <div v-else-if="cargando" class="skeleton h-12 w-full max-w-sm"></div>
    <p v-else-if="estudiantes.length === 0" class="text-base-content/50">No hay estudiantes vinculados a tu cuenta. Contacta a la secretaría.</p>
    <template v-else>
      <div v-if="estudiantes.length > 1" class="flex flex-wrap gap-2">
        <button v-for="e in estudiantes" :key="e.id" class="btn btn-sm"
          :class="seleccionado === e.id ? 'btn-primary' : 'btn-outline'" @click="seleccionado = e.id">
          {{ e.nombre }} {{ e.apellido }}
        </button>
      </div>
      <HistorialAcademico v-if="seleccionado" :estudiante-id="seleccionado" />
      <p v-else class="text-center text-base-content/40 text-sm py-6">Elige un estudiante</p>
    </template>
  </div>
</template>