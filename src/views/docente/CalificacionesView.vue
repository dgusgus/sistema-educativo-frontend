<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useDocenteStore, type Asignacion, type CursoAsignacion } from '@/stores/docente.store'
import { useGestionStore } from '@/stores/gestion.store'
import { calificacionApi, type PlanillaResponse } from '@/api/calificacion.api'
import { evaluacionApi } from '@/api/evaluacion.api'
import type { DimensionEvaluacion, ActividadEvaluativa, Nivel } from '@/types'

const docenteStore = useDocenteStore()
const gestion      = useGestionStore()

const asignacion = computed({
  get: () => docenteStore.asignacionActiva,
  set: (a) => { if (a) docenteStore.seleccionar(a) },
})

// El curso de la asignación no trae "nombre" calculado — ver nota igual
// en AsistenciaView.vue
const NIVEL_TEXTO: Record<Nivel, string> = { PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
function nombreCursoCorto(c: CursoAsignacion): string {
  return `${c.grado}° ${NIVEL_TEXTO[c.nivel]} "${c.paralelo}"`
}

// Trimestre seleccionado — default: el primer trimestre no cerrado
const trimestreId = ref<number | ''>('')

const cargando  = ref(false)
const error     = ref<string | null>(null)
const exito     = ref<string | null>(null)

// ── Planilla final (solo lectura — el backend calcula el promedio) ──────────
const planilla    = ref<PlanillaResponse | null>(null)
const trimCerrado = computed(() => planilla.value?.trimestreCerrado ?? false)

// ── Dimensiones + actividades evaluativas ────────────────────────────────────
const dimensiones      = ref<DimensionEvaluacion[]>([])
const dimensionActiva  = ref<DimensionEvaluacion | null>(null)
const actividades      = ref<ActividadEvaluativa[]>([])
const actividadesDeLaDimension = computed(() =>
  actividades.value.filter(a => a.dimensionId === dimensionActiva.value?.id)
)

onMounted(async () => {
  await docenteStore.cargar()
  await gestion.cargar()
  const trimActivo = gestion.trimestreActivo
  if (trimActivo) trimestreId.value = trimActivo.id
  if (docenteStore.asignacionActiva && trimestreId.value) {
    await cargarTodo()
  }
})

async function cambiarAsignacion(asig: Asignacion) {
  docenteStore.seleccionar(asig)
  if (trimestreId.value) await cargarTodo()
}

// Recarga la planilla final + dimensiones + actividades del trimestre
async function cargarTodo() {
  if (!asignacion.value || !trimestreId.value || !gestion.gestionId) return
  cargando.value = true
  error.value = null
  exito.value = null
  actividadFormAbierto.value = false
  actividadParaNotas.value = null

  try {
    const [pl, dims, acts] = await Promise.all([
      calificacionApi.getPlanilla(asignacion.value.docenteMateriaCursoId, Number(trimestreId.value)),
      evaluacionApi.getDimensiones(gestion.gestionId),
      evaluacionApi.getActividadesEvaluativas(asignacion.value.docenteMateriaCursoId, Number(trimestreId.value)),
    ])
    planilla.value    = pl
    dimensiones.value = dims
    actividades.value = acts
    if (!dimensionActiva.value && dims.length) dimensionActiva.value = dims[0]
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar la planilla'
  } finally {
    cargando.value = false
  }
}

watch(dimensionActiva, () => { actividadParaNotas.value = null })

// ── Alta de actividad evaluativa ──────────────────────────────────────────────
const actividadFormAbierto = ref(false)
const nuevaActividad = ref({ nombre: '', fecha: new Date().toISOString().split('T')[0], puntajeMaximo: 100, peso: 1, esRecuperatorio: false })
const guardandoActividad = ref(false)

async function crearActividad() {
  if (!asignacion.value || !dimensionActiva.value || !trimestreId.value) return
  if (!nuevaActividad.value.nombre.trim()) { error.value = 'El nombre de la actividad es obligatorio'; return }
  guardandoActividad.value = true
  error.value = null
  try {
    const creada = await evaluacionApi.createActividadEvaluativa({
      docenteMateriaCursoId: asignacion.value.docenteMateriaCursoId,
      trimestreId: Number(trimestreId.value),
      dimensionId: dimensionActiva.value.id,
      nombre: nuevaActividad.value.nombre.trim(),
      fecha: nuevaActividad.value.fecha,
      puntajeMaximo: nuevaActividad.value.puntajeMaximo,
      peso: nuevaActividad.value.peso,
      esRecuperatorio: nuevaActividad.value.esRecuperatorio,
    })
    actividades.value.push(creada)
    actividadFormAbierto.value = false
    nuevaActividad.value = { nombre: '', fecha: new Date().toISOString().split('T')[0], puntajeMaximo: 100, peso: 1, esRecuperatorio: false }
    abrirNotas(creada)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al crear la actividad'
  } finally {
    guardandoActividad.value = false
  }
}

// ── Registro de notas de una actividad ────────────────────────────────────────
const actividadParaNotas = ref<ActividadEvaluativa | null>(null)
const notasLocales = ref<Record<number, string>>({})
const guardandoNotas = ref(false)

// ⚠️ Limitación real del backend: no existe un GET que devuelva las notas
// ya cargadas de una actividad puntual (solo _count.notas en la lista).
// Por eso el formulario arranca en blanco aunque la actividad ya tenga
// notas registradas — solo se sabe CUÁNTAS tiene, no CUÁLES. Si se agrega
// ese endpoint más adelante, precargar notasLocales acá.
function abrirNotas(act: ActividadEvaluativa) {
  actividadParaNotas.value = act
  notasLocales.value = {}
}

function notaValida(v: string, max: number): boolean {
  if (!v) return true
  const n = Number(v)
  return !isNaN(n) && n >= 0 && n <= max
}

const erroresNota = computed(() => {
  if (!actividadParaNotas.value || !planilla.value) return {}
  const max = actividadParaNotas.value.puntajeMaximo
  const errs: Record<number, string> = {}
  planilla.value.planilla.forEach(item => {
    const v = notasLocales.value[item.inscripcionId]
    if (v && !notaValida(v, max)) errs[item.inscripcionId] = `Debe ser 0–${max}`
  })
  return errs
})
const hayErroresNota = computed(() => Object.keys(erroresNota.value).length > 0)

async function guardarNotas() {
  if (!actividadParaNotas.value || !planilla.value || hayErroresNota.value) return
  const notas = planilla.value.planilla
    .filter(item => notasLocales.value[item.inscripcionId] !== undefined && notasLocales.value[item.inscripcionId] !== '')
    .map(item => ({ inscripcionId: item.inscripcionId, nota: Number(notasLocales.value[item.inscripcionId]) }))

  if (!notas.length) { error.value = 'Ingresá al menos una nota'; return }

  guardandoNotas.value = true
  error.value = null
  exito.value = null
  try {
    await evaluacionApi.registrarNotas(actividadParaNotas.value.id, notas)
    exito.value = 'Notas guardadas — promedio recalculado'
    actividadParaNotas.value = null
    await cargarTodo()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar notas'
  } finally {
    guardandoNotas.value = false
  }
}

async function desactivarActividad(act: ActividadEvaluativa) {
  if (!confirm(`¿Desactivar "${act.nombre}"? Las notas ya registradas se conservan mas no se sumará en nuevos cálculos.`)) return
  try {
    await evaluacionApi.desactivarActividadEvaluativa(act.id)
    actividades.value = actividades.value.filter(a => a.id !== act.id)
    if (actividadParaNotas.value?.id === act.id) actividadParaNotas.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al desactivar la actividad'
  }
}

const statsFinales = computed(() => {
  if (!planilla.value) return null
  const promedios = planilla.value.planilla.map(p => p.promedio).filter((n): n is number => n !== null)
  if (!promedios.length) return null
  const promedio  = promedios.reduce((a, b) => a + b, 0) / promedios.length
  const aprobados = promedios.filter(n => n >= 51).length
  return { promedio: promedio.toFixed(1), aprobados, reprobados: promedios.length - aprobados }
})
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-2xl font-bold">Calificaciones — Actividades Evaluativas</h2>

    <div v-if="docenteStore.cargando" class="flex items-center gap-2 text-base-content/60">
      <span class="loading loading-spinner loading-sm"></span>
      Cargando tus asignaciones...
    </div>

    <div v-else-if="!docenteStore.tieneAsignaciones" role="alert" class="alert alert-warning">
      <span>No tenés asignaciones activas. Contactá al director.</span>
    </div>

    <template v-else>

      <!-- Selector de asignación -->
      <div v-if="docenteStore.asignaciones.length > 1" class="card bg-base-100 shadow">
        <div class="card-body py-3">
          <p class="text-xs text-base-content/50 mb-2">Seleccioná tu materia/curso:</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="asig in docenteStore.asignaciones"
              :key="asig.docenteMateriaCursoId"
              class="btn btn-sm"
              :class="asignacion?.docenteMateriaCursoId === asig.docenteMateriaCursoId ? 'btn-primary' : 'btn-ghost'"
              @click="cambiarAsignacion(asig)"
            >
              {{ asig.materia.nombre }} — {{ nombreCursoCorto(asig.curso) }}
            </button>
          </div>
        </div>
      </div>

      <!-- Info + selector de trimestre -->
      <div v-if="asignacion" class="card bg-base-100 shadow">
        <div class="card-body py-3 flex flex-wrap gap-4 items-center">
          <div><p class="text-xs text-base-content/50">Materia</p><p class="font-semibold">{{ asignacion.materia.nombre }}</p></div>
          <div><p class="text-xs text-base-content/50">Curso</p><p class="font-semibold">{{ nombreCursoCorto(asignacion.curso) }}</p></div>
          <div><p class="text-xs text-base-content/50">Estudiantes</p><p class="font-semibold">{{ asignacion.totalEstudiantes }}</p></div>
          <div class="ml-auto flex items-center gap-2">
            <select v-model="trimestreId" class="select select-bordered select-sm" @change="cargarTodo">
              <option :value="''" disabled>Trimestre</option>
              <option v-for="t in gestion.trimestres" :key="t.id" :value="t.id">
                {{ t.nombre }} {{ t.cerrado ? '🔒' : '' }}
              </option>
            </select>
            <button class="btn btn-primary btn-sm" :disabled="cargando || !trimestreId" @click="cargarTodo">
              <span v-if="cargando" class="loading loading-spinner loading-xs"></span>
              <span v-else>Cargar</span>
            </button>
          </div>
        </div>
      </div>

      <div v-if="error" role="alert" class="alert alert-error"><span>{{ error }}</span></div>
      <div v-if="exito" role="alert" class="alert alert-success"><span>{{ exito }}</span></div>

      <template v-if="planilla">
        <div v-if="trimCerrado" role="alert" class="alert alert-warning text-sm">
          <span>Trimestre cerrado — solo lectura. No se pueden crear actividades ni registrar notas.</span>
        </div>

        <!-- Tabs de dimensiones (Ser/Saber/Hacer...) -->
        <div role="tablist" class="tabs tabs-boxed w-fit">
          <a v-for="d in dimensiones" :key="d.id" role="tab" class="tab"
            :class="dimensionActiva?.id === d.id ? 'tab-active' : ''"
            @click="dimensionActiva = d"
          >
            {{ d.nombre }} <span class="opacity-50 ml-1">({{ (d.pesoEnPromedio * 100).toFixed(0) }}%)</span>
          </a>
        </div>

        <!-- Actividades de la dimensión activa -->
        <div v-if="dimensionActiva" class="card bg-base-100 shadow">
          <div class="card-body py-3">
            <div class="flex items-center justify-between">
              <p class="text-sm font-semibold">Actividades de "{{ dimensionActiva.nombre }}"</p>
              <button v-if="!trimCerrado" class="btn btn-xs btn-primary" @click="actividadFormAbierto = !actividadFormAbierto">
                + Nueva actividad
              </button>
            </div>

            <!-- Form de alta -->
            <div v-if="actividadFormAbierto" class="grid grid-cols-2 md:grid-cols-5 gap-2 items-end bg-base-200 p-3 rounded-lg mt-2">
              <fieldset class="fieldset col-span-2">
                <legend class="fieldset-legend text-xs">Nombre</legend>
                <input v-model="nuevaActividad.nombre" class="input input-bordered input-sm" placeholder="Ej: Examen parcial" />
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend text-xs">Fecha</legend>
                <input v-model="nuevaActividad.fecha" type="date" class="input input-bordered input-sm" />
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend text-xs">Puntaje máx.</legend>
                <input v-model.number="nuevaActividad.puntajeMaximo" type="number" min="1" class="input input-bordered input-sm" />
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend text-xs">Peso (0–1)</legend>
                <input v-model.number="nuevaActividad.peso" type="number" min="0" max="9.999" step="0.1" class="input input-bordered input-sm" />
              </fieldset>
              <label class="label cursor-pointer justify-start gap-2 col-span-2">
                <input v-model="nuevaActividad.esRecuperatorio" type="checkbox" class="checkbox checkbox-sm" />
                <span class="text-xs">Es recuperatorio</span>
              </label>
              <button class="btn btn-sm btn-primary" :disabled="guardandoActividad" @click="crearActividad">
                <span v-if="guardandoActividad" class="loading loading-spinner loading-xs"></span>
                Crear
              </button>
            </div>

            <!-- Lista de actividades -->
            <div v-if="actividadesDeLaDimension.length" class="flex flex-wrap gap-2 mt-3">
              <div v-for="act in actividadesDeLaDimension" :key="act.id"
                class="join border border-base-300 rounded-lg overflow-hidden">
                <button class="join-item btn btn-sm"
                  :class="actividadParaNotas?.id === act.id ? 'btn-primary' : 'btn-ghost'"
                  @click="abrirNotas(act)"
                >
                  {{ act.nombre }}
                  <span class="badge badge-sm ml-1">{{ act._count?.notas ?? 0 }}/{{ planilla.totalEstudiantes }}</span>
                  <span v-if="act.esRecuperatorio" class="badge badge-sm badge-warning ml-1">Rec.</span>
                </button>
                <button v-if="!trimCerrado" class="join-item btn btn-sm btn-ghost text-error" title="Desactivar"
                  @click="desactivarActividad(act)">✕</button>
              </div>
            </div>
            <p v-else class="text-sm text-base-content/40 mt-2">Sin actividades registradas en esta dimensión todavía.</p>
          </div>
        </div>

        <!-- Registrar notas de la actividad seleccionada -->
        <div v-if="actividadParaNotas" class="card bg-base-100 shadow">
          <div class="card-body py-3">
            <p class="text-sm font-semibold mb-2">
              Notas — {{ actividadParaNotas.nombre }} (máx. {{ actividadParaNotas.puntajeMaximo }})
            </p>
            <div class="overflow-x-auto">
              <table class="table table-sm">
                <thead><tr><th>#</th><th>Estudiante</th><th>Nota</th></tr></thead>
                <tbody>
                  <tr v-for="(item, idx) in planilla.planilla" :key="item.inscripcionId">
                    <td class="text-base-content/40">{{ idx + 1 }}</td>
                    <td>{{ item.estudiante.apellido }}, {{ item.estudiante.nombre }}</td>
                    <td>
                      <input
                        v-model="notasLocales[item.inscripcionId]"
                        type="number" min="0" :max="actividadParaNotas.puntajeMaximo" step="0.5"
                        class="input input-bordered input-sm w-24"
                        :class="erroresNota[item.inscripcionId] ? 'input-error' : ''"
                        placeholder="—"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="flex justify-end mt-2">
              <button class="btn btn-primary btn-sm" :disabled="guardandoNotas || hayErroresNota" @click="guardarNotas">
                <span v-if="guardandoNotas" class="loading loading-spinner loading-xs"></span>
                Guardar notas
              </button>
            </div>
          </div>
        </div>

        <!-- Planilla final (solo lectura — promedio calculado por el backend) -->
        <div class="card bg-base-100 shadow overflow-x-auto">
          <div class="card-body py-3">
            <p class="text-sm font-semibold mb-2">Promedios del trimestre ({{ planilla.notasRegistradas }}/{{ planilla.totalEstudiantes }} con nota)</p>
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>#</th><th>Estudiante</th>
                  <th v-for="d in dimensiones" :key="d.id">{{ d.nombre }}</th>
                  <th>Promedio</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, idx) in planilla.planilla" :key="item.inscripcionId" class="hover">
                  <td class="text-base-content/40 text-sm">{{ idx + 1 }}</td>
                  <td class="font-medium">{{ item.estudiante.apellido }}, {{ item.estudiante.nombre }}</td>
                  <td v-for="d in dimensiones" :key="d.id" class="text-center">
                    {{ item.dimensiones.find(x => x.nombre === d.nombre)?.promedio?.toFixed(1) ?? '—' }}
                  </td>
                  <td class="font-semibold">{{ item.promedio !== null ? item.promedio.toFixed(1) : '—' }}</td>
                  <td>
                    <span v-if="item.promedio !== null" class="badge badge-sm" :class="item.promedio >= 51 ? 'badge-success' : 'badge-error'">
                      {{ item.promedio >= 51 ? 'Aprobado' : 'Reprobado' }}
                    </span>
                    <span v-else class="text-base-content/30 text-sm">Sin nota</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="statsFinales" class="flex flex-wrap items-center gap-3">
          <span class="badge badge-outline">Promedio general: {{ statsFinales.promedio }}</span>
          <span class="badge badge-success badge-outline">Aprobados: {{ statsFinales.aprobados }}</span>
          <span class="badge badge-error badge-outline">Reprobados: {{ statsFinales.reprobados }}</span>
        </div>
      </template>

      <div v-else-if="!cargando && asignacion" class="text-center text-base-content/40 py-8">
        Seleccioná un trimestre para cargar la planilla
      </div>

    </template>
  </div>
</template>