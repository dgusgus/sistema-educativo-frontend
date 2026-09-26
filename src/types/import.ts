export interface ResultadoImport {
  totalFilas: number
  exitosas: number
  fallidas: number
  errores: Array<{ fila: number; error: string }>
}