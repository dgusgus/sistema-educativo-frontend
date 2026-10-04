<script setup lang="ts">
/**
 * EstructuraView — configuración base de cada gestión: cursos, materias
 * y trimestres. Sin esto, Secretaria no puede inscribir (no hay cursos),
 * el docente no puede pasar asistencia (no hay trimestres), etc.
 */
import { ref, watch, nextTick, onMounted } from 'vue'
import { cursoApi, materiaApi, trimestreApi, nombreCurso } from '@/api/estructura.api'
import AppIcon from '@/components/AppIcon.vue'
import type { Curso, Materia, Trimestre, Nivel, Turno } from '@/types'
import { useGestionStore } from '@/stores/gestion.store'
import { useConfirm } from '@/composables/useConfirm'
import { useToastStore } from '@/stores/toast.store'
import StatusBadge from '@/components/StatusBadge.vue'
import { formatoFecha } from '@/lib/fechas'

const { confirmar } = useConfirm()
const toast = useToastStore()

const gestion = useGestionStore()

type Tab = 'cursos' | 'materias' | 'trimestres'
const tab = ref<Tab>('cursos')

const cursos     = ref<Curso[]>([])
const materias   = ref<Materia[]>([])
const trimestres = ref<Trimestre[]>([])
const cargando   = ref(false)
const error      = ref<string | null>(null)

// Un solo modal para los tres tabs — mismo patrón (abrir → completar → guardar)
const modalAbierto = ref(false)
const guardando    = ref(false)
const errorModal   = ref<string | null>(null)
const modoEdicion  = ref(false)
const idEditando   = ref<number | null>(null)

// ✅ Curso real: nivel (PRIMARIA|SECUNDARIA) + grado (1–6) + paralelo + turno.
// "nombre" ya NO es un campo editable — lo arma el backend con estos 4.
const formCurso = ref<{ nivel: Nivel | ''; grado: number; paralelo: string; turno: Turno; capacidad: number | '' }>({
  nivel: '', grado: 1, paralelo: '', turno: 'MANANA', capacidad: '',
})
const formMateria = ref({ nombre: '', codigo: '', horasSemanales: 4 })
const formTrimestre = ref({ numero: 1, nombre: '', fechaInicio: '', fechaFin: '' })

onMounted(async () => {
  await gestion.cargar()
  await Promise.all([cargarCursos(), cargarMaterias(), cargarTrimestres()])
})

async function cargarCursos() {
  cargando.value = true
  try {
    cursos.value = await cursoApi.getAll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar cursos'
  } finally {
    cargando.value = false
  }
}

async function cargarMaterias() {
  try {
    materias.value = await materiaApi.getAll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar materias'
  }
}

async function cargarTrimestres() {
  try {
    trimestres.value = await trimestreApi.getAll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar trimestres'
  }
}

const dialogoEstructura = ref<HTMLDialogElement | null>(null)
let focoPrevio: HTMLElement | null = null

function abrirModal() {
  focoPrevio = document.activeElement as HTMLElement | null
  errorModal.value = null
  abrirModal()
}

function cerrarModal() {
  modalAbierto.value = false
  focoPrevio?.focus?.()
}

watch(modalAbierto, async (abierto) => {
  if (!abierto || !dialogoEstructura.value) return
  await nextTick()
  dialogoEstructura.value.querySelector<HTMLElement>(
    'input:not([disabled]), select:not([disabled]), button:not([disabled])'
  )?.focus()
})

function atraparTeclas(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    cerrarModal()
    return
  }
  if (e.key !== 'Tab' || !dialogoEstructura.value) return
  const focos = Array.from(
    dialogoEstructura.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )
  ).filter(el => el.offsetParent !== null)
  if (!focos.length) return
  const primero = focos[0]
  const ultimo = focos[focos.length - 1]
  if (e.shiftKey && document.activeElement === primero) {
    e.preventDefault()
    ultimo.focus()
  } else if (!e.shiftKey && document.activeElement === ultimo) {
    e.preventDefault()
    primero.focus()
  }
}

