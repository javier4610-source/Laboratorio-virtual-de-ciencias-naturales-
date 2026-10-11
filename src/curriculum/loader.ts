import { useEffect, useState } from 'react';
import type { PracticeDef } from '../core/types';
import { balancePractice } from '../assessment/balance';

/**
 * Carga bajo demanda del contenido completo de cada práctica (texto, preguntas,
 * ficha del modelo). Así el navegador descarga solo lo que el estudiante abre.
 */
const LOADERS: Record<string, () => Promise<PracticeDef>> = {
  densidad: () => import('./practices/densidad').then((m) => m.densidad),
  osmosis: () => import('./practices/osmosis').then((m) => m.osmosis),
  mendel: () => import('./practices/mendel').then((m) => m.mendel),
  adn: () => import('./practices/adn').then((m) => m.adn),
  soluciones: () => import('./practices/soluciones').then((m) => m.soluciones),
  enzimas: () => import('./practices/enzimas').then((m) => m.enzimas),
  circuitos: () => import('./practices/circuitos').then((m) => m.circuitos),
  estequiometria: () => import('./practices/estequiometria').then((m) => m.estequiometria),
  poblacion: () => import('./practices/poblacion').then((m) => m.poblacion),
  mitosis: () => import('./practices/mitosis').then((m) => m.mitosis),
  ondas: () => import('./practices/ondas').then((m) => m.ondas),
  fotosintesis: () => import('./practices/fotosintesis').then((m) => m.fotosintesis),
  ph: () => import('./practices/ph').then((m) => m.ph),
  popgen: () => import('./practices/popgen').then((m) => m.popgen),
  mezclas: () => import('./practices/mezclas').then((m) => m.mezclas),
  optica: () => import('./practices/optica').then((m) => m.optica),
  newton: () => import('./practices/newton').then((m) => m.newton),
  gases: () => import('./practices/gases').then((m) => m.gases),
  energia: () => import('./practices/energia').then((m) => m.energia),
};

export const LOADER_IDS = Object.keys(LOADERS);

const cache = new Map<string, Promise<PracticeDef>>();

export function loadPractice(id: string): Promise<PracticeDef> {
  const loader = LOADERS[id];
  if (!loader) return Promise.reject(new Error(`No existe la práctica «${id}».`));
  let p = cache.get(id);
  if (!p) {
    p = loader().then(balancePractice);
    p.catch(() => cache.delete(id)); // permitir reintentar si falla la red
    cache.set(id, p);
  }
  return p;
}

export type LoadState<T> = { status: 'loading' } | { status: 'ready'; value: T } | { status: 'error'; message: string };

export function usePractice(id: string): LoadState<PracticeDef> & { retry: () => void } {
  const [state, setState] = useState<LoadState<PracticeDef>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    loadPractice(id).then(
      (value) => alive && setState({ status: 'ready', value }),
      (e: Error) => alive && setState({ status: 'error', message: e.message || 'No se pudo cargar la práctica.' }),
    );
    return () => { alive = false; };
  }, [id, attempt]);
  return { ...state, retry: () => setAttempt((n) => n + 1) };
}
