<script setup lang="ts">
/**
 * PASO 1 · Resultado final del año de cada estudiante de UN curso.
 * El backend lo CALCULA con las notas (reprueba quien tenga alguna materia bajo la nota
 * mínima); aquí solo se revisa y se confirma. Se hace con la gestión de origen todavía
 * ACTIVA: el Director no puede cerrarla mientras falten resultados.
 */
import { ref, computed, onMounted } from 'vue'
import { gestionApi, type CursoPromocion, type PropuestaResultados, type ResultadoLote } from '@/api/gestion.api'
import { useConfirm } from '@/composables/useConfirm'
import { useAccion } from '@/composables/useAccion'
import StatusBadge from '@/components/StatusBadge.vue'

const props = defineProps<{ origenId: number; curso: CursoPromocion }>()
const emit = defineEmits<{ (e: 'registrado'): void }>()

const { confirmar } = useConfirm()

const calculo = ref<PropuestaResultados | null>(null)
const calculando = ref(false)
const errorCalculo = ref<string | null>(null)
const errorLocal = ref<string | null>(null)
const seleccionRes = ref<Record<number, boolean>>({})
const reporteRes = ref<ResultadoLote | null>(null)
const soloPorRegistrar = ref(true)

const listos = computed(() => (calculo.value?.resultados ?? []).filter(r => r.estado === 'LISTO'))
const incompletos = computed(() => (calculo.value?.resultados ?? []).filter(r => r.estado === 'INCOMPLETO'))
const filasVisibles = computed(() =>
  soloPorRegistrar.value ? listos.value.filter(r => r.resultadoActual !== r.sugerido) : listos.value
)
const totalSeleccionadosRes = computed(() => listos.value.filter(r => seleccionRes.value[r.inscripcionId]).length)
const resultadosCompletos = computed(() =>
  !!calculo.value && calculo.value.resumen.total > 0
  && calculo.value.resumen.porRegistrar === 0 && calculo.value.resumen.incompletos === 0
)

async function calcularResultados() {
  calculando.value = true
  errorCalculo.value = null
  try {
    const c = await gestionApi.getPropuestaResultados(props.origenId, props.curso.cursoId)
    calculo.value = c
    seleccionRes.value = {}
    // Por defecto se marcan los que todavía no tienen el resultado que les corresponde.
    c.resultados.forEach(r => {
      seleccionRes.value[r.inscripcionId] = r.estado === 'LISTO' && r.resultadoActual !== r.sugerido
    })
  } catch (e) {
    calculo.value = null
    errorCalculo.value = e instanceof Error ? e.message : 'Error al calcular los resultados'
  } finally {
    calculando.value = false
  }
}

function marcarResultados(valor: boolean) {
  filasVisibles.value.forEach(r => { seleccionRes.value[r.inscripcionId] = valor })
}

const registrar = useAccion(
  (ids: number[]) => gestionApi.registrarResultados(props.origenId, ids, props.curso.cursoId),
  { errorPorDefecto: 'Error al registrar los resultados' },
)
const errorMostrado = computed(() => errorLocal.value ?? registrar.error.value ?? errorCalculo.value)

async function registrarResultados() {
  errorLocal.value = null
  const elegidos = listos.value.filter(r => seleccionRes.value[r.inscripcionId])
  if (!elegidos.length) { errorLocal.value = 'No hay estudiantes seleccionados'; return }
  const aReprobar = elegidos.filter(r => r.sugerido === 'REPROBADO').length
  const aPromover = elegidos.length - aReprobar

  const ok = await confirmar({
    titulo: 'Registrar resultados del año',
    mensaje: `${props.curso.curso}: se registrarán ${elegidos.length} resultado(s) — ${aPromover} PROMOVIDO y ${aReprobar} REPROBADO — calculados con los promedios finales. Quedan en el historial académico.`,
    peligroso: aReprobar > 0,
  })
  if (!ok) return

  const r = await registrar.ejecutar(elegidos.map(e => e.inscripcionId))
  if (!r) return
  reporteRes.value = r
  await calcularResultados()
  emit('registrado')
}

onMounted(calcularResultados)
</script>

