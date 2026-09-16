<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { tutorApi, type TutorPayload } from '@/api/tutor.api'
import { usuarioApi, type ConPerfilPayload } from '@/api/usuario.api'
import { useBuscadorEstudiante } from '@/composables/useBuscadorEstudiante'
import { useConfirm } from '@/composables/useConfirm'
import { useToastStore } from '@/stores/toast.store'
import type { Tutor } from '@/types'

const { confirmar } = useConfirm()
const toast = useToastStore()

const tutores  = ref<Tutor[]>([])
const cargando = ref(true)
const error    = ref<string | null>(null)
const busqueda = ref('')

onMounted(cargar)

async function cargar() {
  cargando.value = true
  error.value = null
  try {
    tutores.value = await tutorApi.getAll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar tutores'
  } finally {
    cargando.value = false
  }
}

const tutoresFiltrados = computed(() => {
  const q = busqueda.value.toLowerCase().trim()
  if (!q) return tutores.value
  return tutores.value.filter(t => `${t.nombre} ${t.apellido} ${t.ci}`.toLowerCase().includes(q))
})

// ─── Crear/editar perfil ──────────────────────────────────────────────────────
const modalPerfil = ref(false)
const guardando   = ref(false)
const errorModal  = ref<string | null>(null)
const modoEdicion = ref(false)
const idEditando  = ref<number | null>(null)

const formVacio = (): TutorPayload => ({ ci: '', nombre: '', apellido: '', telefono: '', email: '', ocupacion: '', gradoInstruccion: '' })
const form = ref<TutorPayload>(formVacio())

function abrirCrear() {
  modoEdicion.value = false
  idEditando.value = null
  form.value = formVacio()
  errorModal.value = null
  modalPerfil.value = true
}

function abrirEditar(t: Tutor) {
  modoEdicion.value = true
  idEditando.value = t.id
  form.value = {
    ci: t.ci, nombre: t.nombre, apellido: t.apellido,
    telefono: t.telefono ?? '', email: t.email ?? '',
    ocupacion: t.ocupacion ?? '', gradoInstruccion: t.gradoInstruccion ?? '',
  }
  errorModal.value = null
  modalPerfil.value = true
}

async function guardar() {
  if (!form.value.nombre || !form.value.apellido || !form.value.ci) {
    errorModal.value = 'Nombre, apellido y CI son obligatorios'
    return
  }
  guardando.value = true
  errorModal.value = null
  try {
    if (modoEdicion.value && idEditando.value) {
      const actualizado = await tutorApi.update(idEditando.value, form.value)
      const idx = tutores.value.findIndex(t => t.id === idEditando.value)
      if (idx !== -1) tutores.value[idx] = { ...tutores.value[idx], ...actualizado }
      toast.success('Tutor actualizado')
    } else {
      const nuevo = await tutorApi.create(form.value)
      tutores.value.unshift(nuevo)
      toast.success('Tutor creado')
    }
    modalPerfil.value = false
  } catch (e) {
    errorModal.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    guardando.value = false
  }
}

// ─── Crear con cuenta ──────────────────────────────────────────────────────────
const modalConCuenta = ref(false)
const creandoCuenta  = ref(false)
const errorCuenta    = ref<string | null>(null)
const credenciales   = ref<{ username: string; password: string } | null>(null)
const formCuenta = ref({ ci: '', nombre: '', apellido: '', telefono: '', email: '', ocupacion: '', gradoInstruccion: '', username: '', password: '' })

function abrirConCuenta() {
  formCuenta.value = { ci: '', nombre: '', apellido: '', telefono: '', email: '', ocupacion: '', gradoInstruccion: '', username: '', password: '' }
  errorCuenta.value = null
  credenciales.value = null
  modalConCuenta.value = true
}

