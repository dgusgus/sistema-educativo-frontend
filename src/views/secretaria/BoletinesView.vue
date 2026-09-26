<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { boletinApi, descargarBlob, type BoletinGeneralResponse, type MejoresEstudiantesResponse } from '@/api/boletin.api'
import { useBuscadorEstudiante } from '@/composables/useBuscadorEstudiante.ts'
import { useGestionStore } from '@/stores/gestion.store'
import AppIcon from '@/components/AppIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const gestion = useGestionStore()
onMounted(() => gestion.cargar())

// ── Boletín individual ────────────────────────────────────────────────────────
const buscadorInd = useBuscadorEstudiante()
const trimestreId = ref<number | ''>('')
const descargandoInd = ref(false)
const descargandoLibreta = ref(false)
const errorInd = ref<string | null>(null)

async function descargarIndividual() {
  const estudianteId = buscadorInd.seleccionado.value?.id
  if (!estudianteId || !trimestreId.value) {
    errorInd.value = 'Elegí un estudiante y un trimestre'
    return
  }
  descargandoInd.value = true
  errorInd.value = null
  try {
    const blob = await boletinApi.getIndividual(estudianteId, Number(trimestreId.value))
    const nombreArchivo = `boletin_${buscadorInd.seleccionado.value!.apellido}_${buscadorInd.seleccionado.value!.nombre}.pdf`
      .replace(/\s+/g, '_')
    descargarBlob(blob, nombreArchivo)
  } catch (e) {
    errorInd.value = e instanceof Error ? e.message : 'Error al generar boletín'
  } finally {
    descargandoInd.value = false
  }
}

// Libreta anual — usa la gestión del trimestre elegido (todos los
// trimestres de la lista pertenecen a la misma gestión activa).
// ⚠️ Asume que los objetos de gestion.trimestres traen `gestionId`
// (igual que el Trimestre real del backend) — si tu store lo omite al
// mapear la respuesta, agregalo ahí.
async function descargarLibreta() {
  const estudianteId = buscadorInd.seleccionado.value?.id
  const trimestre = gestion.trimestres.find(t => t.id === trimestreId.value) as { gestionId?: number } | undefined
  const gestionId = trimestre?.gestionId ?? gestion.gestionId

  if (!estudianteId || !gestionId) {
    errorInd.value = 'Elegí un estudiante (la libreta usa la gestión activa)'
    return
  }
  descargandoLibreta.value = true
  errorInd.value = null
  try {
    const blob = await boletinApi.getLibreta(estudianteId, gestionId)
    const nombreArchivo = `libreta_${buscadorInd.seleccionado.value!.apellido}_${buscadorInd.seleccionado.value!.nombre}.pdf`
      .replace(/\s+/g, '_')
    descargarBlob(blob, nombreArchivo)
  } catch (e) {
    errorInd.value = e instanceof Error ? e.message : 'Error al generar la libreta'
  } finally {
    descargandoLibreta.value = false
  }
}

// ── Boletín masivo por curso ──────────────────────────────────────────────────
const cursoId = ref<number | ''>('')
const trimestreIdMas = ref<number | ''>('')
const descargandoMas = ref(false)
const errorMas = ref<string | null>(null)

async function descargarMasivo() {
  if (!cursoId.value || !trimestreIdMas.value) {
    errorMas.value = 'Elegí un curso y un trimestre'
    return
  }
  descargandoMas.value = true
  errorMas.value = null
  try {
    const cursoNombre = gestion.cursos.find(c => c.id === cursoId.value)?.nombre ?? cursoId.value
    const blob = await boletinApi.getMasivo(Number(cursoId.value), Number(trimestreIdMas.value))
    descargarBlob(blob, `boletines_${cursoNombre}.pdf`.replace(/\s+/g, '_'))
  } catch (e) {
    errorMas.value = e instanceof Error ? e.message : 'Error al generar boletines'
  } finally {
    descargandoMas.value = false
  }
}

// ── Boletín General en pantalla ───────────────────────────────────────────────
const cursoIdGeneral = ref<number | ''>('')
const boletinGeneral = ref<BoletinGeneralResponse | null>(null)
const cargandoGeneral = ref(false)
const errorGeneral = ref<string | null>(null)

async function verBoletinGeneral() {
  if (!cursoIdGeneral.value) { errorGeneral.value = 'Elegí un curso'; return }
  cargandoGeneral.value = true
  errorGeneral.value = null
  boletinGeneral.value = null
  try {
    boletinGeneral.value = await boletinApi.getGeneral(Number(cursoIdGeneral.value))
  } catch (e) {
    errorGeneral.value = e instanceof Error ? e.message : 'Error al cargar el boletín general'
  } finally {
    cargandoGeneral.value = false
  }
}

