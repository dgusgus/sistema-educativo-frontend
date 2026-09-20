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
import { gestionApi, type GestionResumen } from '@/api/gestion.api'
import { useGestionStore } from '@/stores/gestion.store'
import api from '@/api/axios'
import { useConfirm } from '@/composables/useConfirm'
import { useToastStore } from '@/stores/toast.store'
import AppIcon from '@/components/AppIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const { confirmar } = useConfirm()
const toast = useToastStore()

const gestionStore = useGestionStore()

// ─── Estado principal ─────────────────────────────────────────────────────────
const gestiones = ref<GestionResumen[]>([])
const cargando  = ref(true)
const error     = ref<string | null>(null)

// ─── Lista de directores disponibles ─────────────────────────────────────────
// ¿Para qué? El modal de "asignar director" necesita mostrar un selector
// con todos los directores del sistema — no solo el activo.
// Ej: hay 3 directores registrados históricamente, cualquiera puede
// ser asignado a cualquier gestión.
interface DirectorOpcion {
  id:       number
  nombre:   string
  apellido: string
  activo:   boolean
}
const directores   = ref<DirectorOpcion[]>([])
const cargandoDir  = ref(false)

// ─── Modal crear gestión ──────────────────────────────────────────────────────
const modalCrear  = ref(false)
const guardando   = ref(false)
const errorModal  = ref<string | null>(null)
const formCrear   = ref({ anio: new Date().getFullYear() + 1, descripcion: '' })

// ─── Modal asignar director ───────────────────────────────────────────────────
// ¿Por qué un modal separado para asignar director?
// Porque es una acción institucional importante — cambiar quién dirige
// el año académico tiene implicancias en boletines, reportes y firma
// de documentos. Tenerlo en un modal propio obliga a que sea intencional,
// no un campo más del formulario de crear gestión.
const modalDirector     = ref(false)
const asignando         = ref(false)
const errorDirector     = ref<string | null>(null)
const gestionSeleccionada = ref<GestionResumen | null>(null)
const directorIdSelecto = ref<number | ''>('')

// ─── Carga inicial ────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([cargar(), cargarDirectores()])
})

async function cargar() {
  cargando.value = true
  error.value    = null
  try {
    gestiones.value = await gestionApi.getAll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar gestiones'
  } finally {
    cargando.value = false
  }
}

async function cargarDirectores() {
  // ¿Por qué llamamos directamente a /directores en lugar de usar un store?
  // Porque la lista de directores solo se necesita en este modal.
  // No vale la pena un store dedicado para una lista que se usa en un solo lugar.
  cargandoDir.value = true
  try {
    const { data } = await api.get<DirectorOpcion[]>('/directores')
    directores.value = data
  } catch {
    // Si falla, el modal mostrará un mensaje — no es un error crítico
    // porque el Director puede reintentar abriendo el modal de nuevo.
    directores.value = []
  } finally {
    cargandoDir.value = false
  }
}

// ─── Crear gestión ────────────────────────────────────────────────────────────
function abrirCrear() {
  // ¿Por qué sugerir el año siguiente?
  // El Director crea la gestión 2026 durante el año 2025, generalmente
  // en los últimos meses. Pre-llenar con el año siguiente ahorra
  // que tenga que escribirlo manualmente cada vez.
  formCrear.value  = {
    anio:        new Date().getFullYear() + 1,
    descripcion: `Gestión Escolar ${new Date().getFullYear() + 1}`,
  }
  errorModal.value = null
  modalCrear.value = true
}

async function crearGestion() {
  if (!formCrear.value.anio) {
    errorModal.value = 'El año es obligatorio'
    return
  }
  guardando.value  = true
  errorModal.value = null
  try {
    const nueva = await gestionApi.create({
      anio:        formCrear.value.anio,
      descripcion: formCrear.value.descripcion || undefined,
    })
    gestiones.value.unshift(nueva)
    modalCrear.value = false
    toast.success(`Gestión ${nueva.anio} creada`)
  } catch (e) {
    errorModal.value = e instanceof Error ? e.message : 'Error al crear gestión'
  } finally {
    guardando.value = false
  }
}

