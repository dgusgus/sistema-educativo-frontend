// Helpers de presentación de docentes (antes vivían dentro de DocentesView).
import type { Docente, Nivel } from '@/types'
import { codigoCurso } from '@/lib/abreviar'

export type AsignacionDocente = NonNullable<Docente['asignaciones']>[number]

const NIVEL_TEXTO: Record<Nivel, string> = { PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }

// docenteApi.getAll() ya incluye las asignaciones de la gestión activa; el curso
// no trae "nombre" calculado (solo nivel/grado/paralelo), se arma aquí.
export function cursosDe(d: Docente): Array<{ id: number; corto: string; completo: string }> {
  return (d.asignaciones ?? []).map(a => {
    const c = a.curso
    const completo = c
      ? `${a.materia?.nombre ?? '?'} — ${c.grado}° ${NIVEL_TEXTO[c.nivel]} "${c.paralelo}"`
      : a.materia?.nombre ?? '?'
    const corto = c
      ? `${a.materia?.codigo ?? a.materia?.nombre?.slice(0, 3).toUpperCase() ?? '?'} · ${codigoCurso(c)}`
      : a.materia?.nombre ?? '?'
    return { id: a.id, corto, completo }
  })
}
