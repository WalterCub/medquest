/**
 * avatarUI.js — dibujo del personaje (SVG por capas) y pantalla de personaje.
 *
 * El personaje se arma con capas en un orden fijo: aura, compañero, pelo de
 * atras, cuerpo, brazos, cuello, cabeza, cara, pelo de adelante, cabeza (pieza)
 * y lo que lleva en la mano. Cada pieza es una funcion que devuelve SVG; agregar
 * una pieza nueva es agregar su funcion y su entrada en avatarEngine.PIEZAS.
 */
import { esc, $, on } from './dom.js';
import {
  SETS, PIEZAS, NOMBRE_RANURA, PIELES, PELOS, PEINADOS, avatarInicial,
  estadoLogros, piezasDesbloqueadas, setsCompletos, rango
} from '../engine/avatarEngine.js';

const L = '#3B2F4A';                       // trazo
const T = `stroke="${L}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
let uid = 0;

const AURA = { madrugador: '#19B39E', aventurero: '#FF6B4A', sabio: '#7B61FF', investidura: '#F0A500' };

// ---------- pelo ----------
function peloAtras(peinado, c) {
  if (peinado === 'largo') return `<path d="M50 92 C46 140 52 168 62 172 L138 172 C148 168 154 140 150 92 Z" fill="${c}" ${T}/>`;
  if (peinado === 'coleta') return `<path d="M140 70 C176 72 178 132 160 150 C170 122 160 96 142 92 Z" fill="${c}" ${T}/>`;
  return '';
}
function peloFrente(peinado, c) {
  if (peinado === 'rulos') {
    const pts = [[56, 80], [64, 60], [80, 48], [100, 44], [120, 48], [136, 60], [144, 80]];
    return pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="15" fill="${c}" ${T}/>`).join('')
      + `<path d="M58 84 C70 70 130 70 142 84" fill="${c}"/>`;
  }
  const fleco = peinado === 'corto'
    ? 'M50 96 C46 22 154 22 150 96 C144 80 132 70 112 70 C104 80 88 82 76 76 C66 80 56 88 50 96 Z'
    : 'M50 100 C46 20 154 20 150 100 C146 84 138 72 124 68 C114 80 92 84 72 74 C62 80 54 90 50 100 Z';
  return `<path d="${fleco}" fill="${c}" ${T}/>`;
}

// ---------- cuerpo ----------
const TORSO = 'M70 140 Q100 132 130 140 L134 200 Q100 206 66 200 Z';
function cuerpo(id) {
  if (id === 'pijama') return {
    manga: '#19B39E',
    svg: `<path d="${TORSO}" fill="#19B39E" ${T}/>
      <path d="M88 138 L100 156 L112 138" fill="#0E8C7B" stroke="${L}" stroke-width="2.5" stroke-linejoin="round"/>
      <rect x="110" y="166" width="14" height="12" rx="2" fill="#0E8C7B"/>`
  };
  if (id === 'bata') return {
    manga: '#FFFFFF',
    svg: `<path d="${TORSO}" fill="#9CC8FF" ${T}/>
      <path d="M70 140 Q84 136 94 137 L98 202 Q80 204 66 200 Z" fill="#fff" ${T}/>
      <path d="M130 140 Q116 136 106 137 L102 202 Q120 204 134 200 Z" fill="#fff" ${T}/>
      <path d="M86 138 L96 160 L94 138 Z M114 138 L104 160 L106 138 Z" fill="#E9EEF5" stroke="${L}" stroke-width="2"/>
      <rect x="110" y="172" width="16" height="12" rx="2" fill="none" stroke="${L}" stroke-width="2"/>
      <path d="M114 172 v-7" stroke="#3D8BFD" stroke-width="3" stroke-linecap="round"/>`
  };
  if (id === 'batalarga') return {
    manga: '#FFFFFF',
    svg: `<path d="${TORSO}" fill="#27466E" ${T}/>
      <path d="M70 140 Q84 136 94 137 L98 222 Q78 224 62 218 Z" fill="#fff" ${T}/>
      <path d="M130 140 Q116 136 106 137 L102 222 Q122 224 138 218 Z" fill="#fff" ${T}/>
      <path d="M94 137 L98 222 M106 137 L102 222" stroke="#C99A2E" stroke-width="2"/>
      <path d="M86 138 L96 162 L94 138 Z M114 138 L104 162 L106 138 Z" fill="#EEF1F6" stroke="${L}" stroke-width="2"/>
      <circle cx="82" cy="170" r="7" fill="#F0C75E" stroke="#A87A12" stroke-width="2"/>
      <path d="M82 164 v12 M79 167 q3 3 6 0 M79 172 q3 3 6 0" stroke="#A87A12" stroke-width="1.5" fill="none"/>
      <path d="M110 176 h16" stroke="#27466E" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M110 181 h11" stroke="#27466E" stroke-width="2" stroke-linecap="round"/>`
  };
  return { manga: '#FFC23D', svg: `<path d="${TORSO}" fill="#FFC23D" ${T}/><path d="M90 138 Q100 146 110 138" fill="none" ${T}/>` };
}

