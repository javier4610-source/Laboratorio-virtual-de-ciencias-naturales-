import type { Dataset } from '../core/types';

/**
 * Estructura de las tablas de datos de cada laboratorio. Es información pura
 * (sin React) para que el currículo, los informes y el panel docente la compartan.
 */
export const DATASETS: Record<string, Dataset[]> = {
  densidad: [{
    id: 'medidas', label: 'Mediciones de muestras', defaultX: 'vdesp', defaultY: 'masa',
    columns: [
      { key: 'material', label: 'Muestra', numeric: false, input: true },
      { key: 'lado', label: 'Arista', unit: 'cm', numeric: true, decimals: 1, input: true },
      { key: 'vgeo', label: 'V geométrico', unit: 'cm³', numeric: true, decimals: 2 },
      { key: 'masa', label: 'Masa', unit: 'g', numeric: true, decimals: 1 },
      { key: 'vi', label: 'V inicial', unit: 'mL', numeric: true, decimals: 1, input: true },
      { key: 'vf', label: 'V final', unit: 'mL', numeric: true, decimals: 1 },
      { key: 'vdesp', label: 'V desplazado', unit: 'mL', numeric: true, decimals: 1 },
      { key: 'densidad', label: 'Densidad (m/V desplazado)', unit: 'g/cm³', numeric: true, decimals: 2 },
      { key: 'flota', label: '¿Flota?', numeric: false },
    ],
  }],
  osmosis: [
    {
      id: 'osmosis', label: 'Ósmosis en células', defaultX: 'nacl', defaultY: 'cambio',
      columns: [
        { key: 'celula', label: 'Célula', numeric: false, input: true },
        { key: 'nacl', label: 'NaCl', unit: '%', numeric: true, decimals: 2, input: true },
        { key: 'osm', label: 'Osmolaridad externa', unit: 'Osm/L', numeric: true, decimals: 3 },
        { key: 'temp', label: 'Temperatura', unit: '°C', numeric: true, decimals: 0, input: true },
        { key: 'tiempo', label: 'Tiempo', unit: 's', numeric: true, decimals: 0, input: true },
        { key: 'cambio', label: 'Cambio de volumen', unit: '%', numeric: true, decimals: 1 },
        { key: 'rapidez', label: 'Rapidez inicial |ΔV|/10 s', unit: '%/s', numeric: true, decimals: 2 },
        { key: 'turgencia', label: 'Turgencia', unit: 'kPa', numeric: true, decimals: 0 },
        { key: 'estado', label: 'Estado', numeric: false },
      ],
    },
    {
      id: 'difusion', label: 'Difusión en bolsa de diálisis', defaultX: 'temp', defaultY: 'tmedio',
      columns: [
        { key: 'temp', label: 'Temperatura', unit: '°C', numeric: true, decimals: 0, input: true },
        { key: 'area', label: 'Área de membrana', unit: 'cm²', numeric: true, decimals: 0, input: true },
        { key: 'tiempo', label: 'Tiempo', unit: 'min', numeric: true, decimals: 0, input: true },
        { key: 'glucosaFuera', label: 'Glucosa fuera', unit: 'g/L', numeric: true, decimals: 2 },
        { key: 'yodoDentro', label: 'Yodo dentro', unit: 'g/L', numeric: true, decimals: 3 },
        { key: 'tmedio', label: 't½ glucosa', unit: 'min', numeric: true, decimals: 1 },
        { key: 'color', label: 'Color en la bolsa', numeric: false },
      ],
    },
  ],
  mendel: [{
    id: 'cruces', label: 'Cruces genéticos', defaultX: 'n', defaultY: 'desviacion',
    columns: [
      { key: 'cruce', label: 'Cruce', numeric: false, input: true },
      { key: 'n', label: 'Descendientes (N)', numeric: true, decimals: 0, input: true },
      { key: 'esperado', label: '% fenotipo 1 esperado', unit: '%', numeric: true, decimals: 1 },
      { key: 'observado', label: '% fenotipo 1 observado', unit: '%', numeric: true, decimals: 1 },
      { key: 'desviacion', label: 'Desviación |obs − esp|', unit: 'puntos %', numeric: true, decimals: 1 },
      { key: 'chi2', label: 'χ²', numeric: true, decimals: 2 },
      { key: 'p', label: 'Valor p', numeric: true, decimals: 3 },
      { key: 'proporcion', label: 'Proporción observada', numeric: false },
    ],
  }],
  adn: [{
    id: 'mutaciones', label: 'Mutaciones analizadas', defaultX: 'posicion', defaultY: 'identidad',
    columns: [
      { key: 'gen', label: 'Secuencia', numeric: false, input: true },
      { key: 'tipo', label: 'Tipo', numeric: false, input: true },
      { key: 'posicion', label: 'Posición (base)', numeric: true, decimals: 0, input: true },
      { key: 'cambio', label: 'Cambio', numeric: false, input: true },
      { key: 'efecto', label: 'Efecto', numeric: false },
      { key: 'aaCambiados', label: 'Aminoácidos distintos', numeric: true, decimals: 0 },
      { key: 'identidad', label: 'Identidad de la proteína', unit: '%', numeric: true, decimals: 1 },
      { key: 'longitud', label: 'Longitud de la proteína', unit: 'aa', numeric: true, decimals: 0 },
    ],
  }],
  soluciones: [{
    id: 'soluciones', label: 'Soluciones preparadas', defaultX: 'cfinal', defaultY: 'absorbancia',
    columns: [
      { key: 'soluto', label: 'Soluto', numeric: false, input: true },
      { key: 'masa', label: 'Masa', unit: 'g', numeric: true, decimals: 3, input: true },
      { key: 'volumen', label: 'Volumen', unit: 'mL', numeric: true, decimals: 0, input: true },
      { key: 'molaridad', label: 'Molaridad madre', unit: 'mol/L', numeric: true, decimals: 5 },
      { key: 'pmv', label: '% m/v', unit: '%', numeric: true, decimals: 3 },
      { key: 'factor', label: 'Factor de dilución', numeric: true, decimals: 1, input: true },
      { key: 'cfinal', label: 'Concentración final', unit: 'mol/L', numeric: true, decimals: 6 },
      { key: 'absorbancia', label: 'Absorbancia', numeric: true, decimals: 3 },
    ],
  }],
  enzimas: [{
    id: 'ensayos', label: 'Ensayos enzimáticos', defaultX: 'temp', defaultY: 'v0',
    columns: [
      { key: 'enzima', label: 'Enzima', numeric: false, input: true },
      { key: 'temp', label: 'Temperatura', unit: '°C', numeric: true, decimals: 0, input: true },
      { key: 'ph', label: 'pH', numeric: true, decimals: 1, input: true },
      { key: 'sustrato', label: '[S]₀', unit: 'mmol/L', numeric: true, decimals: 1, input: true },
      { key: 'enzimaRel', label: '[E] relativa', unit: '×', numeric: true, decimals: 2, input: true },
      { key: 'v0', label: 'Velocidad inicial', unit: 'mmol/(L·min)', numeric: true, decimals: 2 },
      { key: 'producto', label: 'Producto final', unit: 'mmol/L', numeric: true, decimals: 2 },
      { key: 'tiempo', label: 'Tiempo', unit: 'min', numeric: true, decimals: 0, input: true },
    ],
  }],
  circuitos: [{
    id: 'medidas', label: 'Mediciones del circuito', defaultX: 'emf', defaultY: 'itotal',
    columns: [
      { key: 'config', label: 'Configuración', numeric: false, input: true },
      { key: 'emf', label: 'fem (ε)', unit: 'V', numeric: true, decimals: 1, input: true },
      { key: 'r1', label: 'R₁', unit: 'Ω', numeric: true, decimals: 0, input: true },
      { key: 'r2', label: 'R₂', unit: 'Ω', numeric: true, decimals: 0, input: true },
      { key: 'r3', label: 'R₃', unit: 'Ω', numeric: true, decimals: 0, input: true },
      { key: 'req', label: 'R equivalente', unit: 'Ω', numeric: true, decimals: 2 },
      { key: 'itotal', label: 'I total', unit: 'A', numeric: true, decimals: 3 },
      { key: 'vbornes', label: 'V en bornes', unit: 'V', numeric: true, decimals: 2 },
      { key: 'v1', label: 'V₁', unit: 'V', numeric: true, decimals: 2 },
      { key: 'i1', label: 'I₁', unit: 'A', numeric: true, decimals: 3 },
      { key: 'ptotal', label: 'Potencia total', unit: 'W', numeric: true, decimals: 2 },
    ],
  }],
  estequiometria: [{
    id: 'ensayos', label: 'Ensayos de reacción', defaultX: 'masaA', defaultY: 'producto',
    columns: [
      { key: 'reaccion', label: 'Reacción', numeric: false, input: true },
      { key: 'masaA', label: 'Masa reactivo A', unit: 'g', numeric: true, decimals: 2, input: true },
      { key: 'masaB', label: 'Masa reactivo B', unit: 'g', numeric: true, decimals: 2, input: true },
      { key: 'limitante', label: 'Reactivo limitante', numeric: false },
      { key: 'producto', label: 'Producto principal (teórico)', unit: 'g', numeric: true, decimals: 2 },
      { key: 'real', label: 'Producto real', unit: 'g', numeric: true, decimals: 2 },
      { key: 'exceso', label: 'Reactivo sobrante', unit: 'g', numeric: true, decimals: 2 },
    ],
  }],
  poblacion: [{
    id: 'escenarios', label: 'Escenarios de crecimiento', defaultX: 'h', defaultY: 'nfinal',
    columns: [
      { key: 'modelo', label: 'Modelo', numeric: false, input: true },
      { key: 'n0', label: 'N₀', numeric: true, decimals: 0, input: true },
      { key: 'r', label: 'r', unit: '1/año', numeric: true, decimals: 2, input: true },
      { key: 'k', label: 'K', numeric: true, decimals: 0, input: true },
      { key: 'h', label: 'Cosecha h', unit: '1/año', numeric: true, decimals: 2, input: true },
      { key: 'anios', label: 'Tiempo', unit: 'años', numeric: true, decimals: 0, input: true },
      { key: 'nfinal', label: 'N final', numeric: true, decimals: 0 },
      { key: 'equilibrio', label: 'N de equilibrio', numeric: true, decimals: 0 },
    ],
  }],
};
