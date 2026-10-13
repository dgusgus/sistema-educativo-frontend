<script setup lang="ts">
/**
 * PASO 2 · Matrícula del curso en la gestión siguiente. Los PROMOVIDOS van a UN curso del
 * grado siguiente y los REPROBADOS a UN curso del mismo grado. El servidor valida todo
 * (grado correcto, sin doble matrícula, historial) y devuelve uno por uno los estudiantes
 * que no pudo matricular. Retirados y transferidos se listan aparte (no se matriculan).
 */
import { ref, computed, watch, onMounted } from 'vue'
import { gestionApi, type CursoPromocion, type PropuestaMatricula, type ResultadoMatricula } from '@/api/gestion.api'
import { useToastStore } from '@/stores/toast.store'
import { useConfirm } from '@/composables/useConfirm'
import { useAccion } from '@/composables/useAccion'

const props = defineProps<{ origenId: number; destinoId: number | ''; destinoAnio?: number | string; curso: CursoPromocion }>()
const emit = defineEmits<{ (e: 'matriculado'): void }>()

const toast = useToastStore()
const { confirmar } = useConfirm()

const propuesta = ref<PropuestaMatricula | null>(null)
const cargandoProp = ref(false)
const errorCarga = ref<string | null>(null)
const errorLocal = ref<string | null>(null)
const seleccionMat = ref<Record<number, boolean>>({})
const cursoPromovidosId = ref<number | ''>('')
const cursoRepitenId = ref<number | ''>('')
const reporteMat = ref<ResultadoMatricula | null>(null)

async function cargarPropuesta() {
  propuesta.value = null
  errorCarga.value = null
  if (!props.destinoId) return
  cargandoProp.value = true
  try {
    const p = await gestionApi.getPropuestaMatricula(props.origenId, props.curso.cursoId, Number(props.destinoId))
    propuesta.value = p
    seleccionMat.value = {}
    p.estudiantes.forEach(e => {
      seleccionMat.value[e.inscripcionId] = (e.grupo === 'PROMOVIDO' || e.grupo === 'REPITE') && !e.yaMatriculadoEn
    })
    cursoPromovidosId.value = p.sugeridoPromovidosId ?? ''
    cursoRepitenId.value = p.sugeridoRepitenId ?? ''
  } catch (e) {
    errorCarga.value = e instanceof Error ? e.message : 'Error al cargar la propuesta de matrícula'
  } finally {
    cargandoProp.value = false
  }
}

const porGrupo = (g: string) => computed(() => (propuesta.value?.estudiantes ?? []).filter(e => e.grupo === g))
const promovidos   = porGrupo('PROMOVIDO')
const repiten      = porGrupo('REPITE')
const egresan      = porGrupo('EGRESA')
const sinResultado = porGrupo('SIN_RESULTADO')
const noAplica     = porGrupo('NO_APLICA')

const marcadosPromovidos = computed(() => promovidos.value.filter(e => seleccionMat.value[e.inscripcionId] && !e.yaMatriculadoEn))
const marcadosRepiten    = computed(() => repiten.value.filter(e => seleccionMat.value[e.inscripcionId] && !e.yaMatriculadoEn))
const totalMarcadosMat   = computed(() => marcadosPromovidos.value.length + marcadosRepiten.value.length)

const destinoPromovidos = computed(() => propuesta.value?.cursosPromovidos.find(c => c.id === cursoPromovidosId.value) ?? null)
const destinoRepiten    = computed(() => propuesta.value?.cursosRepiten.find(c => c.id === cursoRepitenId.value) ?? null)

// La capacidad se informa pero no bloquea (hoy tampoco bloquea la inscripción individual).
const excede = (curso: { capacidad: number | null; inscritos: number } | null, nuevos: number) =>
  !!curso && curso.capacidad !== null && curso.inscritos + nuevos > curso.capacidad
const excedePromovidos = computed(() => excede(destinoPromovidos.value, marcadosPromovidos.value.length))
const excedeRepiten    = computed(() => excede(destinoRepiten.value, marcadosRepiten.value.length))

function marcarGrupo(lista: { inscripcionId: number; yaMatriculadoEn: string | null }[], valor: boolean) {
  lista.forEach(e => { if (!e.yaMatriculadoEn) seleccionMat.value[e.inscripcionId] = valor })
}

const matricular = useAccion(
  (pedido: Parameters<typeof gestionApi.matricularCurso>[1]) => gestionApi.matricularCurso(props.origenId, pedido),
  { errorPorDefecto: 'Error al matricular' },
)
const errorMostrado = computed(() => errorLocal.value ?? matricular.error.value ?? errorCarga.value)

