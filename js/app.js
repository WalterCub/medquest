/**
 * app.js — cableado. Tiene el estado de la sesion y conecta motores con UI.
 *
 * DECISION ARQUITECTONICA
 * Los modulos de UI son funciones puras de render que reciben datos y un objeto
 * de acciones. No importan motores ni tocan el estado. Eso permite reemplazar
 * la capa visual sin tocar la logica, y probar los motores sin DOM.
 */

import { storage, hoy, alGuardar } from './services/storage.js';
import * as Cuenta from './services/sync.js';
import { cargarTodos, AREAS, porId } from './services/caseRepository.js';
import * as CE from './engine/caseEngine.js';
import * as TE from './engine/tribunalEngine.js';
import { evaluar } from './engine/scoringEngine.js';
import { elegirCaso, registrarResultado, conceptosPendientes } from './engine/learningEngine.js';
import * as RE from './engine/rewardEngine.js';
import { $, $$, mmss } from './ui/dom.js';
import * as Screens from './ui/screens.js';
import * as CaseUI from './ui/caseUI.js';
import * as TribunalUI from './ui/tribunalUI.js';
import * as ResultsUI from './ui/resultsUI.js';
import { cargarBanco } from './services/bancoRepository.js';
import * as QZ from './engine/quizEngine.js';
import * as QuizUI from './ui/quizUI.js';

const S = {
  perfil: null, casos: [], caso: null, partida: null,
  preguntas: [], indice: 0, revelado: false,
  resultado: null, recompensa: null, conceptosPrevios: [],
  pantalla: 'inicio', reloj: null,
  banco: null, ronda: null, recompensaRonda: null,
  borradorTribunal: '',
  cuenta: { fase: 'inicio', email: '', mensaje: '', ocupado: false }
};

const guardar = () => storage.guardar(S.perfil);

// ---------------- render ----------------
function pintarTop() {
  $('#kc').textContent = `${S.perfil.kamas} KC`;
  const r = RE.racha(S.perfil.dias);
  $('#racha').textContent = r ? `${r} ${r === 1 ? 'día' : 'días'}` : '';
}

