<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { boletinApi, descargarBlob, type BoletinGeneralResponse, type MejoresEstudiantesResponse } from '@/api/boletin.api'
import { useBuscadorEstudiante } from '@/composables/useBuscadorEstudiante.ts'
import { useGestionStore } from '@/stores/gestion.store'
import AppIcon from '@/components/AppIcon.vue'
import BoletinGeneralTabla from '@/components/boletines/BoletinGeneralTabla.vue'
import BoletinGeneralCards from '@/components/boletines/BoletinGeneralCards.vue'
import BoletinEstudianteCard from '@/components/boletines/BoletinEstudianteCard.vue'

const gestion = useGestionStore()
onMounted(() => gestion.cargar())

// ── Tabs (divide y vencerás: solo el tab activo se ve y se carga) ─────────────
type Tab = 'individual' | 'curso' | 'general' | 'ranking'
const tab = ref<Tab>('individual')

// ── Boletín individual ────────────────────────────────────────────────────────
const buscadorInd = useBuscadorEstudiante()
const trimestreId = ref<number | ''>('')
const descargandoInd = ref(false)
const descargandoLibreta = ref(false)
const errorInd = ref<string | null>(null)
const mostrarPreview = ref(false)

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
  <div class="space-y-4">
    <div>
      <h2 class="text-2xl font-bold">Boletines</h2>
      <p class="text-sm text-base-content/60">Elegí una pestaña según lo que necesites hacer</p>
    </div>

    <!-- Tabs: 1 acción por pantalla, ideal en celular -->
    <div role="tablist" class="tabs tabs-boxed w-full overflow-x-auto sticky top-0 z-10 bg-base-200/80 backdrop-blur p-1">
      <a role="tab" class="tab whitespace-nowrap" :class="tab === 'individual' ? 'tab-active' : ''" @click="tab = 'individual'">Individual</a>
      <a role="tab" class="tab whitespace-nowrap" :class="tab === 'curso' ? 'tab-active' : ''" @click="tab = 'curso'">Por curso</a>
      <a role="tab" class="tab whitespace-nowrap" :class="tab === 'general' ? 'tab-active' : ''" @click="tab = 'general'">General</a>
      <a role="tab" class="tab whitespace-nowrap" :class="tab === 'ranking' ? 'tab-active' : ''" @click="tab = 'ranking'">Ranking</a>
    </div>

    <!-- ── TAB: Individual + Libreta anual ─────────────────────────────────── -->
    <section v-if="tab === 'individual'" class="card bg-base-100 shadow">
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

        <button class="btn btn-ghost w-full border border-base-300" :disabled="!buscadorInd.seleccionado.value"
          @click="mostrarPreview = true">
          <AppIcon nombre="ojoAbierto" class="h-4 w-4" />
          Vista previa
        </button>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button class="btn btn-primary w-full" :disabled="descargandoInd || !buscadorInd.seleccionado.value || !trimestreId"
            @click="descargarIndividual">
            <span v-if="descargandoInd" class="loading loading-spinner loading-sm"></span>
            <AppIcon v-else nombre="documento" class="h-4 w-4" />
            {{ descargandoInd ? 'Generando...' : 'Boletín trimestral' }}
          </button>
          <button class="btn btn-outline btn-primary w-full" :disabled="descargandoLibreta || !buscadorInd.seleccionado.value"
            @click="descargarLibreta">
            <span v-if="descargandoLibreta" class="loading loading-spinner loading-sm"></span>
            <AppIcon v-else nombre="documento" class="h-4 w-4" />
            {{ descargandoLibreta ? 'Generando...' : 'Libreta anual' }}
          </button>
        </div>
        <p class="text-xs text-base-content/40">
          La libreta anual junta los 3 trimestres + promedio anual de todas las materias, y no requiere elegir trimestre.
        </p>

        <BoletinEstudianteCard
          v-if="mostrarPreview && buscadorInd.seleccionado.value && gestion.gestionId"
          :estudianteId="buscadorInd.seleccionado.value.id"
          :gestionId="gestion.gestionId"
          @close="mostrarPreview = false"
        >
          <template #acciones>
            <button class="btn btn-primary btn-sm" :disabled="!trimestreId"
              @click="mostrarPreview = false; descargarIndividual()">
              Descargar PDF
            </button>
          </template>
        </BoletinEstudianteCard>
      </div>
    </section>

    <!-- ── TAB: Boletines masivos por curso ────────────────────────────────── -->
    <section v-if="tab === 'curso'" class="card bg-base-100 shadow">
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
        <p class="text-xs text-base-content/40 text-center">
          ¿Querés revisar las notas antes de generar? Mirá el tab
          <button type="button" class="link link-primary" @click="tab = 'general'">General</button>
        </p>
      </div>
    </section>

    <!-- ── TAB: Boletín General ────────────────────────────────────────────── -->
    <section v-if="tab === 'general'" class="card bg-base-100 shadow">
      <div class="card-body space-y-4">
        <div>
          <h3 class="font-semibold text-lg">Boletín General</h3>
          <p class="text-sm text-base-content/60">
            Todas las materias x todos los trimestres del curso, para revisar antes de imprimir.
          </p>
        </div>

        <div v-if="errorGeneral" role="alert" class="alert alert-error py-2 text-sm"><span>{{ errorGeneral }}</span></div>

        <div class="flex flex-col sm:flex-row gap-3 sm:items-end">
          <fieldset class="fieldset flex-1">
            <legend class="fieldset-legend text-xs">Curso</legend>
            <select v-model="cursoIdGeneral" class="select select-bordered w-full">
              <option value="" disabled>Seleccionar curso</option>
              <option v-for="c in gestion.cursos" :key="c.id" :value="c.id">{{ c.nombre }}</option>
            </select>
          </fieldset>
          <button class="btn btn-primary w-full sm:w-auto" :disabled="cargandoGeneral || !cursoIdGeneral" @click="verBoletinGeneral">
            <span v-if="cargandoGeneral" class="loading loading-spinner loading-sm"></span>
            Ver boletín general
          </button>
        </div>

        <div v-if="boletinGeneral" class="space-y-3">
          <!-- Cards con detalle SER/SABER/HACER por trimestre (celular y escritorio) -->
          <BoletinGeneralCards :boletin="boletinGeneral" />
          <!-- Tabla ancha original, solo desktop y colapsada -->
          <details class="hidden md:block rounded-box border border-base-300">
            <summary class="cursor-pointer px-4 py-2 text-sm font-medium text-base-content/70 hover:text-base-content">
              Vista tabla completa (comparar todo el curso)
            </summary>
            <div class="p-2">
              <BoletinGeneralTabla :boletin="boletinGeneral" />
            </div>
          </details>
        </div>
      </div>
    </section>

    <!-- ── TAB: Mejores Estudiantes ────────────────────────────────────────── -->
    <section v-if="tab === 'ranking'" class="card bg-base-100 shadow">
      <div class="card-body space-y-4">
        <div>
          <h3 class="font-semibold text-lg">Mejores Estudiantes</h3>
          <p class="text-sm text-base-content/60">Ranking por trimestre y anual, a partir del Boletín General del curso</p>
        </div>

        <div v-if="errorMejores" role="alert" class="alert alert-error py-2 text-sm"><span>{{ errorMejores }}</span></div>

        <div class="flex flex-col sm:flex-row gap-3 sm:items-end">
          <fieldset class="fieldset flex-1">
            <legend class="fieldset-legend text-xs">Curso</legend>
            <select v-model="cursoIdMejores" class="select select-bordered w-full">
              <option value="" disabled>Seleccionar curso</option>
              <option v-for="c in gestion.cursos" :key="c.id" :value="c.id">{{ c.nombre }}</option>
            </select>
          </fieldset>
          <fieldset class="fieldset w-full sm:w-24">
            <legend class="fieldset-legend text-xs">Puestos</legend>
            <input v-model.number="limiteMejores" type="number" min="1" max="10" class="input input-bordered w-full" />
          </fieldset>
          <button class="btn btn-primary w-full sm:w-auto" :disabled="cargandoMejores || !cursoIdMejores" @click="verMejores">
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
    </section>

  </div>
</template>