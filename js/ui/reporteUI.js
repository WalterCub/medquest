/**
 * reporteUI.js — boton "Reportar error" para preguntas y casos.
 *
 * El contenido lo redacta una persona a partir de normas oficiales; la fuente es
 * confiable, la interpretacion puede fallar. Este boton es la revision que se
 * hace mientras se estudia: queda en el dispositivo y se envia a Supabase al
 * iniciar sesion.
 */
import { esc } from './dom.js';

const MOTIVOS = [
  ['respuesta_incorrecta', 'La respuesta es incorrecta'],
  ['cita_no_respalda', 'La cita no respalda la respuesta'],
  ['ambigua', 'Es ambigua o hay más de una correcta'],
  ['error_tipeo', 'Error de escritura'],
  ['otro', 'Otro']
];

export function bloqueReporte(tipo, ref, perfil) {
  const ya = (perfil?.reportes || []).some(r => r.tipo === tipo && r.ref === ref);
  const que = tipo === 'pregunta' ? 'esta pregunta' : 'este caso';
  return `
  <div class="reporte" data-reporte>
    <button class="btn sm reportar" data-abrir-rep>⚠️ ${ya ? `Ya reportaste ${que} · reportar otra cosa` : `Reportar un error en ${que}`}</button>
    <div class="rep-form" hidden>
      <p class="nota" style="margin:.2rem 0 .5rem">¿Qué está mal en ${que}?</p>
      <div class="fila motivos">
        ${MOTIVOS.map(([k, t]) => `<button class="btn sm" data-motivo="${k}">${t}</button>`).join('')}
      </div>
      <textarea data-rep-texto placeholder="Detalle (opcional): qué dice la norma, qué opción debería ser, etc." style="min-height:4rem;margin-top:.6rem"></textarea>
      <div class="fila" style="margin-top:.5rem">
        <button class="btn sm uva" data-rep="${tipo}" data-ref="${esc(ref)}" disabled>Enviar reporte</button>
        <button class="btn sm" data-cancelar-rep>Cancelar</button>
      </div>
    </div>
  </div>`;
}

export function conectarReporte(cont, acc) {
  cont.querySelectorAll('[data-reporte]').forEach(caja => {
    const form = caja.querySelector('.rep-form');
    const enviar = caja.querySelector('[data-rep]');
    let motivo = null;
    caja.querySelector('[data-abrir-rep]').addEventListener('click', () => { form.hidden = !form.hidden; });
    caja.querySelector('[data-cancelar-rep]').addEventListener('click', () => { form.hidden = true; });
    caja.querySelectorAll('[data-motivo]').forEach(b => b.addEventListener('click', () => {
      motivo = b.dataset.motivo;
      caja.querySelectorAll('[data-motivo]').forEach(x => x.classList.toggle('act', x === b));
      enviar.disabled = false;
    }));
    enviar.addEventListener('click', () => {
      const detalle = caja.querySelector('[data-rep-texto]').value;
      const estado = acc.reportar(enviar.dataset.rep, enviar.dataset.ref, motivo, detalle);
      caja.innerHTML = `<p class="aviso" style="margin:0">${estado === 'enviado'
        ? '✅ Reporte enviado. Gracias: se revisa contra el PDF de la norma.'
        : '📥 Reporte guardado en este dispositivo. Se enviará cuando inicies sesión (Mapa → Tu cuenta).'}</p>`;
    });
  });
}
