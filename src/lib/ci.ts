/**
 * Advertencia SUAVE de formato de CI (cédula de identidad boliviana).
 * Por qué es suave: el sistema también registra extranjeros (pasaporte, DIE),
 * documentos antiguos e importaciones de Excel. Bloquear rechazaría datos
 * legítimos; avisar permite detectar errores de tipeo sin impedir guardar.
 * Formato habitual: 6–8 dígitos + complemento opcional (ej. 4521873, 5873210-1B).
 */
const CI_BOLIVIANO = /^\d{6,8}(-?[1-9][A-Za-z])?$/

export function advertenciaCi(valor: string | null | undefined): string | null {
  const v = (valor ?? '').trim()
  if (!v) return null
  if (CI_BOLIVIANO.test(v)) return null
  if (/^\d+$/.test(v)) return 'El CI boliviano suele tener 7 dígitos. Revisa si falta o sobra alguno.'
  return 'Formato poco habitual. El CI suele ser 7 dígitos + complemento opcional (ej. 1234567-1A). Puedes guardar igual si es correcto.'
}