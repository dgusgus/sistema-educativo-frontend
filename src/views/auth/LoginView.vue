<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useTheme } from '@/composables/useTheme'
const { tema, alternar } = useTheme()

const router = useRouter()
const route  = useRoute()
const auth   = useAuthStore()

const username  = ref('')
const password  = ref('')
const cargando  = ref(false)
// Si el interceptor cerró la sesión por un 401, deja el motivo en sessionStorage
// ("Sesión expirada", "cuenta desactivada"...) y aquí se muestra una sola vez.
const motivoSesion = sessionStorage.getItem('motivoSesion')
sessionStorage.removeItem('motivoSesion')
const error     = ref<string | null>(motivoSesion)
const mostrarPassword = ref(false)

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

const PERFILES = [
  { nombre: 'Dirección',  detalle: 'Gestión integral', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { nombre: 'Secretaría', detalle: 'Pagos y boletines', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { nombre: 'Docentes',   detalle: 'Notas y asistencia', icon: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0121 18.75c-2.674.616-5.322.616-8-.001v-3.749M12 14l-9-5m9 5v.001' },
  { nombre: 'Familias',   detalle: 'Seguimiento', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
]

// SOLO en desarrollo: en el build de producción Vite sustituye
// import.meta.env.DEV por false y el arreglo (con las contraseñas) desaparece del
// bundle. Antes quedaba en texto plano en dist/assets/LoginView-*.js aunque el
// panel estuviera oculto con v-if.
const CREDENCIALES_PRUEBA: { u: string; p: string; r: string }[] = import.meta.env.DEV ? [
  { u: 'director',   p: 'admin1234', r: 'Director' },
  { u: 'secretaria', p: 'sec1234',   r: 'Secretaria' },
  { u: 'doc_mamani', p: 'doc1234',   r: 'Docente' },
  { u: 'est_ana',    p: 'est1234',   r: 'Estudiante' },
  { u: 'tut_rosa',   p: 'tut1234',   r: 'Tutor' },
] : []
const esDesarrollo = import.meta.env.DEV

function usarCredencial(c: { u: string; p: string }) {
  username.value = c.u
  password.value = c.p
}
</script>

<template>
<div class="login-root min-h-screen bg-base-200 lg:grid lg:grid-cols-[1.08fr_1fr] relative overflow-hidden">

  <!-- Fondo global sutil -->
  <div class="pointer-events-none absolute inset-0" aria-hidden="true">
    <div class="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl"></div>
    <div class="absolute -bottom-40 right-1/3 h-[28rem] w-[28rem] rounded-full bg-secondary/10 blur-3xl"></div>
    <div class="login-grid absolute inset-0 opacity-50"></div>
  </div>

  <!-- ═════════ PANEL INSTITUCIONAL (desktop) ═════════ -->
  <aside class="panel-enter relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#0C2743] text-white p-10 xl:p-14">
    <!-- Capas decorativas -->
    <div class="absolute inset-0" aria-hidden="true">
      <div class="absolute inset-0" style="background: radial-gradient(1100px 500px at 15% 0%, #2E6DA455 0%, transparent 60%), radial-gradient(800px 600px at 110% 100%, #C9A22722 0%, transparent 55%), linear-gradient(180deg, #102E4F 0%, #0C2743 55%, #081B30 100%);"></div>
      <div class="andean-pattern absolute inset-0 opacity-[0.12]"></div>
      <div class="absolute -right-24 -bottom-24 h-[26rem] w-[26rem] rounded-full border-[28px] border-white/[0.04]"></div>
      <div class="absolute -right-10 -bottom-10 h-[18rem] w-[18rem] rounded-full border border-[#C9A227]/20"></div>
      <p class="absolute -bottom-6 left-6 font-display font-extrabold text-[6rem] leading-none tracking-tighter text-white/[0.06] select-none">NAZARIA</p>
    </div>
    <div class="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#C9A227] via-[#E8C86A] to-[#C9A227]" aria-hidden="true"></div>

    <!-- Cabecera -->
    <div class="relative">
      <div class="flex items-center gap-4">
        <div class="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 border border-white/15 shadow-[0_12px_28px_-12px_rgba(0,0,0,0.55)]">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-[#E8C86A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0121 18.75c-2.674.616-5.322.616-8-.001v-3.749M12 14l-9-5m9 5v.001" />
          </svg>
        </div>
        <div>
          <p class="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-[#E8C86A]">Plataforma Académica</p>
          <h1 class="font-display text-xl font-bold leading-tight text-white">U.E. “Los Ángeles<br class="hidden xl:block" /> de Nazaria Ignacia”</h1>
          <p class="mt-1 text-xs text-white/70">Oruro · Bolivia — Ley N.º 070</p>
        </div>
      </div>
    </div>

    <!-- Mensaje central -->
    <div class="relative max-w-xl mt-10">
      <h2 class="font-display text-4xl xl:text-[2.9rem] font-extrabold leading-[1.08] tracking-tight text-white text-balance">
        Formamos con<br />
        <span class="text-[#E8C86A]">disciplina, fe</span> y<br />
        excelencia académica.
      </h2>
      <p class="mt-4 max-w-md text-[15px] leading-relaxed text-white/75">
        Acceso seguro para Dirección, Secretaría, Docentes, Estudiantes y Tutores.
        Calificaciones, asistencia, pagos y boletines en un solo lugar.
      </p>

      <ul class="mt-7 grid max-w-md grid-cols-2 gap-2.5" aria-label="Perfiles de acceso">
        <li v-for="p in PERFILES" :key="p.nombre" class="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3 transition hover:border-[#C9A227]/40 hover:bg-white/[0.08]">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#C9A227]/15 text-[#E8C86A]">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" :d="p.icon" />
            </svg>
          </span>
          <span>
            <span class="block text-[13px] font-semibold leading-tight text-white">{{ p.nombre }}</span>
            <span class="block text-[11px] text-white/70">{{ p.detalle }}</span>
          </span>
        </li>
      </ul>
    </div>

    <!-- Pie del panel -->
    <div class="relative mt-10 flex items-end justify-between gap-6">
      <div class="flex gap-8">
        <div><p class="font-display text-2xl font-extrabold tracking-tight text-white">1.2k<span class="text-[#E8C86A]">+</span></p><p class="text-[11px] uppercase tracking-wider text-white/60">Estudiantes</p></div>
        <div class="border-l border-white/10 pl-8"><p class="font-display text-2xl font-extrabold tracking-tight text-white">48</p><p class="text-[11px] uppercase tracking-wider text-white/60">Docentes</p></div>
        <div class="border-l border-white/10 pl-8"><p class="font-display text-2xl font-extrabold tracking-tight text-white">100<span class="text-[#E8C86A]">%</span></p><p class="text-[11px] uppercase tracking-wider text-white/60">Ley 070</p></div>
      </div>
      <div class="hidden xl:block text-right">
        <p class="inline-flex items-center gap-2 text-[11px] text-white/70">
          <span class="relative flex h-2 w-2">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
          </span>
          Portal unificado · Gestión 2026
        </p>
        <p class="mt-1 text-[11px] leading-relaxed text-white/60">Urb. Bustillos, Zona Los Ángeles<br />RUE 81230370 · Oruro</p>
      </div>
    </div>
  </aside>

  <!-- ═════════ COLUMNA FORMULARIO ═════════ -->
  <main class="relative flex items-center justify-center px-4 py-10 sm:px-8">
    <button
      type="button"
      class="btn btn-ghost btn-circle absolute top-4 right-4 border border-base-300 bg-base-100/80"
      :aria-label="tema === 'colegio' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'"
      :aria-pressed="tema !== 'colegio'"
      @click="alternar"
      title="Cambiar tema"
    >
      <svg v-if="tema === 'colegio'" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    </button>

    <div class="form-enter w-full max-w-[26rem]">
      <!-- Marca móvil -->
      <div class="lg:hidden mb-6 flex items-center gap-3">
        <div class="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-content shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0121 18.75c-2.674.616-5.322.616-8-.001v-3.749M12 14l-9-5m9 5v.001" />
          </svg>
        </div>
        <div>
          <p class="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">U.E. Los Ángeles de Nazaria Ignacia</p>
          <p class="text-xs text-base-content/60">Oruro · Bolivia</p>
        </div>
      </div>

      <section class="login-card card bg-base-100 border border-base-300 rounded-3xl overflow-hidden" aria-labelledby="login-titulo">
        <div class="h-[3px] bg-gradient-to-r from-primary via-secondary to-[#C9A227]" aria-hidden="true"></div>
        <div class="p-7 sm:p-8">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 id="login-titulo" class="font-display text-[22px] font-extrabold tracking-tight text-base-content text-balance">Bienvenido de nuevo</h2>
              <p class="mt-1.5 text-sm text-base-content/65">Ingresa con tu usuario institucional.</p>
            </div>
            <span class="badge badge-outline badge-sm shrink-0 mt-1 border-primary/25 text-primary">2026</span>
          </div>

          <div v-if="error" :key="error" role="alert" aria-live="assertive" class="alert alert-error mt-5 py-2.5 text-sm login-shake">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"/>
            </svg>
            <span>{{ error }}</span>
          </div>

          <form class="mt-6 space-y-4" @submit.prevent="handleLogin" novalidate>
            <div>
              <label for="login-user" class="mb-1.5 block text-[13px] font-semibold text-base-content/80">Usuario</label>
              <div class="group relative">
                <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40 transition group-focus-within:text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <input
                  id="login-user"
                  v-model="username"
                  type="text"
                  placeholder="Ej: director"
                  class="input input-bordered w-full h-12 rounded-xl pl-11 bg-base-200/50 transition focus:bg-base-100 focus:border-primary placeholder:text-base-content/45"
                  autocomplete="username"
                  autofocus
                  required
                  aria-required="true"
                  :aria-invalid="error ? 'true' : undefined"
                  :disabled="cargando"
                />
              </div>
            </div>

            <div>
              <div class="mb-1.5 flex items-center justify-between">
                <label for="login-pass" class="block text-[13px] font-semibold text-base-content/80">Contraseña</label>
                <span class="text-[11px] text-base-content/50">Mín. 8 caracteres</span>
              </div>
              <div class="group relative">
                <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40 transition group-focus-within:text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  id="login-pass"
                  v-model="password"
                  :type="mostrarPassword ? 'text' : 'password'"
                  placeholder="••••••••"
                  class="input input-bordered w-full h-12 rounded-xl pl-11 pr-12 bg-base-200/50 transition focus:bg-base-100 focus:border-primary placeholder:text-base-content/45"
                  autocomplete="current-password"
                  required
                  aria-required="true"
                  :aria-invalid="error ? 'true' : undefined"
                  :disabled="cargando"
                />
                <button
                  type="button"
                  class="absolute right-2 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-lg text-base-content/50 transition hover:bg-base-300 hover:text-base-content"
                  @click="mostrarPassword = !mostrarPassword"
                  :aria-label="mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  :aria-pressed="mostrarPassword"
                  :disabled="cargando"
                >
                  <svg v-if="!mostrarPassword" xmlns="http://www.w3.org/2000/svg" class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                </button>
              </div>
            </div>

            <button type="submit" class="btn-login group relative h-12 w-full rounded-xl bg-primary font-display text-[15px] font-bold text-white shadow-[0_16px_32px_-16px_rgba(26,60,94,0.6)] transition hover:-translate-y-px hover:shadow-[0_20px_40px_-16px_rgba(26,60,94,0.65)] active:translate-y-0 disabled:opacity-70 disabled:pointer-events-none" :disabled="cargando" :aria-busy="cargando">
              <span class="relative z-10 flex items-center justify-center gap-2" aria-live="polite">
                <span v-if="cargando" class="loading loading-spinner loading-sm"></span>
                <span>{{ cargando ? 'Verificando...' : 'Ingresar al sistema' }}</span>
                <svg v-if="!cargando" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>
          </form>

          <div class="mt-5 flex items-center gap-3 text-[11px] text-base-content/55">
            <span class="h-px flex-1 bg-base-300"></span>
            <span class="inline-flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Conexión segura · Tus datos están protegidos
            </span>
            <span class="h-px flex-1 bg-base-300"></span>
          </div>

          <details v-if="esDesarrollo" class="mt-4 rounded-2xl border border-dashed border-base-300 bg-base-200/60 text-xs">
            <summary class="cursor-pointer select-none px-4 py-2.5 font-semibold text-base-content/70 hover:text-base-content">Credenciales de prueba (solo desarrollo)</summary>
            <div class="px-4 pb-3">
              <div class="overflow-hidden rounded-xl border border-base-300 bg-base-100">
                <table class="table table-xs">
                  <thead>
                    <tr><th>Usuario</th><th>Contraseña</th><th>Rol</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="c in CREDENCIALES_PRUEBA" :key="c.u" class="hover">
                      <td><button type="button" class="link link-primary font-medium" @click="usarCredencial(c)">{{ c.u }}</button></td>
                      <td class="font-mono">{{ c.p }}</td>
                      <td>{{ c.r }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p class="mt-1.5 text-[11px] text-base-content/55">Clic en un usuario para autocompletar.</p>
            </div>
          </details>
        </div>
      </section>

      <p class="mt-5 text-center text-xs text-base-content/55">
        ¿Olvidaste tu contraseña? <span class="font-medium text-base-content/75">Contacta a Secretaría o Dirección.</span>
      </p>
    </div>
  </main>
</div>
</template>

<style scoped>
.font-display { font-family: var(--font-display); }

.login-root::selection { background: #C9A227; color: #0C2743; }

.login-grid {
  background-image:
    linear-gradient(to right, rgb(26 60 94 / 0.06) 1px, transparent 1px),
    linear-gradient(to bottom, rgb(26 60 94 / 0.06) 1px, transparent 1px);
  background-size: 36px 36px;
  mask-image: radial-gradient(ellipse 90% 80% at 50% 20%, black 30%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse 90% 80% at 50% 20%, black 30%, transparent 75%);
}

.andean-pattern {
  background-image: url("data:image/svg+xml,%3Csvg width='72' height='72' viewBox='0 0 72 72' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='white' stroke-width='1'%3E%3Cpath d='M36 8l10 10-10 10-10-10z'/%3E%3Cpath d='M8 36l10 10 10-10-10-10zM44 36l10 10 10-10-10-10z'/%3E%3Ccircle cx='36' cy='58' r='3'/%3E%3Ccircle cx='36' cy='36' r='1.5' fill='white'/%3E%3C/g%3E%3C/svg%3E");
  background-size: 72px 72px;
}

.login-card {
  box-shadow: 0 24px 60px -24px rgba(26,60,94,0.35), 0 2px 8px -2px rgba(26,60,94,0.12);
}

/* Un solo momento de entrada: panel funde, formulario eleva */
@keyframes panelFade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes formRise {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
.panel-enter { animation: panelFade .8s ease-out both; }
.form-enter { animation: formRise .65s cubic-bezier(.22,1,.36,1) both; }

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}
.login-shake { animation: shake .4s ease; }

.btn-login { border: none; cursor: pointer; }
.btn-login:focus-visible { outline: 2px solid #C9A227; outline-offset: 2px; }

/* Superficies de navegador: foco, caret, autofill, seleccion */
.login-root input { caret-color: var(--color-primary); }
.login-root :focus-visible {
  outline: 2px solid #C9A227;
  outline-offset: 2px;
}
.login-root input:-webkit-autofill,
.login-root input:-webkit-autofill:hover,
.login-root input:-webkit-autofill:focus {
  -webkit-text-fill-color: var(--color-base-content);
  caret-color: var(--color-base-content);
  transition: background-color 9999s ease-in-out 0s;
}
.login-root details summary::marker { color: var(--color-primary); }

@media (prefers-reduced-motion: reduce) {
  .panel-enter, .form-enter, .login-shake { animation: none; }
  .login-root * { transition: none !important; }
}
</style>
