<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGestionStore } from '@/stores/gestion.store'
import { calificacionApi } from '@/api/calificacion.api'
import api from '@/api/axios'
import type { Nivel, ResultadoFinal } from '@/types'
import { horarioApi, type HorarioDetalle } from '@/api/horario.api'
import HorarioSemanal from '@/components/HorarioSemanal.vue'
import ResumenAsistencia from '@/components/ResumenAsistencia.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const gestion = useGestionStore()
const horarioEstudiante = ref<HorarioDetalle[]>([])
// ─── Tipos locales ────────────────────────────────────────────────────────────
// No existe un tutor.api.ts dedicado todavía — se consulta directo con
// tipos locales en vez de "any" para no perder seguridad de tipos.
interface EstudianteVinculado {
  id: number
  nombre: string
  apellido: string
  ci: string
}

// Refleja GET /calificaciones/estudiante (mismo shape que MiPerfilView.vue)
interface CalificacionItem {
  id: number
  promedioTrimestral: number | null   // ✅ antes "nota" — ya no existe
  docenteMateriaCursoId: number
  docenteMateriaCurso: { materia: { nombre: string } }
  trimestre: { numero: number; nombre: string }
}
interface PromedioFinalItem {
  docenteMateriaCursoId: number
  promedioFinal: number
  resultado: ResultadoFinal   // ✅ antes "aprobado" (boolean) — ya no existe
  docenteMateriaCurso: { materia: { nombre: string } }
}
interface InscripcionConNotas {
  id: number
  resultado: ResultadoFinal
  // ⚠️ el curso acá no trae "nombre" calculado — solo nivel/grado/paralelo
  curso:  { nivel: Nivel; grado: number; paralelo: string }
  gestion: { anio: number }
  calificaciones:   CalificacionItem[]
  promediosFinales: PromedioFinalItem[]
}

const estudiantes     = ref<EstudianteVinculado[]>([])
const seleccionado    = ref<number | null>(null)
const datosEstudiante = ref<InscripcionConNotas[] | null>(null)
const cargando        = ref(true)
const cargandoDatos   = ref(false)
const error           = ref<string | null>(null)