// ---------- cuello ----------
function cuello(id) {
  if (id === 'esteto') return `<path d="M80 139 C76 162 92 174 100 174 C108 174 124 162 120 139" fill="none" stroke="${L}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="100" cy="180" r="7" fill="#C9D3DE" stroke="${L}" stroke-width="2.5"/><circle cx="100" cy="180" r="3" fill="#8A97A6"/>`;
  if (id === 'dobleesteto') return `<path d="M80 139 C76 162 92 174 100 174 C108 174 124 162 120 139" fill="none" stroke="#7A1E3A" stroke-width="4.5" stroke-linecap="round"/>
    <circle cx="100" cy="182" r="9" fill="#E6EBF1" stroke="${L}" stroke-width="2.5"/><circle cx="100" cy="182" r="5" fill="none" stroke="#9AA6B4" stroke-width="2"/>
    <circle cx="112" cy="186" r="4.5" fill="#E6EBF1" stroke="${L}" stroke-width="2"/>`;
  if (id === 'linterna') return `<path d="M84 139 L100 166 L116 139" fill="none" stroke="#7B61FF" stroke-width="3.5" stroke-linejoin="round"/>
    <rect x="96" y="164" width="8" height="22" rx="3" fill="#D5DBE3" stroke="${L}" stroke-width="2"/>
    <circle cx="100" cy="188" r="3.5" fill="#FFE27A" stroke="${L}" stroke-width="1.5"/>`;
  return '';
}

// ---------- cabeza ----------
function cabeza(id) {
  if (id === 'gorro') return `<path d="M50 90 C46 38 154 38 150 90 C130 78 70 78 50 90 Z" fill="#19B39E" ${T}/>
    <circle cx="78" cy="62" r="3" fill="#fff" opacity=".7"/><circle cx="100" cy="54" r="3" fill="#fff" opacity=".7"/><circle cx="122" cy="62" r="3" fill="#fff" opacity=".7"/><circle cx="92" cy="72" r="3" fill="#fff" opacity=".7"/><circle cx="112" cy="72" r="3" fill="#fff" opacity=".7"/>`;
  if (id === 'frontoscopio') return `<path d="M50 80 Q100 62 150 80" fill="none" stroke="#6B7684" stroke-width="7" stroke-linecap="round"/>
    <circle cx="100" cy="62" r="15" fill="#E6EBF1" stroke="${L}" stroke-width="3"/><circle cx="100" cy="62" r="9" fill="#fff" opacity=".8"/><circle cx="100" cy="62" r="3" fill="${L}"/>
    <path d="M92 55 l5 5" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`;
  if (id === 'birrete') return `<path d="M62 70 Q100 56 138 70 L136 50 Q100 40 64 50 Z" fill="#1F1B2E" ${T}/>
    <path d="M100 20 L162 40 L100 58 L38 40 Z" fill="#2B2640" ${T}/>
    <circle cx="100" cy="39" r="4" fill="#F0C75E"/>
    <path d="M100 39 L152 46 L152 70" fill="none" stroke="#F0C75E" stroke-width="3" stroke-linecap="round"/>
    <path d="M147 70 h10 l-2 12 h-6 Z" fill="#F0C75E" stroke="#A87A12" stroke-width="1.5"/>`;
  return '';
}
function gafas() {
  return `<g fill="rgba(255,255,255,.25)" stroke="${L}" stroke-width="3"><circle cx="80" cy="100" r="12"/><circle cx="120" cy="100" r="12"/></g>
    <path d="M92 99 Q100 94 108 99" fill="none" stroke="${L}" stroke-width="3"/>`;
}

