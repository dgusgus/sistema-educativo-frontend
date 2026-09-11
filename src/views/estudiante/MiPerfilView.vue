<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useGestionStore } from '@/stores/gestion.store'
import { calificacionApi } from '@/api/calificacion.api'
import type { Nivel, ResultadoFinal } from '@/types'

const auth    = useAuthStore()
const gestion = useGestionStore()

// Refleja GET /calificaciones/estudiante (calificacion.controller.ts)
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

const inscripciones = ref<InscripcionConNotas[]>([])
const cargando      = ref(true)
const error         = ref<string | null>(null)

onMounted(async () => {
  try {
    await gestion.cargar()
    if (!gestion.gestionId) throw new Error('No hay gestión activa')

    // El backend resuelve el estudianteId desde el token cuando el rol
    // es ESTUDIANTE — no hace falta pasarlo.
    const data = await calificacionApi.getDeEstudiante({ gestionId: gestion.gestionId })
    inscripciones.value = Array.isArray(data) ? data as InscripcionConNotas[] : []
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar datos'
  } finally {
    cargando.value = false
  }
})

// Color según nota (Ley 070: aprobado ≥ 51)
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

    <!-- Encabezado del perfil -->
    <div class="card bg-base-100 shadow">
      <div class="card-body flex flex-row items-center gap-4">
        <div class="avatar placeholder">
          <div class="bg-primary text-primary-content rounded-full w-14">
            <span class="text-xl">{{ auth.usuario?.nombre?.charAt(0) ?? '?' }}</span>
          </div>
        </div>
        <div>
          <h2 class="text-xl font-bold">{{ auth.usuario?.nombre }}</h2>
          <p class="text-sm text-base-content/60">Estudiante — Gestión {{ gestion.anio }}</p>
        </div>
      </div>
    </div>

    <div v-if="error" role="alert" class="alert alert-error"><span>{{ error }}</span></div>

    <div v-if="cargando" class="space-y-3">
      <div class="skeleton h-40 rounded-xl"></div>
      <div class="skeleton h-40 rounded-xl"></div>
    </div>

    <!-- Notas por inscripción -->
    <template v-else-if="inscripciones.length">
      <div v-for="insc in inscripciones" :key="insc.id" class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold">{{ nombreCursoCorto(insc.curso) }} — {{ insc.gestion?.anio }}</h3>
            <span class="badge" :class="insc.resultado === 'PROMOVIDO' ? 'badge-success' :
              insc.resultado === 'REPROBADO' ? 'badge-error' : 'badge-ghost'">
              {{ insc.resultado === 'PENDIENTE' ? 'EN CURSO' : insc.resultado }}
            </span>
          </div>

          <div v-if="insc.calificaciones?.length" class="overflow-x-auto">
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
                  <td class="text-center">
                    <span :class="claseNota(notaDelTrimestre(insc, pf.docenteMateriaCursoId, 1))">
                      {{ notaDelTrimestre(insc, pf.docenteMateriaCursoId, 1) ?? '—' }}
                    </span>
                  </td>
                  <td class="text-center">
                    <span :class="claseNota(notaDelTrimestre(insc, pf.docenteMateriaCursoId, 2))">
                      {{ notaDelTrimestre(insc, pf.docenteMateriaCursoId, 2) ?? '—' }}
                    </span>
                  </td>
                  <td class="text-center">
                    <span :class="claseNota(notaDelTrimestre(insc, pf.docenteMateriaCursoId, 3))">
                      {{ notaDelTrimestre(insc, pf.docenteMateriaCursoId, 3) ?? '—' }}
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

                <!-- Sin promedios finales todavía (año en curso) — mostrar lo que hay -->
                <template v-if="!insc.promediosFinales?.length">
                  <tr v-for="cal in insc.calificaciones" :key="cal.id" class="hover">
                    <td>{{ cal.docenteMateriaCurso.materia.nombre }}</td>
                    <td class="text-center" colspan="3">
                      T{{ cal.trimestre?.numero }}:
                      <span :class="claseNota(cal.promedioTrimestral)">{{ cal.promedioTrimestral ?? 'S/N' }}</span>
                    </td>
                    <td class="text-center text-base-content/40">—</td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <p v-else class="text-sm text-base-content/40 mt-2">Sin calificaciones registradas aún</p>
        </div>
      </div>
    </template>

    <div v-else-if="!cargando" class="text-center text-base-content/40 py-12">
      No hay calificaciones registradas para esta gestión
    </div>

  </div>
</template>