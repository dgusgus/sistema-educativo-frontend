import api from '@/api/axios'

// Refleja GET /pagos/:inscripcionId (pago.controller.ts → getPagosByInscripcion)
export interface ConceptoEstado {
  concepto:     { id: number; nombre: string; monto: number }
  obligatorio:  boolean
  estado:       'PAGADO' | 'PENDIENTE'
  montoPagado:  number
  fechaPago:    string | null
  numeroRecibo: string | null
  pagosAnulados: number
}

export interface PagoHistorial {
  id:            number
  montoPagado:   number
  fechaPago:     string
  metodoPago:    'EFECTIVO' | 'TRANSFERENCIA' | 'QR'
  estado:        'PAGADO' | 'PENDIENTE' | 'ANULADO'
  numeroRecibo:  string | null
  observaciones: string | null
  conceptoPagoId: number
  conceptoPago:  { nombre: string; monto: number }
}

export interface PagosInscripcionResponse {
  inscripcion: {
    id:         number
    estudiante: { nombre: string; apellido: string; ci: string }
    curso:      { nombre: string }
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
  metodoPago:     'EFECTIVO' | 'TRANSFERENCIA' | 'QR'
  observaciones?: string
}

export const pagoApi = {
  getDeInscripcion: (inscripcionId: number) =>
    api.get<PagosInscripcionResponse>(`/pagos/${inscripcionId}`).then(r => r.data),

  registrar: (payload: PagoPayload) =>
    api.post<PagoHistorial>('/pagos', payload).then(r => r.data),

  anular: (id: number, observaciones?: string) =>
    api.put(`/pagos/${id}/anular`, { observaciones }).then(r => r.data),
}