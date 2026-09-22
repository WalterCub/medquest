/**
 * banco.mjs — validacion del banco de preguntas.
 *
 * DECISION ARQUITECTONICA
 * Una pregunta de opcion multiple se puede escribir mal de dos formas: con una
 * respuesta que la norma no dice, o citando una pagina que no es. Lo segundo se
 * puede comprobar a maquina: cada pregunta lleva una cita textual y el validador
 * la busca, normalizada, en el texto de esa pagina del PDF oficial. Si no esta,
 * es error. Lo primero (que la cita respalde de verdad la opcion correcta) sigue
 * siendo trabajo de la revisora, pero ahora solo tiene que leer una frase.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const AREAS = ['MI', 'CX', 'GO', 'PED', 'SP'];
const ESTADOS = ['BORRADOR', 'VERIFICADA'];
const MIN_CITA = 30;

/** Minusculas, sin tildes, sin guiones de corte de linea, solo letras y numeros separados por un espacio. */
export function normalizarTexto(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/-\s*\n\s*/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function cargarPaginas(raiz, fuente) {
  const ruta = join(raiz, fuente.texto);
  if (!existsSync(ruta)) return null;
  return readFileSync(ruta, 'utf8').split('\f').map(normalizarTexto);
}

export function validarBanco(raiz) {
  const catalogo = JSON.parse(readFileSync(join(raiz, 'preguntas/fuentes.json'), 'utf8'));
  const banco = JSON.parse(readFileSync(join(raiz, 'preguntas/banco.json'), 'utf8'));
  const paginas = {};
  const err = [], avi = [];
  const ids = new Set();

  for (const [id, f] of Object.entries(catalogo)) {
    paginas[id] = cargarPaginas(raiz, f);
    if (!paginas[id]) avi.push(`fuente ${id}: no esta ${f.texto}. Corre node tools/extraer-texto.mjs; sin eso las citas no se verifican.`);
  }

  for (const q of banco.preguntas || []) {
    const ref = q.id || '(sin id)';
    const E = m => err.push(`${ref}: ${m}`);
    if (!q.id) E('falta id');
    else if (ids.has(q.id)) E('id duplicado');
    ids.add(q.id);
    if (!AREAS.includes(q.area)) E(`area invalida "${q.area}"`);
    if (!q.tema) E('falta tema');
    if (!q.enunciado || q.enunciado.length < 15) E('enunciado vacio o muy corto');
    if (!Array.isArray(q.opciones) || q.opciones.length < 3 || q.opciones.length > 5) E('debe tener entre 3 y 5 opciones');
    else {
      if (new Set(q.opciones.map(normalizarTexto)).size !== q.opciones.length) E('hay opciones repetidas');
      if (!Number.isInteger(q.correcta) || q.correcta < 0 || q.correcta >= q.opciones.length) E('correcta fuera de rango');
    }
    if (!q.explicacion) E('falta explicacion');
    if (!ESTADOS.includes(q.estado)) E(`estado invalido "${q.estado}"`);

    const f = q.fuente || {};
    if (!catalogo[f.id]) { E(`fuente "${f.id}" no existe en preguntas/fuentes.json`); continue; }
    if (!Number.isInteger(f.pagina)) { E('fuente.pagina debe ser un numero de pagina impresa'); continue; }
    const cita = normalizarTexto(f.cita);
    if (cita.length < MIN_CITA) { E(`la cita es muy corta (${cita.length} caracteres; minimo ${MIN_CITA}): no demuestra nada`); continue; }

    const pags = paginas[f.id];
    if (!pags) continue;
    const i = f.pagina + catalogo[f.id].desfase - 1;          // indice de la pagina del PDF
    if (pags[i]?.includes(cita)) continue;
    // una frase puede cruzar el salto de pagina
    if ((pags[i] + ' ' + (pags[i + 1] || '')).includes(cita)) continue;
    const vecina = [i - 1, i + 1].find(k => pags[k]?.includes(cita));
    if (vecina != null) E(`la cita esta en la p. ${vecina - catalogo[f.id].desfase + 1}, no en la p. ${f.pagina}`);
    else {
      const donde = pags.findIndex(p => p.includes(cita));
      E(donde >= 0
        ? `la cita esta en la p. ${donde - catalogo[f.id].desfase + 1}, no en la p. ${f.pagina}`
        : `la cita NO aparece en ${catalogo[f.id].corto}. Debe ser textual.`);
    }
  }
  return { err, avi, total: (banco.preguntas || []).length };
}
