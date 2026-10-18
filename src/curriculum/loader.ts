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
  reto: () => import('./practices/reto').then((m) => m.reto),
  mol: () => import('./practices/mol').then((m) => m.mol),
  'extraccion-adn': () => import('./practices/extraccion-adn').then((m) => m.extraccionAdn),
  'circuitos-simples': () => import('./practices/circuitos-simples').then((m) => m.circuitosSimples),
  induccion: () => import('./practices/induccion').then((m) => m.induccion),
  interferencia: () => import('./practices/interferencia').then((m) => m.interferencia),
  movimiento: () => import('./practices/movimiento').then((m) => m.movimiento),
  flotacion: () => import('./practices/flotacion').then((m) => m.flotacion),
  trabajo: () => import('./practices/trabajo').then((m) => m.trabajo),
  sonido: () => import('./practices/sonido').then((m) => m.sonido),
  conduccion: () => import('./practices/conduccion').then((m) => m.conduccion),
  expresion: () => import('./practices/expresion').then((m) => m.expresion),
  balanceo: () => import('./practices/balanceo').then((m) => m.balanceo),
  ecosistema: () => import('./practices/ecosistema').then((m) => m.ecosistema),
  presion: () => import('./practices/presion').then((m) => m.presion),
  calor: () => import('./practices/calor').then((m) => m.calor),
  maquinas: () => import('./practices/maquinas').then((m) => m.maquinas),
  agua: () => import('./practices/agua').then((m) => m.agua),
  respiracion: () => import('./practices/respiracion').then((m) => m.respiracion),
  conservacion: () => import('./practices/conservacion').then((m) => m.conservacion),
  choques: () => import('./practices/choques').then((m) => m.choques),
  pendulo: () => import('./practices/pendulo').then((m) => m.pendulo),
  proyectiles: () => import('./practices/proyectiles').then((m) => m.proyectiles),
  equilibrio: () => import('./practices/equilibrio').then((m) => m.equilibrio),
  descomposicion: () => import('./practices/descomposicion').then((m) => m.descomposicion),
  conductores: () => import('./practices/conductores').then((m) => m.conductores),
  seleccion: () => import('./practices/seleccion').then((m) => m.seleccion),
  redes: () => import('./practices/redes').then((m) => m.redes),
  cinetica: () => import('./practices/cinetica').then((m) => m.cinetica),
  cinematica: () => import('./practices/cinematica').then((m) => m.cinematica),
  celulas: () => import('./practices/celulas').then((m) => m.celulas),
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
