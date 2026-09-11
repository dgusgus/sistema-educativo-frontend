<script setup lang="ts">
/**
 * InscripcionesView — ¿Para qué existe esta vista separada de EstudiantesView?
 *
 * EstudiantesView gestiona los PERFILES de las personas (crear, editar datos personales).
 * InscripcionesView gestiona el acto ACADÉMICO de inscribir a un estudiante en un curso
 * para una gestión específica, y todo lo que pasa después: cambios de estado,
 * resultado final, propuesta para el año siguiente.
 *
 * ¿Por qué la Secretaria necesita una vista dedicada para inscripciones?
 * Al inicio del año escolar la Secretaria procesa decenas o cientos de inscripciones.
 * Hacerlo desde EstudiantesView sería buscar a cada estudiante uno por uno.
 * Acá puede buscar, inscribir y gestionar el estado de inscripciones de forma
 * más eficiente, con filtros por curso y estado.
 */
import { ref, computed, onMounted } from 'vue'
import { estudianteApi, type CambiarEstadoPayload } from '@/api/estudiante.api'
import { useGestionStore } from '@/stores/gestion.store'
import type { Inscripcion, EstadoInscripcion, ResultadoFinal, Nivel } from '@/types'

const gestion = useGestionStore()

// ─── Estado principal ─────────────────────────────────────────────────────────
const inscripciones = ref<Inscripcion[]>([])
const cargando      = ref(true)
const error         = ref<string | null>(null)

// Filtros — ¿por qué filtrar por curso y estado?
// La Secretaria trabaja por curso: primero procesa todas las inscripciones
// de "1ro A", luego "1ro B", etc. El filtro por estado le permite ver
// solo los RETIRADOS para gestionar sus expedientes, o solo los ACTIVOS
// para pasar a asignar resultado al final del año.
const filtroCurso  = ref<number | ''>('')
const filtroEstado = ref<EstadoInscripcion | ''>('')

// ─── Modal inscribir nuevo estudiante ─────────────────────────────────────────
// ¿Por qué este modal acá y no solo en EstudiantesView?
// Porque el flujo común en secretaría es: "tengo la lista de estudiantes
// nuevos, los inscribo uno por uno". Tener el modal acá permite hacerlo
// sin abandonar la vista de inscripciones.
const modalInscribir   = ref(false)
const inscribiendo     = ref(false)
const errorInscripcion = ref<string | null>(null)

// ¿Por qué buscar estudiante por CI y no por ID?
// El ID es un número interno del sistema que la Secretaria no conoce.
// El CI es el documento de identidad que la Secretaria tiene en papel.
const busquedaCI   = ref('')
const estudianteBuscado = ref<{ id: number; nombre: string; apellido: string; ci: string } | null>(null)
const buscandoEst  = ref(false)
const formInscribir = ref({ estudianteId: 0, cursoId: '' as number | '' })

// ─── Modal cambiar estado ─────────────────────────────────────────────────────
const modalEstado     = ref(false)
const cambiandoEstado = ref(false)
const errorEstado     = ref<string | null>(null)
const inscripcionActiva = ref<Inscripcion | null>(null)
const formEstado = ref<CambiarEstadoPayload>({
  estadoInscripcion: 'ACTIVA',
  fechaRetiro: '',
  observaciones: '',
})

// ─── Modal resultado final ────────────────────────────────────────────────────
// ¿Para qué un modal separado para el resultado?
// Porque registrar PROMOVIDO o REPROBADO es una acción de fin de año —
// irreversible en la práctica y con impacto en el historial académico del
// estudiante. Separarla evita que se haga por accidente al editar el estado.
const modalResultado   = ref(false)
const registrandoRes   = ref(false)
const errorResultado   = ref<string | null>(null)
const formResultado    = ref<{ resultado: ResultadoFinal; observaciones: string }>({
  resultado: 'PROMOVIDO',
  observaciones: '',
})

// ─── Carga inicial ────────────────────────────────────────────────────────────
onMounted(async () => {
  await gestion.cargar()
  await cargar()
})

