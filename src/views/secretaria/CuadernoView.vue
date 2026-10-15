<script setup lang="ts">
// Cuaderno pedagógico: descarga en Excel de un curso y trimestre.
//
// ¿Para qué? Reemplaza el cuaderno de papel / el Excel de 56 hojas: el sistema ya tiene
// los datos (estudiantes, padres, notas por dimensión), así que el libro se genera solo.
//
// Una sola pantalla para los tres roles que pueden usarla:
//  • Director y Secretaría → todos los cursos de la gestión activa.
//  • Docente → solo los cursos donde enseña (y el Excel trae solo SUS áreas).
// El servidor vuelve a comprobar los permisos: esta lista solo evita mostrar opciones inútiles.
import { ref, computed, watch, onMounted } from 'vue'
import { cuadernoApi } from '@/api/cuaderno.api'
import { descargarBlob } from '@/api/boletin.api'
import { useAccion } from '@/composables/useAccion'
import { useAuthStore } from '@/stores/auth.store'
import { useGestionStore } from '@/stores/gestion.store'
import { useDocenteStore } from '@/stores/docente.store'
import AppIcon from '@/components/AppIcon.vue'

const auth = useAuthStore()
const gestion = useGestionStore()
const docenteStore = useDocenteStore()

const esVistaDocente = computed(() => auth.vistaEfectiva === 'DOCENTE')

onMounted(async () => {
  await gestion.cargar()
  if (esVistaDocente.value) await docenteStore.cargar()
})

// ── Opciones de curso ────────────────────────────────────────────────────────
interface OpcionCurso { id: number; nombre: string }

