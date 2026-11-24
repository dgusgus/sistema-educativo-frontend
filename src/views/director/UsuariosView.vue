<script setup lang="ts">
import CiInput from '@/components/CiInput.vue'
import { ref, computed, onMounted } from 'vue'
import { usuarioApi, type ConPerfilPayload } from '@/api/usuario.api'
import { docenteApi } from '@/api/docente.api'
import { estudianteApi } from '@/api/estudiante.api'
import { useListaPaginada, type PaginaRespuesta } from '@/composables/useListaPaginada'
import PaginadorTabla from '@/components/PaginadorTabla.vue'
import { useGestionStore } from '@/stores/gestion.store'
import { useToastStore } from '@/stores/toast.store'
import type { Rol, Nivel } from '@/types'
import AppIcon from '@/components/AppIcon.vue'

const toast = useToastStore()

const gestion = useGestionStore()

type TabRol = 'DIRECTOR' | 'SECRETARIA' | 'DOCENTE' | 'ESTUDIANTE' | 'TUTOR'
const tabActivo = ref<TabRol>('DIRECTOR')

const tabs: Array<{ rol: TabRol; label: string }> = [
  { rol: 'DIRECTOR',   label: 'Directores'  },
  { rol: 'SECRETARIA', label: 'Secretarias' },
  { rol: 'DOCENTE',    label: 'Docentes'    },
  { rol: 'ESTUDIANTE', label: 'Estudiantes' },
  { rol: 'TUTOR',      label: 'Tutores'     },
]

// Cada tab cachea su propio estado — cambiar de tab no recarga si ya se vio.
interface PerfilItem {
  id: number
  personaId?: number
  nombre: string
  apellido: string
  ci: string
  activo?: boolean
  especialidad?:     string | null   // DOCENTE
  ocupacion?:        string | null   // TUTOR
  gradoInstruccion?: string | null   // TUTOR
  telefono?: string | null
  email?: string | null
  usuario?: { id: number; username: string; activo?: boolean; roles?: Rol[] } | null
  // ⚠️ Curso embebido sin "nombre" calculado — ver estudiante.controller.ts
  // (select solo trae nivel/grado/paralelo, no turno ni conNombre())
  inscripciones?: Array<{ curso?: { nivel: Nivel; grado: number; paralelo: string }; estadoInscripcion: string }>
}

const datos = ref<Record<TabRol, PerfilItem[]>>({
  DIRECTOR: [], SECRETARIA: [], DOCENTE: [], ESTUDIANTE: [], TUTOR: [],
})
const cargados = ref<Record<TabRol, boolean>>({
  DIRECTOR: false, SECRETARIA: false, DOCENTE: false, ESTUDIANTE: false, TUTOR: false,
})
const cargando  = ref(false)
const error     = ref<string | null>(null)
const busqueda  = ref('')

// Estudiantes: ~900 y crecen cada año → paginados y buscados EN EL SERVIDOR
// (las demás pestañas son listas cortas y siguen filtrándose en el navegador).
const estPag = useListaPaginada<PerfilItem>({
  pedir: p => estudianteApi.getPage(p) as unknown as Promise<PaginaRespuesta<PerfilItem>>,
})
const esEstudiantes  = computed(() => tabActivo.value === 'ESTUDIANTE')
const cargandoVista  = computed(() => esEstudiantes.value ? estPag.cargando.value : cargando.value)
const errorVista     = computed(() => esEstudiantes.value ? estPag.error.value : error.value)
const busquedaVista  = computed({
  get: () => esEstudiantes.value ? estPag.busqueda.value : busqueda.value,
  set: v => { if (esEstudiantes.value) estPag.busqueda.value = v; else busqueda.value = v },
})
const cantidadTab = (rol: TabRol) => rol === 'ESTUDIANTE' ? estPag.total.value : datos.value[rol].length

