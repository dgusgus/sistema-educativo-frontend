<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { docenteApi, type DocentePayload } from '@/api/docente.api'
import type { Docente } from '@/types'

// ── Estado principal ──────────────────────────────────────────────────────────
const docentes  = ref<Docente[]>([])
const cargando  = ref(true)
const error     = ref<string | null>(null)
const busqueda  = ref('')

// ── Modal ─────────────────────────────────────────────────────────────────────
const modalAbierto = ref(false)
const guardando    = ref(false)
const errorModal   = ref<string | null>(null)
const modoEdicion  = ref(false)
const idEditando   = ref<number | null>(null)

const formVacio = (): DocentePayload => ({
  nombre: '', apellido: '', ci: '', email: '', telefono: '', especialidad: '',
})
const form = ref<DocentePayload>(formVacio())

// ── Carga inicial ─────────────────────────────────────────────────────────────
onMounted(cargar)

async function cargar() {
  cargando.value = true
  error.value = null
  try {
    docentes.value = await docenteApi.getAll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar docentes'
  } finally {
    cargando.value = false
  }
}

// ── Filtro local por búsqueda ─────────────────────────────────────────────────
const docentesFiltrados = computed(() => {
  const q = busqueda.value.toLowerCase().trim()
  if (!q) return docentes.value
  return docentes.value.filter(d =>
    `${d.nombre} ${d.apellido} ${d.ci}`.toLowerCase().includes(q)
  )
})

// ── Abrir modal ───────────────────────────────────────────────────────────────
function abrirCrear() {
  modoEdicion.value = false
  idEditando.value = null
  form.value = formVacio()
  errorModal.value = null
  modalAbierto.value = true
}

function abrirEditar(d: Docente) {
  modoEdicion.value = true
  idEditando.value = d.id
  form.value = { nombre: d.nombre, apellido: d.apellido, ci: d.ci,
    email: d.email ?? '', telefono: d.telefono ?? '', especialidad: d.especialidad ?? '' }
  errorModal.value = null
  modalAbierto.value = true
}

// ── Guardar ───────────────────────────────────────────────────────────────────
async function guardar() {
  if (!form.value.nombre || !form.value.apellido || !form.value.ci) {
    errorModal.value = 'Nombre, apellido y CI son obligatorios'
    return
  }
  guardando.value = true
  errorModal.value = null
  try {
    if (modoEdicion.value && idEditando.value) {
      const actualizado = await docenteApi.update(idEditando.value, form.value)
      const idx = docentes.value.findIndex(d => d.id === idEditando.value)
      if (idx !== -1) docentes.value[idx] = actualizado
    } else {
      const nuevo = await docenteApi.create(form.value)
      docentes.value.unshift(nuevo)
    }
    modalAbierto.value = false
  } catch (e) {
    errorModal.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div class="space-y-4">

    <!-- Encabezado -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <h2 class="text-2xl font-bold flex-1">Docentes</h2>
      <button class="btn btn-primary btn-sm" @click="abrirCrear">
        + Nuevo docente
      </button>
    </div>

    <!-- Error global -->
    <div v-if="error" role="alert" class="alert alert-error">
      <span>{{ error }}</span>
      <button class="btn btn-sm btn-ghost" @click="cargar">Reintentar</button>
    </div>

    <!-- Buscador -->
    <label class="input input-bordered flex items-center gap-2 max-w-sm">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
      </svg>
      <input v-model="busqueda" type="search" placeholder="Buscar por nombre o CI..." class="grow" />
    </label>

    <!-- Tabla -->
    <div class="card bg-base-100 shadow overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>CI</th>
            <th>Especialidad</th>
            <th>Contacto</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <!-- Skeleton -->
          <tr v-if="cargando" v-for="i in 5" :key="i">
            <td colspan="6"><div class="skeleton h-4 w-full"></div></td>
          </tr>
          <!-- Sin resultados -->
          <tr v-else-if="docentesFiltrados.length === 0">
            <td colspan="6" class="text-center text-base-content/40 py-8">
              No se encontraron docentes
            </td>
          </tr>
          <!-- Filas -->
          <tr v-else v-for="d in docentesFiltrados" :key="d.id" class="hover">
            <td class="font-medium">{{ d.nombre }} {{ d.apellido }}</td>
            <td class="font-mono text-sm">{{ d.ci }}</td>
            <td>{{ d.especialidad ?? '—' }}</td>
            <td class="text-sm text-base-content/60">{{ d.email ?? d.telefono ?? '—' }}</td>
            <td>
              <span class="badge badge-sm" :class="d.activo ? 'badge-success' : 'badge-ghost'">
                {{ d.activo ? 'Activo' : 'Inactivo' }}
              </span>
            </td>
            <td>
              <button class="btn btn-ghost btn-xs" @click="abrirEditar(d)">Editar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Contador -->
    <p v-if="!cargando" class="text-xs text-base-content/40">
      {{ docentesFiltrados.length }} docente(s) encontrado(s)
    </p>

  </div>

  <!-- ── Modal crear/editar ───────────────────────────────────────────────── -->
  <dialog :open="modalAbierto" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">
        {{ modoEdicion ? 'Editar docente' : 'Nuevo docente' }}
      </h3>

      <div v-if="errorModal" role="alert" class="alert alert-error mb-4 py-2 text-sm">
        <span>{{ errorModal }}</span>
      </div>

      <form class="space-y-3" @submit.prevent="guardar">
        <div class="grid grid-cols-2 gap-3">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Nombre *</legend>
            <input v-model="form.nombre" type="text" class="input input-bordered w-full" :disabled="guardando" />
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Apellido *</legend>
            <input v-model="form.apellido" type="text" class="input input-bordered w-full" :disabled="guardando" />
          </fieldset>
        </div>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">CI *</legend>
          <input v-model="form.ci" type="text" class="input input-bordered w-full" :disabled="guardando" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Especialidad</legend>
          <input v-model="form.especialidad" type="text" placeholder="Ej: Matemáticas" class="input input-bordered w-full" :disabled="guardando" />
        </fieldset>
        <div class="grid grid-cols-2 gap-3">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Email</legend>
            <input v-model="form.email" type="email" class="input input-bordered w-full" :disabled="guardando" />
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Teléfono</legend>
            <input v-model="form.telefono" type="tel" class="input input-bordered w-full" :disabled="guardando" />
          </fieldset>
        </div>

        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="guardando" @click="modalAbierto = false">
            Cancelar
          </button>
          <button type="submit" class="btn btn-primary" :disabled="guardando">
            <span v-if="guardando" class="loading loading-spinner loading-sm"></span>
            {{ modoEdicion ? 'Guardar cambios' : 'Crear docente' }}
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalAbierto = false">
      <button>cerrar</button>
    </form>
  </dialog>
</template>