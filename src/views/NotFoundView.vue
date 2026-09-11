<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { homeSegunRol } from '@/router'

const router = useRouter()
const auth = useAuthStore()

function volver() {
  if (auth.estaAutenticado && auth.roles.length > 0) {
    router.push(homeSegunRol(auth.roles))
  } else {
    router.push('/login')
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-base-200">
    <div class="text-center space-y-4">
      <h1 class="text-8xl font-bold text-primary">404</h1>
      <p class="text-xl text-base-content/70">Página no encontrada</p>
      <button class="btn btn-primary" @click="volver">
        Volver al inicio
      </button>
    </div>
  </div>
</template>