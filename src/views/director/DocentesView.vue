<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { docenteApi } from '@/api/docente.api'
import { usuarioApi } from '@/api/usuario.api'
import { useGestionStore } from '@/stores/gestion.store'
import { useCatalogoStore } from '@/stores/catalogo.store'
import { useToastStore } from '@/stores/toast.store'
import { useConfirm } from '@/composables/useConfirm'
import type { Docente, Materia } from '@/types'
import AppIcon from '@/components/AppIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import ImportarExcelModal from '@/components/ImportarExcelModal.vue'
import DocentePerfilModal from '@/components/docentes/DocentePerfilModal.vue'
import DocenteConCuentaModal from '@/components/docentes/DocenteConCuentaModal.vue'
import DocenteVincularModal from '@/components/docentes/DocenteVincularModal.vue'
import DocenteAsignacionesModal from '@/components/docentes/DocenteAsignacionesModal.vue'
import DocenteResetModal from '@/components/docentes/DocenteResetModal.vue'
import { cursosDe, type AsignacionDocente } from '@/lib/docentes'
import { descargarBlob } from '@/api/boletin.api.js'

const toast = useToastStore()
const { confirmar } = useConfirm()
const gestion = useGestionStore()
const catalogo = useCatalogoStore()

// ─── Estado principal ─────────────────────────────────────────────────────────
const docentes  = ref<Docente[]>([])
const materias  = ref<Materia[]>([])
const cargando  = ref(true)
const error     = ref<string | null>(null)
const busqueda  = ref('')

// Guard anti-race: cada llamada a cargar() se numera; si una respuesta vieja llega
// DESPUÉS de una más nueva, se descarta (evita pisar datos frescos con una foto vieja,
// causa de los "docente no encontrado"). Por eso los modales avisan lo que crearon y
// aquí se parcha la lista en memoria, en vez de recargarla.
let cargaSeq = 0

onMounted(async () => {
  await gestion.cargar()
  await Promise.all([cargar(), cargarMaterias()])
})

async function cargar() {
  const miTurno = ++cargaSeq
  cargando.value = true
  error.value = null
  try {
    const lista = await docenteApi.getAll()
    if (miTurno !== cargaSeq) return
    docentes.value = lista
  } catch (e) {
    if (miTurno !== cargaSeq) return
    error.value = e instanceof Error ? e.message : 'Error al cargar docentes'
  } finally {
    if (miTurno === cargaSeq) cargando.value = false
  }
}

async function cargarMaterias() {
  try {
    materias.value = await catalogo.materias()
  } catch {
    // Si falla, las materias quedan vacías — el modal de asignación lo explica.
  }
}

// ─── Filtro ───────────────────────────────────────────────────────────────────
const docentesFiltrados = computed(() => {
  const q = busqueda.value.toLowerCase().trim()
  if (!q) return docentes.value
  return docentes.value.filter(d => `${d.nombre} ${d.apellido} ${d.ci}`.toLowerCase().includes(q))
})

function tieneCuenta(d: Docente): boolean { return !!d.usuario }

// ─── Parches en memoria ───────────────────────────────────────────────────────
function parchar(id: number, cambio: (d: Docente) => Docente) {
  const idx = docentes.value.findIndex(d => d.id === id)
  if (idx !== -1) docentes.value[idx] = cambio(docentes.value[idx])
}
const alCrear      = (d: Docente) => { docentes.value.unshift(d) }
const alActualizar = (d: Docente) => parchar(d.id, x => ({ ...x, ...d }))
const alVincular   = (p: { docenteId: number; usuario: { id: number; username: string; activo: boolean } }) =>
  parchar(p.docenteId, x => ({ ...x, usuario: p.usuario }))
const alAsignar    = (p: { docenteId: number; asignacion: AsignacionDocente }) =>
  parchar(p.docenteId, x => ({ ...x, asignaciones: [...(x.asignaciones ?? []), p.asignacion] }))
const alQuitar     = (p: { docenteId: number; asignacionId: number }) =>
  parchar(p.docenteId, x => ({ ...x, asignaciones: (x.asignaciones ?? []).filter(a => a.id !== p.asignacionId) }))

// ─── Quitar asignación desde la tabla ─────────────────────────────────────────
const quitandoAsignacion = ref<number | null>(null)

