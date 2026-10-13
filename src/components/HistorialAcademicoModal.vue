<script setup lang="ts">
// Historial académico de un estudiante: una fila por gestión con de dónde viene,
// a dónde va, resultado y promedio. Sale de la cadena de inscripciones (no hay
// tabla aparte) y muestra también qué curso le corresponde a continuación.
import { ref, watch } from 'vue'
import { estudianteApi, type HistorialAcademico } from '@/api/estudiante.api'
import StatusBadge from '@/components/StatusBadge.vue'

const props = defineProps<{
  abierto:    boolean
  estudiante: { id: number; nombre: string; apellido: string } | null
}>()
const emit = defineEmits<{ cerrar: [] }>()

const cargando = ref(false)
const error    = ref<string | null>(null)
const datos    = ref<HistorialAcademico | null>(null)

watch(() => props.abierto, async abierto => {
  if (!abierto || !props.estudiante) return
  const id = props.estudiante.id
  cargando.value = true
  error.value = null
  datos.value = null
  try {
    const h = await estudianteApi.getHistorial(id)
    if (props.estudiante?.id === id) datos.value = h   // ignora respuestas de un estudiante anterior
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar el historial'
  } finally {
    cargando.value = false
  }
})
</script>

<template>
  <dialog :open="abierto" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box max-w-4xl">
      <h3 class="font-bold text-lg mb-1">Historial académico</h3>
      <p class="text-sm text-base-content/60 mb-4">{{ estudiante?.nombre }} {{ estudiante?.apellido }}</p>

      <div v-if="error" role="alert" class="alert alert-error mb-4 py-2 text-sm"><span>{{ error }}</span></div>
      <div v-if="cargando" class="flex justify-center py-8"><span class="loading loading-spinner"></span></div>

      <template v-if="datos">
        <p v-if="!datos.historial.length" class="text-sm text-base-content/60 py-4">
          Todavía no tiene inscripciones registradas.
        </p>

        <div v-else class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Año</th>
                <th>Curso</th>
                <th>Estado</th>
                <th>Resultado</th>
                <th class="text-right">Promedio</th>
                <th>Viene de</th>
                <th>Va a</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="h in datos.historial" :key="h.inscripcionId">
                <td class="font-semibold">{{ h.anio }}</td>
                <td>{{ h.curso }}</td>
                <td><StatusBadge :estado="h.estado" tamano="xs" /></td>
                <td><StatusBadge :estado="h.resultado" tamano="xs" /></td>
                <td class="text-right font-mono">{{ h.promedioGeneral ?? '—' }}</td>
                <td class="text-xs text-base-content/60">{{ h.desde }}</td>
                <td class="text-xs text-base-content/60">{{ h.hacia }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          v-if="datos.historial.length"
          role="alert"
          class="alert mt-4 py-2 text-sm"
          :class="datos.proximo.tipo === 'EGRESADO' || datos.proximo.tipo === 'PENDIENTE' ? 'alert-warning' : 'alert-info'"
        >
          <span v-if="datos.proximo.tipo === 'FIJO'">
            Próxima inscripción: <strong>{{ datos.proximo.corresponde }}</strong> ({{ datos.proximo.motivo }}).
          </span>
          <span v-else>{{ datos.proximo.motivo }}.</span>
        </div>
      </template>

      <div class="modal-action mt-6">
        <button type="button" class="btn" @click="emit('cerrar')">Cerrar</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="emit('cerrar')"><button>cerrar</button></form>
  </dialog>
</template>