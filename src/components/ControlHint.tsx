import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import type { Dataset, RelationPair, Trial } from '../core/types';
import type { SessionApi } from '../lib/session';
import { allowedGroups, controlHintText, detectControlHint, type ControlHint } from '../lib/controlVariables';
import { ConditionAlert } from './ConditionAlert';

/**
 * Pista de control de variables compartida por todas las prácticas. El anfitrión del laboratorio envuelve la sesión
 * (`useControlHints`): cada `addTrial` compara el ensayo con los anteriores del mismo conjunto. El botón de registro
 * (`RecordButton`) recoge la pista del ensayo que acaba de guardar y la muestra debajo de sí mismo. Ningún laboratorio
 * tiene código propio para esto; las excepciones se declaran en los datos (`multiInput`, `notIndependent`, `allowVary`).
 */
export interface ControlHintBus {
  /** Empieza un registro: descarta una pista pendiente de otro botón. */
  begin(): void;
  /** Pista del registro en curso (una sola vez por combinación de variables en esta visita a la práctica). */
  take(): ControlHint | null;
}

const Ctx = createContext<ControlHintBus | null>(null);

export function useControlHintBus(): ControlHintBus | null {
  return useContext(Ctx);
}

export function ControlHintProvider({ bus, children }: { bus: ControlHintBus; children: ReactNode }) {
  return <Ctx.Provider value={bus}>{children}</Ctx.Provider>;
}

/** Envuelve la sesión del laboratorio para detectar, al guardar, si cambiaron dos o más variables de entrada a la vez. */
export function useControlHints(api: SessionApi, datasets: Dataset[] | undefined, relations: RelationPair[] | undefined): { api: SessionApi; bus: ControlHintBus } {
  // Ensayos ya guardados, más los agregados en este mismo instante (un laboratorio puede guardar varios en un clic).
  const trials = useRef<{ base: Trial[]; added: Trial[] }>({ base: api.session.trials, added: [] });
  if (trials.current.base !== api.session.trials) trials.current = { base: api.session.trials, added: [] };
  const pending = useRef<ControlHint | null>(null);
  const shown = useRef(new Set<string>());

  const bus = useMemo<ControlHintBus>(() => ({
    begin: () => { pending.current = null; },
    take: () => {
      const h = pending.current;
      pending.current = null;
      if (h) shown.current.add(h.signature);
      return h;
    },
  }), []);

  const wrapped = useMemo<SessionApi>(() => ({
    ...api,
    addTrial: (datasetId, values) => {
      const ds = datasets?.find((d) => d.id === datasetId);
      const prev = [...trials.current.base, ...trials.current.added];
      const hint = ds ? detectControlHint(ds, prev, values, allowedGroups(relations, datasetId)) : null;
      const t = api.addTrial(datasetId, values);
      trials.current.added.push(t);
      if (hint && !pending.current && !shown.current.has(hint.signature)) pending.current = hint;
      return t;
    },
  }), [api, datasets, relations]);

  return { api: wrapped, bus };
}

/** La pista: una nota (no una alerta) con qué cambió, por qué importa y qué hacer; se cierra con «Entendido». */
export function ControlHintNote({ hint, onDismiss }: { hint: ControlHint; onDismiss: () => void }) {
  const t = controlHintText(hint);
  return (
    <div className="control-hint">
      <ConditionAlert level="nota" title={t.title} cause={t.cause}>
        <p className="condition-fix"><strong>Sugerencia:</strong> {t.suggestion}</p>
        <div className="btn-row">
          <button type="button" className="btn small" onClick={onDismiss}>Entendido</button>
        </div>
      </ConditionAlert>
    </div>
  );
}
