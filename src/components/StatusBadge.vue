<script setup lang="ts">
type Estado = 'APROBADO' | 'PROMOVIDO' | 'AL_DIA' | 'PAGADO' | 'ACTIVA' | 'PROMOVER' | 'ACTIVO' | 'ABIERTO'
            | 'REPROBADO' | 'MOROSO' | 'RETIRADA' | 'CERRADO'
            | 'PENDIENTE' | 'RETRASO' | 'JUSTIFICADO' | 'TRANSFERIDA' | 'REPETIR_CURSO'
            | 'ANULADO' | 'CONCLUIDA' | 'INACTIVO'

const props = withDefaults(defineProps<{
  estado: Estado | string
  texto?: string
  tamano?: 'xs' | 'sm' | 'md'
}>(), {
  tamano: 'sm',
})

const ESTILO: Record<string, string> = {
  APROBADO: 'badge-success', PROMOVIDO: 'badge-success', AL_DIA: 'badge-success', PAGADO: 'badge-success', ACTIVA: 'badge-success', PROMOVER: 'badge-success', ACTIVO: 'badge-success', ABIERTO: 'badge-success',
  REPROBADO: 'badge-error',  MOROSO: 'badge-error', RETIRADA: 'badge-error', CERRADO: 'badge-error',
  PENDIENTE: 'badge-warning', RETRASO: 'badge-warning', JUSTIFICADO: 'badge-warning', TRANSFERIDA: 'badge-warning', REPETIR_CURSO: 'badge-warning',
  ANULADO: 'badge-ghost', CONCLUIDA: 'badge-ghost', INACTIVO: 'badge-ghost',
}

const claseEstado = ESTILO[props.estado] ?? 'badge-neutral'
</script>

<template>
  <span class="badge" :class="[claseEstado, `badge-${tamano}`]">{{ texto ?? estado }}</span>
</template>