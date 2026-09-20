import { ref } from 'vue'

const TEMAS = ['colegio', 'colegio-dark'] as const
type Tema = typeof TEMAS[number]

function temaInicial(): Tema {
  const guardado = localStorage.getItem('tema') as Tema | null
  if (guardado && TEMAS.includes(guardado)) return guardado
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'colegio-dark' : 'colegio'
}

const tema = ref<Tema>(temaInicial())
document.documentElement.setAttribute('data-theme', tema.value)

export function useTheme() {
  function alternar() {
    tema.value = tema.value === 'colegio' ? 'colegio-dark' : 'colegio'
    document.documentElement.setAttribute('data-theme', tema.value)
    localStorage.setItem('tema', tema.value)
  }
  return { tema, alternar }
}