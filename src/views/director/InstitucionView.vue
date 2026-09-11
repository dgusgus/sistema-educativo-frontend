<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { institucionApi } from '@/api/institucion.api'
import { useToastStore } from '@/stores/toast.store'
import type { Institucion } from '@/types'

const toast = useToastStore()
const datos    = ref<Partial<Institucion>>({})
const cargando = ref(true)
const guardando = ref(false)
const error    = ref<string | null>(null)

onMounted(async () => {
  try {
    datos.value = await institucionApi.get()
  } catch {
    // 404 = todavía no configurada — el form arranca vacío y el PUT la crea
    datos.value = {}
  } finally {
    cargando.value = false
  }
})

async function guardar() {
  if (!datos.value.nombre || !datos.value.direccion) {
    error.value = 'Nombre y dirección son obligatorios'
    return
  }
  guardando.value = true
  error.value = null
  try {
    datos.value = await institucionApi.update(datos.value)
    toast.success('Datos guardados correctamente')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div class="space-y-4 max-w-2xl">
    <h2 class="text-2xl font-bold">Datos de la Institución</h2>
    <p class="text-sm text-base-content/60">
      Esta información aparece en el encabezado de boletines y reportes PDF.
    </p>

    <div v-if="cargando" class="skeleton h-96 rounded-xl"></div>

    <form v-else class="card bg-base-100 shadow" @submit.prevent="guardar">
      <div class="card-body space-y-4">
        <div v-if="error" role="alert" class="alert alert-error py-2 text-sm"><span>{{ error }}</span></div>

        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Nombre de la institución *</legend>
          <input v-model="datos.nombre" type="text" class="input input-bordered w-full" :disabled="guardando" />
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Dirección *</legend>
          <input v-model="datos.direccion" type="text" class="input input-bordered w-full" :disabled="guardando" />
        </fieldset>

        <div class="grid grid-cols-2 gap-3">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Municipio</legend>
            <input v-model="datos.municipio" type="text" class="input input-bordered w-full" :disabled="guardando" />
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Departamento</legend>
            <input v-model="datos.departamento" type="text" class="input input-bordered w-full" :disabled="guardando" />
          </fieldset>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Teléfono</legend>
            <input v-model="datos.telefono" type="tel" class="input input-bordered w-full" :disabled="guardando" />
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Email</legend>
            <input v-model="datos.email" type="email" class="input input-bordered w-full" :disabled="guardando" />
          </fieldset>
        </div>

        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">RUE</legend>
          <input v-model="datos.rue" type="text" class="input input-bordered w-full" :disabled="guardando" />
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">URL del logo</legend>
          <input v-model="datos.logoUrl" type="url" placeholder="https://..." class="input input-bordered w-full" :disabled="guardando" />
          <p class="text-xs text-base-content/40 mt-1">
            El logo en sí no se sube desde acá todavía — solo la URL donde ya esté alojado.
          </p>
        </fieldset>

        <div class="flex justify-end pt-2">
          <button type="submit" class="btn btn-primary" :disabled="guardando">
            <span v-if="guardando" class="loading loading-spinner loading-sm"></span>
            Guardar cambios
          </button>
        </div>
      </div>
    </form>
  </div>
</template>