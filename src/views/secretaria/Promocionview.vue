<script setup lang="ts">
/**
 * PromocionView — Promoción y matrícula POR CURSO.
 *
 * La unidad de trabajo es un curso de la gestión de origen (p. ej. 3° "A"). Un tablero muestra
 * todos los cursos con su avance; al abrir uno se hacen sus dos pasos, cada uno en su componente
 * (components/promocion/): Paso 1 resultados finales, Paso 2 matrícula en la gestión siguiente.
 * Esta vista solo elige las gestiones, carga el tablero y coordina los pasos.
 */
import { ref, computed, onMounted, watch } from 'vue'
import { gestionApi, type GestionResumen, type TableroPromocion, type CursoPromocion } from '@/api/gestion.api'
import { useCatalogoStore } from '@/stores/catalogo.store'
import PromocionTablero from '@/components/promocion/PromocionTablero.vue'
import PromocionPaso1 from '@/components/promocion/PromocionPaso1.vue'
import PromocionPaso2 from '@/components/promocion/PromocionPaso2.vue'

const mensaje = (e: unknown, defecto: string) => (e instanceof Error ? e.message : defecto)

// ─── Gestiones ───────────────────────────────────────────────────────────────
const gestiones = ref<GestionResumen[]>([])
const catalogo = useCatalogoStore()
const origenId  = ref<number | ''>('')
const destinoId = ref<number | ''>('')

const destinosPosibles = computed(() => {
  const origen = gestiones.value.find(g => g.id === origenId.value)
  return origen ? gestiones.value.filter(g => g.anio > origen.anio) : []
})
const destinoAnio = computed(() => gestiones.value.find(g => g.id === destinoId.value)?.anio)

onMounted(async () => {
  try {
    // forzar: la promoción necesita ver el estado más reciente de las gestiones
    gestiones.value = [...(await catalogo.gestiones(true))]
    // Origen: la gestión activa (los resultados se registran antes de cerrarla);
    // si no hay activa, la más reciente.
    const masReciente = [...gestiones.value].sort((a, b) => b.anio - a.anio)[0]
    const origen = gestiones.value.find(g => g.activa) ?? masReciente
    if (origen) origenId.value = origen.id
  } catch {
    gestiones.value = []
  }
})

// Al cambiar el origen: destino por defecto = la gestión inmediatamente posterior.
watch(origenId, () => {
  cursoSel.value = null
  const siguiente = [...destinosPosibles.value].sort((a, b) => a.anio - b.anio)[0]
  const nuevo = siguiente?.id ?? ''
  if (destinoId.value === nuevo) void cargarTablero()
  else destinoId.value = nuevo   // el watch de destinoId recarga el tablero
})
watch(destinoId, () => { void cargarTablero() })   // el Paso 2 abierto se recarga solo (vigila destinoId)

// ─── Tablero de cursos ───────────────────────────────────────────────────────
const tablero = ref<TableroPromocion | null>(null)
const cargandoTablero = ref(false)
const errorTablero = ref<string | null>(null)

async function cargarTablero() {
  if (!origenId.value) { tablero.value = null; return }
  cargandoTablero.value = true
  errorTablero.value = null
  try {
    tablero.value = await gestionApi.getCursosPromocion(
      Number(origenId.value),
      destinoId.value ? Number(destinoId.value) : undefined,
    )
  } catch (e) {
    tablero.value = null
    errorTablero.value = mensaje(e, 'Error al cargar los cursos')
  } finally {
    cargandoTablero.value = false
  }
}

// ─── Curso abierto y coordinación de pasos ───────────────────────────────────
const cursoSel = ref<CursoPromocion | null>(null)
const paso2 = ref<InstanceType<typeof PromocionPaso2> | null>(null)

// Al registrar resultados cambia lo que se puede matricular y el avance del tablero.
function alRegistrar() {
  void paso2.value?.recargar()
  void cargarTablero()
}
</script>


<template>
  <div class="space-y-4">
    <div>
      <h2 class="font-display text-2xl font-bold tracking-tight">Promoción de Gestión</h2>
      <p class="mt-0.5 text-sm text-base-content/60">
        Se trabaja curso por curso: primero se registra el resultado final del año de sus estudiantes (Paso 1)
        y después se los matricula en la gestión siguiente (Paso 2). El estudiante no se duplica — solo se
        genera su inscripción nueva, y el sistema controla que cada uno vaya al curso que le corresponde.
      </p>
    </div>

    <!-- Gestiones -->
    <div class="card bg-base-100 shadow">
      <div class="card-body py-3 space-y-2">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Gestión de origen (la que termina)</legend>
            <select v-model="origenId" class="select select-bordered w-full">
              <option value="" disabled>Seleccionar</option>
              <option v-for="g in gestiones" :key="g.id" :value="g.id">{{ g.anio }} {{ g.activa ? '(activa)' : '' }}</option>
            </select>
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Gestión de destino (la siguiente)</legend>
            <select v-model="destinoId" class="select select-bordered w-full" :disabled="!destinosPosibles.length">
              <option value="">Sin elegir</option>
              <option v-for="g in destinosPosibles" :key="g.id" :value="g.id">{{ g.anio }} {{ g.activa ? '(activa)' : '' }}</option>
            </select>
          </fieldset>
        </div>
        <p v-if="origenId && !destinosPosibles.length" class="text-xs text-warning">
          No hay una gestión posterior. Para matricular, créala en Gestiones copiando la estructura de la actual.
        </p>
      </div>
    </div>

    <div v-if="errorTablero" role="alert" class="alert alert-error"><span>{{ errorTablero }}</span></div>

    <div class="card bg-base-100 shadow">
      <div class="card-body py-3">
        <PromocionTablero :tablero="tablero" :cargando="cargandoTablero" :seleccionado-id="cursoSel?.cursoId ?? null"
                          @abrir="cursoSel = $event" />
      </div>
    </div>

    <!-- Curso abierto: la key reinicia los pasos al cambiar de curso -->
    <template v-if="cursoSel && origenId">
      <div class="flex items-center gap-3 pt-2">
        <h3 class="font-display text-xl font-bold">{{ cursoSel.curso }}</h3>
        <button class="btn btn-ghost btn-sm ml-auto min-h-11" @click="cursoSel = null">Cerrar curso</button>
      </div>

      <PromocionPaso1 :key="`p1-${cursoSel.cursoId}`" :origen-id="Number(origenId)" :curso="cursoSel" @registrado="alRegistrar" />
      <PromocionPaso2 :key="`p2-${cursoSel.cursoId}`" ref="paso2" :origen-id="Number(origenId)" :destino-id="destinoId"
                      :destino-anio="destinoAnio" :curso="cursoSel" @matriculado="cargarTablero" />
    </template>
  </div>
</template>
