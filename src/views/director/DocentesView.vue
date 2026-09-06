<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { docenteApi, type DocentePayload } from '@/api/docente.api'
import { usuarioApi, type ConPerfilPayload } from '@/api/usuario.api'
import { useGestionStore } from '@/stores/gestion.store'
import { materiaApi, type Materia } from '@/api/estructura.api'
import type { Docente } from '@/types'

// El gestionStore ya tiene cargados gestionId y los cursos de la gestión
// activa — evita un GET extra solo para el modal de asignación.
const gestion = useGestionStore()

// ─── Estado principal ─────────────────────────────────────────────────────────
const docentes  = ref<Docente[]>([])
const materias  = ref<Materia[]>([])
const cargando  = ref(true)
const error     = ref<string | null>(null)
const busqueda  = ref('')

// ─── Modal crear/editar perfil ────────────────────────────────────────────────
const modalPerfil  = ref(false)
const guardando    = ref(false)
const errorModal   = ref<string | null>(null)
const modoEdicion  = ref(false)
const idEditando   = ref<number | null>(null)

const formVacio = (): DocentePayload => ({
  nombre: '', apellido: '', ci: '', email: '', telefono: '', especialidad: '',
})
const form = ref<DocentePayload>(formVacio())

// ─── Modal crear cuenta (con-perfil) ─────────────────────────────────────────
// 1. "Crear perfil" → solo datos personales, sin acceso al sistema.
// 2. "Crear con cuenta" → perfil + usuario en una transacción (flujo normal).
const modalConCuenta  = ref(false)
const creandoCuenta   = ref(false)
const errorCuenta     = ref<string | null>(null)
const credenciales    = ref<{ username: string; password: string } | null>(null)

const formCuenta = ref({
  ci: '', nombre: '', apellido: '', especialidad: '',
  email: '', telefono: '',
  username: '', password: '',
})

// ─── Modal vincular cuenta existente a un perfil ya registrado ───────────────
// Escenario: el Director creó el perfil del docente (solo datos personales)
// y ahora hay que darle acceso, SIN duplicar su Persona. El flujo real es:
//   1. POST /usuarios — crea la cuenta sola (username+password, roles)
//   2. PUT /usuarios/:id/vincular — la liga al docenteId ya existente
// (createConPerfil NO sirve acá — crearía una Persona nueva.)
const modalVincular      = ref(false)
const vinculando         = ref(false)
const errorVincular      = ref<string | null>(null)
const docenteAVincular   = ref<Docente | null>(null)
const usernameVincular   = ref('')
const passwordVincular   = ref('')

// ─── Modal asignar materia+curso ──────────────────────────────────────────────
const modalAsignacion   = ref(false)
const asignando         = ref(false)
const errorAsignacion   = ref<string | null>(null)
const docenteAsignar    = ref<Docente | null>(null)
const formAsignacion    = ref<{ materiaId: number | ''; cursoId: number | '' }>({
  materiaId: '', cursoId: '',
})

// ─── Carga inicial ────────────────────────────────────────────────────────────
onMounted(async () => {
  await gestion.cargar()
  await Promise.all([cargar(), cargarMaterias()])
})

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

async function cargarMaterias() {
  try {
    materias.value = await materiaApi.getAll()
  } catch {
    // Si falla, las materias quedan vacías — el modal de asignación
    // mostrará un mensaje claro en lugar de una lista vacía sin contexto
  }
}

// ─── Filtro ───────────────────────────────────────────────────────────────────
const docentesFiltrados = computed(() => {
  const q = busqueda.value.toLowerCase().trim()
  if (!q) return docentes.value
  return docentes.value.filter(d =>
    `${d.nombre} ${d.apellido} ${d.ci}`.toLowerCase().includes(q)
  )
})

// ─── Crear/editar perfil ──────────────────────────────────────────────────────
function abrirCrear() {
  modoEdicion.value  = false
  idEditando.value   = null
  form.value         = formVacio()
  errorModal.value   = null
  modalPerfil.value  = true
}

function abrirEditar(d: Docente) {
  modoEdicion.value  = true
  idEditando.value   = d.id
  form.value = {
    nombre:       d.nombre,
    apellido:     d.apellido,
    ci:           d.ci,
    email:        d.email        ?? '',
    telefono:     d.telefono     ?? '',
    especialidad: d.especialidad ?? '',
  }
  errorModal.value  = null
  modalPerfil.value = true
}