async function quitarAsignacion(d: Docente, asignacionId: number, descripcion: string) {
  const ok = await confirmar({ mensaje: `¿Quitar "${descripcion}" a ${d.nombre} ${d.apellido}?`, textoConfirmar: 'Quitar' })
  if (!ok) return
  quitandoAsignacion.value = asignacionId
  try {
    await docenteApi.removeAsignacion(d.id, asignacionId)
    alQuitar({ docenteId: d.id, asignacionId })
    toast.success('Asignación eliminada')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al quitar asignación'
  } finally {
    quitandoAsignacion.value = null
  }
}

// ─── Activar / desactivar cuenta ──────────────────────────────────────────────
const toggeandoActivo = ref<number | null>(null)

async function toggleActivoCuenta(d: Docente) {
  if (!d.usuario) return
  toggeandoActivo.value = d.usuario.id
  try {
    const estadoActual = d.usuario.activo ?? true
    await usuarioApi.update(d.usuario.id, { activo: !estadoActual })
    d.usuario.activo = !estadoActual
    toast.success(estadoActual ? 'Cuenta desactivada' : 'Cuenta activada')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cambiar estado de la cuenta'
  } finally {
    toggeandoActivo.value = null
  }
}

// ─── Modales: uno abierto a la vez ────────────────────────────────────────────
type Modal = 'perfil' | 'conCuenta' | 'vincular' | 'asignaciones' | 'reset' | null
const modal = ref<Modal>(null)
const seleccionadoId = ref<number | null>(null)
// Siempre la versión viva de la lista, para reflejar al instante lo que se parcha.
const seleccionado = computed(() => docentes.value.find(d => d.id === seleccionadoId.value) ?? null)

function abrir(m: Exclude<Modal, null>, d?: Docente) {
  seleccionadoId.value = d?.id ?? null
  modal.value = m
}
const cerrar = () => { modal.value = null }

// ─── Importar / exportar ──────────────────────────────────────────────────────
const modalImportar = ref(false)
async function onImportar(archivo: File) { return docenteApi.importar(archivo) }
function onImportacionCompletada() { cargar() }
async function exportar() {
  const blob = await docenteApi.exportar()
  descargarBlob(blob, 'docentes.xlsx')
}
</script>

<template>
  <div class="space-y-4">

    <!-- Encabezado -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <h2 class="text-2xl font-bold flex-1">Docentes</h2>
      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm" @click="abrir('perfil')">
          + Solo perfil
        </button>
        <button class="btn btn-primary btn-sm" @click="abrir('conCuenta')">
          + Con cuenta
        </button>
        <button class="btn btn-outline btn-sm" @click="exportar">Exportar</button>
        <button class="btn btn-outline btn-sm" @click="modalImportar = true">Importar</button>

      </div>
    </div>

    <!-- Error global -->
    <div v-if="error" role="alert" class="alert alert-error">
      <span>{{ error }}</span>
      <button class="btn btn-sm btn-ghost" @click="cargar">Reintentar</button>
    </div>

    <!-- Buscador -->
    <label class="input input-bordered flex items-center gap-2 max-w-sm">
<AppIcon nombre="buscar" class="h-4 w-4 opacity-50" />
      <input v-model="busqueda" type="search" placeholder="Buscar por nombre o CI..." class="grow" />
    </label>

    <!-- Tabla -->
    <div class="card bg-base-100 shadow overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>CI</th>
            <th>Especialidad</th>
            <th>Cursos asignados</th>
            <th>Cuenta</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
       <tbody>
          <tr v-if="cargando" v-for="i in 5" :key="i">
            <td colspan="7">
              <div class="skeleton h-4 w-full"></div>
            </td>
          </tr>
          <tr v-else-if="docentesFiltrados.length === 0">
            <td colspan="7" class="text-center text-base-content/40 py-8">
              No se encontraron docentes
            </td>
          </tr>
          <tr v-else v-for="d in docentesFiltrados" :key="d.id" class="hover">
            <td class="font-medium">{{ d.apellido }}, {{ d.nombre }}</td>
            <td class="font-mono text-sm">{{ d.ci }}</td>
            <td class="text-sm">{{ d.especialidad ?? '—' }}</td>
