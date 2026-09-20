<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
// ── agregar al <script setup> ──
import { useTheme } from '@/composables/useTheme'
const { tema, alternar } = useTheme()

const router = useRouter()
const route  = useRoute()
const auth   = useAuthStore()

// ─── Estado del formulario ────────────────────────────────────────────────────

const username  = ref('')
const password  = ref('')
const cargando  = ref(false)
const error     = ref<string | null>(null)
const mostrarPassword = ref(false)

// ─── Submit ───────────────────────────────────────────────────────────────────
//
// 1. Valida que los campos no estén vacíos
// 2. Llama a auth.login() que internamente hace POST /api/auth/login
// 3. Si hay sesión guardada con ?redirect=, vuelve ahí
//    Si no, va al dashboard correspondiente al rol (o al primero, si tiene varios)

async function handleLogin() {
  error.value = null

  if (!username.value.trim() || !password.value.trim()) {
    error.value = 'Ingresa tu usuario y contraseña'
    return
  }

  cargando.value = true

  try {
    await auth.login(username.value.trim(), password.value)

    const redirect = route.query.redirect as string | undefined

    if (redirect) {
      await router.push(redirect)
    } else if (auth.roles.length > 0) {
      const { homeSegunRol } = await import('@/router')
      await router.push(homeSegunRol(auth.roles))
    }
  } catch (e) {
    error.value = e instanceof Error
      ? e.message
      : 'Error al iniciar sesión'
  } finally {
    cargando.value = false
  }
}

// Perfiles habilitados — solo texto descriptivo en el panel izquierdo,
// NO es un selector: el rol lo determina el backend según la cuenta
// (auth.controller.ts → login), no se elige antes de autenticarse.
const PERFILES = [
  { nombre: 'Dirección',  detalle: 'Gestión integral del colegio' },
  { nombre: 'Secretaría', detalle: 'Inscripciones, pagos y boletines' },
  { nombre: 'Docentes',   detalle: 'Asistencia y calificaciones' },
  { nombre: 'Familias',   detalle: 'Seguimiento de estudiantes' },
]

const CREDENCIALES_PRUEBA = [
  { u: 'director',   p: 'admin1234', r: 'Director' },
  { u: 'secretaria', p: 'sec1234',   r: 'Secretaria' },
  { u: 'doc_mamani', p: 'doc1234',   r: 'Docente' },
  { u: 'est_ana',    p: 'est1234',   r: 'Estudiante' },
  { u: 'tut_rosa',   p: 'tut1234',   r: 'Tutor' },
]
const esDesarrollo = import.meta.env.DEV

function usarCredencial(c: { u: string; p: string }) {
  username.value = c.u
  password.value = c.p
}
</script>

<template>
<!-- ── reemplazar la línea `<div class="min-h-screen bg-base-200 flex items-center justify-center p-4">` por esto ── -->
<div class="min-h-screen bg-base-200 flex items-center justify-center p-4 relative overflow-hidden">

  <!-- Fondo decorativo — dos manchas difuminadas, sin dependencias nuevas -->
  <div class="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-primary/10 blur-3xl pointer-events-none"></div>
  <div class="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-secondary/10 blur-3xl pointer-events-none"></div>

  <!-- Toggle de tema, esquina superior derecha -->
  <button
    type="button"
    class="btn btn-ghost btn-circle absolute top-4 right-4 z-10"
    :aria-label="tema === 'colegio' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'"
    @click="alternar"
  >
    <svg v-if="tema === 'colegio'" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  </button>

  <div class="w-full max-w-4xl bg-base-100 rounded-box shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10">
    <!-- el resto del card queda exactamente igual -->

      <!-- ── Panel institucional — el mismo tratamiento del encabezado del boletín PDF ── -->
