<script setup lang="ts">
// Crear (estudiante = null) o editar el perfil de un estudiante, sin cuenta.
import { ref, watch } from 'vue'
import ModalBase from '@/components/ModalBase.vue'
import { estudianteApi, type EstudiantePayload } from '@/api/estudiante.api'
import { useAccion } from '@/composables/useAccion'
import type { Estudiante } from '@/types'

const props = defineProps<{ abierto: boolean; estudiante: Estudiante | null }>()
const emit = defineEmits<{ (e: 'cerrar'): void; (e: 'guardado'): void }>()

const vacio = (): EstudiantePayload => ({ nombre: '', apellido: '', ci: '', fechaNacimiento: '', direccion: '' })
const form = ref<EstudiantePayload>(vacio())
const validacion = ref<string | null>(null)

const guardar = useAccion(async () => {
  const e = props.estudiante
  return e ? estudianteApi.update(e.id, form.value) : estudianteApi.create(form.value)
}, { exito: undefined })

watch(() => props.abierto, (abierto) => {
  if (!abierto) return
  const e = props.estudiante
  form.value = e
    ? { nombre: e.nombre, apellido: e.apellido, ci: e.ci, fechaNacimiento: e.fechaNacimiento ?? '', direccion: e.direccion ?? '' }
    : vacio()
  validacion.value = null
  guardar.limpiarError()
})

async function enviar() {
  if (!form.value.nombre || !form.value.apellido || !form.value.ci) {
    validacion.value = 'Nombre, apellido y CI son obligatorios'
    return
  }
  validacion.value = null
  if (await guardar.ejecutar()) emit('guardado')
}
</script>

<template>
  <ModalBase :abierto="abierto" :titulo="estudiante ? 'Editar estudiante' : 'Nuevo estudiante (solo perfil)'"
             :error="validacion ?? guardar.error.value" @cerrar="emit('cerrar')">
    <form class="space-y-3" @submit.prevent="enviar">
      <div class="grid grid-cols-2 gap-3">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Nombre *</legend>
          <input v-model="form.nombre" type="text" class="input input-bordered w-full" :disabled="guardar.ejecutando.value" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Apellido *</legend>
          <input v-model="form.apellido" type="text" class="input input-bordered w-full" :disabled="guardar.ejecutando.value" />
        </fieldset>
      </div>
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">CI *</legend>
        <input v-model="form.ci" type="text" class="input input-bordered w-full" :disabled="guardar.ejecutando.value" />
      </fieldset>
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">Fecha de nacimiento</legend>
        <input v-model="form.fechaNacimiento" type="date" class="input input-bordered w-full" :disabled="guardar.ejecutando.value" />
      </fieldset>
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">Dirección</legend>
        <input v-model="form.direccion" type="text" class="input input-bordered w-full" :disabled="guardar.ejecutando.value" />
      </fieldset>
      <div class="modal-action mt-6">
        <button type="button" class="btn btn-ghost" :disabled="guardar.ejecutando.value" @click="emit('cerrar')">Cancelar</button>
        <button type="submit" class="btn btn-primary" :disabled="guardar.ejecutando.value">
          <span v-if="guardar.ejecutando.value" class="loading loading-spinner loading-sm"></span>
          {{ estudiante ? 'Guardar cambios' : 'Crear perfil' }}
        </button>
      </div>
    </form>
  </ModalBase>
</template>
