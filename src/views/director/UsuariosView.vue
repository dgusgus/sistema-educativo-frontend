<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usuarioApi, type Usuario, type UsuarioPayload } from '@/api/usuario.api'
import type { Rol } from '@/types'

const usuarios  = ref<Usuario[]>([])
const cargando  = ref(true)
const error     = ref<string | null>(null)
const busqueda  = ref('')

onMounted(cargar)

async function cargar() {
  cargando.value = true
  error.value = null
  try {
    usuarios.value = await usuarioApi.getAll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar usuarios'
  } finally {
    cargando.value = false
  }
}

const filtrados = computed(() => {
  const q = busqueda.value.toLowerCase().trim()
  if (!q) return usuarios.value
  return usuarios.value.filter(u =>
    u.username.toLowerCase().includes(q) ||
    u.rol.toLowerCase().includes(q) ||
    (u.perfil && `${u.perfil.nombre} ${u.perfil.apellido}`.toLowerCase().includes(q))
  )
})

// ── Modal crear usuario ───────────────────────────────────────────────────────
const modalAbierto = ref(false)
const guardando    = ref(false)
const errorModal   = ref<string | null>(null)
const form = ref<UsuarioPayload>({ username: '', password: '', rol: 'DOCENTE' })

function abrirModal() {
  form.value = { username: '', password: '', rol: 'DOCENTE' }
  errorModal.value = null
  modalAbierto.value = true
}

async function crear() {
  if (!form.value.username || !form.value.password) {
    errorModal.value = 'Usuario y contraseña son obligatorios'
    return
  }
  guardando.value = true
  errorModal.value = null
  try {
    const nuevo = await usuarioApi.create(form.value)
    usuarios.value.unshift(nuevo)
    modalAbierto.value = false
  } catch (e) {
    errorModal.value = e instanceof Error ? e.message : 'Error al crear usuario'
  } finally {
    guardando.value = false
  }
}

// ── Toggle activo ─────────────────────────────────────────────────────────────
const toggling = ref<number | null>(null)

async function toggleActivo(u: Usuario) {
  toggling.value = u.id
  try {
    const actualizado = await usuarioApi.update(u.id, { activo: !u.activo })
    const idx = usuarios.value.findIndex(x => x.id === u.id)
    if (idx !== -1) usuarios.value[idx] = actualizado
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al actualizar'
  } finally {
    toggling.value = null
  }
}

// ── Reset password ────────────────────────────────────────────────────────────
const resetandoId  = ref<number | null>(null)
const nuevaPass    = ref('')
const modalReset   = ref(false)
const errorReset   = ref<string | null>(null)

function abrirReset(id: number) {
  resetandoId.value = id
  nuevaPass.value = ''
  errorReset.value = null
  modalReset.value = true
}

async function confirmarReset() {
  if (!nuevaPass.value || nuevaPass.value.length < 6) {
    errorReset.value = 'Mínimo 6 caracteres'
    return
  }
  try {
    await usuarioApi.resetearPassword(resetandoId.value!, nuevaPass.value)
    modalReset.value = false
  } catch (e) {
    errorReset.value = e instanceof Error ? e.message : 'Error al resetear'
  }
}

const badgeRol: Record<Rol, string> = {
  DIRECTOR:   'badge-primary',
  SECRETARIA: 'badge-secondary',
  DOCENTE:    'badge-accent',
  ESTUDIANTE: 'badge-info',
  TUTOR:      'badge-neutral',
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <h2 class="text-2xl font-bold flex-1">Usuarios del Sistema</h2>
      <button class="btn btn-primary btn-sm" @click="abrirModal">+ Nuevo usuario</button>
    </div>

    <div v-if="error" role="alert" class="alert alert-error">
      <span>{{ error }}</span>
      <button class="btn btn-sm btn-ghost" @click="cargar">Reintentar</button>
    </div>

    <label class="input input-bordered flex items-center gap-2 max-w-sm">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
      </svg>
      <input v-model="busqueda" type="search" placeholder="Buscar usuario, rol o nombre..." class="grow" />
    </label>

    <div class="card bg-base-100 shadow overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr><th>Usuario</th><th>Perfil vinculado</th><th>Rol</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-if="cargando" v-for="i in 5" :key="i">
            <td colspan="5"><div class="skeleton h-4 w-full"></div></td>
          </tr>
          <tr v-else-if="filtrados.length === 0">
            <td colspan="5" class="text-center text-base-content/40 py-8">No se encontraron usuarios</td>
          </tr>
          <tr v-else v-for="u in filtrados" :key="u.id" class="hover" :class="!u.activo ? 'opacity-50' : ''">
            <td class="font-mono font-medium">{{ u.username }}</td>
            <td class="text-sm">
              <span v-if="u.perfil">{{ u.perfil.nombre }} {{ u.perfil.apellido }}</span>
              <span v-else class="text-base-content/40 italic">Sin vincular</span>
            </td>
            <td><span class="badge badge-sm" :class="badgeRol[u.rol]">{{ u.rol }}</span></td>
            <td>
              <input type="checkbox" class="toggle toggle-sm toggle-success"
                :checked="u.activo"
                :disabled="toggling === u.id"
                @change="toggleActivo(u)" />
            </td>
            <td>
              <button class="btn btn-ghost btn-xs" @click="abrirReset(u.id)">
                Reset pass
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="!cargando" class="text-xs text-base-content/40">
      {{ filtrados.length }} usuario(s) — {{ usuarios.filter(u => u.activo).length }} activo(s)
    </p>
  </div>

  <!-- Modal crear usuario -->
  <dialog :open="modalAbierto" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">Nuevo usuario</h3>
      <div v-if="errorModal" role="alert" class="alert alert-error mb-4 py-2 text-sm">
        <span>{{ errorModal }}</span>
      </div>
      <form class="space-y-3" @submit.prevent="crear">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Nombre de usuario *</legend>
          <input v-model="form.username" type="text" placeholder="Ej: doc_garcia"
            class="input input-bordered w-full" :disabled="guardando" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Contraseña * (mín. 6 caracteres)</legend>
          <input v-model="form.password" type="password"
            class="input input-bordered w-full" :disabled="guardando" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Rol *</legend>
          <select v-model="form.rol" class="select select-bordered w-full" :disabled="guardando">
            <option value="DIRECTOR">DIRECTOR</option>
            <option value="SECRETARIA">SECRETARIA</option>
            <option value="DOCENTE">DOCENTE</option>
            <option value="ESTUDIANTE">ESTUDIANTE</option>
            <option value="TUTOR">TUTOR</option>
          </select>
        </fieldset>
        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="guardando" @click="modalAbierto = false">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="guardando">
            <span v-if="guardando" class="loading loading-spinner loading-sm"></span>
            Crear usuario
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalAbierto = false"><button>cerrar</button></form>
  </dialog>

  <!-- Modal reset password -->
  <dialog :open="modalReset" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">Resetear contraseña</h3>
      <div v-if="errorReset" role="alert" class="alert alert-error mb-4 py-2 text-sm">
        <span>{{ errorReset }}</span>
      </div>
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">Nueva contraseña (mín. 6 caracteres)</legend>
        <input v-model="nuevaPass" type="password" class="input input-bordered w-full" />
      </fieldset>
      <div class="modal-action mt-6">
        <button class="btn btn-ghost" @click="modalReset = false">Cancelar</button>
        <button class="btn btn-warning" @click="confirmarReset">Resetear</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalReset = false"><button>cerrar</button></form>
  </dialog>
</template>