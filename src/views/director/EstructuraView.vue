<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGestionStore } from '@/stores/gestion.store'
import { gestionApi } from '@/api/gestion.api'
import { cursoApi, materiaApi, trimestreApi, type Curso, type Materia, type Trimestre } from '@/api/estructura.api'

const gestion   = useGestionStore()
const tabActiva = ref<'cursos' | 'materias' | 'trimestres' | 'gestiones'>('cursos')

// ── Datos ─────────────────────────────────────────────────────────────────────
const cursos     = ref<Curso[]>([])
const materias   = ref<Materia[]>([])
const trimestres = ref<Trimestre[]>([])
const gestiones  = ref<any[]>([])
const cargando   = ref(false)
const error      = ref<string | null>(null)

onMounted(async () => {
  await gestion.cargar()
  await cargarTab('cursos')
})

async function cargarTab(tab: typeof tabActiva.value) {
  tabActiva.value = tab
  cargando.value = true
  error.value = null
  try {
    if (tab === 'cursos')     cursos.value     = await cursoApi.getAll(gestion.gestionId ?? undefined)
    if (tab === 'materias')   materias.value   = await materiaApi.getAll()
    if (tab === 'trimestres') trimestres.value = await trimestreApi.getAll(gestion.gestionId ?? undefined)
    if (tab === 'gestiones')  gestiones.value  = await gestionApi.getAll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar datos'
  } finally {
    cargando.value = false
  }
}

// ── Modal genérico ────────────────────────────────────────────────────────────
const modalAbierto = ref(false)
const guardando    = ref(false)
const errorModal   = ref<string | null>(null)
const modoEdicion  = ref(false)
const idEditando   = ref<number | null>(null)

// Formularios por tab
const formCurso     = ref({ nombre: '', nivel: '', paralelo: '', gestionId: gestion.gestionId ?? 0 })
const formMateria   = ref({ nombre: '', codigo: '', horasSemanales: 4 })
const formTrimestre = ref({ numero: 1, nombre: '', gestionId: gestion.gestionId ?? 0, fechaInicio: '', fechaFin: '' })
const formGestion   = ref({ anio: new Date().getFullYear() + 1, descripcion: '' })

function abrirCrear() {
  modoEdicion.value = false
  idEditando.value  = null
  errorModal.value  = null
  if (tabActiva.value === 'cursos')     formCurso.value     = { nombre: '', nivel: '', paralelo: '', gestionId: gestion.gestionId ?? 0 }
  if (tabActiva.value === 'materias')   formMateria.value   = { nombre: '', codigo: '', horasSemanales: 4 }
  if (tabActiva.value === 'trimestres') formTrimestre.value = { numero: 1, nombre: '', gestionId: gestion.gestionId ?? 0, fechaInicio: '', fechaFin: '' }
  if (tabActiva.value === 'gestiones')  formGestion.value   = { anio: new Date().getFullYear() + 1, descripcion: '' }
  modalAbierto.value = true
}

function abrirEditar(item: any) {
  modoEdicion.value = true
  idEditando.value  = item.id
  errorModal.value  = null
  if (tabActiva.value === 'cursos')     formCurso.value     = { nombre: item.nombre, nivel: item.nivel, paralelo: item.paralelo, gestionId: item.gestionId }
  if (tabActiva.value === 'materias')   formMateria.value   = { nombre: item.nombre, codigo: item.codigo, horasSemanales: item.horasSemanales }
  if (tabActiva.value === 'trimestres') formTrimestre.value = { numero: item.numero, nombre: item.nombre, gestionId: item.gestionId, fechaInicio: item.fechaInicio?.split('T')[0] ?? '', fechaFin: item.fechaFin?.split('T')[0] ?? '' }
  modalAbierto.value = true
}

