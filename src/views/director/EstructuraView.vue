<script setup lang="ts">
/**
 * EstructuraView — ¿Para qué existe esta vista?
 *
 * Antes de que el sistema funcione, el Director debe configurar
 * la "estructura académica" del año: qué cursos existen, qué materias
 * se dictan y cuándo son los trimestres.
 *
 * Sin esta configuración, la Secretaria no puede inscribir estudiantes
 * (no hay cursos), el docente no puede pasar asistencia (no hay trimestres),
 * y los boletines no se pueden generar. Es el paso 0 de cada gestión.
 *
 * ¿Por qué tres tabs en una sola vista?
 * Cursos, materias y trimestres son conceptos relacionados pero independientes.
 * El Director configura los tres al inicio del año — tenerlos juntos
 * evita navegar a tres secciones distintas para una tarea que se hace junta.
 */
import { ref, computed, onMounted } from 'vue'
import { cursoApi, materiaApi, trimestreApi, type Curso, type Materia, type Trimestre } from '@/api/estructura.api'
import { useGestionStore } from '@/stores/gestion.store'

const gestion = useGestionStore()

// ─── Tab activo ───────────────────────────────────────────────────────────────
type Tab = 'cursos' | 'materias' | 'trimestres'
const tab = ref<Tab>('cursos')

// ─── Datos ────────────────────────────────────────────────────────────────────
const cursos     = ref<Curso[]>([])
const materias   = ref<Materia[]>([])
const trimestres = ref<Trimestre[]>([])
const cargando   = ref(false)
const error      = ref<string | null>(null)

// ─── Modal compartido ─────────────────────────────────────────────────────────
// ¿Por qué un solo modal para los tres tabs?
// El patrón es siempre el mismo: abrir modal → completar form → guardar → cerrar.
// Los campos cambian según el tab, pero la lógica es idéntica.
// Un solo modal con v-if por tab es más mantenible que tres modales separados.
const modalAbierto = ref(false)
const guardando    = ref(false)
const errorModal   = ref<string | null>(null)
const modoEdicion  = ref(false)
const idEditando   = ref<number | null>(null)

// Forms por tab
const formCurso = ref({ nombre: '', nivel: '', paralelo: '' })
const formMateria = ref({ nombre: '', codigo: '', horasSemanales: 4 })
const formTrimestre = ref({ numero: 1, nombre: '', fechaInicio: '', fechaFin: '' })

// ─── Carga inicial ────────────────────────────────────────────────────────────
onMounted(async () => {
  await gestion.cargar()
  await Promise.all([cargarCursos(), cargarMaterias(), cargarTrimestres()])
})

async function cargarCursos() {
  cargando.value = true
  try {
    // Sin gestionId → el backend devuelve los de la gestión activa.
    // ¿Por qué no pasamos gestion.gestionId explícitamente?
    // Porque si la gestión aún no cargó, gestionId sería null y la llamada
    // fallaría. El backend tiene el fallback "activa" para exactamente este caso.
    cursos.value = await cursoApi.getAll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar cursos'
  } finally {
    cargando.value = false
  }
}

