<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { estudianteApi, type EstudiantePayload, type CambiarEstadoPayload } from '@/api/estudiante.api'
import { useGestionStore } from '@/stores/gestion.store'
import type { Estudiante, Inscripcion, EstadoInscripcion, Nivel } from '@/types'

const gestion = useGestionStore()

// ─── Estado principal ─────────────────────────────────────────────────────────
const estudiantes = ref<Estudiante[]>([])
const cargando    = ref(true)
const error       = ref<string | null>(null)
const busqueda    = ref('')

// ─── Modal crear/editar estudiante ───────────────────────────────────────────
const modalAbierto = ref(false)
const guardando    = ref(false)
const errorModal   = ref<string | null>(null)
const modoEdicion  = ref(false)
const idEditando   = ref<number | null>(null)

const formVacio = (): EstudiantePayload => ({
  nombre: '', apellido: '', ci: '', fechaNacimiento: '', direccion: '',
})
const form = ref<EstudiantePayload>(formVacio())

// ─── Modal inscribir ──────────────────────────────────────────────────────────
// ¿Por qué modal separado?
// Inscribir es una acción administrativa distinta a crear el perfil.
// Un estudiante puede existir en el sistema sin estar inscrito en ningún curso
// (ej: alumno nuevo que aún no se asignó a un curso), o puede estar inscrito
// en varios años distintos. Por eso "crear estudiante" e "inscribir" son dos
// pasos separados.
const modalInscripcion  = ref(false)
const inscribiendo      = ref(false)
const errorInscripcion  = ref<string | null>(null)
const estudianteAInscribir = ref<Estudiante | null>(null)
const formInscripcion = ref({ cursoId: '' as number | '', gestionId: '' as number | '' })

// ─── Modal cambiar estado inscripción ────────────────────────────────────────
// ¿Para qué? Si un estudiante se retira, no borramos la inscripción —
// la marcamos como RETIRADA con fecha para mantener el historial académico.
// Es un requisito común en sistemas educativos bolivianos.
const modalEstado      = ref(false)
const cambiandoEstado  = ref(false)
const errorEstado      = ref<string | null>(null)
const inscripcionActiva = ref<Inscripcion | null>(null)
const formEstado = ref<CambiarEstadoPayload>({
  estadoInscripcion: 'ACTIVA',
  fechaRetiro: '',
  observaciones: '',
})

// ─── Carga inicial ────────────────────────────────────────────────────────────
onMounted(async () => {
  await gestion.cargar()
  await cargar()
})

async function cargar() {
  cargando.value = true
  error.value = null
  try {
    estudiantes.value = await estudianteApi.getAll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar estudiantes'
  } finally {
    cargando.value = false
  }
}

// ─── Filtro local ─────────────────────────────────────────────────────────────
const estudiantesFiltrados = computed(() => {
  const q = busqueda.value.toLowerCase().trim()
  if (!q) return estudiantes.value
  return estudiantes.value.filter(e =>
    `${e.nombre} ${e.apellido} ${e.ci}`.toLowerCase().includes(q)
  )
})

// ─── Helpers de inscripción ───────────────────────────────────────────────────
// ¿Para qué? La lista GET /estudiantes incluye la última inscripción (take:1)
// para poder mostrar en qué curso está el estudiante sin otra llamada al backend.
function ultimaInscripcion(e: Estudiante): Inscripcion | null {
  return e.inscripciones?.[0] ?? null
}

function badgeEstado(estado: EstadoInscripcion): string {
  const clases: Record<EstadoInscripcion, string> = {
    ACTIVA:      'badge-success',
    RETIRADA:    'badge-error',
    TRANSFERIDA: 'badge-warning',
    CONCLUIDA:   'badge-ghost',
  }
  return clases[estado] ?? 'badge-neutral'
}

// ⚠️ el curso embebido en Estudiante.inscripciones (GET /estudiantes) no
// trae "nombre" calculado — solo nivel/grado/paralelo (sin turno). Se
// arma acá igual que en las demás vistas.
const NIVEL_TEXTO: Record<Nivel, string> = { PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
function nombreCursoDeInscripcion(insc: Inscripcion | null): string {
  const c = insc?.curso
  if (!c) return '—'
  return `${c.grado}° ${NIVEL_TEXTO[c.nivel]} "${c.paralelo}"`
}

// ─── Crear / Editar estudiante ────────────────────────────────────────────────
function abrirCrear() {
  modoEdicion.value = false
  idEditando.value  = null
  form.value        = formVacio()
  errorModal.value  = null
  modalAbierto.value = true
}

function abrirEditar(e: Estudiante) {
  modoEdicion.value = true
  idEditando.value  = e.id
  form.value = {
    nombre:          e.nombre,
    apellido:        e.apellido,
    ci:              e.ci,
    fechaNacimiento: e.fechaNacimiento ?? '',
    direccion:       e.direccion ?? '',
  }
  errorModal.value  = null
  modalAbierto.value = true
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
      if (idx !== -1) estudiantes.value[idx] = actualizado
    } else {
      const nuevo = await estudianteApi.create(form.value)
      estudiantes.value.unshift(nuevo)
    }
    modalAbierto.value = false
  } catch (e) {
    errorModal.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    guardando.value = false
  }
}

