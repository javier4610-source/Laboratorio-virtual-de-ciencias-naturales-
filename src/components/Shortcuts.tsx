import { useEffect, useId, useRef, useState } from 'react';
import { SHORTCUTS, requestCatalogSearchFocus, setShortcutsEnabled, shortcutsEnabled, useShortcuts } from '../lib/shortcuts';
import { href, navigate } from '../lib/router';
import { Icon } from './icons';

export function ShortcutList({ compact }: { compact?: boolean }) {
  const groups: { scope: 'global' | 'practica'; title: string }[] = [
    { scope: 'global', title: 'En toda la plataforma' },
    { scope: 'practica', title: 'Dentro de una práctica' },
  ];
  return (
    <div className={`shortcut-groups${compact ? ' compact' : ''}`}>
      {groups.map((g) => (
        <section key={g.scope} className="shortcut-group">
          <h3>{g.title}</h3>
          <dl className="shortcut-list">
            {SHORTCUTS.filter((s) => s.scope === g.scope).map((s) => (
              <div key={s.keys}>
                <dt>{s.keys.split(' ').map((k, i) => (k === '…' || k === '/' && s.keys.includes(' / ') ? <span key={i} className="kbd-sep">{k}</span> : <kbd key={i}>{k}</kbd>))}</dt>
                <dd>{s.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <p className="small muted">Los atajos no actúan mientras escribes en un campo ni cuando el foco está en la escena del laboratorio, donde las teclas manejan los instrumentos.</p>
    </div>
  );
}

/** Interruptor para desactivar los atajos de una tecla (WCAG 2.1.4). */
export function ShortcutToggle() {
  const [on, setOn] = useState(shortcutsEnabled);
  return (
    <label className="check">
      <input type="checkbox" checked={on} onChange={(e) => { setShortcutsEnabled(e.target.checked); setOn(e.target.checked); }} />
      Activar los atajos de una tecla (<kbd>?</kbd> muestra la lista)
    </label>
  );
}

/**
 * Atajos globales (montado una vez en App): «?» abre la lista y «/» lleva a la búsqueda del catálogo.
 * El diálogo es un <dialog> nativo (atrapa el foco y se cierra con Escape).
 */
export function GlobalShortcuts() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { try { d.showModal(); } catch { d.setAttribute('open', ''); } }
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('lvcn:atajos', onOpen);
    return () => window.removeEventListener('lvcn:atajos', onOpen);
  }, []);
  useShortcuts({
    '?': () => setOpen((v) => !v),
    '/': () => {
      const field = document.getElementById('cat-q') as HTMLInputElement | null;
      if (field) { field.focus(); return; }
      // El catálogo enfoca la búsqueda al montarse (después de que el enrutador mueva el foco al contenido).
      requestCatalogSearchFocus();
      navigate(href('catalogo'));
    },
  });
  return (
    <dialog ref={ref} className="dialog shortcuts-dialog" aria-labelledby={titleId} onClose={() => setOpen(false)}
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      {open && (
        <div className="dialog-body stack">
          <div className="dialog-head">
            <h2 id={titleId}><Icon name="teclado" size={22} />Atajos de teclado</h2>
            <button type="button" className="btn small ghost" onClick={() => setOpen(false)} aria-label="Cerrar"><Icon name="cerrar" size={18} /></button>
          </div>
          <ShortcutList compact />
          <ShortcutToggle />
        </div>
      )}
    </dialog>
  );
}

/** Botón que abre la lista de atajos (para quien no conoce la tecla «?»). */
export function ShortcutsButton({ className = 'btn small ghost' }: { className?: string }) {
  return (
    <button type="button" className={className} aria-haspopup="dialog" aria-label="Atajos de teclado" onClick={() => window.dispatchEvent(new Event('lvcn:atajos'))}>
      <Icon name="teclado" size={17} /><span className="label">Atajos</span>
    </button>
  );
}