<td>
  <div v-if="!cursosDe(d).length" class="text-xs text-base-content/30">Sin asignaciones</div>
  <details v-else class="collapse-arrow collapse min-w-52 rounded-2xl border border-base-300/70 bg-base-200/40">
    <summary class="collapse-title flex min-h-11 items-center gap-2 py-2 pl-3 pr-9 text-xs font-semibold">
      <span class="badge badge-sm badge-primary tabular-nums">{{ cursosDe(d).length }}</span>
      <span>{{ cursosDe(d).length === 1 ? 'curso' : 'cursos' }}</span>
      <span class="truncate font-normal text-base-content/45">{{ cursosDe(d).slice(0, 2).map(c => c.corto).join(' · ') }}</span>
    </summary>
    <ul class="collapse-content list gap-0.5">
      <li v-for="c in cursosDe(d)" :key="c.id" class="list-row items-center gap-2 rounded-xl px-2 py-1 hover:bg-base-300/40" :title="c.completo">
        <span class="badge badge-xs badge-outline font-mono">{{ c.corto }}</span>
        <span class="list-col-grow min-w-0">
          <span class="block truncate text-xs">{{ c.completo }}</span>
        </span>
        <button type="button" class="btn btn-circle btn-ghost btn-sm"
          :disabled="quitandoAsignacion === c.id"
          :title="`Quitar ${c.completo}`"
          :aria-label="`Quitar ${c.completo} a ${d.nombre} ${d.apellido}`"
          @click="quitarAsignacion(d, c.id, c.completo)">
          <span v-if="quitandoAsignacion === c.id" class="loading loading-spinner loading-xs"></span>
          <AppIcon v-else nombre="cerrar" class="h-3.5 w-3.5 text-error" />
        </button>
      </li>
    </ul>
  </details>
</td>
            <td>
              <div v-if="tieneCuenta(d)" class="flex items-center gap-2">
                <span class="badge badge-sm badge-success font-mono">{{ d.usuario?.username }}</span>
                <input type="checkbox" class="toggle toggle-xs toggle-success" :checked="d.usuario?.activo ?? true"
                  :disabled="toggeandoActivo === d.usuario?.id" @change="toggleActivoCuenta(d)"
                  :title="(d.usuario?.activo ?? true) ? 'Desactivar cuenta' : 'Activar cuenta'" />
              </div>
              <span v-else class="badge badge-sm badge-ghost">Sin cuenta</span>
            </td>
            <td>
              <StatusBadge :estado="d.activo ? 'ACTIVO' : 'INACTIVO'" :texto="d.activo ? 'Activo' : 'Inactivo'" />
            </td>
            <td>
              <div class="flex gap-1 flex-nowrap whitespace-nowrap">
                <button class="btn btn-ghost btn-sm min-h-11" @click="abrir('perfil', d)">
                  Editar
                </button>
                <button class="btn btn-outline btn-sm min-h-11 btn-info" @click="abrir('asignaciones', d)">
                  Asignaciones
                </button>
                <button v-if="!tieneCuenta(d)" class="btn btn-outline btn-sm min-h-11 btn-warning" @click="abrir('vincular', d)">
                  Vincular cuenta
                </button>
                <button v-if="tieneCuenta(d)" class="btn btn-ghost btn-sm min-h-11" @click="abrir('reset', d)">
                  Reset pass
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="!cargando" class="text-xs text-base-content/40">
      {{ docentesFiltrados.length }} docente(s) encontrado(s)
    </p>
  </div>


  <DocentePerfilModal :abierto="modal === 'perfil'" :docente="seleccionado" @cerrar="cerrar" @creado="alCrear" @actualizado="alActualizar" />
  <DocenteConCuentaModal :abierto="modal === 'conCuenta'" @cerrar="cerrar" @creado="alCrear" />
  <DocenteVincularModal :abierto="modal === 'vincular'" :docente="seleccionado" @cerrar="cerrar" @vinculado="alVincular" />
  <DocenteAsignacionesModal :abierto="modal === 'asignaciones'" :docente="seleccionado" :materias="materias" @cerrar="cerrar" @asignada="alAsignar" @quitada="alQuitar" />
  <DocenteResetModal :abierto="modal === 'reset'" :docente="seleccionado" @cerrar="cerrar" />

<!-- DocentesView.vue -->
<ImportarExcelModal
  v-model="modalImportar"
  titulo="Importar docentes"
  :columnas="['CI', 'Nombre', 'Apellido', 'Especialidad', 'Email', 'Telefono']"
  :plantilla="docenteApi.plantilla"
  nombre-plantilla="plantilla_docentes.xlsx"
  :importar="onImportar"
  @completado="onImportacionCompletada"
/>
</template>
