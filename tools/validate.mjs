#!/usr/bin/env node
/**
 * Validador de casos MedQuest. Sin dependencias.
 *
 * Uso:
 *   node tools/validate.mjs                 valida todos los casos de cases/
 *   node tools/validate.mjs cases/MI-003.json
 *
 * Hace dos cosas distintas:
 *  1. Valida la forma contra las reglas del schema que importan en la practica.
 *  2. Valida la INTEGRIDAD REFERENCIAL, que es lo que el schema no puede:
 *     que cada item evaluable apunte a una fuente que existe, que cada
 *     disparador del tribunal apunte a una clave que existe, y que un caso
 *     marcado VALIDADO no tenga ningun agujero bibliografico.
 *
 * Salida: codigo 0 si no hay errores. Los avisos no hacen fallar la validacion.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validarBanco } from './banco.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const AREAS = ['MI', 'CX', 'GO', 'PED', 'SP', 'DEMO'];
const ESTADOS = ['BORRADOR', 'BIBLIOGRAFIA_VERIFICADA', 'VALIDADO'];
const VALORACIONES = ['ESPERADO', 'ACEPTABLE', 'OPCIONAL', 'NO_CONTEMPLADO_POR_LA_FUENTE'];
const DISPARADORES = ['siempre', 'siPidio', 'siNoPidio', 'siDiagnostico', 'siNoDiagnostico', 'siConducta', 'siNoConducta', 'siOmitioInfo'];
const GRUPOS_INFO = ['anamnesis', 'antecedentes', 'examenFisico'];
const GRUPOS_ESTUDIO = ['laboratorio', 'gabinete', 'otrosEstudios'];

function validarCaso(c, archivo) {
  const err = [];
  const avi = [];
  const E = (m) => err.push(m);
  const A = (m) => avi.push(m);

  // ---------- forma ----------
  if (!/^[A-Z]{2,4}-[0-9]{3}$/.test(c.id || '')) E(`id invalido: ${JSON.stringify(c.id)} (formato AREA-000)`);
  if (basename(archivo, '.json') !== c.id) E(`el nombre del archivo no coincide con el id (${c.id})`);
  if (!c.titulo || c.titulo.length < 4) E('falta titulo');
  if (!AREAS.includes(c.area)) E(`area invalida: ${c.area}`);
  if (!Number.isInteger(c.dificultad) || c.dificultad < 1 || c.dificultad > 5) E('dificultad debe ser entero de 1 a 5');
  if (!ESTADOS.includes(c.estado)) E(`estado invalido: ${c.estado}`);
  if (!['medico', 'prueba'].includes(c.tipo)) E(`tipo invalido: ${c.tipo}`);
  if (!c.presentacionInicial || !c.presentacionInicial.texto) E('falta presentacionInicial.texto');
  if (!Array.isArray(c.fuentes) || c.fuentes.length === 0) E('falta fuentes');
  if (!c.rubrica) E('falta rubrica');
  if (!Array.isArray(c.tribunal) || c.tribunal.length === 0) E('falta tribunal');
  if (err.length) return { err, avi };

  c.fuentes.forEach((f, i) => {
    ['institucion', 'documento', 'anio'].forEach(k => { if (!f[k]) E(`fuentes[${i}]: falta ${k}`); });
    if (c.tipo === 'medico' && !f.pagina && !f.capitulo) A(`fuentes[${i}]: sin capitulo ni pagina. Una fuente sin localizador no se puede verificar.`);
    if (c.tipo === 'medico' && !f.url) A(`fuentes[${i}]: sin url.`);
  });
  const nF = c.fuentes.length;

  // ---------- claves de descubrimiento ----------
  const clavesInfo = new Map();   // clave -> grupo
  const clavesEstudio = new Map();
  const criticas = new Set();
  const desc = c.descubrimiento || {};

  for (const g of GRUPOS_INFO) {
    const grupo = desc[g];
    if (!grupo) continue;
    if (!Array.isArray(grupo.items) || !grupo.items.length) { E(`descubrimiento.${g}: sin items`); continue; }
    grupo.items.forEach((it, i) => {
      if (!it.clave) return E(`descubrimiento.${g}[${i}]: falta clave`);
      if (clavesInfo.has(it.clave) || clavesEstudio.has(it.clave)) E(`clave duplicada en el caso: "${it.clave}"`);
      clavesInfo.set(it.clave, g);
      if (!it.texto) E(`descubrimiento.${g}.${it.clave}: falta texto`);
      if (it.critico) criticas.add(it.clave);
    });
  }
  for (const g of GRUPOS_ESTUDIO) {
    const grupo = desc[g];
    if (!grupo) continue;
    (grupo.items || []).forEach((it, i) => {
      if (!it.clave) return E(`descubrimiento.${g}[${i}]: falta clave`);
      if (clavesInfo.has(it.clave) || clavesEstudio.has(it.clave)) E(`clave duplicada en el caso: "${it.clave}"`);
      clavesEstudio.set(it.clave, g);
      if (!it.nombre) E(`descubrimiento.${g}.${it.clave}: falta nombre`);
      if (!it.resultado) E(`descubrimiento.${g}.${it.clave}: falta resultado`);
      if (it.nivelMinimo != null && ![1, 2, 3].includes(it.nivelMinimo)) E(`descubrimiento.${g}.${it.clave}: nivelMinimo invalido`);
      if (it.fuente != null && (it.fuente < 0 || it.fuente >= nF)) E(`descubrimiento.${g}.${it.clave}: fuente ${it.fuente} fuera de rango`);
      if (it.nivelFuente != null && (it.nivelFuente < 0 || it.nivelFuente >= nF)) E(`descubrimiento.${g}.${it.clave}: nivelFuente ${it.nivelFuente} fuera de rango`);
      if (it.nivelAnclaje && !['COMPLETO', 'PARCIAL'].includes(it.nivelAnclaje)) E(`descubrimiento.${g}.${it.clave}: nivelAnclaje invalido`);
      if (c.tipo === 'medico') {
        if (it.nivelFuente == null) A(`descubrimiento.${g}.${it.clave}: nivelMinimo ${it.nivelMinimo || 1} sin anclar a una norma de caracterizacion (es criterio del autor).`);
        else {
          if (!it.nivelPagina) A(`descubrimiento.${g}.${it.clave}: nivelFuente sin nivelPagina.`);
          if (it.nivelAnclaje !== 'COMPLETO') A(`descubrimiento.${g}.${it.clave}: anclaje de nivel PARCIAL. ${it.nivelNota || ''}`.trim());
        }
      }
    });
  }

  // ---------- conceptos ----------
  const conceptos = new Set();
  (c.rubrica.conceptosClave || []).forEach((k, i) => {
    if (!k.id) return E(`conceptosClave[${i}]: falta id`);
    if (conceptos.has(k.id)) E(`concepto duplicado: ${k.id}`);
    conceptos.add(k.id);
    if (!k.enunciado) E(`conceptosClave.${k.id}: falta enunciado`);
    if (k.fuente == null || k.fuente < 0 || k.fuente >= nF) E(`conceptosClave.${k.id}: fuente fuera de rango`);
    if (c.tipo === 'medico' && !k.pagina) A(`conceptosClave.${k.id}: sin pagina. El tribunal cita este concepto, conviene poder abrir el PDF en el punto exacto.`);
  });
  if (!conceptos.size) E('la rubrica no tiene conceptosClave: sin ellos no hay lista de repaso');

  // ---------- items de rubrica ----------
  const clavesRubrica = {};
  const revisarLista = (nombre, lista, opts = {}) => {
    const set = new Set();
    (lista || []).forEach((it, i) => {
      const ref = `rubrica.${nombre}[${i}]`;
      if (!it.clave) return E(`${ref}: falta clave`);
      if (set.has(it.clave)) E(`${ref}: clave duplicada "${it.clave}"`);
      set.add(it.clave);
      if (!it.texto) E(`${ref}: falta texto`);
      if (!VALORACIONES.includes(it.valoracion)) E(`${ref}: valoracion invalida "${it.valoracion}"`);
      if (it.fuente == null || it.fuente < 0 || it.fuente >= nF) E(`${ref} (${it.clave}): fuente fuera de rango`);
      if (c.tipo === 'medico' && !it.pagina) A(`${ref} (${it.clave}): sin pagina.`);
      if (it.conceptoLigado && !conceptos.has(it.conceptoLigado)) E(`${ref} (${it.clave}): conceptoLigado "${it.conceptoLigado}" no existe`);
      if (it.nivel && it.nivel.some(n => ![1, 2, 3].includes(n))) E(`${ref} (${it.clave}): nivel invalido`);
      if (opts.debeExistirEn && !opts.debeExistirEn.has(it.clave)) {
        E(`${ref} (${it.clave}): la rubrica evalua una clave que no existe en descubrimiento. No se puede pedir lo que el caso no ofrece.`);
      }
    });
    clavesRubrica[nombre] = set;
    return set;
  };

  revisarLista('diagnosticosEsperados', c.rubrica.diagnosticosEsperados);
  revisarLista('diagnosticosDiferenciales', c.rubrica.diagnosticosDiferenciales);
  revisarLista('estudios', c.rubrica.estudios, { debeExistirEn: clavesEstudio });
  revisarLista('conductas', c.rubrica.conductas);
  revisarLista('informacionCritica', c.rubrica.informacionCritica, { debeExistirEn: clavesInfo });

  if (!(c.rubrica.diagnosticosEsperados || []).length) E('rubrica.diagnosticosEsperados vacio');
  if (!(c.rubrica.diagnosticosEsperados || []).some(d => d.valoracion === 'ESPERADO')) {
    E('rubrica.diagnosticosEsperados: ninguno esta marcado ESPERADO');
  }

  // toda clave critica del descubrimiento deberia estar en informacionCritica
  for (const k of criticas) {
    if (!clavesRubrica.informacionCritica.has(k)) {
      A(`descubrimiento.${clavesInfo.get(k)}.${k} esta marcado critico pero no figura en rubrica.informacionCritica: su omision no generara pregunta de tribunal.`);
    }
  }

  // ---------- tribunal ----------
  const idsT = new Set();
  const clavesPorTipo = {
    siPidio: clavesEstudio, siNoPidio: clavesEstudio,
    siDiagnostico: new Set([...clavesRubrica.diagnosticosEsperados, ...clavesRubrica.diagnosticosDiferenciales]),
    siNoDiagnostico: new Set([...clavesRubrica.diagnosticosEsperados, ...clavesRubrica.diagnosticosDiferenciales]),
    siConducta: clavesRubrica.conductas, siNoConducta: clavesRubrica.conductas,
    siOmitioInfo: clavesRubrica.informacionCritica
  };
  let hayIncondicional = false;
  c.tribunal.forEach((q, i) => {
    const ref = `tribunal[${i}]`;
    if (!q.id) E(`${ref}: falta id`);
    else if (idsT.has(q.id)) E(`${ref}: id duplicado "${q.id}"`);
    else idsT.add(q.id);
    if (!q.pregunta) E(`${ref}: falta pregunta`);
    const d = q.disparador || {};
    if (!DISPARADORES.includes(d.tipo)) return E(`${ref}: disparador.tipo invalido "${d.tipo}"`);
    if (d.tipo === 'siempre') { hayIncondicional = true; if (d.clave) A(`${ref}: disparador "siempre" con clave; la clave se ignora.`); }
    else {
      if (!d.clave) return E(`${ref}: disparador "${d.tipo}" necesita clave`);
      const universo = clavesPorTipo[d.tipo];
      const tieneClave = universo instanceof Set ? universo.has(d.clave) : universo.has(d.clave);
      if (!tieneClave) E(`${ref} (${q.id}): disparador "${d.tipo}" apunta a "${d.clave}", que no existe donde corresponde. Esta pregunta nunca se dispararia.`);
    }
    if (q.conceptoLigado && !conceptos.has(q.conceptoLigado)) E(`${ref} (${q.id}): conceptoLigado "${q.conceptoLigado}" no existe`);
    if (q.fuente != null && (q.fuente < 0 || q.fuente >= nF)) E(`${ref} (${q.id}): fuente fuera de rango`);
    if (!Array.isArray(q.loQueSeEsperaOir) || !q.loQueSeEsperaOir.length) {
      A(`${ref} (${q.id}): sin loQueSeEsperaOir. La autoevaluacion queda a ciegas.`);
    }
  });
  if (!hayIncondicional) E('el tribunal no tiene ninguna pregunta con disparador "siempre": puede quedar vacio');

  // toda conducta y todo estudio NO_CONTEMPLADO deberia tener su pregunta
  const conPregunta = new Set(c.tribunal.filter(q => q.disparador && q.disparador.clave).map(q => q.disparador.clave));
  [...(c.rubrica.conductas || []), ...(c.rubrica.estudios || [])]
    .filter(it => it.valoracion === 'NO_CONTEMPLADO_POR_LA_FUENTE')
    .forEach(it => {
      if (!conPregunta.has(it.clave)) A(`"${it.clave}" esta NO_CONTEMPLADO_POR_LA_FUENTE pero no tiene pregunta de tribunal asociada: si se elige, no pasa nada.`);
    });

  (c.estudiosPlausiblesNoIncluidos || []).forEach((e, i) => {
    if (!e.nombre) E(`estudiosPlausiblesNoIncluidos[${i}]: falta nombre`);
    if (!e.preguntaTribunal) E(`estudiosPlausiblesNoIncluidos[${i}]: falta preguntaTribunal`);
    if (e.fuente != null && (e.fuente < 0 || e.fuente >= nF)) E(`estudiosPlausiblesNoIncluidos[${i}]: fuente fuera de rango`);
  });

  // ---------- reglas por estado ----------
  if (c.estado === 'VALIDADO' && c.tipo === 'medico') {
    if (avi.length) E(`estado VALIDADO con ${avi.length} aviso(s) bibliografico(s) pendientes. Un caso VALIDADO no puede tener agujeros de fuente.`);
    if (!c.notaDeAutoria) E('estado VALIDADO sin notaDeAutoria: debe declarar que redacto el autor y que proviene de la fuente.');
  }
  if (c.tipo === 'medico' && !c.notaDeAutoria) A('sin notaDeAutoria.');
  if (c.tipo === 'prueba' && c.area !== 'DEMO') A('tipo "prueba" en un area clinica: conviene area DEMO para que no entre en modo examen.');

  return { err, avi };
}

// ---------- ejecucion ----------
const args = process.argv.slice(2);
let archivos;
if (args.length) archivos = args;
else {
  const dir = join(RAIZ, 'cases');
  archivos = readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'schema.json' && f !== 'index.json').map(f => join(dir, f));
}

let totalErr = 0, totalAvi = 0;
for (const a of archivos) {
  if (!statSync(a).isFile()) continue;
  let caso;
  try { caso = JSON.parse(readFileSync(a, 'utf8')); }
  catch (e) { console.log(`\n${basename(a)}\n  ERROR  JSON invalido: ${e.message}`); totalErr++; continue; }
  const { err, avi } = validarCaso(caso, a);
  const etiqueta = `${basename(a)}  [${caso.estado || '?'}]`;
  if (!err.length && !avi.length) { console.log(`\n${etiqueta}\n  ok`); continue; }
  console.log(`\n${etiqueta}`);
  err.forEach(m => console.log(`  ERROR  ${m}`));
  avi.forEach(m => console.log(`  aviso  ${m}`));
  totalErr += err.length; totalAvi += avi.length;
}

console.log(`\n---\n${archivos.length} caso(s). ${totalErr} error(es), ${totalAvi} aviso(s).`);

// ---------- banco de preguntas (solo si no se pidieron casos sueltos) ----------
if (!args.length) {
  const b = validarBanco(RAIZ);
  console.log(`\nBanco de preguntas`);
  b.err.forEach(m => console.log(`  ERROR  ${m}`));
  b.avi.forEach(m => console.log(`  aviso  ${m}`));
  if (!b.err.length && !b.avi.length) console.log('  ok: todas las citas estan, textuales, en la pagina indicada');
  console.log(`---\n${b.total} pregunta(s). ${b.err.length} error(es), ${b.avi.length} aviso(s).`);
  totalErr += b.err.length;
}
process.exit(totalErr ? 1 : 0);
