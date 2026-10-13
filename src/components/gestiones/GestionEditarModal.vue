<script setup lang="ts">
// Edita descripción y nota mínima de aprobación. El año no se edita: es la identidad
// de la gestión y rompería el historial.
import { ref, watch } from 'vue'
import ModalBase from '@/components/ModalBase.vue'
import { gestionApi, type GestionResumen } from '@/api/gestion.api'
import { useCatalogoStore } from '@/stores/catalogo.store'
import { useAccion } from '@/composables/useAccion'

const props = defineProps<{ abierto: boolean; gestion: GestionResumen | null }>()
const emit = defineEmits<{
  (e: 'cerrar'): void
  (e: 'editada', p: { id: number; anio: number; activa: boolean; descripcion: string | null; notaMinimaAprobacion: number }): void
}>()

const catalogo = useCatalogoStore()
const form = ref({ descripcion: '', notaMinimaAprobacion: 51 })

const guardar = useAccion(async () => {
  catalogo.invalidar('gestiones')
  await gestionApi.update(props.gestion!.id, {
    descripcion: form.value.descripcion || undefined,
    notaMinimaAprobacion: Number(form.value.notaMinimaAprobacion),
  })
  return true
}, { errorPorDefecto: 'Error al guardar cambios' })

watch(() => props.abierto, (abierto) => {
  if (!abierto || !props.gestion) return
  // Se parte de la nota real de la gestión (no de un 51 fijo, que pisaría un 60 sin avisar).
  form.value = { descripcion: props.gestion.descripcion ?? '', notaMinimaAprobacion: props.gestion.notaMinimaAprobacion ?? 51 }
  guardar.limpiarError()
})

async function enviar() {
  const g = props.gestion
  if (!g) return
  if (!(await guardar.ejecutar())) return   // falló o fue un doble clic ignorado
  emit('editada', {
    id: g.id, anio: g.anio, activa: g.activa,
    descripcion: form.value.descripcion || null,
    notaMinimaAprobacion: Number(form.value.notaMinimaAprobacion),
  })
  emit('cerrar')
}
</script>

<template>
  <ModalBase :abierto="abierto" :titulo="`Editar gestión ${gestion?.anio ?? ''}`"
             subtitulo="El año no se puede cambiar — es la identidad de la gestión."
             :error="guardar.error.value" @cerrar="emit('cerrar')">
    <form class="space-y-3" @submit.prevent="enviar">
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">Descripción</legend>
        <input v-model="form.descripcion" type="text" class="input input-bordered w-full" :disabled="guardar.ejecutando.value" />
      </fieldset>
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">Nota mínima de aprobación</legend>
        <input v-model.number="form.notaMinimaAprobacion" type="number" min="1" max="100" class="input input-bordered w-full" :disabled="guardar.ejecutando.value" />
      </fieldset>
      <div class="modal-action mt-6">
        <button type="button" class="btn btn-ghost" :disabled="guardar.ejecutando.value" @click="emit('cerrar')">Cancelar</button>
        <button type="submit" class="btn btn-primary" :disabled="guardar.ejecutando.value">
          <span v-if="guardar.ejecutando.value" class="loading loading-spinner loading-sm"></span>
          Guardar cambios
        </button>
      </div>
    </form>
  </ModalBase>
</template>
