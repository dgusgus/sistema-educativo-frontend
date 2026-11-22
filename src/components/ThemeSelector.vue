<script setup lang="ts">
import { useTheme, type TemaId } from '@/composables/useTheme'

const { tema, temas, elegir } = useTheme()

// Cierra el menú tras elegir (DaisyUI abre el dropdown por foco)
function seleccionar(id: TemaId) {
  elegir(id)
  ;(document.activeElement as HTMLElement | null)?.blur()
}
</script>

<template>
  <div class="dropdown dropdown-end">
    <div tabindex="0" role="button" class="btn btn-ghost btn-circle" aria-haspopup="menu"
      aria-label="Cambiar tema de color" title="Tema de color">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    </div>
    <ul tabindex="0" role="menu"
      class="dropdown-content menu z-50 mt-2 w-60 rounded-2xl border border-base-300 bg-base-100 p-2 shadow-xl">
      <li class="menu-title text-[11px] uppercase tracking-wider">Tema</li>
      <li v-for="t in temas" :key="t.id" role="none">
        <button type="button" role="menuitemradio" :aria-checked="tema === t.id"
          :class="['flex items-center gap-3', tema === t.id ? 'menu-active' : '']" @click="seleccionar(t.id)">
          <span class="flex -space-x-1.5" aria-hidden="true">
            <span v-for="c in t.muestras" :key="c" class="h-4 w-4 rounded-full ring-2 ring-base-100"
              :style="{ background: c }"></span>
          </span>
          <span class="flex-1 text-left text-sm">{{ t.etiqueta }}</span>
          <span class="text-[10px] opacity-60">{{ t.oscuro ? 'Oscuro' : 'Claro' }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>