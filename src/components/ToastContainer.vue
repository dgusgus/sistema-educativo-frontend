<script setup lang="ts">
import { useToastStore } from '@/stores/toast.store'
const toastStore = useToastStore()

const claseAlerta: Record<string, string> = {
  success: 'alert-success',
  error:   'alert-error',
  info:    'alert-info',
  warning: 'alert-warning',
}

const icono: Record<string, string> = {
  success: 'M5 13l4 4L19 7',
  error:   'M6 18L18 6M6 6l12 12',
  info:    'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  warning: 'M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
}
</script>

<template>
  <div class="toast toast-end toast-bottom z-[100] gap-2">
    <TransitionGroup name="toast">
      <div
        v-for="t in toastStore.toasts"
        :key="t.id"
        role="alert"
        class="alert shadow-lg text-sm py-2 pr-2"
        :class="claseAlerta[t.tipo]"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="icono[t.tipo]" />
        </svg>
        <span>{{ t.mensaje }}</span>
        <button class="btn btn-ghost btn-xs" @click="toastStore.cerrar(t.id)">✕</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(20px); }
</style>