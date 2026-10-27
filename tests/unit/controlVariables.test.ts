import { describe, expect, it } from 'vitest';
import type { Dataset, Trial, TrialValue } from '../../src/core/types';
import { allowedGroups, controlHintText, detectControlHint, inputChanges, sameInput } from '../../src/lib/controlVariables';
import { DATASETS } from '../../src/labs/datasets';

const DS: Dataset = {
  id: 'mediciones', label: 'Mediciones', defaultX: 'volumen', defaultY: 'presion',
  columns: [
    { key: 'ley', label: 'Ley', numeric: false, input: true },
    { key: 'volumen', label: 'Volumen', unit: 'L', numeric: true, decimals: 1, input: true },
    { key: 'temperatura', label: 'Temperatura', unit: 'K', numeric: true, decimals: 0, input: true },
    { key: 'escala', label: 'Escala del manómetro', numeric: true, input: true, notIndependent: true },
    { key: 'presion', label: 'Presión', unit: 'kPa', numeric: true, decimals: 1 },
  ],
};

let n = 0;
const trial = (values: Record<string, TrialValue>, datasetId = DS.id): Trial => ({ id: `t${++n}`, datasetId, createdAt: n, values });
const base = { ley: 'Boyle', volumen: 2, temperatura: 300, escala: 1, presion: 124.7 };

describe('sameInput', () => {
  it('compara números con tolerancia y textos por igualdad', () => {
    expect(sameInput(2, 2 + 1e-12)).toBe(true);
    expect(sameInput(1000, 1000.0001)).toBe(true); // relativa 1e-6
    expect(sameInput(2, 2.1)).toBe(false);
    expect(sameInput(0, 1e-10)).toBe(true);
    expect(sameInput('Boyle', 'Boyle ')).toBe(true);
    expect(sameInput('Boyle', 'boyle')).toBe(false);
  });
});

describe('inputChanges', () => {
  it('ignora salidas, entradas no independientes y valores vacíos', () => {
    const ch = inputChanges(DS, base, { ...base, escala: 5, presion: 99, volumen: 3 });
    expect(ch.map((c) => c.key)).toEqual(['volumen']);
    expect(inputChanges(DS, { ...base, temperatura: null }, { ...base, temperatura: 350 })).toEqual([]);
    expect(inputChanges(DS, { ...base, ley: '' }, { ...base, ley: 'Charles' })).toEqual([]);
  });
});

describe('detectControlHint', () => {
  it('el primer ensayo nunca da pista', () => {
    expect(detectControlHint(DS, [], { ...base, volumen: 9, temperatura: 400 })).toBeNull();
    // Ensayos de otro conjunto no cuentan como anteriores.
    expect(detectControlHint(DS, [trial(base, 'otro')], { ...base, volumen: 9, temperatura: 400 })).toBeNull();
  });

  it('no da pista si cambia una sola entrada (o ninguna)', () => {
    const prev = [trial(base)];
    expect(detectControlHint(DS, prev, { ...base, volumen: 3 })).toBeNull();
    expect(detectControlHint(DS, prev, { ...base })).toBeNull();
    expect(detectControlHint(DS, prev, { ...base, volumen: 2.0000000001, temperatura: 350 })).toBeNull();
  });

  it('da pista si cambian dos entradas respecto al ensayo anterior', () => {
    const prev = [trial(base), trial({ ...base, volumen: 3 })];
    const h = detectControlHint(DS, prev, { ...base, volumen: 4, temperatura: 350 });
    expect(h).not.toBeNull();
    expect(h!.reference).toBe(2);
    expect(h!.changes.map((c) => [c.key, c.from, c.to])).toEqual([['volumen', 3, 4], ['temperatura', 300, 350]]);
    expect(h!.signature).toBe('mediciones:temperatura+volumen');
  });

  it('cuenta cambios de texto y de número juntos', () => {
    const h = detectControlHint(DS, [trial(base)], { ...base, ley: 'Charles', temperatura: 350 });
    expect(h?.changes.map((c) => c.key)).toEqual(['ley', 'temperatura']);
  });

  it('no da pista si el ensayo difiere en una sola variable de alguna referencia anterior', () => {
    // Referencia, luego cambia el volumen; después vuelve a la referencia y cambia solo la temperatura.
    const prev = [trial(base), trial({ ...base, volumen: 3 })];
    expect(detectControlHint(DS, prev, { ...base, temperatura: 350 })).toBeNull();
  });

  it('respeta los conjuntos con varias entradas a propósito y los grupos permitidos', () => {
    const prev = [trial(base)];
    const next = { ...base, volumen: 4, temperatura: 350 };
    expect(detectControlHint({ ...DS, multiInput: 'Taller' }, prev, next)).toBeNull();
    expect(detectControlHint(DS, prev, next, [['volumen', 'temperatura']])).toBeNull();
    expect(detectControlHint(DS, prev, next, [['volumen']])).not.toBeNull();
  });

  it('obtiene los grupos permitidos de las relaciones de la práctica', () => {
    expect(allowedGroups([
      { x: 'req', y: 'i', xLabel: '', yLabel: '', datasetId: 'medidas', allowVary: ['r1', 'r2'] },
      { x: 'emf', y: 'i', xLabel: '', yLabel: '', datasetId: 'medidas' },
      { x: 'a', y: 'b', xLabel: '', yLabel: '', datasetId: 'otro', allowVary: [] },
    ], 'medidas')).toEqual([['req', 'r1', 'r2']]);
  });
});

