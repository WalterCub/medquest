#!/usr/bin/env node
/**
 * build.mjs — empaqueta MedQuest en un solo HTML autocontenido.
 *
 * Por que existe: los ES Modules no cargan desde file://, asi que abrir
 * index.html con doble clic no funciona. Para desarrollar se sirve la carpeta
 * por http; para mandarlo como un solo archivo se genera este.
 *
 * Inlinea css, los modulos js (resolviendo el orden de importacion) y los
 * casos JSON en window.MEDQUEST_CASOS.
 *
 * Uso: node tools/build.mjs   ->  dist/medquest.html
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = p => readFileSync(join(RAIZ, p), 'utf8');

// orden topologico a mano: es corto y explicito, mejor que un resolvedor generico
const ORDEN = [
  'js/services/storage.js',
  'js/services/caseRepository.js',
  'js/services/bancoRepository.js',
  'js/services/sync.js',
  'js/engine/caseEngine.js',
  'js/engine/scoringEngine.js',
  'js/engine/tribunalEngine.js',
  'js/engine/learningEngine.js',
  'js/engine/rewardEngine.js',
  'js/engine/quizEngine.js',
  'js/engine/avatarEngine.js',
  'js/ui/dom.js',
  'js/ui/reporteUI.js',
  'js/ui/avatarUI.js',
  'js/ui/quizUI.js',
  'js/ui/screens.js',
  'js/ui/caseUI.js',
  'js/ui/tribunalUI.js',
  'js/ui/resultsUI.js',
  'js/app.js'
];

// Quita import/export y renombra los namespaces que app.js usa con alias.
function aplanar(src, ruta) {
  let s = src
    .replace(/^\s*import\s[\s\S]*?from\s*['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, '')
    .replace(/^\s*export\s+(const|let|function|async function|class)\s/gm, '$1 ');
  return `\n/* ===== ${ruta} ===== */\n${s}`;
}

// banco: solo lo que la app necesita (las rutas locales de los PDF no se publican)
const catalogo = JSON.parse(leer('preguntas/fuentes.json'));
const bancoPublico = {
  preguntas: JSON.parse(leer('preguntas/banco.json')).preguntas,
  fuentes: Object.fromEntries(Object.entries(catalogo).map(([k, f]) => [k, { corto: f.corto, documento: f.documento, anio: f.anio, url: f.url }]))
};

const casos = readdirSync(join(RAIZ, 'cases'))
  .filter(f => f.endsWith('.json') && f !== 'schema.json' && f !== 'index.json')
  .map(f => JSON.parse(leer(join('cases', f))));

// namespaces que app.js usa: CE.*, TE.*, RE.*, Screens.*, CaseUI.*, TribunalUI.*, ResultsUI.*
const NS = `
const CE = { crearPartida, declarar, puedeRevelar, revelar, estudiosDisponibles, solicitarEstudio, solicitarEstudioLibre, proponer, quitar, cerrarCaso, normalizar, GRUPOS_INFO, GRUPOS_ESTUDIO };
const TE = { construirInterrogatorio, responder, PESO_AUTOEVAL };
const RE = { GANANCIAS, PREMIOS, nivel, racha, recompensar, recompensarRonda, misionesDeHoy, avanzarMisiones, misionesCompletas, RECOMPENSA_MISIONES };
const AV = { equipar, equiparSet, revisarLogros, avatarInicial };
const QZ = { crearRonda, responderPregunta, siguientePregunta, resumenRonda, preguntaActual, estadisticasBanco, pesoPregunta, PREGUNTAS_POR_RONDA };
const QuizUI = { render: renderPreguntas };
const Cuenta = { iniciarCuenta, haySesionGuardada, enviarCodigo, verificarCodigo, cerrarSesion, sincronizar, subirLuego, enviarReportes, estadoCuenta };
const Screens = { renderInicio, renderPerfil, renderTienda };
const CaseUI = { render: renderCaso };
const TribunalUI = { render: renderTribunal };
const ResultsUI = { render: renderResultados };
`;

let js = ORDEN.map(r => {
  let s = leer(r);
  // los modulos de UI exportan "render": se renombran para no colisionar
  if (r.endsWith('caseUI.js')) s = s.replace(/\bfunction render\b/, 'function renderCaso');
  if (r.endsWith('tribunalUI.js')) s = s.replace(/\bfunction render\b/, 'function renderTribunal');
  if (r.endsWith('resultsUI.js')) s = s.replace(/\bfunction render\b/, 'function renderResultados');
  if (r.endsWith('quizUI.js')) s = s.replace(/\bfunction render\b/, 'function renderPreguntas');
  if (r.endsWith('app.js')) s = NS + s;
  return aplanar(s, r);
}).join('\n');

// Ojo: replace con reemplazo de tipo string interpreta $$, $&, $1... Aqui el
// codigo inlineado contiene $$ (dom.js), asi que el reemplazo va como funcion.
// Al aplanar, todos los modulos comparten un unico ambito. Si dos declaran el
// mismo identificador de nivel superior, el bundle se rompe en silencio.
// Esto lo convierte en un error de build.
const declaraciones = {};
js.split('\n').forEach((linea, i) => {
  const m = linea.match(/^(?:const|let|var|function|async function|class)\s+([A-Za-z_$][\w$]*)/);
  if (m) (declaraciones[m[1]] ||= []).push(i + 1);
});
const colisiones = Object.entries(declaraciones).filter(([, v]) => v.length > 1);
if (colisiones.length) {
  console.error('Identificadores declarados dos veces al aplanar:');
  colisiones.forEach(([k, v]) => console.error(`  ${k}  (lineas ${v.join(', ')})`));
  process.exit(1);
}

const html = leer('index.html')
  .replace('<link rel="stylesheet" href="css/game.css">', () => `<style>\n${leer('css/game.css')}\n</style>`)
  .replace('<script type="module" src="js/app.js"></script>', () =>
    `<script>window.MEDQUEST_CASOS = ${JSON.stringify(casos)};
window.MEDQUEST_BANCO = ${JSON.stringify(bancoPublico)};</script>\n<script type="module">\n${js}\n</script>`);

mkdirSync(join(RAIZ, 'dist'), { recursive: true });
writeFileSync(join(RAIZ, 'dist/medquest.html'), html);
console.log(`dist/medquest.html  ${(html.length / 1024).toFixed(0)} KB  ·  ${casos.length} caso(s)  ·  ${bancoPublico.preguntas.length} pregunta(s)`);
