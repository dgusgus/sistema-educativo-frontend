<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

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

  // Validación básica antes de llamar al backend
  if (!username.value.trim() || !password.value.trim()) {
    error.value = 'Ingresa tu usuario y contraseña'
    return
  }

  cargando.value = true

  try {
    await auth.login(username.value.trim(), password.value)

    // ¿Había una ruta pendiente antes de ser mandado al login?
    const redirect = route.query.redirect as string | undefined

    if (redirect) {
      await router.push(redirect)
    } else if (auth.roles.length > 0) {
      // Importamos el helper del router para saber a dónde ir
      const { homeSegunRol } = await import('@/router')
      await router.push(homeSegunRol(auth.roles))
    }
  } catch (e) {
    // El interceptor de Axios ya extrajo el mensaje del backend
    error.value = e instanceof Error
      ? e.message
      : 'Error al iniciar sesión'
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-base-200 flex items-center justify-center p-4">
    <div class="card bg-base-100 shadow-xl w-full max-w-sm">
      <div class="card-body gap-6">

        <!-- Encabezado -->
        <div class="text-center space-y-1">
          <h1 class="text-xl font-bold text-base-content">
            Sistema Educativo
          </h1>
          <p class="text-xs text-base-content/60 leading-snug">
            Unidad Educativa Los Ángeles<br>de Nazaria Ignacia
          </p>
        </div>

        <!-- Alerta de error -->
        <div v-if="error" role="alert" class="alert alert-error py-2 text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"/>
          </svg>
          <span>{{ error }}</span>
        </div>

        <!-- Formulario -->
        <form class="space-y-4" @submit.prevent="handleLogin">

          <!-- Usuario -->
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

          <!-- Contraseña -->
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
                <!-- Ojo abierto / cerrado -->
                <svg v-if="!mostrarPassword" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              </button>
            </div>
          </fieldset>

          <!-- Botón submit -->
          <button
            type="submit"
            class="btn btn-primary w-full"
            :disabled="cargando"
          >
            <span v-if="cargando" class="loading loading-spinner loading-sm"></span>
            <span>{{ cargando ? 'Ingresando...' : 'Ingresar' }}</span>
          </button>
        </form>

        <!-- Credenciales de prueba (solo desarrollo) -->
        <div v-if="true" class="collapse collapse-arrow bg-base-200 text-xs">
          <input type="checkbox" />
          <div class="collapse-title font-medium py-2 min-h-0">
            Credenciales de prueba
          </div>
          <div class="collapse-content">
            <table class="table table-xs">
              <thead>
                <tr><th>Usuario</th><th>Contraseña</th><th>Rol</th></tr>
              </thead>
              <tbody>
                <tr v-for="c in [
                  { u: 'director',   p: 'admin1234', r: 'Director' },
                  { u: 'secretaria', p: 'sec1234',   r: 'Secretaria' },
                  { u: 'doc_mamani', p: 'doc1234',   r: 'Docente' },
                  { u: 'est_ana',    p: 'est1234',   r: 'Estudiante' },
                  { u: 'tut_rosa',   p: 'tut1234',   r: 'Tutor' },
                ]" :key="c.u">
                  <td>
                    <button
                      class="link link-primary"
                      @click="username = c.u; password = c.p"
                    >{{ c.u }}</button>
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