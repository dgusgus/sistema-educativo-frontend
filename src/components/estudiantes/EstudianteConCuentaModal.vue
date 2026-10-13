<script setup lang="ts">
// Crea el perfil de estudiante y su cuenta de acceso en una sola operación.
// Al terminar muestra las credenciales (única vez que se ven en claro).
import { ref, watch } from 'vue'
import ModalBase from '@/components/ModalBase.vue'
import { usuarioApi, type ConPerfilPayload } from '@/api/usuario.api'
import { useAccion } from '@/composables/useAccion'

const props = defineProps<{ abierto: boolean }>()
const emit = defineEmits<{ (e: 'cerrar'): void; (e: 'creado'): void }>()

const vacio = () => ({ ci: '', nombre: '', apellido: '', fechaNacimiento: '', direccion: '', rude: '', username: '', password: '' })
const form = ref(vacio())
const validacion = ref<string | null>(null)
const credenciales = ref<{ username: string; password: string } | null>(null)

const crear = useAccion(async () => {
  const f = form.value
  const payload: ConPerfilPayload = {
    roles: ['ESTUDIANTE'],
    username: f.username,
    password: f.password,
    persona: {
      ci: f.ci, nombre: f.nombre, apellido: f.apellido,
      fechaNacimiento: f.fechaNacimiento || undefined,
      direccion: f.direccion || undefined,
    },
    datosPorRol: { ESTUDIANTE: { rude: f.rude || undefined } },
  }
  return usuarioApi.createConPerfil(payload)
})

watch(() => props.abierto, (abierto) => {
  if (!abierto) return
  form.value = vacio()
  validacion.value = null
  credenciales.value = null
  crear.limpiarError()
})

async function enviar() {
  const f = form.value
  if (!f.ci || !f.nombre || !f.apellido || !f.username || !f.password) {
    validacion.value = 'CI, nombre, apellido, username y contraseña son obligatorios'
    return
  }
  if (f.password.length < 6) { validacion.value = 'La contraseña debe tener al menos 6 caracteres'; return }
  validacion.value = null
  const r = await crear.ejecutar()
  if (r) {
    credenciales.value = r.credenciales
    emit('creado')   // la lista se recarga detrás; el modal sigue abierto mostrando las credenciales
  }
}
</script>

<template>
  <ModalBase :abierto="abierto" titulo="Nuevo estudiante con cuenta"
             subtitulo="Crea el perfil y la cuenta de acceso en una sola operación."
             :error="validacion ?? crear.error.value" @cerrar="emit('cerrar')">
    <div v-if="credenciales" class="space-y-4">
      <div role="alert" class="alert alert-success"><span>Estudiante creado correctamente</span></div>
      <div class="bg-base-200 rounded-lg p-4 space-y-2">
        <p class="text-sm font-semibold">Credenciales de acceso:</p>
        <p class="font-mono text-sm">Usuario: <strong>{{ credenciales.username }}</strong></p>
        <p class="font-mono text-sm">Contraseña: <strong>{{ credenciales.password }}</strong></p>
      </div>
      <div class="modal-action">
        <button class="btn btn-primary" @click="emit('cerrar')">Cerrar</button>
      </div>
    </div>

    <form v-else class="space-y-3" @submit.prevent="enviar">
      <div class="divider text-xs">Datos personales</div>
      <div class="grid grid-cols-2 gap-3">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Nombre *</legend>
          <input v-model="form.nombre" type="text" class="input input-bordered w-full" :disabled="crear.ejecutando.value" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Apellido *</legend>
          <input v-model="form.apellido" type="text" class="input input-bordered w-full" :disabled="crear.ejecutando.value" />
        </fieldset>
      </div>
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">CI *</legend>
        <input v-model="form.ci" type="text" class="input input-bordered w-full" :disabled="crear.ejecutando.value" />
      </fieldset>
      <div class="grid grid-cols-2 gap-3">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Fecha de nacimiento</legend>
          <input v-model="form.fechaNacimiento" type="date" class="input input-bordered w-full" :disabled="crear.ejecutando.value" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">RUDE</legend>
          <input v-model="form.rude" type="text" class="input input-bordered w-full" :disabled="crear.ejecutando.value" />
        </fieldset>
      </div>
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">Dirección</legend>
        <input v-model="form.direccion" type="text" class="input input-bordered w-full" :disabled="crear.ejecutando.value" />
      </fieldset>
      <div class="divider text-xs">Cuenta de acceso</div>
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">Username *</legend>
        <input v-model="form.username" type="text" autocomplete="off" class="input input-bordered w-full" :disabled="crear.ejecutando.value" />
      </fieldset>
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">Contraseña * (mín. 6 caracteres)</legend>
        <input v-model="form.password" type="password" autocomplete="new-password" class="input input-bordered w-full" :disabled="crear.ejecutando.value" />
      </fieldset>
      <div class="modal-action mt-6">
        <button type="button" class="btn btn-ghost" :disabled="crear.ejecutando.value" @click="emit('cerrar')">Cancelar</button>
        <button type="submit" class="btn btn-primary" :disabled="crear.ejecutando.value">
          <span v-if="crear.ejecutando.value" class="loading loading-spinner loading-sm"></span>
          Crear estudiante
        </button>
      </div>
    </form>
  </ModalBase>
</template>
