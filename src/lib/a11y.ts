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
