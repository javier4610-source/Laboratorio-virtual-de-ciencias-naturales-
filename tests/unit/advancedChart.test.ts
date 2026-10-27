import { describe, expect, it } from 'vitest';
import { niceTicks, splitAxisLabel } from '../../src/components/avanzado/AdvancedChart';

describe('gráficas del banco avanzado', () => {
  it('con datos enteros las marcas del eje son enteras (meses 1 a 12)', () => {
    const t = niceTicks(1, 12, 5, true);
    expect(t.every((v) => Number.isInteger(v))).toBe(true);
    expect(t[0]).toBeLessThanOrEqual(1);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(12);
  });
  it('sin la opción entera conserva los pasos de 2,5', () => {
    expect(niceTicks(0, 12, 5)).toContain(2.5);
  });
  it('parte los rótulos largos en magnitud y unidad', () => {
    expect(splitAxisLabel('Radiactividad en el compartimiento (% del total)')).toEqual(['Radiactividad en el compartimiento', '(% del total)']);
    expect(splitAxisLabel('pH')).toEqual(['pH']);
    expect(splitAxisLabel('Butan-1-ol (4 C)', 12)).toEqual(['Butan-1-ol', '(4 C)']);
  });
});
