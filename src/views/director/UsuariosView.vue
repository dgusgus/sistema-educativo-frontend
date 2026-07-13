<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usuarioApi, type ConPerfilPayload } from '@/api/usuario.api'
import { docenteApi } from '@/api/docente.api'
import { estudianteApi } from '@/api/estudiante.api'
import { useGestionStore } from '@/stores/gestion.store'
import type { Rol } from '@/types'

// ─── ¿Por qué esta vista existe? ──────────────────────────────────────────────
// El Director es el administrador del sistema. Necesita poder:
//   1. Ver quién tiene acceso al sistema y con qué rol
//   2. Crear cuentas para cualquier rol (con o sin perfil)
//   3. Desactivar cuentas sin borrarlas (conserva el historial)
//   4. Resetear contraseñas cuando alguien se olvida
//   5. Ver los perfiles aunque no tengan cuenta aún
// Todo esto en un solo lugar, sin tener que navegar a 5 vistas distintas.

const gestion = useGestionStore()

// ─── Tab activo ───────────────────────────────────────────────────────────────
// ¿Por qué tabs en lugar de 5 vistas separadas?
// Los datos de cada tab son independientes — Directores no comparte nada
// con Tutores. Pero el patrón de interacción es idéntico: lista, buscar,
// crear, asignar cuenta. Un solo componente con tabs evita duplicar 5 veces
// la misma lógica de modal y formulario.
type TabRol = 'DIRECTOR' | 'SECRETARIA' | 'DOCENTE' | 'ESTUDIANTE' | 'TUTOR'
const tabActivo = ref<TabRol>('DIRECTOR')

const tabs: Array<{ rol: TabRol; label: string }> = [
  { rol: 'DIRECTOR',   label: 'Directores'  },
  { rol: 'SECRETARIA', label: 'Secretarias' },
  { rol: 'DOCENTE',    label: 'Docentes'    },
  { rol: 'ESTUDIANTE', label: 'Estudiantes' },
  { rol: 'TUTOR',      label: 'Tutores'     },
]

// ─── Datos por tab ────────────────────────────────────────────────────────────
// ¿Por qué un objeto indexado por rol en lugar de un array plano?
// Porque al cambiar de tab no queremos recargar — si el Director ya vio
// Docentes y luego va a Secretarias y vuelve, los docentes siguen ahí
// sin otra llamada al backend. Cada tab tiene su propio estado cacheado.
interface PerfilItem {
  id: number
  nombre: string
  apellido: string
  ci: string
  activo?: boolean
  especialidad?: string | null
  parentesco?: string | null
  telefono?: string | null
  email?: string | null
  // activo es opcional porque Estudiante.usuario no siempre lo incluye
  usuario?: { id: number; username: string; activo?: boolean } | null
  // Para estudiantes: última inscripción
  inscripciones?: Array<{ curso?: { nombre: string }; estadoInscripcion: string }>
}

const datos = ref<Record<TabRol, PerfilItem[]>>({
  DIRECTOR:   [],
  SECRETARIA: [],
  DOCENTE:    [],
  ESTUDIANTE: [],
  TUTOR:      [],
})
const cargados = ref<Record<TabRol, boolean>>({
  DIRECTOR: false, SECRETARIA: false,
  DOCENTE: false, ESTUDIANTE: false, TUTOR: false,
})
const cargando  = ref(false)
const error     = ref<string | null>(null)
const busqueda  = ref('')

