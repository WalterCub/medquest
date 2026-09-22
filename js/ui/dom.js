/** dom.js — utilidades minimas de render. Sin framework a proposito. */
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const li = arr => (arr || []).map(x => `<li>${esc(x)}</li>`).join('');
export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
export const mmss = seg => `${Math.floor(seg / 60)}:${String(Math.abs(seg) % 60).padStart(2, '0')}`;
export function on(raiz, sel, fn) { $$(sel, raiz).forEach(el => el.addEventListener('click', () => fn(el))); }
export const clase = pct => pct >= 80 ? 'b' : pct >= 50 ? 'm' : 'x';
