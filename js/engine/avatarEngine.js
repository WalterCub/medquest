/**
 * avatarEngine.js — personaje, logros y sets cosmeticos.
 *
 * DECISIONES ARQUITECTONICAS
 *
 * 1. Las piezas NO se compran con Kamas. Las Kamas valen porque se cambian por
 *    recompensas reales; si tambien compraran sombreros, competirian con ellas.
 *    Cada pieza se gana con un logro, y cada logro premia una conducta de
 *    estudio (racha, corregir lo fallado, jugar en primer nivel...), no solo
 *    jugar mucho.
 *
 * 2. Los logros se calculan desde el perfil, no se guardan como eventos. Si el
 *    perfil ya cumple la condicion (progreso anterior a esta version, otro
 *    dispositivo), el logro aparece solo. perfil.logros guarda la fecha en que
 *    se vio por primera vez, para avisar una sola vez.
 *
 * 3. Motor puro: sin DOM. El dibujo esta en ui/avatarUI.js.
 */

import { hoy } from '../services/storage.js';
import { racha, nivel } from './rewardEngine.js';

export const RANURAS = ['cabeza', 'cuerpo', 'cuello', 'mano', 'companero'];
export const NOMBRE_RANURA = { cabeza: 'Cabeza', cuerpo: 'Cuerpo', cuello: 'Cuello', mano: 'Mano', companero: 'Compañero' };

export const SETS = [
  { id: 'madrugador', nombre: 'Set del Interno Madrugador', lema: 'Para quien llega antes que el café.' },
  { id: 'aventurero', nombre: 'Set del Médico Aventurero', lema: 'Recorre cada especialidad y cada rincón del país.' },
  { id: 'sabio', nombre: 'Set del Sabio de la Norma', lema: 'Cada respuesta, con su página y su cita.' },
  { id: 'investidura', nombre: 'Investidura del Médico Cirujano', lema: 'El atuendo de quien ya está listo para el grado.', serio: true }
];

export const PIEZAS = [
  // madrugador
  { id: 'gorro',       set: 'madrugador',  ranura: 'cabeza',    nombre: 'Gorro Quirúrgico de la Primera Guardia', ico: '🧢' },
  { id: 'pijama',      set: 'madrugador',  ranura: 'cuerpo',    nombre: 'Pijama del Turno Eterno',                ico: '👕' },
  { id: 'termo',       set: 'madrugador',  ranura: 'mano',      nombre: 'Termo de Café Inagotable',               ico: '☕' },
  // aventurero
  { id: 'frontoscopio', set: 'aventurero', ranura: 'cabeza',    nombre: 'Frontoscopio del Explorador',            ico: '🪞' },
  { id: 'bata',        set: 'aventurero',  ranura: 'cuerpo',    nombre: 'Bata del Médico Aventurero',             ico: '🥼' },
  { id: 'esteto',      set: 'aventurero',  ranura: 'cuello',    nombre: 'Estetoscopio del Aventurero',            ico: '🩺' },
  { id: 'maletin',     set: 'aventurero',  ranura: 'mano',      nombre: 'Maletín de las Mil Visitas',             ico: '💼' },
  { id: 'hemito',      set: 'aventurero',  ranura: 'companero', nombre: 'Hemito, Glóbulo Rojo Leal',              ico: '🔴' },
  // sabio
  { id: 'gafas',       set: 'sabio',       ranura: 'cabeza',    nombre: 'Gafas del Lector Incansable',            ico: '👓' },
  { id: 'linterna',    set: 'sabio',       ranura: 'cuello',    nombre: 'Linterna de Pupilas Reactivas',          ico: '🔦' },
  { id: 'norma',       set: 'sabio',       ranura: 'mano',      nombre: 'Tomo Sagrado de la Norma',               ico: '📘' },
  { id: 'buho',        set: 'sabio',       ranura: 'companero', nombre: 'Búho de la Guardia Nocturna',            ico: '🦉' },
  // investidura
  { id: 'birrete',     set: 'investidura', ranura: 'cabeza',    nombre: 'Birrete de Grado',                       ico: '🎓' },
  { id: 'batalarga',   set: 'investidura', ranura: 'cuerpo',    nombre: 'Bata Larga Bordada',                     ico: '🥼' },
  { id: 'dobleesteto', set: 'investidura', ranura: 'cuello',    nombre: 'Estetoscopio de Doble Campana',          ico: '🩺' },
  { id: 'titulo',      set: 'investidura', ranura: 'mano',      nombre: 'Título de Médico Cirujano',              ico: '📜' }
];

