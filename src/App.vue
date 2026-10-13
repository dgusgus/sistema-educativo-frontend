<script setup lang="ts">
// App.vue es el componente raíz — actúa como contenedor del router más
// los dos "singletons" globales de UI: el contenedor de toasts y el
// modal de confirmación (ver stores/toast.store.ts y
// composables/useConfirm.ts). Cualquier vista los usa sin tener que
// declarar nada propio.
import ToastContainer from '@/components/ToastContainer.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Transition name="page" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
  <ToastContainer />
  <ConfirmDialog />
</template>