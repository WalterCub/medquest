/**
 * rewardEngine.js — Kamas Clinicas, racha y misiones.
 *
 * DECISIONES ARQUITECTONICAS
 *
 * 1. UNA SOLA MONEDA. El documento proponia XP no gastable ademas de Kamas.
 *    Para una jugadora con examen en fecha fija, dos economias son complejidad
 *    sin funcion. El nivel se deriva de las Kamas ganadas acumuladas.
 *
 * 2. La recompensa NO refleja la nota medica. Se premia haber jugado, haber
 *    enfrentado al tribunal y haber corregido algo que antes fallo. Si solo se
 *    premiara el acierto, el error se volveria castigo y dejaria de jugar.
 *
 * 3. Racha indulgente: un dia libre por semana no la rompe.
 */

import { hoy } from '../services/storage.js';

export const GANANCIAS = {
  completarCaso: 40,
  diagnosticoEsperado: 25,
  completarTribunal: 30,
  porRespuestaCompleta: 5,
  corregirConceptoFallado: 20,
  areaDebil: 15,
  primeraVezDelDia: 25,
  porPreguntaCorrecta: 5,
  rondaCompleta: 15
};

export function nivel(kamasGanadasTotal) {
  return Math.max(1, Math.floor(Math.sqrt(kamasGanadasTotal / 60)) + 1);
}

export function racha(dias) {
  const set = new Set(dias);
  const d = new Date();
  let n = 0, fallas = 0;
  for (let i = 0; i < 400; i++) {
    const k = d.toLocaleDateString('sv');
    if (set.has(k)) n++;
    else if (i > 0) { fallas++; if (fallas > 1) break; }
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** Calcula la recompensa de una partida. Devuelve { total, lineas }. */
export function recompensar(perfil, caso, resultado, conceptosFalladosAntes) {
  const lineas = [];
  const add = (n, texto) => { if (n > 0) lineas.push({ n, texto }); };

  add(GANANCIAS.completarCaso, 'Caso completado');
  if (resultado.dimensiones.find(d => d.id === 'dx').pct >= 100) {
    add(GANANCIAS.diagnosticoEsperado, 'Diagnostico esperado');
  }
  if (resultado.dimensiones.find(d => d.id === 'tri').total > 0) {
    add(GANANCIAS.completarTribunal, 'Tribunal enfrentado');
    const completas = Math.round(resultado.dimensiones.find(d => d.id === 'tri').n);
    add(completas * GANANCIAS.porRespuestaCompleta, `${completas} respuesta(s) defendidas`);
  }
  const corregidos = resultado.dominados.filter(k => conceptosFalladosAntes.includes(k.id));
  if (corregidos.length) add(corregidos.length * GANANCIAS.corregirConceptoFallado, `${corregidos.length} concepto(s) que antes fallabas`);

  const a = perfil.areas[caso.area];
  if (a && a.partidas > 1 && (a.sumaPuntaje / a.partidas) < 60) add(GANANCIAS.areaDebil, 'Practicaste un area debil');

  if (!perfil.dias.includes(hoy())) add(GANANCIAS.primeraVezDelDia, 'Primera partida del dia');

  const total = lineas.reduce((s, l) => s + l.n, 0);
  return { total, lineas, corregidos: corregidos.length };
}

/** Recompensa de una ronda del banco. Premia terminarla, no solo acertar. */
export function recompensarRonda(perfil, resumen) {
  const lineas = [];
  const add = (n, texto) => { if (n > 0) lineas.push({ n, texto }); };
  add(GANANCIAS.rondaCompleta, 'Ronda completada');
  add(resumen.aciertos * GANANCIAS.porPreguntaCorrecta, `${resumen.aciertos} respuesta(s) correctas`);
  if (!perfil.dias.includes(hoy())) add(GANANCIAS.primeraVezDelDia, 'Primera actividad del dia');
  return { total: lineas.reduce((s, l) => s + l.n, 0), lineas };
}

// ---------- misiones ----------
const CATALOGO = [
  { id: 'jugar',     texto: 'Completa un caso',                       meta: 1 },
  { id: 'tribunal',  texto: 'Supera un tribunal completo',            meta: 1 },
  { id: 'defender',  texto: 'Defiende 6 preguntas del tribunal',      meta: 6 },
  { id: 'repaso',    texto: 'Corrige un concepto que antes fallaste', meta: 1 },
  { id: 'provincia', texto: 'Juega un caso en primer nivel',          meta: 1 },
  { id: 'debil',     texto: 'Juega un caso de tu area mas floja',     meta: 1 },
  { id: 'preguntas', texto: 'Completa una ronda de preguntas',        meta: 1 }
];
export const RECOMPENSA_MISIONES = 120;

export function misionesDeHoy(perfil) {
  const f = hoy();
  if (perfil.misiones?.fecha === f) return perfil.misiones;
  // tres misiones estables por dia, deterministas segun la fecha
  const semilla = [...f].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const orden = CATALOGO.map((m, i) => ({ m, k: (semilla * (i + 7)) % 97 })).sort((a, b) => a.k - b.k);
  perfil.misiones = {
    fecha: f, cobrada: false,
    lista: orden.slice(0, 3).map(({ m }) => ({ ...m, progreso: 0 }))
  };
  return perfil.misiones;
}

export function avanzarMisiones(perfil, evento) {
  const ms = misionesDeHoy(perfil);
  for (const m of ms.lista) {
    if (m.id === evento.tipo) m.progreso = Math.min(m.meta, m.progreso + (evento.cantidad || 1));
  }
  return ms;
}

export const misionesCompletas = (ms) => ms.lista.every(m => m.progreso >= m.meta);
