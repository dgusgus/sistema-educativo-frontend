<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useGestionStore } from '@/stores/gestion.store'
import api from '@/api/axios'

const auth    = useAuthStore()
const gestion = useGestionStore()

// El backend detecta el estudianteId desde el token JWT cuando rol=ESTUDIANTE
// Solo necesitamos pasar gestionId
const inscripciones = ref<any[]>([])
const cargando      = ref(true)
const error         = ref<string | null>(null)

onMounted(async () => {
  try {
    await gestion.cargar()
    if (!gestion.gestionId) throw new Error('No hay gestión activa')

    const { data } = await api.get('/calificaciones/estudiante', {
      params: { gestionId: gestion.gestionId },
    })
    inscripciones.value = Array.isArray(data) ? data : []
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

    <!-- Error -->
    <div v-if="error" role="alert" class="alert alert-error"><span>{{ error }}</span></div>

    <!-- Skeleton -->
    <div v-if="cargando" class="space-y-3">
      <div class="skeleton h-40 rounded-xl"></div>
      <div class="skeleton h-40 rounded-xl"></div>
    </div>

    <!-- Notas por inscripción -->
    <template v-else-if="inscripciones.length">
      <div v-for="insc in inscripciones" :key="insc.id" class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold">{{ insc.curso?.nombre }} — {{ insc.gestion?.anio }}</h3>
            <span class="badge" :class="insc.resultado === 'PROMOVIDO' ? 'badge-success' :
              insc.resultado === 'REPROBADO' ? 'badge-error' : 'badge-ghost'">
              {{ insc.resultado ?? 'EN CURSO' }}
            </span>
          </div>

          <!-- Calificaciones agrupadas por materia y trimestre -->
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
                <!-- Agrupar calificaciones por materia -->
                <tr v-for="pf in insc.promediosFinales" :key="pf.id" class="hover">
                  <td class="font-medium">{{ pf.docenteMateriaCurso?.materia?.nombre }}</td>
                  <td class="text-center">
                    <span :class="claseNota(insc.calificaciones.find(
                      (c: any) => c.docenteMateriaCursoId === pf.docenteMateriaCursoId
                        && c.trimestre?.numero === 1)?.nota ?? null)">
                      {{ insc.calificaciones.find(
                        (c: any) => c.docenteMateriaCursoId === pf.docenteMateriaCursoId
                          && c.trimestre?.numero === 1)?.nota ?? '—' }}
                    </span>
                  </td>
                  <td class="text-center">
                    <span :class="claseNota(insc.calificaciones.find(
                      (c: any) => c.docenteMateriaCursoId === pf.docenteMateriaCursoId
                        && c.trimestre?.numero === 2)?.nota ?? null)">
                      {{ insc.calificaciones.find(
                        (c: any) => c.docenteMateriaCursoId === pf.docenteMateriaCursoId
                          && c.trimestre?.numero === 2)?.nota ?? '—' }}
                    </span>
                  </td>
                  <td class="text-center">
                    <span :class="claseNota(insc.calificaciones.find(
                      (c: any) => c.docenteMateriaCursoId === pf.docenteMateriaCursoId
                        && c.trimestre?.numero === 3)?.nota ?? null)">
                      {{ insc.calificaciones.find(
                        (c: any) => c.docenteMateriaCursoId === pf.docenteMateriaCursoId
                          && c.trimestre?.numero === 3)?.nota ?? '—' }}
                    </span>
                  </td>
                  <td class="text-center">
                    <span :class="claseNota(pf.promedioFinal)">
                      {{ pf.promedioFinal?.toFixed(1) ?? '—' }}
                    </span>
                    <span v-if="pf.promedioFinal !== null" class="ml-1 text-xs"
                      :class="pf.aprobado ? 'text-success' : 'text-error'">
                      {{ pf.aprobado ? '✓' : '✗' }}
                    </span>
                  </td>
                </tr>

                <!-- Si no hay promedios finales aún, mostrar lo que hay -->
                <template v-if="!insc.promediosFinales?.length">
                  <tr v-for="cal in insc.calificaciones" :key="cal.id" class="hover">
                    <td>{{ cal.docenteMateriaCurso?.materia?.nombre }}</td>
                    <td class="text-center" colspan="3">
                      T{{ cal.trimestre?.numero }}: <span :class="claseNota(cal.nota)">{{ cal.nota }}</span>
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
