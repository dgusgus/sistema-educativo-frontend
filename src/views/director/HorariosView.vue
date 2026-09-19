<script setup lang="ts">
/**
 * HorariosView — gestión del horario semanal por curso (Director/
 * Secretaria). Módulo que quedó diferido en el borrador de tesis;
 * esta es la implementación (HU-12, HU-13, HU-14).
 */
import { ref, computed, onMounted, watch } from 'vue'
import { horarioApi, DIAS_SEMANA, DIA_TEXTO, type HorarioDetalle, type DiaSemana } from '@/api/horario.api'
import { docenteApi } from '@/api/docente.api'
import { nombreCurso } from '@/api/estructura.api'
import { useGestionStore } from '@/stores/gestion.store'
import { useConfirm } from '@/composables/useConfirm'
import { useToastStore } from '@/stores/toast.store'

const { confirmar } = useConfirm()
const toast   = useToastStore()
const gestion = useGestionStore()

// ─── Asignaciones (docente+materia por curso) — para el selector del modal ──
interface AsignacionOpcion {
  id:            number   // docenteMateriaCursoId
  cursoId:       number
  materiaNombre: string
  docenteNombre: string
}
const asignaciones = ref<AsignacionOpcion[]>([])

async function cargarAsignaciones() {
  const docentes = await docenteApi.getAll()
  asignaciones.value = docentes.flatMap(d =>
    (d.asignaciones ?? []).map((a: any) => ({
      id:            a.id,
      cursoId:       a.curso.id,
      materiaNombre: a.materia.nombre,
      docenteNombre: `${d.nombre} ${d.apellido}`,
    }))
  )
}

// ─── Curso seleccionado + su horario ────────────────────────────────────────
const cursoSeleccionadoId = ref<number | null>(null)
const horarios  = ref<HorarioDetalle[]>([])
const cargando  = ref(false)
const error     = ref<string | null>(null)

const asignacionesDelCurso = computed(() =>
  asignaciones.value.filter(a => a.cursoId === cursoSeleccionadoId.value)
)

// Agrupado por día para pintar la tabla en el orden de la semana
const horarioPorDia = computed(() => {
  const mapa = new Map<DiaSemana, HorarioDetalle[]>()
  for (const dia of DIAS_SEMANA) mapa.set(dia, [])
  for (const h of horarios.value) mapa.get(h.diaSemana)?.push(h)
  return mapa
})

async function cargarHorario() {
  if (!cursoSeleccionadoId.value) { horarios.value = []; return }
  cargando.value = true
  error.value = null
  try {
    horarios.value = await horarioApi.getByCurso(cursoSeleccionadoId.value, gestion.gestionId ?? undefined)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar el horario'
  } finally {
    cargando.value = false
  }
}

watch(cursoSeleccionadoId, cargarHorario)

onMounted(async () => {
  await gestion.cargar()
  await cargarAsignaciones()
  if (gestion.cursos.length > 0) cursoSeleccionadoId.value = gestion.cursos[0].id
})

// ─── Modal crear/editar ──────────────────────────────────────────────────────
const modalAbierto = ref(false)
const guardando    = ref(false)
const errorModal   = ref<string | null>(null)
const modoEdicion  = ref(false)
const idEditando   = ref<number | null>(null)

const form = ref<{ docenteMateriaCursoId: number | ''; diaSemana: DiaSemana; horaInicio: string; horaFin: string; aula: string }>({
  docenteMateriaCursoId: '', diaSemana: 'LUNES', horaInicio: '08:00', horaFin: '08:45', aula: '',
})

function abrirCrear() {
  modoEdicion.value = false
  idEditando.value  = null
  errorModal.value  = null
  form.value = { docenteMateriaCursoId: '', diaSemana: 'LUNES', horaInicio: '08:00', horaFin: '08:45', aula: '' }
  modalAbierto.value = true
}

function abrirEditar(h: HorarioDetalle) {
  modoEdicion.value = true
  idEditando.value  = h.id
  errorModal.value  = null
  form.value = {
    docenteMateriaCursoId: h.docenteMateriaCursoId,
    diaSemana:  h.diaSemana,
    horaInicio: h.horaInicio,
    horaFin:    h.horaFin,
    aula:       h.aula ?? '',
  }
  modalAbierto.value = true
}

async function guardar() {
  const f = form.value
  if (!f.docenteMateriaCursoId) { errorModal.value = 'Selecciona la materia/docente'; return }
  if (!f.horaInicio || !f.horaFin) { errorModal.value = 'Hora de inicio y fin son obligatorias'; return }

  guardando.value  = true
  errorModal.value = null
  try {
    if (modoEdicion.value && idEditando.value) {
      const actualizado = await horarioApi.update(idEditando.value, {
        diaSemana:  f.diaSemana,
        horaInicio: f.horaInicio,
        horaFin:    f.horaFin,
        aula:       f.aula || undefined,
      })
      const idx = horarios.value.findIndex(h => h.id === idEditando.value)
      if (idx !== -1) horarios.value[idx] = actualizado
    } else {
      const nuevo = await horarioApi.create({
        docenteMateriaCursoId: Number(f.docenteMateriaCursoId),
        diaSemana:  f.diaSemana,
        horaInicio: f.horaInicio,
        horaFin:    f.horaFin,
        aula:       f.aula || undefined,
      })
      horarios.value.push(nuevo)
    }
    modalAbierto.value = false
    toast.success(`Bloque ${modoEdicion.value ? 'actualizado' : 'creado'}`)
  } catch (e) {
    // Acá llega tal cual el mensaje de conflicto armado en el backend
    // ("Conflicto de horario (docente): El docente ... ya tiene ...")
    errorModal.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    guardando.value = false
  }
}

