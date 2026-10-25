import type { ReactNode } from 'react';
import { Icon } from './icons';

export type ConditionLevel = 'invalido' | 'advertencia' | 'nota';

const LEVEL_TEXT: Record<ConditionLevel, string> = { invalido: 'Condición no válida', advertencia: 'Atención', nota: 'Nota' };

/**
 * Aviso de condición experimental: qué pasa, por qué y cómo corregirlo. «invalido» indica que la medición no es
 * válida con esas condiciones (por ejemplo, fuera del rango del modelo); «advertencia», que el resultado es válido
 * pero conviene revisarlo (control de variables, saturación del instrumento…).
 */
export function ConditionAlert({ level = 'advertencia', title, cause, fix, children }: {
  level?: ConditionLevel; title?: ReactNode; cause?: ReactNode; fix?: ReactNode; children?: ReactNode;
}) {
  const icon = level === 'invalido' ? 'alerta' : level === 'advertencia' ? 'alerta' : 'info';
  return (
    <div className={`condition condition-${level}`} role={level === 'nota' ? 'note' : 'status'}>
      <span className="condition-icon" aria-hidden="true"><Icon name={icon} size={18} /></span>
      <div className="condition-body">
        <p className="condition-title"><span className="condition-level">{LEVEL_TEXT[level]}{title ? ':' : ''}</span>{title && <> {title}</>}</p>
        {cause && <p className="condition-cause">{cause}</p>}
        {children}
        {fix && <p className="condition-fix"><strong>Cómo corregirlo:</strong> {fix}</p>}
      </div>
    </div>
  );
}

