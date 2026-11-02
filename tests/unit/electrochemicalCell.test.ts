import { describe, expect, it } from 'vitest';
import { cell, cellConditions, discharge, electrodePotential, FARADAY, faradayMass, halfCell, HALF_CELLS, initialMass, NERNST_SLOPE, nernstCell } from '../../src/models/electrochemicalCell';

const daniell = { left: 'zn', right: 'cu', cLeft: 1, cRight: 1, bridge: 'KNO3' as const };

describe('potenciales y fem', () => {
  it('constantes: 0,05916 V a 25 °C y la serie del CRC', () => {
    expect(NERNST_SLOPE).toBeCloseTo(0.05916, 5);
    expect(HALF_CELLS.map((h) => h.E0)).toEqual([-0.7618, -0.447, -0.257, -0.1262, 0.3419, 0.7996]);
    expect(halfCell('zn').molar).toBe(65.4);
  });
  it('pila de Daniell 1,0 M: E = 1,1037 V, Zn ánodo y Cu cátodo', () => {
    const c = cell(daniell);
    expect(c.E).toBeCloseTo(1.1037, 10);
    expect(c).toMatchObject({ anode: 'left', cathode: 'right', N: 2 });
    expect(c.reaction).toBe('Zn(s) + Cu²⁺(ac) → Zn²⁺(ac) + Cu(s)');
    expect(c.voltmeter).toBeCloseTo(1.1037, 10);
  });
  it('Nernst: las dos formas coinciden y bajar [Cu²⁺] a 0,010 M resta 0,05916 V', () => {
    const c = cell({ ...daniell, cRight: 0.01 });
    expect(c.E).toBeCloseTo(1.1037 - NERNST_SLOPE, 10);
    expect(nernstCell(c.E0, c.N, c.Q)).toBeCloseTo(c.E, 12);
    const ag = cell({ left: 'cu', right: 'ag', cLeft: 0.1, cRight: 0.01, bridge: 'KNO3' });
    expect(ag.N).toBe(2);
    expect(ag.reaction).toBe('Cu(s) + 2 Ag⁺(ac) → Cu²⁺(ac) + 2 Ag(s)');
    expect(nernstCell(ag.E0, ag.N, ag.Q)).toBeCloseTo(ag.E, 12);
    expect(electrodePotential(halfCell('ag'), 0.01)).toBeCloseTo(0.7996 - 2 * NERNST_SLOPE, 12);
  });
  it('pila de concentración: el mismo metal con 1,0 y 0,010 M da 0,05916 V; el diluido es el ánodo', () => {
    const c = cell({ left: 'cu', right: 'cu', cLeft: 0.01, cRight: 1, bridge: 'KNO3' });
    expect(c.E).toBeCloseTo(NERNST_SLOPE, 12);
    expect(c.anode).toBe('left');
  });
});

describe('Faraday y descarga', () => {
  it('50 mA durante 120 min: −0,1220 g de Zn y +0,1186 g de Cu', () => {
    const d = discharge({ ...daniell, volumeML: 100, currentMA: 50, timeMin: 120 });
    expect(d.charge).toBeCloseTo(360, 9);
    expect(d.dLeft).toBeCloseTo(-(360 * 65.4) / (2 * FARADAY), 12);
    expect(d.dLeft).toBeCloseTo(-0.122, 3);
    expect(d.dRight).toBeCloseTo(0.1186, 4);
    expect(d.massLeft).toBeCloseTo(initialMass(halfCell('zn')) + d.dLeft, 12);
    expect(faradayMass(0.05, 7200, halfCell('cu'))).toBeCloseTo(d.dRight, 12);
    expect(d.cRight).toBeCloseTo(1 - 360 / FARADAY / 2 / 0.1, 12);
    expect(d.cLeft).toBeCloseTo(1 + 360 / FARADAY / 2 / 0.1, 12);
    expect(d.E).toBeLessThan(1.1037);
  });
  it('se agota el ion del cátodo y el aviso da la corrección', () => {
    const i = { ...daniell, cRight: 0.001, volumeML: 50, currentMA: 100, timeMin: 120 };
    const d = discharge(i);
    expect(d.depleted).toBe(true);
    expect(d.tDepleteMin).toBeCloseTo((0.001 * 0.05 * 2 * FARADAY) / 0.1 / 60, 9);
    const c = cellConditions(i).find((x) => x.text.includes('se agota'))!;
    expect(c.level).toBe('invalido');
    expect(c.fix).toContain('acorta el tiempo a menos de 1 min');
  });
  it('avisos: sin puente, KCl con plata, voltímetro invertido, semiceldas iguales', () => {
    expect(cellConditions({ ...daniell, bridge: 'ninguno', volumeML: 100, currentMA: 0, timeMin: 0 })[0].level).toBe('invalido');
    expect(discharge({ ...daniell, bridge: 'ninguno', volumeML: 100, currentMA: 50, timeMin: 60 }).charge).toBe(0);
    expect(cellConditions({ left: 'cu', right: 'ag', cLeft: 1, cRight: 1, bridge: 'KCl', volumeML: 100, currentMA: 0, timeMin: 0 }).some((c) => c.text.includes('AgCl'))).toBe(true);
    const inv = cellConditions({ ...daniell, left: 'cu', right: 'zn', volumeML: 100, currentMA: 0, timeMin: 0 });
    expect(inv.find((c) => c.fix.includes('Intercambia'))?.level).toBe('advertencia');
    expect(cellConditions({ ...daniell, right: 'zn', volumeML: 100, currentMA: 0, timeMin: 0 }).some((c) => c.level === 'nota')).toBe(true);
  });
});
