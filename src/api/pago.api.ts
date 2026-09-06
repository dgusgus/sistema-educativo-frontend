import api from '@/api/axios'
import type { MetodoPago, EstadoPago } from '@/types'

export interface ConceptoPago {
  id:                number
  nombre:            string
  descripcion:       string | null
  monto:             number
  obligatorio:       boolean
  gestionId:         number
  fechaVencimiento:  string | null
  gestion?:          { id: number; anio: number }
}

// Refleja GET /pagos/:inscripcionId
export interface ConceptoEstado {
  concepto:      { id: number; nombre: string; monto: number }
  obligatorio:   boolean
  estado:        'PAGADO' | 'PENDIENTE'
  montoPagado:   number
  fechaPago:     string | null
  numeroRecibo:  string | null
  pagosAnulados: number
}

export interface PagoHistorial {
  id:             number
  montoOriginal:  number
  descuento:      number
  montoPagado:    number
  fechaPago:      string
  metodoPago:     MetodoPago
  estado:         EstadoPago
  numeroRecibo:   string | null
  observaciones:  string | null
  conceptoPagoId: number
  conceptoPago:   { nombre: string; monto: number }
  registradoPor:  { username: string } | null
}

export interface PagosInscripcionResponse {
  inscripcion: {
    id:         number
    estudiante: { nombre: string; apellido: string; ci: string }
    curso:      { nivel: string; grado: number; paralelo: string }
    gestion:    { anio: number }
  }
  resumen: {
    totalRequerido: number
    totalPagado:    number
    saldo:          number
    alDia:          boolean
  }
  estadoPorConcepto: ConceptoEstado[]
  historialPagos:    PagoHistorial[]
}

export interface PagoPayload {
  inscripcionId:  number
  conceptoPagoId: number
  montoPagado:    number
  descuento?:     number
  metodoPago?:    MetodoPago     // default EFECTIVO en el backend
  observaciones?: string
}

export const pagoApi = {
  getConceptos: (gestionId?: number) =>
    api.get<ConceptoPago[]>('/pagos/conceptos', { params: gestionId ? { gestionId } : undefined }).then(r => r.data),

  crearConcepto: (data: { nombre: string; descripcion?: string; monto: number; obligatorio?: boolean; gestionId: number; fechaVencimiento?: string }) =>
    api.post<ConceptoPago>('/pagos/conceptos', data).then(r => r.data),

  getDeInscripcion: (inscripcionId: number) =>
    api.get<PagosInscripcionResponse>(`/pagos/${inscripcionId}`).then(r => r.data),

  // Rechaza (409) si ya hay un pago PAGADO activo para ese concepto —
  // primero hay que anular el existente.
  registrar: (payload: PagoPayload) =>
    api.post<PagoHistorial>('/pagos', payload).then(r => r.data),

  anular: (id: number, observaciones?: string) =>
    api.put(`/pagos/${id}/anular`, { observaciones }).then(r => r.data),
}