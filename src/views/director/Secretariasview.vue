<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { secretariaApi, type SecretariaConCuentaPayload } from '@/api/secretaria.api'
import { useToastStore } from '@/stores/toast.store'
import type { Secretaria } from '@/types'
import AppIcon from '@/components/AppIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const toast = useToastStore()

const secretarias = ref<Secretaria[]>([])
const cargando     = ref(true)
const error        = ref<string | null>(null)
const busqueda      = ref('')

onMounted(cargar)

async function cargar() {
  cargando.value = true
  error.value = null
  try {
    secretarias.value = await secretariaApi.getAll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar secretarias'
  } finally {
    cargando.value = false
  }
}

const filtradas = computed(() => {
  const q = busqueda.value.toLowerCase().trim()
  if (!q) return secretarias.value
  return secretarias.value.filter(s => `${s.nombre} ${s.apellido} ${s.ci}`.toLowerCase().includes(q))
})

// ─── Crear con cuenta (único flujo posible) ───────────────────────────────────
const modalCrear  = ref(false)
const creando      = ref(false)
const errorCrear   = ref<string | null>(null)
const credenciales = ref<{ username: string; password: string } | null>(null)
const formCrear = ref<SecretariaConCuentaPayload>({ ci: '', nombre: '', apellido: '', telefono: '', email: '', username: '', password: '' })

function abrirCrear() {
  formCrear.value = { ci: '', nombre: '', apellido: '', telefono: '', email: '', username: '', password: '' }
  errorCrear.value = null
  credenciales.value = null
  modalCrear.value = true
}

async function crear() {
  const f = formCrear.value
  if (!f.ci || !f.nombre || !f.apellido || !f.username || !f.password) {
    errorCrear.value = 'CI, nombre, apellido, username y contraseña son obligatorios'
    return
  }
  if (f.password.length < 6) { errorCrear.value = 'La contraseña debe tener al menos 6 caracteres'; return }
  creando.value = true
  errorCrear.value = null
  try {
    const resultado = await secretariaApi.crearConCuenta(f)
    credenciales.value = resultado.credenciales
    secretarias.value.unshift(resultado.secretaria)
  } catch (e) {
    errorCrear.value = e instanceof Error ? e.message : 'Error al crear secretaria'
  } finally {
    creando.value = false
  }
}

// ─── Editar perfil ─────────────────────────────────────────────────────────────
const modalEditar = ref(false)
const guardando   = ref(false)
const errorEditar = ref<string | null>(null)
const idEditando  = ref<number | null>(null)
const formEditar  = ref({ ci: '', nombre: '', apellido: '', telefono: '', email: '', activo: true })

function abrirEditar(s: Secretaria) {
  idEditando.value = s.id
  formEditar.value = { ci: s.ci, nombre: s.nombre, apellido: s.apellido, telefono: s.telefono ?? '', email: s.email ?? '', activo: s.activo }
  errorEditar.value = null
  modalEditar.value = true
}

