import type { ReactNode } from 'react';
import { Icon } from './icons';
import type { ConditionLevel } from '../models/conditions';

export type { ConditionLevel };

const LEVEL_TEXT: Record<ConditionLevel, string> = { invalido: 'Condición no válida', advertencia: 'Atención', nota: 'Nota' };

/**
 * Aviso de condición experimental: qué pasa, por qué y cómo corregirlo. «invalido» indica que la medición no es
 * válida con esas condiciones (por ejemplo, fuera del rango del modelo); «advertencia», que el resultado es válido
 * pero conviene revisarlo (control de variables, saturación del instrumento…).
 * `live={false}` quita la región de estado propia: se usa cuando varios avisos van dentro de una sola región
 * (`Warnings`), para que el lector de pantalla no anuncie cada uno por separado.
 */
export function ConditionAlert({ level = 'advertencia', title, cause, fix, children, live = true }: {
  level?: ConditionLevel; title?: ReactNode; cause?: ReactNode; fix?: ReactNode; children?: ReactNode; live?: boolean;
}) {
  const icon = level === 'invalido' ? 'alerta' : level === 'advertencia' ? 'alerta' : 'info';
  return (
    <div className={`condition condition-${level}`} role={level === 'nota' ? 'note' : live ? 'status' : undefined}>
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

