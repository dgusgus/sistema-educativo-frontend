// src/stores/institucion.store.ts
//
// Datos PÚBLICOS del colegio (nombre, ubicación, RUE) para el login, el menú lateral y el título
// de la pestaña. Salen de la base de datos: el sistema ya no trae escrito ningún colegio.
// Para el detalle completo (teléfono, correo, director) está catalogo.institucion().

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { institucionApi } from '@/api/institucion.api'
import type { InstitucionPublica } from '@/types'

const TITULO_GENERICO = 'Plataforma Académica'

export const useInstitucionStore = defineStore('institucionPublica', () => {
  const datos = ref<InstitucionPublica | null>(null)
  const cargada = ref(false)

  const configurada = computed(() => datos.value?.configurada === true)
  const nombre = computed(() => (configurada.value ? datos.value?.nombre ?? '' : ''))
  /** "Oruro, Oruro" / "Oruro" / "" según lo que tenga cargado */
  const ubicacion = computed(() =>
    [datos.value?.municipio, datos.value?.departamento].filter(Boolean).join(', '))
  const rue = computed(() => datos.value?.rue ?? '')
  const direccion = computed(() => datos.value?.direccion ?? '')
  const logoUrl = computed(() => datos.value?.logoUrl ?? '')
  /** Palabra más larga del nombre en mayúsculas: adorno del login (sin "U.E.", "DE", etc.) */
  const palabraClave = computed(() =>
    nombre.value.toUpperCase().split(/\s+/).filter(p => p.length > 3).sort((a, b) => b.length - a.length)[0] ?? '')

  function aplicarTitulo() {
    document.title = nombre.value ? `${nombre.value} · ${TITULO_GENERICO}` : TITULO_GENERICO
  }

  async function cargar(forzar = false) {
    if (cargada.value && !forzar) return
    try {
      datos.value = await institucionApi.getPublica()
    } catch {
      datos.value = { configurada: false }      // sin red o sin servidor: pantalla genérica
    } finally {
      cargada.value = true
      aplicarTitulo()
    }
  }

  return { datos, cargada, configurada, nombre, ubicacion, rue, direccion, logoUrl, palabraClave, cargar }
})
