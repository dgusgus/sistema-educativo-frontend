<script setup lang="ts">
import { ref, watch } from 'vue'
import { asistenciaApi } from '@/api/asistencia.api'

// Muestra el % de asistencia por materia de UNA inscripción.
// Lo usan MiPerfilView (estudiante ve lo propio) y SeguimientoView
// (tutor ve lo de cada vinculado) — GET /asistencia/resumen/:inscripcionId
// ya valida pertenencia en el backend (403 si no corresponde).
//
// El backend devuelve dos formas según haya resumen materializado o no:
//  - ResumenAsistencia: { docenteMateriaCurso: { materia: { nombre } }, trimestre, totalClases, totalPresente, ... }
//  - Calculado al vuelo: { docenteMateriaCursoId, materia: string, total, presente, ausente, retraso, justificado }
// Se normaliza a una sola fila para la tabla.

const props = defineProps<{
  inscripcionId: number | null
}>()

interface FilaResumen {
  materia:      string
  trimestre?:  string
  porcentaje:   number
  presente:     number
  ausente:      number
  retraso:      number
  justificado:  number
}

const filas    = ref<FilaResumen[]>([])
const cargando = ref(false)
const error    = ref<string | null>(null)

function normalizar(r: Record<string, unknown>): FilaResumen {
  const dmc = r['docenteMateriaCurso'] as { materia?: { nombre?: string } } | undefined
  const trim = r['trimestre'] as { nombre?: string } | undefined
  const num = (v: unknown) => typeof v === 'number' ? v : 0
  return {
    materia:     dmc?.materia?.nombre ?? String(r['materia'] ?? '—'),
    trimestre:   trim?.nombre,
    porcentaje:  num(r['porcentaje']),
    presente:    num(r['totalPresente'] ?? r['presente']),
    ausente:     num(r['totalAusente'] ?? r['ausente']),
    retraso:     num(r['totalRetraso'] ?? r['retraso']),
    justificado: num(r['totalJustificado'] ?? r['justificado']),
  }
}

async function cargar() {
  filas.value = []
  error.value = null
  if (!props.inscripcionId) return
  cargando.value = true
  try {
    const data = await asistenciaApi.getResumen(props.inscripcionId) as unknown as Array<Record<string, unknown>>
    filas.value = (Array.isArray(data) ? data : []).map(normalizar)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar asistencia'
  } finally {
    cargando.value = false
  }
}

watch(() => props.inscripcionId, cargar, { immediate: true })

function clasePorcentaje(p: number): string {
  if (p >= 90) return 'text-success font-bold'
  if (p >= 80) return 'text-warning font-bold'
  return 'text-error font-bold'
}
</script>

<template>
  <div class="mt-4">
    <h4 class="font-semibold text-sm mb-2">Asistencia</h4>

    <div v-if="cargando" class="skeleton h-16 rounded-xl"></div>

    <div v-else-if="error" role="alert" class="alert alert-error py-2 text-sm">
      <span>{{ error }}</span>
    </div>

    <div v-else-if="filas.length" class="overflow-x-auto">
      <table class="table table-xs">
        <thead>
          <tr>
            <th>Materia</th>
            <th v-if="filas.some(f => f.trimestre)">Trimestre</th>
            <th class="text-center">%</th>
            <th class="text-center">P</th>
            <th class="text-center">A</th>
            <th class="text-center">R</th>
            <th class="text-center">J</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(f, i) in filas" :key="i" class="hover">
            <td class="font-medium">{{ f.materia }}</td>
            <td v-if="filas.some(x => x.trimestre)" class="text-sm text-base-content/60">{{ f.trimestre ?? '—' }}</td>
            <td class="text-center"><span :class="clasePorcentaje(f.porcentaje)">{{ f.porcentaje.toFixed(0) }}%</span></td>
            <td class="text-center">{{ f.presente }}</td>
            <td class="text-center">{{ f.ausente }}</td>
            <td class="text-center">{{ f.retraso }}</td>
            <td class="text-center">{{ f.justificado }}</td>
            <td>
              <span v-if="f.porcentaje < 80" class="badge badge-xs badge-error" title="Asistencia menor al 80%">En riesgo</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="text-xs text-base-content/40 mt-1">P: presente · A: ausente · R: retraso · J: justificado</p>
    </div>

    <p v-else class="text-sm text-base-content/40">Sin registros de asistencia aún</p>
  </div>
</template>
