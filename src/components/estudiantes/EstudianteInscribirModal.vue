<script setup lang="ts">
// Inscribe a un estudiante en la gestión activa. Muestra solo los cursos que le
// corresponden según su historial (el servidor valida lo mismo al guardar).
import { ref, computed, watch } from 'vue'
import ModalBase from '@/components/ModalBase.vue'
import { estudianteApi, type CursoEsperado } from '@/api/estudiante.api'
import { useGestionStore } from '@/stores/gestion.store'
import { useAccion } from '@/composables/useAccion'
import type { Estudiante } from '@/types'

const props = defineProps<{ abierto: boolean; estudiante: Estudiante | null }>()
const emit = defineEmits<{ (e: 'cerrar'): void; (e: 'inscrito'): void }>()

const gestion = useGestionStore()
const form = ref({ cursoId: '' as number | '', procedencia: '' })
const validacion = ref<string | null>(null)

// Qué curso le corresponde: promovido → grado siguiente, reprobado → repite, nuevo → libre.
const esperado = ref<CursoEsperado | null>(null)

const cursosPermitidos = computed(() => {
  const e = esperado.value
  if (!e || e.tipo === 'LIBRE') return gestion.cursos
  if (e.tipo === 'FIJO') return gestion.cursos.filter(c => c.nivel === e.nivel && c.grado === e.grado)
  return []   // egresado o con resultado pendiente: no hay curso al cual inscribirlo
})
const bloqueada = computed(() => esperado.value?.tipo === 'EGRESADO' || esperado.value?.tipo === 'PENDIENTE')

const inscribir = useAccion(() => estudianteApi.inscribir({
  estudianteId: props.estudiante!.id,
  cursoId: Number(form.value.cursoId),
  gestionId: gestion.gestionId!,
  // Antes este campo se mostraba en el formulario pero nunca se enviaba: se perdía al guardar.
  procedencia: form.value.procedencia.trim() || undefined,
}), { exito: 'Estudiante inscrito' })

async function cargarEsperado(estudianteId: number) {
  if (!gestion.gestionId) return
  try {
    const h = await estudianteApi.getHistorial(estudianteId, gestion.gestionId)
    if (props.estudiante?.id !== estudianteId) return   // se abrió el modal de otro estudiante
    esperado.value = h.proximo
    if (cursosPermitidos.value.length === 1) form.value.cursoId = cursosPermitidos.value[0].id   // un solo curso posible: queda elegido
  } catch {
    esperado.value = null   // sin esta ayuda, el servidor igual valida al inscribir
  }
}

watch(() => props.abierto, (abierto) => {
  if (!abierto || !props.estudiante) return
  form.value = { cursoId: '', procedencia: '' }
  validacion.value = null
  esperado.value = null
  inscribir.limpiarError()
  void cargarEsperado(props.estudiante.id)
})

async function enviar() {
  if (!form.value.cursoId) { validacion.value = 'Selecciona un curso'; return }
  if (!gestion.gestionId) { validacion.value = 'No hay gestión activa'; return }
  validacion.value = null
  if (await inscribir.ejecutar() !== undefined) emit('inscrito')
}
</script>

<template>
  <ModalBase :abierto="abierto" titulo="Inscribir estudiante"
             :subtitulo="estudiante ? `${estudiante.nombre} ${estudiante.apellido}` : ''"
             :error="validacion ?? inscribir.error.value" @cerrar="emit('cerrar')">
    <form class="space-y-3" @submit.prevent="enviar">
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">Curso *</legend>
        <div v-if="esperado" role="alert" class="alert mb-2 py-2 text-sm" :class="bloqueada ? 'alert-error' : 'alert-info'">
          <span v-if="esperado.tipo === 'FIJO'">{{ esperado.motivo }}: le corresponde <strong>{{ esperado.corresponde }}</strong>.</span>
          <span v-else-if="esperado.tipo === 'PENDIENTE'">{{ esperado.motivo }}. Registrar primero su resultado en Promoción.</span>
          <span v-else>{{ esperado.motivo }}.</span>
        </div>
        <select v-model="form.cursoId" class="select select-bordered w-full"
                :disabled="inscribir.ejecutando.value || bloqueada || !cursosPermitidos.length">
          <option value="" disabled>Seleccionar curso</option>
          <option v-for="c in cursosPermitidos" :key="c.id" :value="c.id">{{ c.nombre }}</option>
        </select>
        <p v-if="!gestion.cursos.length" class="text-xs text-base-content/40 mt-1">
          No hay cursos en la gestión activa — copia la estructura al crear la gestión o créalos desde Estructura.
        </p>
        <p v-else-if="esperado?.tipo === 'FIJO' && !cursosPermitidos.length" class="text-xs text-warning mt-1">
          No hay un curso de {{ esperado.etiqueta }} en la gestión activa — créalo desde Estructura.
        </p>
      </fieldset>
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">Procedencia</legend>
        <input v-model="form.procedencia" type="text" placeholder="Opcional — de qué colegio viene" class="input input-bordered w-full" :disabled="inscribir.ejecutando.value" />
      </fieldset>
      <p class="text-xs text-base-content/50">Gestión: <strong>{{ gestion.anio }}</strong></p>
      <div class="modal-action mt-6">
        <button type="button" class="btn btn-ghost" :disabled="inscribir.ejecutando.value" @click="emit('cerrar')">Cancelar</button>
        <button type="submit" class="btn btn-primary" :disabled="inscribir.ejecutando.value || bloqueada">
          <span v-if="inscribir.ejecutando.value" class="loading loading-spinner loading-sm"></span>
          Inscribir
        </button>
      </div>
    </form>
  </ModalBase>
</template>
