import { useCallback, useEffect, useRef, useState } from 'react';
import type { Mode, PracticeSession, Trial, TrialValue } from '../core/types';
import { loadJSON, saveJSON, removeKey } from './storage';

export const SESSION_PREFIX = 'lvcn:sesion:';

export function emptySession(practiceId: string, mode: Mode = 'guiada'): PracticeSession {
  const now = Date.now();
  return {
    practiceId, mode,
    hypothesis: { text: '', pairIndex: 0, trend: '' },
    trials: [], stepsDone: [], interpretations: {},
    comparison: { verdict: '', justification: '' },
    conclusion: { claim: '', evidence: '', reasoning: '' },
    application: '', answers: {}, visited: [], startedAt: now, updatedAt: now,
  };
}

export function loadSession(practiceId: string): PracticeSession {
  const s = loadJSON<PracticeSession | null>(SESSION_PREFIX + practiceId, null);
  if (!s || s.practiceId !== practiceId) return emptySession(practiceId);
  // Compatibilidad con versiones anteriores: completar campos faltantes.
  return { ...emptySession(practiceId), ...s };
}

let counter = 0;
export function newTrialId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter}`;
}

/** Estado persistente de una práctica (almacenamiento local del navegador). */
export function usePracticeSession(practiceId: string) {
  const [session, setSession] = useState<PracticeSession>(() => loadSession(practiceId));
  const first = useRef(true);

  useEffect(() => {
    setSession(loadSession(practiceId));
    first.current = true;
  }, [practiceId]);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    saveJSON(SESSION_PREFIX + practiceId, session);
  }, [session, practiceId]);

  const update = useCallback((fn: (s: PracticeSession) => PracticeSession) => {
    setSession((s) => ({ ...fn(s), updatedAt: Date.now() }));
  }, []);

  const addTrial = useCallback((datasetId: string, values: Record<string, TrialValue>) => {
    const trial: Trial = { id: newTrialId(), datasetId, createdAt: Date.now(), values };
    update((s) => ({ ...s, trials: [...s.trials, trial] }));
    return trial;
  }, [update]);

  const reset = useCallback(() => {
    removeKey(SESSION_PREFIX + practiceId);
    setSession((s) => emptySession(practiceId, s.mode));
  }, [practiceId]);

  return { session, update, addTrial, reset };
}

export type SessionApi = ReturnType<typeof usePracticeSession>;
