#!/usr/bin/env node
/**
 * clave.mjs — genera la clave de respuestas de todos los casos, leida de la rubrica.
 *
 * Uso: node tools/clave.mjs   ->  revision/clave-de-respuestas.md
 *
 * Es material para quien revisa los casos (la segunda persona del area), no para
 * la jugadora: con la clave en la mano el juego deja de entrenar evocacion.
 * Por eso se escribe en revision/ y no en dist/, que es lo que se publica.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const GRUPOS_INFO = ['anamnesis', 'antecedentes', 'examenFisico'];
const GRUPOS_ESTUDIO = ['laboratorio', 'gabinete', 'otrosEstudios'];

const casos = readdirSync(join(RAIZ, 'cases'))
  .filter(f => f.endsWith('.json') && f !== 'schema.json' && f !== 'index.json')
  .map(f => JSON.parse(readFileSync(join(RAIZ, 'cases', f), 'utf8')))
  .filter(c => c.tipo === 'medico');

const esperados = arr => (arr || []).filter(x => x.valoracion === 'ESPERADO');
const escribir = x => `**${x.sinonimos?.[0] || x.clave}**${x.pagina ? ` (p. ${x.pagina})` : ''} — ${x.texto}`;

const out = [];
out.push('# Clave de respuestas', '');
out.push('Generada desde la rubrica de cada caso con `node tools/clave.mjs`. Material para revision: no la publiques junto al juego.', '');
out.push('## Como se saca 100', '');
out.push('1. **Informacion:** declarar y revelar los tres grupos (interrogar, antecedentes, examinar). Cada grupo revela todos sus datos de una vez.');
out.push('2. **Estudios:** pedir todos los ESPERADO que existan en el nivel. Los que no existen en ese nivel no restan.');
out.push('3. **Diagnostico, diferenciales y conducta:** escribir lo de cada lista. Basta con que el texto contenga la palabra en negrita (sin importar tildes ni mayusculas).');
out.push('4. **Tribunal:** decir en voz alta lo que figura en "se espera oir" y marcar "Lo dije completo". Es la unica dimension que depende de la honestidad de la jugadora.');
out.push('5. Lo marcado "Evitar" no baja la nota, pero dispara una pregunta de tribunal que hay que defender.', '');

for (const c of casos) {
  const niveles = c.nivelesDisponibles || [1, 2, 3];
  const estudios = GRUPOS_ESTUDIO.flatMap(g => c.descubrimiento?.[g]?.items || []);
  const nivelDe = clave => estudios.find(e => e.clave === clave)?.nivelMinimo || 1;
  const R = c.rubrica;

  out.push('---', '', `## ${c.id} — ${c.titulo}`, '', `Estado: ${c.estado}. Fuente: ${c.fuentes[0].documento.split('.')[0]}, ${c.fuentes[0].capitulo}.`, '');

  out.push('### Informacion', '', `Revelar: ${GRUPOS_INFO.filter(g => c.descubrimiento[g]).map(g => c.descubrimiento[g].etiqueta || g).join(', ')}.`, '');

  out.push('### Diagnostico', '');
  esperados(R.diagnosticosEsperados).forEach(x => out.push(`- ${escribir(x)}`));
  out.push('', '### Diferenciales', '');
  const dd = esperados(R.diagnosticosDiferenciales);
  if (dd.length) dd.forEach(x => out.push(`- ${escribir(x)}`));
  else out.push('- Ninguno obligatorio. Suman como aceptables: ' + (R.diagnosticosDiferenciales || []).map(x => x.sinonimos?.[0] || x.clave).join(', ') + '.');

  out.push('', '### Estudios', '');
  const est = esperados(R.estudios);
  if (!est.length) out.push('- Ninguno obligatorio.');
  const nombreDe = clave => estudios.find(e => e.clave === clave)?.nombre || clave;
  est.forEach(x => out.push(`- **${nombreDe(x.clave)}**${x.pagina ? ` (p. ${x.pagina})` : ''}, disponible desde nivel ${nivelDe(x.clave)} — ${x.texto}`));

  out.push('', '### Conducta por nivel', '');
  for (const n of niveles) {
    const cx = esperados(R.conductas).filter(x => !x.nivel || x.nivel.includes(n));
    out.push(`**Nivel ${n}:** ` + cx.map(x => `${x.sinonimos?.[0] || x.clave}`).join(' · '));
  }
  out.push('');
  esperados(R.conductas).forEach(x => out.push(`- ${escribir(x)}${x.nivel ? ` [nivel ${x.nivel.join(', ')}]` : ''}`));

  const evitar = [...(R.conductas || []), ...(R.estudios || [])].filter(x => x.valoracion === 'NO_CONTEMPLADO_POR_LA_FUENTE');
  if (evitar.length) {
    out.push('', '### Evitar (no contemplado por la fuente)', '');
    evitar.forEach(x => out.push(`- **${x.sinonimos?.[0] || x.clave}**${x.nivel ? ` [nivel ${x.nivel.join(', ')}]` : ''} — ${x.texto}`));
  }

  out.push('', '### Tribunal', '');
  const cuando = d => ({
    siempre: 'siempre',
    siPidio: `si pidio ${d.clave}`, siNoPidio: `si no pidio ${d.clave}`,
    siDiagnostico: `si planteo ${d.clave}`, siNoDiagnostico: `si no planteo ${d.clave}`,
    siConducta: `si propuso ${d.clave}`, siNoConducta: `si no propuso ${d.clave}`,
    siOmitioInfo: `si no reviso ${d.clave}`
  }[d.tipo] || d.tipo);
  for (const q of c.tribunal) {
    out.push(`**${q.id}** (${cuando(q.disparador)}) — ${q.pregunta}`);
    (q.loQueSeEsperaOir || []).forEach(e => out.push(`  - ${e}`));
    out.push('');
  }
}

mkdirSync(join(RAIZ, 'revision'), { recursive: true });
writeFileSync(join(RAIZ, 'revision', 'clave-de-respuestas.md'), out.join('\n'));
console.log(`revision/clave-de-respuestas.md  ${casos.length} caso(s)`);
