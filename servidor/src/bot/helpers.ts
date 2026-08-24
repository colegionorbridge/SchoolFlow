const AFIRMATIVO = ['si', 'sí', 's', 'dale', 'ok', 'confirmo', 'registrarme', 'registrar', 'registro', 'comenzar', 'empezar', 'iniciar', 'confirmar'];
const NEGATIVO = ['no', 'cancelar', 'salir', 'n', 'cancelo', 'abortar', 'terminar', 'finalizar'];
const CANCELAR = ['cancelar', 'salir', 'abortar', 'terminar', 'finalizar'];
const CORTESIA = ['gracias', 'gracia', 'ok', 'dale', 'listo', 'genial', 'perfecto', 'buenisimo', 'excelente', 'chau', 'adios', 'nos vemos', 'buen dia', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches'];

export function esAfirmativo(texto: string): boolean {
  const t = texto.toLowerCase().trim();
  return AFIRMATIVO.some(p => t === p || t.startsWith(p));
}

export function esNegativo(texto: string): boolean {
  const t = texto.toLowerCase().trim();
  return NEGATIVO.some(p => t === p || t.startsWith(p));
}

export function esCancelar(texto: string): boolean {
  const t = texto.toLowerCase().trim();
  return CANCELAR.some(p => t === p || t.startsWith(p));
}

export function esCortesia(texto: string): boolean {
  const t = texto.toLowerCase().trim();
  return CORTESIA.some(p => t === p || t.startsWith(p));
}

export function normalizar(texto: string): string {
  return texto.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