// ─── Activar gestión ──────────────────────────────────────────────────────────
// ¿Qué hace activar? Pone activa=true en esta gestión y activa=false
// en TODAS las demás. Solo puede haber una gestión activa a la vez.
// ¿Por qué un confirm()? Porque es una operación que afecta a todo el sistema —
// todos los módulos empezarán a usar los cursos y trimestres de la nueva gestión.
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
    // Actualizar la lista localmente — marcar la nueva como activa
    // y las demás como inactivas, sin recargar todo del backend.
    gestiones.value.forEach(x => { x.activa = x.id === g.id })
    // Recargar el store global para que todos los módulos vean la nueva gestión
    // ¿Por qué recargar el store y no solo la lista local?
    // Porque gestionStore.gestion es lo que usa TODO el sistema
    // (AsistenciaView, CalificacionesView, EstudiantesView, etc.).
    // Si no lo recargamos, esos módulos seguirían viendo la gestión anterior.
    await gestionStore.recargar()
    toast.success(`Gestión ${g.anio} activada`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al activar gestión'
  } finally {
    activando.value = null
  }
}

// ─── Asignar director ─────────────────────────────────────────────────────────
function abrirAsignarDirector(g: GestionResumen) {
  gestionSeleccionada.value = g
  // Pre-seleccionar el director actual si ya tiene uno asignado
  // ¿Para qué? Para que el Director vea quién está asignado ahora
  // y solo cambie si realmente quiere reemplazarlo.
  directorIdSelecto.value   = g.director?.id ?? ''
  errorDirector.value       = null
  modalDirector.value       = true
}

async function asignarDirector() {
  if (!directorIdSelecto.value) {
    errorDirector.value = 'Seleccioná un director'
    return
  }
  if (!gestionSeleccionada.value) return

  asignando.value     = true
  errorDirector.value = null
  try {
    await gestionApi.asignarDirector(
      gestionSeleccionada.value.id,
      Number(directorIdSelecto.value)
    )
    // Actualizar localmente el director de la gestión en la lista
    // ¿Por qué actualizamos localmente en lugar de recargar?
    // Recargar la lista completa sería una llamada extra innecesaria.
    // Sabemos exactamente qué cambió: el director de una gestión específica.
    const directorElegido = directores.value.find(d => d.id === Number(directorIdSelecto.value))
    const idx = gestiones.value.findIndex(g => g.id === gestionSeleccionada.value!.id)
    if (idx !== -1 && directorElegido) {
      gestiones.value[idx].director = {
        id:       directorElegido.id,
        nombre:   directorElegido.nombre,
        apellido: directorElegido.apellido,
      }
    }
    modalDirector.value = false
    toast.success('Director asignado')
    // Si la gestión afectada es la activa, recargar el store
    // para que el nombre del director se actualice en el sidebar/dashboard
    if (gestionSeleccionada.value.activa) {
      await gestionStore.recargar()
    }
  } catch (e) {
    errorDirector.value = e instanceof Error ? e.message : 'Error al asignar director'
  } finally {
    asignando.value = false
  }
}

// ─── Helpers de display ───────────────────────────────────────────────────────
// Directores activos para el selector — ¿por qué filtrar inactivos?
// No tiene sentido asignar como director a alguien que ya no trabaja
// en la institución. Igual se muestran en la lista principal por historial.
const directoresActivos = computed(() => directores.value.filter(d => d.activo))
</script>

