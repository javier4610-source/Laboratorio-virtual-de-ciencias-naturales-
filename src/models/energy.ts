import { assertInRange } from './math';
import type { ModelSpec } from './types';

/**
 * Conservación de la energía mecánica (grado 10.º): una esfera que rueda sin
 * deslizar por una pista con dos colinas, soltada desde el reposo.
 *   E = Ep + Ec + Ef;  Ep = m·g·h;  Ec = ½·m·v²·k  (k = 1 + I/(m r²) = 7/5 para esfera maciza si rueda)
 *   Ef = μ·m·g·∫cos θ ds  (trabajo de la fricción de rodadura/arrastre, aproximado)
 */

export const G = 9.8;
export const TRACK_X = 4; // m de pista horizontal total

/** Altura de la pista en función de x (m): rampa inicial, valle, colina intermedia y valle final. */
export function trackHeight(x: number, startHeight: number, hillHeight: number): number {
  // Suma de curvas suaves (coseno) que empiezan en startHeight en x = 0.
  const xn = Math.max(0, Math.min(TRACK_X, x));
  // Rampa con pendiente desde el inicio (si empezara plana, con fricción la esfera no arrancaría) y llegada suave al valle.
  if (xn <= 1.5) return startHeight * (1 - Math.sin((Math.PI * xn) / 3)); // baja de h0 a 0
  if (xn <= 3) return hillHeight * (1 - Math.cos((2 * Math.PI * (xn - 1.5)) / 1.5)) / 2; // colina de 0 a hc y de vuelta a 0
  return 0;
}

export const ENERGY_LIMITS = { mass: [0.05, 2] as [number, number], startHeight: [0.2, 2] as [number, number], hillHeight: [0, 2] as [number, number], mu: [0, 0.1] as [number, number] };

export interface EnergyInput { mass: number; startHeight: number; hillHeight: number; mu: number; rolling: boolean; }
export interface EnergyPoint { x: number; h: number; v: number; ep: number; ek: number; ef: number; }
export interface EnergyResult {
  points: EnergyPoint[];
  passesHill: boolean;
  stopX: number | null; // dónde se detiene/devuelve si no supera la colina
  speedBottom: number; // en el primer valle
  speedEnd: number | null; // al final de la pista
  totalEnergy: number;
  k: number;
}

export function simulateTrack(input: EnergyInput): EnergyResult {
  assertInRange('La masa', input.mass, ...ENERGY_LIMITS.mass);
  assertInRange('La altura inicial', input.startHeight, ...ENERGY_LIMITS.startHeight);
  assertInRange('La altura de la colina', input.hillHeight, ...ENERGY_LIMITS.hillHeight);
  assertInRange('El coeficiente de fricción', input.mu, ...ENERGY_LIMITS.mu);
  const { mass: m, startHeight: h0, hillHeight: hc, mu } = input;
  const k = input.rolling ? 7 / 5 : 1; // energía de rotación de una esfera maciza que rueda sin deslizar
  const E0 = m * G * h0;
  const N = 800;
  const points: EnergyPoint[] = [];
  let ef = 0;
  let stopX: number | null = null;
  let speedBottom = 0;
  let prevX = 0;
  for (let i = 0; i <= N; i++) {
    const x = (TRACK_X * i) / N;
    const h = trackHeight(x, h0, hc);
    if (i > 0) {
      // ∫ μ·m·g·cos θ ds = μ·m·g·dx (proyección horizontal)
      ef += mu * m * G * (x - prevX);
    }
    const ep = m * G * h;
    const ek = E0 - ep - ef;
    if (ek < 0) { stopX = x; break; }
    const v = Math.sqrt((2 * ek) / (m * k));
    points.push({ x, h, v, ep, ek, ef });
    if (Math.abs(x - 1.5) < TRACK_X / N / 2) speedBottom = v;
    prevX = x;
  }
  const last = points[points.length - 1];
  return {
    points, passesHill: stopX === null, stopX, speedBottom,
    speedEnd: stopX === null ? last.v : null, totalEnergy: E0, k,
  };
}

export const energyModelSpec: ModelSpec = {
  name: 'Conservación de la energía mecánica en una pista con colinas',
  inputs: [
    { symbol: 'm', name: 'Masa de la esfera', unit: 'kg', range: ENERGY_LIMITS.mass, initial: 0.5 },
    { symbol: 'h₀', name: 'Altura de salida', unit: 'm', range: ENERGY_LIMITS.startHeight, initial: 1 },
    { symbol: 'h_c', name: 'Altura de la colina intermedia', unit: 'm', range: ENERGY_LIMITS.hillHeight, initial: 0.6 },
    { symbol: 'μ', name: 'Coeficiente de fricción efectivo', unit: '—', range: ENERGY_LIMITS.mu, initial: 0 },
    { symbol: 'rueda', name: '¿La esfera rueda (energía de rotación)?', unit: '—', initial: 'no' },
  ],
  outputs: [
    { symbol: 'Ep, Ec, Ef', name: 'Energía potencial, cinética y disipada por fricción', unit: 'J' },
    { symbol: 'v', name: 'Rapidez en cada punto', unit: 'm/s' },
  ],
  equations: [
    'E_mecánica = Ep + Ec = m·g·h + ½·m·v²',
    'Sin fricción: m·g·h₀ = m·g·h + ½·m·v²  →  v = √(2g(h₀ − h))',
    'Con fricción: Ep + Ec + E_disipada = m·g·h₀;  E_disipada ≈ μ·m·g·(distancia horizontal recorrida)',
    'Esfera maciza que rueda: Ec = ½·m·v²·(7/5)',
  ],
  initialConditions: ['Esfera de 0,5 kg soltada desde el reposo a 1 m de altura; colina de 0,6 m; sin fricción.'],
  assumptions: [
    'La esfera se suelta desde el reposo y se trata como partícula (salvo la opción de rodadura).',
    'La fricción se modela como μ·m·g por unidad de distancia horizontal (aproximación de pendientes suaves).',
    'g = 9,8 m/s²; sin resistencia del aire.',
  ],
  limits: [
    'No representa el despegue de la pista en curvas pronunciadas ni la fuerza normal variable en las curvas.',
    'Si la esfera no supera la colina, el modelo indica dónde se detiene; no simula el regreso.',
  ],
  testCases: [
    'Sin fricción, Ep + Ec es constante en todos los puntos.',
    'Rapidez en el valle: v = √(2gh₀), independiente de la masa.',
    'Si la colina es más alta que el punto de salida, la esfera no la supera.',
    'Con fricción, la energía mecánica disminuye y la diferencia es la energía disipada.',
    'Al rodar, la rapidez es menor (parte de la energía va a la rotación).',
  ],
};
