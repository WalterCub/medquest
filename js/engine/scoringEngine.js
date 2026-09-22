/**
 * scoringEngine.js — evaluacion trazable a rubrica y fuente.
 *
 * DECISIONES ARQUITECTONICAS
 *
 * 1. Nada se marca "incorrecto" por no estar en la base. Una accion que el caso
 *    no contempla se reporta como NO_EVALUABLE y no resta. Lo unico que baja el
 *    puntaje es no haber hecho lo que la fuente marca como ESPERADO.
 *
 * 2. Cinco dimensiones, no nueve. Una pantalla de resultados con nueve barras
 *    no se lee. El detalle sigue disponible por item.
 *
 * 3. Todo hallazgo lleva el indice de fuente y la pagina que venian en la
 *    rubrica, para que la pantalla de resultados pueda mostrar de donde sale.
 */

import { normalizar } from './caseEngine.js';

/** Un texto libre coincide con un item de rubrica si contiene alguno de sus sinonimos. */
export function coincide(textoLibre, item) {
  const t = normalizar(textoLibre);
  if (!t) return false;
  const candidatos = [item.clave, ...(item.sinonimos || [])].map(normalizar).filter(Boolean);
  return candidatos.some(c => c.length >= 3 && (t.includes(c) || c.includes(t)));
}

function evaluarLista(propuestas, itemsRubrica) {
  const items = itemsRubrica || [];
  const acertados = [];
  const faltantes = [];
  const usados = new Set();

  for (const item of items) {
    const hit = propuestas.find(p => coincide(p, item));
    if (hit) { acertados.push({ ...item, dicho: hit }); usados.add(hit); }
    else faltantes.push(item);
  }
  const noEvaluables = propuestas.filter(p => !usados.has(p));
  return { acertados, faltantes, noEvaluables };
}

const soloEsperados = (arr) => arr.filter(x => x.valoracion === 'ESPERADO');

function razon(acertados, universo) {
  const total = universo.length;
  if (!total) return { pct: 100, n: 0, total: 0 };
  const n = acertados.filter(a => a.valoracion === 'ESPERADO').length;
  return { pct: Math.round(n / total * 100), n, total };
}

export function evaluar(caso, p) {
  const R = caso.rubrica;
  const nivel = p.nivel;

  // --- 1. Informacion obtenida ---
  const criticas = R.informacionCritica || [];
  const vistas = new Set(p.infoDescubierta);
  const infoAcertada = criticas.filter(i => vistas.has(i.clave));
  const infoFaltante = criticas.filter(i => !vistas.has(i.clave));
  const dInfo = razon(infoAcertada, soloEsperados(criticas));

  // --- 2. Diagnostico ---
  const dx = evaluarLista(p.diagnosticos, R.diagnosticosEsperados);
  const dDx = razon(dx.acertados, soloEsperados(R.diagnosticosEsperados));

  // --- 3. Diferenciales ---
  const dd = evaluarLista(p.diferenciales, R.diagnosticosDiferenciales);
  const dDd = razon(dd.acertados, soloEsperados(R.diagnosticosDiferenciales));

  // --- 4. Estudios (solo los que existen en el nivel en que se jugo) ---
  const pedidos = p.estudiosSolicitados.filter(e => e.origen === 'caso').map(e => e.clave);
  const nivelMinimo = new Map();
  for (const g of ['laboratorio', 'gabinete', 'otrosEstudios']) {
    for (const it of caso.descubrimiento?.[g]?.items || []) nivelMinimo.set(it.clave, it.nivelMinimo || 1);
  }
  const estudiosRub = (R.estudios || []).filter(e => (nivelMinimo.get(e.clave) || 1) <= nivel);
  const estAcertados = estudiosRub.filter(e => pedidos.includes(e.clave));
  const estFaltantes = estudiosRub.filter(e => !pedidos.includes(e.clave) && e.valoracion === 'ESPERADO');
  const estNoContemplados = estAcertados.filter(e => e.valoracion === 'NO_CONTEMPLADO_POR_LA_FUENTE');
  const dEst = razon(estAcertados, soloEsperados(estudiosRub));

  // --- 5. Conducta (filtrada por el nivel en que se jugo) ---
  const conductasNivel = (R.conductas || []).filter(c => !c.nivel || c.nivel.includes(nivel));
  const cx = evaluarLista(p.conductas, conductasNivel);
  const cxNoContempladas = cx.acertados.filter(c => c.valoracion === 'NO_CONTEMPLADO_POR_LA_FUENTE');
  const dCx = razon(cx.acertados, soloEsperados(conductasNivel));

  // --- 6. Tribunal ---
  const PESO = { completa: 1, parcial: 0.5, no_supe: 0 };
  const rt = p.tribunalRespuestas;
  const sumaT = rt.reduce((s, r) => s + (PESO[r.autoevaluacion] ?? 0), 0);
  const dTri = { pct: rt.length ? Math.round(sumaT / rt.length * 100) : 0, n: Math.round(sumaT * 10) / 10, total: rt.length };

  const dimensiones = [
    { id: 'info',   etiqueta: 'Informacion obtenida', ...dInfo },
    { id: 'dx',     etiqueta: 'Diagnostico',          ...dDx },
    { id: 'dd',     etiqueta: 'Diferenciales',        ...dDd },
    { id: 'est',    etiqueta: 'Estudios',             ...dEst },
    { id: 'cx',     etiqueta: 'Conducta',             ...dCx },
    { id: 'tri',    etiqueta: 'Tribunal',             ...dTri }
  ];
  const global = Math.round(dimensiones.reduce((s, d) => s + d.pct, 0) / dimensiones.length);

  // --- conceptos para repasar ---
  const mapa = new Map();
  const sumar = (id, motivo) => {
    if (!id) return;
    const k = (R.conceptosClave || []).find(c => c.id === id);
    if (!k) return;
    if (!mapa.has(id)) mapa.set(id, { ...k, motivos: [] });
    mapa.get(id).motivos.push(motivo);
  };
  infoFaltante.forEach(i => sumar(i.conceptoLigado, `No buscaste: ${i.texto}`));
  dx.faltantes.filter(x => x.valoracion === 'ESPERADO').forEach(i => sumar(i.conceptoLigado, `Diagnostico no planteado: ${i.texto}`));
  dd.faltantes.filter(x => x.valoracion === 'ESPERADO').forEach(i => sumar(i.conceptoLigado, `Diferencial no considerado: ${i.texto}`));
  estFaltantes.forEach(i => sumar(i.conceptoLigado, `Estudio no solicitado: ${i.texto}`));
  cx.faltantes.filter(x => x.valoracion === 'ESPERADO').forEach(i => sumar(i.conceptoLigado, `Conducta no propuesta: ${i.texto}`));
  rt.filter(r => r.autoevaluacion !== 'completa').forEach(r => sumar(r.conceptoLigado, `En el tribunal: ${r.pregunta}`));

  const conceptosRepaso = [...mapa.values()];
  const dominados = (R.conceptosClave || []).filter(k => !mapa.has(k.id));

  return {
    casoId: caso.id, area: caso.area, nivel, global, dimensiones,
    tiempoSeg: p.tiempoCasoSeg,
    detalle: {
      info: { acertados: infoAcertada, faltantes: infoFaltante },
      dx, dd,
      estudios: { acertados: estAcertados, faltantes: estFaltantes, noContemplados: estNoContemplados, sinResultado: p.estudiosSinResultado },
      conductas: { ...cx, noContempladas: cxNoContempladas }
    },
    conceptosRepaso, dominados,
    fuentes: caso.fuentes
  };
}
