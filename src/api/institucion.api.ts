import api from '@/api/axios'
import type { Institucion } from '@/types'

// ARCHIVO NUEVO — cubre institucion.controller.ts, que no existía en el
// frontend v5. Útil para encabezados de boletines/reportes y una futura
// pantalla de "Datos del colegio" en el panel de Director.

export const institucionApi = {
  // Cualquier usuario autenticado puede verlo
  get: () =>
    api.get<Institucion>('/institucion').then(r => r.data),

  // Solo Director
  update: (data: Partial<Omit<Institucion, 'id'>>) =>
    api.put<Institucion>('/institucion', data).then(r => r.data),
}