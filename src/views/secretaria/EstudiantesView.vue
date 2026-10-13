<script setup lang="ts">
/**
 * EstudiantesView — el estudiante es el centro; inscribir, cambiar estado y gestionar
 * la cuenta son ACCIONES sobre el estudiante, no módulos aparte.
 *
 * Lista con paginación y búsqueda EN EL SERVIDOR (useListaPaginada): con ~900 estudiantes
 * ya no se descarga todo para filtrar en el navegador. Cada modal es un componente en
 * components/estudiantes/ (antes eran ~450 líneas dentro de esta vista).
 */
import { ref, onMounted } from 'vue'
import HistorialAcademicoModal from '@/components/HistorialAcademicoModal.vue'
import ImportarExcelModal from '@/components/ImportarExcelModal.vue'
import PaginadorTabla from '@/components/PaginadorTabla.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import AppIcon from '@/components/AppIcon.vue'
import EstudiantePerfilModal from '@/components/estudiantes/EstudiantePerfilModal.vue'
import EstudianteConCuentaModal from '@/components/estudiantes/EstudianteConCuentaModal.vue'
import EstudianteVincularModal from '@/components/estudiantes/EstudianteVincularModal.vue'
import EstudianteInscribirModal from '@/components/estudiantes/EstudianteInscribirModal.vue'
import EstudianteEstadoModal from '@/components/estudiantes/EstudianteEstadoModal.vue'
import EstudianteResetModal from '@/components/estudiantes/EstudianteResetModal.vue'
import { estudianteApi } from '@/api/estudiante.api'
import { usuarioApi } from '@/api/usuario.api'
import { descargarBlob } from '@/api/boletin.api'
import { useGestionStore } from '@/stores/gestion.store'
import { useConfirm } from '@/composables/useConfirm'
import { useAccion } from '@/composables/useAccion'
import { useListaPaginada } from '@/composables/useListaPaginada'
import { ultimaInscripcion, nombreCursoDeInscripcion } from '@/lib/estudiantes'
import type { Estudiante, Inscripcion, EstadoInscripcion } from '@/types'
import type { ResultadoImport } from '@/types/import'

const gestion = useGestionStore()
const { confirmar } = useConfirm()

// ─── Lista (paginación + búsqueda en el servidor) ────────────────────────────
const filtroCurso  = ref<number | ''>('')
const filtroEstado = ref<EstadoInscripcion | ''>('')
// El Estudiante es un registro PERMANENTE (la Inscripción sí es por gestión): por defecto se
// muestran TODOS, y este filtro es opcional para acotar a "inscritos este año".
const soloGestionActiva = ref(false)

const lista = useListaPaginada<Estudiante>({
  pedir: ({ pagina, limite, search }) => estudianteApi.getPage({
    pagina, limite,
    ...(search && { search }),
    ...(soloGestionActiva.value && gestion.gestionId ? { gestionId: gestion.gestionId } : {}),
    ...(filtroEstado.value && { estadoInscripcion: filtroEstado.value }),
    ...(filtroCurso.value  && { cursoId: Number(filtroCurso.value) }),
  }),
})

onMounted(async () => {
  await gestion.cargar()
  await lista.cargar()
})

// ¿Ya tiene inscripción EN LA GESTIÓN ACTIVA? Si no, corresponde inscribir;
// si sí, las acciones son sobre esa inscripción (estado/desinscribir).
function inscritoEnGestionActiva(e: Estudiante): boolean {
  const insc = ultimaInscripcion(e)
  return !!insc && insc.gestionId === gestion.gestionId
}

// ─── Modales: cada uno guarda y avisa; aquí solo se abre/cierra y se recarga ───
type Modal = 'perfil' | 'conCuenta' | 'vincular' | 'inscribir' | 'estado' | 'reset' | 'historial' | 'importar' | null
const modal = ref<Modal>(null)
const seleccionado = ref<Estudiante | null>(null)
const inscripcionSel = ref<Inscripcion | null>(null)

function abrir(m: Exclude<Modal, null>, e: Estudiante | null = null, insc: Inscripcion | null = null) {
  seleccionado.value = e
  inscripcionSel.value = insc
  modal.value = m
}
const cerrar = () => { modal.value = null }
function guardadoYCerrar() { cerrar(); void lista.cargar() }

// ─── Desinscribir (borra la inscripción — deshacer un error) ─────────────────
const desinscribiendo = ref<number | null>(null)
const desinscribirAccion = useAccion(
  (insc: Inscripcion) => estudianteApi.eliminarInscripcion(insc.id),
  { exito: 'Inscripción eliminada', errorEnToast: true },
)

async function desinscribir(insc: Inscripcion) {
  const ok = await confirmar({
    mensaje: `¿Desinscribir de ${nombreCursoDeInscripcion(insc)}? Esto borra la inscripción — si ya tiene notas, asistencia o pagos cargados, el sistema lo va a rechazar y ahí corresponde usar "Estado" en su lugar.`,
    peligroso: true,
    textoConfirmar: 'Desinscribir',
  })
  if (!ok) return
  desinscribiendo.value = insc.id
  if (await desinscribirAccion.ejecutar(insc) !== undefined) await lista.cargar()
  desinscribiendo.value = null
}