async function cargar() {
  cargando.value = true
  error.value    = null
  try {
    // ¿Por qué traemos estudiantes con filtro de inscripcion en lugar de
    // llamar directamente a un endpoint de inscripciones?
    // Porque el backend no tiene GET /inscripciones (lista), solo
    // GET /inscripciones/:id (individual). La lista se obtiene desde
    // GET /estudiantes que incluye la última inscripción de cada uno.
    const data = await estudianteApi.getAll({
      gestionId: gestion.gestionId ?? undefined,
      ...(filtroEstado.value && { estadoInscripcion: filtroEstado.value }),
      ...(filtroCurso.value  && { cursoId: Number(filtroCurso.value) }),
    })
    // Extraemos las inscripciones de la respuesta de estudiantes
    inscripciones.value = data
      .filter(e => e.inscripciones && e.inscripciones.length > 0)
      .map(e => ({
        ...e.inscripciones![0],
        estudiante: e,
      }))
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar inscripciones'
  } finally {
    cargando.value = false
  }
}

// ─── Buscar estudiante por CI para inscribir ──────────────────────────────────
async function buscarPorCI() {
  if (!busquedaCI.value.trim()) return
  buscandoEst.value      = true
  estudianteBuscado.value = null
  errorInscripcion.value  = null
  try {
    const lista = await estudianteApi.getAll({ search: busquedaCI.value.trim() })
    if (lista.length === 0) {
      errorInscripcion.value = `No se encontró ningún estudiante con CI "${busquedaCI.value}"`
      return
    }
    // ¿Por qué tomar el primero? La búsqueda por CI debería dar un solo resultado
    // porque el CI es único. Si hay más de uno, el primero es el más relevante.
    estudianteBuscado.value = lista[0]
    formInscribir.value.estudianteId = lista[0].id
  } catch (e) {
    errorInscripcion.value = e instanceof Error ? e.message : 'Error al buscar'
  } finally {
    buscandoEst.value = false
  }
}

function abrirInscribir() {
  busquedaCI.value        = ''
  estudianteBuscado.value = null
  formInscribir.value     = { estudianteId: 0, cursoId: '' }
  errorInscripcion.value  = null
  modalInscribir.value    = true
}

async function inscribir() {
  if (!estudianteBuscado.value)     { errorInscripcion.value = 'Buscá un estudiante primero'; return }
  if (!formInscribir.value.cursoId) { errorInscripcion.value = 'Seleccioná un curso'; return }
  if (!gestion.gestionId)           { errorInscripcion.value = 'No hay gestión activa'; return }

  inscribiendo.value     = true
  errorInscripcion.value = null
  try {
    await estudianteApi.inscribir({
      estudianteId: estudianteBuscado.value.id,
      cursoId:      Number(formInscribir.value.cursoId),
      gestionId:    gestion.gestionId,
    })
    modalInscribir.value = false
    await cargar()
  } catch (e) {
    errorInscripcion.value = e instanceof Error ? e.message : 'Error al inscribir'
  } finally {
    inscribiendo.value = false
  }
}

