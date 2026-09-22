/**
 * caseEngine.js — el estado de una partida y las acciones que lo modifican.
 *
 * DECISIONES ARQUITECTONICAS
 *
 * 1. NO SIMULA CONSECUENCIAS. No existe aqui ninguna funcion que produzca una
 *    evolucion del paciente. El motor solo revela lo que el caso ya contiene.
 *    Si un dato no esta en el JSON, la respuesta es "no hay resultado", nunca
 *    un resultado inventado. Esta restriccion es estructural, no una convencion:
 *    el motor no tiene acceso a nada con lo que pudiera inventar.
 *
 * 2. DECLARAR ANTES DE REVELAR. Unica desviacion respecto del documento de
 *    especificacion, y esta anotada en el README. El documento decia que al
 *    pulsar "Interrogar" aparecen los antecedentes. Eso entrena reconocimiento
 *    (elegir de un menu) cuando el examen evalua evocacion (generar las
 *    preguntas). Aqui la jugadora escribe primero que iba a preguntar o buscar,
 *    su texto queda en el DecisionLog, y recien entonces se revela el grupo.
 *    Los estudios si son menu, porque pedir un estudio de una lista sí es lo
 *    que se hace en la realidad.
 *
 * 3. El DecisionLog es append-only y es la fuente de verdad de lo que hizo la
 *    jugadora. El tribunal y la evaluacion no leen la UI: leen el log.
 */

export const GRUPOS_INFO = ['anamnesis', 'antecedentes', 'examenFisico'];
export const GRUPOS_ESTUDIO = ['laboratorio', 'gabinete', 'otrosEstudios'];

export function crearPartida(caso, nivel = 1) {
  return {
    casoId: caso.id,
    nivel,
    inicio: Date.now(),
    finCaso: null,
    tiempoCasoSeg: 0,
    declaraciones: {},          // grupo -> texto que escribio antes de revelar
    revelados: [],              // grupos revelados
    infoDescubierta: [],        // claves de items de info efectivamente vistos
    estudiosSolicitados: [],    // { clave, nombre, resultado, origen }
    estudiosSinResultado: [],   // { nombre, preguntaTribunal? }
    diagnosticos: [],
    diferenciales: [],
    conductas: [],
    decisionLog: [],
    tribunalRespuestas: [],     // { id, pregunta, autoevaluacion, conceptoLigado }
    cerrado: false,
    resultado: null
  };
}

function registrar(p, tipo, accion, extra = {}) {
  p.decisionLog.push({
    momento: Math.round((Date.now() - p.inicio) / 1000),
    tipo, accion, ...extra
  });
}

/** Guarda lo que la jugadora dice que va a buscar. Sin esto no se revela nada. */
export function declarar(p, grupo, texto) {
  p.declaraciones[grupo] = (texto || '').trim();
  registrar(p, 'declaracion', grupo, { texto: p.declaraciones[grupo] });
  return true;
}

export function puedeRevelar(caso, p, grupo) {
  const g = caso.descubrimiento?.[grupo];
  if (!g) return false;
  if (g.exigeDeclaracionPrevia === false) return true;
  return (p.declaraciones[grupo] || '').length >= 10;
}

/** Revela un grupo de informacion. Devuelve solo lo que el caso ya contenia. */
export function revelar(caso, p, grupo) {
  const g = caso.descubrimiento?.[grupo];
  if (!g) return { ok: false, motivo: 'Este caso no contiene ese grupo de informacion.' };
  if (!puedeRevelar(caso, p, grupo)) {
    return { ok: false, motivo: 'Primero escribe que ibas a buscar en este grupo.' };
  }
  if (!p.revelados.includes(grupo)) {
    p.revelados.push(grupo);
    g.items.forEach(it => { if (!p.infoDescubierta.includes(it.clave)) p.infoDescubierta.push(it.clave); });
    registrar(p, 'informacion', grupo, { items: g.items.length });
  }
  return { ok: true, items: g.items };
}

/** Estudios disponibles para el nivel de atencion en que se juega. */
export function estudiosDisponibles(caso, nivel) {
  const out = [];
  for (const g of GRUPOS_ESTUDIO) {
    const grupo = caso.descubrimiento?.[g];
    if (!grupo) continue;
    for (const it of grupo.items || []) {
      out.push({
        ...it,
        grupo: g,
        etiquetaGrupo: grupo.etiqueta || g,
        bloqueadoPorNivel: (it.nivelMinimo || 1) > nivel
      });
    }
  }
  return out;
}

/**
 * Solicita un estudio. Tres desenlaces posibles, ninguno inventa nada:
 *  - existe y el nivel lo permite: devuelve el resultado guardado en el caso
 *  - existe pero el nivel no lo permite: lo dice, y queda registrado
 *  - no existe en el caso: "no evaluable con la fuente disponible"
 */
export function solicitarEstudio(caso, p, clave) {
  const todos = estudiosDisponibles(caso, p.nivel);
  const e = todos.find(x => x.clave === clave);
  if (!e) return { ok: false, motivo: 'No existe ese estudio en este caso.' };

  if (p.estudiosSolicitados.some(x => x.clave === clave)) {
    return { ok: true, repetido: true, resultado: p.estudiosSolicitados.find(x => x.clave === clave).resultado };
  }
  registrar(p, 'estudio', e.nombre, { clave, nivel: p.nivel });

  if (e.bloqueadoPorNivel) {
    const r = `No disponible en nivel ${p.nivel}. Este estudio requiere nivel ${e.nivelMinimo} o superior.`
      + (e.nivelNota ? ` ${e.nivelNota}` : '');
    p.estudiosSolicitados.push({ clave, nombre: e.nombre, resultado: r, origen: 'bloqueado' });
    return { ok: true, bloqueado: true, resultado: r };
  }
  p.estudiosSolicitados.push({ clave, nombre: e.nombre, resultado: e.resultado, origen: 'caso' });
  return { ok: true, resultado: e.resultado };
}

/** Estudio plausible que el caso no contempla: no es error, genera pregunta. */
export function solicitarEstudioLibre(caso, p, nombre) {
  const n = (nombre || '').trim();
  if (!n) return { ok: false };
  const previsto = (caso.estudiosPlausiblesNoIncluidos || [])
    .find(x => normalizar(x.nombre).includes(normalizar(n)) || normalizar(n).includes(normalizar(x.nombre)));
  registrar(p, 'estudio_libre', n);
  p.estudiosSinResultado.push({
    nombre: n,
    preguntaTribunal: previsto?.preguntaTribunal || null,
    comentarioFuente: previsto?.comentarioFuente || null
  });
  return {
    ok: true,
    resultado: 'No existen resultados disponibles para este estudio en este caso.',
    nota: previsto?.comentarioFuente || 'Queda registrada tu decision. No se evalua como error.'
  };
}

export function proponer(p, campo, texto) {
  const t = (texto || '').trim();
  if (!t) return false;
  const lista = p[campo];
  if (lista.includes(t)) return false;
  lista.push(t);
  registrar(p, campo === 'diagnosticos' ? 'diagnostico' : campo === 'diferenciales' ? 'diferencial' : 'tratamiento', t);
  return true;
}

export function quitar(p, campo, texto) {
  p[campo] = p[campo].filter(x => x !== texto);
}

export function cerrarCaso(p) {
  if (p.cerrado) return p;
  p.cerrado = true;
  p.finCaso = Date.now();
  p.tiempoCasoSeg = Math.round((p.finCaso - p.inicio) / 1000);
  registrar(p, 'cierre', 'Caso cerrado. Decisiones bloqueadas.');
  return p;
}

export function normalizar(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