// ⚠️ Limitación real del backend: GET /estudiantes (lista) NO incluye
// "usuario" en absoluto (solo GET /estudiantes/:id lo trae) — por eso en
// el tab Estudiantes el badge de cuenta y "Reset pass" nunca se muestran,
// aunque el estudiante SÍ tenga cuenta. Si hace falta, habría que agregar
// `usuario: { select: {...} }` al include de getEstudiantes en el backend.
async function cargarTab(rol: TabRol) {
  if (cargados.value[rol]) return
  if (rol === 'ESTUDIANTE') {
    await estPag.refiltrar()
    cargados.value[rol] = !estPag.error.value
    return
  }
  cargando.value = true
  error.value    = null
  busqueda.value = ''
  try {
    let items: PerfilItem[] = []
    if (rol === 'DOCENTE') {
      items = await docenteApi.getAll()
    } else {
      // Directores, Secretarias y Tutores vía el endpoint unificado
      const lista = await usuarioApi.getAll({ rol })
      items = lista.map(u => ({
        id:       u.perfil?.id      ?? u.id,
        nombre:   u.perfil?.nombre  ?? '—',
        apellido: u.perfil?.apellido ?? '—',
        ci:       u.perfil?.ci      ?? '—',
        activo:   u.activo,
        usuario:  { id: u.id, username: u.username, activo: u.activo, roles: u.roles },
      }))
    }
    datos.value[rol]    = items
    cargados.value[rol] = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : `Error al cargar ${rol}`
  } finally {
    cargando.value = false
  }
}

function cambiarTab(rol: TabRol) {
  tabActivo.value = rol
  busqueda.value  = ''
  cargarTab(rol)
}

onMounted(async () => {
  await gestion.cargar()
  await cargarTab('DIRECTOR')
})

const listaFiltrada = computed(() => {
  if (esEstudiantes.value) return estPag.items.value   // ya viene filtrado y paginado
  const q     = busqueda.value.toLowerCase().trim()
  const items = datos.value[tabActivo.value]
  if (!q) return items
  return items.filter(p =>
    `${p.nombre} ${p.apellido} ${p.ci}`.toLowerCase().includes(q)
  )
})

// ─── Modal crear con cuenta ───────────────────────────────────────────────────
const modalConCuenta   = ref(false)
const creandoCuenta    = ref(false)
const errorCuenta      = ref<string | null>(null)
const credenciales     = ref<{ username: string; password: string } | null>(null)

const formCuenta = ref({
  ci: '', nombre: '', apellido: '',
  telefono: '', email: '',
  // Campos específicos por rol (✅ ocupacion/gradoInstruccion — parentesco
  // NO va acá, vive en TutorEstudiante y se define al vincular un estudiante)
  especialidad:     '',    // DOCENTE
  ocupacion:        '',    // TUTOR
  gradoInstruccion: '',    // TUTOR
  gestionId:        '' as number | '',  // DIRECTOR
  username: '', password: '',
})

function abrirConCuenta() {
  formCuenta.value  = {
    ci: '', nombre: '', apellido: '', telefono: '', email: '',
    especialidad: '', ocupacion: '', gradoInstruccion: '',
    gestionId: gestion.gestionId ?? '',
    username: '', password: '',
  }
  errorCuenta.value  = null
  credenciales.value = null
  modalConCuenta.value = true
}

async function crearConCuenta() {
  const f = formCuenta.value
  if (!f.ci || !f.nombre || !f.apellido || !f.username || !f.password) {
    errorCuenta.value = 'CI, nombre, apellido, username y contraseña son obligatorios'
    return
  }
  if (f.password.length < 6) {
    errorCuenta.value = 'La contraseña debe tener al menos 6 caracteres'
    return
  }
  creandoCuenta.value = true
  errorCuenta.value   = null
  try {
    const rolActual: Rol = tabActivo.value
    const payload: ConPerfilPayload = {
      roles:    [rolActual],
      username: f.username,
      password: f.password,
      persona: {
        ci:       f.ci,
        nombre:   f.nombre,
        apellido: f.apellido,
        telefono: f.telefono || undefined,
        email:    f.email    || undefined,
      },
      datosPorRol: {
        ...(rolActual === 'DOCENTE' && { DOCENTE: { especialidad: f.especialidad || undefined } }),
        ...(rolActual === 'TUTOR'   && { TUTOR: { ocupacion: f.ocupacion || undefined, gradoInstruccion: f.gradoInstruccion || undefined } }),
        ...(rolActual === 'DIRECTOR' && { DIRECTOR: { gestionId: f.gestionId ? Number(f.gestionId) : undefined } }),
      },
    }
    const resultado    = await usuarioApi.createConPerfil(payload)
    credenciales.value = resultado.credenciales
    cargados.value[tabActivo.value] = false
    await cargarTab(tabActivo.value)
  } catch (e) {
    errorCuenta.value = e instanceof Error ? e.message : 'Error al crear'
  } finally {
    creandoCuenta.value = false
  }
}

