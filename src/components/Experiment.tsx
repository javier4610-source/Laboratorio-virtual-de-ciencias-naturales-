import { useId, type ReactNode } from 'react';
import { fmt } from '../lib/format';
import { Icon } from './icons';

/* ==========================================================================
   Componentes experimentales compartidos (ADR 0007). No calculan nada del
   modelo: reciben el estado del laboratorio y lo presentan de forma uniforme.
   Guía de adopción: docs/v2/SISTEMA-DE-DISENO.md, sección «Experiencia
   experimental».
   ========================================================================== */

/* ------------------------------------------------------------------ simulación */

export type SimStatus = 'listo' | 'en-curso' | 'en-pausa' | 'terminado';

const SIM_STATUS_TEXT: Record<SimStatus, string> = {
  listo: 'Lista para iniciar',
  'en-curso': 'En curso',
  'en-pausa': 'En pausa',
  terminado: 'Terminada',
};

/**
 * Estado de la barra a partir de lo que ya lleva el laboratorio: si el tiempo avanza, si ya empezó (t > 0 o una
 * fase iniciada) y si terminó. «Terminada» tiene prioridad; luego «En curso»; luego «En pausa» si ya empezó.
 */
export function simStatusOf(running: boolean, started: boolean, finished = false): SimStatus {
  if (finished && !running) return 'terminado';
  if (running) return 'en-curso';
  return started ? 'en-pausa' : 'listo';
}

/** Texto del estado que se anuncia (role="status"). */
export function simStatusText(status: SimStatus): string { return SIM_STATUS_TEXT[status]; }

/**
 * Acción del botón principal según el estado: Iniciar (o el rótulo propio) → Pausar → Reanudar; Repetir al terminar.
 * Sin `canPause` (simulación que no admite pausa) no hay botón principal mientras corre.
 */
export function simPrimaryAction(status: SimStatus, canPause: boolean, startLabel = 'Iniciar', repeatLabel = 'Repetir'): { kind: 'start' | 'pause' | 'resume' | 'repeat'; label: string } | null {
  switch (status) {
    case 'en-curso': return canPause ? { kind: 'pause', label: 'Pausar' } : null;
    case 'en-pausa': return { kind: 'resume', label: 'Reanudar' };
    case 'terminado': return { kind: 'repeat', label: repeatLabel };
    default: return { kind: 'start', label: startLabel };
  }
}

export interface SimProgress {
  /** Tiempo (u otra magnitud) transcurrido y total, en la misma unidad. */
  value: number;
  max: number;
  unit: string;
  decimals?: number;
  /** Nombre de la magnitud, p. ej. «t» o «Tiempo simulado». */
  label?: string;
}

/**
 * Barra de control de una simulación con dinámica temporal: un botón principal que cambia según el estado
 * (Iniciar → Pausar → Reanudar; Repetir al terminar), Reiniciar, el estado en texto (no solo color) y el avance.
 * La lógica del tiempo sigue en el laboratorio: este componente solo llama a sus funciones.
 */
