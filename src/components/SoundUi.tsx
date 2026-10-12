import { useId } from 'react';
import { Icon } from './icons';
import { playSound, useLabSound } from '../lib/sound';

/** Botón del encabezado para activar o silenciar todos los sonidos del laboratorio. */
export function SoundToggle() {
  const s = useLabSound();
  if (!s.supported) return null;
  return (
    <button
      type="button"
      className="btn small ghost theme-toggle sound-toggle"
      aria-pressed={s.enabled}
      aria-label="Sonido"
      title={s.enabled ? 'Sonido activado: pulsa para silenciar' : 'Sonido desactivado: pulsa para activar'}
      onClick={() => { const on = !s.enabled; s.setEnabled(on); if (on) playSound('click'); }}
    >
      <Icon name={s.enabled ? 'sonido' : 'silencio'} size={18} />
    </button>
  );
}

/** Ajustes de sonido para la página de ayuda y accesibilidad. */
export function SoundSettingsPanel() {
  const s = useLabSound();
  const id = useId();
  const pct = Math.round(s.volume * 100);
  if (!s.supported) return <p className="small muted">Este navegador no permite reproducir los sonidos del laboratorio.</p>;
  return (
    <div className="stack-sm">
      <label className="check"><input type="checkbox" checked={s.enabled} onChange={(e) => { s.setEnabled(e.target.checked); if (e.target.checked) playSound('glassClink'); }} /> Sonidos de laboratorio</label>
      <label htmlFor={`${id}-vol`}>Volumen de los sonidos: <strong>{pct} %</strong></label>
      <input
        id={`${id}-vol`} type="range" min={0} max={100} step={5} value={pct} disabled={!s.enabled}
        aria-valuetext={`${pct} %`}
        onChange={(e) => s.setVolume(Number(e.target.value) / 100)}
        onPointerUp={() => playSound('glassClink')}
        onKeyUp={() => playSound('click')}
      />
      <p className="small muted">
        Los sonidos (vidrio, líquidos, interruptores, pitidos de los equipos…) se generan en el navegador y acompañan
        lo que se ve en pantalla: nunca son la única forma de recibir una información. Los sonidos continuos solo
        suenan mientras la acción está en curso y se detienen al cambiar de pestaña. Puedes silenciarlos en
        cualquier momento con el botón «Sonido» del encabezado.
      </p>
    </div>
  );
}
