/**
 * Catálogos chicos y estables que varias pantallas piden una y otra vez:
 * materias, lista de gestiones, datos del colegio y dimensiones por gestión.
 *
 * ¿Por qué? Antes cada vista hacía su propio GET y guardaba su propia copia.
 * Ahora se pide UNA vez por sesión y se reutiliza.
 *
 * Regla de uso:
 *  - Pantallas que SOLO LEEN  → `await catalogo.materias()` (usa caché).
 *  - Pantallas que EDITAN     → cargan con `forzar = true` y, tras guardar,
 *    llaman a `catalogo.invalidar('materias')` para que las demás se enteren.
 *
 * NO va aquí lo grande o cambiante (estudiantes, notas, asistencia): eso va
 * paginado desde el servidor con useListaPaginada.
 */
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { materiaApi } from '@/api/estructura.api'
import { gestionApi, type GestionResumen } from '@/api/gestion.api'
import { institucionApi } from '@/api/institucion.api'
import { evaluacionApi } from '@/api/evaluacion.api'
import type { Materia, Institucion, DimensionEvaluacion } from '@/types'

export type ClaveCatalogo = 'materias' | 'gestiones' | 'institucion' | 'dimensiones'

export const useCatalogoStore = defineStore('catalogo', () => {
  const _materias    = ref<Materia[] | null>(null)
  const _gestiones   = ref<GestionResumen[] | null>(null)
  const _institucion = ref<Institucion | null>(null)
  const _dimensiones = ref<Record<number, DimensionEvaluacion[]>>({})

  // Peticiones en vuelo: si dos vistas piden lo mismo a la vez comparten la misma.
  const enVuelo = new Map<string, Promise<unknown>>()

  function compartir<T>(clave: string, pedir: () => Promise<T>): Promise<T> {
    const previa = enVuelo.get(clave) as Promise<T> | undefined
    if (previa) return previa
    const p = pedir().finally(() => enVuelo.delete(clave))
    enVuelo.set(clave, p)
    return p
  }

  async function materias(forzar = false): Promise<Materia[]> {
    if (_materias.value && !forzar) return _materias.value
    _materias.value = await compartir('materias', () => materiaApi.getAll())
    return _materias.value
  }

  async function gestiones(forzar = false): Promise<GestionResumen[]> {
    if (_gestiones.value && !forzar) return _gestiones.value
    _gestiones.value = await compartir('gestiones', () => gestionApi.getAll())
    return _gestiones.value
  }

  async function institucion(forzar = false): Promise<Institucion> {
    if (_institucion.value && !forzar) return _institucion.value
    _institucion.value = await compartir('institucion', () => institucionApi.get())
    return _institucion.value
  }

  async function dimensiones(gestionId: number, forzar = false): Promise<DimensionEvaluacion[]> {
    const guardadas = _dimensiones.value[gestionId]
    if (guardadas && !forzar) return guardadas
    const lista = await compartir(`dim:${gestionId}`, () => evaluacionApi.getDimensiones(gestionId))
    _dimensiones.value = { ..._dimensiones.value, [gestionId]: lista }
    return lista
  }

  /** Marca un catálogo como viejo; la próxima lectura vuelve a pedirlo. */
  function invalidar(clave: ClaveCatalogo, gestionId?: number) {
    if (clave === 'materias') _materias.value = null
    else if (clave === 'gestiones') _gestiones.value = null
    else if (clave === 'institucion') _institucion.value = null
    else if (gestionId !== undefined) {
      const { [gestionId]: _, ...resto } = _dimensiones.value
      _dimensiones.value = resto
    } else _dimensiones.value = {}
  }

  function limpiar() {
    _materias.value = null
    _gestiones.value = null
    _institucion.value = null
    _dimensiones.value = {}
  }

  return { materias, gestiones, institucion, dimensiones, invalidar, limpiar }
})