const NIVEL = { PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' } as const

const cursos = computed<OpcionCurso[]>(() => {
  if (!esVistaDocente.value) return gestion.cursos.map(c => ({ id: c.id, nombre: c.nombre }))

  // Docente: un curso aparece una vez aunque dicte varias áreas en él
  const vistos = new Map<number, OpcionCurso>()
  for (const a of docenteStore.asignaciones) {
    if (a.gestion.id !== gestion.gestionId) continue
    const c = a.curso
    if (!vistos.has(c.id)) vistos.set(c.id, { id: c.id, nombre: `${c.grado}° ${NIVEL[c.nivel]} "${c.paralelo}"` })
  }
  return [...vistos.values()]
})

const cursoId = ref<number | ''>('')
const trimestreId = ref<number | ''>('')

// Trimestre por defecto: el primero que todavía no se cerró (o el primero de la gestión)
watch(
  () => gestion.trimestres,
  trimestres => {
    if (trimestreId.value || trimestres.length === 0) return
    trimestreId.value = (gestion.trimestreActivo ?? trimestres[0]).id
  },
  { immediate: true },
)

// Con un solo curso disponible (caso típico del maestro de aula) ya queda elegido
watch(cursos, lista => {
  if (!cursoId.value && lista.length === 1) cursoId.value = lista[0].id
}, { immediate: true })

// ── Descarga ─────────────────────────────────────────────────────────────────
// "3° Primaria "A" (Mañana)" → "3_Primaria_A_Manana": sin tildes ni comillas, seguro como nombre de archivo
const paraArchivo = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')

const descargar = useAccion(async () => {
  const curso = cursos.value.find(c => c.id === cursoId.value)
  const trimestre = gestion.trimestres.find(t => t.id === trimestreId.value)
  if (!curso || !trimestre) return

  const blob = await cuadernoApi.descargarExcel(curso.id, trimestre.id)
  descargarBlob(blob, `cuaderno_${paraArchivo(curso.nombre)}_T${trimestre.numero}_${gestion.anio}.xlsx`)
}, { exito: 'Cuaderno descargado', errorPorDefecto: 'No se pudo generar el cuaderno' })

const descargarGestion = useAccion(async () => {
  const curso = cursos.value.find(c => c.id === cursoId.value)
  if (!curso) return
  const blob = await cuadernoApi.descargarGestionExcel(curso.id)
  descargarBlob(blob, `cuaderno_gestion_${paraArchivo(curso.nombre)}_${gestion.anio}.xlsx`)
}, { exito: 'Cuaderno de la gestión descargado', errorPorDefecto: 'No se pudo generar el cuaderno de la gestión' })

const ocupado = computed(() => descargar.ejecutando.value || descargarGestion.ejecutando.value)
const puedeDescargarGestion = computed(() => !!cursoId.value && !ocupado.value)
const puedeDescargar = computed(() => !!cursoId.value && !!trimestreId.value && !ocupado.value)
</script>

<template>
  <div class="space-y-4">
    <div>
      <h2 class="text-2xl font-bold">Cuaderno Pedagógico</h2>
      <p class="text-sm text-base-content/60">
        Descarga en Excel el cuaderno del curso con los datos que ya están en el sistema
      </p>
    </div>

    <div v-if="gestion.cargando" class="space-y-2">
      <div class="skeleton h-10 w-full"></div>
      <div class="skeleton h-24 w-full"></div>
    </div>

    <div v-else-if="!gestion.gestionId" role="alert" class="alert alert-warning text-sm">
      <span>No hay una gestión activa. Activa una gestión para generar el cuaderno.</span>
    </div>

    <template v-else>
      <section class="card bg-base-100 shadow">
        <div class="card-body space-y-4">
          <div>
            <h3 class="font-semibold text-lg">Gestión {{ gestion.anio }}</h3>
            <p class="text-sm text-base-content/60">Elige el curso y el trimestre</p>
          </div>

          <div v-if="descargar.error.value || descargarGestion.error.value" role="alert" class="alert alert-error py-2 text-sm">
            <span>{{ descargar.error.value || descargarGestion.error.value }}</span>
          </div>

          <div v-if="cursos.length === 0" role="alert" class="alert alert-info py-2 text-sm">
            <span v-if="esVistaDocente">No tienes cursos asignados en esta gestión.</span>
            <span v-else>Esta gestión todavía no tiene cursos.</span>
          </div>

          <div v-else class="flex flex-col sm:flex-row gap-3 sm:items-end">
            <fieldset class="fieldset flex-1">
              <legend class="fieldset-legend text-xs">Curso</legend>
              <select v-model="cursoId" class="select select-bordered w-full">
                <option value="" disabled>Seleccionar curso</option>
                <option v-for="c in cursos" :key="c.id" :value="c.id">{{ c.nombre }}</option>
              </select>
            </fieldset>

            <fieldset class="fieldset flex-1">
              <legend class="fieldset-legend text-xs">Trimestre</legend>
              <select v-model="trimestreId" class="select select-bordered w-full">
                <option value="" disabled>Seleccionar trimestre</option>
                <option v-for="t in gestion.trimestres" :key="t.id" :value="t.id">
                  {{ t.nombre }} {{ t.cerrado ? '🔒 Cerrado' : '(abierto)' }}
                </option>
              </select>
            </fieldset>

            <button class="btn btn-primary w-full sm:w-auto" :disabled="!puedeDescargar" @click="descargar.ejecutar()">
              <span v-if="descargar.ejecutando.value" class="loading loading-spinner loading-sm"></span>
              <AppIcon v-else nombre="descargar" class="h-4 w-4" />
              {{ descargar.ejecutando.value ? 'Generando…' : 'Descargar trimestre' }}
            </button>

            <button class="btn btn-outline btn-primary w-full sm:w-auto" :disabled="!puedeDescargarGestion" @click="descargarGestion.ejecutar()">
              <span v-if="descargarGestion.ejecutando.value" class="loading loading-spinner loading-sm"></span>
              <AppIcon v-else nombre="descargar" class="h-4 w-4" />
              {{ descargarGestion.ejecutando.value ? 'Generando…' : 'Descargar toda la gestión' }}
            </button>
          </div>
        </div>
      </section>

      <section class="card bg-base-100 shadow">
        <div class="card-body space-y-2">
          <h3 class="font-semibold">Qué trae el libro</h3>
          <ul class="text-sm text-base-content/70 list-disc pl-5 space-y-1">
            <li><strong>Carátula</strong>: colegio, curso, maestro y gestión.</li>
            <li><strong>Filiación</strong>: RUDE, estudiantes, teléfono y datos de la madre y del padre o tutor.</li>
            <li>
              <strong>Registro de valoración</strong>: una hoja por área, con las actividades de cada dimensión
              (Ser, Saber, Hacer), la autoevaluación, la nota del trimestre y las estadísticas al pie.
            </li>
          </ul>
          <p v-if="esVistaDocente" class="text-xs text-base-content/50">
            Como docente, el libro incluye solo las áreas que tú dictas en el curso.
          </p>
          <p class="text-xs text-base-content/50">
            Las notas son las del sistema: si algo no coincide con tu cuaderno, corrígelo en Calificaciones y vuelve a descargar.
          </p>
        </div>
      </section>
    </template>
  </div>
</template>
