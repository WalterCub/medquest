#!/usr/bin/env node
/**
 * extraer-texto.mjs — pasa a texto los PDFs del catalogo preguntas/fuentes.json.
 *
 * Uso: node tools/extraer-texto.mjs   ->  fuentes/texto/<id>.txt
 *
 * El validador del banco compara cada cita contra este texto, pagina por pagina
 * (las paginas quedan separadas por un salto de pagina, \f). Se guarda el texto
 * en vez de leer el PDF cada vez porque Node no lee PDF sin dependencias.
 *
 * Necesita pdftotext (poppler). Viene con Git para Windows; en Linux o Mac se
 * instala con el paquete poppler-utils / poppler.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalogo = JSON.parse(readFileSync(join(RAIZ, 'preguntas/fuentes.json'), 'utf8'));

const CANDIDATOS = ['pdftotext', 'C:\\Program Files\\Git\\mingw64\\bin\\pdftotext.exe'];
const binario = CANDIDATOS.find(b => {
  // pdftotext -v sale con codigo distinto de cero aunque funcione: solo importa que exista
  try { execFileSync(b, ['-v'], { stdio: 'ignore' }); return true; } catch (e) { return e.code !== 'ENOENT'; }
});
if (!binario) {
  console.error('No encuentro pdftotext. Instala poppler (viene con Git para Windows).');
  process.exit(1);
}

mkdirSync(join(RAIZ, 'fuentes/texto'), { recursive: true });
for (const [id, f] of Object.entries(catalogo)) {
  const pdf = join(RAIZ, f.pdf);
  if (!existsSync(pdf)) { console.log(`  falta  ${id}: ${f.pdf}`); continue; }
  // sin -layout: conserva el orden de lectura, asi una frase no se parte entre columnas
  execFileSync(binario, ['-enc', 'UTF-8', pdf, join(RAIZ, f.texto)]);
  console.log(`  ok     ${id} -> ${f.texto}`);
}
