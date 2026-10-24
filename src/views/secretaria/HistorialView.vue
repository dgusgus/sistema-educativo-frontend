<script setup lang="ts">
// Historial académico (Director y Secretaría): buscan al estudiante y ven todas sus gestiones.
import { useBuscadorEstudiante } from '@/composables/useBuscadorEstudiante'
import HistorialAcademico from '@/components/historial/HistorialAcademico.vue'
import AppIcon from '@/components/AppIcon.vue'

const buscador = useBuscadorEstudiante()
</script>

<template>
  <div class="space-y-4">
    <div>
      <h2 class="text-2xl font-bold">Historial académico</h2>
      <p class="text-sm text-base-content/60">Notas por gestión y trimestre desde que el estudiante ingresó. Se puede descargar como certificado.</p>
    </div>

    <div class="card bg-base-100 shadow">
      <div class="card-body p-4">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Estudiante</legend>
          <div class="relative max-w-lg">
            <label class="input input-bordered flex items-center gap-2 w-full">
              <AppIcon nombre="buscar" class="h-4 w-4 opacity-50" />
              <input v-model="buscador.query.value" type="search" placeholder="Nombre o CI..." class="grow" @input="buscador.onInput" />
              <span v-if="buscador.buscando.value" class="loading loading-spinner loading-xs"></span>
            </label>
            <ul v-if="buscador.resultados.value.length"
              class="absolute z-10 mt-1 w-full bg-base-100 rounded-box shadow-lg border border-base-300 max-h-56 overflow-y-auto">
              <li v-for="e in buscador.resultados.value" :key="e.id">
                <button class="w-full text-left px-4 py-2 hover:bg-base-200 flex justify-between items-center" @click="buscador.seleccionar(e)">
                  <span>{{ e.apellido }}, {{ e.nombre }}</span>
                  <span class="font-mono text-xs text-base-content/50">{{ e.ci }}</span>
                </button>
              </li>
            </ul>
          </div>
        </fieldset>
      </div>
    </div>

    <HistorialAcademico v-if="buscador.seleccionado.value" :estudiante-id="buscador.seleccionado.value.id" />
    <p v-else class="text-center text-base-content/40 text-sm py-6">Busca y elige un estudiante para ver su historial</p>
  </div>
</template>