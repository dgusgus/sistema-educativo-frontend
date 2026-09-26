<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { docenteApi, type DocentePayload } from '@/api/docente.api'
import { usuarioApi, type ConPerfilPayload } from '@/api/usuario.api'
import { useGestionStore } from '@/stores/gestion.store'
import { materiaApi } from '@/api/estructura.api'
import { useToastStore } from '@/stores/toast.store'
import type { Docente, Nivel, Materia } from '@/types'
import AppIcon from '@/components/AppIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { codigoCurso } from '@/lib/abreviar'
import ImportarExcelModal from '@/components/ImportarExcelModal.vue'
import { descargarBlob } from '@/api/boletin.api.js'
const toast = useToastStore()

const gestion = useGestionStore()

// ─── Estado principal ─────────────────────────────────────────────────────────
const docentes  = ref<Docente[]>([])
const materias  = ref<Materia[]>([])
const cargando  = ref(true)
const error     = ref<string | null>(null)
const busqueda  = ref('')

// ✅ Guard anti-race: cada llamada a cargar() se numera; si una respuesta
// vieja llega DESPUÉS de una más nueva, se descarta. Sin esto, una
// recarga lenta (ej. la del onMounted) puede resolver tarde y pisar
// datos frescos con una foto vieja de la lista — eso era la causa real
// de los "docente no encontrado" y "se ven datos de otro docente":
// el id que quedaba en pantalla venía de una lista ya obsoleta.
let cargaSeq = 0

onMounted(async () => {
  await gestion.cargar()
  await Promise.all([cargar(), cargarMaterias()])
})

async function cargar() {
  const miTurno = ++cargaSeq
  cargando.value = true
  error.value = null
  try {
    const lista = await docenteApi.getAll()
    if (miTurno !== cargaSeq) return   // llegó una respuesta más nueva antes — descartar esta
    docentes.value = lista
  } catch (e) {
    if (miTurno !== cargaSeq) return
    error.value = e instanceof Error ? e.message : 'Error al cargar docentes'
  } finally {
    if (miTurno === cargaSeq) cargando.value = false
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

// ─── Cursos asignados (para la columna nueva) ────────────────────────────────
// docenteApi.getAll() ya incluye asignaciones de la gestión activa — no
// hace falta un fetch extra. El curso acá no trae "nombre" calculado
// (solo nivel/grado/paralelo), se arma igual que en el resto del frontend.
// ✅ reemplazar por esto
const NIVEL_TEXTO: Record<Nivel, string> = { PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
function cursosDe(d: Docente): Array<{ corto: string; completo: string }> {
  return (d.asignaciones ?? []).map(a => {
    const c = a.curso
    const completo = c
      ? `${a.materia?.nombre ?? '?'} — ${c.grado}° ${NIVEL_TEXTO[c.nivel]} "${c.paralelo}"`
      : a.materia?.nombre ?? '?'
    const corto = c
      ? `${a.materia?.codigo ?? a.materia?.nombre?.slice(0, 3).toUpperCase() ?? '?'} · ${codigoCurso(c)}`
      : a.materia?.nombre ?? '?'
    return { corto, completo }
  })
}

// ─── Crear/editar perfil ──────────────────────────────────────────────────────
const modalPerfil  = ref(false)
const guardando    = ref(false)
const errorModal   = ref<string | null>(null)
const modoEdicion  = ref(false)
const idEditando   = ref<number | null>(null)

const formVacio = (): DocentePayload => ({
  nombre: '', apellido: '', ci: '', email: '', telefono: '', especialidad: '',
})
const form = ref<DocentePayload>(formVacio())

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
      if (idx !== -1) docentes.value[idx] = { ...docentes.value[idx], ...actualizado }
      toast.success('Docente actualizado')
    } else {
      const nuevo = await docenteApi.create(form.value)
      docentes.value.unshift(nuevo)
      toast.success('Docente creado')
    }
    modalPerfil.value = false
  } catch (e) {
    errorModal.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    guardando.value = false
  }
}

// ─── Crear docente con cuenta en una sola operación ──────────────────────────
const modalConCuenta  = ref(false)
const creandoCuenta   = ref(false)
const errorCuenta     = ref<string | null>(null)
const credenciales    = ref<{ username: string; password: string } | null>(null)