<template>
  <div class="space-y-4">

    <!-- Encabezado -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <div class="flex-1">
        <h2 class="text-2xl font-bold">Gestiones escolares</h2>
        <p class="text-sm text-base-content/60">Historial de años académicos de la institución</p>
      </div>
      <button class="btn btn-primary btn-sm" @click="abrirCrear">
        + Nueva gestión
      </button>
    </div>

    <!-- Error global -->
    <div v-if="error" role="alert" class="alert alert-error">
      <span>{{ error }}</span>
      <button class="btn btn-sm btn-ghost" @click="cargar">Reintentar</button>
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
                <!-- Asignar director: disponible para cualquier gestión -->
                <button
                  class="btn btn-ghost btn-xs"
                  :disabled="cargandoDir"
                  @click="abrirAsignarDirector(g)"
                >
                  {{ g.director ? 'Cambiar director' : 'Asignar director' }}
                </button>
                <!-- Activar: solo si no está ya activa -->
                <button
                  v-if="!g.activa"
                  class="btn btn-outline btn-xs btn-success"
                  :disabled="activando === g.id"
                  @click="activar(g)"
                >
                  <span v-if="activando === g.id" class="loading loading-spinner loading-xs"></span>
                  <span v-else>Activar</span>
                </button>
                <span v-else class="text-xs text-success font-medium self-center">✓ Activa</span>
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

  <!-- ── Modal crear gestión ─────────────────────────────────────────────────── -->
  <dialog :open="modalCrear" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">Nueva gestión escolar</h3>

      <div v-if="errorModal" role="alert" class="alert alert-error mb-4 py-2 text-sm">
        <span>{{ errorModal }}</span>
      </div>

      <form class="space-y-3" @submit.prevent="crearGestion">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Año *</legend>
          <input
            v-model.number="formCrear.anio"
            type="number"
            :min="2020"
            :max="2100"
            class="input input-bordered w-full"
            :disabled="guardando"
          />
          <p class="text-xs text-base-content/50 mt-1">
            El año debe ser único — no puede haber dos gestiones para el mismo año.
          </p>
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Descripción</legend>
          <input
            v-model="formCrear.descripcion"
            type="text"
            placeholder="Ej: Gestión Escolar 2026"
            class="input input-bordered w-full"
            :disabled="guardando"
          />
        </fieldset>

        <!-- Nota informativa: ¿por qué no asignar director acá?
             Separamos la creación de la asignación de director para que
             el Director pueda crear la gestión aunque todavía no sepa
             quién va a dirigirla. Se puede asignar después con el botón
             "Asignar director" en la tabla. -->
        <div role="alert" class="alert py-2 text-sm">
          <AppIcon nombre="alerta" class="h-4 w-4" />
          <span>
            El director se asigna por separado desde la tabla.
            Después de crear, recordá también crear los cursos y trimestres en <strong>Estructura</strong>.
          </span>
        </div>

        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="guardando" @click="modalCrear = false">
            Cancelar
          </button>
          <button type="submit" class="btn btn-primary" :disabled="guardando">
            <span v-if="guardando" class="loading loading-spinner loading-sm"></span>
            Crear gestión
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalCrear = false">
      <button>cerrar</button>
    </form>
  </dialog>

  <!-- ── Modal asignar director ──────────────────────────────────────────────── -->
  <dialog :open="modalDirector" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Asignar director</h3>
      <p class="text-sm text-base-content/60 mb-4">
        Gestión: <strong>{{ gestionSeleccionada?.anio }}</strong>
        <span v-if="gestionSeleccionada?.director">
          · Director actual: {{ gestionSeleccionada.director.nombre }} {{ gestionSeleccionada.director.apellido }}
        </span>
      </p>

      <div v-if="errorDirector" role="alert" class="alert alert-error mb-4 py-2 text-sm">
        <span>{{ errorDirector }}</span>
      </div>

      <form class="space-y-3" @submit.prevent="asignarDirector">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Director *</legend>

          <!-- ¿Por qué mostramos solo los activos?
               Un director inactivo ya no trabaja en la institución.
               Asignarlo como director de una gestión no tendría sentido
               operativo — no podría iniciar sesión ni firmar documentos. -->
          <select
            v-model="directorIdSelecto"
            class="select select-bordered w-full"
            :disabled="asignando"
          >
            <option value="" disabled>Seleccionar director</option>
            <option
              v-for="d in directoresActivos"
              :key="d.id"
              :value="d.id"
            >
              {{ d.apellido }}, {{ d.nombre }}
            </option>
          </select>

          <p v-if="directoresActivos.length === 0" class="text-xs text-warning mt-1">
            No hay directores activos en el sistema.
            Creá uno primero desde la pestaña "Directores" en Usuarios.
          </p>
        </fieldset>

        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="asignando" @click="modalDirector = false">
            Cancelar
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="asignando || !directorIdSelecto"
          >
            <span v-if="asignando" class="loading loading-spinner loading-sm"></span>
            Asignar
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalDirector = false">
      <button>cerrar</button>
    </form>
  </dialog>
</template>