<script setup lang="ts">
// Crear (docente = null) o editar el perfil de un docente, sin cuenta de acceso.
import { ref, watch } from 'vue'
import ModalBase from '@/components/ModalBase.vue'
import { docenteApi, type DocentePayload } from '@/api/docente.api'
import { useAccion } from '@/composables/useAccion'
import type { Docente } from '@/types'

const props = defineProps<{ abierto: boolean; docente: Docente | null }>()
const emit = defineEmits<{
  (e: 'cerrar'): void
  (e: 'creado', d: Docente): void
  (e: 'actualizado', d: Docente): void
}>()

const formVacio = (): DocentePayload => ({ nombre: '', apellido: '', ci: '', email: '', telefono: '', especialidad: '' })
const form = ref<DocentePayload>(formVacio())
const validacion = ref<string | null>(null)

const crear = useAccion(() => docenteApi.create(form.value), { exito: 'Docente creado', errorPorDefecto: 'Error al guardar' })
const actualizar = useAccion(() => docenteApi.update(props.docente!.id, form.value), { exito: 'Docente actualizado', errorPorDefecto: 'Error al guardar' })
const accion = () => (props.docente ? actualizar : crear)

watch(() => props.abierto, (abierto) => {
  if (!abierto) return
  const d = props.docente
  form.value = d
    ? { nombre: d.nombre, apellido: d.apellido, ci: d.ci, email: d.email ?? '', telefono: d.telefono ?? '', especialidad: d.especialidad ?? '' }
    : formVacio()
  validacion.value = null
  crear.limpiarError(); actualizar.limpiarError()
})

async function enviar() {
  if (!form.value.nombre || !form.value.apellido || !form.value.ci) {
    validacion.value = 'Nombre, apellido y CI son obligatorios'
    return
  }
  validacion.value = null
  if (props.docente) {
    const r = await actualizar.ejecutar()
    if (r) { emit('actualizado', r); emit('cerrar') }
  } else {
    const r = await crear.ejecutar()
    if (r) { emit('creado', r); emit('cerrar') }
  }
}
</script>

<template>
  <ModalBase :abierto="abierto" :titulo="docente ? 'Editar docente' : 'Nuevo docente (solo perfil)'"
             :subtitulo="docente ? undefined : 'Registra los datos personales. Podés crear la cuenta de acceso después con &quot;Vincular cuenta&quot;.'"
             :error="validacion ?? accion().error.value" @cerrar="emit('cerrar')">
    <form class="space-y-3" @submit.prevent="enviar">
      <div class="grid grid-cols-2 gap-3">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Nombre *</legend>
          <input v-model="form.nombre" type="text" class="input input-bordered w-full" :disabled="accion().ejecutando.value" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Apellido *</legend>
          <input v-model="form.apellido" type="text" class="input input-bordered w-full" :disabled="accion().ejecutando.value" />
        </fieldset>
      </div>
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">CI *</legend>
        <input v-model="form.ci" type="text" class="input input-bordered w-full" :disabled="accion().ejecutando.value" />
      </fieldset>
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">Especialidad</legend>
        <input v-model="form.especialidad" type="text" placeholder="Ej: Matemáticas" class="input input-bordered w-full" :disabled="accion().ejecutando.value" />
      </fieldset>
      <div class="grid grid-cols-2 gap-3">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Email</legend>
          <input v-model="form.email" type="email" class="input input-bordered w-full" :disabled="accion().ejecutando.value" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Teléfono</legend>
          <input v-model="form.telefono" type="tel" class="input input-bordered w-full" :disabled="accion().ejecutando.value" />
        </fieldset>
      </div>
      <div class="modal-action mt-6">
        <button type="button" class="btn btn-ghost" :disabled="accion().ejecutando.value" @click="emit('cerrar')">Cancelar</button>
        <button type="submit" class="btn btn-primary" :disabled="accion().ejecutando.value">
          <span v-if="accion().ejecutando.value" class="loading loading-spinner loading-sm"></span>
          {{ docente ? 'Guardar cambios' : 'Crear perfil' }}
        </button>
      </div>
    </form>
  </ModalBase>
</template>
