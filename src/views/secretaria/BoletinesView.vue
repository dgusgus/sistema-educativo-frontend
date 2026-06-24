<script setup lang="ts">
import { ref } from 'vue'
import { boletinApi, descargarBlob } from '@/api/boletin.api'

// ── Boletín individual ────────────────────────────────────────────────────────
const estudianteId  = ref<number | ''>('')
const trimestreId   = ref<number | ''>('')
const descargandoInd = ref(false)
const errorInd      = ref<string | null>(null)

async function descargarIndividual() {
  if (!estudianteId.value || !trimestreId.value) {
    errorInd.value = 'Completá ambos campos'
    return
  }
  descargandoInd.value = true
  errorInd.value = null
  try {
    const blob = await boletinApi.getIndividual(
      Number(estudianteId.value),
      Number(trimestreId.value),
    )
    descargarBlob(blob, `boletin_estudiante_${estudianteId.value}_trim_${trimestreId.value}.pdf`)
  } catch (e) {
    errorInd.value = e instanceof Error ? e.message : 'Error al generar boletín'
  } finally {
    descargandoInd.value = false
  }
}

// ── Boletín masivo por curso ──────────────────────────────────────────────────
const cursoId        = ref<number | ''>('')
const trimestreIdMas = ref<number | ''>('')
const descargandoMas = ref(false)
const errorMas       = ref<string | null>(null)

async function descargarMasivo() {
  if (!cursoId.value || !trimestreIdMas.value) {
    errorMas.value = 'Completá ambos campos'
    return
  }
  descargandoMas.value = true
  errorMas.value = null
  try {
    const blob = await boletinApi.getMasivo(
      Number(cursoId.value),
      Number(trimestreIdMas.value),
    )
    descargarBlob(blob, `boletines_curso_${cursoId.value}_trim_${trimestreIdMas.value}.pdf`)
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

          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">ID Estudiante</legend>
            <input v-model="estudianteId" type="number" min="1" placeholder="Ej: 1" class="input input-bordered w-full" />
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">ID Trimestre</legend>
            <input v-model="trimestreId" type="number" min="1" placeholder="Ej: 1" class="input input-bordered w-full" />
          </fieldset>

          <button
            class="btn btn-primary w-full"
            :disabled="descargandoInd"
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
            <legend class="fieldset-legend text-xs">ID Curso</legend>
            <input v-model="cursoId" type="number" min="1" placeholder="Ej: 1" class="input input-bordered w-full" />
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">ID Trimestre</legend>
            <input v-model="trimestreIdMas" type="number" min="1" placeholder="Ej: 1" class="input input-bordered w-full" />
          </fieldset>

          <button
            class="btn btn-secondary w-full"
            :disabled="descargandoMas"
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