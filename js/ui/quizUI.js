/** quizUI.js — modulo de preguntas del banco. Solo dibuja; la logica esta en quizEngine. */
import { esc, $, on, clase } from './dom.js';
import { AREAS } from '../services/caseRepository.js';
import { preguntaActual, resumenRonda, estadisticasBanco, PREGUNTAS_POR_RONDA } from '../engine/quizEngine.js';

const LETRAS = ['A', 'B', 'C', 'D', 'E'];

export function render(cont, { banco, perfil, ronda, recompensaRonda }, acc) {
  if (!banco) { cont.innerHTML = '<p class="vacio">Cargando preguntas...</p>'; return; }
  if (!ronda) return inicio(cont, banco, perfil, acc);
  if (!preguntaActual(ronda)) return resumen(cont, banco, ronda, recompensaRonda, acc);
  return pregunta(cont, banco, ronda, acc);
}

function inicio(cont, banco, perfil, acc) {
  const st = estadisticasBanco(banco, perfil);
  const porArea = Object.entries(AREAS).filter(([k]) => k !== 'DEMO')
    .map(([k, a]) => ({ k, a, n: banco.preguntas.filter(q => q.area === k).length }))
    .filter(x => x.n);

  cont.innerHTML = `
  <div class="encabezado">
    <h1>Preguntas rápidas</h1>
    <p class="sutil">Rondas de ${PREGUNTAS_POR_RONDA}. Cada respuesta trae la frase exacta de la norma y su página, para que la puedas comprobar en el PDF.</p>
  </div>

  <button class="hero azul" id="ronda" style="margin-bottom:.9rem">
    <span class="burbuja" style="width:9rem;height:9rem;right:-2.5rem;top:-3rem"></span>
    <span class="k">Empezar ronda</span>
    <span class="v">${PREGUNTAS_POR_RONDA} preguntas de todas las áreas, priorizando las que fallaste</span>
    ${decoPregunta()}
  </button>

  <div class="panel">
    <div class="stats">
      <div class="stat"><b>${st.vistas}/${st.total}</b><span>vistas</span></div>
      <div class="stat"><b>${st.pct != null ? st.pct + '%' : '—'}</b><span>aciertos</span></div>
      <div class="stat"><b>${st.dominadas}</b><span>dominadas</span></div>
    </div>
    ${st.pendientes ? `<button class="btn uva ancho" id="falladas" style="margin-top:.8rem">Repasar las ${st.pendientes} que fallaste la última vez</button>` : ''}
  </div>

  <div class="panel">
    <h3>Por área</h3>
    <p class="nota" style="margin:.3rem 0 .7rem">Una ronda solo de esa área.</p>
    <div class="grid-areas">
      ${porArea.map(x => `
        <button class="area-btn ${x.a.color}" data-area="${x.k}">
          <span class="ico" aria-hidden="true">${x.a.ico || ''}</span>${esc(x.a.corto)}<small>${x.n} preguntas</small>
        </button>`).join('')}
    </div>
  </div>

  <p class="nota" style="text-align:center">Las preguntas están en borrador hasta que una persona del área confirme que cada cita respalda la respuesta.</p>`;

  $('#ronda', cont).addEventListener('click', () => acc.empezarRonda({}));
  $('#falladas', cont)?.addEventListener('click', () => acc.empezarRonda({ soloFalladas: true }));
  on(cont, '[data-area]', el => acc.empezarRonda({ area: el.dataset.area }));
}

