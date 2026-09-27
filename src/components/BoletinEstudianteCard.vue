<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { boletinApi, type DetalleBoletinEstudiante, type DetalleMateria } from '@/api/boletin.api'
import StatusBadge from './StatusBadge.vue'

const props = defineProps<{
  inscripcionId: number
}>()

const emit = defineEmits<{ close: [] }>()

const detalle = ref<DetalleBoletinEstudiante | null>(null)
const cargando = ref(false)
const error = ref<string | null>(null)

async function cargar() {
  cargando.value = true
  error.value = null
  detalle.value = null
  try {
    detalle.value = await boletinApi.getDetalle(props.inscripcionId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar el detalle'
  } finally {
    cargando.value = false
  }
}

watch(() => props.inscripcionId, cargar, { immediate: true })

// Un color por Campo de Saber — agrupa visualmente igual que la Libreta
// impresa, sin tocar el rojo/verde de aprobado/reprobado.
const COLOR_CAMPO: Record<string, string> = {
  'Comunidad y Sociedad':                  '#2E6DA4',
  'Ciencia, Tecnología y Producción':      '#7C5CBF',
  'Vida, Tierra y Territorio':             '#3F8F5F',
  'Cosmos y Pensamiento':                  '#B5793A',
}
function colorCampo(nombre: string | null): string {
  return (nombre && COLOR_CAMPO[nombre]) || '#6B7280'
}

const materiasPorCampo = computed(() => {
  if (!detalle.value) return []
  const grupos = new Map<string, { campo: string; color: string; materias: DetalleMateria[] }>()
  for (const m of detalle.value.materias) {
    const campo = m.campoSaber ?? 'Sin campo asignado'
    if (!grupos.has(campo)) grupos.set(campo, { campo, color: colorCampo(m.campoSaber), materias: [] })
    grupos.get(campo)!.materias.push(m)
  }
  return Array.from(grupos.values())
})

function claseNota(nota: number | null): string {
  if (nota === null) return 'text-base-content/30'
  if (nota >= 71) return 'text-success'
  if (nota >= 51) return 'text-warning'
  return 'text-error'
}

const iniciales = computed(() => {
  if (!detalle.value) return ''
  return detalle.value.nombreCompleto.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()
})

const nombreCurso = computed(() => {
  if (!detalle.value) return ''
  const c = detalle.value.curso
  return `${c.grado}° ${c.nivel === 'PRIMARIA' ? 'Primaria' : 'Secundaria'} "${c.paralelo}"`
})

const promedioGeneralAnual = computed(() => {
  if (!detalle.value) return null
  const valores = detalle.value.materias.map(m => m.promedioAnual).filter((v): v is number => v !== null)
  if (!valores.length) return null
  return Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 10) / 10
})
</script>

<template>
  <div class="modal modal-open" @click.self="emit('close')" @keydown.esc="emit('close')">
    <div class="modal-box max-w-4xl p-0 overflow-hidden">

      <!-- Encabezado institucional -->
      <div class="px-6 py-5 text-white" style="background: linear-gradient(135deg, #1A3C5E 0%, #2E6DA4 100%)">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center text-xl font-semibold shrink-0">
            {{ iniciales }}
          </div>
          <div class="min-w-0">
            <h3 class="text-lg font-semibold leading-tight truncate">{{ detalle?.nombreCompleto ?? '...' }}</h3>
            <p class="text-white/70 text-sm" v-if="detalle">{{ nombreCurso }} · Gestión {{ detalle.curso.anioGestion }}</p>
          </div>
          <div class="ml-auto text-right shrink-0">
            <p class="text-3xl font-bold leading-none">{{ promedioGeneralAnual?.toFixed(1) ?? '—' }}</p>
            <p class="text-white/60 text-xs mt-1">promedio anual</p>
          </div>
        </div>
      </div>

      <!-- Cuerpo -->
      <div class="max-h-[65vh] overflow-y-auto px-6 py-4">
        <div v-if="cargando" class="flex justify-center py-12">
          <span class="loading loading-spinner loading-md"></span>
        </div>

        <div v-else-if="error" role="alert" class="alert alert-error text-sm">
          <span>{{ error }}</span>
        </div>

        <div v-else-if="detalle">
          <div v-for="grupo in materiasPorCampo" :key="grupo.campo" class="mb-6 last:mb-0">
            <div class="flex items-center gap-2 mb-3">
              <span class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: grupo.color }"></span>
              <span class="text-xs font-medium" :style="{ color: grupo.color }">{{ grupo.campo }}</span>
            </div>

            <div v-for="materia in grupo.materias" :key="materia.docenteMateriaCursoId" class="mb-5 last:mb-0">
              <div class="flex items-baseline justify-between mb-2">
                <span class="text-sm font-semibold">{{ materia.nombre }}</span>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold" :class="claseNota(materia.promedioAnual)">
                    {{ materia.promedioAnual ?? '—' }}
                  </span>
                  <StatusBadge v-if="materia.promedioAnual !== null" :estado="materia.resultado" tamano="xs" />
                </div>
              </div>

              <!-- Paneles por trimestre: dimensión → actividades → total -->
              <div class="flex gap-3 overflow-x-auto pb-1">
                <div
                  v-for="trimestre in materia.trimestres"
                  :key="trimestre.trimestreId"
                  class="rounded-lg border border-base-200 p-2.5 min-w-[12rem] shrink-0"
                >
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-semibold text-base-content/50">T{{ trimestre.numero }}</span>
                    <span class="text-sm font-bold" :class="claseNota(trimestre.total)">{{ trimestre.total ?? '—' }}</span>
                  </div>

                  <div v-for="dim in trimestre.dimensiones" :key="dim.dimensionId" class="mb-1.5 last:mb-0">
                    <div class="flex items-center justify-between text-xs">
                      <span class="text-base-content/70">{{ dim.nombre }}</span>
                      <span class="font-medium" :class="claseNota(dim.promedio)">{{ dim.promedio ?? '—' }}</span>
                    </div>
                    <p class="text-[11px] text-base-content/40 pl-1 truncate">
                      <span v-if="!dim.actividades.length">sin actividades</span>
                      <template v-else>
                        <span v-for="(act, i) in dim.actividades" :key="act.actividadEvaluativaId">
                          {{ act.nota ?? '—' }}<span v-if="i < dim.actividades.length - 1">, </span>
                        </span>
                      </template>
                    </p>
                  </div>

                  <p v-if="!trimestre.dimensiones.length" class="text-xs text-base-content/30">Sin dimensiones configuradas</p>
                </div>
              </div>
            </div>
          </div>

          <p v-if="!detalle.materias.length" class="text-center text-sm text-base-content/40 py-8">
            Este curso todavía no tiene materias asignadas
          </p>
        </div>
      </div>

      <!-- Pie -->
      <div class="px-6 py-4 border-t border-base-200 flex items-center justify-end bg-base-100">
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" @click="emit('close')">Cerrar</button>
          <slot name="acciones" />
        </div>
      </div>

    </div>
  </div>
</template>