// ---------- mano (derecha, vista desde el frente) ----------
function mano(id) {
  if (id === 'termo') return `<path d="M136 166 q-4 -8 0 -14 M146 166 q-4 -8 0 -14" fill="none" stroke="#B9AEC9" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="130" y="170" width="22" height="28" rx="4" fill="#FF6B4A" ${T}/><rect x="128" y="166" width="26" height="7" rx="3" fill="#FFF7EC" ${T}/>
    <rect x="133" y="180" width="16" height="7" rx="2" fill="#fff" opacity=".8"/>`;
  if (id === 'maletin') return `<path d="M136 196 q0 -12 12 -12 q12 0 12 12" fill="none" stroke="${L}" stroke-width="4"/>
    <rect x="124" y="194" width="48" height="30" rx="7" fill="#8B4A2B" ${T}/>
    <path d="M124 206 h48" stroke="#6B3620" stroke-width="2.5"/><rect x="143" y="202" width="10" height="8" rx="2" fill="#F0C75E" stroke="${L}" stroke-width="1.5"/>
    <path d="M148 212 v8 M144 216 h8" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`;
  if (id === 'norma') return `<rect x="128" y="164" width="30" height="38" rx="3" fill="#3D8BFD" ${T} transform="rotate(8 143 183)"/>
    <path d="M133 168 v34" stroke="#2166D1" stroke-width="3" transform="rotate(8 143 183)"/>
    <rect x="138" y="174" width="15" height="6" rx="1.5" fill="#fff" transform="rotate(8 143 183)"/>
    <path d="M138 186 h14 M138 191 h10" stroke="#fff" stroke-width="2" opacity=".75" transform="rotate(8 143 183)"/>`;
  if (id === 'titulo') return `<g transform="rotate(-28 146 184)"><rect x="126" y="176" width="42" height="15" rx="7.5" fill="#FFF3D6" ${T}/>
    <ellipse cx="168" cy="183.5" rx="4" ry="7.5" fill="#F5E2B0" ${T}/>
    <rect x="143" y="175" width="7" height="17" fill="#C2272D" stroke="${L}" stroke-width="1.5"/></g>
    <path d="M148 196 l-5 12 M150 196 l6 11" stroke="#C2272D" stroke-width="3" stroke-linecap="round"/>`;
  return '';
}

// ---------- compañero ----------
function companero(id) {
  if (id === 'hemito') return `<g class="flota">
    <ellipse cx="30" cy="188" rx="22" ry="17" fill="#E53950" ${T}/><ellipse cx="30" cy="188" rx="11" ry="7" fill="#C0263D"/>
    <circle cx="23" cy="184" r="2.6" fill="${L}"/><circle cx="37" cy="184" r="2.6" fill="${L}"/>
    <path d="M26 192 q4 4 8 0" fill="none" stroke="${L}" stroke-width="2" stroke-linecap="round"/></g>`;
  if (id === 'buho') return `<g class="flota">
    <path d="M14 172 l6 -10 l6 8 M34 170 l6 -8 l6 10" fill="#8C6239" ${T}/>
    <ellipse cx="30" cy="190" rx="19" ry="22" fill="#A8774A" ${T}/><ellipse cx="30" cy="198" rx="11" ry="12" fill="#E8D2B0"/>
    <circle cx="22" cy="182" r="7" fill="#fff" stroke="${L}" stroke-width="2"/><circle cx="38" cy="182" r="7" fill="#fff" stroke="${L}" stroke-width="2"/>
    <circle cx="22" cy="182" r="3.2" fill="${L}"/><circle cx="38" cy="182" r="3.2" fill="${L}"/>
    <path d="M27 189 l3 5 l3 -5 Z" fill="#F0A500"/></g>`;
  return '';
}

