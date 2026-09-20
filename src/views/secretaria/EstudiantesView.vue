<script setup lang="ts">
/**
 * EstudiantesView — fusiona lo que antes eran EstudiantesView +
 * InscripcionesView. El estudiante es el centro; inscribir, cambiar
 * estado, registrar resultado y gestionar la cuenta son ACCIONES sobre
 * el estudiante, no módulos aparte (mismo criterio que "Asignar" en
 * DocentesView). También reemplaza a la pestaña "Estudiantes" de
 * UsuariosView — acá se crea/vincula/resetea la cuenta directamente.
 */
import { ref, computed, onMounted } from 'vue'
import { estudianteApi, type EstudiantePayload, type CambiarEstadoPayload } from '@/api/estudiante.api'
import { usuarioApi, type ConPerfilPayload } from '@/api/usuario.api'
import { useGestionStore } from '@/stores/gestion.store'
import { useConfirm } from '@/composables/useConfirm'
import { useToastStore } from '@/stores/toast.store'
import type { Estudiante, Inscripcion, EstadoInscripcion, ResultadoFinal, Nivel } from '@/types'
import StatusBadge from '@/components/StatusBadge.vue'

const gestion = useGestionStore()
const { confirmar } = useConfirm()
const toast = useToastStore()

// ─── Estado principal ─────────────────────────────────────────────────────────
const estudiantes = ref<Estudiante[]>([])
const cargando    = ref(true)
const error       = ref<string | null>(null)
const busqueda    = ref('')
const filtroCurso  = ref<number | ''>('')
const filtroEstado = ref<EstadoInscripcion | ''>('')
// ⚠️ Antes se mandaba gestionId SIEMPRE — eso hacía que, al activar una
// gestión nueva (sin inscripciones todavía), la lista completa de
// estudiantes desapareciera. El Estudiante es un registro PERMANENTE,
// separado de la Inscripcion (que sí es por gestión) — por defecto se
// muestran TODOS los estudiantes existan o no inscripciones este año.
// Este checkbox es opcional, para cuando sí querés acotar a "quién está
// inscrito este año en particular".
const soloGestionActiva = ref(false)

let cargaSeq = 0   // guard anti-carrera, mismo patrón que DocentesView

onMounted(async () => {
  await gestion.cargar()
  await cargar()
})

async function cargar() {
  const miTurno = ++cargaSeq
  cargando.value = true
  error.value = null
  try {
    const lista = await estudianteApi.getAll({
      ...(soloGestionActiva.value && { gestionId: gestion.gestionId ?? undefined }),
      ...(filtroEstado.value && { estadoInscripcion: filtroEstado.value }),
      ...(filtroCurso.value  && { cursoId: Number(filtroCurso.value) }),
    })
    if (miTurno !== cargaSeq) return
    estudiantes.value = lista
  } catch (e) {
    if (miTurno !== cargaSeq) return
    error.value = e instanceof Error ? e.message : 'Error al cargar estudiantes'
  } finally {
    if (miTurno === cargaSeq) cargando.value = false
  }
}

