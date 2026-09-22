/** tribunalUI.js — el jefe final. Cambia de registro visual a proposito. */
import { esc, $, li } from './dom.js';

const COMO_FUNCIONA = `
  <p style="margin:.35rem 0 0">Simula la defensa oral del caso: docentes que te preguntan por qué decidiste lo que decidiste. Aquí no hay opciones para elegir, porque en la defensa tampoco las hay.</p>
  <ol class="pasos">
    <li>Lee la pregunta.</li>
    <li>Respóndela <strong>antes</strong> de mirar la respuesta: en voz alta, como frente al tribunal, o escribiéndola en el recuadro.</li>
    <li>Toca "Ya respondí" y compara con lo que se esperaba oír.</li>
    <li>Califícate con honestidad. Nadie más ve esto: sirve para que el juego sepa qué repasar contigo.</li>
  </ol>`;

export function render(cont, { caso, preguntas, indice, revelado, partida, borradorTribunal }, acc) {
  const q = preguntas[indice];
  const respondidas = partida.tribunalRespuestas.length;

  if (!q) {
    const completas = partida.tribunalRespuestas.filter(r => r.autoevaluacion === 'completa').length;
    cont.innerHTML = `<div class="tribunal" style="margin-top:1rem"><span class="jueces" aria-hidden="true">🧑‍⚖️👩‍⚖️</span>
      <span class="cuenta">Tribunal</span>
      <p class="q">Terminaste la defensa. Respondiste ${respondidas} pregunta(s) y dijiste completas ${completas}.</p></div>
      <button class="btn pri ancho" id="ver">Ver evaluación</button>`;
    $('#ver', cont).addEventListener('click', () => acc.terminarTribunal());
    return;
  }

  const origen = { nucleo: 'Pregunta del caso', decision: 'Por una decisión que tomaste', no_contemplado: 'Por un estudio que el caso no contempla' }[q.origen] || '';

  cont.innerHTML = `
  ${indice === 0
    ? `<div class="panel explica" style="margin-top:1rem"><h3>¿Qué es el tribunal?</h3>${COMO_FUNCIONA}</div>`
    : `<details style="border:0;padding:.8rem 0 .2rem"><summary>¿Cómo funciona el tribunal?</summary><div class="cuerpo">${COMO_FUNCIONA}</div></details>`}

  <div class="tribunal">
    <span class="jueces" aria-hidden="true">🧑‍⚖️👩‍⚖️</span>
    <span class="cuenta">${indice + 1} de ${preguntas.length} · ${esc(origen)}</span>
    <p class="q">${esc(q.pregunta)}</p>
  </div>

  <div class="panel">
    ${!revelado ? `
      <label class="campo" for="resp">Tu respuesta (opcional: también puedes decirla en voz alta)</label>
      <textarea id="resp" placeholder="Escribe aquí lo que le responderías al tribunal...">${esc(borradorTribunal || '')}</textarea>
      <button class="btn pri ancho" id="revelar" style="margin-top:.7rem">Ya respondí: ver lo que se esperaba</button>` : `
      ${borradorTribunal ? `<h3>Lo que respondiste</h3><div class="tu-respuesta" style="margin:.5rem 0 .9rem">${esc(borradorTribunal)}</div>` : ''}
      ${q.esperado.length ? `<h3>Lo que se esperaba oír</h3><ul class="esperado">${li(q.esperado)}</ul>` : `<p class="sutil">Esta pregunta no tiene respuesta modelo cargada. Evalúate por si pudiste sostener tu decisión.</p>`}
      ${q.nota ? `<p class="nota" style="margin-top:.6rem">${esc(q.nota)}</p>` : ''}
      <hr class="hr">
      <p class="sutil" style="margin-bottom:.6rem">Con honestidad: ¿cuánto de eso dijiste?</p>
      <div class="autoeval">
        <button class="btn" data-ev="completa">Lo dije completo</button>
        <button class="btn" data-ev="parcial">A medias</button>
        <button class="btn" data-ev="no_supe">No supe</button>
      </div>`}
  </div>

  ${q.fuente != null && caso.fuentes[q.fuente] ? `<p class="nota" style="text-align:center">Fuente: ${esc(caso.fuentes[q.fuente].documento)}${caso.fuentes[q.fuente].pagina ? `, pp. ${esc(caso.fuentes[q.fuente].pagina)}` : ''}</p>` : ''}`;

  $('#resp', cont)?.addEventListener('input', e => acc.borradorTribunal(e.target.value));
  $('#revelar', cont)?.addEventListener('click', () => acc.verEsperado());
  cont.querySelectorAll('[data-ev]').forEach(b => b.addEventListener('click', () => acc.responder(q, b.dataset.ev)));
}