// ─── Modal resetear contraseña ────────────────────────────────────────────────
const modalReset      = ref(false)
const reseteando      = ref(false)
const errorReset      = ref<string | null>(null)
const nuevaPassword   = ref('')
const usuarioAResetear = ref<PerfilItem | null>(null)

function abrirReset(p: PerfilItem) {
  usuarioAResetear.value = p
  nuevaPassword.value    = ''
  errorReset.value       = null
  modalReset.value       = true
}

async function resetear() {
  if (nuevaPassword.value.length < 6) {
    errorReset.value = 'La contraseña debe tener al menos 6 caracteres'
    return
  }
  if (!usuarioAResetear.value?.usuario?.id) return
  reseteando.value = true
  errorReset.value = null
  try {
    await usuarioApi.resetearPassword(usuarioAResetear.value.usuario.id, nuevaPassword.value)
    modalReset.value = false
    toast.success('Contraseña reseteada correctamente')
  } catch (e) {
    errorReset.value = e instanceof Error ? e.message : 'Error al resetear'
  } finally {
    reseteando.value = false
  }
}

// ─── Activar / desactivar cuenta ─────────────────────────────────────────────
const toggeandoActivo = ref<number | null>(null)

async function toggleActivo(p: PerfilItem) {
  if (!p.usuario) return
  toggeandoActivo.value = p.usuario.id
  try {
    const estadoActual = p.usuario.activo ?? true
    await usuarioApi.update(p.usuario.id, { activo: !estadoActual })
    p.usuario.activo = !estadoActual
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cambiar estado'
  } finally {
    toggeandoActivo.value = null
  }
}


// ─── Habilitar / quitar rol (la misma persona con varios roles) ──────────────
type RolPersonal = 'DIRECTOR' | 'SECRETARIA' | 'DOCENTE'
const ETIQUETA_ROL: Record<RolPersonal, string> = { DIRECTOR: 'Director', SECRETARIA: 'Secretaria', DOCENTE: 'Docente' }

// Roles que se le pueden sumar a una fila según la pestaña donde está
const rolesSumables = computed<RolPersonal[]>(() => {
  switch (tabActivo.value) {
    case 'DIRECTOR':   return ['DOCENTE']
    case 'SECRETARIA': return ['DOCENTE']
    case 'DOCENTE':    return ['DIRECTOR', 'SECRETARIA']
    default:           return []
  }
})
const esRolPersonal = (r: string): r is RolPersonal => r in ETIQUETA_ROL
const otrosRoles = (p: PerfilItem) =>
  (p.usuario?.roles ?? []).filter(r => r !== tabActivo.value && esRolPersonal(r)) as RolPersonal[]
const puedeQuitarRol = (p: PerfilItem) =>
  esRolPersonal(tabActivo.value) && (p.usuario?.roles?.length ?? 0) > 1 && (p.usuario?.roles ?? []).includes(tabActivo.value)

const modalRol      = ref(false)
const guardandoRol  = ref(false)
const errorRol      = ref<string | null>(null)
const filaRol       = ref<PerfilItem | null>(null)
const rolAHabilitar = ref<RolPersonal>('DOCENTE')
const formRol       = ref({ especialidad: '', username: '', password: '' })
const credencialesRol = ref<{ username: string; password: string } | null>(null)

function abrirHabilitar(p: PerfilItem, rol: RolPersonal) {
  filaRol.value       = p
  rolAHabilitar.value = rol
  formRol.value       = { especialidad: '', username: '', password: '' }
  errorRol.value      = null
  credencialesRol.value = null
  modalRol.value      = true
}

// Hay que pedir usuario/contraseña solo si la persona todavía no tiene cuenta
const necesitaCuenta = computed(() => !filaRol.value?.usuario)