async function guardar() {
  if (!form.value.nombre || !form.value.apellido || !form.value.ci) {
    errorModal.value = 'Nombre, apellido y CI son obligatorios'
    return
  }
  guardando.value  = true
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
    modalPerfil.value = false
  } catch (e) {
    errorModal.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    guardando.value = false
  }
}

// ─── Crear docente con cuenta en una sola operación ──────────────────────────
function abrirConCuenta() {
  formCuenta.value  = { ci: '', nombre: '', apellido: '', especialidad: '', email: '', telefono: '', username: '', password: '' }
  errorCuenta.value = null
  credenciales.value = null
  modalConCuenta.value = true
}

async function crearConCuenta() {
  if (!formCuenta.value.ci || !formCuenta.value.nombre ||
      !formCuenta.value.apellido || !formCuenta.value.username || !formCuenta.value.password) {
    errorCuenta.value = 'CI, nombre, apellido, username y contraseña son obligatorios'
    return
  }
  if (formCuenta.value.password.length < 6) {
    errorCuenta.value = 'La contraseña debe tener al menos 6 caracteres'
    return
  }
  creandoCuenta.value = true
  errorCuenta.value   = null
  try {
    // ✅ v6: roles[] + persona (no "perfil") + datosPorRol para lo
    // específico de cada rol (especialidad va ahí, no dentro de persona)
    const payload: ConPerfilPayload = {
      roles:    ['DOCENTE'],
      username: formCuenta.value.username,
      password: formCuenta.value.password,
      persona: {
        ci:       formCuenta.value.ci,
        nombre:   formCuenta.value.nombre,
        apellido: formCuenta.value.apellido,
        email:    formCuenta.value.email    || undefined,
        telefono: formCuenta.value.telefono || undefined,
      },
      datosPorRol: {
        DOCENTE: { especialidad: formCuenta.value.especialidad || undefined },
      },
    }
    const resultado = await usuarioApi.createConPerfil(payload)
    credenciales.value = resultado.credenciales
    await cargar()
  } catch (e) {
    errorCuenta.value = e instanceof Error ? e.message : 'Error al crear docente'
  } finally {
    creandoCuenta.value = false
  }
}

// ─── Vincular cuenta existente a docente sin cuenta ──────────────────────────
function abrirVincular(d: Docente) {
  docenteAVincular.value = d
  usernameVincular.value = ''
  passwordVincular.value = ''
  errorVincular.value    = null
  modalVincular.value    = true
}

async function vincular() {
  if (!usernameVincular.value || !passwordVincular.value) {
    errorVincular.value = 'Username y contraseña son obligatorios'
    return
  }
  if (!docenteAVincular.value) return

  vinculando.value    = true
  errorVincular.value = null
  try {
    // Paso 1: crear la cuenta SOLA (sin persona/perfil — el docente ya existe)
    const usuario = await usuarioApi.create({
      username: usernameVincular.value,
      password: passwordVincular.value,
      roles:    ['DOCENTE'],
    })
    // Paso 2: vincularla al perfil de Docente que ya está registrado
    await usuarioApi.vincularPerfil(usuario.id, { docenteId: docenteAVincular.value.id })
    modalVincular.value = false
    await cargar()
  } catch (e) {
    errorVincular.value = e instanceof Error ? e.message : 'Error al vincular cuenta'
  } finally {
    vinculando.value = false
  }
}

// ─── Asignar materia + curso al docente ───────────────────────────────────────
function abrirAsignacion(d: Docente) {
  docenteAsignar.value   = d
  formAsignacion.value   = { materiaId: '', cursoId: '' }
  errorAsignacion.value  = null
  modalAsignacion.value  = true
}

async function asignar() {
  if (!formAsignacion.value.materiaId || !formAsignacion.value.cursoId) {
    errorAsignacion.value = 'Seleccioná materia y curso'
    return
  }
  if (!docenteAsignar.value || !gestion.gestionId) {
    errorAsignacion.value = 'No hay gestión activa'
    return
  }
  asignando.value       = true
  errorAsignacion.value = null
  try {
    await docenteApi.asignar(docenteAsignar.value.id, {
      materiaId: Number(formAsignacion.value.materiaId),
      cursoId:   Number(formAsignacion.value.cursoId),
      gestionId: gestion.gestionId,
    })
    modalAsignacion.value = false
    await cargar()
  } catch (e) {
    errorAsignacion.value = e instanceof Error ? e.message : 'Error al asignar'
  } finally {
    asignando.value = false
  }
}

// ¿Ya tiene cuenta vinculada? — decide si mostrar el botón "Vincular cuenta"
function tieneCuenta(d: Docente): boolean {
  return !!d.usuario
}
</script>

