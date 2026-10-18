import type { KeyboardEvent } from 'react';

/**
 * Navegación por teclado en listas de pestañas (patrón WAI-ARIA):
 * flechas izquierda/derecha, Inicio y Fin mueven el foco y activan la pestaña.
 */
export function onTabListKeyDown(e: KeyboardEvent<HTMLElement>) {
  const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
  if (!keys.includes(e.key)) return;
  const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'));
  if (tabs.length === 0) return;
  const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
  let next = current;
  if (e.key === 'ArrowRight') next = (current + 1) % tabs.length;
  if (e.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
  if (e.key === 'Home') next = 0;
  if (e.key === 'End') next = tabs.length - 1;
  e.preventDefault();
  tabs[next].focus();
  tabs[next].click();
}

const SCROLL_REGIONS = '.bench, .table-wrap';
const AUTO = 'data-auto-scroll-focus';

/** Una zona que se desplaza a lo ancho o a lo alto debe poder recibir el foco para moverla con el teclado (WCAG 2.1.1). */
function syncScrollRegion(el: HTMLElement) {
  const scrolls = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
  if (scrolls && !el.hasAttribute('tabindex')) {
    el.setAttribute('tabindex', '0');
    el.setAttribute(AUTO, '');
    if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) {
      el.setAttribute('role', 'region');
      el.setAttribute('aria-label', el.classList.contains('bench') ? 'Banco de trabajo (desplazable con las flechas)' : 'Tabla (desplazable con las flechas)');
    }
  } else if (!scrolls && el.hasAttribute(AUTO)) {
    el.removeAttribute('tabindex');
    el.removeAttribute(AUTO);
    if (el.getAttribute('role') === 'region') { el.removeAttribute('role'); el.removeAttribute('aria-label'); }
  }
}

/**
 * Vigila el documento y vuelve enfocables con el teclado los bancos de trabajo y las tablas solo mientras se
 * desbordan (por ejemplo, en un teléfono). Se instala una vez, al arrancar la aplicación.
 */
export function initScrollRegionFocus(root: HTMLElement = document.body) {
  if (typeof ResizeObserver === 'undefined' || typeof MutationObserver === 'undefined') return;
  const watched = new WeakSet<HTMLElement>();
  const resize = new ResizeObserver((entries) => { for (const e of entries) syncScrollRegion(e.target as HTMLElement); });
  const scan = () => {
    root.querySelectorAll<HTMLElement>(SCROLL_REGIONS).forEach((el) => {
      if (!watched.has(el)) { watched.add(el); resize.observe(el); }
      syncScrollRegion(el);
    });
  };
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(); });
  }).observe(root, { childList: true, subtree: true });
  scan();
}
