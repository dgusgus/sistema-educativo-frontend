<script setup lang="ts">
// Crea una cuenta y la vincula a un docente que ya existe (createConPerfil crearía
// una Persona duplicada, por eso son dos pasos: crear cuenta + vincular).
import { ref, watch } from 'vue'
import ModalBase from '@/components/ModalBase.vue'
import { usuarioApi } from '@/api/usuario.api'
import { useAccion } from '@/composables/useAccion'
import type { Docente } from '@/types'

const props = defineProps<{ abierto: boolean; docente: Docente | null }>()
const emit = defineEmits<{
  (e: 'cerrar'): void
  (e: 'vinculado', p: { docenteId: number; usuario: { id: number; username: string; activo: boolean } }): void
}>()

const username = ref('')
const password = ref('')
const validacion = ref<string | null>(null)

const vincular = useAccion(async () => {
  const usuario = await usuarioApi.create({ username: username.value, password: password.value, roles: ['DOCENTE'] })
  await usuarioApi.vincularPerfil(usuario.id, { docenteId: props.docente!.id })
  return usuario
}, { exito: 'Cuenta vinculada correctamente', errorPorDefecto: 'Error al vincular cuenta' })

watch(() => props.abierto, (abierto) => {
  if (!abierto) return
  username.value = ''
  password.value = ''
  validacion.value = null
  vincular.limpiarError()
})

async function enviar() {
  if (!username.value || !password.value) { validacion.value = 'Username y contraseña son obligatorios'; return }
  if (!props.docente) return
  validacion.value = null
  const usuario = await vincular.ejecutar()
  if (!usuario) return
  emit('vinculado', { docenteId: props.docente.id, usuario: { id: usuario.id, username: usuario.username, activo: true } })
  emit('cerrar')
}
</script>

<template>
  <ModalBase :abierto="abierto" titulo="Crear y vincular cuenta"
             :subtitulo="docente ? `Para: ${docente.nombre} ${docente.apellido}` : ''"
             :error="validacion ?? vincular.error.value" @cerrar="emit('cerrar')">
    <form class="space-y-3" @submit.prevent="enviar">
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">Username *</legend>
        <input v-model="username" type="text" autocomplete="off" class="input input-bordered w-full" :disabled="vincular.ejecutando.value" />
      </fieldset>
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">Contraseña * (mín. 6 caracteres)</legend>
        <input v-model="password" type="password" autocomplete="new-password" class="input input-bordered w-full" :disabled="vincular.ejecutando.value" />
      </fieldset>
      <div class="modal-action mt-6">
        <button type="button" class="btn btn-ghost" :disabled="vincular.ejecutando.value" @click="emit('cerrar')">Cancelar</button>
        <button type="submit" class="btn btn-warning" :disabled="vincular.ejecutando.value">
          <span v-if="vincular.ejecutando.value" class="loading loading-spinner loading-sm"></span>
          Crear y vincular
        </button>
      </div>
    </form>
  </ModalBase>
</template>