async function matricularClick() {
  const p = propuesta.value
  if (!p) return
  errorLocal.value = null
  const prom = marcadosPromovidos.value
  const rep = marcadosRepiten.value
  if (!prom.length && !rep.length) { errorLocal.value = 'No hay estudiantes seleccionados'; return }
  if (prom.length && !cursoPromovidosId.value) { errorLocal.value = `Elegir el curso de ${p.siguiente?.etiqueta} para los promovidos`; return }
  if (rep.length && !cursoRepitenId.value) { errorLocal.value = `Elegir el curso de ${p.repite.etiqueta} para los repetidores`; return }

  const partes: string[] = []
  if (prom.length) partes.push(`${prom.length} promovido(s) a ${destinoPromovidos.value?.nombre}`)
  if (rep.length)  partes.push(`${rep.length} repetidor(es) a ${destinoRepiten.value?.nombre}`)
  const ok = await confirmar({
    titulo: 'Matricular estudiantes',
    mensaje: `${props.curso.curso} → gestión ${p.destino.anio}: ${partes.join(' y ')}.`,
    peligroso: false,
  })
  if (!ok) return

  const r = await matricular.ejecutar({
    destinoId:         Number(props.destinoId),
    cursoOrigenId:     props.curso.cursoId,
    cursoPromovidosId: prom.length ? Number(cursoPromovidosId.value) : undefined,
    cursoRepitenId:    rep.length  ? Number(cursoRepitenId.value)    : undefined,
    inscripcionIds:    [...prom, ...rep].map(e => e.inscripcionId),
  })
  if (!r) return
  reporteMat.value = r
  if (r.matriculados) toast.success(`Matriculados: ${r.matriculados}`)
  await cargarPropuesta()
  emit('matriculado')
}

onMounted(cargarPropuesta)
watch(() => props.destinoId, cargarPropuesta)
defineExpose({ recargar: cargarPropuesta })
</script>