async function guardar() {
  guardando.value = true
  errorModal.value = null
  try {
    if (tabActiva.value === 'cursos') {
      if (modoEdicion.value && idEditando.value) {
        const u = await cursoApi.update(idEditando.value, formCurso.value)
        const i = cursos.value.findIndex(c => c.id === idEditando.value)
        if (i !== -1) cursos.value[i] = { ...cursos.value[i], ...u }
      } else {
        cursos.value.unshift(await cursoApi.create(formCurso.value))
      }
    }
    if (tabActiva.value === 'materias') {
      if (modoEdicion.value && idEditando.value) {
        const u = await materiaApi.update(idEditando.value, formMateria.value)
        const i = materias.value.findIndex(m => m.id === idEditando.value)
        if (i !== -1) materias.value[i] = { ...materias.value[i], ...u }
      } else {
        materias.value.unshift(await materiaApi.create(formMateria.value))
      }
    }
    if (tabActiva.value === 'trimestres') {
      if (modoEdicion.value && idEditando.value) {
        const u = await trimestreApi.update(idEditando.value, formTrimestre.value)
        const i = trimestres.value.findIndex(t => t.id === idEditando.value)
        if (i !== -1) trimestres.value[i] = { ...trimestres.value[i], ...u }
      } else {
        trimestres.value.push(await trimestreApi.create(formTrimestre.value))
      }
    }
    if (tabActiva.value === 'gestiones') {
      gestiones.value.unshift(await gestionApi.create(formGestion.value))
    }
    modalAbierto.value = false
  } catch (e) {
    errorModal.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    guardando.value = false
  }
}

// ── Cerrar trimestre ──────────────────────────────────────────────────────────
const cerrandoId = ref<number | null>(null)

async function cerrarTrimestre(id: number, nombre: string) {
  if (!confirm(`¿Cerrar "${nombre}"? Las calificaciones quedarán bloqueadas.`)) return
  cerrandoId.value = id
  try {
    await trimestreApi.cerrar(id)
    const i = trimestres.value.findIndex(t => t.id === id)
    if (i !== -1) trimestres.value[i].cerrado = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cerrar trimestre'
  } finally {
    cerrandoId.value = null
  }
}

// ── Activar gestión ───────────────────────────────────────────────────────────
const activandoId = ref<number | null>(null)

