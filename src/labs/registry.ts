import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { PracticeDef } from '../core/types';
import type { SessionApi } from '../lib/session';

export interface LabProps { api: SessionApi; practice: PracticeDef; }

/**
 * Registro de componentes de laboratorio. Cada práctica del currículo se asocia
 * a un componente cargado bajo demanda (mejor rendimiento en equipos modestos).
 */
export const LAB_COMPONENTS: Record<string, LazyExoticComponent<ComponentType<LabProps>>> = {
  densidad: lazy(() => import('./DensityLab')),
  osmosis: lazy(() => import('./OsmosisLab')),
  mendel: lazy(() => import('./MendelLab')),
  adn: lazy(() => import('./DnaLab')),
  soluciones: lazy(() => import('./SolutionsLab')),
  enzimas: lazy(() => import('./EnzymeLab')),
  circuitos: lazy(() => import('./CircuitLab')),
  estequiometria: lazy(() => import('./StoichLab')),
  poblacion: lazy(() => import('./PopulationLab')),
  mitosis: lazy(() => import('./MitosisLab')),
  ondas: lazy(() => import('./WavesLab')),
  fotosintesis: lazy(() => import('./PhotoLab')),
  ph: lazy(() => import('./AcidBaseLab')),
  popgen: lazy(() => import('./PopGenLab')),
  mezclas: lazy(() => import('./MixturesLab')),
  optica: lazy(() => import('./OpticsLab')),
  newton: lazy(() => import('./NewtonLab')),
  gases: lazy(() => import('./GasLab')),
  energia: lazy(() => import('./EnergyLab')),
  seleccion: lazy(() => import('./SelectionLab')),
  redes: lazy(() => import('./FoodWebLab')),
  cinetica: lazy(() => import('./KineticsLab')),
  cinematica: lazy(() => import('./KinematicsLab')),
  celulas: lazy(() => import('./MicroscopeLab')),
};