<div class="lg:col-span-5 bg-primary text-primary-content p-8 lg:p-10 flex flex-col justify-between relative overflow-hidden">

  <!-- Watermark de fondo -->
  <svg class="absolute -right-8 -bottom-8 h-48 w-48 text-primary-content/5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0121 18.75c-2.674.616-5.322.616-8-.001v-3.749M12 14l-9-5m9 5v.001" />
  </svg>

  <div class="relative">
    <!-- Logo + nombre -->
    <div class="flex items-center gap-3 mb-6">
      <div class="w-11 h-11 rounded-box bg-primary-content/10 border border-primary-content/15 flex items-center justify-center shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0121 18.75c-2.674.616-5.322.616-8-.001v-3.749M12 14l-9-5m9 5v.001" />
        </svg>
      </div>
      <div>
        <p class="text-[10px] uppercase tracking-wide text-primary-content/60 font-display">Plataforma Académica</p>
        <h1 class="font-display text-base font-bold leading-tight">U.E. "Los Ángeles<br>de Nazaria Ignacia"</h1>
      </div>
    </div>

    <!-- Badge "portal unificado" -->
    <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-content/10 border border-primary-content/15 text-xs mb-4">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      Portal de Autenticación Unificado
    </div>

    <h2 class="font-display text-2xl font-bold leading-snug">
      Gestión Curricular, Calificaciones y Asistencia
    </h2>
    <p class="text-sm text-primary-content/80 leading-relaxed mt-3">
      Acceso seguro para Dirección, Secretaría, Docentes, Estudiantes y
      Tutores, alineado a la Ley de Educación N.º 070 "Avelino Siñani -
      Elizardo Pérez".
    </p>
  </div>

  <!-- Perfiles habilitados — mismos íconos que el sidebar de cada rol -->
  <div class="relative my-6">
    <p class="text-[10px] uppercase tracking-wide text-primary-content/60 font-display mb-2">Perfiles habilitados</p>
    <div class="grid grid-cols-2 gap-2 text-xs">
      <div class="flex items-center gap-2 p-2.5 rounded-field bg-primary-content/5 border border-primary-content/10">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        <span>Dirección &amp; Admin</span>
      </div>
      <div class="flex items-center gap-2 p-2.5 rounded-field bg-primary-content/5 border border-primary-content/10">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>Cuerpo Docente</span>
      </div>
      <div class="flex items-center gap-2 p-2.5 rounded-field bg-primary-content/5 border border-primary-content/10">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>Tutores / Familias</span>
      </div>
      <div class="flex items-center gap-2 p-2.5 rounded-field bg-primary-content/5 border border-primary-content/10">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span>Estudiantes</span>
      </div>
    </div>
  </div>

  <p class="relative text-xs text-primary-content/60">
    Urb. Bustillos, Zona Los Ángeles — Oruro, Bolivia · RUE 81230370
  </p>
</div>

      <!-- ── Formulario real ────────────────────────────────────────────────────── -->
      <div class="lg:col-span-7 p-8 lg:p-10 flex flex-col justify-center gap-6">
        <div>
          <h2 class="font-display text-xl font-bold text-base-content">Iniciar sesión</h2>
          <p class="text-sm text-base-content/60 mt-1">Ingresa con tu usuario y contraseña institucionales.</p>
        </div>

        <div v-if="error" role="alert" class="alert alert-error py-2 text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"/>
          </svg>
          <span>{{ error }}</span>
        </div>

        <form class="space-y-4" @submit.prevent="handleLogin">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Usuario</legend>
            <input
              v-model="username"
              type="text"
              placeholder="Ej: director"
              class="input input-bordered w-full"
              autocomplete="username"
              :disabled="cargando"
            />
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Contraseña</legend>
            <div class="relative">
              <input
                v-model="password"
                :type="mostrarPassword ? 'text' : 'password'"
                placeholder="••••••••"
                class="input input-bordered w-full pr-10"
                autocomplete="current-password"
                :disabled="cargando"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
                @click="mostrarPassword = !mostrarPassword"
              >
                <svg v-if="!mostrarPassword" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              </button>
            </div>
          </fieldset>

          <button type="submit" class="btn btn-primary w-full" :disabled="cargando">
            <span v-if="cargando" class="loading loading-spinner loading-sm"></span>
            <span>{{ cargando ? 'Ingresando...' : 'Ingresar' }}</span>
          </button>
        </form>

        <!-- Credenciales de prueba — SOLO en build de desarrollo -->
        <div v-if="esDesarrollo" class="collapse collapse-arrow bg-base-200 text-xs rounded-field">
          <input type="checkbox" />
          <div class="collapse-title font-medium py-2 min-h-0">
            Credenciales de prueba (solo desarrollo)
          </div>
          <div class="collapse-content">
            <table class="table table-xs">
              <thead>
                <tr><th>Usuario</th><th>Contraseña</th><th>Rol</th></tr>
              </thead>
              <tbody>
                <tr v-for="c in CREDENCIALES_PRUEBA" :key="c.u">
                  <td>
                    <button type="button" class="link link-primary" @click="usarCredencial(c)">{{ c.u }}</button>
                  </td>
                  <td class="font-mono">{{ c.p }}</td>
                  <td>{{ c.r }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>