// ─── Carga por tab ────────────────────────────────────────────────────────────
// ¿Por qué cargar solo cuando el tab se activa y no todo de una?
// Porque el Director puede que solo necesite ver Secretarias — no tiene
// sentido traer 200 estudiantes si no los va a mirar. Carga bajo demanda.
async function cargarTab(rol: TabRol) {
  if (cargados.value[rol]) return   // ya cargado, no repetir
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
      // Directores, Secretarias y Tutores se traen desde /usuarios?rol=X
      // ¿Por qué? Porque no tienen endpoints propios de listado en el api layer
      // (salvo /directores y /secretarias que solo el Director puede llamar,
      //  pero el store de usuarios ya los agrupa). Usamos el endpoint unificado.
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

// ─── Filtro local ─────────────────────────────────────────────────────────────
const listaFiltrada = computed(() => {
  const q     = busqueda.value.toLowerCase().trim()
  const items = datos.value[tabActivo.value]
  if (!q) return items
  return items.filter(p =>
    `${p.nombre} ${p.apellido} ${p.ci}`.toLowerCase().includes(q)
  )
})

// ─── Modal crear con cuenta ───────────────────────────────────────────────────
// ¿Por qué un solo modal para todos los roles?
// El formulario base (nombre, apellido, CI, username, password) es igual
// para todos. Solo cambian 1-2 campos extra según el rol.
// Reutilizar el modal evita duplicar 5 modales casi idénticos.
const modalConCuenta   = ref(false)
const creandoCuenta    = ref(false)
const errorCuenta      = ref<string | null>(null)
const credenciales     = ref<{ username: string; password: string } | null>(null)

const formCuenta = ref({
  ci: '', nombre: '', apellido: '',
  telefono: '', email: '',
  // Campos específicos por rol
  especialidad: '',    // DOCENTE
  parentesco:   '',    // TUTOR
  gestionId:    '' as number | '',  // DIRECTOR
  // Cuenta
  username: '', password: '',
})

function abrirConCuenta() {
  formCuenta.value  = {
    ci: '', nombre: '', apellido: '', telefono: '', email: '',
    especialidad: '', parentesco: '',
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
    const payload: ConPerfilPayload = {
      rol:      tabActivo.value,
      username: f.username,
      password: f.password,
      perfil: {
        ci:      f.ci,
        nombre:  f.nombre,
        apellido: f.apellido,
        telefono: f.telefono || undefined,
        email:    f.email    || undefined,
        // Campos opcionales por rol
        ...(tabActivo.value === 'DOCENTE'    && { especialidad: f.especialidad || undefined }),
        ...(tabActivo.value === 'TUTOR'      && { parentesco:   f.parentesco   || undefined }),
        ...(tabActivo.value === 'DIRECTOR'   && { gestionId:    f.gestionId    ? Number(f.gestionId) : undefined }),
      },
    }
    const resultado    = await usuarioApi.createConPerfil(payload)
    credenciales.value = resultado.credenciales
    // Invalidar cache del tab actual para que recargue con el nuevo registro
    cargados.value[tabActivo.value] = false
    await cargarTab(tabActivo.value)
  } catch (e) {
    errorCuenta.value = e instanceof Error ? e.message : 'Error al crear'
  } finally {
    creandoCuenta.value = false
  }
}

// ─── Modal resetear contraseña ────────────────────────────────────────────────
// ¿Por qué resetear y no "cambiar contraseña"?
// PUT /auth/password requiere que el usuario sepa su contraseña actual.
// PUT /usuarios/:id/resetear es para cuando alguien olvida su contraseña
// y el Director le genera una nueva temporal — sin necesitar la anterior.
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
  } catch (e) {
    errorReset.value = e instanceof Error ? e.message : 'Error al resetear'
  } finally {
    reseteando.value = false
  }
}

// ─── Activar / desactivar cuenta ─────────────────────────────────────────────
// ¿Por qué desactivar en lugar de eliminar?
// Eliminar una cuenta borra el historial de quién hizo qué en el sistema
// (quién registró tal asistencia, quién creó tal pago). Desactivar
// conserva toda la auditoría pero impide el acceso. El backend lo maneja
// con el campo "activo" en Usuario.
const toggeandoActivo = ref<number | null>(null)