const estudiantesFiltrados = computed(() => {
  const q = busqueda.value.toLowerCase().trim()
  if (!q) return estudiantes.value
  return estudiantes.value.filter(e =>
    `${e.nombre} ${e.apellido} ${e.ci}`.toLowerCase().includes(q)
  )
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ultimaInscripcion(e: Estudiante): Inscripcion | null {
  return e.inscripciones?.[0] ?? null
}

// ¿Ya tiene inscripción EN LA GESTIÓN ACTIVA? Si no, corresponde inscribir;
// si sí, las acciones son sobre esa inscripción (estado/resultado).
function inscritoEnGestionActiva(e: Estudiante): boolean {
  const insc = ultimaInscripcion(e)
  return !!insc && insc.gestionId === gestion.gestionId
}


// ⚠️ el curso embebido en Estudiante.inscripciones no trae "nombre"
// calculado — solo nivel/grado/paralelo (sin turno).
const NIVEL_TEXTO: Record<Nivel, string> = { PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
function nombreCursoDeInscripcion(insc: Inscripcion | null): string {
  const c = insc?.curso
  if (!c) return '—'
  return `${c.grado}° ${NIVEL_TEXTO[c.nivel]} "${c.paralelo}"`
}

// ─── Crear / editar perfil ─────────────────────────────────────────────────────
const modalPerfil = ref(false)
const guardando   = ref(false)
const errorModal  = ref<string | null>(null)
const modoEdicion = ref(false)
const idEditando  = ref<number | null>(null)

const formVacio = (): EstudiantePayload => ({ nombre: '', apellido: '', ci: '', fechaNacimiento: '', direccion: '' })
const form = ref<EstudiantePayload>(formVacio())

function abrirCrear() {
  modoEdicion.value = false
  idEditando.value  = null
  form.value        = formVacio()
  errorModal.value  = null
  modalPerfil.value = true
}

function abrirEditar(e: Estudiante) {
  modoEdicion.value = true
  idEditando.value  = e.id
  form.value = {
    nombre: e.nombre, apellido: e.apellido, ci: e.ci,
    fechaNacimiento: e.fechaNacimiento ?? '', direccion: e.direccion ?? '',
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
      const actualizado = await estudianteApi.update(idEditando.value, form.value)
      const idx = estudiantes.value.findIndex(e => e.id === idEditando.value)
      if (idx !== -1) estudiantes.value[idx] = { ...estudiantes.value[idx], ...actualizado }
      toast.success('Estudiante actualizado')
    } else {
      const nuevo = await estudianteApi.create(form.value)
      estudiantes.value.unshift(nuevo)
      toast.success('Estudiante creado')
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

const formCuenta = ref({
  ci: '', nombre: '', apellido: '', fechaNacimiento: '', direccion: '', rude: '',
  username: '', password: '',
})

function abrirConCuenta() {
  formCuenta.value = { ci: '', nombre: '', apellido: '', fechaNacimiento: '', direccion: '', rude: '', username: '', password: '' }
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
  errorCuenta.value   = null
  try {
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
    const resultado = await usuarioApi.createConPerfil(payload)
    credenciales.value = resultado.credenciales

    // Igual que en DocentesView: se arma el registro con lo que el
    // backend YA confirmó, sin recargar toda la lista (evita la
    // condición de carrera que tuvimos con Docentes).
    const perfil = resultado.perfiles.ESTUDIANTE
    if (perfil) {
      estudiantes.value.unshift({
        id: perfil.id, ci: resultado.persona.ci, nombre: resultado.persona.nombre,
        apellido: resultado.persona.apellido, fechaNacimiento: resultado.persona.fechaNacimiento ?? null,
        direccion: resultado.persona.direccion ?? null, rude: (perfil as { rude?: string }).rude ?? null,
        activo: true, usuario: { id: resultado.usuario.id, username: resultado.usuario.username, activo: true },
        inscripciones: [], tutores: [],
      })
    }
  } catch (e) {
    errorCuenta.value = e instanceof Error ? e.message : 'Error al crear estudiante'
  } finally {
    creandoCuenta.value = false
  }
}

// ─── Vincular cuenta existente ────────────────────────────────────────────────
const modalVincular    = ref(false)
const vinculando       = ref(false)
const errorVincular    = ref<string | null>(null)
const estudianteAVincular = ref<Estudiante | null>(null)
const usernameVincular = ref('')
const passwordVincular = ref('')

function abrirVincular(e: Estudiante) {
  estudianteAVincular.value = e
  usernameVincular.value = ''
  passwordVincular.value = ''
  errorVincular.value = null
  modalVincular.value = true
}

async function vincular() {
  if (!usernameVincular.value || !passwordVincular.value) {
    errorVincular.value = 'Username y contraseña son obligatorios'
    return
  }
  if (!estudianteAVincular.value) return
  vinculando.value = true
  errorVincular.value = null
  try {
    const usuario = await usuarioApi.create({ username: usernameVincular.value, password: passwordVincular.value, roles: ['ESTUDIANTE'] })
    await usuarioApi.vincularPerfil(usuario.id, { estudianteId: estudianteAVincular.value.id })
    const idx = estudiantes.value.findIndex(e => e.id === estudianteAVincular.value!.id)
    if (idx !== -1) estudiantes.value[idx] = { ...estudiantes.value[idx], usuario: { id: usuario.id, username: usuario.username, activo: true } }
    modalVincular.value = false
    toast.success('Cuenta vinculada correctamente')
  } catch (e) {
    errorVincular.value = e instanceof Error ? e.message : 'Error al vincular cuenta'
  } finally {
    vinculando.value = false
  }
}

// ─── Inscribir ────────────────────────────────────────────────────────────────
const modalInscribir  = ref(false)
const inscribiendo    = ref(false)
const errorInscripcion = ref<string | null>(null)
const estudianteAInscribir = ref<Estudiante | null>(null)
const formInscribir = ref({ cursoId: '' as number | '', procedencia: '' })

function abrirInscribir(e: Estudiante) {
  estudianteAInscribir.value = e
  formInscribir.value = { cursoId: '', procedencia: '' }
  errorInscripcion.value = null
  modalInscribir.value = true
}

async function inscribir() {
  if (!formInscribir.value.cursoId) { errorInscripcion.value = 'Seleccioná un curso'; return }
  if (!gestion.gestionId) { errorInscripcion.value = 'No hay gestión activa'; return }
  inscribiendo.value = true
  errorInscripcion.value = null
  try {
    await estudianteApi.inscribir({
      estudianteId: estudianteAInscribir.value!.id,
      cursoId: Number(formInscribir.value.cursoId),
      gestionId: gestion.gestionId,
    })
    modalInscribir.value = false
    toast.success('Estudiante inscrito')
    await cargar()
  } catch (e) {
    errorInscripcion.value = e instanceof Error ? e.message : 'Error al inscribir'
  } finally {
    inscribiendo.value = false
  }
}

// ─── Cambiar estado de inscripción ────────────────────────────────────────────
const modalEstado = ref(false)
const cambiandoEstado = ref(false)
const errorEstado = ref<string | null>(null)
const inscripcionActiva = ref<Inscripcion | null>(null)
const formEstado = ref<CambiarEstadoPayload>({ estadoInscripcion: 'ACTIVA', fechaRetiro: '', observaciones: '' })

function abrirCambiarEstado(insc: Inscripcion) {
  inscripcionActiva.value = insc
  formEstado.value = { estadoInscripcion: insc.estadoInscripcion, fechaRetiro: '', observaciones: '' }
  errorEstado.value = null
  modalEstado.value = true
}

async function cambiarEstado() {
  if (!inscripcionActiva.value) return
  cambiandoEstado.value = true
  errorEstado.value = null
  try {
    await estudianteApi.cambiarEstado(inscripcionActiva.value.id, formEstado.value)
    modalEstado.value = false
    toast.success('Estado actualizado')
    await cargar()
  } catch (e) {
    errorEstado.value = e instanceof Error ? e.message : 'Error al cambiar estado'
  } finally {
    cambiandoEstado.value = false
  }
}

const requiereFecha = computed(() => ['RETIRADA', 'TRANSFERIDA'].includes(formEstado.value.estadoInscripcion))

// ─── Desinscribir (borrar la inscripción — deshacer un error) ───────────────
const desinscribiendo = ref<number | null>(null)

async function desinscribir(insc: Inscripcion) {
  const ok = await confirmar({
    mensaje: `¿Desinscribir de ${nombreCursoDeInscripcion(insc)}? Esto borra la inscripción — si ya tiene notas, asistencia o pagos cargados, el sistema lo va a rechazar y ahí corresponde usar "Estado" en su lugar.`,
    peligroso: true,
    textoConfirmar: 'Desinscribir',
  })
  if (!ok) return
  desinscribiendo.value = insc.id
  error.value = null
  try {
    await estudianteApi.eliminarInscripcion(insc.id)
    toast.success('Inscripción eliminada')
    await cargar()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al desinscribir'
  } finally {
    desinscribiendo.value = null
  }
}

// ─── Activar / desactivar cuenta ──────────────────────────────────────────────
const toggeandoActivo = ref<number | null>(null)

async function toggleActivo(e: Estudiante) {
  if (!e.usuario) return
  toggeandoActivo.value = e.usuario.id
  try {
    const estadoActual = e.usuario.activo ?? true
    await usuarioApi.update(e.usuario.id, { activo: !estadoActual })
    e.usuario.activo = !estadoActual
    toast.success(estadoActual ? 'Cuenta desactivada' : 'Cuenta activada')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error al cambiar estado de la cuenta'
  } finally {
    toggeandoActivo.value = null
  }
}

// ─── Resetear contraseña ──────────────────────────────────────────────────────
const modalReset    = ref(false)
const reseteando    = ref(false)
const errorReset    = ref<string | null>(null)
const nuevaPassword = ref('')
const estudianteAResetear = ref<Estudiante | null>(null)

function abrirReset(e: Estudiante) {
  estudianteAResetear.value = e
  nuevaPassword.value = ''
  errorReset.value = null
  modalReset.value = true
}

async function resetearPassword() {
  if (nuevaPassword.value.length < 6) {
    errorReset.value = 'La contraseña debe tener al menos 6 caracteres'
    return
  }
  if (!estudianteAResetear.value?.usuario?.id) return
  reseteando.value = true
  errorReset.value = null
  try {
    await usuarioApi.resetearPassword(estudianteAResetear.value.usuario.id, nuevaPassword.value)
    modalReset.value = false
    toast.success('Contraseña reseteada correctamente')
  } catch (e) {
    errorReset.value = e instanceof Error ? e.message : 'Error al resetear'
  } finally {
    reseteando.value = false
  }
}

// ─── Registrar resultado final ────────────────────────────────────────────────
const modalResultado = ref(false)
const registrandoRes = ref(false)
const errorResultado = ref<string | null>(null)
const formResultado  = ref<{ resultado: ResultadoFinal; observaciones: string }>({ resultado: 'PROMOVIDO', observaciones: '' })

function abrirResultado(insc: Inscripcion) {
  inscripcionActiva.value = insc
  formResultado.value = { resultado: 'PROMOVIDO', observaciones: '' }
  errorResultado.value = null
  modalResultado.value = true
}

async function registrarResultado() {
  if (!inscripcionActiva.value) return
  const ok = await confirmar({
    mensaje: `¿Registrar como ${formResultado.value.resultado}? Queda en el historial académico del estudiante.`,
    peligroso: formResultado.value.resultado === 'REPROBADO',
  })
  if (!ok) return
  registrandoRes.value = true
  errorResultado.value = null
  try {
    await estudianteApi.registrarResultado(inscripcionActiva.value.id, formResultado.value.resultado, formResultado.value.observaciones || undefined)
    modalResultado.value = false
    toast.success('Resultado registrado')
    await cargar()
  } catch (e) {
    // El backend devuelve "hay trimestres sin cerrar" cuando corresponde —
    // más útil que un mensaje genérico
    errorResultado.value = e instanceof Error ? e.message : 'Error al registrar resultado'
  } finally {
    registrandoRes.value = false
  }
}
</script>

<template>
  <div class="space-y-4">

    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <div class="flex-1">
        <h2 class="text-2xl font-bold">Estudiantes</h2>
        <p class="text-sm text-base-content/60">Gestión {{ gestion.anio ?? '—' }}</p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm" @click="abrirCrear">+ Solo perfil</button>
        <button class="btn btn-primary btn-sm" @click="abrirConCuenta">+ Con cuenta</button>
      </div>
    </div>

    <!-- Buscador + filtros -->
    <div class="flex flex-wrap gap-3 items-center">
      <label class="input input-bordered flex items-center gap-2 max-w-sm">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
        </svg>
        <input v-model="busqueda" type="search" placeholder="Buscar por nombre o CI..." class="grow" />
      </label>
      <select v-model="filtroCurso" class="select select-bordered select-sm" @change="cargar">
        <option value="">Todos los cursos</option>
        <option v-for="c in gestion.cursos" :key="c.id" :value="c.id">{{ c.nombre }}</option>
      </select>
      <select v-model="filtroEstado" class="select select-bordered select-sm" @change="cargar">
        <option value="">Todos los estados</option>
        <option value="ACTIVA">Activas</option>
        <option value="RETIRADA">Retiradas</option>
        <option value="TRANSFERIDA">Transferidas</option>
        <option value="CONCLUIDA">Concluidas</option>
      </select>
      <label class="label cursor-pointer gap-2">
        <input v-model="soloGestionActiva" type="checkbox" class="checkbox checkbox-sm" @change="cargar" />
        <span class="text-sm">Solo inscritos en {{ gestion.anio }}</span>
      </label>
    </div>

    <div v-if="error" role="alert" class="alert alert-error">
      <span>{{ error }}</span>
      <button class="btn btn-sm btn-ghost" @click="cargar">Reintentar</button>
    </div>

    <div class="card bg-base-100 shadow overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Nombre</th><th>CI</th><th>Curso</th><th>Estado</th><th>Resultado</th><th>Cuenta</th><th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cargando" v-for="i in 6" :key="i">
            <td colspan="7"><div class="skeleton h-4 w-full"></div></td>
          </tr>
          <tr v-else-if="estudiantesFiltrados.length === 0">
            <td colspan="7" class="text-center text-base-content/40 py-8">No se encontraron estudiantes</td>
          </tr>
          <tr v-else v-for="e in estudiantesFiltrados" :key="e.id" class="hover">
            <td class="font-medium">{{ e.apellido }}, {{ e.nombre }}</td>
            <td class="font-mono text-sm">{{ e.ci }}</td>
            <td class="text-sm">
              <span v-if="ultimaInscripcion(e)">{{ nombreCursoDeInscripcion(ultimaInscripcion(e)) }}</span>
             <span v-else class="text-base-content/30">Sin inscripción</span>
            </td>
            <td>
              <StatusBadge v-if="ultimaInscripcion(e)" :estado="ultimaInscripcion(e)!.estadoInscripcion" />
              <span v-else class="text-base-content/30 text-xs">—</span>
            </td>
            <td>
              <StatusBadge v-if="ultimaInscripcion(e)" :estado="ultimaInscripcion(e)!.resultado" />
              <span v-else class="text-base-content/30 text-xs">—</span>
            </td>
            <td>
              <div v-if="e.usuario" class="flex items-center gap-2">
                <span class="badge badge-sm badge-success font-mono">{{ e.usuario.username }}</span>
                <input
                  type="checkbox"
                  class="toggle toggle-xs toggle-success"
                  :checked="e.usuario.activo ?? true"
                  :disabled="toggeandoActivo === e.usuario.id"
                  @change="toggleActivo(e)"
                  :title="e.usuario.activo ?? true ? 'Desactivar cuenta' : 'Activar cuenta'"
                />
              </div>
              <span v-else class="badge badge-sm badge-ghost">Sin cuenta</span>
            </td>
            <td>
              <div class="flex gap-1 flex-wrap">
                <button class="btn btn-ghost btn-xs" @click="abrirEditar(e)">Editar</button>
                <button
                  v-if="!inscritoEnGestionActiva(e)"
                  class="btn btn-outline btn-xs btn-primary"
                  @click="abrirInscribir(e)"
                >
                  Inscribir
                </button>
                <button
                  v-if="ultimaInscripcion(e)?.estadoInscripcion === 'ACTIVA'"
                  class="btn btn-ghost btn-xs text-warning"
                  @click="abrirCambiarEstado(ultimaInscripcion(e)!)"
                >
                  Estado
                </button>
                <button
                  v-if="inscritoEnGestionActiva(e)"
                  class="btn btn-ghost btn-xs text-error"
                  :disabled="desinscribiendo === ultimaInscripcion(e)!.id"
                  @click="desinscribir(ultimaInscripcion(e)!)"
                >
                  <span v-if="desinscribiendo === ultimaInscripcion(e)!.id" class="loading loading-xs loading-spinner"></span>
                  <span v-else>Desinscribir</span>
                </button>
                <button
                  v-if="ultimaInscripcion(e)?.estadoInscripcion === 'ACTIVA' && ultimaInscripcion(e)?.resultado === 'PENDIENTE'"
                  class="btn btn-outline btn-xs btn-info"
                  @click="abrirResultado(ultimaInscripcion(e)!)"
                >
                  Resultado
                </button>
                <button
                  v-if="!e.usuario"
                  class="btn btn-outline btn-xs btn-warning"
                  @click="abrirVincular(e)"
                >
                  Vincular cuenta
                </button>
                <button
                  v-if="e.usuario"
                  class="btn btn-ghost btn-xs"
                  @click="abrirReset(e)"
                >
                  Reset pass
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="!cargando" class="text-xs text-base-content/40">
      {{ estudiantesFiltrados.length }} estudiante(s) encontrado(s)
    </p>
  </div>

  <!-- ── Modal crear/editar perfil ───────────────────────────────────────── -->
  <dialog :open="modalPerfil" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">{{ modoEdicion ? 'Editar estudiante' : 'Nuevo estudiante (solo perfil)' }}</h3>
      <div v-if="errorModal" role="alert" class="alert alert-error mb-4 py-2 text-sm"><span>{{ errorModal }}</span></div>
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
          <legend class="fieldset-legend text-xs">Fecha de nacimiento</legend>
          <input v-model="form.fechaNacimiento" type="date" class="input input-bordered w-full" :disabled="guardando" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Dirección</legend>
          <input v-model="form.direccion" type="text" class="input input-bordered w-full" :disabled="guardando" />
        </fieldset>
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

  <!-- ── Modal crear con cuenta ──────────────────────────────────────────── -->
  <dialog :open="modalConCuenta" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Nuevo estudiante con cuenta</h3>
      <p class="text-sm text-base-content/60 mb-4">Crea el perfil y la cuenta de acceso en una sola operación.</p>

      <div v-if="credenciales" class="space-y-4">
        <div role="alert" class="alert alert-success"><span>Estudiante creado correctamente</span></div>
        <div class="bg-base-200 rounded-lg p-4 space-y-2">
          <p class="text-sm font-semibold">Credenciales de acceso:</p>
          <p class="font-mono text-sm">Usuario: <strong>{{ credenciales.username }}</strong></p>
          <p class="font-mono text-sm">Contraseña: <strong>{{ credenciales.password }}</strong></p>
        </div>
        <div class="modal-action">
          <button class="btn btn-primary" @click="modalConCuenta = false; credenciales = null">Cerrar</button>
        </div>
      </div>

      <form v-else class="space-y-3" @submit.prevent="crearConCuenta">
        <div v-if="errorCuenta" role="alert" class="alert alert-error py-2 text-sm"><span>{{ errorCuenta }}</span></div>
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
        <div class="grid grid-cols-2 gap-3">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Fecha de nacimiento</legend>
            <input v-model="formCuenta.fechaNacimiento" type="date" class="input input-bordered w-full" :disabled="creandoCuenta" />
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">RUDE</legend>
            <input v-model="formCuenta.rude" type="text" class="input input-bordered w-full" :disabled="creandoCuenta" />
          </fieldset>
        </div>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Dirección</legend>
          <input v-model="formCuenta.direccion" type="text" class="input input-bordered w-full" :disabled="creandoCuenta" />
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
            Crear estudiante
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalConCuenta = false; credenciales = null"><button>cerrar</button></form>
  </dialog>

  <!-- ── Modal vincular cuenta ───────────────────────────────────────────── -->
  <dialog :open="modalVincular" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Crear y vincular cuenta</h3>
      <p class="text-sm text-base-content/60 mb-4">Para: <strong>{{ estudianteAVincular?.nombre }} {{ estudianteAVincular?.apellido }}</strong></p>
      <div v-if="errorVincular" role="alert" class="alert alert-error mb-4 py-2 text-sm"><span>{{ errorVincular }}</span></div>
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

  <!-- ── Modal inscribir ──────────────────────────────────────────────────── -->
  <dialog :open="modalInscribir" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Inscribir estudiante</h3>
      <p class="text-sm text-base-content/60 mb-4">{{ estudianteAInscribir?.nombre }} {{ estudianteAInscribir?.apellido }}</p>
      <div v-if="errorInscripcion" role="alert" class="alert alert-error mb-4 py-2 text-sm"><span>{{ errorInscripcion }}</span></div>
      <form class="space-y-3" @submit.prevent="inscribir">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Curso *</legend>
          <select v-model="formInscribir.cursoId" class="select select-bordered w-full" :disabled="inscribiendo || !gestion.cursos.length">
            <option value="" disabled>Seleccionar curso</option>
            <option v-for="c in gestion.cursos" :key="c.id" :value="c.id">{{ c.nombre }}</option>
          </select>
          <p v-if="!gestion.cursos.length" class="text-xs text-base-content/40 mt-1">
            No hay cursos en la gestión activa — creálos primero desde Estructura.
          </p>
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Procedencia</legend>
          <input v-model="formInscribir.procedencia" type="text" placeholder="Opcional — de qué colegio viene" class="input input-bordered w-full" :disabled="inscribiendo" />
        </fieldset>
        <p class="text-xs text-base-content/50">Gestión: <strong>{{ gestion.anio }}</strong></p>
        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="inscribiendo" @click="modalInscribir = false">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="inscribiendo">
            <span v-if="inscribiendo" class="loading loading-spinner loading-sm"></span>
            Inscribir
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalInscribir = false"><button>cerrar</button></form>
  </dialog>

  <!-- ── Modal cambiar estado ─────────────────────────────────────────────── -->
  <dialog :open="modalEstado" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Cambiar estado de inscripción</h3>
      <p class="text-sm text-base-content/60 mb-4">{{ nombreCursoDeInscripcion(inscripcionActiva) }}</p>
      <div v-if="errorEstado" role="alert" class="alert alert-error mb-4 py-2 text-sm"><span>{{ errorEstado }}</span></div>
      <form class="space-y-3" @submit.prevent="cambiarEstado">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Nuevo estado *</legend>
          <select v-model="formEstado.estadoInscripcion" class="select select-bordered w-full" :disabled="cambiandoEstado">
            <option value="ACTIVA">ACTIVA</option>
            <option value="RETIRADA">RETIRADA</option>
            <option value="TRANSFERIDA">TRANSFERIDA</option>
            <option value="CONCLUIDA">CONCLUIDA</option>
          </select>
        </fieldset>
        <fieldset v-if="requiereFecha" class="fieldset">
          <legend class="fieldset-legend text-xs">Fecha de retiro</legend>
          <input v-model="formEstado.fechaRetiro" type="date" class="input input-bordered w-full" :disabled="cambiandoEstado" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Observaciones</legend>
          <textarea v-model="formEstado.observaciones" rows="2" class="textarea textarea-bordered w-full" :disabled="cambiandoEstado"></textarea>
        </fieldset>
        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="cambiandoEstado" @click="modalEstado = false">Cancelar</button>
          <button type="submit" class="btn btn-warning" :disabled="cambiandoEstado">
            <span v-if="cambiandoEstado" class="loading loading-spinner loading-sm"></span>
            Cambiar estado
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalEstado = false"><button>cerrar</button></form>
  </dialog>

  <!-- ── Modal resultado final ────────────────────────────────────────────── -->
  <dialog :open="modalResultado" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Registrar resultado final</h3>
      <p class="text-sm text-base-content/60 mb-4">{{ nombreCursoDeInscripcion(inscripcionActiva) }}</p>
      <div role="alert" class="alert alert-warning py-2 text-sm mb-4">
        <span>Requiere que los trimestres de la gestión estén cerrados.</span>
      </div>
      <div v-if="errorResultado" role="alert" class="alert alert-error mb-4 py-2 text-sm"><span>{{ errorResultado }}</span></div>
      <form class="space-y-3" @submit.prevent="registrarResultado">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Resultado *</legend>
          <div class="flex gap-3">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="formResultado.resultado" type="radio" value="PROMOVIDO" class="radio radio-success" />
              <span class="font-medium text-success">PROMOVIDO</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="formResultado.resultado" type="radio" value="REPROBADO" class="radio radio-error" />
              <span class="font-medium text-error">REPROBADO</span>
            </label>
          </div>
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Observaciones</legend>
          <textarea v-model="formResultado.observaciones" rows="2" class="textarea textarea-bordered w-full" :disabled="registrandoRes"></textarea>
        </fieldset>
        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="registrandoRes" @click="modalResultado = false">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="registrandoRes">
            <span v-if="registrandoRes" class="loading loading-spinner loading-sm"></span>
            Registrar resultado
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalResultado = false"><button>cerrar</button></form>
  </dialog>

  <!-- ── Modal resetear contraseña ────────────────────────────────────────── -->
  <dialog :open="modalReset" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Resetear contraseña</h3>
      <p class="text-sm text-base-content/60 mb-4">
        {{ estudianteAResetear?.nombre }} {{ estudianteAResetear?.apellido }}
        · <span class="font-mono">{{ estudianteAResetear?.usuario?.username }}</span>
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