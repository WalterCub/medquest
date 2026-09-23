#!/usr/bin/env node
/** smoke.mjs — juega una partida completa sin DOM para probar los motores. */
import { readFileSync } from 'node:fs';
import * as CE from '../js/engine/caseEngine.js';
import * as TE from '../js/engine/tribunalEngine.js';
import { evaluar } from '../js/engine/scoringEngine.js';
import { elegirCaso, registrarResultado, conceptosPendientes } from '../js/engine/learningEngine.js';
import * as RE from '../js/engine/rewardEngine.js';
import * as QZ from '../js/engine/quizEngine.js';
import * as AV from '../js/engine/avatarEngine.js';

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const caso = JSON.parse(readFileSync(new URL('../cases/MI-003.json', import.meta.url)));
const perfil = { kamas: 0, dias: [], partidas: [], casos: {}, conceptos: {}, areas: {}, misiones: {}, premios: [], canjes: [], ajustes: {} };

function jugar(nivel, { perfecta }) {
  const p = CE.crearPartida(caso, nivel);
  for (const g of CE.GRUPOS_INFO) {
    if (!caso.descubrimiento[g]) continue;
    if (!perfecta && g === 'antecedentes') continue;           // omite antecedentes a proposito
    CE.declarar(p, g, 'Voy a buscar los datos que este grupo exige, uno por uno.');
    const r = CE.revelar(caso, p, g);
    if (!r.ok) throw new Error('no revelo ' + g + ': ' + r.motivo);
  }
  // pide los estudios ESPERADOS de la rubrica
  for (const e of caso.rubrica.estudios.filter(x => x.valoracion === 'ESPERADO')) {
    CE.solicitarEstudio(caso, p, e.clave);
  }
  CE.solicitarEstudioLibre(caso, p, 'Gasometria arterial');
  CE.proponer(p, 'diagnosticos', 'Crisis asmatica');
  if (perfecta) CE.proponer(p, 'diagnosticos', 'asma moderado persistente');
  ['EPOC', 'hiperventilacion', 'cuerpo extrano', 'tromboembolismo'].forEach(d => CE.proponer(p, 'diferenciales', d));
  ['oxigeno', 'salbutamol', 'camara espaciadora', 'corticoide'].forEach(c => CE.proponer(p, 'conductas', c));
  if (perfecta && nivel === 1) CE.proponer(p, 'conductas', 'referir');
  CE.cerrarCaso(p);

  const qs = TE.construirInterrogatorio(caso, p);
  qs.forEach((q, i) => TE.responder(p, q, i % 3 === 0 ? 'completa' : i % 3 === 1 ? 'parcial' : 'no_supe'));

  const r = evaluar(caso, p);
  r.log = p.decisionLog;
  const previos = conceptosPendientes(perfil).map(k => k.id);
  const rec = RE.recompensar(perfil, caso, r, previos);
  registrarResultado(perfil, caso, r);
  perfil.kamas += rec.total;
  return { p, qs, r, rec };
}

console.log('--- nivel 1, jugada incompleta ---');
let a = jugar(1, { perfecta: false });
console.log('preguntas de tribunal disparadas:', a.qs.length);
console.log('  nucleo:', a.qs.filter(q => q.origen === 'nucleo').length,
            ' por decision:', a.qs.filter(q => q.origen === 'decision').length,
            ' no contemplado:', a.qs.filter(q => q.origen === 'no_contemplado').length);
console.log('dimensiones:', a.r.dimensiones.map(d => `${d.id} ${d.pct}%`).join('  '));
console.log('global:', a.r.global);
console.log('conceptos para repasar:', a.r.conceptosRepaso.length);
a.r.conceptosRepaso.slice(0, 3).forEach(k => console.log('   -', k.id, '|', k.motivos[0].slice(0, 70)));
console.log('kamas:', a.rec.total, a.rec.lineas.map(l => l.texto).join(' / '));
console.log('decisionLog entradas:', a.p.decisionLog.length);

console.log('\n--- nivel 3, jugada completa ---');
let b = jugar(3, { perfecta: true });
console.log('preguntas:', b.qs.length, '| global:', b.r.global, '| repaso:', b.r.conceptosRepaso.length);
console.log('dimensiones:', b.r.dimensiones.map(d => `${d.id} ${d.pct}%`).join('  '));

console.log('\n--- comprobaciones ---');
const chk = [];
chk.push(['la conducta referir solo se exige en nivel 1',
  caso.rubrica.conductas.find(c => c.clave === 'cx_referir').nivel.join() === '1']);