// ---------- lo que se mide del perfil ----------
const mejorRacha = (dias) => {
  const orden = [...new Set(dias)].sort();
  let mejor = 0, act = 0, prev = null;
  for (const d of orden) {
    const t = new Date(d + 'T00:00:00').getTime();
    act = prev != null && (t - prev) <= 1.5 * 86400000 ? act + 1 : 1;   // dias consecutivos; la racha actual (indulgente) va aparte
    mejor = Math.max(mejor, act); prev = t;
  }
  return Math.max(mejor, racha(dias));
};

export function medidas(perfil) {
  const pr = Object.values(perfil.preguntas || {});
  const cont = perfil.contadores || {};
  const partidas = (perfil.partidas || []).filter(p => p.area !== 'DEMO');   // el caso de prueba no cuenta
  return {
    casos: partidas.length,
    areas: new Set(partidas.map(p => p.area).filter(Boolean)).size,
    nivel1: partidas.filter(p => p.nivel === 1).length,
    casos90: Object.entries(perfil.casos || {}).filter(([id, c]) => !id.startsWith('DEMO') && (c.mejorPuntaje || 0) >= 90).length,
    rondas: cont.rondas || 0,
    rondasPerfectas: cont.rondasPerfectas || 0,
    tribunales: cont.tribunales || 0,
    misiones: cont.misiones || 0,
    aciertos: pr.reduce((s, r) => s + (r.aciertos || 0), 0),
    vistas: pr.length,
    corregidos: Object.values(perfil.conceptos || {}).filter(c => c.fallos > 0 && c.aciertos >= c.fallos).length,
    racha: mejorRacha(perfil.dias || [])
  };
}

/**
 * Nombres al estilo de los juegos de rol; la condicion siempre es una conducta
 * de estudio concreta. `da` es la pieza que desbloquea.
 */
export const LOGROS = [
  { id: 'primer-turno',   nombre: 'Primer Turno',                  texto: 'Completa tu primer caso clínico',           med: 'casos',           meta: 1,   da: 'gorro' },
  { id: 'bautizo',        nombre: 'Bautizo de Preguntas',          texto: 'Completa tu primera ronda de preguntas',     med: 'rondas',          meta: 1,   da: 'pijama' },
  { id: 'tres-soles',     nombre: 'Tres Soles Seguidos',           texto: 'Estudia 3 días seguidos',                   med: 'racha',           meta: 3,   da: 'termo' },
  { id: 'explorador',     nombre: 'Explorador de Especialidades',  texto: 'Juega casos de 4 áreas distintas',          med: 'areas',           meta: 4,   da: 'bata' },
  { id: 'oido-fino',      nombre: 'Oído Fino',                     texto: 'Suma 50 respuestas correctas en Preguntas (repetir también cuenta)', med: 'aciertos',        meta: 50,  da: 'esteto' },
  { id: 'provincia',      nombre: 'Médico de Provincia',           texto: 'Juega 3 casos en primer nivel',             med: 'nivel1',          meta: 3,   da: 'maletin' },
  { id: 'semana',         nombre: 'La Semana Invicta',             texto: 'Estudia 7 días seguidos',                   med: 'racha',           meta: 7,   da: 'frontoscopio' },
  { id: 'defensor',       nombre: 'Defensor ante el Tribunal',     texto: 'Enfrenta 5 tribunales completos',           med: 'tribunales',      meta: 5,   da: 'hemito' },
  { id: 'impecable',      nombre: 'Ronda Impecable',               texto: 'Termina una ronda con 10 de 10',            med: 'rondasPerfectas', meta: 1,   da: 'gafas' },
  { id: 'corrector',      nombre: 'Corrector de Destinos',         texto: 'Corrige 5 conceptos que antes fallabas',    med: 'corregidos',      meta: 5,   da: 'linterna' },
  { id: 'lector',         nombre: 'Lector de la Norma',            texto: 'Responde 150 preguntas distintas del banco', med: 'vistas',         meta: 150, da: 'norma' },
  { id: 'misionero',      nombre: 'Guardián de las Misiones',      texto: 'Cobra las misiones diarias 10 veces',       med: 'misiones',        meta: 10,  da: 'buho' },
  { id: 'cien-batallas',  nombre: 'Veterano de Treinta Guardias',  texto: 'Completa 30 casos clínicos',                med: 'casos',           meta: 30,  da: 'batalarga' },
  { id: 'maestro-banco',  nombre: 'Maestro del Banco',             texto: 'Suma 400 respuestas correctas en Preguntas (repetir también cuenta)', med: 'aciertos',        meta: 400, da: 'dobleesteto' },
  { id: 'dominio',        nombre: 'Dominio Clínico',               texto: 'Saca 90% o más en 6 casos distintos',       med: 'casos90',         meta: 6,   da: 'titulo' },
  { id: 'juramento',      nombre: 'La Racha del Juramento',        texto: 'Estudia 21 días seguidos',                  med: 'racha',           meta: 21,  da: 'birrete' }
];