describe('controlHintText', () => {
  it('nombra las variables por su rótulo, con valores y una sugerencia concreta', () => {
    const h = detectControlHint(DS, [trial(base)], { ...base, volumen: 4, temperatura: 350 })!;
    const t = controlHintText(h);
    expect(t.title).toBe('cambiaste dos variables a la vez');
    expect(t.cause).toContain('Respecto al ensayo 1 cambiaron volumen (de 2,0 L a 4,0 L) y temperatura (de 300 K a 350 K)');
    expect(t.cause).toContain('prueba justa');
    expect(t.suggestion).toContain('vuelve temperatura a 300 K, deja volumen en 4,0 L');
    expect(t.suggestion).toContain('El ensayo sí quedó guardado');
  });

  it('con tres variables pide devolver las otras dos', () => {
    const h = detectControlHint(DS, [trial(base)], { ...base, ley: 'Gay-Lussac', volumen: 4, temperatura: 350 })!;
    const t = controlHintText(h);
    expect(t.title).toBe('cambiaste tres variables a la vez');
    expect(t.suggestion).toContain('vuelve volumen a 2,0 L y temperatura a 300 K');
    expect(t.cause).toContain('«Boyle» a «Gay-Lussac»');
  });
});

describe('declaraciones en las tablas de datos', () => {
  const all = Object.entries(DATASETS).flatMap(([p, list]) => list.map((d) => ({ p, d })));

  it('las excepciones explican su motivo y solo marcan entradas', () => {
    for (const { p, d } of all) {
      if (d.multiInput !== undefined) expect(d.multiInput.length, `${p}/${d.id}`).toBeGreaterThan(20);
      for (const c of d.columns) if (c.notIndependent) expect(c.input, `${p}/${d.id}/${c.key}`).toBe(true);
    }
  });

  it('los diseños que varían varias entradas a propósito quedan exentos', () => {
    const exempt = (p: string, id: string) => !!DATASETS[p].find((d) => d.id === id)?.multiInput;
    for (const [p, id] of [['reto', 'rio'], ['reto', 'suelo'], ['reto', 'lluvia'], ['metabolismo', 'condiciones'], ['secuencias', 'comparaciones'],
      ['secuencias', 'traducciones'], ['oxidos-hidroxidos', 'taller'], ['balanceo', 'intentos'], ['proteinas', 'residuos']] as const) {
      expect(exempt(p, id), `${p}/${id}`).toBe(true);
    }
    // Prácticas de control de variables clásicas: sí dan pista.
    for (const [p, id] of [['gases', 'mediciones'], ['pendulo', 'oscilaciones'], ['densidad', 'medidas']] as const) {
      expect(exempt(p, id), `${p}/${id}`).toBe(false);
    }
  });

  it('una entrada que se deduce de otra no dispara la pista (gravedad según el lugar)', () => {
    const ds = DATASETS['cinetica-potencial'].find((d) => d.id === 'gravitatoria')!;
    const a = { lugar: 'Tierra', g: 9.81, masa: 100, altura: 1, aire: 0 };
    expect(detectControlHint(ds, [trial(a, ds.id)], { ...a, lugar: 'Luna', g: 1.62 }, [])).toBeNull();
    expect(detectControlHint(ds, [trial(a, ds.id)], { ...a, lugar: 'Luna', g: 1.62, masa: 200 }, [])).not.toBeNull();
  });
});
