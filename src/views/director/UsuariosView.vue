<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usuarioApi, type ConPerfilPayload } from '@/api/usuario.api'
import { docenteApi } from '@/api/docente.api'
import { estudianteApi } from '@/api/estudiante.api'
import { useGestionStore } from '@/stores/gestion.store'
import { useToastStore } from '@/stores/toast.store'
import type { Rol, Nivel } from '@/types'

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
  nombre: string
  apellido: string
  ci: string
  activo?: boolean
  especialidad?:     string | null   // DOCENTE
  ocupacion?:        string | null   // TUTOR
  gradoInstruccion?: string | null   // TUTOR
  telefono?: string | null
  email?: string | null
  usuario?: { id: number; username: string; activo?: boolean } | null
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

// ⚠️ Limitación real del backend: GET /estudiantes (lista) NO incluye
// "usuario" en absoluto (solo GET /estudiantes/:id lo trae) — por eso en
// el tab Estudiantes el badge de cuenta y "Reset pass" nunca se muestran,
// aunque el estudiante SÍ tenga cuenta. Si hace falta, habría que agregar
// `usuario: { select: {...} }` al include de getEstudiantes en el backend.
async function cargarTab(rol: TabRol) {
  if (cargados.value[rol]) return
  cargando.value = true
  error.value    = null
  busqueda.value = ''
  try {
    let items: PerfilItem[] = []
    if (rol === 'DOCENTE') {
      items = await docenteApi.getAll()
    } else if (rol === 'ESTUDIANTE') {
      items = await estudianteApi.getAll()
    } else {
      // Directores, Secretarias y Tutores vía el endpoint unificado
      const lista = await usuarioApi.getAll({ rol })
      items = lista.map(u => ({
        id:       u.perfil?.id      ?? u.id,
        nombre:   u.perfil?.nombre  ?? '—',
        apellido: u.perfil?.apellido ?? '—',
        ci:       u.perfil?.ci      ?? '—',
        activo:   u.activo,
        usuario:  { id: u.id, username: u.username, activo: u.activo },
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
          {{ datos[t.rol].length }}
        </span>
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" role="alert" class="alert alert-error">
      <span>{{ error }}</span>
      <button class="btn btn-sm btn-ghost" @click="cargarTab(tabActivo)">Reintentar</button>
    </div>

    <!-- Buscador -->
    <label class="input input-bordered flex items-center gap-2 max-w-sm">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
      </svg>
      <input v-model="busqueda" type="search" :placeholder="`Buscar en ${labelActivo}...`" class="grow" />
    </label>

    <!-- Tabla -->
    <div class="card bg-base-100 shadow overflow-x-auto">
      <table class="table table-sm">
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
          <tr v-if="cargando" v-for="i in 5" :key="i">
            <td colspan="6"><div class="skeleton h-4 w-full"></div></td>
          </tr>
          <tr v-else-if="listaFiltrada.length === 0">
            <td colspan="6" class="text-center text-base-content/40 py-8">
              No se encontraron {{ labelActivo.toLowerCase() }}
            </td>
          </tr>
          <tr v-else v-for="p in listaFiltrada" :key="p.id" class="hover">
            <td class="font-medium">{{ p.apellido }}, {{ p.nombre }}</td>
            <td class="font-mono text-sm">{{ p.ci }}</td>
            <td class="text-sm text-base-content/70">{{ campoExtra(p) }}</td>
            <td>
              <span v-if="p.usuario" class="badge badge-sm badge-success font-mono">
                {{ p.usuario.username }}
              </span>
              <span v-else class="badge badge-sm badge-ghost">Sin cuenta</span>
            </td>
            <td>
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
            <td>
              <div class="flex gap-1">
                <button
                  v-if="p.usuario"
                  class="btn btn-ghost btn-xs"
                  @click="abrirReset(p)"
                >
                  Reset pass
                </button>
                <span v-if="tabActivo === 'ESTUDIANTE' && !p.usuario" class="text-xs text-base-content/30">
                  Gestionado por Secretaría
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="!cargando && cargados[tabActivo]" class="text-xs text-base-content/40">
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
          <input v-model="formCuenta.ci" type="text" class="input input-bordered w-full" :disabled="creandoCuenta" />
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
</template>