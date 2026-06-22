<script setup lang="ts">
// App.vue es el componente raíz — solo actúa como contenedor del router.
// Toda la lógica de layout, auth y navegación vive en sus propias capas.
</script>

<template>
  <Transition name="page" mode="out-in">
    <RouterView />
  </Transition>
</template>