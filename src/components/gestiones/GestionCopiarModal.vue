<script setup lang="ts">
// Copia la estructura (cursos, asignaciones, trimestres...) de una gestión anterior
// hacia una ya creada. Lo que ya existía en el destino se respeta.
import { ref, computed, watch } from 'vue'
import ModalBase from '@/components/ModalBase.vue'
import CopiarEstructuraCampos from '@/components/CopiarEstructuraCampos.vue'
import { gestionApi, type GestionResumen, type OpcionesCopiaForm, type ResultadoCopia } from '@/api/gestion.api'
import { useAccion } from '@/composables/useAccion'
import { nuevaCopia } from '@/lib/gestiones'

const props = defineProps<{ abierto: boolean; destino: GestionResumen | null; gestiones: GestionResumen[] }>()
const emit = defineEmits<{
  (e: 'cerrar'): void
  (e: 'copiada', p: { destinoAnio: number; resultado: ResultadoCopia }): void
}>()

const form = ref<OpcionesCopiaForm>(nuevaCopia(''))
const validacion = ref<string | null>(null)
const origenes = computed(() => props.destino ? props.gestiones.filter(g => g.anio < props.destino!.anio) : [])

const copiar = useAccion(() => {
  const c = form.value
  return gestionApi.copiarEstructura(props.destino!.id, {
    origenId: Number(c.origenId), cursos: c.cursos, asignaciones: c.asignaciones,
    trimestres: c.trimestres, dimensiones: c.dimensiones, conceptosPago: c.conceptosPago,
  })
}, { errorPorDefecto: 'Error al copiar la estructura' })

watch(() => props.abierto, (abierto) => {
  if (!abierto || !props.destino) return
  const anterior = [...origenes.value].sort((a, b) => b.anio - a.anio)[0]
  form.value = nuevaCopia(anterior?.id ?? '')
  validacion.value = null
  copiar.limpiarError()
})

async function enviar() {
  if (!props.destino) return
  if (!form.value.origenId) { validacion.value = 'Elegí la gestión de origen'; return }
  validacion.value = null
  const resultado = await copiar.ejecutar()
  if (!resultado) return
  emit('copiada', { destinoAnio: props.destino.anio, resultado })
  emit('cerrar')
}
</script>

<template>
  <ModalBase :abierto="abierto" titulo="Copiar estructura"
             :subtitulo="destino ? `Hacia la gestión ${destino.anio}` : ''"
             :error="validacion ?? copiar.error.value" @cerrar="emit('cerrar')">
    <form class="space-y-3" @submit.prevent="enviar">
      <CopiarEstructuraCampos v-model="form" :origenes="origenes" :deshabilitado="copiar.ejecutando.value" />
      <div class="modal-action mt-6">
        <button type="button" class="btn btn-ghost" :disabled="copiar.ejecutando.value" @click="emit('cerrar')">Cancelar</button>
        <button type="submit" class="btn btn-primary" :disabled="copiar.ejecutando.value">
          <span v-if="copiar.ejecutando.value" class="loading loading-spinner loading-sm"></span>
          Copiar
        </button>
      </div>
    </form>
  </ModalBase>
</template>
