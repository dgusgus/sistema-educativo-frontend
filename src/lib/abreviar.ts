// src/lib/abreviar.ts
//
// Códigos cortos para mostrar en espacios chicos (badges, chips) donde
// el nombre completo rompe el layout. La materia YA tiene su código
// corto real (Materia.codigo, ej. "MAT") — acá solo se genera el del
// curso, que no existe como campo propio.

import type { Nivel } from '@/types'

// 1° "A" Secundaria → "1AS"   ·   2° "B" Primaria → "2BP"
export function codigoCurso(curso: { grado: number; paralelo: string; nivel: Nivel }): string {
  const inicialNivel = curso.nivel === 'PRIMARIA' ? 'P' : 'S'
  return `${curso.grado}${curso.paralelo.toUpperCase()}${inicialNivel}`
}