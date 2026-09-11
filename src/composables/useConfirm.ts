import { ref } from 'vue'

export interface OpcionesConfirm {
  titulo?:          string
  mensaje:          string
  textoConfirmar?:  string
  textoCancelar?:   string
  peligroso?:       boolean   // true = botón rojo (para acciones irreversibles/destructivas)
}

// Estado compartido a nivel de módulo — un solo <ConfirmDialog/> global
// (montado en App.vue) renderiza lo que sea que haya acá. Así cualquier
// vista puede pedir confirmación con await sin tener que declarar su
// propio modal cada vez.
const abierto  = ref(false)
const opciones = ref<OpcionesConfirm>({ mensaje: '' })
let resolver: ((v: boolean) => void) | null = null

function confirmar(opts: OpcionesConfirm | string): Promise<boolean> {
  opciones.value = typeof opts === 'string' ? { mensaje: opts } : opts
  abierto.value = true
  return new Promise(resolve => { resolver = resolve })
}

function responder(v: boolean) {
  abierto.value = false
  resolver?.(v)
  resolver = null
}

// Lo usan las vistas: const { confirmar } = useConfirm()
export function useConfirm() {
  return { confirmar }
}

// Lo usa únicamente <ConfirmDialog/> para leer/escribir el estado compartido
export function useConfirmState() {
  return { abierto, opciones, responder }
}