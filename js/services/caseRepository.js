/**
 * caseRepository.js — de donde salen los casos.
 *
 * DECISION ARQUITECTONICA
 * Los casos viven en /cases como JSON y NUNCA dentro del codigo. Este modulo
 * es el unico que sabe de donde se cargan. Hoy hay dos origenes:
 *   - window.MEDQUEST_CASOS, que usa la version empaquetada de un solo archivo
 *   - fetch a /cases/*.json, que usa la version modular servida por http
 * Cuando los casos pasen a Supabase solo cambia cargarTodos().
 */

export const AREAS = {
  MI:   { nombre: 'Medicina Interna',        corto: 'Interna',   color: 'mi',   ico: '🫀' },
  CX:   { nombre: 'Cirugia',                 corto: 'Cirugia',   color: 'cx',   ico: '🦴' },
  GO:   { nombre: 'Gineco-obstetricia',      corto: 'Gineco',    color: 'go',   ico: '🤰' },
  PED:  { nombre: 'Pediatria',               corto: 'Pediatria', color: 'pd',   ico: '🧸' },
  SP:   { nombre: 'Salud Publica',           corto: 'Publica',   color: 'sp',   ico: '🏥' },
  DEMO: { nombre: 'Caso de prueba',          corto: 'Prueba',    color: 'demo', ico: '🧪' }
};

let cacheCasos = null;

export async function cargarTodos() {
  if (cacheCasos) return cacheCasos;
  if (typeof window !== 'undefined' && window.MEDQUEST_CASOS) {
    cacheCasos = window.MEDQUEST_CASOS.slice();
    return cacheCasos;
  }
  const indice = await fetch('cases/index.json').then(r => r.json());
  cacheCasos = await Promise.all(indice.casos.map(id => fetch(`cases/${id}.json`).then(r => r.json())));
  return cacheCasos;
}

/** Solo los casos que pueden usarse para evaluar de verdad. */
export function jugablesEnExamen(casos) {
  return casos.filter(c => c.tipo === 'medico' && c.estado !== 'BORRADOR');
}

export function porId(casos, id) {
  return casos.find(c => c.id === id) || null;
}
