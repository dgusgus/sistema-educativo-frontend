<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { reporteApi } from '@/api/reporte.api'
import type { DashboardResponse } from '@/types'

const datos    = ref<DashboardResponse | null>(null)
const cargando = ref(true)
const error    = ref<string | null>(null)

onMounted(async () => {
  try {
    datos.value = await reporteApi.getDashboard()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar el dashboard'
  } finally {
    cargando.value = false
  }
})
</script>

<template>
  <div class="space-y-6">

    <!-- Encabezado con gestión activa -->
    <div class="flex items-baseline gap-3">
      <h2 class="text-2xl font-bold">Dashboard Institucional</h2>
      <span v-if="datos" class="badge badge-neutral">
        Gestión {{ datos.gestion.anio }}
      </span>
    </div>

    <!-- Error -->
    <div v-if="error" role="alert" class="alert alert-error">
      <span>{{ error }}</span>
    </div>

    <!-- Skeleton mientras carga -->
    <div v-if="cargando" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <div v-for="i in 6" :key="i" class="skeleton h-28 rounded-xl"></div>
    </div>

    <!-- Tarjetas de indicadores -->
    <template v-else-if="datos">
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <p class="text-sm text-base-content/60">Total Estudiantes</p>
            <p class="text-4xl font-bold text-primary">{{ datos.indicadores.totalEstudiantes }}</p>
          </div>
        </div>

        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <p class="text-sm text-base-content/60">Total Docentes</p>
            <p class="text-4xl font-bold text-secondary">{{ datos.indicadores.totalDocentes }}</p>
          </div>
        </div>

        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <p class="text-sm text-base-content/60">Cursos Activos</p>
            <p class="text-4xl font-bold text-accent">{{ datos.indicadores.totalCursos }}</p>
          </div>
        </div>

        <div class="card bg-base-100 shadow border border-warning/30">
          <div class="card-body">
            <p class="text-sm text-base-content/60">Estudiantes en Riesgo</p>
            <p class="text-4xl font-bold text-warning">{{ datos.indicadores.estudiantesEnRiesgo }}</p>
            <p class="text-xs text-base-content/40">asistencia o rendimiento bajo</p>
          </div>
        </div>

        <div class="card bg-base-100 shadow sm:col-span-2">
          <div class="card-body">
            <p class="text-sm text-base-content/60">Promedio General</p>
            <p class="text-4xl font-bold text-info">{{ datos.indicadores.promedioGeneral.toFixed(1) }}</p>
            <p class="text-xs text-base-content/40">escala 1–100 (Ley 070)</p>
          </div>
        </div>

        <div class="card bg-base-100 shadow sm:col-span-2">
          <div class="card-body">
            <p class="text-sm text-base-content/60">Monto Recaudado</p>
            <p class="text-4xl font-bold text-success">
              Bs. {{ datos.indicadores.totalRecaudado.toLocaleString('es-BO') }}
            </p>
            <p class="text-xs text-base-content/40">
              {{ datos.indicadores.pagosPendientes }} pago(s) pendiente(s)
            </p>
          </div>
        </div>

      </div>

      <!-- Estado de trimestres -->
      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <h3 class="font-semibold mb-3">Trimestres</h3>
          <div class="flex flex-wrap gap-3">
            <div
              v-for="t in datos.trimestres"
              :key="t.numero"
              class="flex items-center gap-2 px-3 py-2 rounded-lg border"
              :class="t.cerrado ? 'border-base-300 bg-base-200' : 'border-primary/30 bg-primary/5'"
            >
              <span class="font-medium text-sm">{{ t.nombre }}</span>
              <span class="badge badge-sm" :class="t.cerrado ? 'badge-ghost' : 'badge-primary'">
                {{ t.cerrado ? 'Cerrado' : 'Activo' }}
              </span>
            </div>
          </div>
        </div>
      </div>

    </template>

  </div>
</template>