import { ref } from 'vue'
import { defineStore } from 'pinia'

export type ToastTipo = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id:      number
  tipo:    ToastTipo
  mensaje: string
}

// Store global de notificaciones tipo "toast" — reemplaza los banners de
// éxito estáticos que había repetidos en cada vista (había que hacer
// click para cerrarlos, o quedaban pegados hasta la próxima acción).
// Se muestra vía <ToastContainer/>, montado una sola vez en App.vue.
export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])
  let nextId = 0

  function mostrar(mensaje: string, tipo: ToastTipo = 'info', duracionMs = 4000) {
    const id = ++nextId
    toasts.value.push({ id, tipo, mensaje })
    setTimeout(() => cerrar(id), duracionMs)
  }

  function cerrar(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return {
    toasts,
    success: (mensaje: string) => mostrar(mensaje, 'success'),
    error:   (mensaje: string) => mostrar(mensaje, 'error', 6000),
    info:    (mensaje: string) => mostrar(mensaje, 'info'),
    warning: (mensaje: string) => mostrar(mensaje, 'warning', 5000),
    cerrar,
  }
})