async function toggleActivo(p: PerfilItem) {
  if (!p.usuario) return
  toggeandoActivo.value = p.usuario.id
  try {
    const estadoActual = p.usuario.activo ?? true
    await usuarioApi.update(p.usuario.id, { activo: !estadoActual })
    // Actualizar localmente sin recargar toda la lista
    p.usuario.activo = !estadoActual
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cambiar estado'
  } finally {
    toggeandoActivo.value = null
  }
}

// ─── Helpers de display ───────────────────────────────────────────────────────
// ¿Para qué el label del tab activo?
// Para mostrar en el encabezado de la tabla qué tipo de persona estamos viendo.
const labelActivo = computed(() =>
  tabs.find(t => t.rol === tabActivo.value)?.label ?? ''
)

// ¿Para qué mostrar campo extra según el rol?
// Docente tiene "especialidad", Tutor tiene "parentesco". En lugar de columnas
// fijas que queden vacías para roles sin ese campo, mostramos una columna
// dinámica con el dato relevante del rol activo.
function campoExtra(p: PerfilItem): string {
  if (tabActivo.value === 'DOCENTE') return p.especialidad ?? '—'
  if (tabActivo.value === 'TUTOR')   return p.parentesco   ?? '—'
  if (tabActivo.value === 'ESTUDIANTE') {
    const insc = p.inscripciones?.[0]
    return insc ? `${insc.curso?.nombre ?? '—'} · ${insc.estadoInscripcion}` : 'Sin inscripción'
  }
  return p.email ?? p.telefono ?? '—'
}

function labelCampoExtra(): string {
  if (tabActivo.value === 'DOCENTE')    return 'Especialidad'
  if (tabActivo.value === 'TUTOR')      return 'Parentesco'
  if (tabActivo.value === 'ESTUDIANTE') return 'Curso actual'
  return 'Contacto'
}
</script>

<template>
  <div class="space-y-4">

    <!-- Encabezado -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <h2 class="text-2xl font-bold flex-1">Usuarios del sistema</h2>
      <!-- Solo se puede crear desde tabs que tienen perfil propio.
           Estudiantes los gestiona la Secretaria — el Director solo los ve. -->
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
          <!-- Skeleton -->
          <tr v-if="cargando" v-for="i in 5" :key="i">
            <td colspan="6"><div class="skeleton h-4 w-full"></div></td>
          </tr>
          <!-- Sin resultados -->
          <tr v-else-if="listaFiltrada.length === 0">
            <td colspan="6" class="text-center text-base-content/40 py-8">
              No se encontraron {{ labelActivo.toLowerCase() }}
            </td>
          </tr>
          <!-- Filas -->
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
              <!-- ¿Por qué toggle en lugar de dropdown?
                   Desactivar/activar es una acción binaria — un toggle
                   es más rápido que abrir un menú para elegir entre dos opciones.
                   Se deshabilita si no tiene cuenta porque sin cuenta no hay
                   estado de acceso que cambiar. -->
              <!-- activo ?? true: si no viene el campo asumimos activo
                   para no mostrar el toggle apagado sin razón -->
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
                <!-- Resetear contraseña: solo si tiene cuenta -->
                <button
                  v-if="p.usuario"
                  class="btn btn-ghost btn-xs"
                  @click="abrirReset(p)"
                >
                  Reset pass
                </button>
                <!-- Los estudiantes los crea y edita la Secretaria —
                     el Director solo puede ver y resetear su contraseña -->
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

      <!-- Pantalla de éxito con credenciales -->
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

      <!-- Formulario -->
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

        <fieldset v-if="tabActivo === 'TUTOR'" class="fieldset">
          <legend class="fieldset-legend text-xs">Parentesco</legend>
          <input v-model="formCuenta.parentesco" type="text" placeholder="Ej: Madre, Padre, Tutor legal" class="input input-bordered w-full" :disabled="creandoCuenta" />
        </fieldset>

        <!-- Para Director: asignar a la gestión activa -->
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