<template>
<div class="card bg-base-100 shadow">
  <div class="card-body py-3 space-y-3">
    <h4 class="font-semibold">Paso 2 · Matrícula en la gestión {{ destinoAnio ?? 'siguiente' }}</h4>

    <div v-if="!destinoId" role="alert" class="alert alert-info py-2 text-sm">
      <span>Elegir arriba la gestión de destino. Si todavía no existe, créala en Gestiones copiando la estructura de la actual.</span>
    </div>
    <div v-if="cargandoProp" class="flex justify-center py-4"><span class="loading loading-spinner"></span></div>
    <div v-if="errorMostrado" role="alert" class="alert alert-error py-2 text-sm"><span>{{ errorMostrado }}</span></div>

    <template v-if="propuesta">
      <div class="flex flex-wrap gap-2 text-xs">
        <span class="badge badge-success badge-outline">{{ propuesta.resumen.promovidos }} promovidos</span>
        <span class="badge badge-error badge-outline">{{ propuesta.resumen.repiten }} repiten</span>
        <span v-if="propuesta.resumen.egresan" class="badge badge-ghost">{{ propuesta.resumen.egresan }} egresan</span>
        <span class="badge badge-info badge-outline">{{ propuesta.resumen.yaMatriculados }} ya matriculados</span>
        <span class="badge badge-warning badge-outline">{{ propuesta.resumen.porMatricular }} por matricular</span>
      </div>

      <div v-if="propuesta.resumen.sinResultado" role="alert" class="alert alert-warning py-2 text-sm">
        <span>{{ propuesta.resumen.sinResultado }} estudiante(s) sin resultado final: no se pueden matricular hasta completar el Paso 1.</span>
      </div>

      <!-- Promovidos -->
      <div v-if="promovidos.length" class="rounded-box border border-base-300 p-3 space-y-2">
        <div class="flex flex-wrap items-end gap-3">
          <h5 class="font-semibold">Promovidos → {{ propuesta.siguiente?.etiqueta }}</h5>
          <fieldset class="fieldset ml-auto min-w-64">
            <legend class="fieldset-legend text-xs">Curso de destino</legend>
            <select v-model="cursoPromovidosId" class="select select-bordered select-sm w-full" :disabled="!propuesta.cursosPromovidos.length">
              <option value="" disabled>Seleccionar</option>
              <option v-for="c in propuesta.cursosPromovidos" :key="c.id" :value="c.id">
                {{ c.nombre }} ({{ c.inscritos }}{{ c.capacidad ? ' / ' + c.capacidad : '' }})
              </option>
            </select>
          </fieldset>
        </div>
        <p v-if="!propuesta.cursosPromovidos.length" class="text-xs text-warning">
          No hay un curso de {{ propuesta.siguiente?.etiqueta }} en la gestión {{ propuesta.destino.anio }}: copia la estructura o créalo en Estructura.
        </p>
        <p v-if="excedePromovidos" class="text-xs text-warning">Con esta matrícula el curso supera su capacidad ({{ destinoPromovidos?.capacidad }}).</p>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-xs" @click="marcarGrupo(promovidos, true)">Marcar todos</button>
          <button class="btn btn-ghost btn-xs" @click="marcarGrupo(promovidos, false)">Desmarcar todos</button>
        </div>
        <div class="overflow-x-auto max-h-72 overflow-y-auto">
          <table class="table table-xs">
            <tbody>
              <tr v-for="e in promovidos" :key="e.inscripcionId" class="hover">
                <td class="w-12 text-center"><input v-model="seleccionMat[e.inscripcionId]" type="checkbox" class="checkbox checkbox-md" :disabled="!!e.yaMatriculadoEn" :aria-label="`Seleccionar a ${e.estudiante}`" /></td>
                <td>{{ e.estudiante }}</td>
                <td class="font-mono text-xs text-base-content/50">{{ e.ci }}</td>
                <td class="text-right"><span v-if="e.yaMatriculadoEn" class="badge badge-info badge-outline badge-xs">Ya en {{ e.yaMatriculadoEn }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Repiten -->
      <div v-if="repiten.length" class="rounded-box border border-base-300 p-3 space-y-2">
        <div class="flex flex-wrap items-end gap-3">
          <h5 class="font-semibold">Repiten → {{ propuesta.repite.etiqueta }}</h5>
          <fieldset class="fieldset ml-auto min-w-64">
            <legend class="fieldset-legend text-xs">Curso de destino</legend>
            <select v-model="cursoRepitenId" class="select select-bordered select-sm w-full" :disabled="!propuesta.cursosRepiten.length">
              <option value="" disabled>Seleccionar</option>
              <option v-for="c in propuesta.cursosRepiten" :key="c.id" :value="c.id">
                {{ c.nombre }} ({{ c.inscritos }}{{ c.capacidad ? ' / ' + c.capacidad : '' }})
              </option>
            </select>
          </fieldset>
        </div>
        <p v-if="!propuesta.cursosRepiten.length" class="text-xs text-warning">
          No hay un curso de {{ propuesta.repite.etiqueta }} en la gestión {{ propuesta.destino.anio }}: copia la estructura o créalo en Estructura.
        </p>
        <p v-if="excedeRepiten" class="text-xs text-warning">Con esta matrícula el curso supera su capacidad ({{ destinoRepiten?.capacidad }}).</p>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-xs" @click="marcarGrupo(repiten, true)">Marcar todos</button>
          <button class="btn btn-ghost btn-xs" @click="marcarGrupo(repiten, false)">Desmarcar todos</button>
        </div>
        <div class="overflow-x-auto max-h-72 overflow-y-auto">
          <table class="table table-xs">
            <tbody>
              <tr v-for="e in repiten" :key="e.inscripcionId" class="hover">
                <td class="w-12 text-center"><input v-model="seleccionMat[e.inscripcionId]" type="checkbox" class="checkbox checkbox-md" :disabled="!!e.yaMatriculadoEn" :aria-label="`Seleccionar a ${e.estudiante}`" /></td>
                <td>{{ e.estudiante }}</td>
                <td class="font-mono text-xs text-base-content/50">{{ e.ci }}</td>
                <td class="text-right"><span v-if="e.yaMatriculadoEn" class="badge badge-info badge-outline badge-xs">Ya en {{ e.yaMatriculadoEn }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Egresan / sin resultado / retirados -->
      <div v-if="egresan.length" class="text-sm">
        <p class="font-semibold">Egresan ({{ egresan.length }})</p>
        <p class="text-xs text-base-content/60">{{ egresan.map(e => e.estudiante).join(' · ') }}</p>
      </div>
      <div v-if="sinResultado.length" class="text-sm">
        <p class="font-semibold text-warning">Sin resultado ({{ sinResultado.length }})</p>
        <p class="text-xs text-base-content/60">{{ sinResultado.map(e => e.estudiante).join(' · ') }}</p>
      </div>
      <div v-if="noAplica.length" class="text-sm">
        <p class="font-semibold">Retirados o transferidos ({{ noAplica.length }})</p>
        <p class="text-xs text-base-content/60">{{ noAplica.map(e => e.estudiante).join(' · ') }}</p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <span class="text-sm font-semibold">{{ totalMarcadosMat }} estudiante(s) para matricular</span>
        <button class="btn btn-primary ml-auto min-h-11" :disabled="matricular.ejecutando.value || !totalMarcadosMat" @click="matricularClick">
          <span v-if="matricular.ejecutando.value" class="loading loading-spinner loading-sm"></span>
          {{ matricular.ejecutando.value ? 'Matriculando...' : 'Matricular' }}
        </button>
      </div>

      <div v-if="reporteMat" role="alert" class="alert py-2 text-sm" :class="reporteMat.errores.length ? 'alert-warning' : 'alert-success'">
        <div>
          <p>
            <strong>{{ reporteMat.matriculados }}</strong> estudiante(s) matriculados
            ({{ reporteMat.promovidos }} promovidos, {{ reporteMat.repiten }} repiten)<template v-if="reporteMat.errores.length"> — <strong>{{ reporteMat.errores.length }}</strong> no se pudieron matricular</template>.
          </p>
          <ul v-if="reporteMat.errores.length" class="text-xs mt-1 list-disc list-inside">
            <li v-for="e in reporteMat.errores" :key="e.inscripcionId">{{ e.estudiante }}: {{ e.error }}</li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</div>
</template>