// ─── Inscribir estudiante ─────────────────────────────────────────────────────
function abrirInscripcion(e: Estudiante) {
  estudianteAInscribir.value = e
  formInscripcion.value = {
    cursoId:   '',
    gestionId: gestion.gestionId ?? '',
  }
  errorInscripcion.value = null
  modalInscripcion.value = true
}

async function inscribir() {
  if (!formInscripcion.value.cursoId || !formInscripcion.value.gestionId) {
    errorInscripcion.value = 'Seleccioná curso y gestión'
    return
  }
  inscribiendo.value     = true
  errorInscripcion.value = null
  try {
    await estudianteApi.inscribir({
      estudianteId: estudianteAInscribir.value!.id,
      cursoId:      Number(formInscripcion.value.cursoId),
      gestionId:    Number(formInscripcion.value.gestionId),
    })
    modalInscripcion.value = false
    // Recargar para ver la inscripción actualizada
    await cargar()
  } catch (e) {
    errorInscripcion.value = e instanceof Error ? e.message : 'Error al inscribir'
  } finally {
    inscribiendo.value = false
  }
}

// ─── Cambiar estado de inscripción ────────────────────────────────────────────
function abrirCambiarEstado(insc: Inscripcion) {
  inscripcionActiva.value = insc
  formEstado.value = {
    estadoInscripcion: insc.estadoInscripcion,
    fechaRetiro:       '',
    observaciones:     '',
  }
  errorEstado.value  = null
  modalEstado.value  = true
}

async function cambiarEstado() {
  if (!inscripcionActiva.value) return
  cambiandoEstado.value = true
  errorEstado.value     = null
  try {
    await estudianteApi.cambiarEstado(inscripcionActiva.value.id, formEstado.value)
    modalEstado.value = false
    await cargar()
  } catch (e) {
    errorEstado.value = e instanceof Error ? e.message : 'Error al cambiar estado'
  } finally {
    cambiandoEstado.value = false
  }
}

// ¿Para qué mostrar la fecha de retiro?
// Solo cuando el nuevo estado requiere fecha: RETIRADA o TRANSFERIDA.
const requiereFecha = computed(() =>
  ['RETIRADA', 'TRANSFERIDA'].includes(formEstado.value.estadoInscripcion)
)
</script>

