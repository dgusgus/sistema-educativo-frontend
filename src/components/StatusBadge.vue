<script setup lang="ts">
type Estado = 'APROBADO' | 'PROMOVIDO' | 'AL_DIA' | 'PAGADO'
            | 'REPROBADO' | 'MOROSO'
            | 'PENDIENTE' | 'RETRASO' | 'JUSTIFICADO'
            | 'ANULADO'

const props = withDefaults(defineProps<{
  estado: Estado | string
  texto?: string
  tamano?: 'xs' | 'sm' | 'md'
}>(), {
  tamano: 'sm',
})

const ESTILO: Record<string, string> = {
  APROBADO: 'badge-success', PROMOVIDO: 'badge-success', AL_DIA: 'badge-success', PAGADO: 'badge-success',
  REPROBADO: 'badge-error',  MOROSO: 'badge-error',
  PENDIENTE: 'badge-warning', RETRASO: 'badge-warning', JUSTIFICADO: 'badge-warning',
  ANULADO: 'badge-ghost',
}

const claseEstado = ESTILO[props.estado] ?? 'badge-neutral'
</script>

<template>
  <span class="badge" :class="[claseEstado, `badge-${tamano}`]">{{ texto ?? estado }}</span>
</template>