#!/usr/bin/env node
/**
 * publicar.mjs — valida, prueba y publica en la rama gh-pages desde esta PC.
 *
 * Uso: node tools/publicar.mjs
 *
 * Hace lo mismo que .github/workflows/pages.yml, pero localmente. Existe como
 * respaldo para cuando GitHub Actions no esta disponible en la cuenta: si la
 * validacion o el smoke test fallan, no publica nada.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const correr = (cmd, args, cwd = RAIZ) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });
const leer = (cmd, args, cwd = RAIZ) => execFileSync(cmd, args, { cwd, encoding: 'utf8' }).trim();

for (const t of ['validate.mjs', 'smoke.mjs', 'build.mjs']) {
  console.log(`\n== ${t}`);
  correr(process.execPath, [join('tools', t)]);          // si falla, execFileSync lanza y no se publica
}

const remoto = leer('git', ['remote', 'get-url', 'origin']);
const commit = leer('git', ['rev-parse', '--short', 'HEAD']);
const sucio = leer('git', ['status', '--porcelain']);
if (sucio) console.log('\naviso: hay cambios sin commit; se publica lo que esta en la carpeta, no solo lo commiteado.');

const sitio = join(tmpdir(), 'medquest-site');
rmSync(sitio, { recursive: true, force: true });
mkdirSync(sitio, { recursive: true });
for (const f of ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'cases', 'preguntas', 'icons']) {
  cpSync(join(RAIZ, f), join(sitio, f), { recursive: true });
}
cpSync(join(RAIZ, 'dist', 'medquest.html'), join(sitio, 'medquest.html'));
writeFileSync(join(sitio, '.nojekyll'), '');

console.log('\n== publicando en gh-pages');
correr('git', ['init', '-q', '-b', 'gh-pages'], sitio);
correr('git', ['config', 'user.name', leer('git', ['config', 'user.name'])], sitio);
correr('git', ['config', 'user.email', leer('git', ['config', 'user.email'])], sitio);
correr('git', ['add', '-A'], sitio);
correr('git', ['commit', '-q', '-m', `Publicar ${commit}`], sitio);
correr('git', ['push', '-q', '-f', remoto, 'gh-pages'], sitio);
rmSync(sitio, { recursive: true, force: true });
console.log(`\nPublicado ${commit}. GitHub Pages tarda uno o dos minutos en actualizar.`);
