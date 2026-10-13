<script setup lang="ts">
/**
 * GestionesView — ¿Para qué existe esta vista?
 *
 * Una "gestión" en este sistema es un año escolar completo (ej: 2025).
 * Es el contenedor de TODO: cursos, trimestres, inscripciones, pagos.
 * Sin una gestión activa, ningún otro módulo funciona.
 *
 * ¿Por qué el Director necesita ver el historial de gestiones?
 * Porque a veces necesita consultar datos de años anteriores:
 * cuántos estudiantes había, qué director estuvo a cargo, etc.
 * El sistema guarda todo el historial — nunca se borra una gestión cerrada.
 *
 * ¿Por qué "asignar director" es una acción separada de "crear gestión"?
 * Porque puede que al crear la gestión 2026 todavía no sepan quién va
 * a ser el director — lo definen semanas después. Separar las acciones
 * permite crear la gestión primero y asignar el director cuando corresponda.
 */
import { ref, computed, onMounted } from 'vue'
import { gestionApi, type GestionResumen, type ResultadoCopia } from '@/api/gestion.api'
import { useGestionStore } from '@/stores/gestion.store'
import { useCatalogoStore } from '@/stores/catalogo.store'
import { directorApi } from '@/api/director.api'
import { useConfirm } from '@/composables/useConfirm'
import { useToastStore } from '@/stores/toast.store'
import StatusBadge from '@/components/StatusBadge.vue'
import GestionCrearModal from '@/components/gestiones/GestionCrearModal.vue'
import GestionCopiarModal from '@/components/gestiones/GestionCopiarModal.vue'
import GestionDirectorModal, { type DirectorOpcion } from '@/components/gestiones/GestionDirectorModal.vue'
import GestionEditarModal from '@/components/gestiones/GestionEditarModal.vue'

const { confirmar } = useConfirm()
const toast = useToastStore()
const gestionStore = useGestionStore()
const catalogo = useCatalogoStore()

// ─── Estado principal ─────────────────────────────────────────────────────────
const gestiones = ref<GestionResumen[]>([])
const cargando  = ref(true)
const error     = ref<string | null>(null)
// Resumen de la última copia de estructura (al crear o con "Copiar estructura")
const resultadoCopia = ref<ResultadoCopia | null>(null)

// Directores del sistema (no solo el activo): cualquiera puede asignarse a cualquier gestión.
const directores  = ref<DirectorOpcion[]>([])
const cargandoDir = ref(false)

onMounted(async () => {
  await Promise.all([cargar(), cargarDirectores()])
})

async function cargar() {
  cargando.value = true
  error.value    = null
  try {
    gestiones.value = [...(await catalogo.gestiones(true))]
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar gestiones'
  } finally {
    cargando.value = false
  }
}

async function cargarDirectores() {
  cargandoDir.value = true
  try {
    directores.value = await directorApi.getAll() as DirectorOpcion[]
  } catch {
    // No es crítico: el Director puede reintentar abriendo el modal de nuevo.
    directores.value = []
  } finally {
    cargandoDir.value = false
  }
}

// ─── Modales: uno abierto a la vez ────────────────────────────────────────────
type Modal = 'crear' | 'copiar' | 'director' | 'editar' | null
const modal = ref<Modal>(null)
const seleccionadaId = ref<number | null>(null)
const seleccionada = computed(() => gestiones.value.find(g => g.id === seleccionadaId.value) ?? null)

function abrir(m: Exclude<Modal, null>, g?: GestionResumen) {
  if (m === 'crear') resultadoCopia.value = null
  seleccionadaId.value = g?.id ?? null
  modal.value = m
}
const cerrar = () => { modal.value = null }

// ─── Reacciones a lo que hacen los modales ────────────────────────────────────
async function alCrear(p: { anio: number; copia: ResultadoCopia | null }) {
  resultadoCopia.value = p.copia
  await cargar()   // refresca la tabla con los conteos reales (cursos, inscritos)
  toast.success(`Gestión ${p.anio} creada`)
}

async function alCopiar(p: { destinoAnio: number; resultado: ResultadoCopia }) {
  resultadoCopia.value = p.resultado
  toast.success(`Estructura copiada a la gestión ${p.destinoAnio}`)
  await cargar()
}

// Se actualiza la fila en memoria (sabemos exactamente qué cambió) en vez de recargar la lista.
async function alAsignarDirector(p: { gestionId: number; director: { id: number; nombre: string; apellido: string } }) {
  const g = gestiones.value.find(x => x.id === p.gestionId)
  if (!g) return
  g.director = p.director
  // Si es la activa, se recarga el store para que el nombre se actualice en el sidebar/dashboard.
  if (g.activa) await gestionStore.recargar()
}