async function cargarMaterias() {
  try {
    // ¿Por qué materias no necesita gestionId?
    // Porque las materias son institucionales — "Matemáticas" existe siempre,
    // independientemente del año. Lo que cambia cada año es la ASIGNACIÓN
    // de un docente a esa materia (eso vive en DocenteMateriaCurso).
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

// ─── Abrir modales ────────────────────────────────────────────────────────────
function abrirCrear() {
  modoEdicion.value = false
  idEditando.value  = null
  errorModal.value  = null
  if (tab.value === 'cursos') {
    formCurso.value = { nombre: '', nivel: '', paralelo: '' }
  } else if (tab.value === 'materias') {
    formMateria.value = { nombre: '', codigo: '', horasSemanales: 4 }
  } else {
    // ¿Por qué sugerir el número del siguiente trimestre?
    // El Director crea los 3 trimestres en orden — pre-llenar el número
    // ahorra un click y evita errores de orden.
    const existentes = trimestres.value.length
    formTrimestre.value = {
      numero: Math.min(existentes + 1, 3),
      nombre: existentes === 0 ? 'Primer Trimestre' : existentes === 1 ? 'Segundo Trimestre' : 'Tercer Trimestre',
      fechaInicio: '',
      fechaFin: '',
    }
  }
  modalAbierto.value = true
}

function abrirEditar(item: Curso | Materia | Trimestre) {
  modoEdicion.value = true
  idEditando.value  = item.id
  errorModal.value  = null
  if (tab.value === 'cursos') {
    const c = item as Curso
    formCurso.value = { nombre: c.nombre, nivel: c.nivel, paralelo: c.paralelo }
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
  modalAbierto.value = true
}

// ─── Guardar ──────────────────────────────────────────────────────────────────
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
  } catch (e) {
    errorModal.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    guardando.value = false
  }
}

async function guardarCurso() {
  const f = formCurso.value
  if (!f.nombre || !f.nivel || !f.paralelo) throw new Error('Nombre, nivel y paralelo son obligatorios')
  if (!gestion.gestionId) throw new Error('No hay gestión activa')
  if (modoEdicion.value && idEditando.value) {
    const updated = await cursoApi.update(idEditando.value, f)
    const idx = cursos.value.findIndex(c => c.id === idEditando.value)
    if (idx !== -1) cursos.value[idx] = updated
  } else {
    const nuevo = await cursoApi.create({ ...f, gestionId: gestion.gestionId })
    cursos.value.push(nuevo)
    // Recargar el store de gestión para que los nuevos cursos
    // aparezcan en el selector de inscripciones y asignaciones
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
      numero:      f.numero,
      nombre:      f.nombre,
      gestionId:   gestion.gestionId,
      fechaInicio: f.fechaInicio || undefined,
      fechaFin:    f.fechaFin    || undefined,
    })
    trimestres.value.push(nuevo)
    // Recargar el store para que trimestreActivo se actualice en
    // AsistenciaView y CalificacionesView
    await gestion.recargar()
  }
}

// ─── Cerrar trimestre ─────────────────────────────────────────────────────────
// ¿Por qué es una acción separada del editar?
// Cerrar un trimestre es IRREVERSIBLE — bloquea todas las notas y asistencias
// de ese período. No es un campo que se edita, es una acción que se confirma.
// Por eso tiene su propio botón con confirmación explícita del usuario.
const cerrando = ref<number | null>(null)

async function cerrarTrimestre(t: Trimestre) {
  if (!confirm(`¿Cerrar "${t.nombre}"? Esta acción no se puede deshacer — las notas quedarán bloqueadas.`)) return
  cerrando.value = t.id
  try {
    await trimestreApi.cerrar(t.id)
    const idx = trimestres.value.findIndex(x => x.id === t.id)
    if (idx !== -1) trimestres.value[idx].cerrado = true
    await gestion.recargar()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cerrar trimestre'
  } finally {
    cerrando.value = null
  }
}

// ─── Eliminar curso ───────────────────────────────────────────────────────────
const eliminando = ref<number | null>(null)

async function eliminarCurso(c: Curso) {
  if (!confirm(`¿Eliminar el curso "${c.nombre}"?`)) return
  eliminando.value = c.id
  try {
    await cursoApi.delete(c.id)
    cursos.value = cursos.value.filter(x => x.id !== c.id)
    await gestion.recargar()
  } catch (e) {
    // ¿Por qué mostrar el error del backend directamente?
    // El backend devuelve mensajes como "No se puede eliminar — el curso
    // tiene 12 estudiantes inscritos". Es más útil que un mensaje genérico.
    error.value = e instanceof Error ? e.message : 'Error al eliminar'
  } finally {
    eliminando.value = null
  }
}

// Niveles predefinidos según el sistema boliviano (secundaria)
const NIVELES = [
  'Primero Secundaria', 'Segundo Secundaria', 'Tercero Secundaria',
  'Cuarto Secundaria',  'Quinto Secundaria',  'Sexto Secundaria',
]
</script>