function claseNota(nota: number | null): string {
  if (nota === null) return 'text-base-content/30'
  if (nota >= 71) return 'text-success font-semibold'
  if (nota >= 51) return 'text-warning font-semibold'
  return 'text-error font-semibold'
}

// ── Mejores Estudiantes ───────────────────────────────────────────────────────
const cursoIdMejores = ref<number | ''>('')
const limiteMejores = ref(3)
const mejores = ref<MejoresEstudiantesResponse | null>(null)
const cargandoMejores = ref(false)
const errorMejores = ref<string | null>(null)

async function verMejores() {
  if (!cursoIdMejores.value) { errorMejores.value = 'Elegí un curso'; return }
  cargandoMejores.value = true
  errorMejores.value = null
  mejores.value = null
  try {
    mejores.value = await boletinApi.getMejores(Number(cursoIdMejores.value), limiteMejores.value)
  } catch (e) {
    errorMejores.value = e instanceof Error ? e.message : 'Error al cargar el ranking'
  } finally {
    cargandoMejores.value = false
  }
}

function medalla(puesto: number): string {
  return puesto === 1 ? '🥇' : puesto === 2 ? '🥈' : puesto === 3 ? '🥉' : `${puesto}°`
}
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-2xl font-bold">Boletines</h2>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

      <!-- Boletín individual + Libreta anual -->
      <div class="card bg-base-100 shadow">
        <div class="card-body space-y-4">
          <div>
            <h3 class="font-semibold text-lg">Boletín Individual</h3>
            <p class="text-sm text-base-content/60">PDF de un trimestre, o la libreta anual completa</p>
          </div>

          <div v-if="errorInd" role="alert" class="alert alert-error py-2 text-sm">
            <span>{{ errorInd }}</span>
          </div>

          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Estudiante</legend>
            <div class="relative">
              <label class="input input-bordered flex items-center gap-2 w-full">
                <AppIcon nombre="buscar" class="h-4 w-4 opacity-50" />
                <input v-model="buscadorInd.query.value" type="search" placeholder="Nombre o CI..." class="grow"
                  @input="buscadorInd.onInput" />
                <span v-if="buscadorInd.buscando.value" class="loading loading-spinner loading-xs"></span>
              </label>
              <ul v-if="buscadorInd.resultados.value.length"
                class="absolute z-10 mt-1 w-full bg-base-100 rounded-box shadow-lg border border-base-300 max-h-56 overflow-y-auto">
                <li v-for="e in buscadorInd.resultados.value" :key="e.id">
                  <button class="w-full text-left px-4 py-2 hover:bg-base-200 flex justify-between items-center"
                    @click="buscadorInd.seleccionar(e)">
                    <span>{{ e.apellido }}, {{ e.nombre }}</span>
                    <span class="font-mono text-xs text-base-content/50">{{ e.ci }}</span>
                  </button>
                </li>
              </ul>
            </div>
            <p v-if="buscadorInd.seleccionado.value" class="text-xs text-success mt-1">
              ✓ {{ buscadorInd.seleccionado.value.nombre }} {{ buscadorInd.seleccionado.value.apellido }}
              <button type="button" class="link ml-1" @click="buscadorInd.limpiar">cambiar</button>
            </p>
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Trimestre (para el boletín trimestral)</legend>
            <select v-model="trimestreId" class="select select-bordered w-full">
              <option value="" disabled>Seleccionar trimestre</option>
              <option v-for="t in gestion.trimestres" :key="t.id" :value="t.id" :disabled="!t.cerrado">
                {{ t.nombre }} {{ t.cerrado ? '🔒 Cerrado' : '(abierto — no disponible aún)' }}
              </option>
            </select>
          </fieldset>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button class="btn btn-primary" :disabled="descargandoInd || !buscadorInd.seleccionado.value || !trimestreId"
              @click="descargarIndividual">
              <span v-if="descargandoInd" class="loading loading-spinner loading-sm"></span>
              <AppIcon v-else nombre="documento" class="h-4 w-4" />
              {{ descargandoInd ? 'Generando...' : 'Boletín trimestral' }}
            </button>
            <button class="btn btn-outline btn-primary" :disabled="descargandoLibreta || !buscadorInd.seleccionado.value"
              @click="descargarLibreta">
              <span v-if="descargandoLibreta" class="loading loading-spinner loading-sm"></span>
              <AppIcon v-else nombre="documento" class="h-4 w-4" />
              {{ descargandoLibreta ? 'Generando...' : 'Libreta anual' }}
            </button>
          </div>
          <p class="text-xs text-base-content/40">
            La libreta anual junta los 3 trimestres + promedio anual de todas las materias, y no requiere elegir trimestre.
          </p>
        </div>
      </div>

      <!-- Boletín masivo -->
      <div class="card bg-base-100 shadow">
        <div class="card-body space-y-4">
          <div>
            <h3 class="font-semibold text-lg">Boletines Masivos</h3>
            <p class="text-sm text-base-content/60">Genera un PDF con todos los boletines del curso</p>
          </div>

          <div v-if="errorMas" role="alert" class="alert alert-error py-2 text-sm">
            <span>{{ errorMas }}</span>
          </div>

          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Curso</legend>
            <select v-model="cursoId" class="select select-bordered w-full">
              <option value="" disabled>Seleccionar curso</option>
              <option v-for="c in gestion.cursos" :key="c.id" :value="c.id">{{ c.nombre }}</option>
            </select>
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Trimestre</legend>
            <select v-model="trimestreIdMas" class="select select-bordered w-full">
              <option value="" disabled>Seleccionar trimestre</option>
              <option v-for="t in gestion.trimestres" :key="t.id" :value="t.id" :disabled="!t.cerrado">
                {{ t.nombre }} {{ t.cerrado ? '🔒 Cerrado' : '(abierto — no disponible aún)' }}
              </option>
            </select>
          </fieldset>

          <button class="btn btn-secondary w-full" :disabled="descargandoMas || !cursoId || !trimestreIdMas"
            @click="descargarMasivo">
            <span v-if="descargandoMas" class="loading loading-spinner loading-sm"></span>
            <AppIcon v-else nombre="descargar" class="h-4 w-4" />
            {{ descargandoMas ? 'Generando PDFs...' : 'Descargar todos' }}
          </button>
        </div>
      </div>

    </div>

    <!-- ── Boletín General en pantalla ─────────────────────────────────────── -->
    <div class="card bg-base-100 shadow">
      <div class="card-body space-y-4">
        <div>
          <h3 class="font-semibold text-lg">Boletín General (vista en pantalla)</h3>
          <p class="text-sm text-base-content/60">
            Todas las materias x todos los trimestres del curso, para revisar antes de imprimir.
          </p>
        </div>

        <div v-if="errorGeneral" role="alert" class="alert alert-error py-2 text-sm"><span>{{ errorGeneral }}</span></div>

        <div class="flex flex-wrap gap-3 items-end">
          <fieldset class="fieldset flex-1 min-w-48">
            <legend class="fieldset-legend text-xs">Curso</legend>
            <select v-model="cursoIdGeneral" class="select select-bordered w-full">
              <option value="" disabled>Seleccionar curso</option>
              <option v-for="c in gestion.cursos" :key="c.id" :value="c.id">{{ c.nombre }}</option>
            </select>
          </fieldset>
          <button class="btn btn-primary" :disabled="cargandoGeneral || !cursoIdGeneral" @click="verBoletinGeneral">
            <span v-if="cargandoGeneral" class="loading loading-spinner loading-sm"></span>
            Ver boletín general
          </button>
        </div>

        <div v-if="boletinGeneral" class="overflow-x-auto">
          <table class="table table-xs table-pin-rows">
            <thead>
              <tr>
                <th rowspan="2" class="align-bottom">Estudiante</th>
                <th v-for="m in boletinGeneral.materias" :key="m.docenteMateriaCursoId"
                  :colspan="boletinGeneral.trimestres.length + 1" class="text-center border-l border-base-300">
                  {{ m.nombre }}
                </th>
                <th :colspan="boletinGeneral.trimestres.length + 1" class="text-center border-l border-base-300">
                  Promedio General
                </th>
              </tr>
              <tr>
                <template v-for="m in boletinGeneral.materias" :key="`h-${m.docenteMateriaCursoId}`">
                  <th v-for="t in boletinGeneral.trimestres" :key="`h-${m.docenteMateriaCursoId}-${t.id}`"
                    class="text-center font-normal text-xs border-l border-base-300">
                    T{{ t.numero }}
                  </th>
                  <th class="text-center text-xs">Anual</th>
                </template>
                <th v-for="t in boletinGeneral.trimestres" :key="`hg-${t.id}`"
                  class="text-center font-normal text-xs border-l border-base-300">
                  T{{ t.numero }}
                </th>
                <th class="text-center text-xs">Anual</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="est in boletinGeneral.estudiantes" :key="est.inscripcionId" class="hover">
                <td class="font-medium whitespace-nowrap">{{ est.nombreCompleto }}</td>
                <template v-for="m in est.materias" :key="`c-${est.inscripcionId}-${m.docenteMateriaCursoId}`">
                  <td v-for="t in boletinGeneral.trimestres" :key="`c-${est.inscripcionId}-${m.docenteMateriaCursoId}-${t.id}`"
                    class="text-center border-l border-base-300" :class="claseNota(m.notasPorTrimestre[t.id])">
                    {{ m.notasPorTrimestre[t.id] ?? '—' }}
                  </td>
                  <td class="text-center" :class="claseNota(m.promedioAnual)">
                    {{ m.promedioAnual ?? '—' }}
                  </td>
                </template>
                <td v-for="t in boletinGeneral.trimestres" :key="`cg-${est.inscripcionId}-${t.id}`"
                  class="text-center border-l border-base-300" :class="claseNota(est.promedioGeneralPorTrimestre[t.id])">
                  {{ est.promedioGeneralPorTrimestre[t.id] ?? '—' }}
                </td>
                <td class="text-center" :class="claseNota(est.promedioGeneralAnual)">
                  <div class="flex items-center justify-center gap-1">
                    <span>{{ est.promedioGeneralAnual ?? '—' }}</span>
                    <StatusBadge v-if="est.promedioGeneralAnual !== null"
                      :estado="est.promedioGeneralAnual >= 51 ? 'PROMOVIDO' : 'REPROBADO'" tamano="xs" />
                  </div>
                </td>
              </tr>
              <tr v-if="!boletinGeneral.estudiantes.length">
                <td :colspan="1 + boletinGeneral.materias.length * (boletinGeneral.trimestres.length + 1) + boletinGeneral.trimestres.length + 1"
                  class="text-center text-base-content/40 py-8">
                  Este curso no tiene estudiantes activos
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── Mejores Estudiantes ─────────────────────────────────────────────── -->
    <div class="card bg-base-100 shadow">
      <div class="card-body space-y-4">
        <div>
          <h3 class="font-semibold text-lg">Mejores Estudiantes</h3>
          <p class="text-sm text-base-content/60">Ranking por trimestre y anual, a partir del Boletín General del curso</p>
        </div>

        <div v-if="errorMejores" role="alert" class="alert alert-error py-2 text-sm"><span>{{ errorMejores }}</span></div>

        <div class="flex flex-wrap gap-3 items-end">
          <fieldset class="fieldset flex-1 min-w-48">
            <legend class="fieldset-legend text-xs">Curso</legend>
            <select v-model="cursoIdMejores" class="select select-bordered w-full">
              <option value="" disabled>Seleccionar curso</option>
              <option v-for="c in gestion.cursos" :key="c.id" :value="c.id">{{ c.nombre }}</option>
            </select>
          </fieldset>
          <fieldset class="fieldset w-24">
            <legend class="fieldset-legend text-xs">Puestos</legend>
            <input v-model.number="limiteMejores" type="number" min="1" max="10" class="input input-bordered w-full" />
          </fieldset>
          <button class="btn btn-primary" :disabled="cargandoMejores || !cursoIdMejores" @click="verMejores">
            <span v-if="cargandoMejores" class="loading loading-spinner loading-sm"></span>
            Ver ranking
          </button>
        </div>

        <div v-if="mejores" class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div v-for="t in mejores.trimestres" :key="t.id" class="rounded-box border border-base-300 p-3">
            <h4 class="font-semibold text-sm mb-2">{{ t.nombre }}</h4>
            <ul class="space-y-1">
              <li v-for="item in mejores.porTrimestre[t.id]" :key="`${t.id}-${item.inscripcionId}`"
                class="flex justify-between text-sm">
                <span>{{ medalla(item.puesto) }} {{ item.nombreCompleto }}</span>
                <span class="font-mono font-semibold">{{ item.promedio.toFixed(1) }}</span>
              </li>
              <li v-if="!mejores.porTrimestre[t.id]?.length" class="text-xs text-base-content/40">Sin notas todavía</li>
            </ul>
          </div>
          <div class="rounded-box border border-primary/30 bg-primary/5 p-3">
            <h4 class="font-semibold text-sm mb-2">Promedio Anual</h4>
            <ul class="space-y-1">
              <li v-for="item in mejores.anual" :key="`anual-${item.inscripcionId}`" class="flex justify-between text-sm">
                <span>{{ medalla(item.puesto) }} {{ item.nombreCompleto }}</span>
                <span class="font-mono font-semibold">{{ item.promedio.toFixed(1) }}</span>
              </li>
              <li v-if="!mejores.anual.length" class="text-xs text-base-content/40">Sin promedios anuales todavía</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>