function abrirCrear() {
  modoEdicion.value = false
  idEditando.value  = null
  errorModal.value  = null
  if (tab.value === 'cursos') {
    formCurso.value = { nivel: '', grado: 1, paralelo: '', turno: 'MANANA', capacidad: '' }
  } else if (tab.value === 'materias') {
    formMateria.value = { nombre: '', codigo: '', horasSemanales: 4 }
  } else {
    const existentes = trimestres.value.length
    formTrimestre.value = {
      numero: Math.min(existentes + 1, 3),
      nombre: existentes === 0 ? 'Primer Trimestre' : existentes === 1 ? 'Segundo Trimestre' : 'Tercer Trimestre',
      fechaInicio: '',
      fechaFin: '',
    }
  }
  abrirModal()
}

function abrirEditar(item: Curso | Materia | Trimestre) {
  modoEdicion.value = true
  idEditando.value  = item.id
  errorModal.value  = null
  if (tab.value === 'cursos') {
    const c = item as Curso
    formCurso.value = { nivel: c.nivel, grado: c.grado, paralelo: c.paralelo, turno: c.turno, capacidad: c.capacidad ?? '' }
  } else if (tab.value === 'materias') {
    const m = item as Materia
    formMateria.value = { nombre: m.nombre, codigo: m.codigo, horasSemanales: m.horasSemanales }
  } else {
    const t = item as Trimestre
    formTrimestre.value = {
      numero: t.numero,
      nombre: t.nombre,
      fechaInicio: t.fechaInicio ?? '',
      fechaFin:    t.fechaFin    ?? '',
    }
  }
  abrirModal()
}

async function guardar() {
  guardando.value  = true
  errorModal.value = null
  try {
    if (tab.value === 'cursos') {
      await guardarCurso()
    } else if (tab.value === 'materias') {
      await guardarMateria()
    } else {
      await guardarTrimestre()
    }
    modalAbierto.value = false
    const entidad = tab.value === 'cursos' ? 'Curso' : tab.value === 'materias' ? 'Materia' : 'Trimestre'
    toast.success(`${entidad} ${modoEdicion.value ? 'actualizado' : 'creado'}`)
  } catch (e) {
    errorModal.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    guardando.value = false
  }
}

async function guardarCurso() {
  const f = formCurso.value
  if (!f.nivel || !f.grado || !f.paralelo) throw new Error('Nivel, grado y paralelo son obligatorios')
  if (!gestion.gestionId) throw new Error('No hay gestión activa')

  if (modoEdicion.value && idEditando.value) {
    // "nivel" NO se puede editar (ver curso.controller.ts) — solo se manda
    // lo que sí es editable
    const updated = await cursoApi.update(idEditando.value, {
      grado:      f.grado,
      paralelo:   f.paralelo,
      turno:      f.turno,
      capacidad:  f.capacidad === '' ? undefined : f.capacidad,
    })
    const idx = cursos.value.findIndex(c => c.id === idEditando.value)
    if (idx !== -1) cursos.value[idx] = updated
  } else {
    const nuevo = await cursoApi.create({
      nivel:      f.nivel,
      grado:      f.grado,
      paralelo:   f.paralelo,
      turno:      f.turno,
      capacidad:  f.capacidad === '' ? undefined : f.capacidad,
      gestionId:  gestion.gestionId,
    })
    cursos.value.push(nuevo)
    // Recargar el store de gestión para que el nuevo curso aparezca en
    // los selectores de inscripciones y asignaciones
    await gestion.recargar()
  }
}

async function guardarMateria() {
  const f = formMateria.value
  if (!f.nombre || !f.codigo) throw new Error('Nombre y código son obligatorios')
  if (modoEdicion.value && idEditando.value) {
    const updated = await materiaApi.update(idEditando.value, { nombre: f.nombre, horasSemanales: f.horasSemanales })
    const idx = materias.value.findIndex(m => m.id === idEditando.value)
    if (idx !== -1) materias.value[idx] = updated
  } else {
    const nueva = await materiaApi.create(f)
    materias.value.push(nueva)
  }
}