<template>
  <div class="space-y-4">

    <!-- Encabezado -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <div class="flex-1">
        <h2 class="text-2xl font-bold">Estructura académica</h2>
        <p class="text-sm text-base-content/60">
          Gestión {{ gestion.anio ?? '—' }}
        </p>
      </div>
      <button class="btn btn-primary btn-sm" @click="abrirCrear">
        + Nuevo {{ tab === 'cursos' ? 'curso' : tab === 'materias' ? 'materia' : 'trimestre' }}
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" role="alert" class="alert alert-error">
      <span>{{ error }}</span>
      <button class="btn btn-sm btn-ghost" @click="error = null">×</button>
    </div>

    <!-- Tabs -->
    <div role="tablist" class="tabs tabs-boxed w-fit">
      <button role="tab" class="tab" :class="{ 'tab-active': tab === 'cursos' }" @click="tab = 'cursos'">
        Cursos <span class="ml-1 badge badge-xs badge-ghost">{{ cursos.length }}</span>
      </button>
      <button role="tab" class="tab" :class="{ 'tab-active': tab === 'materias' }" @click="tab = 'materias'">
        Materias <span class="ml-1 badge badge-xs badge-ghost">{{ materias.length }}</span>
      </button>
      <button role="tab" class="tab" :class="{ 'tab-active': tab === 'trimestres' }" @click="tab = 'trimestres'">
        Trimestres <span class="ml-1 badge badge-xs badge-ghost">{{ trimestres.length }}</span>
      </button>
    </div>

    <!-- ── Tab Cursos ──────────────────────────────────────────────────────── -->
    <div v-if="tab === 'cursos'" class="card bg-base-100 shadow overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Nivel</th>
            <th>Paralelo</th>
            <th>Inscritos</th>
            <th>Asignaciones</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cargando" v-for="i in 4" :key="i">
            <td colspan="6"><div class="skeleton h-4 w-full"></div></td>
          </tr>
          <tr v-else-if="cursos.length === 0">
            <td colspan="6" class="text-center text-base-content/40 py-8">
              No hay cursos — creá el primero para poder inscribir estudiantes.
            </td>
          </tr>
          <tr v-else v-for="c in cursos" :key="c.id" class="hover">
            <td class="font-medium">{{ c.nombre }}</td>
            <td class="text-sm">{{ c.nivel }}</td>
            <td class="text-center">{{ c.paralelo }}</td>
            <td class="text-center">
              <span class="badge badge-sm badge-ghost">{{ c._count?.inscripciones ?? 0 }}</span>
            </td>
            <td class="text-center">
              <span class="badge badge-sm badge-ghost">{{ c._count?.asignaciones ?? 0 }}</span>
            </td>
            <td>
              <div class="flex gap-1">
                <button class="btn btn-ghost btn-xs" @click="abrirEditar(c)">Editar</button>
                <button
                  class="btn btn-ghost btn-xs text-error"
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
              <button class="btn btn-ghost btn-xs" @click="abrirEditar(m)">Editar</button>
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
            <td class="text-sm">{{ t.fechaInicio ? new Date(t.fechaInicio).toLocaleDateString('es-BO') : '—' }}</td>
            <td class="text-sm">{{ t.fechaFin    ? new Date(t.fechaFin).toLocaleDateString('es-BO')    : '—' }}</td>
            <td>
              <span class="badge badge-sm" :class="t.cerrado ? 'badge-error' : 'badge-success'">
                {{ t.cerrado ? 'Cerrado' : 'Abierto' }}
              </span>
            </td>
            <td>
              <div class="flex gap-1">
                <button
                  class="btn btn-ghost btn-xs"
                  :disabled="t.cerrado"
                  @click="abrirEditar(t)"
                >
                  Editar
                </button>
                <button
                  v-if="!t.cerrado"
                  class="btn btn-ghost btn-xs text-error"
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
  <dialog :open="modalAbierto" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">
        {{ modoEdicion ? 'Editar' : 'Nuevo' }}
        {{ tab === 'cursos' ? 'curso' : tab === 'materias' ? 'materia' : 'trimestre' }}
      </h3>

      <div v-if="errorModal" role="alert" class="alert alert-error mb-4 py-2 text-sm">
        <span>{{ errorModal }}</span>
      </div>

      <form class="space-y-3" @submit.prevent="guardar">

        <!-- Form Curso -->
        <template v-if="tab === 'cursos'">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Nombre * (ej: 1ro Sec A)</legend>
            <input v-model="formCurso.nombre" type="text" class="input input-bordered w-full" :disabled="guardando" />
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Nivel *</legend>
            <select v-model="formCurso.nivel" class="select select-bordered w-full" :disabled="guardando">
              <option value="" disabled>Seleccionar nivel</option>
              <option v-for="n in NIVELES" :key="n" :value="n">{{ n }}</option>
            </select>
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Paralelo * (ej: A, B, C)</legend>
            <input v-model="formCurso.paralelo" type="text" maxlength="2" class="input input-bordered w-full uppercase" :disabled="guardando" />
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