<script setup lang="ts">
// Barra de paginación para tablas con paginación en el servidor.
// Muestra "Mostrando 26–50 de 912", anterior/siguiente y el tamaño de página.
defineProps<{
  pagina: number
  totalPaginas: number
  desde: number
  hasta: number
  total: number
  limite: number
  cargando?: boolean
  opcionesLimite?: number[]
}>()

const emit = defineEmits<{
  (e: 'ir', pagina: number): void
  (e: 'limite', limite: number): void
}>()
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
    <p class="text-base-content/60" aria-live="polite">
      <template v-if="total === 0">Sin resultados</template>
      <template v-else>Mostrando <strong>{{ desde }}–{{ hasta }}</strong> de <strong>{{ total }}</strong></template>
    </p>

    <div class="flex items-center gap-3">
      <label class="flex items-center gap-2 text-base-content/60">
        <span class="hidden sm:inline whitespace-nowrap">Por página</span>
        <select class="select select-bordered select-xs" :value="limite" :disabled="cargando"
                @change="emit('limite', Number(($event.target as HTMLSelectElement).value))">
          <option v-for="n in (opcionesLimite ?? [25, 50, 100])" :key="n" :value="n">{{ n }}</option>
        </select>
      </label>

      <div class="join">
        <button class="join-item btn btn-sm" :disabled="cargando || pagina <= 1" aria-label="Página anterior" @click="emit('ir', pagina - 1)">‹</button>
        <span class="join-item btn btn-sm btn-disabled no-animation">{{ pagina }} / {{ totalPaginas }}</span>
        <button class="join-item btn btn-sm" :disabled="cargando || pagina >= totalPaginas" aria-label="Página siguiente" @click="emit('ir', pagina + 1)">›</button>
      </div>
    </div>
  </div>
</template>