// ─── Activar / desactivar cuenta ─────────────────────────────────────────────
const toggeandoActivo = ref<number | null>(null)
const toggleAccion = useAccion(
  async (e: Estudiante) => {
    const actual = e.usuario!.activo ?? true
    await usuarioApi.update(e.usuario!.id, { activo: !actual })
    e.usuario!.activo = !actual
    return !actual
  },
  { errorEnToast: true },
)

async function toggleActivo(e: Estudiante) {
  if (!e.usuario) return
  toggeandoActivo.value = e.usuario.id
  await toggleAccion.ejecutar(e)
  toggeandoActivo.value = null
}

// ─── Importar / exportar ─────────────────────────────────────────────────────
async function onImportar(archivo: File): Promise<ResultadoImport> {
  if (!gestion.gestionId) throw new Error('No hay gestión activa')
  return estudianteApi.importar(archivo, gestion.gestionId)
}

async function exportar() {
  if (!gestion.gestionId) return
  const blob = await estudianteApi.exportar(gestion.gestionId)
  descargarBlob(blob, `estudiantes_gestion_${gestion.anio}.xlsx`)
}
</script>

<template>
  <div class="space-y-4">

    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <div class="flex-1">
        <h2 class="text-2xl font-bold">Estudiantes</h2>
        <p class="text-sm text-base-content/60">Gestión {{ gestion.anio ?? '—' }}</p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm" @click="abrir('perfil')">+ Solo perfil</button>
        <button class="btn btn-primary btn-sm" @click="abrir('conCuenta')">+ Con cuenta</button>
        <button class="btn btn-outline btn-sm" @click="exportar">Exportar</button>
        <button class="btn btn-outline btn-sm" @click="abrir('importar')">Importar</button>
      </div>
    </div>

    <!-- Buscador + filtros -->
    <div class="flex flex-wrap gap-3 items-center">
      <label class="input input-bordered flex items-center gap-2 max-w-sm">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
        </svg>
        <input v-model="lista.busqueda.value" type="search" placeholder="Buscar por nombre o CI..." class="grow" />
      </label>
      <select v-model="filtroCurso" class="select select-bordered select-sm" @change="lista.refiltrar()">
        <option value="">Todos los cursos</option>
        <option v-for="c in gestion.cursos" :key="c.id" :value="c.id">{{ c.nombre }}</option>
      </select>
      <select v-model="filtroEstado" class="select select-bordered select-sm" @change="lista.refiltrar()">
        <option value="">Todos los estados</option>
        <option value="ACTIVA">Activas</option>
        <option value="RETIRADA">Retiradas</option>
        <option value="TRANSFERIDA">Transferidas</option>
        <option value="CONCLUIDA">Concluidas</option>
      </select>
      <label class="label cursor-pointer gap-2">
        <input v-model="soloGestionActiva" type="checkbox" class="checkbox checkbox-sm" @change="lista.refiltrar()" />
        <span class="text-sm">Solo inscritos en {{ gestion.anio }}</span>
      </label>
    </div>

    <div v-if="lista.error.value" role="alert" class="alert alert-error">
      <span>{{ lista.error.value }}</span>
      <button class="btn btn-sm btn-ghost" @click="lista.cargar()">Reintentar</button>
    </div>

    <div class="card bg-base-100 shadow overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Nombre</th><th>CI</th><th>Curso</th><th>Estado</th><th>Resultado</th><th>Cuenta</th><th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="lista.cargando.value && !lista.items.value.length" v-for="i in 6" :key="i">
            <td colspan="7"><div class="skeleton h-4 w-full"></div></td>
          </tr>
          <tr v-else-if="lista.items.value.length === 0">
            <td colspan="7" class="text-center text-base-content/40 py-8">No se encontraron estudiantes</td>
          </tr>
          <tr v-else v-for="e in lista.items.value" :key="e.id" class="hover">
            <td class="font-medium">{{ e.apellido }}, {{ e.nombre }}</td>
            <td class="font-mono text-sm">{{ e.ci }}</td>
            <td class="text-sm">
              <span v-if="ultimaInscripcion(e)">{{ nombreCursoDeInscripcion(ultimaInscripcion(e)) }}</span>
             <span v-else class="text-base-content/30">Sin inscripción</span>
            </td>
            <td>
              <StatusBadge v-if="ultimaInscripcion(e)" :estado="ultimaInscripcion(e)!.estadoInscripcion" />
              <span v-else class="text-base-content/30 text-xs">—</span>
            </td>
            <td>
              <StatusBadge v-if="ultimaInscripcion(e)" :estado="ultimaInscripcion(e)!.resultado" />
              <span v-else class="text-base-content/30 text-xs">—</span>
            </td>
            <td>
              <div v-if="e.usuario" class="flex items-center gap-2">
                <span class="badge badge-sm badge-success font-mono">{{ e.usuario.username }}</span>
                <input
                  type="checkbox"
                  class="toggle toggle-xs toggle-success"
                  :checked="e.usuario.activo ?? true"
                  :disabled="toggeandoActivo === e.usuario.id"
                  @change="toggleActivo(e)"
                  :title="e.usuario.activo ?? true ? 'Desactivar cuenta' : 'Activar cuenta'"
                />
              </div>
              <span v-else class="badge badge-sm badge-ghost">Sin cuenta</span>
            </td>
            <td class="text-right">
              <div class="dropdown dropdown-end">
                <button tabindex="0" role="button"
                  class="btn btn-ghost btn-circle min-h-11 min-w-11"
                  :aria-label="`Acciones para ${e.apellido}, ${e.nombre}`"
                  aria-haspopup="menu">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
                  </svg>
                </button>
                <ul tabindex="0" role="menu"
                  class="dropdown-content menu bg-base-100 rounded-2xl z-10 w-64 p-2 shadow-lg border border-base-300 text-left">
                  <li class="menu-title truncate px-3">{{ e.apellido }}, {{ e.nombre }}</li>
                  <li><button role="menuitem" @click="abrir('perfil', e)"><AppIcon nombre="editar" class="h-4 w-4" />Editar perfil</button></li>
                  <li class="menu-title mt-1">Académico</li>
                  <li>
                    <button role="menuitem" @click="abrir('historial', e)"><AppIcon nombre="documento" class="h-4 w-4" />Historial académico</button>
                  </li>
                  <li v-if="!inscritoEnGestionActiva(e)">
                    <button role="menuitem" class="text-primary" @click="abrir('inscribir', e)"><AppIcon nombre="agregar" class="h-4 w-4" />Inscribir</button>
                  </li>
                  <li v-if="ultimaInscripcion(e)?.estadoInscripcion === 'ACTIVA'">
                    <button role="menuitem" @click="abrir('estado', e, ultimaInscripcion(e))"><AppIcon nombre="documento" class="h-4 w-4" />Cambiar estado</button>
                  </li>
                  <li v-if="inscritoEnGestionActiva(e)">
                    <button role="menuitem" class="text-error"
                      :disabled="desinscribiendo === ultimaInscripcion(e)!.id"
                      @click="desinscribir(ultimaInscripcion(e)!)">
                      <span v-if="desinscribiendo === ultimaInscripcion(e)!.id" class="loading loading-xs loading-spinner"></span>
                      <AppIcon v-else nombre="eliminar" class="h-4 w-4" />
                      <span>Desinscribir</span>
                    </button>
                  </li>
                  <li class="menu-title mt-1">Cuenta</li>
                  <li v-if="!e.usuario">
                    <button role="menuitem" class="text-warning" @click="abrir('vincular', e)"><AppIcon nombre="personas" class="h-4 w-4" />Vincular cuenta</button>
                  </li>
                  <li v-if="e.usuario">
                    <button role="menuitem" @click="abrir('reset', e)"><AppIcon nombre="candado" class="h-4 w-4" />Reset pass</button>
                  </li>
                </ul>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <PaginadorTabla
      :pagina="lista.pagina.value" :total-paginas="lista.totalPaginas.value"
      :desde="lista.desde.value" :hasta="lista.hasta.value" :total="lista.total.value"
      :limite="lista.limite.value" :cargando="lista.cargando.value"
      @ir="lista.irAPagina" @limite="lista.cambiarLimite" />
  </div>

  <EstudiantePerfilModal :abierto="modal === 'perfil'" :estudiante="seleccionado" @cerrar="cerrar" @guardado="guardadoYCerrar" />
  <EstudianteConCuentaModal :abierto="modal === 'conCuenta'" @cerrar="cerrar" @creado="lista.cargar()" />
  <EstudianteVincularModal :abierto="modal === 'vincular'" :estudiante="seleccionado" @cerrar="cerrar" @vinculado="guardadoYCerrar" />
  <EstudianteInscribirModal :abierto="modal === 'inscribir'" :estudiante="seleccionado" @cerrar="cerrar" @inscrito="guardadoYCerrar" />
  <EstudianteEstadoModal :abierto="modal === 'estado'" :inscripcion="inscripcionSel" @cerrar="cerrar" @cambiado="guardadoYCerrar" />
  <EstudianteResetModal :abierto="modal === 'reset'" :estudiante="seleccionado" @cerrar="cerrar" />

  <HistorialAcademicoModal :abierto="modal === 'historial'" :estudiante="seleccionado" @cerrar="cerrar" />

  <ImportarExcelModal
    :model-value="modal === 'importar'"
    titulo="Importar estudiantes"
    :columnas="['CI', 'Nombre', 'Apellido', 'FechaNacimiento', 'Direccion', 'RUDE', 'Curso']"
    :plantilla="estudianteApi.plantilla"
    nombre-plantilla="plantilla_estudiantes.xlsx"
    :importar="onImportar"
    @update:model-value="(v: boolean) => { if (!v) cerrar() }"
    @completado="lista.cargar()"
  />
</template>