async function activarGestion(id: number) {
  if (!confirm('¿Activar esta gestión? La gestión actual quedará inactiva.')) return
  activandoId.value = id
  try {
    await gestionApi.activar(id)
    gestiones.value.forEach(g => g.activa = g.id === id)
    // Recargar el store para reflejar el cambio
    gestion.limpiar()
    await gestion.cargar()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al activar gestión'
  } finally {
    activandoId.value = null
  }
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-2xl font-bold">Estructura Académica</h2>
    <p class="text-sm text-base-content/60">Gestión activa: <strong>{{ gestion.anio }}</strong></p>

    <!-- Tabs -->
    <div role="tablist" class="tabs tabs-bordered">
      <button role="tab" class="tab" :class="tabActiva === 'cursos' && 'tab-active'" @click="cargarTab('cursos')">Cursos</button>
      <button role="tab" class="tab" :class="tabActiva === 'materias' && 'tab-active'" @click="cargarTab('materias')">Materias</button>
      <button role="tab" class="tab" :class="tabActiva === 'trimestres' && 'tab-active'" @click="cargarTab('trimestres')">Trimestres</button>
      <button role="tab" class="tab" :class="tabActiva === 'gestiones' && 'tab-active'" @click="cargarTab('gestiones')">Gestiones</button>
    </div>

    <div v-if="error" role="alert" class="alert alert-error"><span>{{ error }}</span></div>

    <!-- Encabezado de tabla -->
    <div class="flex justify-end">
      <button class="btn btn-primary btn-sm" @click="abrirCrear">
        + Nuevo {{ tabActiva === 'cursos' ? 'curso' : tabActiva === 'materias' ? 'materia' : tabActiva === 'trimestres' ? 'trimestre' : 'gestión' }}
      </button>
    </div>

    <!-- ── CURSOS ── -->
    <div v-if="tabActiva === 'cursos'" class="card bg-base-100 shadow overflow-x-auto">
      <table class="table table-sm">
        <thead><tr><th>Nombre</th><th>Nivel</th><th>Paralelo</th><th>Estudiantes</th><th>Asignaciones</th><th></th></tr></thead>
        <tbody>
          <tr v-if="cargando" v-for="i in 4" :key="i"><td colspan="6"><div class="skeleton h-4 w-full"></div></td></tr>
          <tr v-else v-for="c in cursos" :key="c.id" class="hover">
            <td class="font-medium">{{ c.nombre }}</td>
            <td>{{ c.nivel }}</td>
            <td>{{ c.paralelo }}</td>
            <td><span class="badge badge-sm badge-ghost">{{ c._count.inscripciones }}</span></td>
            <td><span class="badge badge-sm badge-ghost">{{ c._count.asignaciones }}</span></td>
            <td><button class="btn btn-ghost btn-xs" @click="abrirEditar(c)">Editar</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── MATERIAS ── -->
    <div v-if="tabActiva === 'materias'" class="card bg-base-100 shadow overflow-x-auto">
      <table class="table table-sm">
        <thead><tr><th>Nombre</th><th>Código</th><th>Hrs/semana</th><th>Asignaciones</th><th></th></tr></thead>
        <tbody>
          <tr v-if="cargando" v-for="i in 4" :key="i"><td colspan="5"><div class="skeleton h-4 w-full"></div></td></tr>
          <tr v-else v-for="m in materias" :key="m.id" class="hover">
            <td class="font-medium">{{ m.nombre }}</td>
            <td class="font-mono text-sm">{{ m.codigo }}</td>
            <td>{{ m.horasSemanales }}</td>
            <td><span class="badge badge-sm badge-ghost">{{ m._count.asignaciones }}</span></td>
            <td><button class="btn btn-ghost btn-xs" @click="abrirEditar(m)">Editar</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── TRIMESTRES ── -->
    <div v-if="tabActiva === 'trimestres'" class="card bg-base-100 shadow overflow-x-auto">
      <table class="table table-sm">
        <thead><tr><th>N°</th><th>Nombre</th><th>Fecha inicio</th><th>Fecha fin</th><th>Calificaciones</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          <tr v-if="cargando" v-for="i in 3" :key="i"><td colspan="7"><div class="skeleton h-4 w-full"></div></td></tr>
          <tr v-else v-for="t in trimestres" :key="t.id" class="hover">
            <td class="font-bold text-lg">{{ t.numero }}</td>
            <td class="font-medium">{{ t.nombre }}</td>
            <td class="text-sm text-base-content/60">{{ t.fechaInicio ? new Date(t.fechaInicio).toLocaleDateString('es-BO') : '—' }}</td>
            <td class="text-sm text-base-content/60">{{ t.fechaFin ? new Date(t.fechaFin).toLocaleDateString('es-BO') : '—' }}</td>
            <td><span class="badge badge-sm badge-ghost">{{ t._count.calificaciones }}</span></td>
            <td>
              <span class="badge badge-sm" :class="t.cerrado ? 'badge-ghost' : 'badge-primary'">
                {{ t.cerrado ? '🔒 Cerrado' : '✏️ Activo' }}
              </span>
            </td>
            <td class="flex gap-1">
              <button v-if="!t.cerrado" class="btn btn-ghost btn-xs" @click="abrirEditar(t)">Editar</button>
              <button v-if="!t.cerrado" class="btn btn-warning btn-xs"
                :disabled="cerrandoId === t.id"
                @click="cerrarTrimestre(t.id, t.nombre)">
                <span v-if="cerrandoId === t.id" class="loading loading-xs loading-spinner"></span>
                <span v-else>Cerrar</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── GESTIONES ── -->
    <div v-if="tabActiva === 'gestiones'" class="card bg-base-100 shadow overflow-x-auto">
      <table class="table table-sm">
        <thead><tr><th>Año</th><th>Descripción</th><th>Cursos</th><th>Inscripciones</th><th>Trimestres</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          <tr v-if="cargando" v-for="i in 3" :key="i"><td colspan="7"><div class="skeleton h-4 w-full"></div></td></tr>
          <tr v-else v-for="g in gestiones" :key="g.id" class="hover">
            <td class="font-bold text-lg">{{ g.anio }}</td>
            <td class="text-sm text-base-content/60">{{ g.descripcion }}</td>
            <td><span class="badge badge-sm badge-ghost">{{ g._count?.cursos ?? 0 }}</span></td>
            <td><span class="badge badge-sm badge-ghost">{{ g._count?.inscripciones ?? 0 }}</span></td>
            <td><span class="badge badge-sm badge-ghost">{{ g._count?.trimestres ?? 0 }}</span></td>
            <td>
              <span class="badge badge-sm" :class="g.activa ? 'badge-success' : 'badge-ghost'">
                {{ g.activa ? 'Activa' : 'Inactiva' }}
              </span>
            </td>
            <td>
              <button v-if="!g.activa" class="btn btn-ghost btn-xs"
                :disabled="activandoId === g.id"
                @click="activarGestion(g.id)">
                <span v-if="activandoId === g.id" class="loading loading-xs loading-spinner"></span>
                <span v-else>Activar</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>

  <!-- ── Modal ─────────────────────────────────────────────────────────────── -->
  <dialog :open="modalAbierto" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">
        {{ modoEdicion ? 'Editar' : 'Nuevo' }}
        {{ tabActiva === 'cursos' ? 'curso' : tabActiva === 'materias' ? 'materia' : tabActiva === 'trimestres' ? 'trimestre' : 'gestión' }}
      </h3>

      <div v-if="errorModal" role="alert" class="alert alert-error mb-4 py-2 text-sm">
        <span>{{ errorModal }}</span>
      </div>

      <form class="space-y-3" @submit.prevent="guardar">

        <!-- Curso -->
        <template v-if="tabActiva === 'cursos'">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Nombre *</legend>
            <input v-model="formCurso.nombre" type="text" placeholder="Ej: 1ro Sec A" class="input input-bordered w-full" />
          </fieldset>
          <div class="grid grid-cols-2 gap-3">
            <fieldset class="fieldset">
              <legend class="fieldset-legend text-xs">Nivel *</legend>
              <input v-model="formCurso.nivel" type="text" placeholder="Ej: 1ro Sec" class="input input-bordered w-full" />
            </fieldset>
            <fieldset class="fieldset">
              <legend class="fieldset-legend text-xs">Paralelo *</legend>
              <input v-model="formCurso.paralelo" type="text" placeholder="Ej: A" class="input input-bordered w-full" />
            </fieldset>
          </div>
        </template>

        <!-- Materia -->
        <template v-else-if="tabActiva === 'materias'">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Nombre *</legend>
            <input v-model="formMateria.nombre" type="text" placeholder="Ej: Matemáticas" class="input input-bordered w-full" />
          </fieldset>
          <div class="grid grid-cols-2 gap-3">
            <fieldset class="fieldset">
              <legend class="fieldset-legend text-xs">Código *</legend>
              <input v-model="formMateria.codigo" type="text" placeholder="Ej: MAT" class="input input-bordered w-full" :disabled="modoEdicion" />
            </fieldset>
            <fieldset class="fieldset">
              <legend class="fieldset-legend text-xs">Horas/semana</legend>
              <input v-model="formMateria.horasSemanales" type="number" min="1" max="20" class="input input-bordered w-full" />
            </fieldset>
          </div>
        </template>

        <!-- Trimestre -->
        <template v-else-if="tabActiva === 'trimestres'">
          <div class="grid grid-cols-2 gap-3">
            <fieldset class="fieldset">
              <legend class="fieldset-legend text-xs">Número (1–3) *</legend>
              <input v-model="formTrimestre.numero" type="number" min="1" max="3" class="input input-bordered w-full" :disabled="modoEdicion" />
            </fieldset>
            <fieldset class="fieldset">
              <legend class="fieldset-legend text-xs">Nombre *</legend>
              <input v-model="formTrimestre.nombre" type="text" placeholder="Ej: Primer Trimestre" class="input input-bordered w-full" />
            </fieldset>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <fieldset class="fieldset">
              <legend class="fieldset-legend text-xs">Fecha inicio</legend>
              <input v-model="formTrimestre.fechaInicio" type="date" class="input input-bordered w-full" />
            </fieldset>
            <fieldset class="fieldset">
              <legend class="fieldset-legend text-xs">Fecha fin</legend>
              <input v-model="formTrimestre.fechaFin" type="date" class="input input-bordered w-full" />
            </fieldset>
          </div>
        </template>

        <!-- Gestión -->
        <template v-else-if="tabActiva === 'gestiones'">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Año *</legend>
            <input v-model="formGestion.anio" type="number" min="2020" max="2050" class="input input-bordered w-full" />
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Descripción</legend>
            <input v-model="formGestion.descripcion" type="text" placeholder="Ej: Gestión Escolar 2026" class="input input-bordered w-full" />
          </fieldset>
        </template>

        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="guardando" @click="modalAbierto = false">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="guardando">
            <span v-if="guardando" class="loading loading-spinner loading-sm"></span>
            {{ modoEdicion ? 'Guardar cambios' : 'Crear' }}
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalAbierto = false"><button>cerrar</button></form>
  </dialog>
</template>