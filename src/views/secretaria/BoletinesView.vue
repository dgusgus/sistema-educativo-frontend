<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { boletinApi, descargarBlob } from '@/api/boletin.api'
import { useBuscadorEstudiante } from '@/composables/useBuscadorEstudiante.ts'
import { useGestionStore } from '@/stores/gestion.store'

const gestion = useGestionStore()
onMounted(() => gestion.cargar())

// ── Boletín individual ────────────────────────────────────────────────────────
const buscadorInd    = useBuscadorEstudiante()
const trimestreId    = ref<number | ''>('')
const descargandoInd = ref(false)
const errorInd       = ref<string | null>(null)

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
    // El backend rechaza (400) si el trimestre elegido no está cerrado —
    // igual lo filtramos en el select, esto es red de seguridad extra.
    errorInd.value = e instanceof Error ? e.message : 'Error al generar boletín'
  } finally {
    descargandoInd.value = false
  }
}

// ── Boletín masivo por curso ──────────────────────────────────────────────────
const cursoId         = ref<number | ''>('')
const trimestreIdMas  = ref<number | ''>('')
const descargandoMas  = ref(false)
const errorMas        = ref<string | null>(null)

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
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-2xl font-bold">Boletines</h2>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

      <!-- Boletín individual -->
      <div class="card bg-base-100 shadow">
        <div class="card-body space-y-4">
          <div>
            <h3 class="font-semibold text-lg">Boletín Individual</h3>
            <p class="text-sm text-base-content/60">Genera el boletín PDF de un estudiante por trimestre</p>
          </div>

          <div v-if="errorInd" role="alert" class="alert alert-error py-2 text-sm">
            <span>{{ errorInd }}</span>
          </div>

          <!-- Buscador de estudiante -->
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Estudiante</legend>
            <div class="relative">
              <label class="input input-bordered flex items-center gap-2 w-full">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
                </svg>
                <input
                  v-model="buscadorInd.query.value"
                  type="search"
                  placeholder="Nombre o CI..."
                  class="grow"
                  @input="buscadorInd.onInput"
                />
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

          <!-- Trimestre — solo los cerrados, porque el backend exige eso -->
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Trimestre</legend>
            <select v-model="trimestreId" class="select select-bordered w-full">
              <option value="" disabled>Seleccionar trimestre</option>
              <option v-for="t in gestion.trimestres" :key="t.id" :value="t.id" :disabled="!t.cerrado">
                {{ t.nombre }} {{ t.cerrado ? '🔒 Cerrado' : '(abierto — no disponible aún)' }}
              </option>
            </select>
            <p v-if="gestion.trimestres.every(t => !t.cerrado)" class="text-xs text-base-content/40 mt-1">
              Ningún trimestre está cerrado todavía — el boletín se habilita recién al cerrarlo.
            </p>
          </fieldset>

          <button
            class="btn btn-primary w-full"
            :disabled="descargandoInd || !buscadorInd.seleccionado.value || !trimestreId"
            @click="descargarIndividual"
          >
            <span v-if="descargandoInd" class="loading loading-spinner loading-sm"></span>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            {{ descargandoInd ? 'Generando PDF...' : 'Descargar boletín' }}
          </button>
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

          <button
            class="btn btn-secondary w-full"
            :disabled="descargandoMas || !cursoId || !trimestreIdMas"
            @click="descargarMasivo"
          >
            <span v-if="descargandoMas" class="loading loading-spinner loading-sm"></span>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            {{ descargandoMas ? 'Generando PDFs...' : 'Descargar todos' }}
          </button>
        </div>
      </div>

    </div>
  </div>
</template>