<script setup lang="ts">
/**
 * PromocionView — resuelve el "trabajo de 1000 estudiantes uno por uno" en dos pasos:
 *
 * PASO 1 · Resultados finales del año (PROMOVIDO / REPROBADO).
 *   El backend lo CALCULA con los promedios finales que cargaron los docentes
 *   (GET /gestiones/:id/propuesta-resultados): reprueba quien tenga alguna
 *   materia bajo la nota mínima. Acá solo se revisa y se confirma en lote
 *   (POST /gestiones/:id/resultados, que manda solo ids — el servidor
 *   vuelve a calcular). Se hace con la gestión todavía ACTIVA: el Director no
 *   puede cerrarla mientras haya estudiantes sin resultado.
 *
 * PASO 2 · Inscripción a la gestión siguiente.
 * El backend YA calcula quién promueve, quién repite y quién egresa
 * (GET /gestiones/:id/propuesta-inscripciones, usando la progresión
 * 1°→2°→...→6° Primaria → 1°→...→6° Secundaria → egresado). Acá se
 * agrupan los resultados por destino sugerido, se elige a qué CURSO
 * real de la gestión nueva va cada grupo, y se matricula todo de una
 * pasada — sin tocar ni duplicar el registro del Estudiante, que es
 * permanente: solo se crean Inscripcion nuevas.
 */
import { ref, computed, onMounted } from 'vue'
import { gestionApi, type GestionResumen, type PropuestaResultados, type ResultadoLote } from '@/api/gestion.api'
import { cursoApi } from '@/api/estructura.api'
import { estudianteApi } from '@/api/estudiante.api'
import { useToastStore } from '@/stores/toast.store'
import { useConfirm } from '@/composables/useConfirm'
import type { Curso } from '@/types'
import StatusBadge from '@/components/StatusBadge.vue'

const toast = useToastStore()
const { confirmar } = useConfirm()

const gestiones = ref<GestionResumen[]>([])
const gestionOrigen  = ref<number | ''>('')
const gestionDestino = ref<number | ''>('')
const cursosDestino  = ref<Curso[]>([])

onMounted(async () => {
  try {
    gestiones.value = await gestionApi.getAll()
    // Sugerencia razonable: origen = la más reciente NO activa, destino = la activa
    const activa = gestiones.value.find(g => g.activa)
    const anterior = gestiones.value.find(g => !g.activa)
    if (activa)    gestionDestino.value = activa.id
    if (anterior)  gestionOrigen.value  = anterior.id
    // Paso 1: los resultados se registran con la gestión todavía activa.
    gestionResultados.value = (activa ?? gestiones.value[0])?.id ?? ''
  } catch {
    gestiones.value = []
  }
})

// ─── Paso 1: resultados finales del año ──────────────────────────────────────
const gestionResultados = ref<number | ''>('')
const calculo = ref<PropuestaResultados | null>(null)
const calculando = ref(false)
const errorResultados = ref<string | null>(null)
const seleccionResultados = ref<Record<number, boolean>>({})
const registrando = ref(false)
const reporteRegistro = ref<ResultadoLote | null>(null)
const soloPorRegistrar = ref(true)

// Estudiantes con todos sus promedios finales (se puede decidir su resultado)
const listos = computed(() => (calculo.value?.resultados ?? []).filter(r => r.estado === 'LISTO'))
const incompletos = computed(() => (calculo.value?.resultados ?? []).filter(r => r.estado === 'INCOMPLETO'))
const filasVisibles = computed(() =>
  soloPorRegistrar.value ? listos.value.filter(r => r.resultadoActual !== r.sugerido) : listos.value
)
const totalSeleccionadosRes = computed(() =>
  listos.value.filter(r => seleccionResultados.value[r.inscripcionId]).length
)
const todoRegistrado = computed(() =>
  !!calculo.value && calculo.value.resumen.total > 0
  && calculo.value.resumen.porRegistrar === 0 && calculo.value.resumen.incompletos === 0
)

