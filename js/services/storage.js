/**
 * storage.js — unica puerta de salida de datos persistentes.
 *
 * DECISION ARQUITECTONICA
 * Ningun otro modulo toca localStorage directamente. Toda lectura y escritura
 * pasa por aqui, con una firma asincrona aunque hoy sea sincrona. Cuando se
 * migre a Supabase solo cambia este archivo: el resto del codigo ya hace await.
 *
 * El perfil tiene version. Si mas adelante cambia la forma de los datos, se
 * agrega una migracion en migrar() y no se pierde el progreso.
 */

const CLAVE = 'medquest.perfil.v1';
const VERSION = 1;

const perfilVacio = () => ({
  version: VERSION,
  kamas: 0,
  dias: [],                 // 'YYYY-MM-DD' con actividad
  partidas: [],             // resumen por partida cerrada
  casos: {},                // casoId -> { veces, ultima, mejorPuntaje, ultimoPuntaje }
  conceptos: {},            // conceptoId -> { fallos, aciertos, ultima, enunciado, casoId }
  areas: {},                // area -> { partidas, sumaPuntaje }
  misiones: { fecha: null, lista: [], cobrada: false },
  premios: [],              // { id, nombre, costo }
  canjes: [],               // { nombre, costo, fecha, estado }
  preguntas: {},            // preguntaId -> { aciertos, fallos, racha, ultima } (banco)
  reportes: [],             // { tipo, ref, detalle, fecha, enviado } errores reportados desde la app
  actualizado: null,        // ISO; decide que copia gana al sincronizar con la nube
  ajustes: { nivelPreferido: null, tema: null }
});

function migrar(p) {
  if (!p || typeof p !== 'object') return perfilVacio();
  // Sin migraciones todavia. Al cambiar VERSION, encadenar aqui.
  return Object.assign(perfilVacio(), p, { version: VERSION });
}

let cache = null;
const oyentes = [];

/** Avisa cada vez que se guarda (lo usa sync.js para copiar a la nube). */
export function alGuardar(fn) { oyentes.push(fn); }

export const storage = {
  async cargar() {
    if (cache) return cache;
    let bruto = null;
    try { bruto = JSON.parse(localStorage.getItem(CLAVE)); } catch { bruto = null; }
    cache = migrar(bruto);
    return cache;
  },

  async guardar(perfil) {
    cache = perfil;
    perfil.actualizado = new Date().toISOString();
    oyentes.forEach(fn => { try { fn(perfil); } catch {} });
    try { localStorage.setItem(CLAVE, JSON.stringify(perfil)); return true; }
    catch { return false; }   // cuota llena o almacenamiento bloqueado: la partida sigue en memoria
  },

  /** Reemplaza el perfil local por otro (el de la nube) sin marcarlo como recien modificado. */
  async reemplazar(perfil) {
    cache = migrar(perfil);
    try { localStorage.setItem(CLAVE, JSON.stringify(cache)); } catch {}
    return cache;
  },

  async borrarTodo() {
    cache = null;
    try { localStorage.removeItem(CLAVE); } catch {}
    return this.cargar();
  },

  async exportar() {
    const p = await this.cargar();
    return JSON.stringify(p, null, 2);
  },

  async importar(texto) {
    const p = migrar(JSON.parse(texto));
    await this.guardar(p);
    return p;
  }
};

export const hoy = () => new Date().toLocaleDateString('sv');   // YYYY-MM-DD local