const formCuenta = ref({
  ci: '', nombre: '', apellido: '', especialidad: '',
  email: '', telefono: '',
  username: '', password: '',
})

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

    // ✅ En vez de volver a pedir GET /docentes (eso era la fuente de la
    // condición de carrera — ver comentario junto a cargaSeq), armamos el
    // docente directo con lo que el backend YA confirmó que existe. La
    // creación es transaccional: si llegamos acá, es 100% real.
    const perfilDocente = resultado.perfiles.DOCENTE
    if (perfilDocente) {
      docentes.value.unshift({
        id:            perfilDocente.id,
        ci:            resultado.persona.ci,
        nombre:        resultado.persona.nombre,
        apellido:      resultado.persona.apellido,
        telefono:      resultado.persona.telefono ?? null,
        email:         resultado.persona.email ?? null,
        especialidad:  perfilDocente.especialidad ?? null,
        activo:        true,
        usuario:       { id: resultado.usuario.id, username: resultado.usuario.username, activo: true },
        asignaciones:  [],
      })
    }
  } catch (e) {
    errorCuenta.value = e instanceof Error ? e.message : 'Error al crear docente'
  } finally {
    creandoCuenta.value = false
  }
}

// ─── Vincular cuenta existente a docente sin cuenta ──────────────────────────
// Flujo real: 1) crear la cuenta sola, 2) PUT /usuarios/:id/vincular la
// liga al docenteId ya existente (createConPerfil NO sirve acá — crearía
// una Persona duplicada).
const modalVincular      = ref(false)
const vinculando         = ref(false)
const errorVincular      = ref<string | null>(null)
const docenteAVincular   = ref<Docente | null>(null)
const usernameVincular   = ref('')
const passwordVincular   = ref('')

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
    const usuario = await usuarioApi.create({
      username: usernameVincular.value,
      password: passwordVincular.value,
      roles:    ['DOCENTE'],
    })
    await usuarioApi.vincularPerfil(usuario.id, { docenteId: docenteAVincular.value.id })

    // ✅ Igual que en crearConCuenta: parchamos el registro en memoria
    // directamente en vez de recargar toda la lista. Esto también hace
    // que el botón "Vincular cuenta" desaparezca al instante (tieneCuenta
    // pasa a true), evitando que alguien lo apriete de nuevo y genere
    // una cuenta huérfana más si algo tarda en reflejarse.
    const idx = docentes.value.findIndex(d => d.id === docenteAVincular.value!.id)
    if (idx !== -1) {
      docentes.value[idx] = {
        ...docentes.value[idx],
        usuario: { id: usuario.id, username: usuario.username, activo: true },
      }
    }
    modalVincular.value = false
    toast.success('Cuenta vinculada correctamente')
  } catch (e) {
    errorVincular.value = e instanceof Error ? e.message : 'Error al vincular cuenta'
  } finally {
    vinculando.value = false
  }
}

// ─── Asignar materia + curso al docente ───────────────────────────────────────
const modalAsignacion   = ref(false)
const asignando         = ref(false)
const errorAsignacion   = ref<string | null>(null)
const docenteAsignar    = ref<Docente | null>(null)
const formAsignacion    = ref<{ materiaId: number | ''; cursoId: number | '' }>({
  materiaId: '', cursoId: '',
})

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
    const nuevaAsig = await docenteApi.asignar(docenteAsignar.value.id, {
      materiaId: Number(formAsignacion.value.materiaId),
      cursoId:   Number(formAsignacion.value.cursoId),
      gestionId: gestion.gestionId,
    })
    // ✅ parche en memoria en vez de recargar — misma razón que arriba
    const idx = docentes.value.findIndex(d => d.id === docenteAsignar.value!.id)
    if (idx !== -1) {
      const asignaciones = docentes.value[idx].asignaciones ?? []
      docentes.value[idx] = { ...docentes.value[idx], asignaciones: [...asignaciones, nuevaAsig] }
    }
    modalAsignacion.value = false
    toast.success('Materia asignada')
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

// ─── Activar / desactivar cuenta ──────────────────────────────────────────────
const toggeandoActivo = ref<number | null>(null)

