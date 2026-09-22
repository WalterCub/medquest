/** screens.js — inicio, perfil y tienda. */
import { esc, $, $$, on, clase } from './dom.js';
import { AREAS } from '../services/caseRepository.js';
import { racha, nivel, misionesDeHoy, misionesCompletas, RECOMPENSA_MISIONES, PREMIOS } from '../engine/rewardEngine.js';
import { conceptosPendientes } from '../engine/learningEngine.js';
import { decoPregunta } from './quizUI.js';
import { estadoCuenta } from '../services/sync.js';

export function renderInicio(cont, { perfil, casos }, acc) {
  const ms = misionesDeHoy(perfil);
  const r = racha(perfil.dias);
  const pend = conceptosPendientes(perfil);
  const medicos = casos.filter(c => c.tipo === 'medico');
  const jugados = medicos.filter(c => perfil.casos[c.id]).length;

  const saludo = r >= 2 ? `Llevas ${r} días seguidos. No la cortes hoy.` : 'No tienes que repasar toda medicina. Tienes que hacer una partida.';
  cont.innerHTML = `
  <div class="encabezado">
    <h1>¿Qué jugamos hoy?</h1>
    <p class="sutil">${saludo}</p>
  </div>

  <div class="heroes">
    <button class="jugar" id="jugar">
      <span class="burbuja" style="width:10rem;height:10rem;right:-3rem;top:-3.5rem"></span>
      <span class="burbuja" style="width:4rem;height:4rem;right:6.5rem;bottom:-1.5rem"></span>
      <span class="k">Caso clínico</span>
      <span class="v">Un paciente, tus decisiones y la defensa ante el tribunal</span>
      <svg class="deco" viewBox="0 0 120 120" aria-hidden="true">
        <path d="M34 20v28a22 22 0 0 0 44 0V20" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
        <path d="M56 70v14a16 16 0 0 0 32 0v-8" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
        <circle cx="88" cy="66" r="11" fill="#FFC23D" stroke="#fff" stroke-width="5"/>
        <circle cx="34" cy="18" r="5" fill="#fff"/><circle cx="78" cy="18" r="5" fill="#fff"/>
      </svg>
    </button>
    <button class="hero azul" id="preguntas">
      <span class="burbuja" style="width:8rem;height:8rem;right:-2.5rem;top:-3rem"></span>
      <span class="k">Preguntas rápidas</span>
      <span class="v">10 preguntas con la cita de la norma</span>
      ${decoPregunta()}
    </button>
  </div>

  <div class="panel">
    <h3>Misiones de hoy</h3>
    ${ms.lista.map(m => `
      <div class="mision">
        <span class="caja ${m.progreso >= m.meta ? 'ok' : ''}"></span>
        <span style="flex:1">${esc(m.texto)}</span>
        <span class="pr">${m.progreso}/${m.meta}</span>
      </div>`).join('')}
    <hr class="hr">
    ${misionesCompletas(ms)
      ? (ms.cobrada
        ? `<p class="nota">Recompensa cobrada. Vuelve mañana.</p>`
        : `<button class="btn pri ancho" id="cobrar">Cobrar ${RECOMPENSA_MISIONES} Kamas</button>`)
      : `<p class="nota">Completa las tres y cobras ${RECOMPENSA_MISIONES} Kamas Clínicas.</p>`}
  </div>

  ${pend.length ? `
  <div class="panel">
    <h3>Repaso pendiente</h3>
    <p class="nota" style="margin:.35rem 0 .2rem">${pend.length} concepto(s) que fallaste y todavía no corregiste.</p>
    <ul class="repaso">${pend.slice(0, 3).map(k => `<li><div class="en">${esc(k.enunciado)}</div></li>`).join('')}</ul>
    <button class="btn uva ancho" id="repaso" style="margin-top:.8rem">Jugar un caso de repaso</button>
  </div>` : ''}

  <div class="panel">
    <h3>Elegir área</h3>
    <p class="nota" style="margin:.3rem 0 .7rem">Un caso de esa área, en vez de dejarlo al azar.</p>
    <div class="grid-areas">
      ${Object.entries(AREAS).filter(([k]) => k !== 'DEMO').map(([k, a]) => {
        const n = medicos.filter(c => c.area === k).length;
        return `<button class="area-btn ${a.color}" data-area="${k}" ${n ? '' : 'disabled'}>
          <span class="ico" aria-hidden="true">${a.ico || ''}</span>${esc(a.corto)}<small>${n ? n + ' caso(s)' : 'pronto'}</small></button>`;
      }).join('')}
    </div>
    <hr class="hr">
    <p class="nota" style="margin-bottom:.55rem">Nivel de atención. Cambia qué estudios tienes y qué espera la norma de ti. Nivel 1 es un centro de salud con internación.</p>
    <div class="fila">
      ${[1, 2, 3].map(n => `<button class="btn sm ${perfil.ajustes.nivelPreferido === n ? 'act' : ''}" data-nivel="${n}">Nivel ${n}</button>`).join('')}
      <button class="btn sm ${!perfil.ajustes.nivelPreferido ? 'act' : ''}" data-nivel="0">Al azar</button>
    </div>
    <hr class="hr">
    <button class="btn sm" id="demo">🧪 Caso de prueba (no médico)</button>
  </div>

  <div class="stats" style="margin-bottom:1rem">
    <div class="stat"><b>${r}</b><span>días de racha</span></div>
    <div class="stat"><b>${jugados}/${medicos.length}</b><span>casos jugados</span></div>
    <div class="stat"><b>${nivel(perfil.kamas + perfil.canjes.reduce((s, c) => s + c.costo, 0))}</b><span>tu nivel</span></div>
  </div>`;

  $('#jugar', cont).addEventListener('click', () => acc.jugar({}));
  $('#repaso', cont)?.addEventListener('click', () => acc.jugar({ soloRepaso: true }));
  $('#demo', cont).addEventListener('click', () => acc.jugar({ demo: true }));
  $('#preguntas', cont).addEventListener('click', () => acc.ir('preguntas'));
  $('#cobrar', cont)?.addEventListener('click', () => acc.cobrarMisiones());
  on(cont, '[data-area]', el => acc.jugar({ area: el.dataset.area }));
  on(cont, '[data-nivel]', el => acc.fijarNivel(+el.dataset.nivel || null));
}

