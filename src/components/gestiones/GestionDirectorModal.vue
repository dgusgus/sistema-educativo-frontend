<script setup lang="ts">
// Asignar (o cambiar) el director de una gestión. Es una acción separada de crear la
// gestión a propósito: cambia quién firma boletines y reportes, así que debe ser intencional.
import { ref, computed, watch } from 'vue'
import ModalBase from '@/components/ModalBase.vue'
import { gestionApi, type GestionResumen } from '@/api/gestion.api'
import { useCatalogoStore } from '@/stores/catalogo.store'
import { useAccion } from '@/composables/useAccion'

export interface DirectorOpcion { id: number; nombre: string; apellido: string; activo: boolean }

const props = defineProps<{ abierto: boolean; gestion: GestionResumen | null; directores: DirectorOpcion[] }>()
const emit = defineEmits<{
  (e: 'cerrar'): void
  (e: 'asignado', p: { gestionId: number; director: { id: number; nombre: string; apellido: string } }): void
}>()

const catalogo = useCatalogoStore()
const directorId = ref<number | ''>('')
const validacion = ref<string | null>(null)
// Un director inactivo ya no trabaja en la institución: no se ofrece.
const activos = computed(() => props.directores.filter(d => d.activo))

const asignar = useAccion(async () => {
  catalogo.invalidar('gestiones')
  await gestionApi.asignarDirector(props.gestion!.id, Number(directorId.value))
  return true
}, { exito: 'Director asignado', errorPorDefecto: 'Error al asignar director' })

watch(() => props.abierto, (abierto) => {
  if (!abierto) return
  directorId.value = props.gestion?.director?.id ?? ''   // muestra al actual; cambia solo si quiere reemplazarlo
  validacion.value = null
  asignar.limpiarError()
})

async function enviar() {
  if (!directorId.value) { validacion.value = 'Seleccioná un director'; return }
  if (!props.gestion) return
  validacion.value = null
  if (!(await asignar.ejecutar())) return   // falló o fue un doble clic ignorado
  const d = props.directores.find(x => x.id === Number(directorId.value))
  if (d) emit('asignado', { gestionId: props.gestion.id, director: { id: d.id, nombre: d.nombre, apellido: d.apellido } })
  emit('cerrar')
}
</script>

<template>
  <ModalBase :abierto="abierto" titulo="Asignar director"
             :subtitulo="gestion ? `Gestión: ${gestion.anio}${gestion.director ? ` · Director actual: ${gestion.director.nombre} ${gestion.director.apellido}` : ''}` : ''"
             :error="validacion ?? asignar.error.value" @cerrar="emit('cerrar')">
    <form class="space-y-3" @submit.prevent="enviar">
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">Director *</legend>
        <select v-model="directorId" class="select select-bordered w-full" :disabled="asignar.ejecutando.value">
          <option value="" disabled>Seleccionar director</option>
          <option v-for="d in activos" :key="d.id" :value="d.id">{{ d.apellido }}, {{ d.nombre }}</option>
        </select>
        <p v-if="activos.length === 0" class="text-xs text-warning mt-1">
          No hay directores activos en el sistema.
          Creá uno primero desde la pestaña "Directores" en Usuarios.
        </p>
      </fieldset>
      <div class="modal-action mt-6">
        <button type="button" class="btn btn-ghost" :disabled="asignar.ejecutando.value" @click="emit('cerrar')">Cancelar</button>
        <button type="submit" class="btn btn-primary" :disabled="asignar.ejecutando.value || !directorId">
          <span v-if="asignar.ejecutando.value" class="loading loading-spinner loading-sm"></span>
          Asignar
        </button>
      </div>
    </form>
  </ModalBase>
</template>
