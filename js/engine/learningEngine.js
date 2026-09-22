/**
 * learningEngine.js — que le conviene practicar ahora.
 *
 * DECISION ARQUITECTONICA
 * La seleccion se siente aleatoria para la jugadora pero esta sesgada hacia lo
 * que le falta. Los pesos son los del documento de especificacion. Se calculan
 * sobre el perfil persistido, no sobre la sesion, para que el sesgo sobreviva
 * al cierre de la app.
 */

import { hoy } from '../services/storage.js';

const DIA = 86400000;
const dias = (iso) => iso ? Math.floor((Date.now() - new Date(iso + 'T00:00:00').getTime()) / DIA) : 999;

export function pesoDeCaso(caso, perfil) {
  const r = perfil.casos[caso.id];
  let w = 1;
  if (!r) w *= 3;                                   // nunca jugado
  else {
    if (r.mejorPuntaje < 60) w *= 5;                // fallado antes
    else if (r.mejorPuntaje >= 85) w *= 0.7;        // dominado
    const d = dias(r.ultima);
    if (d <= 2) w *= 0.2;                           // jugado recien
    else if (d >= 14) w *= 2;                       // hace mucho que no sale
  }
  const a = perfil.areas[caso.area];
  if (a && a.partidas > 0) {
    const media = a.sumaPuntaje / a.partidas;
    if (media < 60) w *= 4;                         // area debil
  }
  // repaso pendiente: algun concepto de este caso esta fallado
  const idsConceptos = (caso.rubrica?.conceptosClave || []).map(k => k.id);
  const pendientes = idsConceptos.filter(id => {
    const c = perfil.conceptos[id];
    return c && c.fallos > c.aciertos;
  });
  if (pendientes.length) w *= 4;
  return Math.max(0.05, w);
}

export function elegirCaso(casos, perfil, filtro = {}) {
  let pool = casos.filter(c => filtro.incluirPrueba ? true : c.tipo === 'medico');
  if (filtro.area) pool = pool.filter(c => c.area === filtro.area);
  if (filtro.dificultad) pool = pool.filter(c => c.dificultad === filtro.dificultad);
  if (filtro.soloRepaso) {
    pool = pool.filter(c => (c.rubrica?.conceptosClave || []).some(k => {
      const x = perfil.conceptos[k.id]; return x && x.fallos > x.aciertos;
    }));
  }
  if (!pool.length) pool = casos.filter(c => c.tipo === 'medico');
  if (!pool.length) pool = casos.slice();

  const pesos = pool.map(c => pesoDeCaso(c, perfil));
  const total = pesos.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) { r -= pesos[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

/** Registra el resultado de una partida en el perfil. Muta y devuelve el perfil. */
export function registrarResultado(perfil, caso, resultado) {
  const f = hoy();
  if (!perfil.dias.includes(f)) { perfil.dias.push(f); perfil.dias.sort(); }

  const r = perfil.casos[caso.id] || { veces: 0, mejorPuntaje: 0 };
  r.veces++; r.ultima = f; r.ultimoPuntaje = resultado.global;
  r.mejorPuntaje = Math.max(r.mejorPuntaje || 0, resultado.global);
  perfil.casos[caso.id] = r;

  const a = perfil.areas[caso.area] || { partidas: 0, sumaPuntaje: 0 };
  a.partidas++; a.sumaPuntaje += resultado.global;
  perfil.areas[caso.area] = a;

  for (const k of resultado.conceptosRepaso) {
    const c = perfil.conceptos[k.id] || { fallos: 0, aciertos: 0 };
    c.fallos++; c.ultima = f; c.enunciado = k.enunciado; c.casoId = caso.id;
    c.pagina = k.pagina || null;
    perfil.conceptos[k.id] = c;
  }
  for (const k of resultado.dominados) {
    const c = perfil.conceptos[k.id];
    if (c) { c.aciertos++; c.ultima = f; }            // solo cuenta si ya lo habia fallado
  }

  perfil.partidas.push({
    casoId: caso.id, area: caso.area, nivel: resultado.nivel,
    global: resultado.global, fecha: f, tiempoSeg: resultado.tiempoSeg
  });
  if (perfil.partidas.length > 200) perfil.partidas = perfil.partidas.slice(-200);
  return perfil;
}

/** Conceptos que siguen fallados, del mas urgente al menos. */
export function conceptosPendientes(perfil) {
  return Object.entries(perfil.conceptos)
    .filter(([, c]) => c.fallos > c.aciertos)
    .map(([id, c]) => ({ id, ...c }))
    .sort((a, b) => (b.fallos - b.aciertos) - (a.fallos - a.aciertos));
}