export function SimControls({ status, onStart, onPause, onResume, onReset, startLabel = 'Iniciar', repeatLabel = 'Repetir', resetLabel = 'Reiniciar', resetDisabled, progress, disabled, title = 'Control de la simulación', children }: {
  status: SimStatus;
  onStart: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onReset?: () => void;
  startLabel?: string;
  /** Rótulo del botón principal al terminar (por defecto «Repetir»). */
  repeatLabel?: string;
  resetLabel?: string;
  /** Por defecto Reiniciar se desactiva solo en «Lista para iniciar»; un laboratorio con preparación previa (p. ej. subir un objeto) puede habilitarlo antes. */
  resetDisabled?: boolean;
  progress?: SimProgress;
  disabled?: boolean;
  title?: string;
  children?: ReactNode;
}) {
  const id = useId();
  const action = simPrimaryAction(status, !!onPause, startLabel, repeatLabel);
  const primary = action && {
    label: action.label,
    icon: (action.kind === 'pause' ? 'pausa' : action.kind === 'repeat' ? 'reiniciar' : 'reproducir') as 'pausa' | 'reiniciar' | 'reproducir',
    run: action.kind === 'pause' ? onPause! : action.kind === 'resume' ? (onResume ?? onStart) : onStart,
  };
  const pct = progress && progress.max > 0 ? Math.max(0, Math.min(100, (progress.value / progress.max) * 100)) : null;
  const d = progress?.decimals ?? 0;
  return (
    <div className={`sim-controls is-${status}`} role="group" aria-labelledby={`${id}-t`}>
      <div className="sim-head">
        <span id={`${id}-t`} className="sim-title">{title}</span>
        <span className="sim-status" role="status"><span className="sim-dot" aria-hidden="true" />{SIM_STATUS_TEXT[status]}</span>
      </div>
      <div className="btn-row sim-buttons">
        {primary && (
          <button type="button" className="btn primary" onClick={primary.run} disabled={disabled}>
            <Icon name={primary.icon} size={17} />{primary.label}
          </button>
        )}
        {onReset && (
          <button type="button" className="btn" onClick={onReset} disabled={disabled || (resetDisabled ?? status === 'listo')}>
            <Icon name="reiniciar" size={17} />{resetLabel}
          </button>
        )}
        {children}
      </div>
      {progress && pct !== null && (
        <div className="sim-progress">
          <span className="sim-track" role="progressbar" aria-label={progress.label ?? 'Avance de la simulación'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
            aria-valuetext={`${progress.label ?? 't'} = ${fmt(progress.value, d)} de ${fmt(progress.max, d)} ${progress.unit}`}>
            <span style={{ width: `${pct}%` }} />
          </span>
          <span className="num small">{progress.label ?? 't'} = {fmt(progress.value, d)} / {fmt(progress.max, d)} {progress.unit}</span>
        </div>
      )}
    </div>
  );
}

export { ConditionAlert, type ConditionLevel } from './ConditionAlert';

/* ------------------------------------------------------------- relaciones */

/**
 * Explicación de la relación entre la variable independiente y la dependiente a partir de la tendencia detectada
 * en los datos del estudiante (no del modelo): qué se cambió, qué se midió y cómo leer la correlación.
 */
export function RelationExplainer({ xLabel, yLabel, trendText, r, n }: { xLabel: string; yLabel: string; trendText: string | null; r: number | null; n: number }) {
  const strength = r === null ? null : Math.abs(r) >= 0.9 ? 'muy fuerte' : Math.abs(r) >= 0.7 ? 'fuerte' : Math.abs(r) >= 0.4 ? 'moderada' : 'débil';
  return (
    <div className="relation">
      <div className="relation-vars" aria-hidden="true">
        <span className="relation-var iv"><small>Cambias</small>{xLabel}</span>
        <Icon name="flecha" size={18} />
        <span className="relation-var dv"><small>Mides</small>{yLabel}</span>
      </div>
      <p className="relation-text">
        <span className="sr-only">Variable independiente: {xLabel}. Variable dependiente: {yLabel}. </span>
        {n < 3 || !trendText
          ? <>Con {n} {n === 1 ? 'valor distinto' : 'valores distintos'} de {xLabel.toLowerCase()} todavía no se puede describir la relación: guarda al menos tres ensayos con valores diferentes.</>
          : <>En tus datos, cuando {xLabel.toLowerCase()} aumenta, {yLabel.toLowerCase()} <strong>{trendText}</strong>{strength ? <> (correlación {strength}, r = {fmt(r!, 2)})</> : null}.</>}
      </p>
      <p className="small muted relation-help">Cómo leerlo: r cerca de 1 o de −1 indica una relación lineal fuerte; cerca de 0, que no es lineal o que no hay relación. Una correlación no prueba la causa: solo cuenta si las demás variables se mantuvieron constantes.</p>
    </div>
  );
}
