<script setup lang="ts">
import { ref } from 'vue'
import { cursoApi, nombreCurso } from '@/api/estructura.api'
import type { Curso, Nivel } from '@/types'

// Explorador por curso: estudiantes + profesor tutor + materias con sus
// docentes, con accesos directos a Boletines y Asistencia del curso.
// Los links pasan ?cursoId= para que esas vistas lleguen preseleccionadas.
const props = defineProps<{ cursos: Curso[] }>()

const NIVEL_TEXTO: Record<Nivel, string> = { PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }

const cursoId = ref<number | ''>('')
const detalle = ref<Awaited<ReturnType<typeof cursoApi.getById>> | null>(null)
const cargando = ref(false)
const error = ref<string | null>(null)

async function verCurso() {
  if (!cursoId.value) return
  cargando.value = true
  error.value = null
  detalle.value = null
  try {
    detalle.value = await cursoApi.getById(Number(cursoId.value))
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar el curso'
  } finally {
    cargando.value = false
  }
}

function nombreCorto(c: Curso): string {
  return nombreCurso(c)
}
</script>

<template>
  <div class="card bg-base-100 shadow">
    <div class="card-body space-y-4">
      <h3 class="font-semibold">Explorar curso</h3>

      <div class="flex flex-col sm:flex-row gap-3 sm:items-end">
        <fieldset class="fieldset flex-1">
          <legend class="fieldset-legend text-xs">Curso</legend>
          <select v-model="cursoId" class="select select-bordered w-full" @change="verCurso">
            <option value="" disabled>Seleccionar curso</option>
            <option v-for="c in cursos" :key="c.id" :value="c.id">{{ nombreCorto(c) }}</option>
          </select>
        </fieldset>
      </div>

      <div v-if="error" role="alert" class="alert alert-error py-2 text-sm"><span>{{ error }}</span></div>
      <div v-if="cargando" class="space-y-2">
        <div class="skeleton h-6 w-full"></div>
        <div class="skeleton h-16 w-full"></div>
      </div>

      <div v-if="detalle" class="space-y-3">
        <!-- Profesor tutor + accesos -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-2 rounded-box bg-base-200/60 border border-base-300 px-3 py-2">
          <p class="text-sm flex-1">
            <span class="text-base-content/50">Profesor tutor:</span>
            <strong class="ml-1">{{ detalle.tutorDocente ? `${detalle.tutorDocente.nombre} ${detalle.tutorDocente.apellido}` : 'Sin asignar' }}</strong>
          </p>
          <div class="flex gap-2">
            <router-link :to="{ name: 'secretaria-boletines' }" class="btn btn-xs btn-outline btn-primary">Boletines</router-link>
            <router-link :to="{ name: 'secretaria-asistencia', query: { cursoId: String(detalle.id) } }" class="btn btn-xs btn-outline btn-info">Asistencia</router-link>
          </div>
        </div>

        <!-- Estudiantes -->
        <div>
          <p class="text-xs font-semibold text-base-content/60 mb-1">
            Estudiantes ({{ detalle.inscripciones.length }})
          </p>
          <ul v-if="detalle.inscripciones.length" class="divide-y divide-base-200 rounded-box border border-base-200 max-h-64 overflow-y-auto">
            <li v-for="i in detalle.inscripciones" :key="i.id" class="px-3 py-1.5 text-sm flex justify-between gap-2">
              <span class="truncate">{{ i.estudiante.apellido }}, {{ i.estudiante.nombre }}</span>
              <span class="badge badge-xs badge-ghost shrink-0">{{ i.estadoInscripcion }}</span>
            </li>
          </ul>
          <p v-else class="text-xs text-warning bg-warning/10 rounded-box px-3 py-2">
            Curso sin inscritos — podés inscribir desde Estudiantes.
          </p>
        </div>

        <!-- Materias y docentes -->
        <div v-if="detalle.asignaciones.length">
          <p class="text-xs font-semibold text-base-content/60 mb-1">Materias y docentes</p>
          <div class="flex flex-wrap gap-1.5">
            <span v-for="a in detalle.asignaciones" :key="a.id" class="badge badge-sm badge-ghost font-normal"
              :title="`${a.materia.nombre} — ${a.docente.nombre} ${a.docente.apellido}`">
              {{ a.materia.nombre }}: <strong class="ml-1">{{ a.docente.nombre }} {{ a.docente.apellido }}</strong>
            </span>
          </div>
        </div>
        <p class="text-xs text-base-content/50">
          {{ NIVEL_TEXTO[detalle.nivel as Nivel] }} · Turno {{ detalle.turno }} · {{ detalle.asignaciones.length }} materias
        </p>
      </div>
    </div>
  </div>
</template>
