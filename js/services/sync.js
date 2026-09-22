/**
 * sync.js — cuenta (enlace magico o codigo por correo) y sincronizacion del perfil.
 *
 * DECISIONES ARQUITECTONICAS
 *
 * 1. LOCAL PRIMERO. El juego nunca espera a la red: storage.js sigue siendo la
 *    unica puerta de datos y todo funciona sin cuenta y sin conexion. Este
 *    modulo solo copia el perfil a Supabase cuando hay sesion.
 *
 * 2. ENLACE Y CODIGO. En el iPhone, la app instalada en la pantalla de inicio no
 *    comparte sesion con Safari: el enlace del correo abre Safari y la sesion
 *    queda ahi. Por eso el mismo correo trae un codigo de 6 digitos que se
 *    escribe dentro de la app. En la computadora basta con el enlace. El flujo
 *    es "implicit" para que el enlace funcione aunque se abra en otro navegador.
 *
 * 3. GANA EL MAS RECIENTE. Si el perfil local y el de la nube difieren, se queda
 *    el que se guardo ultimo (campo actualizado). Excepcion: un perfil local
 *    vacio nunca pisa uno de la nube. Jugar en dos dispositivos a la vez sin
 *    conexion puede perder la partida de uno; es el costo de no tener servidor.
 *
 * 4. La libreria de Supabase se carga recien cuando hace falta (import dinamico
 *    desde el CDN): quien juega sin cuenta no la descarga.
 */

const SUPABASE_URL = 'https://fcbcfkxpbwuzrbcbkrzz.supabase.co';
const SUPABASE_CLAVE = 'sb_publishable_nzaS_MRYdJvOe2uUXMVvdA_jgBHgFcM';   // publica por diseno; los datos los protege RLS
const LIBRERIA = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

let cliente = null;
async function sb() {
  if (!cliente) {
    const { createClient } = await import(LIBRERIA);
    cliente = createClient(SUPABASE_URL, SUPABASE_CLAVE, {
      auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
    });
  }
  return cliente;
}

export const estadoCuenta = { usuario: null, sincronizado: null, error: null };

/** Recupera la sesion (tambien la que trae un enlace magico en la URL) y avisa cada cambio. */
export async function iniciarCuenta(alCambiar) {
  const c = await sb();
  const { data } = await c.auth.getSession();
  estadoCuenta.usuario = data.session?.user || null;
  if (location.hash.includes('access_token')) history.replaceState(null, '', location.pathname);
  c.auth.onAuthStateChange((_evento, sesion) => {
    const antes = estadoCuenta.usuario?.id;
    estadoCuenta.usuario = sesion?.user || null;
    if (antes !== estadoCuenta.usuario?.id) alCambiar(estadoCuenta.usuario);
  });
  return estadoCuenta.usuario;
}

/** Hay sesion guardada de antes? Evita cargar la libreria si nunca se inicio sesion. */
export function haySesionGuardada() {
  try { return Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token')) || location.hash.includes('access_token'); }
  catch { return false; }
}

export async function enviarCodigo(email) {
  const c = await sb();
  const { error } = await c.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: location.origin + location.pathname }
  });
  if (error) throw error;
}

export async function verificarCodigo(email, codigo) {
  const c = await sb();
  const { data, error } = await c.auth.verifyOtp({ email: email.trim(), token: codigo.trim(), type: 'email' });
  if (error) throw error;
  estadoCuenta.usuario = data.user;
  return data.user;
}

export async function cerrarSesion() {
  const c = await sb();
  await c.auth.signOut();
  estadoCuenta.usuario = null;
  estadoCuenta.sincronizado = null;
}

const vacio = p => !p.partidas?.length && !Object.keys(p.preguntas || {}).length && !p.kamas;

/** Devuelve el perfil con el que hay que quedarse y deja la nube al dia. */
export async function sincronizar(local) {
  if (!estadoCuenta.usuario) return local;
  const c = await sb();
  const uid = estadoCuenta.usuario.id;
  const { data: remoto, error } = await c.from('perfiles').select('datos, actualizado').eq('user_id', uid).maybeSingle();
  if (error) { estadoCuenta.error = error.message; return local; }

  let elegido = local;
  if (remoto && (vacio(local) || (remoto.datos.actualizado || '') > (local.actualizado || ''))) elegido = remoto.datos;
  if (elegido === local) await subir(local);
  else estadoCuenta.sincronizado = new Date();
  await enviarReportes(elegido);
  return elegido;
}

let pendiente = null;
/** Sube el perfil; si se llama muchas veces seguidas, sube una sola vez. */
export function subirLuego(perfil) {
  if (!estadoCuenta.usuario) return;
  clearTimeout(pendiente);
  pendiente = setTimeout(() => subir(perfil).catch(() => {}), 1500);
}

async function subir(perfil) {
  if (!estadoCuenta.usuario) return;
  const c = await sb();
  const { error } = await c.from('perfiles').upsert({
    user_id: estadoCuenta.usuario.id, datos: perfil, actualizado: perfil.actualizado || new Date().toISOString()
  });
  estadoCuenta.error = error ? error.message : null;
  if (!error) estadoCuenta.sincronizado = new Date();
}

/** Envia los reportes de error que quedaron en cola en el perfil. Marca los enviados. */
export async function enviarReportes(perfil) {
  const cola = (perfil.reportes || []).filter(r => !r.enviado);
  if (!cola.length || !estadoCuenta.usuario) return 0;
  const c = await sb();
  const { error } = await c.from('reportes').insert(cola.map(r => ({ tipo: r.tipo, ref: r.ref, motivo: r.motivo || null, detalle: r.detalle || null })));
  if (error) { estadoCuenta.error = error.message; return 0; }
  cola.forEach(r => { r.enviado = true; });
  return cola.length;
}