export const pieza = (id) => PIEZAS.find(p => p.id === id);
export const logroDePieza = (id) => LOGROS.find(l => l.da === id);

/** Estado de todos los logros: { ...logro, n, hecho }. */
export function estadoLogros(perfil) {
  const m = medidas(perfil);
  return LOGROS.map(l => ({ ...l, n: Math.min(l.meta, m[l.med] || 0), hecho: (m[l.med] || 0) >= l.meta }));
}

export function piezasDesbloqueadas(perfil) {
  return new Set(estadoLogros(perfil).filter(l => l.hecho).map(l => l.da));
}

/**
 * Registra los logros recien cumplidos y devuelve cuales son (para avisar).
 * Muta perfil.logros. Idempotente.
 */
export function revisarLogros(perfil) {
  perfil.logros ||= {};
  const nuevos = estadoLogros(perfil).filter(l => l.hecho && !perfil.logros[l.id]);
  for (const l of nuevos) perfil.logros[l.id] = hoy();
  return nuevos;
}

/** Sets completos equipados (bonus de set, solo visual). */
export function setsCompletos(equipado) {
  const puestos = new Set(Object.values(equipado || {}));
  return SETS.filter(s => PIEZAS.filter(p => p.set === s.id).every(p => puestos.has(p.id)));
}

export function equipar(perfil, piezaId) {
  const p = pieza(piezaId);
  if (!p || !piezasDesbloqueadas(perfil).has(piezaId)) return false;
  const eq = (perfil.avatar ||= avatarInicial()).equipado ||= {};
  if (eq[p.ranura] === piezaId) delete eq[p.ranura];
  else eq[p.ranura] = piezaId;
  return true;
}

/** Equipa todas las piezas desbloqueadas de un set. */
export function equiparSet(perfil, setId) {
  const libres = piezasDesbloqueadas(perfil);
  const eq = (perfil.avatar ||= avatarInicial()).equipado ||= {};
  for (const p of PIEZAS.filter(x => x.set === setId && libres.has(x.id))) eq[p.ranura] = p.id;
}

// ---------- apariencia ----------
export const PIELES = ['#FFE0C7', '#F2C29B', '#D39A6A', '#A26B43', '#6E4529'];
export const PELOS = ['#2B1D14', '#5A3A22', '#A0612B', '#E0B45A', '#C2410C', '#6B5B95'];
export const PEINADOS = ['corto', 'largo', 'rulos', 'coleta'];

export const avatarInicial = () => ({ nombre: '', piel: 1, pelo: 0, peinado: 0, equipado: {} });

/** Rango segun el nivel que ya existe (derivado de las Kamas ganadas). */
export function rango(perfil) {
  const n = nivel((perfil.kamas || 0) + (perfil.canjes || []).reduce((s, c) => s + c.costo, 0));
  const r = n >= 12 ? 'Especialista' : n >= 8 ? 'Residente' : n >= 5 ? 'Interno' : n >= 3 ? 'Estudiante de clínica' : 'Estudiante';
  return { nivel: n, titulo: r };
}