/** Devuelve el SVG del personaje. `av` es perfil.avatar; `tam` el ancho en px; `retrato` recorta cabeza y hombros. */
export function dibujarAvatar(av, tam = 180, retrato = false) {
  av = { ...avatarInicial(), ...(av || {}) };
  const eq = av.equipado || {};
  const piel = PIELES[av.piel] || PIELES[1];
  const pelo = PELOS[av.pelo] || PELOS[0];
  const peinado = PEINADOS[av.peinado] || PEINADOS[0];
  const cu = cuerpo(eq.cuerpo);
  const completos = setsCompletos(eq);
  const aura = completos.length ? AURA[completos[completos.length - 1].id] : null;
  const g = 'av' + (++uid);
  const gorroTapa = eq.cabeza === 'gorro' || eq.cabeza === 'birrete';

  const vb = retrato ? '28 14 144 144' : '0 0 200 240';
  return `<svg class="avatar" viewBox="${vb}" width="${tam}" height="${retrato ? tam : tam * 1.2}" role="img" aria-label="Tu personaje">
    <defs><radialGradient id="${g}"><stop offset="0" stop-color="${aura || '#fff'}" stop-opacity=".55"/><stop offset="1" stop-color="${aura || '#fff'}" stop-opacity="0"/></radialGradient></defs>
    ${aura ? `<circle cx="100" cy="130" r="100" fill="url(#${g})"/>
      <path d="M26 70 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z M174 100 l2.5 5.5 l5.5 2.5 l-5.5 2.5 l-2.5 5.5 l-2.5 -5.5 l-5.5 -2.5 l5.5 -2.5 Z" fill="${aura}"/>` : ''}
    <ellipse cx="100" cy="228" rx="46" ry="7" fill="${L}" opacity=".12"/>
    ${companero(eq.companero)}
    ${gorroTapa ? '' : peloAtras(peinado, pelo)}
    <rect x="77" y="194" width="18" height="26" rx="6" fill="#4A4166" ${T}/><rect x="105" y="194" width="18" height="26" rx="6" fill="#4A4166" ${T}/>
    <ellipse cx="84" cy="222" rx="13" ry="6" fill="${L}"/><ellipse cx="116" cy="222" rx="13" ry="6" fill="${L}"/>
    ${cu.svg}
    <rect x="52" y="142" width="18" height="46" rx="9" fill="${cu.manga}" ${T} transform="rotate(8 61 142)"/>
    <rect x="130" y="142" width="18" height="46" rx="9" fill="${cu.manga}" ${T} transform="rotate(-8 139 142)"/>
    <circle cx="56" cy="190" r="8" fill="${piel}" ${T}/>
    ${cuello(eq.cuello)}
    <circle cx="50" cy="100" r="9" fill="${piel}" ${T}/><circle cx="150" cy="100" r="9" fill="${piel}" ${T}/>
    <circle cx="100" cy="92" r="50" fill="${piel}" ${T}/>
    <ellipse cx="80" cy="102" rx="5.5" ry="7.5" fill="${L}"/><ellipse cx="120" cy="102" rx="5.5" ry="7.5" fill="${L}"/>
    <circle cx="82" cy="99" r="2.2" fill="#fff"/><circle cx="122" cy="99" r="2.2" fill="#fff"/>
    <ellipse cx="68" cy="116" rx="7" ry="4" fill="#FF7A8A" opacity=".45"/><ellipse cx="132" cy="116" rx="7" ry="4" fill="#FF7A8A" opacity=".45"/>
    <path d="M93 118 Q100 125 107 118" fill="none" stroke="${L}" stroke-width="3" stroke-linecap="round"/>
    ${eq.cabeza === 'gafas' ? gafas() : ''}
    ${eq.cabeza === 'gorro' ? '' : peloFrente(peinado, pelo)}
    ${cabeza(eq.cabeza)}
    ${mano(eq.mano)}
    <circle cx="144" cy="190" r="8" fill="${piel}" ${T}/>
  </svg>`;
}

