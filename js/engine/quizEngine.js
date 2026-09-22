/**
 * quizEngine.js — rondas de preguntas del banco. Sin DOM.
 *
 * DECISIONES ARQUITECTONICAS
 *
 * 1. Opcion multiple con respuesta inmediata. A diferencia del caso clinico,
 *    aqui el error se muestra en el momento: el banco entrena el dato puntual
 *    (una dosis, un umbral, un criterio) y el dato se fija mejor si se corrige
 *    en caliente, con la cita de la norma a la vista.
 *
 * 2. Seleccion sesgada hacia lo que falta, como learningEngine: lo nunca visto
 *    y lo fallado sale mas; lo acertado varias veces seguidas, menos.
 *
 * 3. El orden de las opciones se baraja en cada ronda, para que no se memorice
 *    "era la B" en vez del contenido.
 */

import { hoy } from '../services/storage.js';

export const PREGUNTAS_POR_RONDA = 10;

const diasDesde = (iso) => iso ? Math.floor((Date.now() - new Date(iso + 'T00:00:00').getTime()) / 86400000) : 999;

export function pesoPregunta(q, perfil) {
  const r = perfil.preguntas?.[q.id];
  if (!r) return 3;                                   // nunca vista
  let w = 1;
  if (r.fallos > r.aciertos || r.racha === 0) w *= 5; // la ultima vez la fallo
  else if (r.racha >= 3) w *= 0.25;                   // dominada
  if (diasDesde(r.ultima) < 1) w *= 0.3;              // vista hoy
  return w;
}

function barajar(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** filtro: { area, soloFalladas }. rnd inyectable para pruebas. */
export function crearRonda(banco, perfil, filtro = {}, rnd = Math.random) {
  let pool = banco.preguntas.slice();
  if (filtro.area) pool = pool.filter(q => q.area === filtro.area);
  if (filtro.soloFalladas) pool = pool.filter(q => { const r = perfil.preguntas?.[q.id]; return r && r.racha === 0; });
  const n = Math.min(filtro.n || PREGUNTAS_POR_RONDA, pool.length);

  // muestreo ponderado sin reemplazo
  const elegidas = [];
  const restantes = pool.map(q => ({ q, w: pesoPregunta(q, perfil) }));
  while (elegidas.length < n && restantes.length) {
    const total = restantes.reduce((s, x) => s + x.w, 0);
    let t = rnd() * total, k = 0;
    while (k < restantes.length - 1 && (t -= restantes[k].w) > 0) k++;
    elegidas.push(restantes.splice(k, 1)[0].q);
  }

  return {
    filtro,
    inicio: Date.now(),
    preguntas: elegidas.map(q => ({ ...q, orden: barajar(q.opciones.map((_, i) => i), rnd) })),
    i: 0,
    elegida: null,        // indice (en el orden mostrado) de la opcion elegida en la pregunta actual
    respuestas: []        // { id, correcta: bool }
  };
}

export const preguntaActual = (ronda) => ronda.preguntas[ronda.i] || null;

/** Registra la respuesta a la pregunta actual. mostrada = indice en el orden barajado. */
export function responderPregunta(ronda, perfil, mostrada) {
  const q = preguntaActual(ronda);
  if (!q || ronda.elegida != null) return null;
  const correcta = q.orden[mostrada] === q.correcta;
  ronda.elegida = mostrada;
  ronda.respuestas.push({ id: q.id, correcta });

  perfil.preguntas ||= {};
  const r = perfil.preguntas[q.id] ||= { aciertos: 0, fallos: 0, racha: 0, ultima: null };
  if (correcta) { r.aciertos++; r.racha++; } else { r.fallos++; r.racha = 0; }
  r.ultima = hoy();
  return { correcta, mostradaCorrecta: q.orden.indexOf(q.correcta) };
}

export function siguientePregunta(ronda) {
  ronda.i++;
  ronda.elegida = null;
  return preguntaActual(ronda);
}

export function resumenRonda(ronda) {
  const aciertos = ronda.respuestas.filter(r => r.correcta).length;
  const falladas = ronda.preguntas.filter(q => ronda.respuestas.some(r => r.id === q.id && !r.correcta));
  return { aciertos, total: ronda.respuestas.length, falladas };
}

/** Para la pantalla de inicio del modulo. */
export function estadisticasBanco(banco, perfil) {
  const reg = perfil.preguntas || {};
  const vistas = banco.preguntas.filter(q => reg[q.id]);
  const aciertos = vistas.reduce((s, q) => s + reg[q.id].aciertos, 0);
  const intentos = vistas.reduce((s, q) => s + reg[q.id].aciertos + reg[q.id].fallos, 0);
  return {
    total: banco.preguntas.length,
    vistas: vistas.length,
    dominadas: vistas.filter(q => reg[q.id].racha >= 3).length,
    pendientes: vistas.filter(q => reg[q.id].racha === 0).length,
    pct: intentos ? Math.round(aciertos / intentos * 100) : null
  };
}