async function toggleActivoCuenta(d: Docente) {
  if (!d.usuario) return
  toggeandoActivo.value = d.usuario.id
  try {
    const estadoActual = d.usuario.activo ?? true
    await usuarioApi.update(d.usuario.id, { activo: !estadoActual })
    d.usuario.activo = !estadoActual
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
const docenteAResetear = ref<Docente | null>(null)

function abrirReset(d: Docente) {
  docenteAResetear.value = d
  nuevaPassword.value = ''
  errorReset.value = null
  modalReset.value = true
}

async function resetearPassword() {
  if (nuevaPassword.value.length < 6) {
    errorReset.value = 'La contraseña debe tener al menos 6 caracteres'
    return
  }
  if (!docenteAResetear.value?.usuario?.id) return
  reseteando.value = true
  errorReset.value = null
  try {
    await usuarioApi.resetearPassword(docenteAResetear.value.usuario.id, nuevaPassword.value)
    modalReset.value = false
    toast.success('Contraseña reseteada correctamente')
  } catch (e) {
    errorReset.value = e instanceof Error ? e.message : 'Error al resetear'
  } finally {
    reseteando.value = false
  }
}

const modalImportar = ref(false)
async function onImportar(archivo: File) { return docenteApi.importar(archivo) }
function onImportacionCompletada() { cargar() }
async function exportar() {
  const blob = await docenteApi.exportar()
  descargarBlob(blob, 'docentes.xlsx')
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
        <button class="btn btn-outline btn-sm" @click="exportar">Exportar</button>
        <button class="btn btn-outline btn-sm" @click="modalImportar = true">Importar</button>

      </div>
    </div>

    <!-- Error global -->
    <div v-if="error" role="alert" class="alert alert-error">
      <span>{{ error }}</span>
      <button class="btn btn-sm btn-ghost" @click="cargar">Reintentar</button>
    </div>

    <!-- Buscador -->
    <label class="input input-bordered flex items-center gap-2 max-w-sm">
<AppIcon nombre="buscar" class="h-4 w-4 opacity-50" />
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
            <th>Cursos asignados</th>
            <th>Cuenta</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
       <tbody>
          <tr v-if="cargando" v-for="i in 5" :key="i">
            <td colspan="7">
              <div class="skeleton h-4 w-full"></div>
            </td>
          </tr>
          <tr v-else-if="docentesFiltrados.length === 0">
            <td colspan="7" class="text-center text-base-content/40 py-8">
              No se encontraron docentes
            </td>
          </tr>
          <tr v-else v-for="d in docentesFiltrados" :key="d.id" class="hover">
            <td class="font-medium">{{ d.apellido }}, {{ d.nombre }}</td>
            <td class="font-mono text-sm">{{ d.ci }}</td>
            <td class="text-sm">{{ d.especialidad ?? '—' }}</td>
<td>
  <div class="flex flex-wrap gap-1 max-w-xs">
    <span
      v-for="(c, i) in cursosDe(d)"
      :key="i"
      class="badge badge-sm badge-outline"
      :title="c.completo"
    >
      {{ c.corto }}
    </span>
    <span v-if="!cursosDe(d).length" class="text-xs text-base-content/30">Sin asignaciones</span>
  </div>
</td>
            <td>
              <div v-if="tieneCuenta(d)" class="flex items-center gap-2">
                <span class="badge badge-sm badge-success font-mono">{{ d.usuario?.username }}</span>
                <input type="checkbox" class="toggle toggle-xs toggle-success" :checked="d.usuario?.activo ?? true"
                  :disabled="toggeandoActivo === d.usuario?.id" @change="toggleActivoCuenta(d)"
                  :title="(d.usuario?.activo ?? true) ? 'Desactivar cuenta' : 'Activar cuenta'" />
              </div>
              <span v-else class="badge badge-sm badge-ghost">Sin cuenta</span>
            </td>
            <td>
              <StatusBadge :estado="d.activo ? 'ACTIVO' : 'INACTIVO'" :texto="d.activo ? 'Activo' : 'Inactivo'" />
            </td>
            <td>
              <div class="flex gap-1 flex-wrap">
                <button class="btn btn-ghost btn-xs" @click="abrirEditar(d)">
                  Editar
                </button>
                <button class="btn btn-outline btn-xs btn-info" @click="abrirAsignacion(d)">
                  Asignar
                </button>
                <button v-if="!tieneCuenta(d)" class="btn btn-outline btn-xs btn-warning" @click="abrirVincular(d)">
                  Vincular cuenta
                </button>
                <button v-if="tieneCuenta(d)" class="btn btn-ghost btn-xs" @click="abrirReset(d)">
                  Reset pass
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
        <div class="grid grid-cols-2 gap-3">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Email</legend>
            <input v-model="formCuenta.email" type="email" class="input input-bordered w-full" :disabled="creandoCuenta" />
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Teléfono</legend>
            <input v-model="formCuenta.telefono" type="tel" class="input input-bordered w-full" :disabled="creandoCuenta" />
          </fieldset>
        </div>

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

  <!-- ── Modal resetear contraseña ────────────────────────────────────────── -->
  <dialog :open="modalReset" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Resetear contraseña</h3>
      <p class="text-sm text-base-content/60 mb-4">
        {{ docenteAResetear?.nombre }} {{ docenteAResetear?.apellido }}
        · <span class="font-mono">{{ docenteAResetear?.usuario?.username }}</span>
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

<!-- DocentesView.vue -->
<ImportarExcelModal
  v-model="modalImportar"
  titulo="Importar docentes"
  :columnas="['CI', 'Nombre', 'Apellido', 'Especialidad', 'Email', 'Telefono']"
  :plantilla="docenteApi.plantilla"
  :importar="onImportar"
  @completado="onImportacionCompletada"
/>
</template>