export function renderPerfil(cont, { perfil, casos, cuenta }, acc) {
  const pend = conceptosPendientes(perfil);
  const areas = Object.entries(AREAS).filter(([k]) => k !== 'DEMO').map(([k, a]) => {
    const st = perfil.areas[k] || { partidas: 0, sumaPuntaje: 0 };
    const total = casos.filter(c => c.area === k && c.tipo === 'medico').length;
    const jug = casos.filter(c => c.area === k && perfil.casos[c.id]).length;
    const media = st.partidas ? Math.round(st.sumaPuntaje / st.partidas) : null;
    return { k, a, total, jug, media, partidas: st.partidas };
  });

  cont.innerHTML = `
  <div class="encabezado"><h1>Tu mapa</h1><p class="sutil">Dónde estás fuerte y qué te falta.</p></div>

  <div class="panel">
    <h3>Por area</h3>
    ${areas.map(x => `
      <div class="areaf">
        <span class="pill ${x.a.color}">${x.a.ico || ''} ${esc(x.a.corto)}</span>
        <span class="nm">${x.jug}/${x.total} casos</span>
        <span class="n">${x.media != null ? x.media + '%' : '—'}</span>
      </div>
      <div class="barra"><i class="${x.media != null ? clase(x.media) : ''}" style="width:${x.total ? x.jug / x.total * 100 : 0}%"></i></div>
    `).join('')}
  </div>

  <div class="panel">
    <h3>Conceptos por corregir</h3>
    ${pend.length ? `<ul class="repaso">${pend.map(k => `
      <li><div class="en">${esc(k.enunciado)}</div>
      <div class="pq">Fallado ${k.fallos} vez(ces)${k.pagina ? ` · fuente pp. ${esc(k.pagina)}` : ''}</div></li>`).join('')}</ul>`
      : '<p class="vacio" style="margin-top:.5rem">Nada pendiente.</p>'}
  </div>

  <div class="panel">
    <h3>Ultimas partidas</h3>
    ${perfil.partidas.length ? `<ul class="cuerpo" style="padding-left:1.15rem;margin:.5rem 0 0">
      ${perfil.partidas.slice(-12).reverse().map(p => `<li>${esc(p.fecha)} · ${esc(p.casoId)} · nivel ${p.nivel} · ${p.global}%</li>`).join('')}
    </ul>` : '<p class="vacio" style="margin-top:.5rem">Todavia ninguna.</p>'}
  </div>

  ${panelCuenta(perfil, cuenta)}

  <div class="panel">
    <h3>Tus datos</h3>
    <div class="fila" style="margin-top:.5rem">
      <button class="btn sm" id="exportar">Exportar progreso</button>
      <button class="btn sm" id="tema">Cambiar tema</button>
      <button class="btn sm" id="borrar">Borrar todo</button>
    </div>
  </div>`;

  $('#exportar', cont).addEventListener('click', () => acc.exportar());
  $('#enviar', cont)?.addEventListener('click', () => acc.enviarCodigo($('#email', cont).value));
  $('#email', cont)?.addEventListener('keydown', e => { if (e.key === 'Enter') acc.enviarCodigo(e.target.value); });
  $('#verificar', cont)?.addEventListener('click', () => acc.verificarCodigo($('#codigo', cont).value));
  $('#codigo', cont)?.addEventListener('keydown', e => { if (e.key === 'Enter') acc.verificarCodigo(e.target.value); });
  $('#otro-correo', cont)?.addEventListener('click', () => acc.volverACorreo());
  $('#sync', cont)?.addEventListener('click', () => acc.sincronizarAhora());
  $('#salir-cuenta', cont)?.addEventListener('click', () => acc.cerrarSesion());
  $('#tema', cont).addEventListener('click', () => acc.tema());
  $('#borrar', cont).addEventListener('click', () => acc.borrar());
}

