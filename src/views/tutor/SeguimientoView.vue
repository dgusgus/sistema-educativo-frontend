<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useGestionStore } from '@/stores/gestion.store'
import api from '@/api/axios'

const auth    = useAuthStore()
const gestion = useGestionStore()

// El tutor puede tener múltiples hijos vinculados
// GET /auth/me devuelve el perfil con los estudiantes vinculados
const estudiantes   = ref<any[]>([])
const seleccionado  = ref<number | null>(null)
const datosEstudiante = ref<any | null>(null)
const cargando      = ref(true)
const cargandoDatos = ref(false)
const error         = ref<string | null>(null)

onMounted(async () => {
  try {
    await gestion.cargar()
    // Obtener el perfil del tutor con sus estudiantes vinculados
    const { data } = await api.get('/auth/me')
    // El perfil del tutor viene en data.perfil, sus estudiantes en data.perfil.estudiantes
    // Pero el controller de tutor devuelve los vínculos desde TutorEstudiante
    // Usamos GET /tutores/:id para obtener los estudiantes vinculados
    const tutorId = data.perfil?.id
    if (tutorId) {
      const { data: tutor } = await api.get(`/tutores/${tutorId}`)
      estudiantes.value = tutor.estudiantes?.map((te: any) => te.estudiante) ?? []
      // Auto-seleccionar si hay solo uno
      if (estudiantes.value.length === 1) {
        seleccionado.value = estudiantes.value[0].id
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
  try {
    const { data } = await api.get('/calificaciones/estudiante', {
      params: { estudianteId, gestionId: gestion.gestionId },
    })
    datosEstudiante.value = Array.isArray(data) ? data : []
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

const estudianteActual = ref<any>(null)
function seleccionarEstudiante(est: any) {
  estudianteActual.value = est
  cargarDatos(est.id)
}
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-2xl font-bold">Seguimiento Académico</h2>

    <div v-if="error" role="alert" class="alert alert-error"><span>{{ error }}</span></div>

    <!-- Skeleton inicial -->
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
              @click="seleccionarEstudiante(est)"
            >
              {{ est.nombre }} {{ est.apellido }}
            </button>
          </div>
        </div>
      </div>

      <!-- Sin hijos vinculados -->
      <div v-if="estudiantes.length === 0" class="text-center text-base-content/40 py-12">
        No hay estudiantes vinculados a tu cuenta. Contactá a la secretaría.
      </div>

      <!-- Datos del estudiante seleccionado -->
      <template v-if="seleccionado">
        <div v-if="cargandoDatos" class="space-y-3">
          <div class="skeleton h-40 rounded-xl"></div>
        </div>

        <template v-else-if="datosEstudiante">
          <div v-for="insc in datosEstudiante" :key="insc.id" class="card bg-base-100 shadow">
            <div class="card-body">
              <div class="flex items-center justify-between mb-3">
                <h3 class="font-semibold">{{ insc.curso?.nombre }} — {{ insc.gestion?.anio }}</h3>
                <span class="badge" :class="insc.resultado === 'PROMOVIDO' ? 'badge-success' :
                  insc.resultado === 'REPROBADO' ? 'badge-error' : 'badge-ghost'">
                  {{ insc.resultado ?? 'EN CURSO' }}
                </span>
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
                    <tr v-for="pf in insc.promediosFinales" :key="pf.id" class="hover">
                      <td class="font-medium">{{ pf.docenteMateriaCurso?.materia?.nombre }}</td>
                      <td class="text-center" v-for="num in [1,2,3]" :key="num">
                        <span :class="claseNota(insc.calificaciones.find(
                          (c: any) => c.docenteMateriaCursoId === pf.docenteMateriaCursoId
                            && c.trimestre?.numero === num)?.nota ?? null)">
                          {{ insc.calificaciones.find(
                            (c: any) => c.docenteMateriaCursoId === pf.docenteMateriaCursoId
                              && c.trimestre?.numero === num)?.nota ?? '—' }}
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
                  </tbody>
                </table>
              </div>

              <p v-else class="text-sm text-base-content/40">Sin calificaciones finales aún</p>
            </div>
          </div>
        </template>
      </template>

    </template>
  </div>
</template>