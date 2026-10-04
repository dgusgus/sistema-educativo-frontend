<script setup lang="ts">
import { ref, computed } from 'vue'
import { fechaSoloDia, formatoFecha } from '@/lib/fechas'

// Un registro crudo de GET /asistencia/historial: un día, una materia,
// un estado. El padre ya lo filtró a la gestión activa.
export interface RegistroAsistencia {
  id: number
  fecha: string
  estado: 'PRESENTE' | 'AUSENTE' | 'RETRASO' | 'JUSTIFICADO'
  justificacion?: string | null
  docenteMateriaCursoId: number
  trimestreId: number
  docenteMateriaCurso: { materia: { id: number; nombre: string } }
  trimestre: { id: number; numero: number; nombre: string }
}

const props = defineProps<{
  registros: RegistroAsistencia[]
  trimestres: { id: number; numero: number; nombre: string }[]
}>()

// ── Filtros: materia + trimestre ─────────────────────────────────────────────
const materiaId = ref<number | ''>('')
const trimId = ref<number | ''>('')

const materias = computed(() => {
  const map = new Map<number, string>()
  for (const r of props.registros) map.set(r.docenteMateriaCursoId, r.docenteMateriaCurso.materia.nombre)
  return Array.from(map.entries())
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
})

const trimestresConDatos = computed(() =>
  props.trimestres.filter(t => props.registros.some(r => r.trimestreId === t.id))
)

// Trimestre por defecto: el primero con datos
const trimSel = computed<number | ''>({
  get: () => trimId.value !== '' ? trimId.value : (trimestresConDatos.value[0]?.id ?? ''),
  set: (v) => { trimId.value = v },
})

const filtrados = computed(() => {
  const tid = trimSel.value
  return props.registros
    .filter(r => (tid === '' || r.trimestreId === tid) && (materiaId.value === '' || r.docenteMateriaCursoId === materiaId.value))
    .slice()
    .sort((a, b) => fechaSoloDia(a.fecha).getTime() - fechaSoloDia(b.fecha).getTime())
})

const resumen = computed(() => {
  const r = { PRESENTE: 0, AUSENTE: 0, RETRASO: 0, JUSTIFICADO: 0 }
  for (const f of filtrados.value) r[f.estado]++
  return r
})

const faltas = computed(() =>
  filtrados.value.filter(f => f.estado === 'AUSENTE' || f.estado === 'RETRASO')
)

const porc = computed(() => {
  const total = filtrados.value.length
  if (!total) return null
  return Math.round((resumen.value.PRESENTE / total) * 100)
})

function claseEstado(estado: RegistroAsistencia['estado']): string {
  if (estado === 'PRESENTE') return 'bg-success/15 text-success border-success/30'
  if (estado === 'AUSENTE') return 'bg-error/15 text-error border-error/30'
  if (estado === 'RETRASO') return 'bg-warning/15 text-warning border-warning/30'
  return 'bg-info/15 text-info border-info/30'
}

function letraEstado(estado: RegistroAsistencia['estado']): string {
  return estado === 'PRESENTE' ? 'P' : estado === 'AUSENTE' ? 'F' : estado === 'RETRASO' ? 'R' : 'J'
}

function diaMes(fecha: string): string {
  const d = fechaSoloDia(fecha)
  return `${d.getDate()} ${d.toLocaleDateString('es-BO', { month: 'short' })}`
}

function fechaLarga(fecha: string): string {
  return formatoFecha(fecha, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="space-y-3">
    <!-- Filtros -->
    <div class="flex flex-col sm:flex-row gap-2">
      <select v-model="materiaId" class="select select-bordered select-sm w-full sm:max-w-64">
        <option :value="''">Todas las materias</option>
        <option v-for="m in materias" :key="m.id" :value="m.id">{{ m.nombre }}</option>
      </select>
      <div role="tablist" class="tabs tabs-boxed w-fit">
        <a v-for="t in trimestresConDatos" :key="t.id" role="tab" class="tab tab-sm whitespace-nowrap"
          :class="trimSel === t.id ? 'tab-active' : ''" @click="trimSel = t.id">
          T{{ t.numero }}
        </a>
      </div>
    </div>

    <!-- Resumen -->
    <div class="stats stats-horizontal w-full shadow">
      <div class="stat py-2 px-3">
        <div class="stat-title text-xs">Asistencia</div>
        <div class="stat-value text-2xl" :class="porc !== null && porc < 80 ? 'text-error' : 'text-success'">
          {{ porc !== null ? `${porc}%` : '—' }}
        </div>
      </div>
      <div class="stat py-2 px-3">
        <div class="stat-title text-xs">P / F / R / J</div>
        <div class="stat-value text-lg font-mono">
          <span class="text-success">{{ resumen.PRESENTE }}</span> /
          <span class="text-error">{{ resumen.AUSENTE }}</span> /
          <span class="text-warning">{{ resumen.RETRASO }}</span> /
          <span class="text-info">{{ resumen.JUSTIFICADO }}</span>
        </div>
      </div>
    </div>

    <!-- Calendario de días -->
    <div v-if="filtrados.length" class="flex flex-wrap gap-1.5">
      <span v-for="f in filtrados" :key="f.id"
        class="badge badge-md font-mono border"
        :class="claseEstado(f.estado)"
        :title="`${fechaLarga(f.fecha)} — ${f.docenteMateriaCurso.materia.nombre}: ${f.estado}${f.justificacion ? ` (${f.justificacion})` : ''}`">
        {{ letraEstado(f.estado) }} · {{ diaMes(f.fecha) }}
      </span>
    </div>
    <p v-else class="text-xs text-base-content/40 text-center py-4">
      Sin registros para este filtro
    </p>

    <!-- Solo faltas y retrasos -->
    <div v-if="faltas.length" class="rounded-box border border-base-300">
      <p class="px-3 py-2 text-xs font-semibold text-base-content/60">
        Faltas y retrasos ({{ faltas.length }})
      </p>
      <ul class="divide-y divide-base-200 max-h-56 overflow-y-auto">
        <li v-for="f in faltas" :key="`f-${f.id}`" class="px-3 py-1.5 text-xs flex items-center gap-2">
          <span class="badge badge-xs" :class="f.estado === 'AUSENTE' ? 'badge-error' : 'badge-warning'">
            {{ f.estado === 'AUSENTE' ? 'Falta' : 'Retraso' }}
          </span>
          <span class="flex-1">{{ fechaLarga(f.fecha) }} — {{ f.docenteMateriaCurso.materia.nombre }}</span>
          <span v-if="f.justificacion" class="text-base-content/50 truncate max-w-32" :title="f.justificacion">
            {{ f.justificacion }}
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>