chk.push(['omitir antecedentes dispara pregunta siOmitioInfo',
  a.qs.some(q => q.id === 't18')]);
chk.push(['pedir un estudio no contemplado genera repregunta y no error',
  a.qs.some(q => q.origen === 'no_contemplado')]);
chk.push(['el estudio libre no resta en la dimension de estudios',
  a.r.detalle.estudios.sinResultado.length === 1]);
chk.push(['un estudio ESPERADO que no existe en el nivel jugado no resta',
  a.p.estudiosSolicitados.some(e => e.origen === 'bloqueado') && a.r.dimensiones.find(d => d.id === 'est').pct === 100]);
chk.push(['el estudio bloqueado explica que dice la norma de caracterizacion',
  a.p.estudiosSolicitados.filter(e => e.origen === 'bloqueado').every(e => /norma/i.test(e.resultado))]);
chk.push(['no existe ninguna funcion que genere evolucion clinica',
  !Object.keys(CE).some(k => /evolu|consecuen|simul/i.test(k))]);
// ---------- banco de preguntas ----------
const banco = { preguntas: JSON.parse(readFileSync(new URL('../preguntas/banco.json', import.meta.url))).preguntas };
let semilla = 7; const rnd = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
const ronda = QZ.crearRonda(banco, perfil, {}, rnd);
ronda.preguntas.forEach((q, i) => {
  const correcta = q.orden.indexOf(q.correcta);
  QZ.responderPregunta(ronda, perfil, i % 2 ? correcta : (correcta + 1) % q.opciones.length);   // alterna acierto y error
  QZ.siguientePregunta(ronda);
});
const rres = QZ.resumenRonda(ronda);
console.log('\n--- ronda de preguntas ---');
console.log(`aciertos ${rres.aciertos}/${rres.total}, falladas ${rres.falladas.length}`);
chk.push(['la ronda trae 10 preguntas distintas', ronda.preguntas.length === 10 && new Set(ronda.preguntas.map(q => q.id)).size === 10]);
chk.push(['el acierto y el error se evaluan contra el orden barajado', rres.aciertos === 5 && rres.falladas.length === 5]);
const repaso = QZ.crearRonda(banco, perfil, { soloFalladas: true }, rnd);
chk.push(['"repasar falladas" trae exactamente las falladas', repaso.preguntas.length === 5 && repaso.preguntas.every(q => rres.falladas.some(f => f.id === q.id))]);
const pesoFallada = QZ.pesoPregunta(rres.falladas[0], perfil);
const pesoNueva = QZ.pesoPregunta(banco.preguntas.find(q => !perfil.preguntas[q.id]), perfil);
chk.push(['una pregunta fallada pesa mas que una nunca vista, aunque sea de hoy', pesoFallada > 1 && pesoNueva === 3]);

chk.push(['el perfil registro la partida', perfil.partidas.length === 2]);
chk.push(['los conceptos fallados quedaron en el perfil', Object.keys(perfil.conceptos).length > 0]);
// ---------- personaje y logros ----------
perfil.contadores = { rondas: 1 };
const nuevos = AV.revisarLogros(perfil);
chk.push(['los logros salen del progreso ya hecho (caso + ronda)', ['primer-turno', 'bautizo'].every(id => nuevos.some(l => l.id === id))]);
chk.push(['un logro se anuncia una sola vez', AV.revisarLogros(perfil).length === 0]);
chk.push(['no se puede equipar una pieza bloqueada', AV.equipar(perfil, 'birrete') === false]);
chk.push(['equipar una pieza desbloqueada la pone y tocarla de nuevo la quita',
  AV.equipar(perfil, 'gorro') && perfil.avatar.equipado.cabeza === 'gorro' && AV.equipar(perfil, 'gorro') && !perfil.avatar.equipado.cabeza]);
chk.push(['cada pieza tiene exactamente un logro que la desbloquea',
  AV.PIEZAS.every(p => AV.LOGROS.filter(l => l.da === p.id).length === 1) && AV.LOGROS.every(l => AV.pieza(l.da))]);
chk.push(['el caso de prueba no cuenta para los logros',
  AV.medidas({ partidas: [{ area: 'DEMO', nivel: 1 }], casos: { 'DEMO-001': { mejorPuntaje: 100 } } }).casos === 0]);

chk.forEach(([t, ok]) => console.log(ok ? '  ok   ' + t : '  FALLA ' + t));
process.exit(chk.every(c => c[1]) ? 0 : 1);
