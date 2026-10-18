import type { ModelParamSpec } from '../lib/advanced';

/**
 * Constantes del modelo que el estudiante puede modificar en el modo avanzado («¿qué pasaría si…?»).
 * Los rangos son seguros para el modelo (no lo llevan fuera de su dominio numérico). Información pura:
 * la comparten los laboratorios, el panel de ecuaciones y las curvas del modelo del cuaderno.
 */
const gravity = (value: number, hint: string): ModelParamSpec => ({
  key: 'g', sym: 'g', label: 'Aceleración de la gravedad', unit: 'm/s²', value, min: 1, max: 25, step: 0.01, decimals: 2, hint,
});

export const MODEL_PARAMS: Record<string, ModelParamSpec[]> = {
  movimiento: [{
    key: 'reaccion', sym: 't_{r}', label: 'Tiempo de reacción del compañero al arrancar', unit: 's', value: 0.2, min: 0.1, max: 0.4, step: 0.01, decimals: 2,
    hint: 'Un compañero que reacciona más tarde a la señal de salida arranca el cronómetro tarde y mide tiempos más cortos (y rapideces mayores).',
  }],
  newton: [gravity(9.8, 'Cambia el peso y la fricción (f = μ·m·g). Prueba con la Luna (1,62 m/s²) o Júpiter (24,8 m/s²).')],
  proyectiles: [gravity(9.8, 'Cambia el tiempo de vuelo, la altura máxima y el alcance. Luna: 1,62 m/s²; Marte: 3,71 m/s².')],
  presion: [gravity(9.78, 'Cambia la presión hidrostática ρ·g·h y la rapidez de Torricelli √(2·g·h).')],
  energia: [gravity(9.8, 'Cambia la energía potencial m·g·h; observa si cambia la rapidez en el valle.')],
  gases: [{
    key: 'n', sym: 'n', label: 'Cantidad de aire en la jeringa', unit: 'mmol', value: 4.09, min: 1, max: 8, step: 0.01, decimals: 2,
    hint: 'Más moléculas de gas en el mismo volumen y a la misma temperatura producen más presión (P·V = n·R·T).',
  }],
  cinetica: [{
    key: 'ea', sym: 'E_{a}', label: 'Energía de activación (mármol + HCl)', unit: 'kJ/mol', value: 45, min: 20, max: 90, step: 1, decimals: 0,
    hint: 'Una Eₐ mayor hace que la temperatura influya más en la velocidad (ecuación de Arrhenius).',
  }],
  induccion: [{
    key: 'momento', sym: 'm', label: 'Momento magnético del imán de ferrita', unit: 'A·m²', value: 1.2, min: 0.2, max: 6, step: 0.1, decimals: 1,
    hint: 'Un imán más fuerte produce más campo a la misma distancia (B ∝ m/r³) y más flujo por la bobina: la fem y el área ∫ε dt crecen en la misma proporción.',
  }],
};

export const paramsFor = (practiceId: string): ModelParamSpec[] => MODEL_PARAMS[practiceId] ?? [];