<template>
  <div class="space-y-4">

    <!-- Encabezado -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <h2 class="text-2xl font-bold flex-1">Estudiantes</h2>
      <button class="btn btn-primary btn-sm" @click="abrirCrear">
        + Nuevo estudiante
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
            <th>Curso actual</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <!-- Skeleton -->
          <tr v-if="cargando" v-for="i in 6" :key="i">
            <td colspan="5"><div class="skeleton h-4 w-full"></div></td>
          </tr>
          <!-- Sin resultados -->
          <tr v-else-if="estudiantesFiltrados.length === 0">
            <td colspan="5" class="text-center text-base-content/40 py-8">
              No se encontraron estudiantes
            </td>
          </tr>
          <!-- Filas -->
          <tr v-else v-for="e in estudiantesFiltrados" :key="e.id" class="hover">
            <td class="font-medium">{{ e.apellido }}, {{ e.nombre }}</td>
            <td class="font-mono text-sm">{{ e.ci }}</td>
            <td class="text-sm">
              <!-- ¿Para qué mostrar el curso aquí?
                   La secretaria necesita saber de un vistazo en qué curso
                   está cada estudiante sin tener que abrir el detalle. -->
              <span v-if="ultimaInscripcion(e)">
                {{ nombreCursoDeInscripcion(ultimaInscripcion(e)) }}
              </span>
              <span v-else class="text-base-content/30">Sin inscripción</span>
            </td>
            <td>
              <span
                v-if="ultimaInscripcion(e)"
                class="badge badge-sm"
                :class="badgeEstado(ultimaInscripcion(e)!.estadoInscripcion)"
              >
                {{ ultimaInscripcion(e)!.estadoInscripcion }}
              </span>
              <span v-else class="text-base-content/30 text-xs">—</span>
            </td>
            <td>
              <div class="flex gap-1">
                <button class="btn btn-ghost btn-xs" @click="abrirEditar(e)">
                  Editar
                </button>
                <!-- Inscribir: solo si no tiene inscripción activa en la gestión actual -->
                <button
                  class="btn btn-outline btn-xs btn-primary"
                  @click="abrirInscripcion(e)"
                >
                  Inscribir
                </button>
                <!-- Cambiar estado: solo si tiene una inscripción activa -->
                <button
                  v-if="ultimaInscripcion(e)?.estadoInscripcion === 'ACTIVA'"
                  class="btn btn-ghost btn-xs text-warning"
                  @click="abrirCambiarEstado(ultimaInscripcion(e)!)"
                >
                  Estado
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

  <!-- ── Modal crear/editar estudiante ───────────────────────────────────── -->
  <dialog :open="modalAbierto" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">
        {{ modoEdicion ? 'Editar estudiante' : 'Nuevo estudiante' }}
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
          <legend class="fieldset-legend text-xs">Fecha de nacimiento</legend>
          <input v-model="form.fechaNacimiento" type="date" class="input input-bordered w-full" :disabled="guardando" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Dirección</legend>
          <input v-model="form.direccion" type="text" placeholder="Zona, calle, número..." class="input input-bordered w-full" :disabled="guardando" />
        </fieldset>

        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="guardando" @click="modalAbierto = false">
            Cancelar
          </button>
          <button type="submit" class="btn btn-primary" :disabled="guardando">
            <span v-if="guardando" class="loading loading-spinner loading-sm"></span>
            {{ modoEdicion ? 'Guardar cambios' : 'Crear estudiante' }}
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalAbierto = false">
      <button>cerrar</button>
    </form>
  </dialog>

  <!-- ── Modal inscribir ──────────────────────────────────────────────────── -->
  <dialog :open="modalInscripcion" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Inscribir estudiante</h3>
      <p class="text-sm text-base-content/60 mb-4">
        {{ estudianteAInscribir?.nombre }} {{ estudianteAInscribir?.apellido }}
      </p>

      <div v-if="errorInscripcion" role="alert" class="alert alert-error mb-4 py-2 text-sm">
        <span>{{ errorInscripcion }}</span>
      </div>

      <form class="space-y-3" @submit.prevent="inscribir">
        <!-- El gestionId se pre-carga con la gestión activa, pero la secretaria
             puede cambiarlo si necesita inscribir en una gestión anterior. -->
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Gestión *</legend>
          <select v-model="formInscripcion.gestionId" class="select select-bordered w-full" :disabled="inscribiendo">
            <option value="" disabled>Seleccionar gestión</option>
            <option v-if="gestion.gestion" :value="gestion.gestion.id">
              {{ gestion.gestion.anio }} (activa)
            </option>
          </select>
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Curso *</legend>
          <select v-model="formInscripcion.cursoId" class="select select-bordered w-full" :disabled="inscribiendo || !gestion.cursos.length">
            <option value="" disabled>Seleccionar curso</option>
            <option v-for="c in gestion.cursos" :key="c.id" :value="c.id">
              {{ c.nombre }}
            </option>
          </select>
          <p v-if="!gestion.cursos.length" class="text-xs text-base-content/40 mt-1">
            No hay cursos en la gestión activa — creálos primero desde Estructura.
          </p>
        </fieldset>

        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="inscribiendo" @click="modalInscripcion = false">
            Cancelar
          </button>
          <button type="submit" class="btn btn-primary" :disabled="inscribiendo">
            <span v-if="inscribiendo" class="loading loading-spinner loading-sm"></span>
            Inscribir
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalInscripcion = false">
      <button>cerrar</button>
    </form>
  </dialog>

  <!-- ── Modal cambiar estado inscripción ─────────────────────────────────── -->
  <dialog :open="modalEstado" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">Cambiar estado de inscripción</h3>

      <div v-if="errorEstado" role="alert" class="alert alert-error mb-4 py-2 text-sm">
        <span>{{ errorEstado }}</span>
      </div>

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

        <!-- La fecha de retiro solo aparece cuando el estado lo requiere.
             ¿Por qué? RETIRADA y TRANSFERIDA necesitan fecha para el historial,
             pero ACTIVA y CONCLUIDA no tienen fecha de retiro. -->
        <fieldset v-if="requiereFecha" class="fieldset">
          <legend class="fieldset-legend text-xs">Fecha de retiro</legend>
          <input
            v-model="formEstado.fechaRetiro"
            type="date"
            class="input input-bordered w-full"
            :disabled="cambiandoEstado"
          />
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Observaciones</legend>
          <textarea
            v-model="formEstado.observaciones"
            class="textarea textarea-bordered w-full"
            placeholder="Motivo del retiro, destino de transferencia, etc."
            rows="2"
            :disabled="cambiandoEstado"
          ></textarea>
        </fieldset>

        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="cambiandoEstado" @click="modalEstado = false">
            Cancelar
          </button>
          <button type="submit" class="btn btn-warning" :disabled="cambiandoEstado">
            <span v-if="cambiandoEstado" class="loading loading-spinner loading-sm"></span>
            Cambiar estado
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalEstado = false">
      <button>cerrar</button>
    </form>
  </dialog>
</template>