async function habilitarRol() {
  const p = filaRol.value
  if (!p) return
  if (necesitaCuenta.value && (!formRol.value.username || formRol.value.password.length < 6)) {
    errorRol.value = 'Esta persona no tiene cuenta: indica usuario y contraseña (mín. 6 caracteres)'
    return
  }
  guardandoRol.value = true
  errorRol.value     = null
  try {
    const r = await usuarioApi.habilitarRol({
      ...(p.usuario ? { usuarioId: p.usuario.id } : { personaId: p.personaId }),
      rol:          rolAHabilitar.value,
      especialidad: rolAHabilitar.value === 'DOCENTE' ? (formRol.value.especialidad || undefined) : undefined,
      username:     necesitaCuenta.value ? formRol.value.username : undefined,
      password:     necesitaCuenta.value ? formRol.value.password : undefined,
    })
    toast.success(r.mensaje)
    credencialesRol.value = r.credenciales
    // Recargar todas las pestañas: la persona ahora aparece también en otra
    cargados.value = { DIRECTOR: false, SECRETARIA: false, DOCENTE: false, ESTUDIANTE: cargados.value.ESTUDIANTE, TUTOR: false }
    await cargarTab(tabActivo.value)
    if (!r.credenciales) modalRol.value = false
  } catch (e) {
    errorRol.value = e instanceof Error ? e.message : 'No se pudo habilitar el rol'
  } finally {
    guardandoRol.value = false
  }
}

async function quitarRol(p: PerfilItem) {
  if (!p.usuario || !esRolPersonal(tabActivo.value)) return
  const rol = tabActivo.value
  if (!confirm(`¿Quitar el rol de ${ETIQUETA_ROL[rol]} a ${p.nombre} ${p.apellido}? Conservará su cuenta y sus otros roles, y sus datos históricos.`)) return
  try {
    await usuarioApi.quitarRol(p.usuario.id, rol)
    cargados.value[rol] = false
    await cargarTab(rol)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo quitar el rol'
  }
}

// ─── Helpers de display ───────────────────────────────────────────────────────
const labelActivo = computed(() =>
  tabs.find(t => t.rol === tabActivo.value)?.label ?? ''
)