const miles = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function renderTienda(cont, { perfil }, acc) {
  cont.innerHTML = `
  <div class="encabezado">
    <h1>🪙 ${miles(perfil.kamas)} Kamas Clínicas</h1>
    <p class="sutil">Cada partida, ronda y misión suma. Cuando llegues al precio, reclama la recompensa y alguien de confianza te la entrega.</p>
  </div>

  <div class="panel">
    <h3>Recompensas</h3>
    ${PREMIOS.map(p => {
      const pct = Math.min(100, Math.round(perfil.kamas / p.costo * 100));
      const alcanza = perfil.kamas >= p.costo;
      return `
      <div class="premio">
        <span class="ico" aria-hidden="true">${p.ico}</span>
        <span class="nm">${esc(p.nombre)}<small>${alcanza ? '¡Ya te alcanza!' : `Te faltan ${miles(p.costo - perfil.kamas)}`}</small></span>
        <span class="co">${miles(p.costo)}</span>
        <button class="btn sm ${alcanza ? 'pri' : ''}" data-canje="${esc(p.id)}" ${alcanza ? '' : 'disabled'}>Reclamar</button>
      </div>
      <div class="barra"><i class="${alcanza ? 'b' : 'm'}" style="width:${pct}%"></i></div>`;
    }).join('')}
  </div>

  <div class="panel">
    <h3>Reclamadas</h3>
    ${perfil.canjes.length ? `<ul class="cuerpo" style="padding-left:1.15rem;margin:.5rem 0 0">
      ${perfil.canjes.slice().reverse().map(c => `<li>${esc(c.fecha)} · ${esc(c.nombre)} (${c.costo}) · ${esc(c.estado)}</li>`).join('')}
    </ul>` : '<p class="vacio" style="margin-top:.5rem">Ninguna todavía.</p>'}
    <p class="nota" style="margin-top:.7rem">MedQuest solo registra el reclamo. La entrega ocurre fuera de la app.</p>
  </div>`;

  on(cont, '[data-canje]', el => acc.canjear(el.dataset.canje));
}

function panelCuenta(perfil, cuenta) {
  const u = estadoCuenta.usuario;
  const pendientes = (perfil.reportes || []).filter(r => !r.enviado).length;
  if (u) {
    const hora = estadoCuenta.sincronizado ? estadoCuenta.sincronizado.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : null;
    return `<div class="panel">
      <h3>☁️ Tu cuenta</h3>
      <p class="sutil" style="margin:.35rem 0 .2rem">Sesión iniciada como <strong>${esc(u.email)}</strong>.</p>
      <p class="nota">${estadoCuenta.error ? `No se pudo sincronizar: ${esc(estadoCuenta.error)}` : hora ? `Progreso sincronizado a las ${hora}. Lo verás igual en cualquier dispositivo donde entres con este correo.` : 'Sincronizando...'}</p>
      ${(perfil.reportes || []).length ? `<p class="nota">⚠️ Reportes de error: ${(perfil.reportes || []).length - pendientes} enviado(s)${pendientes ? `, ${pendientes} por enviar` : ''}.</p>` : ''}
      <div class="fila" style="margin-top:.6rem">
        <button class="btn sm verde" id="sync" ${cuenta.ocupado ? 'disabled' : ''}>Sincronizar ahora</button>
        <button class="btn sm" id="salir-cuenta">Cerrar sesión</button>
      </div>
    </div>`;
  }
  return `<div class="panel">
    <h3>☁️ Guarda tu progreso en la nube</h3>
    <p class="nota" style="margin:.35rem 0 .7rem">Sin contraseña: te llega un correo para entrar. Así tu progreso se sincroniza entre el teléfono y la computadora y no se pierde si el navegador borra los datos.</p>
    ${cuenta.fase === 'codigo' ? `
      <label class="campo" for="codigo">Código de 6 dígitos que llegó a ${esc(cuenta.email)}</label>
      <div class="fila">
        <input type="text" id="codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456" style="flex:1 1 8rem">
        <button class="btn pri" id="verificar" ${cuenta.ocupado ? 'disabled' : ''}>Entrar</button>
      </div>
      <button class="btn sm" id="otro-correo" style="margin-top:.6rem">Usar otro correo</button>` : `
      <label class="campo" for="email">Tu correo</label>
      <div class="fila">
        <input type="text" id="email" inputmode="email" autocomplete="email" placeholder="nombre@correo.com" value="${esc(cuenta.email)}" style="flex:1 1 11rem">
        <button class="btn pri" id="enviar" ${cuenta.ocupado ? 'disabled' : ''}>${cuenta.ocupado ? 'Enviando...' : 'Enviarme el acceso'}</button>
      </div>`}
    ${cuenta.mensaje ? `<p class="aviso" style="margin:.7rem 0 0">${esc(cuenta.mensaje)}</p>` : ''}
    ${pendientes ? `<p class="nota" style="margin-top:.7rem">⚠️ Tienes ${pendientes} reporte(s) de error guardado(s). Se envían al iniciar sesión.</p>` : ''}
  </div>`;
}
