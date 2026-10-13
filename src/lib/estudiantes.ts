// Helpers de presentación de Estudiante/Inscripción (antes vivían dentro de EstudiantesView).
import type { Estudiante, Inscripcion, Nivel } from '@/types'

const NIVEL_TEXTO: Record<Nivel, string> = { PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }

// En la lista (GET /estudiantes) cada estudiante trae solo su ÚLTIMA inscripción.
export function ultimaInscripcion(e: Estudiante): Inscripcion | null {
  return e.inscripciones?.[0] ?? null
}

// El curso embebido en la inscripción no trae "nombre" calculado, solo nivel/grado/paralelo.
export function nombreCursoDeInscripcion(insc: Inscripcion | null): string {
  const c = insc?.curso
  if (!c) return '—'
  return `${c.grado}° ${NIVEL_TEXTO[c.nivel]} "${c.paralelo}"`
}
