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
// Un concepto se puede pagar en varios abonos: estos valores son del CONCEPTO completo.
//   saldo = monto − descuentos − pagado · PAGADO si saldo = 0 · PARCIAL si hay algo pagado · PENDIENTE si nada
export interface ConceptoEstado {
  concepto:      { id: number; nombre: string; monto: number }
  obligatorio:   boolean
  estado:        'PAGADO' | 'PARCIAL' | 'PENDIENTE'
  montoPagado:   number          // total abonado
  descuento:     number
  saldo:         number          // lo que falta por pagar de este concepto
  abonos:        number          // cantidad de pagos registrados
  fechaPago:     string | null   // del último abono
  numeroRecibo:  string | null   // del último abono
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

// Respuesta de registrar un pago: el pago creado + lo que queda por pagar de ese concepto
export type PagoRegistrado = PagoHistorial & { saldoPendiente: number }

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

  // Permite abonos: si el monto no cubre el saldo queda PARCIAL; si lo cubre, PAGADO.
  // Rechaza (400) un monto mayor al saldo y (409) un concepto ya pagado por completo.
  registrar: (payload: PagoPayload) =>
    api.post<PagoRegistrado>('/pagos', payload).then(r => r.data),

  anular: (id: number, observaciones?: string) =>
    api.put(`/pagos/${id}/anular`, { observaciones }).then(r => r.data),
}