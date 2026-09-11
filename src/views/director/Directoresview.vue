<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { directorApi, type DirectorConCuentaPayload } from '@/api/director.api'
import { useToastStore } from '@/stores/toast.store'
import type { Director } from '@/types'

const toast = useToastStore()

const directores = ref<Director[]>([])
const cargando    = ref(true)
const error       = ref<string | null>(null)
const busqueda     = ref('')

onMounted(cargar)

async function cargar() {
  cargando.value = true
  error.value = null
  try {
    directores.value = await directorApi.getAll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar directores'
  } finally {
    cargando.value = false
  }
}

const filtrados = computed(() => {
  const q = busqueda.value.toLowerCase().trim()
  if (!q) return directores.value
  return directores.value.filter(d => `${d.nombre} ${d.apellido} ${d.ci}`.toLowerCase().includes(q))
})

// ─── Crear con cuenta (único flujo posible — Director siempre nace con cuenta) ─
const modalCrear    = ref(false)
const creando        = ref(false)
const errorCrear     = ref<string | null>(null)
const credenciales   = ref<{ username: string; password: string } | null>(null)
const formCrear = ref<DirectorConCuentaPayload>({ ci: '', nombre: '', apellido: '', telefono: '', email: '', username: '', password: '' })

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
    const resultado = await directorApi.crearConCuenta(f)
    credenciales.value = resultado.credenciales
    directores.value.unshift(resultado.director)
  } catch (e) {
    errorCrear.value = e instanceof Error ? e.message : 'Error al crear director'
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

function abrirEditar(d: Director) {
  idEditando.value = d.id
  formEditar.value = { ci: d.ci, nombre: d.nombre, apellido: d.apellido, telefono: d.telefono ?? '', email: d.email ?? '', activo: d.activo }
  errorEditar.value = null
  modalEditar.value = true
}

async function guardarEdicion() {
  if (!idEditando.value) return
  guardando.value = true
  errorEditar.value = null
  try {
    const actualizado = await directorApi.update(idEditando.value, formEditar.value)
    const idx = directores.value.findIndex(d => d.id === idEditando.value)
    if (idx !== -1) directores.value[idx] = { ...directores.value[idx], ...actualizado }
    modalEditar.value = false
    toast.success('Director actualizado')
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
      <h2 class="text-2xl font-bold flex-1">Directores</h2>
      <button class="btn btn-primary btn-sm" @click="abrirCrear">+ Nuevo director</button>
    </div>

    <div v-if="error" role="alert" class="alert alert-error">
      <span>{{ error }}</span>
      <button class="btn btn-sm btn-ghost" @click="cargar">Reintentar</button>
    </div>

    <label class="input input-bordered flex items-center gap-2 max-w-sm">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
      </svg>
      <input v-model="busqueda" type="search" placeholder="Buscar por nombre o CI..." class="grow" />
    </label>

    <div class="card bg-base-100 shadow overflow-x-auto">
      <table class="table table-sm">
        <thead><tr><th>Nombre</th><th>CI</th><th>Cuenta</th><th>Gestiones a cargo</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>
          <tr v-if="cargando" v-for="i in 3" :key="i"><td colspan="6"><div class="skeleton h-4 w-full"></div></td></tr>
          <tr v-else-if="filtrados.length === 0"><td colspan="6" class="text-center text-base-content/40 py-8">No se encontraron directores</td></tr>
          <tr v-else v-for="d in filtrados" :key="d.id" class="hover">
            <td class="font-medium">{{ d.apellido }}, {{ d.nombre }}</td>
            <td class="font-mono text-sm">{{ d.ci }}</td>
            <td><span class="badge badge-sm badge-success font-mono">{{ d.usuario?.username }}</span></td>
            <td class="text-sm">
              <span v-if="d.gestiones?.length">{{ d.gestiones.map(g => g.anio).join(', ') }}</span>
              <span v-else class="text-base-content/30">Ninguna — asignar desde Gestiones</span>
            </td>
            <td><span class="badge badge-sm" :class="d.activo ? 'badge-success' : 'badge-ghost'">{{ d.activo ? 'Activo' : 'Inactivo' }}</span></td>
            <td><button class="btn btn-ghost btn-xs" @click="abrirEditar(d)">Editar</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Modal crear -->
  <dialog :open="modalCrear" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Nuevo director</h3>
      <p class="text-sm text-base-content/60 mb-4">Un director siempre nace con cuenta de acceso.</p>
      <div v-if="credenciales" class="space-y-4">
        <div role="alert" class="alert alert-success"><span>Director creado correctamente</span></div>
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
        <p class="text-xs text-base-content/50">
          Para asignarlo a una gestión, hacelo después desde la pantalla "Gestiones".
        </p>
        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="creando" @click="modalCrear = false">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="creando">
            <span v-if="creando" class="loading loading-spinner loading-sm"></span>
            Crear director
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalCrear = false; credenciales = null"><button>cerrar</button></form>
  </dialog>

  <!-- Modal editar -->
  <dialog :open="modalEditar" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">Editar director</h3>
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