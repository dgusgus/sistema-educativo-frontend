import api, { TIMEOUT_LOTE } from '@/api/axios'

export const cuadernoApi = {
  // Cuaderno pedagógico (.xlsx) de un curso en un trimestre.
  // Timeout largo: con muchos estudiantes y áreas el servidor tarda más de los 10 s generales.
  descargarExcel: (cursoId: number, trimestreId: number) =>
    api
      .get<Blob>(`/cuaderno/${cursoId}/trimestre/${trimestreId}/excel`, {
        responseType: 'blob',
        timeout: TIMEOUT_LOTE,
      })
      .then(r => r.data),

  // Cuaderno de TODA la gestión: los trimestres y todas las asistencias en un solo libro.
  descargarGestionExcel: (cursoId: number) =>
    api
      .get<Blob>(`/cuaderno/${cursoId}/gestion/excel`, {
        responseType: 'blob',
        timeout: TIMEOUT_LOTE,
      })
      .then(r => r.data),
}
