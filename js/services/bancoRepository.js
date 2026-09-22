/**
 * bancoRepository.js — de donde salen las preguntas del banco.
 *
 * Igual que caseRepository: en la version de un solo archivo vienen en
 * window.MEDQUEST_BANCO; en la version modular se leen de /preguntas.
 */

let cacheBanco = null;

export async function cargarBanco() {
  if (cacheBanco) return cacheBanco;
  if (typeof window !== 'undefined' && window.MEDQUEST_BANCO) {
    cacheBanco = window.MEDQUEST_BANCO;
    return cacheBanco;
  }
  const [banco, fuentes] = await Promise.all([
    fetch('preguntas/banco.json').then(r => r.json()),
    fetch('preguntas/fuentes.json').then(r => r.json())
  ]);
  cacheBanco = { preguntas: banco.preguntas, fuentes };
  return cacheBanco;
}
