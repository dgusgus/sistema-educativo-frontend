<script setup lang="ts">
// Resetea la contraseña de la cuenta de un docente (quien lo hace no la conoce).
import { ref, watch } from 'vue'
import ModalBase from '@/components/ModalBase.vue'
import { usuarioApi } from '@/api/usuario.api'
import { useAccion } from '@/composables/useAccion'
import type { Docente } from '@/types'

const props = defineProps<{ abierto: boolean; docente: Docente | null }>()
const emit = defineEmits<{ (e: 'cerrar'): void }>()

const password = ref('')
const validacion = ref<string | null>(null)

const resetear = useAccion(
  () => usuarioApi.resetearPassword(props.docente!.usuario!.id, password.value),
  { exito: 'Contraseña reseteada correctamente', errorPorDefecto: 'Error al resetear' },
)

watch(() => props.abierto, (abierto) => {
  if (!abierto) return
  password.value = ''
  validacion.value = null
  resetear.limpiarError()
})

async function enviar() {
  if (password.value.length < 6) { validacion.value = 'La contraseña debe tener al menos 6 caracteres'; return }
  if (!props.docente?.usuario?.id) return
  validacion.value = null
  if (await resetear.ejecutar() !== undefined) emit('cerrar')
}
</script>

<template>
  <ModalBase :abierto="abierto" titulo="Resetear contraseña"
             :subtitulo="docente ? `${docente.nombre} ${docente.apellido} · ${docente.usuario?.username ?? ''}` : ''"
             :error="validacion ?? resetear.error.value" @cerrar="emit('cerrar')">
    <form class="space-y-3" @submit.prevent="enviar">
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">Nueva contraseña * (mín. 6 caracteres)</legend>
        <input v-model="password" type="password" autocomplete="new-password" class="input input-bordered w-full" :disabled="resetear.ejecutando.value" />
      </fieldset>
      <div class="modal-action mt-6">
        <button type="button" class="btn btn-ghost" :disabled="resetear.ejecutando.value" @click="emit('cerrar')">Cancelar</button>
        <button type="submit" class="btn btn-warning" :disabled="resetear.ejecutando.value">
          <span v-if="resetear.ejecutando.value" class="loading loading-spinner loading-sm"></span>
          Resetear
        </button>
      </div>
    </form>
  </ModalBase>
</template>