async function guardarEdicion() {
  if (!idEditando.value) return
  guardando.value = true
  errorEditar.value = null
  try {
    const actualizado = await secretariaApi.update(idEditando.value, formEditar.value)
    const idx = secretarias.value.findIndex(s => s.id === idEditando.value)
    if (idx !== -1) secretarias.value[idx] = { ...secretarias.value[idx], ...actualizado }
    modalEditar.value = false
    toast.success('Secretaria actualizada')
  } catch (e) {
    errorEditar.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <h2 class="text-2xl font-bold flex-1">Secretarias</h2>
      <button class="btn btn-primary btn-sm" @click="abrirCrear">+ Nueva secretaria</button>
    </div>

    <div v-if="error" role="alert" class="alert alert-error">
      <span>{{ error }}</span>
      <button class="btn btn-sm btn-ghost" @click="cargar">Reintentar</button>
    </div>

    <label class="input input-bordered flex items-center gap-2 max-w-sm">
<AppIcon nombre="buscar" class="h-4 w-4 opacity-50" />
      <input v-model="busqueda" type="search" placeholder="Buscar por nombre o CI..." class="grow" />
    </label>

    <div class="card bg-base-100 shadow overflow-x-auto">
      <table class="table table-sm">
        <thead><tr><th>Nombre</th><th>CI</th><th>Cuenta</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>
          <tr v-if="cargando" v-for="i in 3" :key="i"><td colspan="5"><div class="skeleton h-4 w-full"></div></td></tr>
          <tr v-else-if="filtradas.length === 0"><td colspan="5" class="text-center text-base-content/40 py-8">No se encontraron secretarias</td></tr>
          <tr v-else v-for="s in filtradas" :key="s.id" class="hover">
            <td class="font-medium">{{ s.apellido }}, {{ s.nombre }}</td>
            <td class="font-mono text-sm">{{ s.ci }}</td>
            <td><span class="badge badge-sm badge-success font-mono">{{ s.usuario?.username }}</span></td>
            <td><StatusBadge :estado="s.activo ? 'ACTIVO' : 'INACTIVO'" :texto="s.activo ? 'Activo' : 'Inactivo'" /></td>
            <td><button class="btn btn-ghost btn-xs" @click="abrirEditar(s)">Editar</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Modal crear -->
  <dialog :open="modalCrear" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Nueva secretaria</h3>
      <p class="text-sm text-base-content/60 mb-4">Una secretaria siempre nace con cuenta de acceso.</p>
      <div v-if="credenciales" class="space-y-4">
        <div role="alert" class="alert alert-success"><span>Secretaria creada correctamente</span></div>
        <div class="bg-base-200 rounded-lg p-4 space-y-2">
          <p class="font-mono text-sm">Usuario: <strong>{{ credenciales.username }}</strong></p>
          <p class="font-mono text-sm">Contraseña: <strong>{{ credenciales.password }}</strong></p>
        </div>
        <div class="modal-action"><button class="btn btn-primary" @click="modalCrear = false; credenciales = null">Cerrar</button></div>
      </div>
      <form v-else class="space-y-3" @submit.prevent="crear">
        <div v-if="errorCrear" role="alert" class="alert alert-error py-2 text-sm"><span>{{ errorCrear }}</span></div>
        <div class="grid grid-cols-2 gap-3">
          <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Nombre *</legend>
            <input v-model="formCrear.nombre" type="text" class="input input-bordered w-full" :disabled="creando" /></fieldset>
          <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Apellido *</legend>
            <input v-model="formCrear.apellido" type="text" class="input input-bordered w-full" :disabled="creando" /></fieldset>
        </div>
        <fieldset class="fieldset"><legend class="fieldset-legend text-xs">CI *</legend>
          <input v-model="formCrear.ci" type="text" class="input input-bordered w-full" :disabled="creando" /></fieldset>
        <div class="grid grid-cols-2 gap-3">
          <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Teléfono</legend>
            <input v-model="formCrear.telefono" type="tel" class="input input-bordered w-full" :disabled="creando" /></fieldset>
          <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Email</legend>
            <input v-model="formCrear.email" type="email" class="input input-bordered w-full" :disabled="creando" /></fieldset>
        </div>
        <div class="divider text-xs">Cuenta de acceso</div>
        <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Username *</legend>
          <input v-model="formCrear.username" type="text" autocomplete="off" class="input input-bordered w-full" :disabled="creando" /></fieldset>
        <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Contraseña * (mín. 6)</legend>
          <input v-model="formCrear.password" type="password" autocomplete="new-password" class="input input-bordered w-full" :disabled="creando" /></fieldset>
        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="creando" @click="modalCrear = false">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="creando">
            <span v-if="creando" class="loading loading-spinner loading-sm"></span>
            Crear secretaria
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalCrear = false; credenciales = null"><button>cerrar</button></form>
  </dialog>

  <!-- Modal editar -->
  <dialog :open="modalEditar" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">Editar secretaria</h3>
      <div v-if="errorEditar" role="alert" class="alert alert-error mb-4 py-2 text-sm"><span>{{ errorEditar }}</span></div>
      <form class="space-y-3" @submit.prevent="guardarEdicion">
        <div class="grid grid-cols-2 gap-3">
          <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Nombre</legend>
            <input v-model="formEditar.nombre" type="text" class="input input-bordered w-full" :disabled="guardando" /></fieldset>
          <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Apellido</legend>
            <input v-model="formEditar.apellido" type="text" class="input input-bordered w-full" :disabled="guardando" /></fieldset>
        </div>
        <fieldset class="fieldset"><legend class="fieldset-legend text-xs">CI</legend>
          <input v-model="formEditar.ci" type="text" class="input input-bordered w-full" :disabled="guardando" /></fieldset>
        <div class="grid grid-cols-2 gap-3">
          <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Teléfono</legend>
            <input v-model="formEditar.telefono" type="tel" class="input input-bordered w-full" :disabled="guardando" /></fieldset>
          <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Email</legend>
            <input v-model="formEditar.email" type="email" class="input input-bordered w-full" :disabled="guardando" /></fieldset>
        </div>
        <label class="label cursor-pointer justify-start gap-2">
          <input v-model="formEditar.activo" type="checkbox" class="checkbox checkbox-sm" />
          <span class="text-sm">Activo</span>
        </label>
        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="guardando" @click="modalEditar = false">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="guardando">
            <span v-if="guardando" class="loading loading-spinner loading-sm"></span>
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalEditar = false"><button>cerrar</button></form>
  </dialog>
</template>