function pintar() {
  pintarTop();
  $$('.pantalla').forEach(p => p.classList.toggle('on', p.id === 'p-' + S.pantalla));
  $$('nav.tabs button').forEach(b => {
    if (b.dataset.ir === S.pantalla) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  $('#reloj-band').style.display = (S.pantalla === 'partida' && S.partida && !S.partida.cerrado) ? '' : 'none';
  window.scrollTo(0, 0);

  const cont = $('#p-' + S.pantalla);
  switch (S.pantalla) {
    case 'inicio':   Screens.renderInicio(cont, S, acc); break;
    case 'perfil':   Screens.renderPerfil(cont, S, acc); break;
    case 'tienda':   Screens.renderTienda(cont, S, acc); break;
    case 'partida':  CaseUI.render(cont, S, acc); break;
    case 'tribunal': TribunalUI.render(cont, S, acc); break;
    case 'resultado': ResultsUI.render(cont, S, acc); break;
    case 'preguntas': QuizUI.render(cont, S, acc); break;
  }
}

function ir(p) { S.pantalla = p; pintar(); }

// ---------------- reloj ----------------
function arrancarReloj() {
  clearInterval(S.reloj);
  const limite = S.caso.tiempoSugeridoSeg || 1800;
  S.reloj = setInterval(() => {
    if (!S.partida || S.partida.cerrado) return clearInterval(S.reloj);
    const t = Math.round((Date.now() - S.partida.inicio) / 1000);
    const resta = limite - t;
    const el = $('#reloj');
    el.textContent = (resta < 0 ? '-' : '') + mmss(Math.abs(resta));
    el.classList.toggle('tarde', resta <= 300 && resta > 0);
    el.classList.toggle('fuera', resta <= 0);
  }, 1000);
}

// ---------------- acciones ----------------
const acc = {
  ir,

  jugar(filtro = {}) {
    let caso;
    if (filtro.demo) caso = S.casos.find(c => c.tipo === 'prueba');
    else caso = elegirCaso(S.casos, S.perfil, filtro);
    if (!caso) return;
    const niveles = caso.nivelesDisponibles || [1, 2, 3];
    let nivel = S.perfil.ajustes.nivelPreferido;
    if (!nivel || !niveles.includes(nivel)) nivel = niveles[Math.floor(Math.random() * niveles.length)];
    S.caso = caso;
    S.partida = CE.crearPartida(caso, nivel);
    S.conceptosPrevios = conceptosPendientes(S.perfil).map(k => k.id);
    S.preguntas = []; S.indice = 0; S.revelado = false; S.resultado = null;
    arrancarReloj();
    ir('partida');
  },

  fijarNivel(n) { S.perfil.ajustes.nivelPreferido = n; guardar(); pintar(); },

  declarar(grupo, texto) { CE.declarar(S.partida, grupo, texto); },
  revelar(grupo) { CE.revelar(S.caso, S.partida, grupo); pintar(); },
  estudio(clave) { CE.solicitarEstudio(S.caso, S.partida, clave); pintar(); },
  estudioLibre(nombre) { CE.solicitarEstudioLibre(S.caso, S.partida, nombre); pintar(); },
  proponer(campo, texto) { CE.proponer(S.partida, campo, texto); pintar(); },
  quitar(campo, texto) { CE.quitar(S.partida, campo, texto); pintar(); },

  abandonar() {
    if (!confirm('Abandonar la partida? No se guarda nada.')) return;
    clearInterval(S.reloj); S.partida = null; S.caso = null; ir('inicio');
  },

  cerrar() {
    if (!confirm('Al cerrar el caso tus decisiones quedan bloqueadas y pasas al tribunal. Seguro?')) return;
    clearInterval(S.reloj);
    CE.cerrarCaso(S.partida);
    S.preguntas = TE.construirInterrogatorio(S.caso, S.partida);
    S.indice = 0; S.revelado = false;
    ir('tribunal');
  },

  borradorTribunal(texto) { S.borradorTribunal = texto; },
  verEsperado() { S.revelado = true; pintar(); },

  responder(pregunta, valor) {
    TE.responder(S.partida, pregunta, valor, S.borradorTribunal);
    S.indice++; S.revelado = false; S.borradorTribunal = '';
    pintar();
  },

  terminarTribunal() {
    const r = evaluar(S.caso, S.partida);
    r.log = S.partida.decisionLog;
    S.resultado = r;

    const rec = RE.recompensar(S.perfil, S.caso, r, S.conceptosPrevios);
    S.recompensa = rec;

    registrarResultado(S.perfil, S.caso, r);
    S.perfil.kamas += rec.total;

    RE.avanzarMisiones(S.perfil, { tipo: 'jugar' });
    if (S.partida.tribunalRespuestas.length) RE.avanzarMisiones(S.perfil, { tipo: 'tribunal' });
    RE.avanzarMisiones(S.perfil, { tipo: 'defender', cantidad: S.partida.tribunalRespuestas.filter(x => x.autoevaluacion === 'completa').length });
    if (rec.corregidos) RE.avanzarMisiones(S.perfil, { tipo: 'repaso', cantidad: rec.corregidos });
    if (S.partida.nivel === 1) RE.avanzarMisiones(S.perfil, { tipo: 'provincia' });
    RE.avanzarMisiones(S.perfil, { tipo: 'debil' });

    S.misiones = RE.misionesDeHoy(S.perfil);
    guardar();
    ir('resultado');
  },

  cobrarMisiones() {
    const ms = RE.misionesDeHoy(S.perfil);
    if (!RE.misionesCompletas(ms) || ms.cobrada) return;
    ms.cobrada = true; S.perfil.kamas += RE.RECOMPENSA_MISIONES;
    guardar(); pintar();
  },

  canjear(id) {
    const p = RE.PREMIOS.find(x => x.id === id);
    if (!p || S.perfil.kamas < p.costo) return;
    S.perfil.kamas -= p.costo;
    S.perfil.canjes.push({ nombre: p.nombre, costo: p.costo, fecha: hoy(), estado: 'pendiente de entrega' });
    guardar(); pintar();
  },

  async exportar() {
    const txt = await storage.exportar();
    const blob = new Blob([txt], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `medquest-progreso-${hoy()}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  },
  tema() {
    const actual = document.documentElement.getAttribute('data-theme');
    const nuevo = actual === 'dark' ? 'light' : actual === 'light' ? null : 'dark';
    if (nuevo) document.documentElement.setAttribute('data-theme', nuevo);
    else document.documentElement.removeAttribute('data-theme');
    S.perfil.ajustes.tema = nuevo; guardar();
  },
  async borrar() {
    if (!confirm('Borrar todo el progreso, las Kamas y las recompensas? No se puede deshacer.')) return;
    S.perfil = await storage.borrarTodo();
    ir('inicio');
  },

  // ---------- banco de preguntas ----------
  empezarRonda(filtro = {}) {
    if (!S.banco) return;
    S.ronda = QZ.crearRonda(S.banco, S.perfil, filtro);
    S.recompensaRonda = null;
    if (!S.ronda.preguntas.length) S.ronda = null;
    ir('preguntas');
  },
  responderPregunta(i) {
    if (!S.ronda) return;
    QZ.responderPregunta(S.ronda, S.perfil, i);
    guardar(); pintar();
  },
  siguientePregunta() {
    if (!QZ.siguientePregunta(S.ronda)) {
      const res = QZ.resumenRonda(S.ronda);
      S.recompensaRonda = RE.recompensarRonda(S.perfil, res);
      S.perfil.kamas += S.recompensaRonda.total;
      if (!S.perfil.dias.includes(hoy())) S.perfil.dias.push(hoy());
      RE.avanzarMisiones(S.perfil, { tipo: 'preguntas' });
      guardar();
    }
    pintar();
  },
  salirRonda() { S.ronda = null; S.recompensaRonda = null; ir('preguntas'); },

  // ---------- cuenta y sincronizacion ----------
  async enviarCodigo(email) {
    const c = S.cuenta;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')) { c.mensaje = 'Escribe un correo válido.'; return pintar(); }
    c.email = email.trim(); c.ocupado = true; c.mensaje = ''; pintar();
    try {
      await Cuenta.enviarCodigo(c.email);
      c.fase = 'codigo';
      c.mensaje = 'Te llegó un correo con un enlace y un código. En la computadora toca el enlace; en la app del teléfono escribe el código aquí.';
      Cuenta.iniciarCuenta(alCambiarUsuario).catch(() => {});
    } catch (e) { c.mensaje = mensajeError(e); }
    c.ocupado = false; pintar();
  },
  async verificarCodigo(codigo) {
    const c = S.cuenta;
    c.ocupado = true; c.mensaje = ''; pintar();
    try { await Cuenta.verificarCodigo(c.email, codigo); await alCambiarUsuario(Cuenta.estadoCuenta.usuario); c.fase = 'inicio'; }
    catch (e) { c.mensaje = mensajeError(e); }
    c.ocupado = false; pintar();
  },
  volverACorreo() { S.cuenta.fase = 'inicio'; S.cuenta.mensaje = ''; pintar(); },
  async sincronizarAhora() {
    S.cuenta.ocupado = true; pintar();
    await aplicarSincronizacion();
    S.cuenta.ocupado = false; pintar();
  },
  async cerrarSesion() {
    await Cuenta.cerrarSesion();
    S.cuenta = { fase: 'inicio', email: '', mensaje: 'Sesión cerrada. El progreso sigue guardado en este dispositivo.', ocupado: false };
    pintar();
  },
  /** Devuelve 'enviado' si hay sesion (se envia en segundo plano) o 'cola' si queda guardado para despues. */
  reportar(tipo, ref, motivo, detalle) {
    S.perfil.reportes ||= [];
    S.perfil.reportes.push({ tipo, ref, motivo, detalle: (detalle || '').trim().slice(0, 2000), fecha: hoy(), enviado: false });
    guardar();
    if (!Cuenta.estadoCuenta.usuario) return 'cola';
    Cuenta.enviarReportes(S.perfil).then(n => { if (n) guardar(); }).catch(() => {});
    return 'enviado';
  },

  otra() { acc.jugar({}); },
  inicio() { ir('inicio'); }
};

// ---------------- cuenta ----------------
function mensajeError(e) {
  const codigo = e?.code || '';
  const m = String(e?.message || e || '');
  const porCodigo = {
    email_address_invalid: 'Ese correo no es válido. Revisa que esté bien escrito.',
    email_address_not_authorized: 'Este correo todavía no está habilitado para recibir el acceso: falta configurar el envío de correos en Supabase (ver README).',
    over_email_send_rate_limit: 'Se pidieron demasiados correos seguidos. Espera unos minutos y vuelve a intentar.',
    over_request_rate_limit: 'Demasiados intentos seguidos. Espera un minuto.',
    otp_expired: 'El código ya venció o no es correcto. Pide uno nuevo.'
  };
  if (porCodigo[codigo]) return porCodigo[codigo];
  if (/not authorized/i.test(m)) return porCodigo.email_address_not_authorized;
  if (/fetch|network|Failed to load|import/i.test(m)) return 'Sin conexión. Tu progreso sigue guardado en este dispositivo.';
  return 'No se pudo completar: ' + m;
}

async function aplicarSincronizacion() {
  try {
    const elegido = await Cuenta.sincronizar(S.perfil);
    if (elegido !== S.perfil) { S.perfil = await storage.reemplazar(elegido); }
    else if ((S.perfil.reportes || []).some(r => r.enviado)) await storage.reemplazar(S.perfil);
  } catch (e) { Cuenta.estadoCuenta.error = mensajeError(e); }
}

async function alCambiarUsuario(usuario) {
  if (usuario) await aplicarSincronizacion();
  pintar();
}

// ---------------- arranque ----------------
async function iniciar() {
  S.perfil = await storage.cargar();
  if (S.perfil.ajustes.tema) document.documentElement.setAttribute('data-theme', S.perfil.ajustes.tema);
  S.casos = await cargarTodos();
  try { S.banco = await cargarBanco(); } catch { S.banco = { preguntas: [], fuentes: {} }; }
  S.misiones = RE.misionesDeHoy(S.perfil);
  await guardar();
  alGuardar(p => Cuenta.subirLuego(p));
  if (Cuenta.haySesionGuardada()) {
    Cuenta.iniciarCuenta(alCambiarUsuario).then(u => u && alCambiarUsuario(u)).catch(() => {});
  }

  $$('nav.tabs button').forEach(b => b.addEventListener('click', () => {
    if (S.partida && !S.partida.cerrado && b.dataset.ir !== 'partida') {
      if (!confirm('Tienes una partida abierta. Salir la abandona.')) return;
      clearInterval(S.reloj); S.partida = null; S.caso = null;
    }
    ir(b.dataset.ir);
  }));

  pintar();
}

// instalable y sin conexion; solo servido por http(s), no en el archivo unico abierto desde disco
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.MEDQUEST_CASOS) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// exportamos el proxy como objeto de acciones para la UI
window.MedQuest = { S, acc };
iniciar();

export { S, acc as acciones };
