<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useDocenteStore } from '@/stores/docente.store'
import { useGestionStore } from '@/stores/gestion.store'
import { horarioApi, type HorarioDetalle } from '@/api/horario.api'
import HorarioSemanal from '@/components/HorarioSemanal.vue'

const docenteStore = useDocenteStore()
const gestion       = useGestionStore()

const horarios = ref<HorarioDetalle[]>([])
const cargando = ref(true)
const error    = ref<string | null>(null)

onMounted(async () => {
  try {
    await Promise.all([docenteStore.cargar(), gestion.cargar()])
    const docenteId = docenteStore.docente?.id
    if (!docenteId) throw new Error('No se encontró tu perfil de docente')
    horarios.value = await horarioApi.getByDocente(docenteId, gestion.gestionId ?? undefined)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar tu horario'
  } finally {
    cargando.value = false
  }
})
</script>

<template>
  <div class="p-4 md:p-6 space-y-4">
    <h1 class="text-xl font-bold">Mi horario</h1>

    <div v-if="error" role="alert" class="alert alert-error py-2 text-sm">
      <span>{{ error }}</span>
    </div>

    <div class="card bg-base-100 shadow">
      <div class="card-body">
        <HorarioSemanal :horarios="horarios" :cargando="cargando" columna-extra="curso" />
      </div>
    </div>
  </div>
</template>