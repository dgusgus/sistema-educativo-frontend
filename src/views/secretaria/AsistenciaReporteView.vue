<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { asistenciaApi, type ReporteCursoItem } from '@/api/asistencia.api'
import { useGestionStore } from '@/stores/gestion.store'
import AsistenciaReporteCursoCards from '@/components/asistencia/Asistenciareportecursocards.vue'
import AsistenciaReporteCursoTabla from '@/components/asistencia/Asistenciareportecursotabla.vue'

const gestion = useGestionStore()
onMounted(() => gestion.cargar())

const cursoId = ref<number | ''>('')
const cargando = ref(false)
const error = ref<string | null>(null)

const respuesta = ref<{
  cursoId: number
  gestionId: number
  totalEstudiantes: number
  estudiantesEnRiesgo: number
  reporte: ReporteCursoItem[]
} | null>(null)

async function verReporte() {
  if (!cursoId.value) { error.value = 'Elegí un curso'; return }
  if (!gestion.gestionId) { error.value = 'No hay una gestión activa'; return }

  cargando.value = true
  error.value = null
  respuesta.value = null
  try {
    respuesta.value = await asistenciaApi.getReporteCurso(Number(cursoId.value), gestion.gestionId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar el reporte'
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h2 class="text-2xl font-bold">Reporte de Asistencia</h2>
      <p class="text-sm text-base-content/60">Porcentaje de asistencia por estudiante y materia, curso completo</p>
    </div>

    <section class="card bg-base-100 shadow">
      <div class="card-body space-y-4">
        <div v-if="error" role="alert" class="alert alert-error py-2 text-sm"><span>{{ error }}</span></div>

        <div class="flex flex-col sm:flex-row gap-3 sm:items-end">
          <fieldset class="fieldset flex-1">
            <legend class="fieldset-legend text-xs">Curso</legend>
            <select v-model="cursoId" class="select select-bordered w-full">
              <option value="" disabled>Seleccionar curso</option>
              <option v-for="c in gestion.cursos" :key="c.id" :value="c.id">{{ c.nombre }}</option>
            </select>
          </fieldset>
          <button class="btn btn-primary w-full sm:w-auto" :disabled="cargando || !cursoId" @click="verReporte">
            <span v-if="cargando" class="loading loading-spinner loading-sm"></span>
            Ver reporte
          </button>
        </div>

        <div v-if="respuesta" class="space-y-3">
          <!-- Resumen rápido -->
          <div class="stats stats-horizontal shadow w-full">
            <div class="stat py-2 px-4">
              <div class="stat-title text-xs">Total estudiantes</div>
              <div class="stat-value text-xl">{{ respuesta.totalEstudiantes }}</div>
            </div>
            <div class="stat py-2 px-4">
              <div class="stat-title text-xs">En riesgo (&lt; 80%)</div>
              <div class="stat-value text-xl" :class="respuesta.estudiantesEnRiesgo > 0 ? 'text-error' : ''">
                {{ respuesta.estudiantesEnRiesgo }}
              </div>
            </div>
          </div>

          <!-- Cards: celular y escritorio -->
          <AsistenciaReporteCursoCards :reporte="respuesta.reporte" />

          <!-- Tabla ancha original, solo desktop y colapsada -->
          <details class="hidden md:block rounded-box border border-base-300">
            <summary class="cursor-pointer px-4 py-2 text-sm font-medium text-base-content/70 hover:text-base-content">
              Vista tabla completa (comparar todo el curso)
            </summary>
            <div class="p-2">
              <AsistenciaReporteCursoTabla :reporte="respuesta.reporte" />
            </div>
          </details>
        </div>
      </div>
    </section>
  </div>
</template>