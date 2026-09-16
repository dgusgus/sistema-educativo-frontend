<script setup lang="ts">
/**
 * PromocionView — resuelve el "trabajo de 1000 estudiantes uno por uno".
 * El backend YA calcula quién promueve, quién repite y quién egresa
 * (GET /gestiones/:id/propuesta-inscripciones, usando la progresión
 * 1°→2°→...→6° Primaria → 1°→...→6° Secundaria → egresado). Acá se
 * agrupan los resultados por destino sugerido, se elige a qué CURSO
 * real de la gestión nueva va cada grupo, y se matricula todo de una
 * pasada — sin tocar ni duplicar el registro del Estudiante, que es
 * permanente: solo se crean Inscripcion nuevas.
 */
import { ref, computed, onMounted } from 'vue'
import { gestionApi, type GestionResumen } from '@/api/gestion.api'
import { cursoApi } from '@/api/estructura.api'
import { estudianteApi } from '@/api/estudiante.api'
import { useToastStore } from '@/stores/toast.store'
import type { Curso } from '@/types'

const toast = useToastStore()

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
  } catch {
    gestiones.value = []
  }
})

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
      <h2 class="text-2xl font-bold">Promoción de Gestión</h2>
      <p class="text-sm text-base-content/60">
        Matricula masivamente a la gestión siguiente usando la progresión automática
        (1°→2°→...→6° Primaria → 1°→...→6° Secundaria → egresado). El Estudiante no se
        duplica ni se vuelve a crear — solo se genera su inscripción nueva.
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

    <div v-if="error" role="alert" class="alert alert-error"><span>{{ error }}</span></div>

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
        <span>{{ propuesta.resumen.revisarManualmente }} estudiante(s) sin resultado final registrado — no se incluyen en el lote. Registralos primero en Estudiantes.</span>
      </div>

      <!-- Grupos: elegir curso destino real por cada nivel/grado sugerido -->
      <div v-for="grupo in grupos" :key="grupo" class="card bg-base-100 shadow">
        <div class="card-body py-3">
          <div class="flex flex-wrap items-center gap-3 mb-2">
            <h3 class="font-semibold">{{ grupo }}</h3>
            <span class="badge badge-ghost">{{ itemsDelGrupo(grupo).length }} estudiante(s)</span>
            <select v-model="mapeoDestino[grupo]" class="select select-bordered select-sm ml-auto">
              <option value="" disabled>Curso destino real *</option>
              <option v-for="c in cursosDestino" :key="c.id" :value="c.id">{{ c.nombre }}</option>
            </select>
            <button class="btn btn-ghost btn-xs" @click="marcarTodosDelGrupo(grupo, true)">Marcar todos</button>
            <button class="btn btn-ghost btn-xs" @click="marcarTodosDelGrupo(grupo, false)">Desmarcar todos</button>
          </div>
          <div class="overflow-x-auto max-h-64 overflow-y-auto">
            <table class="table table-xs">
              <tbody>
                <tr v-for="p in itemsDelGrupo(grupo)" :key="p.estudianteId" class="hover">
                  <td class="w-8"><input v-model="seleccionados[p.estudianteId]" type="checkbox" class="checkbox checkbox-sm" /></td>
                  <td>{{ p.estudiante }}</td>
                  <td class="font-mono text-xs text-base-content/50">{{ p.ci }}</td>
                  <td class="text-xs text-base-content/50">{{ p.cursoActual }}</td>
                  <td><span class="badge badge-xs" :class="p.accion === 'PROMOVER' ? 'badge-success' : 'badge-warning'">{{ p.accion }}</span></td>
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