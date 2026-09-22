/**
 * tribunalEngine.js — el jefe final. Determinista.
 *
 * DECISION ARQUITECTONICA
 * No hay IA aqui. Las preguntas ya estan escritas en el caso y este modulo solo
 * decide cuales se disparan leyendo el DecisionLog. Eso significa que el
 * tribunal nunca puede preguntar algo que no este respaldado por la fuente, y
 * que dos partidas identicas producen el mismo examen oral.
 *
 * Cuando se agregue el tribunal con IA (v0.4), entra como capa de repregunta
 * NO PUNTUADA sobre estas mismas preguntas. La nota siempre sale de aqui.
 */

import { normalizar } from './caseEngine.js';
import { coincide } from './scoringEngine.js';

/** Devuelve la lista ordenada de preguntas que corresponden a esta partida. */
export function construirInterrogatorio(caso, p) {
  const pedidos = new Set(p.estudiosSolicitados.filter(e => e.origen === 'caso').map(e => e.clave));
  const infoVista = new Set(p.infoDescubierta);

  const dxAcertado = (clave) => {
    const item = [...(caso.rubrica.diagnosticosEsperados || []), ...(caso.rubrica.diagnosticosDiferenciales || [])]
      .find(d => d.clave === clave);
    if (!item) return false;
    return [...p.diagnosticos, ...p.diferenciales].some(t => coincide(t, item));
  };
  const conductaPropuesta = (clave) => {
    const item = (caso.rubrica.conductas || []).find(d => d.clave === clave);
    if (!item) return false;
    return p.conductas.some(t => coincide(t, item));
  };

  const aplica = (d) => {
    switch (d.tipo) {
      case 'siempre':          return true;
      case 'siPidio':          return pedidos.has(d.clave);
      case 'siNoPidio':        return !pedidos.has(d.clave);
      case 'siDiagnostico':    return dxAcertado(d.clave);
      case 'siNoDiagnostico':  return !dxAcertado(d.clave);
      case 'siConducta':       return conductaPropuesta(d.clave);
      case 'siNoConducta':     return !conductaPropuesta(d.clave);
      case 'siOmitioInfo':     return !infoVista.has(d.clave);
      default:                 return false;
    }
  };

  const base = (caso.tribunal || [])
    .filter(q => aplica(q.disparador || {}))
    .map(q => ({
      id: q.id,
      pregunta: q.pregunta,
      esperado: q.loQueSeEsperaOir || [],
      conceptoLigado: q.conceptoLigado || null,
      fuente: q.fuente ?? null,
      origen: q.disparador.tipo === 'siempre' ? 'nucleo' : 'decision'
    }));

  // Estudios que pidio y el caso no contempla: no son error, son repregunta.
  const libres = p.estudiosSinResultado
    .filter(e => e.preguntaTribunal)
    .map((e, i) => ({
      id: 'libre_' + i,
      pregunta: e.preguntaTribunal,
      esperado: [],
      conceptoLigado: null,
      fuente: null,
      origen: 'no_contemplado',
      nota: e.comentarioFuente || null
    }));

  // Primero las del nucleo, en el orden del caso; despues las derivadas de sus
  // decisiones; al final las de estudios no contemplados.
  return [
    ...base.filter(q => q.origen === 'nucleo'),
    ...base.filter(q => q.origen === 'decision'),
    ...libres
  ];
}

/**
 * Registra la autoevaluacion de una respuesta.
 * valor: 'completa' | 'parcial' | 'no_supe'
 * La jugadora se califica despues de ver loQueSeEsperaOir. Es deliberado:
 * un matcher de texto no puede juzgar una respuesta oral, y fingir que si
 * puede seria peor que pedirle honestidad.
 */
export function responder(p, pregunta, valor, texto = '') {
  const previa = p.tribunalRespuestas.find(r => r.id === pregunta.id);
  const reg = {
    id: pregunta.id,
    pregunta: pregunta.pregunta,
    autoevaluacion: valor,
    texto: String(texto || '').trim() || null,
    conceptoLigado: pregunta.conceptoLigado,
    origen: pregunta.origen
  };
  if (previa) Object.assign(previa, reg);
  else p.tribunalRespuestas.push(reg);
  p.decisionLog.push({
    momento: Math.round((Date.now() - p.inicio) / 1000),
    tipo: 'tribunal', accion: pregunta.id, valor
  });
}

export const PESO_AUTOEVAL = { completa: 1, parcial: 0.5, no_supe: 0 };
