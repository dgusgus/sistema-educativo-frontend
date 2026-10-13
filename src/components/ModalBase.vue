<script setup lang="ts">
// Envoltorio común de los modales (dialog de daisyUI): título, subtítulo opcional,
// alerta de error y cierre al hacer clic fuera. Antes cada modal repetía ~12 líneas
// idénticas de esto.
defineProps<{
  abierto: boolean
  titulo: string
  subtitulo?: string
  error?: string | null
}>()
defineEmits<{ (e: 'cerrar'): void }>()
</script>

<template>
  <dialog :open="abierto" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg" :class="subtitulo ? 'mb-1' : 'mb-4'">{{ titulo }}</h3>
      <p v-if="subtitulo" class="text-sm text-base-content/60 mb-4">{{ subtitulo }}</p>
      <div v-if="error" role="alert" class="alert alert-error mb-4 py-2 text-sm"><span>{{ error }}</span></div>
      <slot />
    </div>
    <form method="dialog" class="modal-backdrop" @click="$emit('cerrar')"><button>cerrar</button></form>
  </dialog>
</template>
