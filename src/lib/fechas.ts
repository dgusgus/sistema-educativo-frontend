// src/lib/fechas.ts
//
// Fechas de "solo día" (columnas @db.Date: asistencia, trimestres, pagos,
// bitácora...) sin el desfase de zona horaria.
//
// El problema: el backend las envía como "2027-03-01T00:00:00.000Z" (medianoche
// UTC). Un navegador en Bolivia (UTC-4) hace new Date(...) y lo interpreta como
// el 28 de febrero a las 20:00, así que mostraba el día ANTERIOR. Para una fecha
// de calendario, la zona horaria no debe intervenir: se toma solo AAAA-MM-DD.

const SOLO_DIA = /^(\d{4})-(\d{2})-(\d{2})/

// Fecha de calendario → Date a mediodía LOCAL (a mediodía ninguna zona horaria
// puede cambiar el día). Si el texto no empieza con AAAA-MM-DD, conversión normal.
export function fechaSoloDia(valor: string): Date {
  const m = SOLO_DIA.exec(valor)
  if (!m) return new Date(valor)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0)
}

// Equivalente a toLocaleDateString('es-BO', opciones) pero para fechas de solo día.
export function formatoFecha(
  valor: string | null | undefined,
  opciones?: Intl.DateTimeFormatOptions,
): string {
  if (!valor) return '—'
  return fechaSoloDia(valor).toLocaleDateString('es-BO', opciones)
}

// "Hoy" como AAAA-MM-DD en la hora LOCAL del navegador.
// new Date().toISOString().split('T')[0] devuelve la fecha en UTC: a partir de
// las 20:00 en Bolivia ya es "mañana" (y el sistema tiene turno NOCHE).
export function hoyLocal(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// Días de calendario desde hoy hasta una fecha (0 = hoy, negativo = ya pasó).
export function diasHasta(valor: string): number {
  const hoy = fechaSoloDia(hoyLocal())
  return Math.round((fechaSoloDia(valor).getTime() - hoy.getTime()) / 86_400_000)
}