async function calcularResultados(limpiarReporte = true) {
  if (!gestionResultados.value) { errorResultados.value = 'Elegí la gestión'; return }
  calculando.value = true
  errorResultados.value = null
  calculo.value = null
  seleccionResultados.value = {}
  if (limpiarReporte) reporteRegistro.value = null
  try {
    calculo.value = await gestionApi.getPropuestaResultados(Number(gestionResultados.value))
    // Por defecto se marcan los que todavía no tienen el resultado que les corresponde.
    calculo.value.resultados.forEach(r => {
      seleccionResultados.value[r.inscripcionId] = r.estado === 'LISTO' && r.resultadoActual !== r.sugerido
    })
  } catch (e) {
    errorResultados.value = e instanceof Error ? e.message : 'Error al calcular los resultados'
  } finally {
    calculando.value = false
  }
}

function marcarTodosResultados(valor: boolean) {
  filasVisibles.value.forEach(r => { seleccionResultados.value[r.inscripcionId] = valor })
}

async function registrarResultados() {
  const elegidos = listos.value.filter(r => seleccionResultados.value[r.inscripcionId])
  if (!elegidos.length) { errorResultados.value = 'No hay estudiantes seleccionados'; return }
  const aReprobar = elegidos.filter(r => r.sugerido === 'REPROBADO').length
  const aPromover = elegidos.length - aReprobar

  const ok = await confirmar({
    titulo: 'Registrar resultados del año',
    mensaje: `Se registrarán ${elegidos.length} resultado(s): ${aPromover} PROMOVIDO y ${aReprobar} REPROBADO, calculados con los promedios finales. Quedan en el historial académico.`,
    peligroso: aReprobar > 0,
  })
  if (!ok) return

  registrando.value = true
  errorResultados.value = null
  try {
    const r = await gestionApi.registrarResultados(Number(gestionResultados.value), elegidos.map(e => e.inscripcionId))
    reporteRegistro.value = r
    toast.success(`Resultados registrados: ${r.actualizados}`)
    await calcularResultados(false)
  } catch (e) {
    errorResultados.value = e instanceof Error ? e.message : 'Error al registrar los resultados'
  } finally {
    registrando.value = false
  }
}

// ─── Propuesta ────────────────────────────────────────────────────────────────
interface PropuestaItem {
  estudianteId: number
  estudiante: string
  ci: string | null
  cursoActual: string
  estado: string
  resultado: string
  accion: string
  cursoSugerido: string | null
}
const propuesta = ref<{ resumen: Record<string, number>; propuesta: PropuestaItem[] } | null>(null)
const cargandoPropuesta = ref(false)
const error = ref<string | null>(null)

