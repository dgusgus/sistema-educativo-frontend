<script setup lang="ts">
// Cambia el estado de una inscripción (activa, retirada, transferida, concluida).
import { ref, computed, watch } from 'vue'
import ModalBase from '@/components/ModalBase.vue'
import { estudianteApi, type CambiarEstadoPayload } from '@/api/estudiante.api'
import { useAccion } from '@/composables/useAccion'
import { nombreCursoDeInscripcion } from '@/lib/estudiantes'
import type { Inscripcion } from '@/types'

const props = defineProps<{ abierto: boolean; inscripcion: Inscripcion | null }>()
const emit = defineEmits<{ (e: 'cerrar'): void; (e: 'cambiado'): void }>()

const form = ref<CambiarEstadoPayload>({ estadoInscripcion: 'ACTIVA', fechaRetiro: '', observaciones: '' })
const requiereFecha = computed(() => ['RETIRADA', 'TRANSFERIDA'].includes(form.value.estadoInscripcion))

const cambiar = useAccion(
  () => estudianteApi.cambiarEstado(props.inscripcion!.id, form.value),
  { exito: 'Estado actualizado' },
)

watch(() => props.abierto, (abierto) => {
  if (!abierto || !props.inscripcion) return
  form.value = { estadoInscripcion: props.inscripcion.estadoInscripcion, fechaRetiro: '', observaciones: '' }
  cambiar.limpiarError()
})

async function enviar() {
  if (!props.inscripcion) return
  if (await cambiar.ejecutar() !== undefined) emit('cambiado')
}
</script>

<template>
  <ModalBase :abierto="abierto" titulo="Cambiar estado de inscripción"
             :subtitulo="nombreCursoDeInscripcion(inscripcion)" :error="cambiar.error.value" @cerrar="emit('cerrar')">
    <form class="space-y-3" @submit.prevent="enviar">
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">Nuevo estado *</legend>
        <select v-model="form.estadoInscripcion" class="select select-bordered w-full" :disabled="cambiar.ejecutando.value">
          <option value="ACTIVA">ACTIVA</option>
          <option value="RETIRADA">RETIRADA</option>
          <option value="TRANSFERIDA">TRANSFERIDA</option>
          <option value="CONCLUIDA">CONCLUIDA</option>
        </select>
      </fieldset>
      <fieldset v-if="requiereFecha" class="fieldset">
        <legend class="fieldset-legend text-xs">Fecha de retiro</legend>
        <input v-model="form.fechaRetiro" type="date" class="input input-bordered w-full" :disabled="cambiar.ejecutando.value" />
      </fieldset>
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">Observaciones</legend>
        <textarea v-model="form.observaciones" rows="2" class="textarea textarea-bordered w-full" :disabled="cambiar.ejecutando.value"></textarea>
      </fieldset>
      <div class="modal-action mt-6">
        <button type="button" class="btn btn-ghost" :disabled="cambiar.ejecutando.value" @click="emit('cerrar')">Cancelar</button>
        <button type="submit" class="btn btn-warning" :disabled="cambiar.ejecutando.value">
          <span v-if="cambiar.ejecutando.value" class="loading loading-spinner loading-sm"></span>
          Cambiar estado
        </button>
      </div>
    </form>
  </ModalBase>
</template>
