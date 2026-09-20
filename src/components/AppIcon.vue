<script setup lang="ts">
import { ICONOS, type NombreIcono } from '@/lib/icons'

defineProps<{
  nombre: NombreIcono
}>()
</script>

<template>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="ICONOS[nombre]" />
  </svg>
</template>