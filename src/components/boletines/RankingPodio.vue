<script setup lang="ts">
import type { MejorEstudianteItem } from '@/api/boletin.api'

// Podio de un ranking ya calculado: top 3 destacado + resto en lista.
// Presentacional puro — el padre elige qué periodo mostrar (T1/T2/T3/Anual).
const props = defineProps<{
  items: MejorEstudianteItem[]
  titulo: string
  destacado?: boolean
}>()

const podio = () => props.items.slice(0, 3)

function inicial(nombre: string): string {
  return (nombre.trim()[0] ?? '•').toUpperCase()
}

function estiloPuesto(puesto: number): string {
  if (puesto === 1) return 'bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950'
  if (puesto === 2) return 'bg-gradient-to-b from-slate-200 to-slate-400 text-slate-800'
  if (puesto === 3) return 'bg-gradient-to-b from-orange-300 to-orange-500 text-orange-950'
  return 'bg-base-300 text-base-content'
}
</script>

<template>
  <div class="rounded-box border p-3 sm:p-4" :class="destacado ? 'border-primary/30 bg-primary/5' : 'border-base-300'">
    <h4 class="font-semibold text-sm mb-3">{{ titulo }}</h4>

    <div v-if="!items.length" class="text-xs text-base-content/40 py-4 text-center">
      Sin notas todavía
    </div>

    <template v-else>
      <!-- Podio top 3: 2° · 1° · 3° en desktop, 1° primero en móvil -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-end justify-center gap-2 sm:gap-3">
        <!-- 2° puesto -->
        <div v-if="podio()[1]" class="order-2 sm:order-1 flex-1 rounded-box bg-base-200/60 border border-base-300 p-3 text-center">
          <span class="badge badge-lg font-bold" :class="estiloPuesto(2)">2</span>
          <p class="avatar placeholder mt-2">
            <span class="bg-base-300 rounded-full w-10 h-10 flex items-center justify-center font-bold">
              {{ inicial(podio()[1].nombreCompleto) }}
            </span>
          </p>
          <p class="text-xs font-medium mt-1 truncate">{{ podio()[1].nombreCompleto }}</p>
          <p class="font-mono font-bold">{{ podio()[1].promedio.toFixed(1) }}</p>
        </div>
        <!-- 1° puesto -->
        <div class="order-1 sm:order-2 flex-1 rounded-box border border-amber-400/50 p-3 sm:p-4 text-center shadow"
          style="background: linear-gradient(180deg, rgba(251,191,36,.15) 0%, rgba(251,191,36,.03) 100%)">
          <span class="badge badge-lg font-bold" :class="estiloPuesto(1)">1</span>
          <p class="avatar placeholder mt-2">
            <span class="bg-amber-400/30 text-amber-800 rounded-full w-12 h-12 flex items-center justify-center text-lg font-bold">
              {{ inicial(podio()[0].nombreCompleto) }}
            </span>
          </p>
          <p class="text-sm font-bold mt-1 truncate">{{ podio()[0].nombreCompleto }}</p>
          <p class="font-mono font-bold text-xl text-amber-700">{{ podio()[0].promedio.toFixed(1) }}</p>
        </div>
        <!-- 3° puesto -->
        <div v-if="podio()[2]" class="order-3 flex-1 rounded-box bg-base-200/60 border border-base-300 p-3 text-center">
          <span class="badge badge-lg font-bold" :class="estiloPuesto(3)">3</span>
          <p class="avatar placeholder mt-2">
            <span class="bg-base-300 rounded-full w-10 h-10 flex items-center justify-center font-bold">
              {{ inicial(podio()[2].nombreCompleto) }}
            </span>
          </p>
          <p class="text-xs font-medium mt-1 truncate">{{ podio()[2].nombreCompleto }}</p>
          <p class="font-mono font-bold">{{ podio()[2].promedio.toFixed(1) }}</p>
        </div>
      </div>

      <!-- Clasificación completa en lista (todos los puestos pedidos) -->
      <div class="mt-3">
        <p class="text-xs font-semibold text-base-content/60 mb-1">
          Clasificación completa ({{ items.length }})
        </p>
        <ul class="divide-y divide-base-200 rounded-box border border-base-200 max-h-80 overflow-y-auto">
          <li v-for="item in items" :key="item.inscripcionId"
            class="flex items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-base-200/50"
            :class="item.puesto <= 3 ? 'bg-amber-400/5' : ''">
            <span class="badge badge-sm font-bold shrink-0" :class="estiloPuesto(item.puesto)">
              {{ item.puesto }}°
            </span>
            <span class="avatar placeholder shrink-0">
              <span class="bg-base-300 rounded-full w-6 h-6 flex items-center justify-center text-[11px] font-bold">
                {{ inicial(item.nombreCompleto) }}
              </span>
            </span>
            <span class="flex-1 truncate">{{ item.nombreCompleto }}</span>
            <span class="font-mono font-semibold">{{ item.promedio.toFixed(1) }}</span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