// ---------- pantalla ----------
const NOMBRE_PEINADO = { corto: 'Corto', largo: 'Largo', rulos: 'Rulos', coleta: 'Coleta' };

export function renderAvatar(cont, { perfil }, acc) {
  const av = { ...avatarInicial(), ...(perfil.avatar || {}) };
  const libres = piezasDesbloqueadas(perfil);
  const logros = estadoLogros(perfil);
  const completos = setsCompletos(av.equipado);
  const r = rango(perfil);
  const hechos = logros.filter(l => l.hecho).length;

  cont.innerHTML = `
  <div class="encabezado"><h1>Tu personaje</h1><p class="sutil">Cada logro de estudio desbloquea una pieza. Las Kamas quedan para las recompensas.</p></div>

  <div class="panel escenario">
    <div class="escena">${dibujarAvatar(av, 190)}</div>
    <div class="ficha">
      <input type="text" id="av-nombre" maxlength="18" placeholder="Ponle nombre" value="${esc(av.nombre)}" aria-label="Nombre del personaje">
      <p class="rango">${esc(r.titulo)} · nivel ${r.nivel}</p>
      <p class="nota">${hechos}/${logros.length} logros · ${libres.size}/${PIEZAS.length} piezas</p>
      ${completos.length ? completos.map(s => `<span class="pill ${s.serio ? 'oro' : ''} bonus">✦ ${esc(s.nombre)}</span>`).join('') : ''}
    </div>
  </div>

  <div class="panel">
    <h3>Apariencia</h3>
    <p class="campo">Piel</p>
    <div class="muestras">${PIELES.map((c, i) => `<button class="muestra ${av.piel === i ? 'act' : ''}" style="background:${c}" data-ap="piel" data-v="${i}" aria-label="Tono ${i + 1}"></button>`).join('')}</div>
    <p class="campo">Pelo</p>
    <div class="muestras">${PELOS.map((c, i) => `<button class="muestra ${av.pelo === i ? 'act' : ''}" style="background:${c}" data-ap="pelo" data-v="${i}" aria-label="Color ${i + 1}"></button>`).join('')}</div>
    <div class="fila" style="margin-top:.6rem">${PEINADOS.map((p, i) => `<button class="btn sm ${av.peinado === i ? 'act' : ''}" data-ap="peinado" data-v="${i}">${NOMBRE_PEINADO[p]}</button>`).join('')}</div>
  </div>

  ${SETS.map(s => {
    const piezas = PIEZAS.filter(p => p.set === s.id);
    const n = piezas.filter(p => libres.has(p.id)).length;
    return `
    <div class="panel set ${s.serio ? 'serio' : ''}">
      <div class="set-cab">
        <div><h3>${esc(s.nombre)}</h3><p class="nota" style="margin:.15rem 0 0">${esc(s.lema)}</p></div>
        <span class="pill ${n === piezas.length ? 'oro' : 'gris'}">${n}/${piezas.length}</span>
      </div>
      <div class="piezas">
        ${piezas.map(p => {
          const ok = libres.has(p.id);
          const puesto = av.equipado?.[p.ranura] === p.id;
          const lg = logros.find(l => l.da === p.id);
          return `<button class="pieza ${ok ? '' : 'bloq'} ${puesto ? 'puesta' : ''}" ${ok ? `data-equipar="${p.id}"` : 'disabled'}>
            <span class="ico" aria-hidden="true">${ok ? p.ico : '🔒'}</span>
            <span class="nm">${esc(p.nombre)}</span>
            <small>${ok ? (puesto ? 'Puesta · tocar para quitar' : NOMBRE_RANURA[p.ranura]) : `${esc(lg.nombre)}: ${esc(lg.texto.toLowerCase())} (${lg.n}/${lg.meta})`}</small>
          </button>`;
        }).join('')}
      </div>
      ${n > 1 ? `<button class="btn sm" data-set="${s.id}" style="margin-top:.7rem">Ponerme todo lo del set</button>` : ''}
      ${n === piezas.length ? '' : `<p class="nota" style="margin-top:.6rem">Con el set completo puesto, el personaje brilla.</p>`}
    </div>`;
  }).join('')}

  <div class="panel">
    <h3>Logros</h3>
    ${logros.map(l => `
      <div class="logro ${l.hecho ? 'hecho' : ''}">
        <span class="ico" aria-hidden="true">${l.hecho ? '🏆' : '⬜'}</span>
        <span class="nm">${esc(l.nombre)}<small>${esc(l.texto)} · ${l.n}/${l.meta}</small></span>
      </div>
      ${l.hecho ? '' : `<div class="barra"><i class="m" style="width:${Math.round(l.n / l.meta * 100)}%"></i></div>`}`).join('')}
  </div>`;

  on(cont, '[data-equipar]', el => acc.equipar(el.dataset.equipar));
  on(cont, '[data-set]', el => acc.equiparSet(el.dataset.set));
  on(cont, '[data-ap]', el => acc.ajustarAvatar(el.dataset.ap, +el.dataset.v));
  $('#av-nombre', cont).addEventListener('change', e => acc.ajustarAvatar('nombre', e.target.value.trim().slice(0, 18)));
}