<template>
  <div class="space-y-4">

    <!-- Encabezado -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <h2 class="text-2xl font-bold flex-1">Docentes</h2>
      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm" @click="abrirCrear">
          + Solo perfil
        </button>
        <button class="btn btn-primary btn-sm" @click="abrirConCuenta">
          + Con cuenta
        </button>
      </div>
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
            <th>Cuenta</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cargando" v-for="i in 5" :key="i">
            <td colspan="6"><div class="skeleton h-4 w-full"></div></td>
          </tr>
          <tr v-else-if="docentesFiltrados.length === 0">
            <td colspan="6" class="text-center text-base-content/40 py-8">
              No se encontraron docentes
            </td>
          </tr>
          <tr v-else v-for="d in docentesFiltrados" :key="d.id" class="hover">
            <td class="font-medium">{{ d.apellido }}, {{ d.nombre }}</td>
            <td class="font-mono text-sm">{{ d.ci }}</td>
            <td class="text-sm">{{ d.especialidad ?? '—' }}</td>
            <td>
              <span v-if="tieneCuenta(d)" class="badge badge-sm badge-success">
                {{ d.usuario?.username }}
              </span>
              <span v-else class="badge badge-sm badge-ghost">Sin cuenta</span>
            </td>
            <td>
              <span class="badge badge-sm" :class="d.activo ? 'badge-success' : 'badge-ghost'">
                {{ d.activo ? 'Activo' : 'Inactivo' }}
              </span>
            </td>
            <td>
              <div class="flex gap-1 flex-wrap">
                <button class="btn btn-ghost btn-xs" @click="abrirEditar(d)">
                  Editar
                </button>
                <button class="btn btn-outline btn-xs btn-info" @click="abrirAsignacion(d)">
                  Asignar
                </button>
                <button
                  v-if="!tieneCuenta(d)"
                  class="btn btn-outline btn-xs btn-warning"
                  @click="abrirVincular(d)"
                >
                  Vincular cuenta
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="!cargando" class="text-xs text-base-content/40">
      {{ docentesFiltrados.length }} docente(s) encontrado(s)
    </p>
  </div>

  <!-- ── Modal crear/editar perfil ───────────────────────────────────────── -->
  <dialog :open="modalPerfil" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">
        {{ modoEdicion ? 'Editar docente' : 'Nuevo docente (solo perfil)' }}
      </h3>
      <p v-if="!modoEdicion" class="text-sm text-base-content/60 mb-4">
        Registra los datos personales. Podés crear la cuenta de acceso después con "Vincular cuenta".
      </p>

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
          <button type="button" class="btn btn-ghost" :disabled="guardando" @click="modalPerfil = false">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="guardando">
            <span v-if="guardando" class="loading loading-spinner loading-sm"></span>
            {{ modoEdicion ? 'Guardar cambios' : 'Crear perfil' }}
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalPerfil = false"><button>cerrar</button></form>
  </dialog>

  <!-- ── Modal crear docente con cuenta ──────────────────────────────────── -->
  <dialog :open="modalConCuenta" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Nuevo docente con cuenta</h3>
      <p class="text-sm text-base-content/60 mb-4">
        Crea el perfil y la cuenta de acceso en una sola operación.
      </p>

      <div v-if="credenciales" class="space-y-4">
        <div role="alert" class="alert alert-success">
          <span>Docente creado correctamente</span>
        </div>
        <div class="bg-base-200 rounded-lg p-4 space-y-2">
          <p class="text-sm font-semibold">Credenciales de acceso:</p>
          <p class="font-mono text-sm">Usuario: <strong>{{ credenciales.username }}</strong></p>
          <p class="font-mono text-sm">Contraseña: <strong>{{ credenciales.password }}</strong></p>
          <p class="text-xs text-base-content/50 mt-2">
            Compartí estas credenciales de forma segura con el docente.
          </p>
        </div>
        <div class="modal-action">
          <button class="btn btn-primary" @click="modalConCuenta = false; credenciales = null">
            Cerrar
          </button>
        </div>
      </div>

      <form v-else class="space-y-3" @submit.prevent="crearConCuenta">
        <div v-if="errorCuenta" role="alert" class="alert alert-error py-2 text-sm">
          <span>{{ errorCuenta }}</span>
        </div>

        <div class="divider text-xs">Datos personales</div>
        <div class="grid grid-cols-2 gap-3">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Nombre *</legend>
            <input v-model="formCuenta.nombre" type="text" class="input input-bordered w-full" :disabled="creandoCuenta" />
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Apellido *</legend>
            <input v-model="formCuenta.apellido" type="text" class="input input-bordered w-full" :disabled="creandoCuenta" />
          </fieldset>
        </div>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">CI *</legend>
          <input v-model="formCuenta.ci" type="text" class="input input-bordered w-full" :disabled="creandoCuenta" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Especialidad</legend>
          <input v-model="formCuenta.especialidad" type="text" class="input input-bordered w-full" :disabled="creandoCuenta" />
        </fieldset>

        <div class="divider text-xs">Cuenta de acceso</div>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Username *</legend>
          <input v-model="formCuenta.username" type="text" autocomplete="off" class="input input-bordered w-full" :disabled="creandoCuenta" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Contraseña * (mín. 6 caracteres)</legend>
          <input v-model="formCuenta.password" type="password" autocomplete="new-password" class="input input-bordered w-full" :disabled="creandoCuenta" />
        </fieldset>

        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="creandoCuenta" @click="modalConCuenta = false">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="creandoCuenta">
            <span v-if="creandoCuenta" class="loading loading-spinner loading-sm"></span>
            Crear docente
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalConCuenta = false; credenciales = null"><button>cerrar</button></form>
  </dialog>

  <!-- ── Modal vincular cuenta existente ─────────────────────────────────── -->
  <dialog :open="modalVincular" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Crear y vincular cuenta</h3>
      <p class="text-sm text-base-content/60 mb-4">
        Para: <strong>{{ docenteAVincular?.nombre }} {{ docenteAVincular?.apellido }}</strong>
      </p>

      <div v-if="errorVincular" role="alert" class="alert alert-error mb-4 py-2 text-sm">
        <span>{{ errorVincular }}</span>
      </div>

      <form class="space-y-3" @submit.prevent="vincular">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Username *</legend>
          <input v-model="usernameVincular" type="text" autocomplete="off" class="input input-bordered w-full" :disabled="vinculando" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Contraseña * (mín. 6 caracteres)</legend>
          <input v-model="passwordVincular" type="password" autocomplete="new-password" class="input input-bordered w-full" :disabled="vinculando" />
        </fieldset>

        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="vinculando" @click="modalVincular = false">Cancelar</button>
          <button type="submit" class="btn btn-warning" :disabled="vinculando">
            <span v-if="vinculando" class="loading loading-spinner loading-sm"></span>
            Crear y vincular
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalVincular = false"><button>cerrar</button></form>
  </dialog>

  <!-- ── Modal asignar materia + curso ───────────────────────────────────── -->
  <dialog :open="modalAsignacion" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Asignar materia y curso</h3>
      <p class="text-sm text-base-content/60 mb-4">
        Docente: <strong>{{ docenteAsignar?.nombre }} {{ docenteAsignar?.apellido }}</strong>
        · Gestión: <strong>{{ gestion.anio }}</strong>
      </p>

      <div v-if="errorAsignacion" role="alert" class="alert alert-error mb-4 py-2 text-sm">
        <span>{{ errorAsignacion }}</span>
      </div>

      <form class="space-y-3" @submit.prevent="asignar">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Materia *</legend>
          <select v-model="formAsignacion.materiaId" class="select select-bordered w-full" :disabled="asignando">
            <option value="" disabled>Seleccionar materia</option>
            <option v-for="m in materias" :key="m.id" :value="m.id">
              {{ m.nombre }} ({{ m.codigo }})
            </option>
          </select>
          <p v-if="materias.length === 0" class="text-xs text-base-content/40 mt-1">
            No hay materias registradas — creálas primero en Estructura.
          </p>
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Curso *</legend>
          <select v-model="formAsignacion.cursoId" class="select select-bordered w-full" :disabled="asignando">
            <option value="" disabled>Seleccionar curso</option>
            <option v-for="c in gestion.cursos" :key="c.id" :value="c.id">
              {{ c.nombre }}
            </option>
          </select>
          <p v-if="gestion.cursos.length === 0" class="text-xs text-base-content/40 mt-1">
            No hay cursos en la gestión activa — creálos primero en Estructura.
          </p>
        </fieldset>

        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="asignando" @click="modalAsignacion = false">Cancelar</button>
          <button type="submit" class="btn btn-info" :disabled="asignando">
            <span v-if="asignando" class="loading loading-spinner loading-xs"></span>
            Asignar
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalAsignacion = false"><button>cerrar</button></form>
  </dialog>
</template>