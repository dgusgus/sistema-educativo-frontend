<script setup lang="ts">
// Asignaciones (materia + curso) de un docente en la gestión activa: ver, agregar y quitar.
// El modal queda abierto tras agregar/quitar para poder seguir trabajando.
import { ref, computed, watch } from 'vue'
import ModalBase from '@/components/ModalBase.vue'
import { docenteApi } from '@/api/docente.api'
import { useGestionStore } from '@/stores/gestion.store'
import { useAccion } from '@/composables/useAccion'
import { cursosDe, type AsignacionDocente } from '@/lib/docentes'
import type { Docente, Materia } from '@/types'

// `docente` debe ser la versión VIVA de la lista (se actualiza al agregar/quitar).
const props = defineProps<{ abierto: boolean; docente: Docente | null; materias: Materia[] }>()
const emit = defineEmits<{
  (e: 'cerrar'): void
  (e: 'asignada', p: { docenteId: number; asignacion: AsignacionDocente }): void
  (e: 'quitada', p: { docenteId: number; asignacionId: number }): void
}>()

const gestion = useGestionStore()
const form = ref<{ materiaId: number | ''; cursoId: number | '' }>({ materiaId: '', cursoId: '' })
const validacion = ref<string | null>(null)
// La confirmación va en la misma fila (sin abrir otro diálogo encima del modal).
const confirmandoQuitar = ref<number | null>(null)
const quitandoId = ref<number | null>(null)

const asignaciones = computed(() => (props.docente ? cursosDe(props.docente) : []))

const asignar = useAccion(
  () => docenteApi.asignar(props.docente!.id, {
    materiaId: Number(form.value.materiaId),
    cursoId: Number(form.value.cursoId),
    gestionId: gestion.gestionId!,
  }),
  { exito: 'Materia asignada', errorPorDefecto: 'Error al asignar' },
)
const quitar = useAccion(
  (asignacionId: number) => docenteApi.removeAsignacion(props.docente!.id, asignacionId),
  { exito: 'Asignación eliminada', errorPorDefecto: 'Error al quitar la asignación' },
)

watch(() => props.abierto, (abierto) => {
  if (!abierto) return
  form.value = { materiaId: '', cursoId: '' }
  validacion.value = null
  confirmandoQuitar.value = null
  asignar.limpiarError(); quitar.limpiarError()
})

async function agregar() {
  if (!form.value.materiaId || !form.value.cursoId) { validacion.value = 'Seleccioná materia y curso'; return }
  if (!props.docente || !gestion.gestionId) { validacion.value = 'No hay gestión activa'; return }
  validacion.value = null
  const nueva = await asignar.ejecutar()
  if (!nueva) return
  emit('asignada', { docenteId: props.docente.id, asignacion: nueva })
  form.value = { materiaId: '', cursoId: '' }
}

// Si la asignación ya tiene notas o asistencia, el servidor responde con el motivo
// y se muestra dentro del modal.
async function confirmarQuitar(asignacionId: number) {
  if (!props.docente) return
  quitandoId.value = asignacionId
  try {
    await quitar.ejecutar(asignacionId)
    if (!quitar.error.value) emit('quitada', { docenteId: props.docente.id, asignacionId })
  } finally {
    confirmandoQuitar.value = null
    quitandoId.value = null
  }
}
</script>

<template>
  <ModalBase :abierto="abierto" titulo="Asignaciones del docente"
             :subtitulo="docente ? `Docente: ${docente.nombre} ${docente.apellido} · Gestión: ${gestion.anio ?? '—'}` : ''"
             :error="validacion ?? asignar.error.value ?? quitar.error.value" @cerrar="emit('cerrar')">
    <div class="mb-4">
      <p class="text-xs font-semibold mb-1">Asignadas en {{ gestion.anio }}</p>
      <p v-if="!asignaciones.length" class="text-xs text-base-content/40">Sin asignaciones todavía.</p>
      <ul v-else class="space-y-1">
        <li v-for="a in asignaciones" :key="a.id" class="flex items-center gap-2 rounded-xl bg-base-200/60 px-3 py-1.5">
          <span class="min-w-0 flex-1 truncate text-sm" :title="a.completo">{{ a.completo }}</span>
          <template v-if="confirmandoQuitar === a.id">
            <span class="text-xs">¿Quitar?</span>
            <button type="button" class="btn btn-error btn-sm min-h-11" :disabled="quitandoId === a.id" @click="confirmarQuitar(a.id)">
              <span v-if="quitandoId === a.id" class="loading loading-spinner loading-xs"></span>
              Sí
            </button>
            <button type="button" class="btn btn-ghost btn-sm min-h-11" :disabled="quitandoId === a.id" @click="confirmandoQuitar = null">No</button>
          </template>
          <button v-else type="button" class="btn btn-ghost btn-sm min-h-11 text-error" @click="confirmandoQuitar = a.id">Quitar</button>
        </li>
      </ul>
    </div>

    <p class="text-xs font-semibold mb-1">Agregar</p>
    <form class="space-y-3" @submit.prevent="agregar">
      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">Materia *</legend>
        <select v-model="form.materiaId" class="select select-bordered w-full" :disabled="asignar.ejecutando.value">
          <option value="" disabled>Seleccionar materia</option>
          <option v-for="m in materias" :key="m.id" :value="m.id">{{ m.nombre }} ({{ m.codigo }})</option>
        </select>
        <p v-if="materias.length === 0" class="text-xs text-base-content/40 mt-1">
          No hay materias registradas — creálas primero en Estructura.
        </p>
      </fieldset>

      <fieldset class="fieldset">
        <legend class="fieldset-legend text-xs">Curso *</legend>
        <select v-model="form.cursoId" class="select select-bordered w-full" :disabled="asignar.ejecutando.value">
          <option value="" disabled>Seleccionar curso</option>
          <option v-for="c in gestion.cursos" :key="c.id" :value="c.id">{{ c.nombre }}</option>
        </select>
        <p v-if="gestion.cursos.length === 0" class="text-xs text-base-content/40 mt-1">
          No hay cursos en la gestión activa — creálos primero en Estructura.
        </p>
      </fieldset>

      <div class="modal-action mt-6">
        <button type="button" class="btn btn-ghost" :disabled="asignar.ejecutando.value" @click="emit('cerrar')">Cerrar</button>
        <button type="submit" class="btn btn-info" :disabled="asignar.ejecutando.value">
          <span v-if="asignar.ejecutando.value" class="loading loading-spinner loading-xs"></span>
          Agregar
        </button>
      </div>
    </form>
  </ModalBase>
</template>
