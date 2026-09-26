<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ResultadoImport } from '@/types/import'
// Forma genérica del reporte que ya devuelven los endpoints /import
// del backend (ver estudiante.controller.ts → importEstudiantes).

const props = withDefaults(defineProps<{
  modelValue: boolean
  titulo: string
  columnas: string[]              // se sigue usando para el texto de ayuda
  plantilla: () => Promise<Blob>  // descarga el .xlsx desde /plantilla
  importar: (archivo: File) => Promise<ResultadoImport>
  nombrePlantilla?: string        // ej. plantilla_docentes.xlsx
}>(), {
  nombrePlantilla: 'plantilla.xlsx',
})

const emit = defineEmits<{
  'update:modelValue': [valor: boolean]
  completado: [resultado: ResultadoImport]
}>()

const archivo    = ref<File | null>(null)
const importando = ref(false)
const descargando = ref(false)
const error      = ref<string | null>(null)
const resultado  = ref<ResultadoImport | null>(null)

const listo = computed(() => !!archivo.value && !importando.value)

function onSeleccionarArchivo(e: Event) {
  const input = e.target as HTMLInputElement
  archivo.value = input.files?.[0] ?? null
  error.value = null
  resultado.value = null
}

// Descarga la plantilla .xlsx. Antes fallaba con 500 porque /plantilla
// caía en GET /:id (ver fix en routes) y el error quedaba sin manejar
// (Vue warn Unhandled error). Ahora muestra el mensaje en el modal.
async function descargarPlantilla() {
  if (descargando.value) return
  descargando.value = true
  error.value = null
  try {
    const blob = await props.plantilla()
    if (!blob || blob.size === 0) throw new Error('La plantilla descargada está vacía')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = props.nombrePlantilla
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al descargar la plantilla'
  } finally {
    descargando.value = false
  }
}

async function ejecutarImportacion() {
  if (!archivo.value) return
  importando.value = true
  error.value = null
  try {
    resultado.value = await props.importar(archivo.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al importar el archivo'
  } finally {
    importando.value = false
  }
}

function cerrar() {
  const huboExitos = (resultado.value?.exitosas ?? 0) > 0
  if (huboExitos) emit('completado', resultado.value!)
  archivo.value = null
  resultado.value = null
  error.value = null
  emit('update:modelValue', false)
}
</script>

<template>
  <dialog :open="modelValue" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-1">{{ titulo }}</h3>

      <!-- ── Antes de importar ── -->
      <div v-if="!resultado" class="space-y-4">
        <p class="text-sm text-base-content/60">
          Columnas esperadas (primera fila del archivo): <span class="font-mono">{{ columnas.join(', ') }}</span>
        </p>
        <button type="button" class="btn btn-outline btn-sm" :disabled="descargando" @click="descargarPlantilla">
          <span v-if="descargando" class="loading loading-spinner loading-xs"></span>
          {{ descargando ? 'Descargando…' : 'Descargar plantilla' }}
        </button>

        <div v-if="error" role="alert" class="alert alert-error py-2 text-sm">
          <span>{{ error }}</span>
        </div>

        <fieldset class="fieldset">
          <legend class="fieldset-legend text-xs">Archivo (.xlsx)</legend>
          <input
            type="file"
            accept=".xlsx,.xls"
            class="file-input file-input-bordered w-full"
            :disabled="importando"
            @change="onSeleccionarArchivo"
          />
        </fieldset>

        <div class="modal-action mt-6">
          <button type="button" class="btn btn-ghost" :disabled="importando" @click="cerrar">Cancelar</button>
          <button type="button" class="btn btn-primary" :disabled="!listo" @click="ejecutarImportacion">
            <span v-if="importando" class="loading loading-spinner loading-sm"></span>
            Importar
          </button>
        </div>
      </div>

      <!-- ── Reporte fila por fila ── -->
      <div v-else class="space-y-4">
        <div class="flex gap-3">
          <div class="stat bg-base-200 rounded-box p-3">
            <div class="stat-title text-xs">Procesadas</div>
            <div class="stat-value text-lg">{{ resultado.totalFilas }}</div>
          </div>
          <div class="stat bg-success/10 rounded-box p-3">
            <div class="stat-title text-xs">Exitosas</div>
            <div class="stat-value text-lg text-success">{{ resultado.exitosas }}</div>
          </div>
          <div class="stat bg-error/10 rounded-box p-3">
            <div class="stat-title text-xs">Fallidas</div>
            <div class="stat-value text-lg text-error">{{ resultado.fallidas }}</div>
          </div>
        </div>

        <div v-if="resultado.errores.length" class="overflow-y-auto max-h-64 border border-base-300 rounded-box">
          <table class="table table-xs">
            <thead><tr><th>Fila</th><th>Error</th></tr></thead>
            <tbody>
              <tr v-for="e in resultado.errores" :key="e.fila">
                <td>{{ e.fila }}</td>
                <td class="text-error">{{ e.error }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="modal-action">
          <button type="button" class="btn btn-primary" @click="cerrar">Cerrar</button>
        </div>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="cerrar"><button>cerrar</button></form>
  </dialog>
</template>