/** Tarjeta chica para la pantalla de inicio. */
export function tarjetaAvatar(perfil) {
  const av = { ...avatarInicial(), ...(perfil.avatar || {}) };
  const r = rango(perfil);
  const pend = estadoLogros(perfil).filter(l => !l.hecho).sort((a, b) => b.n / b.meta - a.n / a.meta)[0];
  return `<button class="panel tarjeta-av" id="ir-avatar">
    <span class="mini-av">${dibujarAvatar(av, 78, true)}</span>
    <span class="txt">
      <b>${esc(av.nombre || 'Tu personaje')}</b>
      <span class="rango">${esc(r.titulo)} · nivel ${r.nivel}</span>
      ${pend ? `<span class="prox">Próximo logro: ${esc(pend.nombre)} (${pend.n}/${pend.meta})</span>
        <span class="barra"><i class="m" style="width:${Math.round(pend.n / pend.meta * 100)}%"></i></span>` : '<span class="prox">Todos los logros conseguidos.</span>'}
    </span>
  </button>`;
}

/** Aviso flotante de logros nuevos. */
export function mostrarLogros(lista) {
  if (!lista?.length || typeof document === 'undefined') return;
  const caja = document.createElement('div');
  caja.className = 'toast-logro';
  caja.setAttribute('role', 'status');
  // de a muchos (progreso previo o sincronizacion) se resumen para no tapar la pantalla
  const vistos = lista.length > 2 ? lista.slice(0, 1) : lista;
  caja.innerHTML = vistos.map(l => {
    const p = PIEZAS.find(x => x.id === l.da);
    return `<div class="tl"><span class="ico">🏆</span><span><b>¡Logro: ${esc(l.nombre)}!</b><small>Desbloqueaste ${p ? `${p.ico} ${esc(p.nombre)}` : 'una pieza'}</small></span></div>`;
  }).join('') + (lista.length > vistos.length
    ? `<div class="tl"><span class="ico">✨</span><span><b>Y ${lista.length - vistos.length} logros más</b><small>Míralos en la pestaña Personaje</small></span></div>` : '');
  document.body.appendChild(caja);
  caja.addEventListener('click', () => caja.remove());
  setTimeout(() => caja.classList.add('sale'), 5200);
  setTimeout(() => caja.remove(), 5800);
}
