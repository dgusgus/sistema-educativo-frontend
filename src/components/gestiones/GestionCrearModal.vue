<script setup lang="ts">
// Crea una gestión (año escolar), con opción de copiar la estructura de otra anterior.
// El director se asigna aparte: se puede crear la gestión sin saber aún quién la dirigirá.
import { ref, computed, watch } from 'vue'
import ModalBase from '@/components/ModalBase.vue'
import AppIcon from '@/components/AppIcon.vue'
import CopiarEstructuraCampos from '@/components/CopiarEstructuraCampos.vue'
import { gestionApi, type GestionResumen, type OpcionesCopiaForm, type ResultadoCopia } from '@/api/gestion.api'
import { useCatalogoStore } from '@/stores/catalogo.store'
import { useAccion } from '@/composables/useAccion'
import { nuevaCopia } from '@/lib/gestiones'

const props = defineProps<{ abierto: boolean; gestiones: GestionResumen[] }>()
const emit = defineEmits<{
  (e: 'cerrar'): void
  (e: 'creada', p: { anio: number; copia: ResultadoCopia | null }): void
}>()

const catalogo = useCatalogoStore()
const form = ref<{ anio: number; descripcion: string; copiar: boolean; copia: OpcionesCopiaForm }>(
  { anio: new Date().getFullYear() + 1, descripcion: '', copiar: false, copia: nuevaCopia('') },
)
const validacion = ref<string | null>(null)
const origenes = computed(() => props.gestiones.filter(g => g.anio < form.value.anio))

const crear = useAccion(async () => {
  const c = form.value.copia
  catalogo.invalidar('gestiones')
  return gestionApi.create({
    anio: form.value.anio,
    descripcion: form.value.descripcion || undefined,
    copiarDe: form.value.copiar
      ? { origenId: Number(c.origenId), cursos: c.cursos, asignaciones: c.asignaciones,
          trimestres: c.trimestres, dimensiones: c.dimensiones, conceptosPago: c.conceptosPago }
      : undefined,
  })
}, { errorPorDefecto: 'Error al crear gestión' })

watch(() => props.abierto, (abierto) => {
  if (!abierto) return
  // Se sugiere el año siguiente: la gestión se crea en los últimos meses del año anterior.
  const anterior = [...props.gestiones].sort((a, b) => b.anio - a.anio)[0]
  const sig = new Date().getFullYear() + 1
  form.value = { anio: sig, descripcion: `Gestión Escolar ${sig}`, copiar: !!anterior, copia: nuevaCopia(anterior?.id ?? '') }
  validacion.value = null
  crear.limpiarError()
})

async function enviar() {
  if (!form.value.anio) { validacion.value = 'El año es obligatorio'; return }
  if (form.value.copiar && !form.value.copia.origenId) { validacion.value = 'Elegí la gestión de la cual copiar la estructura'; return }
  validacion.value = null
  const nueva = await crear.ejecutar()
  if (!nueva) return
  emit('creada', { anio: nueva.anio, copia: nueva.copia ?? null })
  emit('cerrar')
}
</script>

<template>
  <ModalBase :abierto="abierto" titulo="Nueva gestión escolar" :error="validacion ?? crear.error.value" @cerrar="emit('cerrar')">
    <form class="space-y-3" @submit.prevent="enviar">
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">Año *</legend>
        <input v-model.number="form.anio" type="number" :min="2020" :max="2100" class="input input-bordered w-full" :disabled="crear.ejecutando.value" />
        <p class="text-xs text-base-content/50 mt-1">El año debe ser único — no puede haber dos gestiones para el mismo año.</p>
      </fieldset>

      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">Descripción</legend>
        <input v-model="form.descripcion" type="text" placeholder="Ej: Gestión Escolar 2026" class="input input-bordered w-full" :disabled="crear.ejecutando.value" />
      </fieldset>

      <div v-if="gestiones.length" class="rounded-box border border-base-300 p-3 space-y-2">
        <label class="label cursor-pointer justify-start gap-2 p-0">
          <input v-model="form.copiar" type="checkbox" class="checkbox checkbox-sm" :disabled="crear.ejecutando.value" />
          <span class="text-sm font-semibold">Copiar la estructura de otra gestión</span>
        </label>
        <CopiarEstructuraCampos v-if="form.copiar" v-model="form.copia" :origenes="origenes" :deshabilitado="crear.ejecutando.value" />
      </div>

      <div role="alert" class="alert py-2 text-sm">
        <AppIcon nombre="alerta" class="h-4 w-4" />
        <span>
          El director se asigna por separado desde la tabla.
          <template v-if="form.copiar">Los cursos, asignaciones y trimestres se copian de la gestión elegida; podés ajustarlos después en <strong>Estructura</strong>.</template>
          <template v-else>Después de crear, recordá también crear los cursos y trimestres en <strong>Estructura</strong>.</template>
        </span>
      </div>

      <div class="modal-action mt-6">
        <button type="button" class="btn btn-ghost" :disabled="crear.ejecutando.value" @click="emit('cerrar')">Cancelar</button>
        <button type="submit" class="btn btn-primary" :disabled="crear.ejecutando.value">
          <span v-if="crear.ejecutando.value" class="loading loading-spinner loading-sm"></span>
          Crear gestión
        </button>
      </div>
    </form>
  </ModalBase>
</template>