async function crearConCuenta() {
  const f = formCuenta.value
  if (!f.ci || !f.nombre || !f.apellido || !f.username || !f.password) {
    errorCuenta.value = 'CI, nombre, apellido, username y contraseña son obligatorios'
    return
  }
  if (f.password.length < 6) { errorCuenta.value = 'La contraseña debe tener al menos 6 caracteres'; return }
  creandoCuenta.value = true
  errorCuenta.value = null
  try {
    const payload: ConPerfilPayload = {
      roles: ['TUTOR'], username: f.username, password: f.password,
      persona: { ci: f.ci, nombre: f.nombre, apellido: f.apellido, telefono: f.telefono || undefined, email: f.email || undefined },
      datosPorRol: { TUTOR: { ocupacion: f.ocupacion || undefined, gradoInstruccion: f.gradoInstruccion || undefined } },
    }
    const resultado = await usuarioApi.createConPerfil(payload)
    credenciales.value = resultado.credenciales
    const perfil = resultado.perfiles.TUTOR
    if (perfil) {
      tutores.value.unshift({
        id: perfil.id, ci: resultado.persona.ci, nombre: resultado.persona.nombre, apellido: resultado.persona.apellido,
        telefono: resultado.persona.telefono ?? null, email: resultado.persona.email ?? null,
        ocupacion: (perfil as { ocupacion?: string }).ocupacion ?? null,
        gradoInstruccion: (perfil as { gradoInstruccion?: string }).gradoInstruccion ?? null,
        usuario: { id: resultado.usuario.id, username: resultado.usuario.username, activo: true },
        estudiantes: [],
      })
    }
  } catch (e) {
    errorCuenta.value = e instanceof Error ? e.message : 'Error al crear tutor'
  } finally {
    creandoCuenta.value = false
  }
}

// ─── Vincular cuenta existente ────────────────────────────────────────────────
const modalVincularCuenta = ref(false)
const vinculandoCuenta    = ref(false)
const errorVincularCuenta = ref<string | null>(null)
const tutorAVincular      = ref<Tutor | null>(null)
const usernameVincular    = ref('')
const passwordVincular    = ref('')

function abrirVincularCuenta(t: Tutor) {
  tutorAVincular.value = t
  usernameVincular.value = ''
  passwordVincular.value = ''
  errorVincularCuenta.value = null
  modalVincularCuenta.value = true
}

async function vincularCuenta() {
  if (!usernameVincular.value || !passwordVincular.value) {
    errorVincularCuenta.value = 'Username y contraseña son obligatorios'
    return
  }
  if (!tutorAVincular.value) return
  vinculandoCuenta.value = true
  errorVincularCuenta.value = null
  try {
    const usuario = await usuarioApi.create({ username: usernameVincular.value, password: passwordVincular.value, roles: ['TUTOR'] })
    await usuarioApi.vincularPerfil(usuario.id, { tutorId: tutorAVincular.value.id })
    const idx = tutores.value.findIndex(t => t.id === tutorAVincular.value!.id)
    if (idx !== -1) tutores.value[idx] = { ...tutores.value[idx], usuario: { id: usuario.id, username: usuario.username, activo: true } }
    modalVincularCuenta.value = false
    toast.success('Cuenta vinculada correctamente')
  } catch (e) {
    errorVincularCuenta.value = e instanceof Error ? e.message : 'Error al vincular cuenta'
  } finally {
    vinculandoCuenta.value = false
  }
}

// ─── Vincular / desvincular estudiante ───────────────────────────────────────
const modalVincularEst = ref(false)
const vinculandoEst    = ref(false)
const errorVincularEst = ref<string | null>(null)
const tutorParaVincularEst = ref<Tutor | null>(null)
const buscador = useBuscadorEstudiante()
const formVinculo = ref({ parentesco: '', esTutorPrincipal: false, esApoderado: false, viveConEstudiante: true })

function abrirVincularEstudiante(t: Tutor) {
  tutorParaVincularEst.value = t
  buscador.limpiar()
  formVinculo.value = { parentesco: '', esTutorPrincipal: false, esApoderado: false, viveConEstudiante: true }
  errorVincularEst.value = null
  modalVincularEst.value = true
}

