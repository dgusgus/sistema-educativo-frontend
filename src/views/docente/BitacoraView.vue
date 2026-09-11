<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDocenteStore, type Asignacion, type CursoAsignacion } from '@/stores/docente.store'
import { useGestionStore } from '@/stores/gestion.store'
import { bitacoraApi, type BitacoraPayload } from '@/api/bitacora.api'
import { useConfirm } from '@/composables/useConfirm'
import { useToastStore } from '@/stores/toast.store'
import type { BitacoraClase, Nivel } from '@/types'

const { confirmar } = useConfirm()
const toast = useToastStore()

const docenteStore = useDocenteStore()
const gestion       = useGestionStore()

const asignacion = computed({
  get: () => docenteStore.asignacionActiva,
  set: (a) => { if (a) docenteStore.seleccionar(a) },
})

const NIVEL_TEXTO: Record<Nivel, string> = { PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
function nombreCursoCorto(c: CursoAsignacion): string {
  return `${c.grado}° ${NIVEL_TEXTO[c.nivel]} "${c.paralelo}"`
}

const registros = ref<BitacoraClase[]>([])
const cargando  = ref(false)
const error     = ref<string | null>(null)

onMounted(async () => {
  await docenteStore.cargar()
  await gestion.cargar()
  if (docenteStore.asignacionActiva) await cargar()
})

async function cargar() {
  if (!asignacion.value) return
  cargando.value = true
  error.value = null
  try {
    registros.value = await bitacoraApi.getAll(asignacion.value.docenteMateriaCursoId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar la bitácora'
  } finally {
    cargando.value = false
  }
}

async function cambiarAsignacion(asig: Asignacion) {
  docenteStore.seleccionar(asig)
  await cargar()
}

// ── Crear/editar registro ─────────────────────────────────────────────────────
const modalAbierto = ref(false)
const guardando    = ref(false)
const errorModal   = ref<string | null>(null)
const idEditando   = ref<number | null>(null)

const formVacio = () => ({
  fecha: new Date().toISOString().split('T')[0],
  tema: '', descripcion: '', tareaAsignada: '',
})
const form = ref(formVacio())

function abrirCrear() {
  idEditando.value = null
  form.value = formVacio()
  errorModal.value = null
  modalAbierto.value = true
}

function abrirEditar(r: BitacoraClase) {
  idEditando.value = r.id
  form.value = {
    fecha:         r.fecha.split('T')[0],
    tema:          r.tema,
    descripcion:   r.descripcion ?? '',
    tareaAsignada: r.tareaAsignada ?? '',
  }
  errorModal.value = null
  modalAbierto.value = true
}

async function guardar() {
  if (!form.value.tema.trim()) {
    errorModal.value = 'El tema es obligatorio'
    return
  }
  if (!asignacion.value) return

  guardando.value = true
  errorModal.value = null
  try {
    if (idEditando.value) {
      const actualizado = await bitacoraApi.update(idEditando.value, {
        tema: form.value.tema,
        descripcion: form.value.descripcion || undefined,
        tareaAsignada: form.value.tareaAsignada || undefined,
      })
      const idx = registros.value.findIndex(r => r.id === idEditando.value)
      if (idx !== -1) registros.value[idx] = actualizado
    } else {
      const payload: BitacoraPayload = {
        docenteMateriaCursoId: asignacion.value.docenteMateriaCursoId,
        trimestreId:           gestion.trimestreActivo?.id,
        fecha:                 form.value.fecha,
        tema:                  form.value.tema,
        descripcion:           form.value.descripcion || undefined,
        tareaAsignada:         form.value.tareaAsignada || undefined,
      }
      const nuevo = await bitacoraApi.create(payload)
      registros.value.unshift(nuevo)
    }
    modalAbierto.value = false
    toast.success(idEditando.value ? 'Registro actualizado' : 'Registro creado')
  } catch (e) {
    errorModal.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    guardando.value = false
  }
}

const eliminando = ref<number | null>(null)
async function eliminar(r: BitacoraClase) {
  const ok = await confirmar({ mensaje: `¿Eliminar el registro "${r.tema}"?`, peligroso: true })
  if (!ok) return
  eliminando.value = r.id
  try {
    await bitacoraApi.delete(r.id)
    registros.value = registros.value.filter(x => x.id !== r.id)
    toast.success('Registro eliminado')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al eliminar'
  } finally {
    eliminando.value = null
  }
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-2xl font-bold">Bitácora de Clase</h2>

    <div v-if="docenteStore.cargando" class="flex items-center gap-2 text-base-content/60">
      <span class="loading loading-spinner loading-sm"></span>
      Cargando tus asignaciones...
    </div>

    <div v-else-if="!docenteStore.tieneAsignaciones" role="alert" class="alert alert-warning">
      <span>No tenés asignaciones activas. Contactá al director.</span>
    </div>

    <template v-else>
      <div v-if="docenteStore.asignaciones.length > 1" class="card bg-base-100 shadow">
        <div class="card-body py-3">
          <p class="text-xs text-base-content/50 mb-2">Seleccioná tu materia/curso:</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="asig in docenteStore.asignaciones"
              :key="asig.docenteMateriaCursoId"
              class="btn btn-sm"
              :class="asignacion?.docenteMateriaCursoId === asig.docenteMateriaCursoId ? 'btn-primary' : 'btn-ghost'"
              @click="cambiarAsignacion(asig)"
            >
              {{ asig.materia.nombre }} — {{ nombreCursoCorto(asig.curso) }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="asignacion" class="flex items-center justify-between">
        <p class="text-sm text-base-content/60">
          {{ asignacion.materia.nombre }} — {{ nombreCursoCorto(asignacion.curso) }}
        </p>
        <button class="btn btn-primary btn-sm" @click="abrirCrear">+ Nuevo registro</button>
      </div>

      <div v-if="error" role="alert" class="alert alert-error"><span>{{ error }}</span></div>

      <div v-if="cargando" class="skeleton h-40 rounded-xl"></div>

      <div v-else-if="registros.length" class="space-y-3">
        <div v-for="r in registros" :key="r.id" class="card bg-base-100 shadow">
          <div class="card-body py-3">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs text-base-content/50">{{ new Date(r.fecha).toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' }) }}</p>
                <p class="font-semibold">{{ r.tema }}</p>
                <p v-if="r.descripcion" class="text-sm text-base-content/70 mt-1">{{ r.descripcion }}</p>
                <p v-if="r.tareaAsignada" class="text-sm mt-1">
                  <span class="badge badge-sm badge-outline">Tarea</span> {{ r.tareaAsignada }}
                </p>
              </div>
              <div class="flex gap-1 shrink-0">
                <button class="btn btn-ghost btn-xs" @click="abrirEditar(r)">Editar</button>
                <button class="btn btn-ghost btn-xs text-error" :disabled="eliminando === r.id" @click="eliminar(r)">
                  <span v-if="eliminando === r.id" class="loading loading-xs loading-spinner"></span>
                  <span v-else>Eliminar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="text-center text-base-content/40 py-12">
        Sin registros todavía — usá "+ Nuevo registro" para anotar el tema de hoy.
      </div>
    </template>
  </div>

  <!-- Modal crear/editar -->
  <dialog :open="modalAbierto" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">{{ idEditando ? 'Editar registro' : 'Nuevo registro de clase' }}</h3>

      <div v-if="errorModal" role="alert" class="alert alert-error mb-4 py-2 text-sm"><span>{{ errorModal }}</span></div>

      <form class="space-y-3" @submit.prevent="guardar">
        <fieldset v-if="!idEditando" class="fieldset">
          <legend class="fieldset-legend text-xs">Fecha</legend>
          <input v-model="form.fecha" type="date" class="input input-bordered w-full" :disabled="guardando" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Tema *</legend>
          <input v-model="form.tema" type="text" placeholder="Ej: Ecuaciones de segundo grado" class="input input-bordered w-full" :disabled="guardando" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Descripción</legend>
          <textarea v-model="form.descripcion" class="textarea textarea-bordered w-full" rows="3" :disabled="guardando"></textarea>
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Tarea asignada</legend>
          <input v-model="form.tareaAsignada" type="text" placeholder="Opcional" class="input input-bordered w-full" :disabled="guardando" />
        </fieldset>
        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="guardando" @click="modalAbierto = false">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="guardando">
            <span v-if="guardando" class="loading loading-spinner loading-sm"></span>
            {{ idEditando ? 'Guardar cambios' : 'Crear' }}
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalAbierto = false"><button>cerrar</button></form>
  </dialog>
</template>