async function alEditar(p: { id: number; anio: number; activa: boolean; descripcion: string | null; notaMinimaAprobacion: number }) {
  const g = gestiones.value.find(x => x.id === p.id)
  if (g) { g.descripcion = p.descripcion; g.notaMinimaAprobacion = p.notaMinimaAprobacion }
  if (p.activa) await gestionStore.recargar()
  toast.success(`Gestión ${p.anio} actualizada`)
}

// ─── Activar gestión ──────────────────────────────────────────────────────────
// Pone activa=true en esta gestión y false en TODAS las demás (solo una activa a la vez).
// Pide confirmación porque afecta a todo el sistema: todos los módulos pasan a usar
// los cursos y trimestres de la nueva gestión.
const activando = ref<number | null>(null)

async function activar(g: GestionResumen) {
  if (g.activa) return
  const ok = await confirmar({
    mensaje: `¿Activar la gestión ${g.anio}? Esto desactivará la gestión actual y todos los módulos usarán los datos de ${g.anio}.`,
    peligroso: true,
  })
  if (!ok) return

  activando.value = g.id
  error.value     = null
  try {
    await gestionApi.activar(g.id)
    catalogo.invalidar('gestiones')
    gestiones.value.forEach(x => { x.activa = x.id === g.id })
    // gestionStore.gestion es lo que usa TODO el sistema (Asistencia, Calificaciones...):
    // si no se recarga, esos módulos seguirían viendo la gestión anterior.
    await gestionStore.recargar()
    toast.success(`Gestión ${g.anio} activada`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al activar gestión'
  } finally {
    activando.value = null
  }
}

// ─── Cerrar gestión ───────────────────────────────────────────────────────────
// Requiere trimestres cerrados y resultados registrados — el backend devuelve el
// detalle si algo falta y se muestra tal cual.
const cerrandoGestion = ref<number | null>(null)

async function cerrarGestion(g: GestionResumen) {
  if (!g.activa) return
  const ok = await confirmar({
    mensaje: `¿Cerrar la gestión ${g.anio}? Ya no será la activa y no se podrá registrar nada más en ella.`,
    peligroso: true,
    textoConfirmar: 'Cerrar gestión',
  })
  if (!ok) return
  cerrandoGestion.value = g.id
  error.value = null
  try {
    await gestionApi.cerrar(g.id)
    catalogo.invalidar('gestiones')
    g.activa = false
    await gestionStore.recargar()
    toast.success(`Gestión ${g.anio} cerrada`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cerrar gestión'
  } finally {
    cerrandoGestion.value = null
  }
}
</script>

<template>
  <div class="space-y-4">

    <!-- Encabezado -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <div class="flex-1">
        <h2 class="text-2xl font-bold">Gestiones escolares</h2>
        <p class="text-sm text-base-content/60">Historial de años académicos de la institución</p>
      </div>
      <button class="btn btn-primary btn-sm" @click="abrir('crear')">
        + Nueva gestión
      </button>
    </div>

    <!-- Error global -->
    <div v-if="error" role="alert" class="alert alert-error">
      <span>{{ error }}</span>
      <button class="btn btn-sm btn-ghost" @click="cargar">Reintentar</button>
    </div>

    <!-- Resumen de la estructura copiada -->
    <div v-if="resultadoCopia" role="alert" class="alert alert-success items-start">
      <div class="flex-1 text-sm space-y-1">
        <p class="font-semibold">Estructura copiada de {{ resultadoCopia.origen.anio }} a {{ resultadoCopia.destino.anio }}</p>
        <p>
          Cursos {{ resultadoCopia.cursos.copiados }} ·
          Asignaciones {{ resultadoCopia.asignaciones.copiados }} ·
          Trimestres {{ resultadoCopia.trimestres.copiados }} ·
          Dimensiones {{ resultadoCopia.dimensiones.copiados }} ·
          Conceptos de pago {{ resultadoCopia.conceptosPago.copiados }}
          <span class="text-base-content/60">(lo que ya existía se respetó)</span>
        </p>
        <ul v-if="resultadoCopia.avisos.length" class="list-disc list-inside text-xs">
          <li v-for="a in resultadoCopia.avisos" :key="a">{{ a }}</li>
        </ul>
      </div>
      <button class="btn btn-sm btn-ghost" @click="resultadoCopia = null">Cerrar</button>
    </div>

    <!-- Info de la gestión activa -->
    <div v-if="gestionStore.gestion" class="alert alert-info py-3">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <span>
        Gestión activa: <strong>{{ gestionStore.anio }}</strong>
        <span v-if="gestionStore.director"> · Director: {{ gestionStore.director.nombre }} {{ gestionStore.director.apellido }}</span>
        · {{ gestionStore.cursos.length }} cursos · {{ gestionStore.trimestres.length }} trimestres
      </span>
    </div>

    <!-- Tabla de gestiones -->
    <div class="card bg-base-100 shadow overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Año</th>
            <th>Descripción</th>
            <th>Director asignado</th>
            <th>Cursos</th>
            <th>Inscritos</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <!-- Skeleton mientras carga -->
          <tr v-if="cargando" v-for="i in 4" :key="i">
            <td colspan="7"><div class="skeleton h-4 w-full"></div></td>
          </tr>
          <!-- Sin gestiones -->
          <tr v-else-if="gestiones.length === 0">
            <td colspan="7" class="text-center text-base-content/40 py-8">
              No hay gestiones registradas — creá la primera para comenzar.
            </td>
          </tr>
          <!-- Filas -->
          <tr v-else v-for="g in gestiones" :key="g.id" class="hover"
            :class="{ 'bg-primary/5': g.activa }">
            <td class="font-bold text-lg">{{ g.anio }}</td>
            <td class="text-sm text-base-content/70 max-w-xs truncate">
              {{ g.descripcion ?? '—' }}
            </td>
            <td>
              <!-- ¿Por qué mostrar el director en la tabla?
                   El Director necesita ver de un vistazo quién estuvo
                   a cargo de cada año — es útil para el historial institucional
                   y para saber qué gestiones aún no tienen director asignado. -->
              <span v-if="g.director" class="text-sm">
                {{ g.director.nombre }} {{ g.director.apellido }}
              </span>
              <StatusBadge v-else estado="PENDIENTE" texto="Sin asignar" />
            </td>
            <td class="text-center">
              <span class="badge badge-sm badge-ghost">{{ g._count.cursos }}</span>
            </td>
            <td class="text-center">
              <span class="badge badge-sm badge-ghost">{{ g._count.inscripciones }}</span>
            </td>
            <td>
              <StatusBadge :estado="g.activa ? 'ACTIVA' : 'CONCLUIDA'" :texto="g.activa ? 'Activa' : 'Cerrada'" />
            </td>
            <td>
              <div class="flex gap-1 flex-wrap">
                <!-- Editar datos (descripción, nota mínima) -->
                <button class="btn btn-ghost btn-xs" @click="abrir('editar', g)">
                  Editar
                </button>
                <!-- Copiar estructura: solo si hay una gestión anterior de la cual copiar -->
                <button
                  v-if="gestiones.some(x => x.anio < g.anio)"
                  class="btn btn-ghost btn-xs"
                  @click="abrir('copiar', g)"
                >
                  Copiar estructura
                </button>
                <!-- Asignar director: disponible para cualquier gestión -->
                <button
                  class="btn btn-ghost btn-xs"
                  :disabled="cargandoDir"
                  @click="abrir('director', g)"
                >
                  {{ g.director ? 'Cambiar director' : 'Asignar director' }}
                </button>
                <!-- Cerrar: solo la activa. El backend rechaza si hay
                     trimestres abiertos o resultados pendientes -->
                <button
                  v-if="g.activa"
                  class="btn btn-outline btn-xs btn-warning"
                  :disabled="cerrandoGestion === g.id"
                  @click="cerrarGestion(g)"
                >
                  <span v-if="cerrandoGestion === g.id" class="loading loading-spinner loading-xs"></span>
                  <span v-else>Cerrar</span>
                </button>
                <!-- Activar: solo si no está ya activa ni cerrada... solo no activa -->
                <button
                  v-if="!g.activa"
                  class="btn btn-outline btn-xs btn-success"
                  :disabled="activando === g.id"
                  @click="activar(g)"
                >
                  <span v-if="activando === g.id" class="loading loading-spinner loading-xs"></span>
                  <span v-else>Activar</span>
                </button>
                <span v-if="g.activa" class="text-xs text-success font-medium self-center">✓ Activa</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="!cargando" class="text-xs text-base-content/40">
      {{ gestiones.length }} gestión(es) registrada(s)
    </p>
  </div>

  <GestionCrearModal :abierto="modal === 'crear'" :gestiones="gestiones" @cerrar="cerrar" @creada="alCrear" />
  <GestionCopiarModal :abierto="modal === 'copiar'" :destino="seleccionada" :gestiones="gestiones" @cerrar="cerrar" @copiada="alCopiar" />
  <GestionDirectorModal :abierto="modal === 'director'" :gestion="seleccionada" :directores="directores" @cerrar="cerrar" @asignado="alAsignarDirector" />
  <GestionEditarModal :abierto="modal === 'editar'" :gestion="seleccionada" @cerrar="cerrar" @editada="alEditar" />
</template>