async function eliminar(h: HorarioDetalle) {
  const ok = await confirmar({
    titulo: 'Eliminar bloque de horario',
    mensaje: `¿Eliminar ${DIA_TEXTO[h.diaSemana]} ${h.horaInicio}–${h.horaFin} (${h.materia.nombre})?`,
    peligroso: true,
  })
  if (!ok) return
  try {
    await horarioApi.delete(h.id)
    horarios.value = horarios.value.filter(x => x.id !== h.id)
    toast.success('Bloque eliminado')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Error al eliminar')
  }
}
</script>

<template>
  <div class="p-4 md:p-6 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-bold">Horarios</h1>
      <div class="flex items-center gap-2">
        <select v-model.number="cursoSeleccionadoId" class="select select-bordered select-sm">
          <option v-for="c in gestion.cursos" :key="c.id" :value="c.id">{{ c.nombre }}</option>
        </select>
        <button class="btn btn-primary btn-sm" :disabled="!cursoSeleccionadoId" @click="abrirCrear">
          + Agregar bloque
        </button>
      </div>
    </div>

    <div v-if="error" role="alert" class="alert alert-error py-2 text-sm">
      <span>{{ error }}</span>
    </div>

    <div v-if="!cursoSeleccionadoId" class="text-center text-base-content/40 py-12">
      No hay cursos en la gestión activa.
    </div>

    <div v-else class="card bg-base-100 shadow overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            <th class="w-28">Día</th>
            <th>Hora</th>
            <th>Materia</th>
            <th>Docente</th>
            <th>Aula</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cargando" v-for="i in 4" :key="i">
            <td colspan="6"><div class="skeleton h-4 w-full"></div></td>
          </tr>
          <tr v-else-if="horarios.length === 0">
            <td colspan="6" class="text-center text-base-content/40 py-8">
              Este curso todavía no tiene bloques de horario cargados.
            </td>
          </tr>
          <template v-else v-for="dia in DIAS_SEMANA" :key="dia">
            <tr v-for="(h, i) in horarioPorDia.get(dia)" :key="h.id" class="hover">
              <td class="font-medium">{{ i === 0 ? DIA_TEXTO[dia] : '' }}</td>
              <td class="font-mono text-sm">{{ h.horaInicio }}–{{ h.horaFin }}</td>
              <td>{{ h.materia.nombre }}</td>
              <td>{{ h.docente.nombre }} {{ h.docente.apellido }}</td>
              <td>{{ h.aula ?? '—' }}</td>
              <td>
                <div class="flex gap-1">
                  <button class="btn btn-ghost btn-xs" @click="abrirEditar(h)">Editar</button>
                  <button class="btn btn-ghost btn-xs text-error" @click="eliminar(h)">Eliminar</button>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ── Modal crear/editar ─────────────────────────────────────────────────── -->
  <dialog :open="modalAbierto" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">{{ modoEdicion ? 'Editar' : 'Nuevo' }} bloque de horario</h3>

      <div v-if="errorModal" role="alert" class="alert alert-error mb-4 py-2 text-sm">
        <span>{{ errorModal }}</span>
      </div>

      <form class="space-y-3" @submit.prevent="guardar">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Materia / Docente *</legend>
          <select v-model.number="form.docenteMateriaCursoId" class="select select-bordered w-full" :disabled="guardando || modoEdicion">
            <option value="" disabled>Seleccionar</option>
            <option v-for="a in asignacionesDelCurso" :key="a.id" :value="a.id">
              {{ a.materiaNombre }} — {{ a.docenteNombre }}
            </option>
          </select>
          <p v-if="modoEdicion" class="text-xs text-base-content/40 mt-1">
            No editable — elimina el bloque y crea uno nuevo si cambia la materia/docente.
          </p>
          <p v-else-if="asignacionesDelCurso.length === 0" class="text-xs text-warning mt-1">
            Este curso todavía no tiene materias asignadas a un docente.
          </p>
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Día *</legend>
          <select v-model="form.diaSemana" class="select select-bordered w-full" :disabled="guardando">
            <option v-for="d in DIAS_SEMANA" :key="d" :value="d">{{ DIA_TEXTO[d] }}</option>
          </select>
        </fieldset>

        <div class="grid grid-cols-2 gap-3">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Hora inicio *</legend>
            <input v-model="form.horaInicio" type="time" class="input input-bordered w-full" :disabled="guardando" />
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Hora fin *</legend>
            <input v-model="form.horaFin" type="time" class="input input-bordered w-full" :disabled="guardando" />
          </fieldset>
        </div>

        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Aula (opcional)</legend>
          <input v-model="form.aula" type="text" placeholder="Ej: Aula 12" class="input input-bordered w-full" :disabled="guardando" />
        </fieldset>

        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="guardando" @click="modalAbierto = false">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="guardando">
            <span v-if="guardando" class="loading loading-spinner loading-sm"></span>
            {{ modoEdicion ? 'Guardar cambios' : 'Crear' }}
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalAbierto = false"><button>cerrar</button></form>
  </dialog>
</template>