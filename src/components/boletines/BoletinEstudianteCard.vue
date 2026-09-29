<script setup lang="ts">
import { ref, watch } from 'vue'
import { boletinApi, type DetalleBoletinEstudiante } from '@/api/boletin.api'
import BoletinDetalleVista from './BoletinDetalleVista.vue'

// Modal de detalle: mismo contenido que BoletinDetalleVista pero en ventana
// modal. REGLA: montarlo siempre con v-if + @close que lo desmonte — un
// modal-open sin condición deja la pantalla colgada.
// Dos formas de identificar al estudiante: inscripcionId directo, o
// estudianteId + gestionId (buscador, donde no se conoce la inscripción).
const props = defineProps<{
  inscripcionId?: number
  estudianteId?: number
  gestionId?: number
}>()

const emit = defineEmits<{ close: [] }>()

const detalle = ref<DetalleBoletinEstudiante | null>(null)
const cargando = ref(false)
const error = ref<string | null>(null)

async function cargar() {
  if (!props.inscripcionId && !(props.estudianteId && props.gestionId)) return

  cargando.value = true
  error.value = null
  detalle.value = null
  try {
    detalle.value = props.inscripcionId
      ? await boletinApi.getDetalle(props.inscripcionId)
      : await boletinApi.getDetallePorEstudiante(props.estudianteId!, props.gestionId!)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar el detalle'
  } finally {
    cargando.value = false
  }
}

watch(() => [props.inscripcionId, props.estudianteId, props.gestionId], cargar, { immediate: true })
</script>

<template>
  <div class="modal modal-open" @click.self="emit('close')" @keydown.esc="emit('close')">
    <div class="modal-box max-w-4xl p-0 overflow-hidden">
      <div class="max-h-[70vh] overflow-y-auto">
        <div v-if="cargando" class="flex justify-center py-12 bg-base-100">
          <span class="loading loading-spinner loading-md"></span>
        </div>

        <div v-else-if="error" role="alert" class="alert alert-error text-sm m-4">
          <span>{{ error }}</span>
        </div>

        <BoletinDetalleVista v-else-if="detalle" :detalle="detalle" />
      </div>

      <!-- Pie -->
      <div class="px-6 py-4 border-t border-base-200 flex items-center justify-end bg-base-100">
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" @click="emit('close')">Cerrar</button>
          <slot name="acciones" />
        </div>
      </div>
    </div>
  </div>
</template>