function pregunta(cont, banco, ronda, acc) {
  const q = preguntaActual(ronda);
  const A = AREAS[q.area] || AREAS.DEMO;
  const respondida = ronda.elegida != null;
  const correctaMostrada = q.orden.indexOf(q.correcta);
  const acerto = respondida && ronda.elegida === correctaMostrada;
  const f = banco.fuentes[q.fuente.id] || {};

  const clases = (i) => {
    if (!respondida) return '';
    if (i === correctaMostrada) return 'correcta';
    if (i === ronda.elegida) return 'incorrecta';
    return 'apagada';
  };

  cont.innerHTML = `
  <div class="progreso" aria-label="Pregunta ${ronda.i + 1} de ${ronda.preguntas.length}">
    ${ronda.preguntas.map((p, i) => {
      const r = ronda.respuestas[i];
      return `<i class="${r ? (r.correcta ? 'ok' : 'no') : i === ronda.i ? 'ahora' : ''}"></i>`;
    }).join('')}
  </div>

  <div class="pregunta ${A.color}">
    <span class="tema">${esc(A.ico || '')} ${esc(q.tema)} · ${ronda.i + 1} de ${ronda.preguntas.length}</span>
    <p class="enunciado">${esc(q.enunciado)}</p>
    ${respondida && acerto ? chispas() : ''}
  </div>

  <div class="opciones">
    ${q.orden.map((orig, i) => `
      <button class="opcion ${clases(i)}" data-op="${i}" ${respondida ? 'disabled' : ''}>
        <span class="letra">${LETRAS[i]}</span><span>${esc(q.opciones[orig])}</span>
      </button>`).join('')}
  </div>

  ${respondida ? `
  <div class="veredicto ${acerto ? 'bien' : 'mal'}">
    <h3>${acerto ? '¡Correcto!' : 'No era esa'}</h3>
    ${acerto ? '' : `<p><strong>Respuesta:</strong> ${esc(q.opciones[q.correcta])}</p>`}
    <p>${esc(q.explicacion)}</p>
    <div class="cita">“${esc(q.fuente.cita)}”
      <span class="de">${esc(f.corto || q.fuente.id)}, página ${q.fuente.pagina}${f.anio ? ` · ${esc(f.anio)}` : ''}${f.url ? ` · <a href="${esc(f.url)}" target="_blank" rel="noopener">ver norma</a>` : ''}</span>
    </div>
  </div>
  <button class="btn pri ancho" id="sig">${ronda.i + 1 < ronda.preguntas.length ? 'Siguiente' : 'Ver resultado'}</button>
  ` : `<p class="nota" style="text-align:center">Elige una opción. Verás al instante si acertaste y lo que dice la norma.</p>`}`;

  on(cont, '[data-op]', el => acc.responderPregunta(+el.dataset.op));
  $('#sig', cont)?.addEventListener('click', () => acc.siguientePregunta());
  $('#sig', cont)?.focus();
}

function resumen(cont, banco, ronda, rec, acc) {
  const r = resumenRonda(ronda);
  const pct = r.total ? Math.round(r.aciertos / r.total * 100) : 0;
  const msg = pct === 100 ? '¡Ronda perfecta!' : pct >= 80 ? '¡Muy bien!' : pct >= 50 ? 'Vas por buen camino' : 'Estas vuelven pronto: así se aprenden';

  cont.innerHTML = `
  <div class="panel" style="margin-top:1rem">
    <div class="puntaje">
      <div class="anillo ${clase(pct)}" style="--p:${pct}"><div><b>${r.aciertos}</b><small>de ${r.total}</small></div></div>
      <div>
        <p class="mensaje" style="margin:0">${msg}</p>
        ${rec ? `<p class="sutil" style="margin:.4rem 0 0">+${rec.total} Kamas Clínicas</p>` : ''}
      </div>
    </div>
  </div>

  ${r.falladas.length ? `
  <div class="panel">
    <h3>Para repasar</h3>
    <ul class="repaso">
      ${r.falladas.map(q => {
        const f = banco.fuentes[q.fuente.id] || {};
        return `<li>
          <div class="pq" style="margin:0 0 .3rem">${esc(q.enunciado)}</div>
          <div class="en">${esc(q.opciones[q.correcta])}</div>
          <div class="fu">“${esc(q.fuente.cita)}” — ${esc(f.corto || q.fuente.id)}, p. ${q.fuente.pagina}</div>
        </li>`;
      }).join('')}
    </ul>
  </div>` : ''}

  <div class="fila" style="margin-bottom:1rem">
    <button class="btn pri" id="otra">Otra ronda</button>
    ${r.falladas.length ? '<button class="btn uva" id="rep">Repetir las falladas</button>' : ''}
    <button class="btn" id="salir">Volver</button>
  </div>`;

  $('#otra', cont).addEventListener('click', () => acc.empezarRonda(ronda.filtro.soloFalladas ? {} : ronda.filtro));
  $('#rep', cont)?.addEventListener('click', () => acc.empezarRonda({ soloFalladas: true }));
  $('#salir', cont).addEventListener('click', () => acc.salirRonda());
}

function chispas() {
  const e = ['✨', '⭐', '🎉', '💫'];
  return `<div class="chispas" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return `<span style="left:50%;top:55%;--dx:${Math.round(Math.cos(a) * 130)}px;--dy:${Math.round(Math.sin(a) * 70)}px">${e[i % e.length]}</span>`;
  }).join('')}</div>`;
}

export function decoPregunta() {
  return `<svg class="deco" viewBox="0 0 120 120" aria-hidden="true">
    <rect x="22" y="14" width="76" height="92" rx="16" fill="rgba(255,255,255,.22)"/>
    <rect x="34" y="30" width="52" height="8" rx="4" fill="#fff"/>
    <rect x="34" y="46" width="40" height="8" rx="4" fill="rgba(255,255,255,.75)"/>
    <circle cx="40" cy="72" r="7" fill="#FFC23D"/><rect x="52" y="68" width="30" height="8" rx="4" fill="rgba(255,255,255,.75)"/>
    <circle cx="40" cy="90" r="7" fill="#fff"/><rect x="52" y="86" width="24" height="8" rx="4" fill="rgba(255,255,255,.75)"/>
  </svg>`;
}