<template>
<div class="card bg-base-100 shadow">
  <div class="card-body py-3 space-y-2">
    <h4 class="font-semibold">Paso 1 · Resultados finales del año</h4>
    <p class="text-xs text-base-content/60">
      Calculado con los promedios finales: reprueba quien tenga alguna materia bajo la nota mínima. No se elige a mano.
      Requiere los trimestres cerrados.
    </p>

    <div v-if="calculando" class="flex justify-center py-4"><span class="loading loading-spinner"></span></div>
    <div v-if="errorMostrado" role="alert" class="alert alert-error py-2 text-sm"><span>{{ errorMostrado }}</span></div>

    <template v-if="calculo">
      <p class="text-xs text-base-content/50">Nota mínima de aprobación: {{ calculo.gestion.notaMinima }}</p>

      <div v-if="resultadosCompletos" role="alert" class="alert alert-success py-2 text-sm">
        <span>Todos los estudiantes de este curso ya tienen su resultado.</span>
      </div>

      <div v-if="incompletos.length" class="rounded-box border border-warning/40 p-3">
        <p class="text-sm font-semibold text-warning mb-1">Sin promedios completos ({{ incompletos.length }})</p>
        <p class="text-xs text-base-content/60 mb-2">Se generan al cerrar el último trimestre. Completar las notas pendientes y volver a abrir el curso.</p>
        <ul class="text-xs space-y-0.5">
          <li v-for="r in incompletos" :key="r.inscripcionId">{{ r.estudiante }} — <span class="text-warning">{{ r.detalle }}</span></li>
        </ul>
      </div>

      <div v-if="listos.length">
        <div class="flex flex-wrap items-center gap-3 mb-2">
          <label class="label cursor-pointer gap-2">
            <input v-model="soloPorRegistrar" type="checkbox" class="checkbox checkbox-sm" />
            <span class="text-xs">Solo los que faltan registrar</span>
          </label>
          <button class="btn btn-ghost btn-sm min-h-11" @click="marcarResultados(true)">Marcar todos</button>
          <button class="btn btn-ghost btn-sm min-h-11" @click="marcarResultados(false)">Desmarcar todos</button>
        </div>
        <div class="overflow-x-auto max-h-96 overflow-y-auto">
          <table class="table table-xs">
            <thead>
              <tr>
                <th class="w-12"></th>
                <th>Estudiante</th>
                <th class="text-right">Promedio</th>
                <th>Materias reprobadas</th>
                <th>Resultado</th>
                <th>Actual</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in filasVisibles" :key="r.inscripcionId" class="hover">
                <td class="text-center"><input v-model="seleccionRes[r.inscripcionId]" type="checkbox" class="checkbox checkbox-md" :aria-label="`Seleccionar a ${r.estudiante}`" /></td>
                <td>
                  {{ r.estudiante }}
                  <details class="mt-0.5">
                    <summary class="cursor-pointer text-xs text-primary">Ver materias</summary>
                    <ul class="mt-1 space-y-0.5 text-xs">
                      <li
                        v-for="(m, i) in r.materias" :key="i"
                        :class="m.promedio !== null && m.promedio < calculo.gestion.notaMinima ? 'font-semibold text-error' : ''"
                      >{{ m.materia }}: {{ m.promedio ?? 'incompleta' }}</li>
                    </ul>
                  </details>
                </td>
                <td class="text-right font-mono">{{ r.promedioGeneral ?? '—' }}</td>
                <td>
                  <span v-if="!r.materiasReprobadas.length" class="text-base-content/30">—</span>
                  <span v-for="m in r.materiasReprobadas" :key="m.materia" class="badge badge-error badge-outline badge-xs mr-1 mb-0.5">{{ m.materia }} ({{ m.promedio }})</span>
                </td>
                <td><StatusBadge :estado="r.sugerido ?? 'PENDIENTE'" tamano="xs" /></td>
                <td><StatusBadge :estado="r.resultadoActual" tamano="xs" /></td>
              </tr>
              <tr v-if="!filasVisibles.length">
                <td colspan="6" class="text-center text-sm text-base-content/50 py-4">No hay estudiantes pendientes de registrar.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex flex-wrap items-center gap-3 mt-3">
          <span class="text-sm font-semibold">{{ totalSeleccionadosRes }} seleccionado(s)</span>
          <button class="btn btn-primary ml-auto min-h-11" :disabled="registrar.ejecutando.value || !totalSeleccionadosRes" @click="registrarResultados">
            <span v-if="registrar.ejecutando.value" class="loading loading-spinner loading-sm"></span>
            {{ registrar.ejecutando.value ? 'Registrando...' : 'Registrar resultados' }}
          </button>
        </div>
      </div>

      <div v-if="reporteRes" role="alert" class="alert py-2 text-sm" :class="reporteRes.errores.length ? 'alert-warning' : 'alert-success'">
        <div>
          <p>
            <strong>{{ reporteRes.actualizados }}</strong> resultado(s) registrados
            ({{ reporteRes.promovidos }} promovidos, {{ reporteRes.reprobados }} reprobados)<template v-if="reporteRes.sinCambios"> — {{ reporteRes.sinCambios }} ya estaban registrados</template><template v-if="reporteRes.errores.length"> — <strong>{{ reporteRes.errores.length }}</strong> con error</template>.
          </p>
          <ul v-if="reporteRes.errores.length" class="text-xs mt-1 list-disc list-inside">
            <li v-for="e in reporteRes.errores" :key="e.inscripcionId">{{ e.estudiante }}: {{ e.error }}</li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</div>
</template>
