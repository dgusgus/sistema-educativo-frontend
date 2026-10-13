<script setup lang="ts">
// Crea el docente (perfil + cuenta) en una sola operación y muestra las credenciales.
import { ref, watch } from 'vue'
import ModalBase from '@/components/ModalBase.vue'
import { usuarioApi, type ConPerfilPayload } from '@/api/usuario.api'
import { useAccion } from '@/composables/useAccion'
import type { Docente } from '@/types'

const props = defineProps<{ abierto: boolean }>()
const emit = defineEmits<{ (e: 'cerrar'): void; (e: 'creado', d: Docente): void }>()

const vacio = () => ({ ci: '', nombre: '', apellido: '', especialidad: '', email: '', telefono: '', username: '', password: '' })
const form = ref(vacio())
const validacion = ref<string | null>(null)
const credenciales = ref<{ username: string; password: string } | null>(null)

const crear = useAccion(async () => {
  const f = form.value
  const payload: ConPerfilPayload = {
    roles: ['DOCENTE'],
    username: f.username,
    password: f.password,
    persona: { ci: f.ci, nombre: f.nombre, apellido: f.apellido, email: f.email || undefined, telefono: f.telefono || undefined },
    datosPorRol: { DOCENTE: { especialidad: f.especialidad || undefined } },
  }
  return usuarioApi.createConPerfil(payload)
}, { errorPorDefecto: 'Error al crear docente' })

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
  const resultado = await crear.ejecutar()
  if (!resultado) return
  credenciales.value = resultado.credenciales
  // Se arma el docente con lo que el backend YA confirmó (creación transaccional),
  // en vez de volver a pedir la lista: evita pisar datos frescos con una foto vieja.
  const perfil = resultado.perfiles.DOCENTE
  if (perfil) {
    emit('creado', {
      id: perfil.id,
      ci: resultado.persona.ci,
      nombre: resultado.persona.nombre,
      apellido: resultado.persona.apellido,
      telefono: resultado.persona.telefono ?? null,
      email: resultado.persona.email ?? null,
      especialidad: perfil.especialidad ?? null,
      activo: true,
      usuario: { id: resultado.usuario.id, username: resultado.usuario.username, activo: true },
      asignaciones: [],
    })
  }
}
</script>

<template>
  <ModalBase :abierto="abierto" titulo="Nuevo docente con cuenta"
             subtitulo="Crea el perfil y la cuenta de acceso en una sola operación."
             @cerrar="emit('cerrar')">
    <div v-if="credenciales" class="space-y-4">
      <div role="alert" class="alert alert-success"><span>Docente creado correctamente</span></div>
      <div class="bg-base-200 rounded-lg p-4 space-y-2">
        <p class="text-sm font-semibold">Credenciales de acceso:</p>
        <p class="font-mono text-sm">Usuario: <strong>{{ credenciales.username }}</strong></p>
        <p class="font-mono text-sm">Contraseña: <strong>{{ credenciales.password }}</strong></p>
        <p class="text-xs text-base-content/50 mt-2">Compartí estas credenciales de forma segura con el docente.</p>
      </div>
      <div class="modal-action">
        <button class="btn btn-primary" @click="emit('cerrar')">Cerrar</button>
      </div>
    </div>

    <form v-else class="space-y-3" @submit.prevent="enviar">
      <div v-if="validacion ?? crear.error.value" role="alert" class="alert alert-error py-2 text-sm">
        <span>{{ validacion ?? crear.error.value }}</span>
      </div>

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
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">Especialidad</legend>
        <input v-model="form.especialidad" type="text" class="input input-bordered w-full" :disabled="crear.ejecutando.value" />
      </fieldset>
      <div class="grid grid-cols-2 gap-3">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Email</legend>
          <input v-model="form.email" type="email" class="input input-bordered w-full" :disabled="crear.ejecutando.value" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Teléfono</legend>
          <input v-model="form.telefono" type="tel" class="input input-bordered w-full" :disabled="crear.ejecutando.value" />
        </fieldset>
      </div>

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
          Crear docente
        </button>
      </div>
    </form>
  </ModalBase>
</template>