// ─── Cambiar estado ───────────────────────────────────────────────────────────
function abrirCambiarEstado(insc: Inscripcion) {
  inscripcionActiva.value = insc
  formEstado.value = {
    estadoInscripcion: insc.estadoInscripcion,
    fechaRetiro: '',
    observaciones: '',
  }
  errorEstado.value = null
  modalEstado.value = true
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

const requiereFecha = computed(() =>
  ['RETIRADA', 'TRANSFERIDA'].includes(formEstado.value.estadoInscripcion)
)

// ─── Registrar resultado final ────────────────────────────────────────────────
function abrirResultado(insc: Inscripcion) {
  inscripcionActiva.value  = insc
  formResultado.value      = { resultado: 'PROMOVIDO', observaciones: '' }
  errorResultado.value     = null
  modalResultado.value     = true
}

async function registrarResultado() {
  if (!inscripcionActiva.value) return
  registrandoRes.value = true
  errorResultado.value = null
  try {
    await estudianteApi.registrarResultado(
      inscripcionActiva.value.id,
      formResultado.value.resultado,
      formResultado.value.observaciones || undefined,
    )
    modalResultado.value = false
    await cargar()
  } catch (e) {
    // ¿Por qué mostramos el error del backend directamente?
    // Porque cuando los trimestres no están cerrados, el backend devuelve
    // un mensaje muy claro: "No se puede registrar — hay trimestres sin cerrar".
    // Es más útil que un mensaje genérico de error.
    errorResultado.value = e instanceof Error ? e.message : 'Error al registrar resultado'
  } finally {
    registrandoRes.value = false
  }
}

// ─── Helpers visuales ─────────────────────────────────────────────────────────
const badgeEstado: Record<EstadoInscripcion, string> = {
  ACTIVA:      'badge-success',
  RETIRADA:    'badge-error',
  TRANSFERIDA: 'badge-warning',
  CONCLUIDA:   'badge-ghost',
}

const badgeResultado: Record<ResultadoFinal, string> = {
  PENDIENTE:  'badge-ghost',
  PROMOVIDO:  'badge-success',
  REPROBADO:  'badge-error',
}

// ⚠️ el curso embebido acá viene de estudianteApi.getAll() — no trae
// "nombre" calculado, solo nivel/grado/paralelo (mismo caso que en
// EstudiantesView.vue y ReportesView.vue).
const NIVEL_TEXTO: Record<Nivel, string> = { PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
function nombreCursoDeInscripcion(insc: Inscripcion | null): string {
  const c = insc?.curso
  if (!c) return '—'
  return `${c.grado}° ${NIVEL_TEXTO[c.nivel]} "${c.paralelo}"`
}
</script>

<template>
  <div class="space-y-4">

    <!-- Encabezado -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <div class="flex-1">
        <h2 class="text-2xl font-bold">Inscripciones</h2>
        <p class="text-sm text-base-content/60">Gestión {{ gestion.anio ?? '—' }}</p>
      </div>
      <button class="btn btn-primary btn-sm" @click="abrirInscribir">
        + Nueva inscripción
      </button>
    </div>

    <!-- Filtros -->
    <div class="flex flex-wrap gap-3">
      <select
        v-model="filtroCurso"
        class="select select-bordered select-sm"
        @change="cargar"
      >
        <option value="">Todos los cursos</option>
        <option v-for="c in gestion.cursos" :key="c.id" :value="c.id">
          {{ c.nombre }}
        </option>
      </select>

      <select
        v-model="filtroEstado"
        class="select select-bordered select-sm"
        @change="cargar"
      >
        <option value="">Todos los estados</option>
        <option value="ACTIVA">Activas</option>
        <option value="RETIRADA">Retiradas</option>
        <option value="TRANSFERIDA">Transferidas</option>
        <option value="CONCLUIDA">Concluidas</option>
      </select>
    </div>

    <!-- Error -->
    <div v-if="error" role="alert" class="alert alert-error">
      <span>{{ error }}</span>
      <button class="btn btn-sm btn-ghost" @click="cargar">Reintentar</button>
    </div>

    <!-- Tabla -->
    <div class="card bg-base-100 shadow overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Estudiante</th>
            <th>CI</th>
            <th>Curso</th>
            <th>Estado</th>
            <th>Resultado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cargando" v-for="i in 6" :key="i">
            <td colspan="6"><div class="skeleton h-4 w-full"></div></td>
          </tr>
          <tr v-else-if="inscripciones.length === 0">
            <td colspan="6" class="text-center text-base-content/40 py-8">
              No hay inscripciones con los filtros seleccionados
            </td>
          </tr>
          <tr v-else v-for="insc in inscripciones" :key="insc.id" class="hover">
            <td class="font-medium">
              {{ insc.estudiante?.apellido }}, {{ insc.estudiante?.nombre }}
            </td>
            <td class="font-mono text-sm">{{ insc.estudiante?.ci }}</td>
            <td class="text-sm">{{ nombreCursoDeInscripcion(insc) }}</td>
            <td>
              <span class="badge badge-sm" :class="badgeEstado[insc.estadoInscripcion]">
                {{ insc.estadoInscripcion }}
              </span>
            </td>
            <td>
              <span class="badge badge-sm" :class="badgeResultado[insc.resultado]">
                {{ insc.resultado }}
              </span>
            </td>
            <td>
              <div class="flex gap-1 flex-wrap">
                <!-- Cambiar estado: solo si sigue activa -->
                <button
                  v-if="insc.estadoInscripcion === 'ACTIVA'"
                  class="btn btn-ghost btn-xs"
                  @click="abrirCambiarEstado(insc)"
                >
                  Estado
                </button>
                <!-- Registrar resultado: solo si está activa y resultado pendiente.
                     ¿Por qué solo ACTIVA? Un estudiante RETIRADO o TRANSFERIDO
                     no debería tener resultado final — ya no está cursando. -->
                <button
                  v-if="insc.estadoInscripcion === 'ACTIVA' && insc.resultado === 'PENDIENTE'"
                  class="btn btn-outline btn-xs btn-info"
                  @click="abrirResultado(insc)"
                >
                  Resultado
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="!cargando" class="text-xs text-base-content/40">
      {{ inscripciones.length }} inscripción(es) encontrada(s)
    </p>
  </div>

  <!-- ── Modal inscribir ──────────────────────────────────────────────────────── -->
  <dialog :open="modalInscribir" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">Nueva inscripción</h3>

      <div v-if="errorInscripcion" role="alert" class="alert alert-error mb-4 py-2 text-sm">
        <span>{{ errorInscripcion }}</span>
      </div>

      <form class="space-y-3" @submit.prevent="inscribir">

        <!-- Paso 1: buscar estudiante por CI -->
        <div class="space-y-2">
          <p class="text-sm font-medium">1. Buscar estudiante por CI</p>
          <div class="flex gap-2">
            <input
              v-model="busquedaCI"
              type="text"
              placeholder="CI del estudiante"
              class="input input-bordered flex-1"
              :disabled="inscribiendo"
              @keyup.enter="buscarPorCI"
            />
            <button
              type="button"
              class="btn btn-outline"
              :disabled="buscandoEst"
              @click="buscarPorCI"
            >
              <span v-if="buscandoEst" class="loading loading-spinner loading-sm"></span>
              <span v-else>Buscar</span>
            </button>
          </div>

          <!-- Resultado de la búsqueda -->
          <div v-if="estudianteBuscado" class="bg-success/10 border border-success/30 rounded-lg p-3">
            <p class="text-sm font-semibold text-success">✓ Estudiante encontrado</p>
            <p class="text-sm">{{ estudianteBuscado.apellido }}, {{ estudianteBuscado.nombre }}</p>
            <p class="text-xs text-base-content/60 font-mono">CI: {{ estudianteBuscado.ci }}</p>
          </div>
        </div>

        <!-- Paso 2: seleccionar curso -->
        <div class="space-y-2">
          <p class="text-sm font-medium">2. Seleccionar curso</p>
          <select
            v-model="formInscribir.cursoId"
            class="select select-bordered w-full"
            :disabled="inscribiendo || !estudianteBuscado"
          >
            <option value="" disabled>Seleccionar curso</option>
            <option v-for="c in gestion.cursos" :key="c.id" :value="c.id">
              {{ c.nombre }}
            </option>
          </select>
          <p class="text-xs text-base-content/50">
            Gestión: <strong>{{ gestion.anio }}</strong>
          </p>
        </div>

        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="inscribiendo" @click="modalInscribir = false">
            Cancelar
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="inscribiendo || !estudianteBuscado || !formInscribir.cursoId"
          >
            <span v-if="inscribiendo" class="loading loading-spinner loading-sm"></span>
            Inscribir
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalInscribir = false">
      <button>cerrar</button>
    </form>
  </dialog>

  <!-- ── Modal cambiar estado ─────────────────────────────────────────────────── -->
  <dialog :open="modalEstado" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Cambiar estado de inscripción</h3>
      <p class="text-sm text-base-content/60 mb-4">
        {{ inscripcionActiva?.estudiante?.nombre }} {{ inscripcionActiva?.estudiante?.apellido }}
        · {{ nombreCursoDeInscripcion(inscripcionActiva) }}
      </p>

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

        <fieldset v-if="requiereFecha" class="fieldset">
          <legend class="fieldset-legend text-xs">Fecha de retiro</legend>
          <input v-model="formEstado.fechaRetiro" type="date" class="input input-bordered w-full" :disabled="cambiandoEstado" />
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Observaciones</legend>
          <textarea
            v-model="formEstado.observaciones"
            rows="2"
            placeholder="Motivo, destino de transferencia, etc."
            class="textarea textarea-bordered w-full"
            :disabled="cambiandoEstado"
          ></textarea>
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

  <!-- ── Modal resultado final ────────────────────────────────────────────────── -->
  <dialog :open="modalResultado" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Registrar resultado final</h3>
      <p class="text-sm text-base-content/60 mb-4">
        {{ inscripcionActiva?.estudiante?.nombre }} {{ inscripcionActiva?.estudiante?.apellido }}
        · {{ nombreCursoDeInscripcion(inscripcionActiva) }}
      </p>

      <div role="alert" class="alert alert-warning py-2 text-sm mb-4">
        <span>Esta acción requiere que los 3 trimestres estén cerrados. El resultado quedará registrado en el historial académico.</span>
      </div>

      <div v-if="errorResultado" role="alert" class="alert alert-error mb-4 py-2 text-sm">
        <span>{{ errorResultado }}</span>
      </div>

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
          <textarea
            v-model="formResultado.observaciones"
            rows="2"
            placeholder="Opcional"
            class="textarea textarea-bordered w-full"
            :disabled="registrandoRes"
          ></textarea>
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
</template>