onMounted(async () => {
  try {
    await gestion.cargar()
    // GET /auth/me trae el perfil del tutor (id) — de ahí sacamos sus
    // estudiantes vinculados con GET /tutores/:id
    const { data } = await api.get<{ perfil: { id: number } | null }>('/auth/me')
    const tutorId = data.perfil?.id
    if (tutorId) {
      const { data: tutor } = await api.get<{
        estudiantes: Array<{ estudiante: EstudianteVinculado }>
      }>(`/tutores/${tutorId}`)
      estudiantes.value = tutor.estudiantes?.map(te => te.estudiante) ?? []
      if (estudiantes.value.length === 1) {
        await cargarDatos(estudiantes.value[0].id)
      }
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar datos'
  } finally {
    cargando.value = false
  }
})

async function cargarDatos(estudianteId: number) {
  seleccionado.value = estudianteId
  cargandoDatos.value = true
  error.value = null
  datosEstudiante.value = null
  horarioEstudiante.value = []
  try {
    if (!gestion.gestionId) throw new Error('No hay gestión activa')
    const [data, horario] = await Promise.all([
      calificacionApi.getDeEstudiante({ estudianteId, gestionId: gestion.gestionId }),
      horarioApi.getPropio(estudianteId),
    ])
    datosEstudiante.value = Array.isArray(data) ? data as InscripcionConNotas[] : []
    horarioEstudiante.value = horario
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar datos del estudiante'
  } finally {
    cargandoDatos.value = false
  }
}

function claseNota(nota: number | null): string {
  if (nota === null || nota === undefined) return 'text-base-content/40'
  if (nota >= 71) return 'text-success font-bold'
  if (nota >= 51) return 'text-warning font-bold'
  return 'text-error font-bold'
}

function notaDelTrimestre(insc: InscripcionConNotas, dmcId: number, numero: number): number | null {
  return insc.calificaciones.find(c => c.docenteMateriaCursoId === dmcId && c.trimestre?.numero === numero)
    ?.promedioTrimestral ?? null
}

const NIVEL_TEXTO: Record<Nivel, string> = { PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
function nombreCursoCorto(c: { nivel: Nivel; grado: number; paralelo: string }): string {
  return `${c.grado}° ${NIVEL_TEXTO[c.nivel]} "${c.paralelo}"`
}
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-2xl font-bold">Seguimiento Académico</h2>

    <div v-if="error" role="alert" class="alert alert-error"><span>{{ error }}</span></div>

    <div v-if="cargando" class="skeleton h-20 rounded-xl"></div>

    <template v-else>
      <!-- Selector de hijo (si tiene más de uno) -->
      <div v-if="estudiantes.length > 1" class="card bg-base-100 shadow">
        <div class="card-body">
          <p class="text-sm font-medium mb-2">Seleccioná un estudiante:</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="est in estudiantes"
              :key="est.id"
              class="btn btn-sm"
              :class="seleccionado === est.id ? 'btn-primary' : 'btn-ghost'"
              @click="cargarDatos(est.id)"
            >
              {{ est.nombre }} {{ est.apellido }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="estudiantes.length === 0" class="text-center text-base-content/40 py-12">
        No hay estudiantes vinculados a tu cuenta. Contactá a la secretaría.
      </div>

      <template v-if="seleccionado">
        <div v-if="cargandoDatos" class="space-y-3">
          <div class="skeleton h-40 rounded-xl"></div>
        </div>
<!-- agregar dentro de <template v-if="seleccionado"> ..., antes de v-else-if="datosEstudiante" o después de cerrar ese bloque, al mismo nivel -->
<div v-if="!cargandoDatos" class="card bg-base-100 shadow">
  <div class="card-body">
    <h3 class="font-semibold mb-2">Horario</h3>
    <HorarioSemanal :horarios="horarioEstudiante" :cargando="cargandoDatos" columna-extra="docente" />
  </div>
</div>
        <!-- v-if (no v-else-if): el bloque de notas debe mostrarse JUNTO al
             horario cuando termina de cargar — con v-else-if nunca se
             renderizaba porque el div del horario ya consumía la rama -->
        <template v-if="!cargandoDatos && datosEstudiante">
          <div v-for="insc in datosEstudiante" :key="insc.id" class="card bg-base-100 shadow">
            <div class="card-body">
              <div class="flex items-center justify-between mb-3">
                <h3 class="font-semibold">{{ nombreCursoCorto(insc.curso) }} — {{ insc.gestion?.anio }}</h3>
                <StatusBadge :estado="insc.resultado" :texto="insc.resultado === 'PENDIENTE' ? 'EN CURSO' : insc.resultado" />
              </div>

              <div v-if="insc.promediosFinales?.length" class="overflow-x-auto">
                <table class="table table-sm">
                  <thead>
                    <tr>
                      <th>Materia</th>
                      <th class="text-center">T1</th>
                      <th class="text-center">T2</th>
                      <th class="text-center">T3</th>
                      <th class="text-center">Promedio</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="pf in insc.promediosFinales" :key="pf.docenteMateriaCursoId" class="hover">
                      <td class="font-medium">{{ pf.docenteMateriaCurso.materia.nombre }}</td>
                      <td class="text-center" v-for="num in [1,2,3]" :key="num">
                        <span :class="claseNota(notaDelTrimestre(insc, pf.docenteMateriaCursoId, num))">
                          {{ notaDelTrimestre(insc, pf.docenteMateriaCursoId, num) ?? '—' }}
                        </span>
                      </td>
                      <td class="text-center">
                        <span :class="claseNota(pf.promedioFinal)">
                          {{ pf.promedioFinal?.toFixed(1) ?? '—' }}
                        </span>
                        <span class="ml-1 text-xs" :class="pf.resultado === 'PROMOVIDO' ? 'text-success' : 'text-error'">
                          {{ pf.resultado === 'PROMOVIDO' ? '✓' : '✗' }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p v-else class="text-sm text-base-content/40">Sin calificaciones finales aún</p>

              <ResumenAsistencia :inscripcion-id="insc.id" />
            </div>
          </div>
        </template>
      </template>

    </template>
  </div>
</template>