async function vincularEstudiante() {
  if (!buscador.seleccionado.value) { errorVincularEst.value = 'Buscá y seleccioná un estudiante'; return }
  if (!formVinculo.value.parentesco.trim()) { errorVincularEst.value = 'El parentesco es obligatorio'; return }
  if (!tutorParaVincularEst.value) return
  vinculandoEst.value = true
  errorVincularEst.value = null
  try {
    await tutorApi.vincularEstudiante(tutorParaVincularEst.value.id, buscador.seleccionado.value.id, {
      parentesco: formVinculo.value.parentesco.trim(),
      esTutorPrincipal: formVinculo.value.esTutorPrincipal,
      esApoderado: formVinculo.value.esApoderado,
      viveConEstudiante: formVinculo.value.viveConEstudiante,
    })
    modalVincularEst.value = false
    toast.success('Estudiante vinculado')
    await cargar()
  } catch (e) {
    errorVincularEst.value = e instanceof Error ? e.message : 'Error al vincular'
  } finally {
    vinculandoEst.value = false
  }
}

async function desvincular(t: Tutor, estudianteId: number) {
  const ok = await confirmar({ mensaje: '¿Desvincular a este estudiante del tutor?', peligroso: true })
  if (!ok) return
  try {
    await tutorApi.desvincularEstudiante(t.id, estudianteId)
    toast.success('Estudiante desvinculado')
    await cargar()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al desvincular'
  }
}

// ─── Activar / desactivar cuenta ──────────────────────────────────────────────
const toggeandoActivo = ref<number | null>(null)

async function toggleActivoCuenta(t: Tutor) {
  if (!t.usuario) return
  toggeandoActivo.value = t.usuario.id
  try {
    const estadoActual = t.usuario.activo ?? true
    await usuarioApi.update(t.usuario.id, { activo: !estadoActual })
    t.usuario.activo = !estadoActual
    toast.success(estadoActual ? 'Cuenta desactivada' : 'Cuenta activada')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cambiar estado de la cuenta'
  } finally {
    toggeandoActivo.value = null
  }
}

// ─── Resetear contraseña ──────────────────────────────────────────────────────
const modalReset    = ref(false)
const reseteando    = ref(false)
const errorReset    = ref<string | null>(null)
const nuevaPassword = ref('')
const tutorAResetear = ref<Tutor | null>(null)

function abrirReset(t: Tutor) {
  tutorAResetear.value = t
  nuevaPassword.value = ''
  errorReset.value = null
  modalReset.value = true
}

async function resetearPassword() {
  if (nuevaPassword.value.length < 6) {
    errorReset.value = 'La contraseña debe tener al menos 6 caracteres'
    return
  }
  if (!tutorAResetear.value?.usuario?.id) return
  reseteando.value = true
  errorReset.value = null
  try {
    await usuarioApi.resetearPassword(tutorAResetear.value.usuario.id, nuevaPassword.value)
    modalReset.value = false
    toast.success('Contraseña reseteada correctamente')
  } catch (e) {
    errorReset.value = e instanceof Error ? e.message : 'Error al resetear'
  } finally {
    reseteando.value = false
  }
}
</script>