const NIVEL_TEXTO: Record<Nivel, string> = { PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
function nombreCursoCorto(c: { nivel: Nivel; grado: number; paralelo: string }): string {
  return `${c.grado}° ${NIVEL_TEXTO[c.nivel]} "${c.paralelo}"`
}

function campoExtra(p: PerfilItem): string {
  if (tabActivo.value === 'DOCENTE') return p.especialidad ?? '—'
  if (tabActivo.value === 'TUTOR')   return p.ocupacion ?? '—'
  if (tabActivo.value === 'ESTUDIANTE') {
    const insc = p.inscripciones?.[0]
    return insc?.curso ? `${nombreCursoCorto(insc.curso)} · ${insc.estadoInscripcion}` : 'Sin inscripción'
  }
  return p.email ?? p.telefono ?? '—'
}

function labelCampoExtra(): string {
  if (tabActivo.value === 'DOCENTE')    return 'Especialidad'
  if (tabActivo.value === 'TUTOR')      return 'Ocupación'
  if (tabActivo.value === 'ESTUDIANTE') return 'Curso actual'
  return 'Contacto'
}
</script>

<template>
  <div class="space-y-4">

    <!-- Encabezado -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <h2 class="text-2xl font-bold flex-1">Usuarios del sistema</h2>
      <button
        v-if="tabActivo !== 'ESTUDIANTE'"
        class="btn btn-primary btn-sm"
        @click="abrirConCuenta"
      >
        + Nuevo {{ labelActivo.slice(0, -1) }}
      </button>
    </div>

    <!-- Tabs por rol -->
    <div role="tablist" class="tabs tabs-boxed w-fit">
      <button
        v-for="t in tabs"
        :key="t.rol"
        role="tab"
        class="tab"
        :class="{ 'tab-active': tabActivo === t.rol }"
        @click="cambiarTab(t.rol)"
      >
        {{ t.label }}
        <span v-if="cargados[t.rol]" class="ml-1 badge badge-xs badge-ghost">
          {{ cantidadTab(t.rol) }}
        </span>
      </button>
    </div>

    <!-- Error -->
    <div v-if="errorVista" role="alert" class="alert alert-error">
      <span>{{ errorVista }}</span>
      <button class="btn btn-sm btn-ghost" @click="cargarTab(tabActivo)">Reintentar</button>
    </div>

    <!-- Buscador -->
    <label class="input input-bordered flex items-center gap-2 max-w-sm">
<AppIcon nombre="buscar" class="h-4 w-4 opacity-50" />
      <input v-model="busquedaVista" type="search" :placeholder="`Buscar en ${labelActivo}...`" class="grow" />
    </label>

    <!-- Tabla -->
    <div class="card bg-base-100 shadow overflow-x-auto">
      <table class="table table-sm tabla-cards">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>CI</th>
            <th>{{ labelCampoExtra() }}</th>
            <th>Cuenta</th>
            <th>Estado cuenta</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cargandoVista" v-for="i in 5" :key="i">
            <td colspan="6"><div class="skeleton h-4 w-full"></div></td>
          </tr>
          <tr v-else-if="listaFiltrada.length === 0">
            <td colspan="6" class="text-center text-base-content/40 py-8">
              No se encontraron {{ labelActivo.toLowerCase() }}
            </td>
          </tr>
          <tr v-else v-for="p in listaFiltrada" :key="p.id" class="hover">
            <td data-label="" class="font-medium">
              {{ p.apellido }}, {{ p.nombre }}
              <span v-for="r in otrosRoles(p)" :key="r" class="badge badge-xs badge-info ml-1">también {{ ETIQUETA_ROL[r].toLowerCase() }}</span>
            </td>
            <td data-label="CI" class="font-mono text-sm">{{ p.ci }}</td>
            <td :data-label="labelCampoExtra()" class="text-sm text-base-content/70">{{ campoExtra(p) }}</td>
            <td data-label="Cuenta">
              <span v-if="p.usuario" class="badge badge-sm badge-success font-mono">
                {{ p.usuario.username }}
              </span>
              <span v-else class="badge badge-sm badge-ghost">Sin cuenta</span>
            </td>
            <td data-label="Estado cuenta">
              <input
                v-if="p.usuario"
                type="checkbox"
                class="toggle toggle-sm toggle-success"
                :checked="p.usuario.activo ?? true"
                :disabled="toggeandoActivo === p.usuario.id"
                @change="toggleActivo(p)"
              />
              <span v-else class="text-base-content/30 text-xs">—</span>
            </td>
            <td data-label="">
              <div class="flex gap-1">
                <button
                  v-if="p.usuario"
                  class="btn btn-ghost btn-xs"
                  @click="abrirReset(p)"
                >
                  Reset pass
                </button>
                <template v-if="!esEstudiantes">
                  <button
                    v-for="r in rolesSumables.filter(x => !otrosRoles(p).includes(x))"
                    :key="r"
                    class="btn btn-ghost btn-xs text-info"
                    :title="`Habilitar a esta misma persona como ${ETIQUETA_ROL[r].toLowerCase()} (sin volver a crear sus datos)`"
                    @click="abrirHabilitar(p, r)"
                  >
                    + {{ ETIQUETA_ROL[r] }}
                  </button>
                  <button v-if="puedeQuitarRol(p)" class="btn btn-ghost btn-xs text-error" @click="quitarRol(p)">
                    Quitar rol
                  </button>
                </template>
                <span v-if="tabActivo === 'ESTUDIANTE' && !p.usuario" class="text-xs text-base-content/30">
                  Gestionado por Secretaría
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <PaginadorTabla
      v-if="esEstudiantes"
      :pagina="estPag.pagina.value" :total-paginas="estPag.totalPaginas.value"
      :desde="estPag.desde.value" :hasta="estPag.hasta.value" :total="estPag.total.value"
      :limite="estPag.limite.value" :cargando="estPag.cargando.value"
      @ir="estPag.irAPagina" @limite="estPag.cambiarLimite" />
    <p v-else-if="!cargando && cargados[tabActivo]" class="text-xs text-base-content/40">
      {{ listaFiltrada.length }} {{ labelActivo.toLowerCase() }} encontrado(s)
    </p>
  </div>

  <!-- ── Modal crear con cuenta ────────────────────────────────────────────── -->
  <dialog :open="modalConCuenta" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">
        Nuevo {{ labelActivo.slice(0, -1).toLowerCase() }}
      </h3>
      <p class="text-sm text-base-content/60 mb-4">
        Se crea el perfil y la cuenta de acceso en una sola operación.
      </p>

      <div v-if="credenciales" class="space-y-4">
        <div role="alert" class="alert alert-success">
          <span>Creado correctamente</span>
        </div>
        <div class="bg-base-200 rounded-lg p-4 space-y-2">
          <p class="text-sm font-semibold">Credenciales de acceso:</p>
          <p class="font-mono text-sm">Usuario: <strong>{{ credenciales.username }}</strong></p>
          <p class="font-mono text-sm">Contraseña: <strong>{{ credenciales.password }}</strong></p>
          <p class="text-xs text-base-content/50 mt-2">Compartí estas credenciales de forma segura.</p>
        </div>
        <div class="modal-action">
          <button class="btn btn-primary" @click="modalConCuenta = false; credenciales = null">Cerrar</button>
        </div>
      </div>

      <form v-else class="space-y-3" @submit.prevent="crearConCuenta">
        <div v-if="errorCuenta" role="alert" class="alert alert-error py-2 text-sm">
          <span>{{ errorCuenta }}</span>
        </div>

        <div class="divider text-xs">Datos personales</div>

        <div class="grid grid-cols-2 gap-3">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Nombre *</legend>
            <input v-model="formCuenta.nombre" type="text" class="input input-bordered w-full" :disabled="creandoCuenta" />
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Apellido *</legend>
            <input v-model="formCuenta.apellido" type="text" class="input input-bordered w-full" :disabled="creandoCuenta" />
          </fieldset>
        </div>

        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">CI *</legend>
          <CiInput v-model="formCuenta.ci" :disabled="creandoCuenta" />
        </fieldset>

        <div class="grid grid-cols-2 gap-3">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Teléfono</legend>
            <input v-model="formCuenta.telefono" type="tel" class="input input-bordered w-full" :disabled="creandoCuenta" />
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Email</legend>
            <input v-model="formCuenta.email" type="email" class="input input-bordered w-full" :disabled="creandoCuenta" />
          </fieldset>
        </div>

        <!-- Campo extra según rol -->
        <fieldset v-if="tabActivo === 'DOCENTE'" class="fieldset">
          <legend class="fieldset-legend text-xs">Especialidad</legend>
          <input v-model="formCuenta.especialidad" type="text" placeholder="Ej: Matemáticas" class="input input-bordered w-full" :disabled="creandoCuenta" />
        </fieldset>

        <!-- ✅ Tutor: ocupacion/gradoInstruccion (parentesco se define al
             vincular un estudiante, no acá — ver tutor.controller.ts) -->
        <div v-if="tabActivo === 'TUTOR'" class="grid grid-cols-2 gap-3">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Ocupación</legend>
            <input v-model="formCuenta.ocupacion" type="text" class="input input-bordered w-full" :disabled="creandoCuenta" />
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Grado de instrucción</legend>
            <input v-model="formCuenta.gradoInstruccion" type="text" placeholder="Ej: Secundaria completa" class="input input-bordered w-full" :disabled="creandoCuenta" />
          </fieldset>
        </div>

        <fieldset v-if="tabActivo === 'DIRECTOR'" class="fieldset">
          <legend class="fieldset-legend text-xs">Gestión a cargo</legend>
          <select v-model="formCuenta.gestionId" class="select select-bordered w-full" :disabled="creandoCuenta">
            <option value="">Sin asignar por ahora</option>
            <option v-if="gestion.gestion" :value="gestion.gestion.id">
              {{ gestion.anio }} (activa)
            </option>
          </select>
          <p class="text-xs text-base-content/50 mt-1">
            También podés asignarlo después desde Gestiones.
          </p>
        </fieldset>

        <div class="divider text-xs">Cuenta de acceso</div>

        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Username *</legend>
          <input v-model="formCuenta.username" type="text" autocomplete="off" class="input input-bordered w-full" :disabled="creandoCuenta" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Contraseña * (mín. 6 caracteres)</legend>
          <input v-model="formCuenta.password" type="password" autocomplete="new-password" class="input input-bordered w-full" :disabled="creandoCuenta" />
        </fieldset>

        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="creandoCuenta" @click="modalConCuenta = false">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="creandoCuenta">
            <span v-if="creandoCuenta" class="loading loading-spinner loading-sm"></span>
            Crear {{ labelActivo.slice(0, -1).toLowerCase() }}
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalConCuenta = false; credenciales = null">
      <button>cerrar</button>
    </form>
  </dialog>

  <!-- ── Modal resetear contraseña ─────────────────────────────────────────── -->
  <dialog :open="modalReset" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Resetear contraseña</h3>
      <p class="text-sm text-base-content/60 mb-4">
        Usuario: <strong class="font-mono">{{ usuarioAResetear?.usuario?.username }}</strong>
        · {{ usuarioAResetear?.nombre }} {{ usuarioAResetear?.apellido }}
      </p>

      <div v-if="errorReset" role="alert" class="alert alert-error mb-4 py-2 text-sm">
        <span>{{ errorReset }}</span>
      </div>

      <form class="space-y-3" @submit.prevent="resetear">
        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Nueva contraseña * (mín. 6 caracteres)</legend>
          <input
            v-model="nuevaPassword"
            type="password"
            autocomplete="new-password"
            class="input input-bordered w-full"
            :disabled="reseteando"
          />
        </fieldset>
        <p class="text-xs text-base-content/50">
          El usuario deberá cambiarla desde su perfil la próxima vez que ingrese.
        </p>

        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="reseteando" @click="modalReset = false">Cancelar</button>
          <button type="submit" class="btn btn-warning" :disabled="reseteando">
            <span v-if="reseteando" class="loading loading-spinner loading-sm"></span>
            Resetear
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalReset = false">
      <button>cerrar</button>
    </form>
  </dialog>
  <!-- ── Modal habilitar rol ───────────────────────────────────────────────── -->
  <dialog :open="modalRol" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">Habilitar como {{ ETIQUETA_ROL[rolAHabilitar].toLowerCase() }}</h3>
      <p class="text-sm text-base-content/60 mb-4">
        {{ filaRol?.nombre }} {{ filaRol?.apellido }} · CI {{ filaRol?.ci }}.
        Se reutilizan sus mismos datos; no hace falta volver a registrarla/o.
      </p>

      <div v-if="credencialesRol" role="status" class="alert alert-success mb-4 text-sm">
        <div>
          <p class="font-semibold">Cuenta creada. Comparte estas credenciales:</p>
          <p class="font-mono">{{ credencialesRol.username }} / {{ credencialesRol.password }}</p>
        </div>
      </div>
      <template v-if="!credencialesRol">
        <div v-if="errorRol" role="alert" class="alert alert-error mb-4 py-2 text-sm"><span>{{ errorRol }}</span></div>
        <form class="space-y-3" @submit.prevent="habilitarRol">
          <fieldset v-if="rolAHabilitar === 'DOCENTE'" class="fieldset">
            <legend class="fieldset-legend text-xs">Especialidad (opcional)</legend>
            <input v-model="formRol.especialidad" class="input input-bordered w-full" :disabled="guardandoRol" />
          </fieldset>
          <template v-if="necesitaCuenta">
            <p class="text-xs text-base-content/60">Esta persona aún no tiene cuenta de acceso; se creará una.</p>
            <fieldset class="fieldset">
              <legend class="fieldset-legend text-xs">Usuario *</legend>
              <input v-model="formRol.username" class="input input-bordered w-full" autocomplete="off" :disabled="guardandoRol" />
            </fieldset>
            <fieldset class="fieldset">
              <legend class="fieldset-legend text-xs">Contraseña * (mín. 6)</legend>
              <input v-model="formRol.password" type="password" autocomplete="new-password" class="input input-bordered w-full" :disabled="guardandoRol" />
            </fieldset>
          </template>
          <p v-else class="text-xs text-base-content/60">
            Usará su misma cuenta ({{ filaRol?.usuario?.username }}); al volver a iniciar sesión podrá cambiar entre sus roles.
          </p>
          <div class="modal-action mt-6">
            <button type="button" class="btn btn-ghost" :disabled="guardandoRol" @click="modalRol = false">Cancelar</button>
            <button type="submit" class="btn btn-primary" :disabled="guardandoRol">
              <span v-if="guardandoRol" class="loading loading-spinner loading-sm"></span>
              Habilitar rol
            </button>
          </div>
        </form>
      </template>
      <div v-else class="modal-action">
        <button class="btn btn-primary" @click="modalRol = false">Cerrar</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="modalRol = false"><button>cerrar</button></form>
  </dialog>
</template>