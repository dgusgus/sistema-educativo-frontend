<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { institucionApi } from '@/api/institucion.api'
import { useCatalogoStore } from '@/stores/catalogo.store'
import { useToastStore } from '@/stores/toast.store'
import { useInstitucionStore } from '@/stores/institucion.store'
import type { Institucion } from '@/types'

const toast = useToastStore()
const catalogo = useCatalogoStore()
const publica = useInstitucionStore()
const datos    = ref<Partial<Institucion>>({})
const cargando = ref(true)
const guardando = ref(false)
const error    = ref<string | null>(null)

onMounted(async () => {
  try {
    datos.value = { ...(await catalogo.institucion(true)) }
  } catch {
    // 404 = todavía no configurada — el form arranca vacío y el PUT la crea
    datos.value = {}
  } finally {
    cargando.value = false
  }
})

async function guardar() {
  if (!datos.value.nombre?.trim()) {
    error.value = 'El nombre de la unidad educativa es obligatorio'
    return
  }
  guardando.value = true
  error.value = null
  try {
    datos.value = await institucionApi.update(datos.value)
    catalogo.invalidar('institucion')
    await publica.cargar(true)            // menú, login y título de la pestaña se actualizan al instante
    datos.value = { ...(await catalogo.institucion(true)) }
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
      Estos datos aparecen en el login, el menú, los boletines, los reportes y el cuaderno pedagógico.
      Para usar el sistema en otra unidad educativa, solo cambia esta información.
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
          <legend class="fieldset-legend text-xs">Dirección</legend>
          <input v-model="datos.direccion" type="text" class="input input-bordered w-full" :disabled="guardando" />
        </fieldset>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Municipio</legend>
            <input v-model="datos.municipio" type="text" class="input input-bordered w-full" :disabled="guardando" />
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Distrito educativo</legend>
            <input v-model="datos.distrito" type="text" class="input input-bordered w-full" :disabled="guardando" />
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Departamento</legend>
            <input v-model="datos.departamento" type="text" class="input input-bordered w-full" :disabled="guardando" />
          </fieldset>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Teléfono</legend>
            <input v-model="datos.telefono" type="tel" class="input input-bordered w-full" :disabled="guardando" />
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Email</legend>
            <input v-model="datos.email" type="email" class="input input-bordered w-full" :disabled="guardando" />
          </fieldset>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Código SIE / RUE</legend>
            <input v-model="datos.rue" type="text" class="input input-bordered w-full" :disabled="guardando" />
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">Dependencia</legend>
            <select v-model="datos.dependencia" class="select select-bordered w-full" :disabled="guardando">
              <option :value="null">Sin especificar</option>
              <option value="FISCAL">Fiscal</option>
              <option value="CONVENIO">Convenio</option>
              <option value="PRIVADO">Privada</option>
            </select>
          </fieldset>
        </div>

        <div v-if="datos.directorNombre" class="rounded-lg bg-base-200 px-3 py-2 text-sm">
          <span class="text-base-content/60">Director(a) de la gestión activa:</span>
          <strong class="ml-1">{{ datos.directorNombre }}</strong>
          <p class="text-xs text-base-content/50">Se asigna en Gestiones; aparece en las firmas de los impresos.</p>
        </div>

        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">URL del logo</legend>
          <input v-model="datos.logoUrl" type="url" placeholder="https://..." class="input input-bordered w-full" :disabled="guardando" />
          <p class="text-xs text-base-content/40 mt-1">
            El logo no se sube desde aquí todavía: solo la dirección web donde ya esté alojado.
          </p>
          <img v-if="datos.logoUrl" :src="datos.logoUrl" alt="Vista previa del logo" class="mt-2 h-16 w-auto rounded border border-base-300 bg-white p-1" />
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