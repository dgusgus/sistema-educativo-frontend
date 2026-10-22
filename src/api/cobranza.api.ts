import api, { TIMEOUT_LOTE } from '@/api/axios'

// Refleja GET /pagos/cobranza (control de cobranza) y sus hermanos.

export interface CobranzaFiltro {
  gestionId?:   number
  trimestreId?: number
  cursoId?:     number
  conceptoId?:  number
}

export interface Totales {
  esperado:          number
  recaudado:         number
  porCobrar:         number
  vencido:           number
  porcentajeCobrado: number | null
}

export interface FilaCursoCobranza extends Totales {
  cursoId:     number
  curso:       string
  estudiantes: number
  deudores:    number
}

export interface DeudorCobranza {
  inscripcionId: number
  estudiante:    string
  ci:            string
  cursoId:       number
  curso:         string
  contacto:      { nombre: string; telefono: string }
  saldo:         number
  vencido:       number
  maxDiasMora:   number
  proximoVencimiento: string | null
  pendientes:    Array<{ conceptoId: number; nombre: string; saldo: number; fechaVencimiento: string | null; vencido: boolean; diasMora: number }>
}

export interface AlDiaCobranza { inscripcionId: number; estudiante: string; cursoId: number; curso: string; pagado: number }

export interface CeldaMatriz {
  estado:  'PAGADO' | 'PARCIAL' | 'PENDIENTE'
  pagado:  number
  saldo:   number
  vencido: boolean
}

export interface CobranzaResponse {
  gestion:   { id: number; anio: number }
  periodo:   { trimestreId: number | null; nombre: string }
  hoy:       string
  conceptos: Array<{ id: number; nombre: string; monto: number; fechaVencimiento: string | null; trimestreId: number | null }>
  kpis:      Totales & { estudiantes: number; deudores: number; morosos: number; alDia: number }
  porCurso:  FilaCursoCobranza[]
  deudores:  DeudorCobranza[]
  alDia:     AlDiaCobranza[]
  matriz:    Array<{ inscripcionId: number; estudiante: string; celdas: Record<number, CeldaMatriz> }> | null
}

export interface RecibidosFiltro {
  gestionId?:       number
  cursoId?:         number
  conceptoId?:      number
  metodo?:          'EFECTIVO' | 'TRANSFERENCIA' | 'QR'
  desde?:           string
  hasta?:           string
  incluirAnulados?: boolean
}

export interface PagoRecibido {
  id:            number
  numeroRecibo:  string | null
  fecha:         string
  metodo:        'EFECTIVO' | 'TRANSFERENCIA' | 'QR'
  estado:        string
  monto:         number
  concepto:      string
  cajero:        string
  estudiante:    string
  curso:         string
  observaciones: string | null
}

export interface RecibidosResponse {
  gestion:   { id: number; anio: number }
  pagos:     PagoRecibido[]
  truncado:  boolean
  totales:   { monto: number; cantidad: number; porMetodo: Record<string, { monto: number; cantidad: number }> }
}

// Quita claves vacías: un <select> sin elegir manda '' y el servidor lo rechazaría
const limpio = <T extends object>(f: T) =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v !== null && v !== undefined))

export const cobranzaApi = {
  get: (filtro: CobranzaFiltro) =>
    api.get<CobranzaResponse>('/pagos/cobranza', { params: limpio(filtro), timeout: TIMEOUT_LOTE }).then(r => r.data),

  getRecibidos: (filtro: RecibidosFiltro) =>
    api.get<RecibidosResponse>('/pagos/cobranza/recibidos', { params: limpio(filtro) }).then(r => r.data),

  descargarExcel: (filtro: CobranzaFiltro) =>
    api.get<Blob>('/pagos/cobranza/excel', { params: limpio(filtro), responseType: 'blob', timeout: TIMEOUT_LOTE }).then(r => r.data),

  actualizarConcepto: (id: number, data: {
    nombre?: string; monto?: number; obligatorio?: boolean; activo?: boolean
    fechaVencimiento?: string | null; trimestreId?: number | null
  }) => api.put(`/pagos/conceptos/${id}`, data).then(r => r.data),

  generarConceptos: (data: {
    gestionId: number; tipo: 'MENSUAL' | 'TRIMESTRAL'; nombreBase: string; monto: number; obligatorio?: boolean
    mesDesde?: number; mesHasta?: number; diaVencimiento?: number; diasPlazo?: number
  }) => api.post<{ creados: number; yaExistian: number }>('/pagos/conceptos/generar', data).then(r => r.data),
}