async function cargarPropuesta() {
  if (!gestionOrigen.value) { error.value = 'Elegí la gestión de origen'; return }
  cargandoPropuesta.value = true
  error.value = null
  propuesta.value = null
  seleccionados.value = {}
  try {
    propuesta.value = await gestionApi.getPropuestaInscripciones(Number(gestionOrigen.value))
    // Por defecto se seleccionan solo PROMOVER y REPETIR_CURSO — egresados,
    // los que no continúan y los sin resultado quedan afuera del lote.
    propuesta.value.propuesta.forEach(p => {
      seleccionados.value[p.estudianteId] = p.accion === 'PROMOVER' || p.accion === 'REPETIR_CURSO'
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al calcular la propuesta'
  } finally {
    cargandoPropuesta.value = false
  }
}

async function cargarCursosDestino() {
  if (!gestionDestino.value) { cursosDestino.value = []; return }
  try {
    cursosDestino.value = await cursoApi.getAll(Number(gestionDestino.value))
  } catch {
    cursosDestino.value = []
  }
}

// ─── Selección y agrupación por destino sugerido ─────────────────────────────
const seleccionados = ref<Record<number, boolean>>({})

const itemsProcesables = computed(() =>
  (propuesta.value?.propuesta ?? []).filter(p => p.accion === 'PROMOVER' || p.accion === 'REPETIR_CURSO')
)
const itemsSinAccion = computed(() =>
  (propuesta.value?.propuesta ?? []).filter(p => p.accion !== 'PROMOVER' && p.accion !== 'REPETIR_CURSO')
)

// Cada valor único de "cursoSugerido" (ej. "2° Primaria") agrupa a todos
// los estudiantes que van al mismo nivel+grado — se elige UN curso real
// de destino por grupo, en vez de uno por estudiante.
const grupos = computed(() => {
  const set = new Set<string>()
  itemsProcesables.value.forEach(p => set.add(p.cursoSugerido ?? '—'))
  return Array.from(set)
})
const mapeoDestino = ref<Record<string, number | ''>>({})

function itemsDelGrupo(grupo: string) {
  return itemsProcesables.value.filter(p => (p.cursoSugerido ?? '—') === grupo)
}

const totalSeleccionados = computed(() =>
  itemsProcesables.value.filter(p => seleccionados.value[p.estudianteId]).length
)

function marcarTodosDelGrupo(grupo: string, valor: boolean) {
  itemsDelGrupo(grupo).forEach(p => { seleccionados.value[p.estudianteId] = valor })
}

// ─── Confirmar matrícula masiva ───────────────────────────────────────────────
const procesando   = ref(false)
const progreso      = ref({ hechos: 0, total: 0, errores: 0 })
const resultadoFinal = ref<{ exitos: number; errores: number; detalleErrores: string[] } | null>(null)

async function confirmarMatricula() {
  if (!gestionDestino.value) { error.value = 'Elegí la gestión de destino'; return }
  const gruposSinDestino = grupos.value.filter(g => itemsDelGrupo(g).some(p => seleccionados.value[p.estudianteId]) && !mapeoDestino.value[g])
  if (gruposSinDestino.length) {
    error.value = `Falta elegir curso destino para: ${gruposSinDestino.join(', ')}`
    return
  }

  const aProcesar = itemsProcesables.value.filter(p => seleccionados.value[p.estudianteId])
  if (!aProcesar.length) { error.value = 'No hay estudiantes seleccionados'; return }

  procesando.value = true
  error.value = null
  resultadoFinal.value = null
  progreso.value = { hechos: 0, total: aProcesar.length, errores: 0 }
  const errores: string[] = []

  // Se procesa en lotes de 20 en paralelo — con ~1000 estudiantes, uno por
  // uno sería demasiado lento, y todos a la vez satura al backend.
  const TAMANO_LOTE = 20
  for (let i = 0; i < aProcesar.length; i += TAMANO_LOTE) {
    const lote = aProcesar.slice(i, i + TAMANO_LOTE)
    const resultados = await Promise.allSettled(
      lote.map(p => estudianteApi.inscribir({
        estudianteId: p.estudianteId,
        cursoId: Number(mapeoDestino.value[p.cursoSugerido ?? '—']),
        gestionId: Number(gestionDestino.value),
      }))
    )
    resultados.forEach((r, idx) => {
      progreso.value.hechos++
      if (r.status === 'rejected') {
        progreso.value.errores++
        const nombre = lote[idx].estudiante
        errores.push(`${nombre}: ${r.reason instanceof Error ? r.reason.message : 'Error desconocido'}`)
      }
    })
  }

  resultadoFinal.value = {
    exitos: aProcesar.length - errores.length,
    errores: errores.length,
    detalleErrores: errores,
  }
  procesando.value = false
  toast.success(`Matrícula masiva completada: ${aProcesar.length - errores.length} de ${aProcesar.length}`)
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h2 class="font-display text-2xl font-bold tracking-tight">Promoción de Gestión</h2>
      <p class="mt-0.5 text-sm text-base-content/60">
        Primero se registra el resultado final del año de cada estudiante (Paso 1) y después se
        lo matricula en la gestión siguiente con la progresión automática (Paso 2). El Estudiante
        no se duplica ni se vuelve a crear — solo se genera su inscripción nueva.
      </p>
    </div>

    <!-- ═══ PASO 1 · Resultados finales del año ═══════════════════════════ -->
    <div class="card bg-base-100 shadow">
      <div class="card-body py-3 space-y-1">
        <h3 class="font-semibold">Paso 1 · Resultados finales del año</h3>
        <p class="text-sm text-base-content/60">
          El resultado se calcula con los promedios finales de cada materia: reprueba el año quien
          tenga alguna materia con promedio menor a la nota mínima de la gestión. No se elige a mano,
          así nadie puede promover a quien reprobó. Requiere los trimestres cerrados.
        </p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end pt-2">
          <fieldset class="fieldset md:col-span-2">
            <legend class="fieldset-legend text-xs">Gestión</legend>
            <select v-model="gestionResultados" class="select select-bordered w-full">
              <option value="" disabled>Seleccionar</option>
              <option v-for="g in gestiones" :key="g.id" :value="g.id">{{ g.anio }} {{ g.activa ? '(activa)' : '' }}</option>
            </select>
          </fieldset>
          <button class="btn btn-primary" :disabled="calculando || !gestionResultados" @click="calcularResultados()">
            <span v-if="calculando" class="loading loading-spinner loading-sm"></span>
            Calcular resultados
          </button>
        </div>
      </div>
    </div>

    <div v-if="errorResultados" role="alert" class="alert alert-error">
      <span class="flex-1">{{ errorResultados }}</span>
    </div>

    <template v-if="calculo">
      <p class="text-xs text-base-content/50">
        Gestión {{ calculo.gestion.anio }} · nota mínima de aprobación: {{ calculo.gestion.notaMinima }}
      </p>

      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div class="card bg-base-100 shadow"><div class="card-body py-3"><p class="text-xs text-base-content/50">Estudiantes</p><p class="text-xl font-bold">{{ calculo.resumen.total }}</p></div></div>
        <div class="card bg-base-100 shadow"><div class="card-body py-3"><p class="text-xs text-base-content/50">Promovidos</p><p class="text-xl font-bold text-success">{{ calculo.resumen.promovidos }}</p></div></div>
        <div class="card bg-base-100 shadow"><div class="card-body py-3"><p class="text-xs text-base-content/50">Reprobados</p><p class="text-xl font-bold text-error">{{ calculo.resumen.reprobados }}</p></div></div>
        <div class="card bg-base-100 shadow"><div class="card-body py-3"><p class="text-xs text-base-content/50">Incompletos</p><p class="text-xl font-bold text-warning">{{ calculo.resumen.incompletos }}</p></div></div>
        <div class="card bg-base-100 shadow"><div class="card-body py-3"><p class="text-xs text-base-content/50">Por registrar</p><p class="text-xl font-bold text-info">{{ calculo.resumen.porRegistrar }}</p></div></div>
      </div>

      <div v-if="todoRegistrado" role="alert" class="alert alert-success text-sm">
        <span>Todos los estudiantes ya tienen su resultado. El Director puede cerrar la gestión (en Gestiones) y después podés continuar con el Paso 2.</span>
      </div>

      <!-- Incompletos: no se pueden decidir hasta tener todos los promedios finales -->
      <div v-if="incompletos.length" class="card bg-base-100 shadow">
        <div class="card-body py-3">
          <h3 class="font-semibold mb-1 text-warning">Sin promedios completos ({{ incompletos.length }})</h3>
          <p class="text-xs text-base-content/60 mb-2">
            Los promedios finales se generan al cerrar el último trimestre. Completar las notas pendientes y volver a calcular.
          </p>
          <div class="overflow-x-auto max-h-48 overflow-y-auto">
            <table class="table table-xs">
              <tbody>
                <tr v-for="r in incompletos" :key="r.inscripcionId">
                  <td>{{ r.estudiante }}</td>
                  <td class="text-xs text-base-content/50">{{ r.curso }}</td>
                  <td class="text-xs text-warning">{{ r.detalle }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Resultados calculados -->
      <div v-if="listos.length" class="card bg-base-100 shadow">
        <div class="card-body py-3">
          <div class="flex flex-wrap items-center gap-3 mb-2">
            <h3 class="font-semibold">Resultados calculados ({{ filasVisibles.length }})</h3>
            <label class="label cursor-pointer gap-2 ml-auto">
              <input v-model="soloPorRegistrar" type="checkbox" class="checkbox checkbox-sm" />
              <span class="text-xs">Solo los que faltan registrar</span>
            </label>
            <button class="btn btn-ghost btn-sm min-h-11" @click="marcarTodosResultados(true)">Marcar todos</button>
            <button class="btn btn-ghost btn-sm min-h-11" @click="marcarTodosResultados(false)">Desmarcar todos</button>
          </div>
          <div class="overflow-x-auto max-h-96 overflow-y-auto">
            <table class="table table-xs">
              <thead>
                <tr>
                  <th class="w-12"></th>
                  <th>Estudiante</th>
                  <th>Curso</th>
                  <th class="text-right">Promedio</th>
                  <th>Materias reprobadas</th>
                  <th>Resultado</th>
                  <th>Actual</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in filasVisibles" :key="r.inscripcionId" class="hover">
                  <td class="text-center"><input v-model="seleccionResultados[r.inscripcionId]" type="checkbox" class="checkbox checkbox-md" :aria-label="`Seleccionar a ${r.estudiante}`" /></td>
                  <td>
                    {{ r.estudiante }}
                    <span v-if="r.ci" class="block font-mono text-xs text-base-content/50">{{ r.ci }}</span>
                  </td>
                  <td class="text-xs text-base-content/50">{{ r.curso }}</td>
                  <td class="text-right font-mono">{{ r.promedioGeneral ?? '—' }}</td>
                  <td>
                    <span v-if="!r.materiasReprobadas.length" class="text-base-content/30">—</span>
                    <span v-for="m in r.materiasReprobadas" :key="m.materia" class="badge badge-error badge-outline badge-xs mr-1 mb-0.5">{{ m.materia }} ({{ m.promedio }})</span>
                  </td>
                  <td><StatusBadge :estado="r.sugerido ?? 'PENDIENTE'" tamano="xs" /></td>
                  <td><StatusBadge :estado="r.resultadoActual" tamano="xs" /></td>
                </tr>
                <tr v-if="!filasVisibles.length">
                  <td colspan="7" class="text-center text-sm text-base-content/50 py-4">No hay estudiantes pendientes de registrar.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div v-if="listos.length" class="card bg-base-100 shadow">
        <div class="card-body py-3 flex flex-wrap items-center gap-3">
          <span class="font-semibold">{{ totalSeleccionadosRes }} estudiante(s) seleccionados para registrar</span>
          <button class="btn btn-primary ml-auto" :disabled="registrando || !totalSeleccionadosRes" @click="registrarResultados">
            <span v-if="registrando" class="loading loading-spinner loading-sm"></span>
            {{ registrando ? 'Registrando...' : 'Registrar resultados' }}
          </button>
        </div>
      </div>

      <div v-if="reporteRegistro" role="alert" class="alert" :class="reporteRegistro.errores.length ? 'alert-warning' : 'alert-success'">
        <div>
          <p>
            <strong>{{ reporteRegistro.actualizados }}</strong> resultado(s) registrados
            ({{ reporteRegistro.promovidos }} promovidos, {{ reporteRegistro.reprobados }} reprobados)<template v-if="reporteRegistro.sinCambios"> — {{ reporteRegistro.sinCambios }} ya estaban registrados</template><template v-if="reporteRegistro.errores.length"> — <strong>{{ reporteRegistro.errores.length }}</strong> con error</template>.
          </p>
          <ul v-if="reporteRegistro.errores.length" class="text-xs mt-2 list-disc list-inside max-h-32 overflow-y-auto">
            <li v-for="e in reporteRegistro.errores" :key="e.inscripcionId">{{ e.estudiante }}: {{ e.error }}</li>
          </ul>
        </div>
      </div>
    </template>

    <!-- ═══ PASO 2 · Inscripción a la gestión siguiente ═══════════════════ -->
    <div class="pt-2">
      <h3 class="font-semibold">Paso 2 · Inscripción a la gestión siguiente</h3>
      <p class="text-sm text-base-content/60">
        Normalmente se hace con la gestión de origen ya cerrada por el Director.
      </p>
    </div>

    <!-- Selección de gestiones -->
    <div class="card bg-base-100 shadow">
      <div class="card-body py-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Gestión de origen (de dónde vienen)</legend>
          <select v-model="gestionOrigen" class="select select-bordered w-full">
            <option value="" disabled>Seleccionar</option>
            <option v-for="g in gestiones" :key="g.id" :value="g.id">{{ g.anio }} {{ g.activa ? '(activa)' : '' }}</option>
          </select>
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Gestión de destino (a dónde van)</legend>
          <select v-model="gestionDestino" class="select select-bordered w-full" @change="cargarCursosDestino">
            <option value="" disabled>Seleccionar</option>
            <option v-for="g in gestiones" :key="g.id" :value="g.id" :disabled="g.id === gestionOrigen">
              {{ g.anio }} {{ g.activa ? '(activa)' : '' }}
            </option>
          </select>
          <p v-if="gestionDestino && !cursosDestino.length" class="text-xs text-warning mt-1">
            Esta gestión no tiene cursos creados todavía — creálos primero en Estructura.
          </p>
        </fieldset>
        <button class="btn btn-primary" :disabled="cargandoPropuesta || !gestionOrigen" @click="cargarPropuesta">
          <span v-if="cargandoPropuesta" class="loading loading-spinner loading-sm"></span>
          Calcular propuesta
        </button>
      </div>
    </div>

    <div v-if="error" role="alert" class="alert alert-error">
      <span class="flex-1">{{ error }}</span>
      <button type="button" class="btn btn-sm btn-ghost min-h-11" @click="cargarPropuesta">Reintentar</button>
    </div>

    <template v-if="propuesta">
      <!-- Resumen -->
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div class="card bg-base-100 shadow"><div class="card-body py-3"><p class="text-xs text-base-content/50">Promueven</p><p class="text-xl font-bold text-success">{{ propuesta.resumen.promover }}</p></div></div>
        <div class="card bg-base-100 shadow"><div class="card-body py-3"><p class="text-xs text-base-content/50">Repiten</p><p class="text-xl font-bold text-warning">{{ propuesta.resumen.repetir }}</p></div></div>
        <div class="card bg-base-100 shadow"><div class="card-body py-3"><p class="text-xs text-base-content/50">Egresan</p><p class="text-xl font-bold text-info">{{ propuesta.resumen.egresados }}</p></div></div>
        <div class="card bg-base-100 shadow"><div class="card-body py-3"><p class="text-xs text-base-content/50">No continúan</p><p class="text-xl font-bold text-error">{{ propuesta.resumen.noContinua }}</p></div></div>
        <div class="card bg-base-100 shadow"><div class="card-body py-3"><p class="text-xs text-base-content/50">Sin resultado</p><p class="text-xl font-bold text-base-content/40">{{ propuesta.resumen.revisarManualmente }}</p></div></div>
      </div>

      <div v-if="propuesta.resumen.revisarManualmente > 0" role="alert" class="alert alert-warning text-sm">
        <span>{{ propuesta.resumen.revisarManualmente }} estudiante(s) sin resultado final registrado — no se incluyen en el lote. Registrar primero su resultado en el Paso 1.</span>
      </div>

      <!-- Grupos: elegir curso destino real por cada nivel/grado sugerido -->
      <div v-for="grupo in grupos" :key="grupo" class="card bg-base-100 shadow">
        <div class="card-body py-3">
          <div class="flex flex-wrap items-center gap-3 mb-2">
            <h3 class="font-semibold">{{ grupo }}</h3>
            <span class="badge badge-ghost">{{ itemsDelGrupo(grupo).length }} estudiante(s)</span>
            <select v-model="mapeoDestino[grupo]" class="select select-bordered ml-auto max-w-full" :aria-label="`Curso destino para ${grupo}`">
              <option value="" disabled>Curso destino real *</option>
              <option v-for="c in cursosDestino" :key="c.id" :value="c.id">{{ c.nombre }}</option>
            </select>
            <button class="btn btn-ghost btn-sm min-h-11" @click="marcarTodosDelGrupo(grupo, true)">Marcar todos</button>
            <button class="btn btn-ghost btn-sm min-h-11" @click="marcarTodosDelGrupo(grupo, false)">Desmarcar todos</button>
          </div>
          <div class="overflow-x-auto max-h-64 overflow-y-auto">
            <table class="table table-xs">
              <tbody>
                <tr v-for="p in itemsDelGrupo(grupo)" :key="p.estudianteId" class="hover">
                  <td class="w-12 text-center"><input v-model="seleccionados[p.estudianteId]" type="checkbox" class="checkbox checkbox-md" :aria-label="`Seleccionar a ${p.estudiante}`" /></td>
                  <td>{{ p.estudiante }}</td>
                  <td class="font-mono text-xs text-base-content/50">{{ p.ci }}</td>
                  <td class="text-xs text-base-content/50">{{ p.cursoActual }}</td>
                  <td><StatusBadge :estado="p.accion" tamano="xs" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Egresados / no continúan / sin resultado — informativo, no procesable -->
      <div v-if="itemsSinAccion.length" class="card bg-base-100 shadow">
        <div class="card-body py-3">
          <h3 class="font-semibold mb-2 text-base-content/60">Sin acción automática ({{ itemsSinAccion.length }})</h3>
          <div class="overflow-x-auto max-h-48 overflow-y-auto">
            <table class="table table-xs">
              <tbody>
                <tr v-for="p in itemsSinAccion" :key="p.estudianteId">
                  <td>{{ p.estudiante }}</td>
                  <td class="text-xs text-base-content/50">{{ p.cursoActual }}</td>
                  <td><span class="badge badge-xs badge-ghost">{{ p.accion }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Confirmar -->
      <div class="card bg-base-100 shadow">
        <div class="card-body py-3 flex flex-wrap items-center gap-3">
          <span class="font-semibold">{{ totalSeleccionados }} estudiante(s) seleccionados para matricular</span>
          <button class="btn btn-primary ml-auto" :disabled="procesando || !totalSeleccionados" @click="confirmarMatricula">
            <span v-if="procesando" class="loading loading-spinner loading-sm"></span>
            {{ procesando ? `Matriculando ${progreso.hechos}/${progreso.total}...` : 'Confirmar matrícula masiva' }}
          </button>
        </div>
      </div>

      <div v-if="resultadoFinal" role="alert" class="alert" :class="resultadoFinal.errores ? 'alert-warning' : 'alert-success'">
        <div>
          <p><strong>{{ resultadoFinal.exitos }}</strong> matriculados correctamente<template v-if="resultadoFinal.errores"> — <strong>{{ resultadoFinal.errores }}</strong> con error</template>.</p>
          <ul v-if="resultadoFinal.detalleErrores.length" class="text-xs mt-2 list-disc list-inside max-h-32 overflow-y-auto">
            <li v-for="(e, i) in resultadoFinal.detalleErrores" :key="i">{{ e }}</li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</template>