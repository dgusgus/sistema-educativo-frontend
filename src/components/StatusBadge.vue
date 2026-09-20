<script setup lang="ts">
type Estado = 'APROBADO' | 'PROMOVIDO' | 'AL_DIA' | 'PAGADO'
            | 'REPROBADO' | 'MOROSO'
            | 'PENDIENTE' | 'RETRASO' | 'JUSTIFICADO'

const props = defineProps<{ estado: Estado | string; texto?: string }>()

const ESTILO: Record<string, string> = {
  APROBADO: 'badge-success', PROMOVIDO: 'badge-success', AL_DIA: 'badge-success', PAGADO: 'badge-success',
  REPROBADO: 'badge-error',  MOROSO: 'badge-error',
  PENDIENTE: 'badge-warning', RETRASO: 'badge-warning', JUSTIFICADO: 'badge-warning',
}

const claseClase = ESTILO[props.estado] ?? 'badge-neutral'
</script>

<template>
  <span class="badge badge-sm" :class="claseClase">{{ texto ?? estado }}</span>
</template>