/** caseUI.js — pantalla de partida. Solo dibuja; toda la logica esta en caseEngine. */
import { esc, $, $$, on } from './dom.js';
import { AREAS } from '../services/caseRepository.js';
import { estudiosDisponibles, puedeRevelar, GRUPOS_INFO } from '../engine/caseEngine.js';
import { bloqueReporte, conectarReporte } from './reporteUI.js';

const ET = { anamnesis: 'Interrogar', antecedentes: 'Antecedentes', examenFisico: 'Examen fisico' };
const PISTA = {
  anamnesis: 'Escribe que le vas a preguntar. No "hago anamnesis": las preguntas concretas.',
  antecedentes: 'Que antecedentes vas a buscar en este paciente y por que.',
  examenFisico: 'Que vas a examinar y que signos estas buscando.'
};

export function render(cont, { caso, partida, perfil }, acc) {
  const A = AREAS[caso.area];
  const est = estudiosDisponibles(caso, partida.nivel);
  const porGrupo = {};
  est.forEach(e => { (porGrupo[e.etiquetaGrupo] ||= []).push(e); });

  cont.innerHTML = `
  <div class="panel zona ${A.color}">
    <div class="fila" style="align-items:center">
      <span class="pill ${A.color}">${esc(A.nombre)}</span>
      <span class="pill gris">Nivel ${partida.nivel}</span>
      ${caso.estado !== 'VALIDADO' ? `<span class="pill gris">${esc(caso.estado.replace(/_/g, ' ').toLowerCase())}</span>` : ''}
    </div>
    <h2 style="margin:.6rem 0 .5rem">${esc(caso.titulo)}</h2>
    <p class="clinico" style="margin:0">${esc(caso.presentacionInicial.texto)}</p>
    ${caso.presentacionInicial.signosVitales ? `<table class="sv">${
      Object.entries(caso.presentacionInicial.signosVitales).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')
    }</table>` : ''}
  </div>

  ${GRUPOS_INFO.filter(g => caso.descubrimiento?.[g]).map(g => {
    const grupo = caso.descubrimiento[g];
    const abierto = partida.revelados.includes(g);
    return `
    <div class="panel">
      <h3>${esc(grupo.etiqueta || ET[g])}</h3>
      ${abierto ? `
        <p class="nota" style="margin:.35rem 0 0">Lo que declaraste: ${esc(partida.declaraciones[g] || '')}</p>
        <ul class="hallazgos">${grupo.items.map(it => `<li>${esc(it.texto)}</li>`).join('')}</ul>
      ` : `
        <p class="nota" style="margin:.35rem 0 .55rem">${esc(PISTA[g] || '')}</p>
        <textarea data-decl="${g}" placeholder="...">${esc(partida.declaraciones[g] || '')}</textarea>
        <div class="fila" style="margin-top:.5rem">
          <button class="btn pri" data-revelar="${g}" ${puedeRevelar(caso, partida, g) ? '' : 'disabled'}>Revelar ${esc((ET[g] || g).toLowerCase())}</button>
        </div>
      `}
    </div>`;
  }).join('')}

  <div class="panel">
    <h3>Estudios</h3>
    <p class="nota" style="margin:.35rem 0 .6rem">Solo aparecen resultados que este caso contiene. Lo que pidas queda registrado aunque no haya resultado.</p>
    ${Object.entries(porGrupo).map(([et, items]) => `
      <p class="sutil" style="margin:.7rem 0 .35rem">${esc(et)}</p>
      ${items.map(e => {
        const ped = partida.estudiosSolicitados.find(x => x.clave === e.clave);
        return `
        <button class="estudio ${ped ? 'pedido' : ''}" data-est="${esc(e.clave)}" ${ped ? 'disabled' : ''}>
          <span class="nm">${esc(e.nombre)}</span>
          ${e.bloqueadoPorNivel ? `<span class="lv">nivel ${e.nivelMinimo}</span>` : ''}
        </button>
        ${ped ? `<p class="resultado ${ped.origen === 'bloqueado' ? 'vacio' : ''}">${esc(ped.resultado)}</p>` : ''}`;
      }).join('')}
    `).join('')}
    <hr class="hr">
    <label class="campo" for="estlibre">Pedir otro estudio que no esta en la lista</label>
    <div class="fila">
      <input type="text" id="estlibre" placeholder="Nombre del estudio" style="flex:1 1 11rem">
      <button class="btn" id="pedirlibre">Pedir</button>
    </div>
    ${partida.estudiosSinResultado.map(e => `
      <p class="resultado vacio" style="margin-top:.6rem"><strong>${esc(e.nombre)}.</strong> No existen resultados disponibles para este estudio en este caso.${e.comentarioFuente ? ' ' + esc(e.comentarioFuente) : ''}</p>
    `).join('')}
  </div>

  <div class="panel">
    <h3>Tu conclusion</h3>
    <p class="nota" style="margin:.35rem 0 .7rem">Al cerrar el caso esto queda bloqueado y pasas al tribunal.</p>
    ${campo('diagnosticos', 'Diagnostico principal', partida.diagnosticos, 'Escribe y presiona Agregar')}
    ${campo('diferenciales', 'Diagnosticos diferenciales', partida.diferenciales, 'Uno por vez')}
    ${campo('conductas', 'Conducta y tratamiento', partida.conductas, 'Una medida por vez')}
    <hr class="hr">
    <div class="fila">
      <button class="btn pri" id="cerrar" ${partida.diagnosticos.length ? '' : 'disabled'}>Cerrar caso e ir al tribunal</button>
      <button class="btn" id="abandonar">Abandonar</button>
    </div>
    ${partida.diagnosticos.length ? '' : '<p class="nota" style="margin-top:.5rem">Necesitas al menos un diagnostico principal para cerrar.</p>'}
  </div>

  ${bloqueReporte('caso', caso.id, perfil)}`;

  // --- eventos ---
  $$('[data-decl]', cont).forEach(t => t.addEventListener('input', () => {
    acc.declarar(t.dataset.decl, t.value);
    const b = $(`[data-revelar="${t.dataset.decl}"]`, cont);
    if (b) b.disabled = t.value.trim().length < 10;
  }));
  on(cont, '[data-revelar]', el => acc.revelar(el.dataset.revelar));
  on(cont, '[data-est]', el => acc.estudio(el.dataset.est));
  $('#pedirlibre', cont)?.addEventListener('click', () => {
    const i = $('#estlibre', cont); if (i.value.trim()) { acc.estudioLibre(i.value); }
  });
  ['diagnosticos', 'diferenciales', 'conductas'].forEach(campoId => {
    const inp = $(`#in_${campoId}`, cont);
    const add = () => { if (inp.value.trim()) acc.proponer(campoId, inp.value); };
    $(`#add_${campoId}`, cont)?.addEventListener('click', add);
    inp?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    on(cont, `[data-quitar="${campoId}"]`, el => acc.quitar(campoId, el.dataset.texto));
  });
  $('#cerrar', cont)?.addEventListener('click', () => acc.cerrar());
  $('#abandonar', cont)?.addEventListener('click', () => acc.abandonar());
  conectarReporte(cont, acc);
}

function campo(id, etiqueta, valores, ph) {
  return `
  <label class="campo" for="in_${id}">${esc(etiqueta)}</label>
  <div class="fila">
    <input type="text" id="in_${id}" placeholder="${esc(ph)}" style="flex:1 1 11rem">
    <button class="btn" id="add_${id}">Agregar</button>
  </div>
  ${valores.length ? `<div class="chips">${valores.map(v => `
    <span class="chip">${esc(v)}<button data-quitar="${id}" data-texto="${esc(v)}" aria-label="Quitar">×</button></span>`).join('')}</div>` : ''}
  <div style="height:.85rem"></div>`;
}
