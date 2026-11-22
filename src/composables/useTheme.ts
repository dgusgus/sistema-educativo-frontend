import { ref } from 'vue'

/**
 * Catálogo de temas. Para agregar uno nuevo:
 *  1) definir su `@plugin "daisyui/theme"` en src/style.css con el mismo `name`
 *  2) agregarlo aquí (id = name del tema, muestras = colores del selector)
 */
export const TEMAS = [
  { id: 'colegio',      etiqueta: 'Azul institucional', oscuro: false, muestras: ['#1A3C5E', '#2E6DA4', '#C9A227'] },
  { id: 'colegio-dark', etiqueta: 'Azul nocturno',      oscuro: true,  muestras: ['#101c2e', '#3b82f6', '#4edea3'] },
  { id: 'esmeralda',    etiqueta: 'Esmeralda',          oscuro: false, muestras: ['#1B5E3F', '#2F8F5B', '#C9A227'] },
  { id: 'carnaval',     etiqueta: 'Carnaval',           oscuro: true,  muestras: ['#E0457B', '#9B7BF0', '#F5B83D'] },
  { id: 'vino',         etiqueta: 'Vino',               oscuro: false, muestras: ['#7A1F3D', '#A63D5E', '#C9A227'] },
] as const

export type TemaId = typeof TEMAS[number]['id']

const IDS: readonly string[] = TEMAS.map(t => t.id)
const CLAVE = 'tema'

function leerGuardado(): string | null {
  try { return localStorage.getItem(CLAVE) } catch { return null }
}

function temaInicial(): TemaId {
  const guardado = leerGuardado()
  if (guardado && IDS.includes(guardado)) return guardado as TemaId
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'colegio-dark' : 'colegio'
}

const tema = ref<TemaId>(temaInicial())
document.documentElement.setAttribute('data-theme', tema.value)

export function useTheme() {
  function elegir(id: TemaId) {
    if (!IDS.includes(id)) return
    tema.value = id
    document.documentElement.setAttribute('data-theme', id)
    try { localStorage.setItem(CLAVE, id) } catch { /* modo privado: se aplica sin persistir */ }
  }
  return { tema, temas: TEMAS, elegir }
}