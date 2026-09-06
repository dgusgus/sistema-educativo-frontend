<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGestionStore } from '@/stores/gestion.store'
import { reporteApi, type ReporteAcademicoResponse } from '@/api/reporte.api'
import { nombreCurso } from '@/api/estructura.api'
import { descargarBlob } from '@/api/boletin.api'
import type { Nivel, Turno } from '@/types'

const gestion    = useGestionStore()
const cursoId    = ref<number | ''>('')
const reporte    = ref<ReporteAcademicoResponse | null>(null)
const cargando   = ref(false)
const descargando = ref(false)
const error      = ref<string | null>(null)

onMounted(() => gestion.cargar())

async function cargarReporte() {
  if (!gestion.gestionId) { error.value = 'No hay gestión activa'; return }
  cargando.value = true
  error.value = null
  reporte.value = null
  try {
    reporte.value = await reporteApi.getReporteAcademico({
      gestionId: gestion.gestionId,
      cursoId:   cursoId.value ? Number(cursoId.value) : undefined,
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar reporte'
  } finally {
    cargando.value = false
  }
}

async function descargarPdf() {
  if (!gestion.gestionId) return
  descargando.value = true
  error.value = null
  try {
    const blob = await reporteApi.getReporteAcademicoPdf({
      gestionId: gestion.gestionId,
      cursoId:   cursoId.value ? Number(cursoId.value) : undefined,
    })
    descargarBlob(blob, `reporte_academico_${gestion.anio}.pdf`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al generar PDF'
  } finally {
    descargando.value = false
  }
}

function claseNota(nota: number): string {
  if (nota >= 71) return 'text-success font-bold'
  if (nota >= 51) return 'text-warning font-bold'
  return 'text-error font-bold'
}

// ✅ el curso dentro del detalle no trae "nombre" calculado — se arma acá
function nombreCursoCorto(c: { nivel: Nivel; grado: number; paralelo: string; turno: Turno }): string {
  return nombreCurso(c)
}

function promedioFinalGeneral(promediosFinales: Array<{ promedioFinal: number }>): number {
  return promediosFinales.reduce((s, p) => s + p.promedioFinal, 0) / promediosFinales.length
}
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-2xl font-bold">Reportes Académicos</h2>

    <!-- Filtros -->
    <div class="card bg-base-100 shadow">
      <div class="card-body flex flex-col sm:flex-row gap-3 items-end">
        <div class="flex-1">
          <p class="text-xs text-base-content/50 mb-1">Gestión</p>
          <p class="font-semibold">{{ gestion.anio ?? '—' }}</p>
        </div>
        <fieldset class="fieldset flex-1">
          <legend class="fieldset-legend text-xs">Curso (opcional)</legend>
          <select v-model="cursoId" class="select select-bordered w-full">
            <option :value="''">Todos los cursos</option>
            <option v-for="c in gestion.cursos" :key="c.id" :value="c.id">{{ c.nombre }}</option>
          </select>
        </fieldset>
        <button class="btn btn-primary" :disabled="cargando" @click="cargarReporte">
          <span v-if="cargando" class="loading loading-spinner loading-sm"></span>
          Generar reporte
        </button>
        <button class="btn btn-outline" :disabled="descargando" @click="descargarPdf">
          <span v-if="descargando" class="loading loading-spinner loading-sm"></span>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          PDF
        </button>
      </div>
    </div>

    <div v-if="error" role="alert" class="alert alert-error"><span>{{ error }}</span></div>

    <template v-if="reporte">
      <!-- Estadísticas globales -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="card bg-base-100 shadow">
          <div class="card-body py-4">
            <p class="text-xs text-base-content/50">Estudiantes</p>
            <p class="text-3xl font-bold text-primary">{{ reporte.estadisticas.totalEstudiantes }}</p>
          </div>
        </div>
        <div class="card bg-base-100 shadow">
          <div class="card-body py-4">
            <p class="text-xs text-base-content/50">Promedio general</p>
            <p class="text-3xl font-bold" :class="claseNota(reporte.estadisticas.promedioGeneral)">
              {{ reporte.estadisticas.promedioGeneral }}
            </p>
          </div>
        </div>
        <div class="card bg-base-100 shadow">
          <div class="card-body py-4">
            <p class="text-xs text-base-content/50">Aprobados</p>
            <p class="text-3xl font-bold text-success">{{ reporte.estadisticas.aprobados }}</p>
          </div>
        </div>
        <div class="card bg-base-100 shadow">
          <div class="card-body py-4">
            <p class="text-xs text-base-content/50">Tasa aprobación</p>
            <p class="text-3xl font-bold text-info">{{ reporte.estadisticas.tasaAprobacion }}%</p>
          </div>
        </div>
      </div>

      <!-- Detalle por estudiante -->
      <div class="card bg-base-100 shadow overflow-x-auto">
        <div class="card-body pb-0">
          <h3 class="font-semibold mb-3">Detalle por estudiante ({{ reporte.detalle.length }})</h3>
        </div>
        <table class="table table-sm">
          <thead>
            <tr><th>Estudiante</th><th>Curso</th><th>Materias</th><th>Promedio final</th><th>Resultado</th></tr>
          </thead>
          <tbody>
            <tr v-for="insc in reporte.detalle" :key="insc.id" class="hover">
              <td class="font-medium">{{ insc.estudiante.apellido }}, {{ insc.estudiante.nombre }}</td>
              <td class="text-sm text-base-content/60">{{ nombreCursoCorto(insc.curso) }}</td>
              <td>
                <div class="flex flex-wrap gap-1">
                  <span v-for="(pf, idx) in insc.promediosFinales" :key="idx"
                    class="badge badge-xs" :class="pf.resultado === 'PROMOVIDO' ? 'badge-success' : 'badge-error'"
                    :title="pf.docenteMateriaCurso.materia.nombre">
                    {{ pf.docenteMateriaCurso.materia.nombre.substring(0,3) }}:{{ pf.promedioFinal.toFixed(0) }}
                  </span>
                  <span v-if="!insc.promediosFinales.length" class="text-xs text-base-content/40">Sin datos</span>
                </div>
              </td>
              <td>
                <span v-if="insc.promediosFinales.length" :class="claseNota(promedioFinalGeneral(insc.promediosFinales))">
                  {{ promedioFinalGeneral(insc.promediosFinales).toFixed(1) }}
                </span>
                <span v-else class="text-base-content/40">—</span>
              </td>
              <td>
                <span class="badge badge-sm"
                  :class="insc.resultado === 'PROMOVIDO' ? 'badge-success' : insc.resultado === 'REPROBADO' ? 'badge-error' : 'badge-ghost'">
                  {{ insc.resultado }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div v-else-if="!cargando" class="text-center text-base-content/40 py-12">
      Seleccioná los filtros y presioná "Generar reporte"
    </div>
  </div>
</template>