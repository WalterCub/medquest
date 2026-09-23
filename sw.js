/**
 * sw.js — permite instalar MedQuest en el telefono y usarlo sin conexion.
 *
 * DECISION ARQUITECTONICA
 * Red primero, cache de respaldo. Con conexion siempre se sirve la version
 * recien desplegada (un caso corregido llega sin hacer nada); sin
 * conexion se sirve la ultima copia guardada. Cache primero seria mas rapido,
 * pero obligaria a versionar a mano cada despliegue y un olvido dejaria a quien
 * estudia con una rubrica vieja.
 *
 * "Red" significa red de verdad: se pide con cache 'no-cache' para que el
 * navegador revalide cada archivo. Sin eso, la cache HTTP (GitHub Pages da 10
 * minutos) podia mezclar el index.html nuevo con JS o CSS viejos justo despues
 * de un despliegue, y una pantalla nueva quedaba a medio cargar.
 */
const CACHE = 'medquest-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then(res => {
        if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('./')))
  );
});