async function guardarTrimestre() {
  const f = formTrimestre.value
  if (!f.nombre) throw new Error('El nombre es obligatorio')
  if (!gestion.gestionId) throw new Error('No hay gestión activa')
  if (modoEdicion.value && idEditando.value) {
    const updated = await trimestreApi.update(idEditando.value, {
      nombre:      f.nombre,
      fechaInicio: f.fechaInicio || undefined,
      fechaFin:    f.fechaFin    || undefined,
    })
    const idx = trimestres.value.findIndex(t => t.id === idEditando.value)
    if (idx !== -1) trimestres.value[idx] = updated
  } else {
    const nuevo = await trimestreApi.create({
      numero:      f.numero as 1 | 2 | 3,
      nombre:      f.nombre,
      gestionId:   gestion.gestionId,
      fechaInicio: f.fechaInicio || undefined,
      fechaFin:    f.fechaFin    || undefined,
    })
    trimestres.value.push(nuevo)
    await gestion.recargar()
  }
}

// Irreversible — bloquea notas/asistencia del período. Acción separada,
// con confirmación explícita.
const cerrando = ref<number | null>(null)

async function cerrarTrimestre(t: Trimestre) {
  const ok = await confirmar({
    mensaje: `¿Cerrar "${t.nombre}"? Esta acción no se puede deshacer — las notas quedarán bloqueadas.`,
    peligroso: true,
  })
  if (!ok) return
  cerrando.value = t.id
  try {
    await trimestreApi.cerrar(t.id)
    const idx = trimestres.value.findIndex(x => x.id === t.id)
    if (idx !== -1) trimestres.value[idx].cerrado = true
    await gestion.recargar()
    toast.success(`Trimestre "${t.nombre}" cerrado`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cerrar trimestre'
  } finally {
    cerrando.value = null
  }
}

const eliminando = ref<number | null>(null)

async function eliminarCurso(c: Curso) {
  const ok = await confirmar({ mensaje: `¿Eliminar el curso "${c.nombre}"?`, peligroso: true })
  if (!ok) return
  eliminando.value = c.id
  try {
    await cursoApi.delete(c.id)
    cursos.value = cursos.value.filter(x => x.id !== c.id)
    await gestion.recargar()
    toast.success('Curso eliminado')
  } catch (e) {
    // El backend devuelve "No se puede eliminar — el curso tiene N
    // estudiantes inscritos" — más útil que un mensaje genérico
    error.value = e instanceof Error ? e.message : 'Error al eliminar'
  } finally {
    eliminando.value = null
  }
}

async function eliminarMateria(m: Materia) {
  const ok = await confirmar({ mensaje: `¿Eliminar la materia "${m.nombre}" (${m.codigo})?`, peligroso: true })
  if (!ok) return
  eliminando.value = m.id
  try {
    await materiaApi.delete(m.id)
    materias.value = materias.value.filter(x => x.id !== m.id)
    toast.success('Materia eliminada')
  } catch (e) {
    // El backend rechaza (400) si tiene asignaciones activas
    error.value = e instanceof Error ? e.message : 'Error al eliminar'
  } finally {
    eliminando.value = null
  }
}

const NIVELES: Nivel[] = ['PRIMARIA', 'SECUNDARIA']
const NIVEL_TEXTO: Record<Nivel, string> = { PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
const TURNOS: Turno[] = ['MANANA', 'TARDE', 'NOCHE']
const TURNO_TEXTO: Record<Turno, string> = { MANANA: 'Mañana', TARDE: 'Tarde', NOCHE: 'Noche' }
</script>

<template>
  <div class="space-y-4">

    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <div class="flex-1 min-w-0">
        <h2 class="font-display text-2xl font-bold tracking-tight">Estructura académica</h2>
        <p class="mt-0.5 text-sm text-base-content/60">Gestión {{ gestion.anio ?? '—' }}</p>
      </div>
      <button class="btn btn-primary min-h-11" @click="abrirCrear">
        <AppIcon nombre="agregar" class="h-4 w-4" />
        Nuevo {{ tab === 'cursos' ? 'curso' : tab === 'materias' ? 'materia' : 'trimestre' }}
      </button>
    </div>

    <div v-if="error" role="alert" class="alert alert-error">
      <span class="flex-1">{{ error }}</span>
      <button type="button" class="btn btn-sm btn-ghost min-h-11" aria-label="Descartar error" @click="error = null">
        <AppIcon nombre="cerrar" class="h-4 w-4" />
      </button>
    </div>

    <div role="tablist" class="tabs tabs-boxed w-fit">
      <button role="tab" class="tab min-h-11" :class="{ 'tab-active': tab === 'cursos' }" :aria-selected="tab === 'cursos'" @click="tab = 'cursos'">
        Cursos <span class="ml-1 badge badge-xs badge-ghost">{{ cursos.length }}</span>
      </button>
      <button role="tab" class="tab min-h-11" :class="{ 'tab-active': tab === 'materias' }" :aria-selected="tab === 'materias'" @click="tab = 'materias'">
        Materias <span class="ml-1 badge badge-xs badge-ghost">{{ materias.length }}</span>
      </button>
      <button role="tab" class="tab min-h-11" :class="{ 'tab-active': tab === 'trimestres' }" :aria-selected="tab === 'trimestres'" @click="tab = 'trimestres'">
        Trimestres <span class="ml-1 badge badge-xs badge-ghost">{{ trimestres.length }}</span>
      </button>
    </div>

    <!-- ── Tab Cursos ──────────────────────────────────────────────────────── -->
    <div v-if="tab === 'cursos'" class="card bg-base-100 shadow overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Turno</th>
            <th>Inscritos</th>
            <th>Asignaciones</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cargando" v-for="i in 4" :key="i">
            <td colspan="5"><div class="skeleton h-4 w-full"></div></td>
          </tr>
          <tr v-else-if="cursos.length === 0">
            <td colspan="5" class="text-center text-base-content/40 py-8">
              No hay cursos — creá el primero para poder inscribir estudiantes.
            </td>
          </tr>
          <tr v-else v-for="c in cursos" :key="c.id" class="hover">
            <td class="font-medium">{{ c.nombre }}</td>
            <td class="text-sm">{{ TURNO_TEXTO[c.turno] }}</td>
            <td class="text-center">
              <span class="badge badge-sm badge-ghost">{{ c._count?.inscripciones ?? 0 }}</span>
            </td>
            <td class="text-center">
              <span class="badge badge-sm badge-ghost">{{ c._count?.asignaciones ?? 0 }}</span>
            </td>
            <td>
              <div class="flex gap-1">
                <button class="btn btn-ghost btn-sm min-h-11" @click="abrirEditar(c)">Editar</button>
                <button
                  class="btn btn-ghost btn-sm min-h-11 text-error"
                  :disabled="eliminando === c.id || (c._count?.inscripciones ?? 0) > 0"
                  @click="eliminarCurso(c)"
                >
                  <span v-if="eliminando === c.id" class="loading loading-spinner loading-xs"></span>
                  <span v-else>Eliminar</span>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── Tab Materias ────────────────────────────────────────────────────── -->
    <div v-if="tab === 'materias'" class="card bg-base-100 shadow overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Código</th>
            <th>Horas/semana</th>
            <th>Asignaciones</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cargando" v-for="i in 4" :key="i">
            <td colspan="5"><div class="skeleton h-4 w-full"></div></td>
          </tr>
          <tr v-else-if="materias.length === 0">
            <td colspan="5" class="text-center text-base-content/40 py-8">
              No hay materias — creá las que se dictan en el colegio.
            </td>
          </tr>
          <tr v-else v-for="m in materias" :key="m.id" class="hover">
            <td class="font-medium">{{ m.nombre }}</td>
            <td class="font-mono text-sm">{{ m.codigo }}</td>
            <td class="text-center">{{ m.horasSemanales }}h</td>
            <td class="text-center">
              <span class="badge badge-sm badge-ghost">{{ m._count?.asignaciones ?? 0 }}</span>
            </td>
            <td>
              <div class="flex gap-1">
                <button class="btn btn-ghost btn-sm min-h-11" @click="abrirEditar(m)">Editar</button>
                <button
                  class="btn btn-ghost btn-sm min-h-11 text-error"
                  :disabled="eliminando === m.id || (m._count?.asignaciones ?? 0) > 0"
                  @click="eliminarMateria(m)"
                >
                  <span v-if="eliminando === m.id" class="loading loading-spinner loading-xs"></span>
                  <span v-else>Eliminar</span>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── Tab Trimestres ──────────────────────────────────────────────────── -->
    <div v-if="tab === 'trimestres'" class="card bg-base-100 shadow overflow-x-auto">
      <div v-if="trimestres.length === 3" role="alert" class="alert alert-info m-4 mt-4 py-2 text-sm">
        Los 3 trimestres ya están creados. Podés editar fechas mientras no estén cerrados.
      </div>
      <table class="table table-sm">
        <thead>
          <tr>
            <th>N°</th>
            <th>Nombre</th>
            <th>Fecha inicio</th>
            <th>Fecha fin</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="trimestres.length === 0">
            <td colspan="6" class="text-center text-base-content/40 py-8">
              No hay trimestres — creá los 3 para habilitar el registro de notas y asistencia.
            </td>
          </tr>
          <tr v-else v-for="t in trimestres" :key="t.id" class="hover">
            <td class="font-bold text-center">{{ t.numero }}</td>
            <td class="font-medium">{{ t.nombre }}</td>
            <td class="text-sm">{{ formatoFecha(t.fechaInicio) }}</td>
            <td class="text-sm">{{ formatoFecha(t.fechaFin) }}</td>
            <td>
              <StatusBadge :estado="t.cerrado ? 'CERRADO' : 'ABIERTO'" :texto="t.cerrado ? 'Cerrado' : 'Abierto'" />
            </td>
            <td>
              <div class="flex gap-1">
                <button class="btn btn-ghost btn-sm min-h-11" :disabled="t.cerrado" @click="abrirEditar(t)">Editar</button>
                <button
                  v-if="!t.cerrado"
                  class="btn btn-ghost btn-sm min-h-11 text-error"
                  :disabled="cerrando === t.id"
                  @click="cerrarTrimestre(t)"
                >
                  <span v-if="cerrando === t.id" class="loading loading-spinner loading-xs"></span>
                  <span v-else>Cerrar</span>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ── Modal crear/editar ─────────────────────────────────────────────────── -->
  <dialog ref="dialogoEstructura" :open="modalAbierto" class="modal modal-bottom sm:modal-middle"
    role="dialog" aria-modal="true" aria-labelledby="estructura-titulo" @keydown="atraparTeclas">
    <div class="modal-box">
      <h3 id="estructura-titulo" class="font-bold text-lg mb-4">
        {{ modoEdicion ? 'Editar' : 'Nuevo' }}
        {{ tab === 'cursos' ? 'curso' : tab === 'materias' ? 'materia' : 'trimestre' }}
      </h3>

      <div v-if="errorModal" role="alert" class="alert alert-error mb-4 py-2 text-sm">
        <span>{{ errorModal }}</span>
      </div>

      <form class="space-y-3" @submit.prevent="guardar">

        <!-- Form Curso -->
        <template v-if="tab === 'cursos'">
          <p v-if="formCurso.nivel" class="text-xs text-base-content/50 -mt-1">
            Vista previa: {{ nombreCurso({ nivel: formCurso.nivel, grado: formCurso.grado, paralelo: formCurso.paralelo || '?', turno: formCurso.turno }) }}
          </p>
          <div class="grid grid-cols-2 gap-3">
            <fieldset class="fieldset">
              <legend class="fieldset-legend text-xs">Nivel *</legend>
              <select v-model="formCurso.nivel" class="select select-bordered w-full" :disabled="guardando || modoEdicion">
                <option value="" disabled>Seleccionar</option>
                <option v-for="n in NIVELES" :key="n" :value="n">{{ NIVEL_TEXTO[n] }}</option>
              </select>
              <p v-if="modoEdicion" class="text-xs text-base-content/40 mt-1">No editable — crea un curso nuevo si cambia.</p>
            </fieldset>
            <fieldset class="fieldset">
              <legend class="fieldset-legend text-xs">Grado * (1–6)</legend>
              <input v-model.number="formCurso.grado" type="number" min="1" max="6" class="input input-bordered w-full" :disabled="guardando" />
            </fieldset>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <fieldset class="fieldset">
              <legend class="fieldset-legend text-xs">Paralelo * (ej: A, B, C)</legend>
              <input v-model="formCurso.paralelo" type="text" maxlength="2" class="input input-bordered w-full uppercase" :disabled="guardando" />
            </fieldset>
            <fieldset class="fieldset">
              <legend class="fieldset-legend text-xs">Turno</legend>
              <select v-model="formCurso.turno" class="select select-bordered w-full" :disabled="guardando">
                <option v-for="t in TURNOS" :key="t" :value="t">{{ TURNO_TEXTO[t] }}</option>
              </select>
            </fieldset>
          </div>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Capacidad (opcional)</legend>
            <input v-model.number="formCurso.capacidad" type="number" min="1" class="input input-bordered w-full" :disabled="guardando" />
          </fieldset>
        </template>

        <!-- Form Materia -->
        <template v-else-if="tab === 'materias'">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Nombre *</legend>
            <input v-model="formMateria.nombre" type="text" placeholder="Ej: Matemáticas" class="input input-bordered w-full" :disabled="guardando" />
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Código * (ej: MAT, LEN, FIS)</legend>
            <input v-model="formMateria.codigo" type="text" maxlength="6" class="input input-bordered w-full uppercase" :disabled="guardando || modoEdicion" />
            <p v-if="modoEdicion" class="text-xs text-base-content/40 mt-1">El código no se puede cambiar después de creada.</p>
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Horas semanales</legend>
            <input v-model.number="formMateria.horasSemanales" type="number" min="1" max="12" class="input input-bordered w-full" :disabled="guardando" />
          </fieldset>
        </template>

        <!-- Form Trimestre -->
        <template v-else>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Número (1, 2 o 3)</legend>
            <select v-model.number="formTrimestre.numero" class="select select-bordered w-full" :disabled="guardando || modoEdicion">
              <option :value="1">1 — Primer Trimestre</option>
              <option :value="2">2 — Segundo Trimestre</option>
              <option :value="3">3 — Tercer Trimestre</option>
            </select>
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Nombre *</legend>
            <input v-model="formTrimestre.nombre" type="text" class="input input-bordered w-full" :disabled="guardando" />
          </fieldset>
          <div class="grid grid-cols-2 gap-3">
            <fieldset class="fieldset">
              <legend class="fieldset-legend text-xs">Fecha inicio</legend>
              <input v-model="formTrimestre.fechaInicio" type="date" class="input input-bordered w-full" :disabled="guardando" />
            </fieldset>
            <fieldset class="fieldset">
              <legend class="fieldset-legend text-xs">Fecha fin</legend>
              <input v-model="formTrimestre.fechaFin" type="date" class="input input-bordered w-full" :disabled="guardando" />
            </fieldset>
          </div>
        </template>

        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="guardando" @click="cerrarModal">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="guardando">
            <span v-if="guardando" class="loading loading-spinner loading-sm"></span>
            {{ modoEdicion ? 'Guardar cambios' : 'Crear' }}
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="cerrarModal"><button>cerrar</button></form>
  </dialog>
</template>