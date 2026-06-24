import api from '@/api/axios'

// El backend devuelve un blob PDF en ambos endpoints
export const boletinApi = {
  // GET /boletin/:estudianteId/:trimestreId → PDF individual
  getIndividual: (estudianteId: number, trimestreId: number) =>
    api.get<Blob>(`/boletin/${estudianteId}/${trimestreId}`, {
      responseType: 'blob',
    }).then(r => r.data),

  // GET /boletin/curso/:cursoId/:trimestreId → PDF masivo
  getMasivo: (cursoId: number, trimestreId: number) =>
    api.get<Blob>(`/boletin/curso/${cursoId}/${trimestreId}`, {
      responseType: 'blob',
    }).then(r => r.data),
}

// Helper: recibe un blob y lo descarga en el navegador
export function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = nombre
  a.click()
  // Liberar la URL temporal después de un tick
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}