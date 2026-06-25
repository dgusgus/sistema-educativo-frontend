<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGestionStore } from '@/stores/gestion.store'
import { estudianteApi } from '@/api/estudiante.api'
import type { Estudiante } from '@/types'

const gestion = useGestionStore()

// ── Búsqueda de estudiantes ───────────────────────────────────────────────────
const busqueda   = ref('')
const buscando   = ref(false)
const resultados = ref<Estudiante[]>([])
const errorBusq  = ref<string | null>(null)

onMounted(() => gestion.cargar())

async function buscar() {
  if (!busqueda.value.trim()) return
  buscando.value = true
  errorBusq.value = null
  try {
    resultados.value = await estudianteApi.getAll({ search: busqueda.value })
  } catch (e) {
    errorBusq.value = e instanceof Error ? e.message : 'Error al buscar'
  } finally {
    buscando.value = false
  }
}

// ── Modal inscribir ───────────────────────────────────────────────────────────
const modalAbierto   = ref(false)
const estudianteSelec = ref<Estudiante | null>(null)
const cursoId        = ref<number | ''>('')
const guardando      = ref(false)
const errorModal     = ref<string | null>(null)
const exitoMsg       = ref<string | null>(null)

function abrirInscribir(est: Estudiante) {
  estudianteSelec.value = est
  cursoId.value = ''
  errorModal.value = null
  exitoMsg.value = null
  modalAbierto.value = true
}

async function inscribir() {
  if (!cursoId.value || !gestion.gestionId) {
    errorModal.value = 'Seleccioná un curso'
    return
  }
  guardando.value = true
  errorModal.value = null
  exitoMsg.value = null
  try {
    await estudianteApi.inscribir({
      estudianteId: estudianteSelec.value!.id,
      cursoId:      Number(cursoId.value),
      gestionId:    gestion.gestionId,
    })
    exitoMsg.value = `${estudianteSelec.value!.nombre} inscrito correctamente`
    // Recargar para mostrar la inscripción activa
    await buscar()
  } catch (e) {
    errorModal.value = e instanceof Error ? e.message : 'Error al inscribir'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-2xl font-bold">Inscripciones</h2>
    <p class="text-sm text-base-content/60">Gestión activa: <strong>{{ gestion.anio }}</strong></p>

    <!-- Buscador -->
    <div class="card bg-base-100 shadow">
      <div class="card-body flex flex-col sm:flex-row gap-3 items-end">
        <fieldset class="fieldset flex-1">
          <legend class="fieldset-legend text-xs">Buscar estudiante por nombre o CI</legend>
          <input v-model="busqueda" type="search" placeholder="Ej: Ana Condori o 12345678"
            class="input input-bordered w-full"
            @keyup.enter="buscar" />
        </fieldset>
        <button class="btn btn-primary" :disabled="buscando" @click="buscar">
          <span v-if="buscando" class="loading loading-spinner loading-sm"></span>
          Buscar
        </button>
      </div>
    </div>

    <div v-if="errorBusq" role="alert" class="alert alert-error"><span>{{ errorBusq }}</span></div>

    <!-- Resultados -->
    <div v-if="resultados.length" class="card bg-base-100 shadow overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr><th>Nombre</th><th>CI</th><th>Inscripción activa</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="e in resultados" :key="e.id" class="hover">
            <td class="font-medium">{{ e.nombre }} {{ e.apellido }}</td>
            <td class="font-mono text-sm">{{ e.ci }}</td>
            <td>
              <!-- El controller incluye la última inscripción en el array -->
              <span v-if="(e as any).inscripciones?.[0]" class="text-sm">
                {{ (e as any).inscripciones[0].curso?.nombre }}
                <span class="badge badge-xs badge-ghost ml-1">{{ (e as any).inscripciones[0].gestion?.anio }}</span>
              </span>
              <span v-else class="text-sm text-base-content/40 italic">Sin inscripción</span>
            </td>
            <td>
              <button class="btn btn-primary btn-xs" @click="abrirInscribir(e)">
                Inscribir
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="!buscando" class="text-center text-base-content/40 py-12">
      Buscá un estudiante por nombre o CI para inscribirlo
    </div>
  </div>

  <!-- Modal inscribir -->
  <dialog :open="modalAbierto" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Inscribir estudiante</h3>
      <p class="text-sm text-base-content/60 mb-4">
        {{ estudianteSelec?.nombre }} {{ estudianteSelec?.apellido }} — Gestión {{ gestion.anio }}
      </p>

      <div v-if="errorModal" role="alert" class="alert alert-error mb-4 py-2 text-sm">
        <span>{{ errorModal }}</span>
      </div>
      <div v-if="exitoMsg" role="alert" class="alert alert-success mb-4 py-2 text-sm">
        <span>{{ exitoMsg }}</span>
      </div>

      <form class="space-y-3" @submit.prevent="inscribir">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Curso *</legend>
          <select v-model="cursoId" class="select select-bordered w-full" :disabled="guardando">
            <option :value="''" disabled>Seleccioná un curso</option>
            <option v-for="c in gestion.cursos" :key="c.id" :value="c.id">
              {{ c.nombre }}
            </option>
          </select>
        </fieldset>

        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="guardando" @click="modalAbierto = false">Cerrar</button>
          <button type="submit" class="btn btn-primary" :disabled="guardando || !!exitoMsg">
            <span v-if="guardando" class="loading loading-spinner loading-sm"></span>
            Confirmar inscripción
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalAbierto = false"><button>cerrar</button></form>
  </dialog>
</template>