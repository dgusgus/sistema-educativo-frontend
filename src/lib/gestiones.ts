import type { OpcionesCopiaForm } from '@/api/gestion.api'

// Al crear o copiar se ofrece traer la estructura de otra gestión; todo marcado por defecto.
export const nuevaCopia = (origenId: number | ''): OpcionesCopiaForm => ({
  origenId, cursos: true, asignaciones: true, trimestres: true, dimensiones: true, conceptosPago: true,
})
