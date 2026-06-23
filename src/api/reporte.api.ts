import api from '@/api/axios'
import type { DashboardResponse } from '@/types'

export const reporteApi = {
  getDashboard: () =>
    api.get<DashboardResponse>('/dashboard').then(r => r.data),

  getReporteAcademico: (params: { gestionId?: number; cursoId?: number }) =>
    api.get('/reportes/academico', { params }).then(r => r.data),

  getReporteAcademicoPdf: (gestionId: number) =>
    api.get('/reportes/academico/pdf', {
      params: { gestionId },
      responseType: 'blob',
    }).then(r => r.data as Blob),
}