<template>
  <div class="space-y-4">

    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <h2 class="text-2xl font-bold flex-1">Tutores</h2>
      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm" @click="abrirCrear">+ Solo perfil</button>
        <button class="btn btn-primary btn-sm" @click="abrirConCuenta">+ Con cuenta</button>
      </div>
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
        <thead>
          <tr><th>Nombre</th><th>CI</th><th>Ocupación</th><th>Estudiantes vinculados</th><th>Cuenta</th><th>Acciones</th></tr>
        </thead>
        <tbody>
          <tr v-if="cargando" v-for="i in 5" :key="i">
            <td colspan="6"><div class="skeleton h-4 w-full"></div></td>
          </tr>
          <tr v-else-if="tutoresFiltrados.length === 0">
            <td colspan="6" class="text-center text-base-content/40 py-8">No se encontraron tutores</td>
          </tr>
          <tr v-else v-for="t in tutoresFiltrados" :key="t.id" class="hover">
            <td class="font-medium">{{ t.apellido }}, {{ t.nombre }}</td>
            <td class="font-mono text-sm">{{ t.ci }}</td>
            <td class="text-sm">{{ t.ocupacion ?? '—' }}</td>
            <td>
              <div class="flex flex-wrap gap-1">
                <span v-for="v in t.estudiantes" :key="v.estudiante?.id" class="badge badge-sm badge-outline gap-1">
                  {{ v.estudiante?.nombre }} {{ v.estudiante?.apellido }} ({{ v.parentesco }})
                  <button class="text-error" @click="desvincular(t, v.estudiante!.id)">✕</button>
                </span>
                <span v-if="!t.estudiantes?.length" class="text-xs text-base-content/30">Ninguno</span>
              </div>
            </td>
            <td>
              <div v-if="t.usuario" class="flex items-center gap-2">
                <span class="badge badge-sm badge-success font-mono">{{ t.usuario.username }}</span>
                <input
                  type="checkbox"
                  class="toggle toggle-xs toggle-success"
                  :checked="t.usuario.activo ?? true"
                  :disabled="toggeandoActivo === t.usuario.id"
                  @change="toggleActivoCuenta(t)"
                  :title="(t.usuario.activo ?? true) ? 'Desactivar cuenta' : 'Activar cuenta'"
                />
              </div>
              <span v-else class="badge badge-sm badge-ghost">Sin cuenta</span>
            </td>
            <td>
              <div class="flex gap-1 flex-wrap">
                <button class="btn btn-ghost btn-xs" @click="abrirEditar(t)">Editar</button>
                <button class="btn btn-outline btn-xs btn-info" @click="abrirVincularEstudiante(t)">+ Estudiante</button>
                <button v-if="!t.usuario" class="btn btn-outline btn-xs btn-warning" @click="abrirVincularCuenta(t)">Vincular cuenta</button>
                <button v-if="t.usuario" class="btn btn-ghost btn-xs" @click="abrirReset(t)">Reset pass</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="!cargando" class="text-xs text-base-content/40">{{ tutoresFiltrados.length }} tutor(es) encontrado(s)</p>
  </div>

  <!-- Modal crear/editar perfil -->
  <dialog :open="modalPerfil" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">{{ modoEdicion ? 'Editar tutor' : 'Nuevo tutor (solo perfil)' }}</h3>
      <div v-if="errorModal" role="alert" class="alert alert-error mb-4 py-2 text-sm"><span>{{ errorModal }}</span></div>
      <form class="space-y-3" @submit.prevent="guardar">
        <div class="grid grid-cols-2 gap-3">
          <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Nombre *</legend>
            <input v-model="form.nombre" type="text" class="input input-bordered w-full" :disabled="guardando" /></fieldset>
          <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Apellido *</legend>
            <input v-model="form.apellido" type="text" class="input input-bordered w-full" :disabled="guardando" /></fieldset>
        </div>
        <fieldset class="fieldset"><legend class="fieldset-legend text-xs">CI *</legend>
          <input v-model="form.ci" type="text" class="input input-bordered w-full" :disabled="guardando" /></fieldset>
        <div class="grid grid-cols-2 gap-3">
          <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Ocupación</legend>
            <input v-model="form.ocupacion" type="text" class="input input-bordered w-full" :disabled="guardando" /></fieldset>
          <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Grado de instrucción</legend>
            <input v-model="form.gradoInstruccion" type="text" class="input input-bordered w-full" :disabled="guardando" /></fieldset>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Teléfono</legend>
            <input v-model="form.telefono" type="tel" class="input input-bordered w-full" :disabled="guardando" /></fieldset>
          <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Email</legend>
            <input v-model="form.email" type="email" class="input input-bordered w-full" :disabled="guardando" /></fieldset>
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

  <!-- Modal crear con cuenta -->
  <dialog :open="modalConCuenta" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Nuevo tutor con cuenta</h3>
      <div v-if="credenciales" class="space-y-4">
        <div role="alert" class="alert alert-success"><span>Tutor creado correctamente</span></div>
        <div class="bg-base-200 rounded-lg p-4 space-y-2">
          <p class="font-mono text-sm">Usuario: <strong>{{ credenciales.username }}</strong></p>
          <p class="font-mono text-sm">Contraseña: <strong>{{ credenciales.password }}</strong></p>
        </div>
        <div class="modal-action"><button class="btn btn-primary" @click="modalConCuenta = false; credenciales = null">Cerrar</button></div>
      </div>
      <form v-else class="space-y-3" @submit.prevent="crearConCuenta">
        <div v-if="errorCuenta" role="alert" class="alert alert-error py-2 text-sm"><span>{{ errorCuenta }}</span></div>
        <div class="divider text-xs">Datos personales</div>
        <div class="grid grid-cols-2 gap-3">
          <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Nombre *</legend>
            <input v-model="formCuenta.nombre" type="text" class="input input-bordered w-full" :disabled="creandoCuenta" /></fieldset>
          <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Apellido *</legend>
            <input v-model="formCuenta.apellido" type="text" class="input input-bordered w-full" :disabled="creandoCuenta" /></fieldset>
        </div>
        <fieldset class="fieldset"><legend class="fieldset-legend text-xs">CI *</legend>
          <input v-model="formCuenta.ci" type="text" class="input input-bordered w-full" :disabled="creandoCuenta" /></fieldset>
        <div class="grid grid-cols-2 gap-3">
          <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Ocupación</legend>
            <input v-model="formCuenta.ocupacion" type="text" class="input input-bordered w-full" :disabled="creandoCuenta" /></fieldset>
          <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Grado de instrucción</legend>
            <input v-model="formCuenta.gradoInstruccion" type="text" class="input input-bordered w-full" :disabled="creandoCuenta" /></fieldset>
        </div>
        <div class="divider text-xs">Cuenta de acceso</div>
        <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Username *</legend>
          <input v-model="formCuenta.username" type="text" autocomplete="off" class="input input-bordered w-full" :disabled="creandoCuenta" /></fieldset>
        <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Contraseña * (mín. 6)</legend>
          <input v-model="formCuenta.password" type="password" autocomplete="new-password" class="input input-bordered w-full" :disabled="creandoCuenta" /></fieldset>
        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="creandoCuenta" @click="modalConCuenta = false">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="creandoCuenta">
            <span v-if="creandoCuenta" class="loading loading-spinner loading-sm"></span>
            Crear tutor
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalConCuenta = false; credenciales = null"><button>cerrar</button></form>
  </dialog>

  <!-- Modal vincular cuenta -->
  <dialog :open="modalVincularCuenta" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Crear y vincular cuenta</h3>
      <p class="text-sm text-base-content/60 mb-4">Para: <strong>{{ tutorAVincular?.nombre }} {{ tutorAVincular?.apellido }}</strong></p>
      <div v-if="errorVincularCuenta" role="alert" class="alert alert-error mb-4 py-2 text-sm"><span>{{ errorVincularCuenta }}</span></div>
      <form class="space-y-3" @submit.prevent="vincularCuenta">
        <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Username *</legend>
          <input v-model="usernameVincular" type="text" autocomplete="off" class="input input-bordered w-full" :disabled="vinculandoCuenta" /></fieldset>
        <fieldset class="fieldset"><legend class="fieldset-legend text-xs">Contraseña * (mín. 6)</legend>
          <input v-model="passwordVincular" type="password" autocomplete="new-password" class="input input-bordered w-full" :disabled="vinculandoCuenta" /></fieldset>
        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="vinculandoCuenta" @click="modalVincularCuenta = false">Cancelar</button>
          <button type="submit" class="btn btn-warning" :disabled="vinculandoCuenta">
            <span v-if="vinculandoCuenta" class="loading loading-spinner loading-sm"></span>
            Crear y vincular
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalVincularCuenta = false"><button>cerrar</button></form>
  </dialog>

  <!-- Modal vincular estudiante -->
  <dialog :open="modalVincularEst" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Vincular estudiante</h3>
      <p class="text-sm text-base-content/60 mb-4">Tutor: <strong>{{ tutorParaVincularEst?.nombre }} {{ tutorParaVincularEst?.apellido }}</strong></p>
      <div v-if="errorVincularEst" role="alert" class="alert alert-error mb-4 py-2 text-sm"><span>{{ errorVincularEst }}</span></div>
      <form class="space-y-3" @submit.prevent="vincularEstudiante">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Estudiante *</legend>
          <div class="relative">
            <input v-model="buscador.query.value" type="search" placeholder="Nombre o CI..."
              class="input input-bordered w-full" @input="buscador.onInput" />
            <ul v-if="buscador.resultados.value.length"
              class="absolute z-10 mt-1 w-full bg-base-100 rounded-box shadow-lg border border-base-300 max-h-48 overflow-y-auto">
              <li v-for="e in buscador.resultados.value" :key="e.id">
                <button type="button" class="w-full text-left px-4 py-2 hover:bg-base-200" @click="buscador.seleccionar(e)">
                  {{ e.apellido }}, {{ e.nombre }} <span class="text-xs text-base-content/40">{{ e.ci }}</span>
                </button>
              </li>
            </ul>
          </div>
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Parentesco *</legend>
          <input v-model="formVinculo.parentesco" type="text" placeholder="Ej: Madre, Padre, Tío/a, Abuelo/a" class="input input-bordered w-full" :disabled="vinculandoEst" />
        </fieldset>
        <div class="flex flex-col gap-1">
          <label class="label cursor-pointer justify-start gap-2">
            <input v-model="formVinculo.esTutorPrincipal" type="checkbox" class="checkbox checkbox-sm" />
            <span class="text-xs">Es tutor principal</span>
          </label>
          <label class="label cursor-pointer justify-start gap-2">
            <input v-model="formVinculo.esApoderado" type="checkbox" class="checkbox checkbox-sm" />
            <span class="text-xs">Es apoderado</span>
          </label>
          <label class="label cursor-pointer justify-start gap-2">
            <input v-model="formVinculo.viveConEstudiante" type="checkbox" class="checkbox checkbox-sm" />
            <span class="text-xs">Vive con el estudiante</span>
          </label>
        </div>
        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="vinculandoEst" @click="modalVincularEst = false">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="vinculandoEst || !buscador.seleccionado.value">
            <span v-if="vinculandoEst" class="loading loading-spinner loading-sm"></span>
            Vincular
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalVincularEst = false"><button>cerrar</button></form>
  </dialog>

  <!-- ── Modal resetear contraseña ────────────────────────────────────────── -->
  <dialog :open="modalReset" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Resetear contraseña</h3>
      <p class="text-sm text-base-content/60 mb-4">
        {{ tutorAResetear?.nombre }} {{ tutorAResetear?.apellido }}
        · <span class="font-mono">{{ tutorAResetear?.usuario?.username }}</span>
      </p>
      <div v-if="errorReset" role="alert" class="alert alert-error mb-4 py-2 text-sm"><span>{{ errorReset }}</span></div>
      <form class="space-y-3" @submit.prevent="resetearPassword">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Nueva contraseña * (mín. 6 caracteres)</legend>
          <input v-model="nuevaPassword" type="password" autocomplete="new-password" class="input input-bordered w-full" :disabled="reseteando" />
        </fieldset>
        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="reseteando" @click="modalReset = false">Cancelar</button>
          <button type="submit" class="btn btn-warning" :disabled="reseteando">
            <span v-if="reseteando" class="loading loading-spinner loading-sm"></span>
            Resetear
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalReset = false"><button>cerrar</button></form>
  </dialog>
</template>