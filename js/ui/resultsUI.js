/** resultsUI.js — la pantalla que importa: que repasar. */
import { esc, li, $, clase, mmss } from './dom.js';
import { AREAS } from '../services/caseRepository.js';
import { bloqueReporte, conectarReporte } from './reporteUI.js';

export function render(cont, { caso, resultado, recompensa, misiones, perfil }, acc) {
  const A = AREAS[caso.area];
  const d = resultado.detalle;

  cont.innerHTML = `
  <div class="panel zona ${A.color}">
    <div class="fila" style="align-items:center">
      <span class="pill ${A.color}">${A.ico || ''} ${esc(A.nombre)}</span>
      <span class="pill gris">Nivel ${resultado.nivel} · ${mmss(resultado.tiempoSeg)}</span>
    </div>
    <div class="puntaje" style="margin-top:.9rem">
      <div class="anillo ${clase(resultado.global)}" style="--p:${resultado.global}"><div><b>${resultado.global}</b><small>de 100</small></div></div>
      <p class="mensaje" style="margin:0">${resultado.global >= 85 ? '¡Caso dominado!' : resultado.global >= 60 ? '¡Bien defendido!' : 'Cada error de aquí es uno menos en el examen'}</p>
    </div>
    ${resultado.dimensiones.map(x => `
      <div class="dim">
        <div class="cab"><span>${esc(x.etiqueta)}</span><b>${x.total ? `${x.n}/${x.total}` : '—'}</b></div>
        <div class="barra"><i class="${clase(x.pct)}" style="width:${x.pct}%"></i></div>
      </div>`).join('')}
  </div>

  <div class="panel">
    <h2>Solo tienes que repasar esto</h2>
    ${resultado.conceptosRepaso.length ? `
      <ul class="repaso">${resultado.conceptosRepaso.map(k => `
        <li>
          <div class="en">${esc(k.enunciado)}</div>
          <div class="pq">${esc(k.motivos[0])}${k.motivos.length > 1 ? ` y ${k.motivos.length - 1} mas` : ''}</div>
          ${k.pagina ? `<div class="fu">Fuente, pp. ${esc(k.pagina)}</div>` : ''}
        </li>`).join('')}
      </ul>` : `<p class="sutil" style="margin-top:.5rem">Nada pendiente de este caso. Cubriste todos los conceptos clave.</p>`}
  </div>

  <div class="panel">
    <h3>🪙 +${recompensa.total} Kamas Clínicas</h3>
    <div style="margin-top:.5rem">
      ${recompensa.lineas.map(l => `<div class="ganancia"><span>${esc(l.texto)}</span><b>+${l.n}</b></div>`).join('')}
    </div>
    <hr class="hr">
    <h3>Misiones de hoy</h3>
    ${misiones.lista.map(m => `
      <div class="mision">
        <span class="caja ${m.progreso >= m.meta ? 'ok' : ''}"></span>
        <span style="flex:1">${esc(m.texto)}</span>
        <span class="pr">${m.progreso}/${m.meta}</span>
      </div>`).join('')}
  </div>

  <div class="panel">
    <h3>Detalle</h3>
    ${det('Informacion que buscaste', d.info.acertados.map(x => x.texto), d.info.faltantes.map(x => x.texto), 'No buscaste')}
    ${det('Diagnostico', d.dx.acertados.map(x => x.texto), d.dx.faltantes.filter(x => x.valoracion === 'ESPERADO').map(x => x.texto), 'No planteaste')}
    ${det('Diferenciales', d.dd.acertados.map(x => x.texto), d.dd.faltantes.filter(x => x.valoracion === 'ESPERADO').map(x => x.texto), 'No consideraste')}
    ${det('Estudios', d.estudios.acertados.map(x => `${x.texto} [${etq(x.valoracion)}]`), d.estudios.faltantes.map(x => x.texto), 'No solicitaste')}
    ${det('Conducta', d.conductas.acertados.map(x => `${x.texto} [${etq(x.valoracion)}]`), d.conductas.faltantes.filter(x => x.valoracion === 'ESPERADO').map(x => x.texto), 'No propusiste')}
    ${(d.dx.noEvaluables.length || d.dd.noEvaluables.length || d.conductas.noEvaluables.length || d.estudios.sinResultado.length) ? `
      <details><summary>No evaluable con la fuente disponible</summary><div class="cuerpo">
        <p>Esto no cuenta como error. La fuente de este caso no permite evaluarlo.</p>
        <ul>${li([
          ...d.dx.noEvaluables, ...d.dd.noEvaluables, ...d.conductas.noEvaluables,
          ...d.estudios.sinResultado.map(x => x.nombre)
        ])}</ul>
      </div></details>` : ''}
  </div>

  <div class="panel">
    <h3>Fuentes del caso</h3>
    <ul class="cuerpo" style="padding-left:1.15rem;margin:.5rem 0 0">
      ${resultado.fuentes.map(f => `<li style="margin-bottom:.5rem">${esc(f.institucion)}. <em>${esc(f.documento)}</em>, ${esc(f.anio)}${f.capitulo ? `. ${esc(f.capitulo)}` : ''}${f.pagina ? `, pp. ${esc(f.pagina)}` : ''}${f.resolucion ? `. ${esc(f.resolucion)}` : ''}${f.url ? `. <a href="${esc(f.url)}" target="_blank" rel="noopener">enlace</a>` : ''}</li>`).join('')}
    </ul>
    ${caso.notaDeAutoria ? `<p class="nota" style="margin-top:.7rem">${esc(caso.notaDeAutoria)}</p>` : ''}
    ${bloqueReporte('caso', caso.id, perfil)}
  </div>

  <div class="panel">
    <h3>Como jugaste</h3>
    <p class="nota" style="margin:.35rem 0 .6rem">El orden en que tomaste tus decisiones.</p>
    <ul class="cuerpo" style="padding-left:1.15rem;margin:0">
      ${resultado.log.map(e => `<li><span style="color:var(--tinta-3)">${mmss(e.momento)}</span> ${esc(e.tipo)}: ${esc(e.accion)}</li>`).join('')}
    </ul>
  </div>

  <div class="fila" style="margin-bottom:1rem">
    <button class="btn pri" id="otra">Otra partida</button>
    <button class="btn" id="inicio">Volver al inicio</button>
  </div>`;

  $('#otra', cont).addEventListener('click', () => acc.otra());
  conectarReporte(cont, acc);
  $('#inicio', cont).addEventListener('click', () => acc.inicio());
}

const etq = v => ({ ESPERADO: 'esperado', ACEPTABLE: 'aceptable', OPCIONAL: 'opcional', NO_CONTEMPLADO_POR_LA_FUENTE: 'no contemplado por la fuente' }[v] || v);

function det(titulo, hechos, faltas, verboFalta) {
  if (!hechos.length && !faltas.length) return '';
  return `<details><summary>${esc(titulo)}</summary><div class="cuerpo">
    ${hechos.length ? `<p>Hiciste:</p><ul>${li(hechos)}</ul>` : ''}
    ${faltas.length ? `<p>${esc(verboFalta)}:</p><ul>${li(faltas)}</ul>` : ''}
  </div></details>`;
}
