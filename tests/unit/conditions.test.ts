/**
 * Avisos de condición con «Cómo corregirlo» (rediseño, paso siguiente; ADR 0007).
 * - Cada advertencia de los modelos recibe su nivel y una corrección (salvo las notas informativas).
 * - Las correcciones numéricas se comprueban aplicándolas: con el valor que propone el aviso, el modelo ya no
 *   produce esa advertencia (la corrección sale del mismo umbral del modelo, no de un número inventado).
 * - El componente Warnings: textos simples como antes; condiciones en una sola región de estado.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Warnings } from '../../src/components/ui';
import { classifyWarnings, sortConditions, type ModelCondition } from '../../src/models/conditions';
import { gasConditions, simulateGas, type GasInput } from '../../src/models/gases';
import { activePHRange, enzymeConditions, findEnzyme, pHFactor, simulateEnzyme, type EnzymeInput } from '../../src/models/enzyme';
import { densityConditions, simulateDensity, type DensityInput } from '../../src/models/density';
import { circuitConditions, solveCircuit, type CircuitInput } from '../../src/models/circuits';
import { simulateRiver, waterConditions, type WaterInput } from '../../src/models/waterQuality';
import { kinematicsConditions, simulateRun } from '../../src/models/kinematics';
import { motionConditions, simulateMotion } from '../../src/models/motion';
import { kineticsConditions, simulateKinetics } from '../../src/models/kinetics';
import { conservationConditions, simulateConservation, type ConservationInput } from '../../src/models/massConservation';
import { feConditions, no2Conditions, solveFeSCN, solveNO2, FE_INITIAL } from '../../src/models/equilibrium';
import { ECO_DEFAULT, ecosystemConditions, simulateEcosystem } from '../../src/models/ecosystem';
import { simpleCircuitConditions } from '../../src/models/simpleCircuits';
import { prepareSolution, solutionConditions, type SolutionInput } from '../../src/models/solutions';
import { photoConditions, simulatePhotosynthesis, type PhotoInput } from '../../src/models/photosynthesis';
import { apertureFor, interferenceConditions } from '../../src/models/interference';
import { extractionConditions, simulateExtraction } from '../../src/models/dnaExtraction';
import { metabolismConditions } from '../../src/models/metabolism';
import { alignConditions, parseConditions, parseSequenceText } from '../../src/models/sequences';
import { designConditions, designLevels, type Design } from '../../src/models/inquiry';

/** Toda advertencia queda reconocida: tiene corrección, o es una nota. */
function expectAllHandled(conds: ModelCondition[], n: number) {
  expect(conds).toHaveLength(n);
  for (const c of conds) {
    expect(c.text.length).toBeGreaterThan(0);
    if (c.level !== 'nota') expect(c.fix, c.text).toBeTruthy();
  }
}
/** Número (con coma decimal) que sigue a «a» en la corrección: «… a 40 mL o más» → 40. */
function numberIn(fix: string | undefined, re: RegExp): number {
  const m = re.exec(fix ?? '');
  if (!m) throw new Error(`Sin número en: ${fix}`);
  return Number(m[1].replace(',', '.'));
}

describe('classifyWarnings y sortConditions', () => {
  it('asocia la primera regla por prefijo o expresión; sin regla queda como advertencia sin corrección', () => {
    const c = classifyWarnings(['Uno: algo', 'Dos 3 cosas', 'Otra'], [
      { match: 'Uno', level: 'invalido', fix: 'Corrige uno.' },
      { match: /^Dos (\d+)/, level: 'nota', fix: (t) => `Hay ${/(\d+)/.exec(t)![1]}.` },
    ]);
    expect(c).toEqual([
      { text: 'Uno: algo', level: 'invalido', fix: 'Corrige uno.' },
      { text: 'Dos 3 cosas', level: 'nota', fix: 'Hay 3.' },
      { text: 'Otra', level: 'advertencia' },
    ]);
  });
  it('ordena por gravedad y conserva el orden dentro de cada nivel', () => {
    const s = sortConditions([
      { text: 'n', level: 'nota' }, { text: 'a1', level: 'advertencia' }, { text: 'i', level: 'invalido' }, { text: 'a2', level: 'advertencia' },
    ] as ModelCondition[]);
    expect(s.map((x) => x.text)).toEqual(['i', 'a1', 'a2', 'n']);
  });
});

describe('Warnings: render', () => {
  const html = (list: Parameters<typeof Warnings>[0]['list']) => renderToStaticMarkup(createElement(Warnings, { list }));
  const count = (h: string, re: RegExp) => (h.match(re) ?? []).length;

  it('sin advertencias no dibuja nada', () => expect(html([])).toBe(''));

  it('solo textos: un aviso con la lista (comportamiento anterior)', () => {
    const h = html(['Primera.', 'Segunda.']);
    expect(count(h, /role="status"/g)).toBe(1);
    expect(h).toContain('revisa estas 2 condiciones del experimento');
    expect(count(h, /<li>/g)).toBe(2);
    expect(h).not.toContain('Cómo corregirlo');
  });

  it('condiciones: un aviso por causa con su corrección, en una sola región de estado y ordenados por gravedad', () => {
    const h = html([
      { text: 'Nota informativa.', level: 'nota' },
      { text: 'Revisa esto.', level: 'advertencia', fix: 'Baja la temperatura a 45 °C o menos.' },
      { text: 'No sirve así.', level: 'invalido', fix: 'Sube el volumen a 40 mL o más.' },
    ]);
    expect(count(h, /role="status"/g)).toBe(1); // una sola región viva
    expect(count(h, /class="condition condition-/g)).toBe(3);
    expect(count(h, /Cómo corregirlo:/g)).toBe(2);
    expect(h).toContain('aria-label="3 condiciones del experimento"');
    // orden: no válida, atención, nota
    const i = h.indexOf('condition-invalido'), a = h.indexOf('condition-advertencia'), n = h.indexOf('condition-nota');
    expect(i).toBeLessThan(a);
    expect(a).toBeLessThan(n);
    // cada corrección va junto a su causa
    expect(h.indexOf('No sirve así.')).toBeLessThan(h.indexOf('Sube el volumen'));
    expect(h.indexOf('Sube el volumen')).toBeLessThan(h.indexOf('Revisa esto.'));
    expect(h).toContain('Condición no válida');
    expect(h).toContain('role="note"');
  });

  it('mezcla de texto y condición: el texto se muestra como «Atención» sin corrección', () => {
    const h = html(['Texto suelto.', { text: 'Con corrección.', level: 'invalido', fix: 'Haz esto.' }]);
    expect(count(h, /class="condition condition-advertencia"/g)).toBe(1);
    expect(count(h, /Cómo corregirlo:/g)).toBe(1);
  });
});

describe('Gases', () => {
  it('presión > 300 kPa (Boyle): «invalido» y el volumen propuesto la corrige', () => {
    const input: GasInput = { law: 'boyle', volume: 30, temperature: 25, pressure: 101.3 };
    const r = simulateGas(input);
    const c = gasConditions(r.warnings, input);
    expectAllHandled(c, 1);
    expect(c[0].level).toBe('invalido');
    const v = numberIn(c[0].fix, /a (\d+) mL o más/);
    expect(v).toBe(40);
    expect(simulateGas({ ...input, volume: v }).warnings).toHaveLength(0);
    expect(simulateGas({ ...input, volume: v - 10 }).warnings).toHaveLength(1);
  });
  it('bajo 0 °C: advertencia con la temperatura mínima', () => {
    const input: GasInput = { law: 'charles', volume: 100, temperature: -10, pressure: 101.3 };
    const c = gasConditions(simulateGas(input).warnings, input);
    expectAllHandled(c, 1);
    expect(c[0]).toMatchObject({ level: 'advertencia' });
    expect(c[0].fix).toContain('0 °C o más');
  });
});

describe('Enzimas', () => {
  it('desnaturalización, pH lejano y sin sustrato', () => {
    const input: EnzymeInput = { enzymeId: 'amilasa', temperature: 60, pH: 13, substrate: 0, enzyme: 1, duration: 5 };
    const c = enzymeConditions(simulateEnzyme(input).warnings, input);
    expectAllHandled(c, 3);
    expect(c[0].fix).toContain('45 °C o menos');
    expect(c[2].level).toBe('invalido');
    const [lo, hi] = activePHRange(findEnzyme('amilasa'));
    expect(pHFactor(findEnzyme('amilasa'), lo)).toBeGreaterThanOrEqual(0.2);
    expect(pHFactor(findEnzyme('amilasa'), hi)).toBeGreaterThanOrEqual(0.2);
    expect(pHFactor(findEnzyme('amilasa'), hi + 0.5)).toBeLessThan(0.2);
    // Con el pH propuesto desaparece la advertencia de pH.
    expect(simulateEnzyme({ ...input, pH: hi, temperature: 37, substrate: 10 }).warnings).toHaveLength(0);
  });
});

describe('Densidad', () => {
  it('desborde: el agua inicial propuesta lo evita', () => {
    const input: DensityInput = { materialId: 'aluminio', side: 3.4, initialWater: 70, pushUnder: false };
    const c = densityConditions(simulateDensity(input).warnings, input);
    expectAllHandled(c, 1);
    expect(c[0].level).toBe('invalido');
    const w = numberIn(c[0].fix, /a (\d+) mL o menos/);
    expect(simulateDensity({ ...input, initialWater: w }).warnings).toHaveLength(0);
    expect(simulateDensity({ ...input, initialWater: w + 1 }).warnings).toHaveLength(1);
  });
  it('muestra que flota: indica el alfiler', () => {
    const input: DensityInput = { materialId: 'corcho', side: 2, initialWater: 50, pushUnder: false };
    const c = densityConditions(simulateDensity(input).warnings, input);
    expectAllHandled(c, 1);
    expect(c[0].fix).toContain('Hundir la muestra con un alfiler');
    expect(simulateDensity({ ...input, pushUnder: true }).warnings).toHaveLength(0);
  });
  it('balanza sobrecargada (texto del modelo): arista máxima', () => {
    const input: DensityInput = { materialId: 'plomo', side: 3.4, initialWater: 50, pushUnder: false };
    const c = densityConditions(['La masa supera la capacidad de la balanza (600 g).'], input);
    expectAllHandled(c, 1);
    expect(c[0].fix).toContain('3,7 cm o menos'); // ∛(600/11,34) = 3,75 cm
  });
});

describe('Circuitos (ley de Ohm)', () => {
  const base: CircuitInput = { topology: 'serie', emf: 12, internalResistance: 0, resistances: [1, 1, 1], closed: [true, true, true], mainSwitch: true };
  it('corriente > 3 A: la resistencia mínima propuesta es ε/I_máx', () => {
    const r = solveCircuit(base);
    const c = circuitConditions(r.warnings, base, r);
    expectAllHandled(c, 1);
    expect(c[0].level).toBe('invalido');
    expect(c[0].fix).toContain('debe superar 4,0 Ω');
    expect(solveCircuit({ ...base, resistances: [2, 1, 1.01] }).warnings).toHaveLength(0);
  });
  it('circuito abierto: qué interruptores cerrar según la configuración', () => {
    const open = { ...base, closed: [true, false, true] as [boolean, boolean, boolean] };
    const r = solveCircuit(open);
    const c = circuitConditions(r.warnings, open, r);
    expectAllHandled(c, 1);
    expect(c[0].fix).toContain('R1, R2 y R3');
  });
});

describe('Calidad del agua', () => {
  const base: WaterInput = { river: 'leon', source: 'domestico', riverFlow: 0.5, dischargeFlow: 1000, riverTemp: 30, distance: 5 };
  it('todas las advertencias tienen su corrección, y el caudal propuesto quita el agotamiento de oxígeno', () => {
    const r = simulateRiver(base);
    const c = waterConditions(r.warnings, base);
    expectAllHandled(c, r.warnings.length);
    expect(r.warnings.length).toBeGreaterThan(0);
    const anoxic = c.find((x) => x.text.startsWith('El oxígeno disuelto se agota'));
    if (anoxic) {
      expect(anoxic.level).toBe('invalido');
      const q = /a (\d+) L\/s o menos/.exec(anoxic.fix ?? '');
      if (q) expect(simulateRiver({ ...base, dischargeFlow: Number(q[1]) }).anoxic).toBe(false);
    }
    const dilution = c.find((x) => x.text.startsWith('El vertimiento aporta'));
    expect(dilution).toBeDefined();
    const q = numberIn(dilution!.fix, /a (\d+) L\/s o menos/);
    expect(simulateRiver({ ...base, dischargeFlow: q }).warnings.some((w) => w.startsWith('El vertimiento aporta'))).toBe(false);
  });
  it('drenaje bananero: nota sin control que corregir', () => {
    const input: WaterInput = { ...base, source: 'bananera', riverFlow: 30, dischargeFlow: 10 };
    const c = waterConditions(simulateRiver(input).warnings, input);
    expect(c.find((x) => x.text.startsWith('El drenaje bananero'))?.level).toBe('nota');
  });
});

describe('Cinemática y movimiento', () => {
  it('fin de pista, frenado y reposo', () => {
    const pista = { v0: 10, acceleration: 3, duration: 10 };
    const c1 = kinematicsConditions(simulateRun(pista).warnings, pista);
    expectAllHandled(c1, 1);
    const d = numberIn(c1[0].fix, /a (\d+(?:,\d+)?) s o menos/);
    expect(simulateRun({ ...pista, duration: d }).warnings).toHaveLength(0);

    const freno = { v0: 5, acceleration: -2, duration: 10 };
    const c2 = kinematicsConditions(simulateRun(freno).warnings, freno);
    expectAllHandled(c2, 1);
    expect(c2[0].fix).toContain('2,5 s o menos');
    expect(simulateRun({ ...freno, duration: 2.5 }).warnings).toHaveLength(0);

    const quieto = { v0: 0, acceleration: 0, duration: 5 };
    const c3 = kinematicsConditions(simulateRun(quieto).warnings, quieto);
    expectAllHandled(c3, 1);
    expect(c3[0].level).toBe('invalido');
  });
  it('rapidez media: notas con la alternativa', () => {
    const c = motionConditions(simulateMotion({ moverId: 'balon', start: 0, finish: 20, trip: 'ida' }).warnings);
    expectAllHandled(c, 1);
    expect(c[0].level).toBe('nota');
    expect(c[0].fix).toContain('caminante');
    const c2 = motionConditions(simulateMotion({ moverId: 'corredor', start: 0, finish: 20, trip: 'idavuelta' }).warnings);
    expect(c2[0].fix).toContain('Medir un tramo');
  });
});

describe('Cinética química', () => {
  it('sin catalizador, catalasa desnaturalizada, H₂O₂ insuficiente y mármol muy rápido', () => {
    const r1 = simulateKinetics({ reaction: 'peroxido', concentration: 3, temperature: 25, catalyst: 'ninguno' });
    expectAllHandled(kineticsConditions(r1.warnings), r1.warnings.length);
    const r2 = simulateKinetics({ reaction: 'peroxido', concentration: 3, temperature: 60, catalyst: 'catalasa' });
    const c2 = kineticsConditions(r2.warnings);
    expect(c2.find((c) => c.text.includes('catalasa'))?.fix).toContain('50 °C o menos');
    const r3 = simulateKinetics({ reaction: 'marmol', concentration: 2, temperature: 50, particle: 'polvo' });
    expectAllHandled(kineticsConditions(r3.warnings), r3.warnings.length);
    const c4 = kineticsConditions(['Con 1 % de H₂O₂ solo se pueden producir unos 12 mL de O₂: nunca se llega a 20 mL.']);
    expectAllHandled(c4, 1);
    expect(c4[0].level).toBe('invalido');
  });
});

describe('Conservación de la masa', () => {
  it('presión del frasco sellado: la masa propuesta la deja en 200 kPa o menos', () => {
    const input: ConservationInput = { reaction: 'bicarbonato', system: 'sellado', reactantMass: 5, liquidVolume: 200 };
    const r = simulateConservation(input);
    const c = conservationConditions(r.warnings, input);
    expectAllHandled(c, r.warnings.length);
    const p = c.find((x) => x.text.startsWith('La presión dentro del frasco'));
    expect(p?.level).toBe('invalido');
    const m = numberIn(p!.fix, /a (\d+(?:,\d+)?) g o menos/);
    expect(simulateConservation({ ...input, reactantMass: m }).jarPressure!).toBeLessThanOrEqual(200);
  });
  it('reactivo sobrante, globo y seguridad', () => {
    const c = conservationConditions([
      'Sobra ácido acético del vinagre: 1,2 g no reaccionan.', 'El globo superaría 3 L: un globo escolar podría reventarse.',
      'La lana de acero arde con chispas: usa gafas, pinzas y una superficie que no se queme.', 'El oxígeno del frasco se agota: sobran 0,50 g de hierro sin reaccionar.',
    ], { reaction: 'efervescente', system: 'globo', reactantMass: 8, liquidVolume: 100 });
    expectAllHandled(c, 4);
    expect(c.map((x) => x.level)).toEqual(['nota', 'invalido', 'nota', 'nota']);
  });
});

describe('Equilibrio químico', () => {
  it('FeSCN: absorbancia fuera de rango y precipitado de AgSCN', () => {
    const c = feConditions(solveFeSCN({ ...FE_INITIAL, gotasFe: 10, gotasSCN: 10 }).warnings);
    expectAllHandled(c, c.length);
    const ag = feConditions(solveFeSCN({ ...FE_INITIAL, gotasAg: 5 }).warnings);
    expectAllHandled(ag, 1);
    expect(ag[0].level).toBe('nota');
    const all = feConditions(['Todo el SCN⁻ precipitó como AgSCN (sólido blanco): ya no puede formarse FeSCN²⁺.']);
    expectAllHandled(all, 1);
    expect(all[0].fix).toContain('Preparar tubo nuevo');
    expect(feConditions(['La absorbancia supera 3: fuera del intervalo útil del colorímetro. Diluye la muestra o usa menos gotas.'])[0].level).toBe('invalido');
  });
  it('NO₂/N₂O₄: el volumen o la temperatura propuestos quitan la advertencia', () => {
    const s = { volumen: 20, temperatura: 0 };
    const r = solveNO2(s);
    expect(r.warnings.length).toBeGreaterThan(0);
    const c = no2Conditions(r.warnings, s);
    expectAllHandled(c, r.warnings.length);
    const p = c.find((x) => x.text.startsWith('La presión supera'));
    if (p) expect(solveNO2({ ...s, volumen: numberIn(p.fix, /a (\d+) mL o más/) }).pTotal).toBeLessThanOrEqual(2.5);
    const cond = c.find((x) => x.text.startsWith('La presión parcial del N₂O₄'));
    if (cond) {
      const t = /a (\d+) °C o más/.exec(cond.fix ?? '');
      if (t) expect(solveNO2({ ...s, temperatura: Number(t[1]) }).warnings.some((w) => w.startsWith('La presión parcial'))).toBe(false);
    }
  });
});

describe('Ecosistema', () => {
  it('oscuridad, sin elodea, sobrepoblación, sin descomponedores y exceso de alimento', () => {
    const sim = simulateEcosystem({ ...ECO_DEFAULT, lightHours: 0, plants: 0, snails: 10, fish: 4, decomposers: false, food: 'exceso' });
    const c = ecosystemConditions(sim);
    expectAllHandled(c, sim.warnings.length);
    expect(c.map((x) => x.text.split(':')[0])).toEqual(expect.arrayContaining(['Oscuridad', 'Sin elodea', 'Sin descomponedores', 'Exceso de alimento']));
    expect(c.every((x) => x.level === 'advertencia')).toBe(true);
  });
});

describe('Circuitos simples', () => {
  it('cada advertencia del modelo (con su identificador de pieza) tiene su corrección', () => {
    const c = simpleCircuitConditions([
      '¡Cortocircuito! Una pila entrega 7,5 A por un camino casi sin resistencia: se calienta, se descarga en minutos y puede derramar su electrolito. Desconecta el cable que une sus bornes.',
      'El bombillo B1 recibe 4,20 V, mucho más que sus 2,5 V nominales: en un montaje real su filamento se fundiría pronto.',
      'Por el LED1 pasan 120 mA (máximo 30 mA): un LED real se dañaría. Conecta un resistor en serie.',
      'El LED2 está conectado al revés (patica larga hacia el lado negativo): un LED solo conduce en un sentido. Gíralo.',
      'El zumbador Z1 está al revés: tiene polaridad (+ y −) y no suena así. Gíralo.',
      'La pila P2 está siendo forzada en sentido contrario (está al revés respecto a las demás): se resta en vez de sumar y se puede dañar.',
      'El amperímetro está conectado en paralelo con la fuente: tiene muy poca resistencia y produce un cortocircuito. El amperímetro siempre va en serie.',
      'El circuito está abierto: no hay un camino cerrado de un borne de la pila al otro.',
      'El cálculo no terminó de converger; los valores son aproximados.',
    ]);
    expectAllHandled(c, 9);
    expect(c[1].fix).toContain('el B1');
    expect(c[1].fix).toContain('3,25 V');
    expect(c[3].fix).toContain('«Girar LED2 (invertir polaridad)»');
    expect(c[4].fix).toContain('«Girar Z1 (invertir polaridad)»');
    expect(c[5].fix).toContain('«Girar P2 (invertir polaridad)»');
    expect(c.map((x) => x.level)).toEqual(['invalido', 'invalido', 'invalido', 'advertencia', 'advertencia', 'advertencia', 'invalido', 'advertencia', 'nota']);
  });
});

describe('Soluciones', () => {
  it('solubilidad superada y absorbancia fuera de rango: la dilución propuesta la corrige', () => {
    const input: SolutionInput = { soluteId: 'kmno4', mass: 1, flaskVolume: 100 };
    const r = prepareSolution(input);
    const c = solutionConditions(r.warnings, input, r);
    expectAllHandled(c, r.warnings.length);
    const abs = c.find((x) => x.text.startsWith('La absorbancia'));
    expect(abs?.level).toBe('invalido');
    const m = /pipeta de (\d+) mL en el balón de dilución de (\d+) mL/.exec(abs!.fix!);
    expect(m).not.toBeNull();
    const diluted = prepareSolution({ ...input, dilution: { aliquot: Number(m![1]), dilutionFlask: Number(m![2]) } });
    expect(diluted.warnings.some((w) => w.startsWith('La absorbancia'))).toBe(false);

    const sat: SolutionInput = { soluteId: 'nacl', mass: 50, flaskVolume: 100 };
    const rs = prepareSolution(sat);
    const cs = solutionConditions(rs.warnings, sat, rs);
    expectAllHandled(cs, 1);
    expect(cs[0].fix).toContain('36,000 g o menos');
    expect(cs[0].fix).toContain('250 mL');
  });
});

describe('Fotosíntesis', () => {
  it('bajo el punto de compensación: con la distancia propuesta hay burbujas', () => {
    const input: PhotoInput = { distance: 100, bicarbonate: 0, temperature: 25, color: 'verde', lampOn: true };
    const r = simulatePhotosynthesis(input);
    const c = photoConditions(input, r);
    expectAllHandled(c, 1);
    const d = /a (\d+) cm o menos/.exec(c[0].fix!);
    if (d) {
      expect(simulatePhotosynthesis({ ...input, distance: Number(d[1]) }).net).toBeGreaterThan(0);
      expect(simulatePhotosynthesis({ ...input, distance: Number(d[1]) + 1 }).net).toBeLessThanOrEqual(0);
    }
    const hot = photoConditions({ ...input, distance: 10, temperature: 42 }, simulatePhotosynthesis({ ...input, distance: 10, temperature: 42 }));
    expect(hot[0].fix).toContain('por debajo de 40 °C');
  });
});

describe('Interferencia y difracción', () => {
  it('número de Fresnel: la distancia propuesta lo deja en 0,3 o menos', () => {
    const ap = apertureFor({ kind: 'circular', a_um: 50, d_um: 200, D_um: 500, gratingId: 'r100' });
    const c = interferenceConditions({ ap, wavelength: 650, L: 20, dUm: 200, aUm: 50 });
    expectAllHandled(c, 1);
    expect(c[0].level).toBe('invalido');
    const L = numberIn(c[0].fix, /a (\d+) cm o más/);
    expect(interferenceConditions({ ap, wavelength: 650, L, dUm: 200, aUm: 50 })).toHaveLength(0);
    expect(interferenceConditions({ ap, wavelength: 650, L: L - 1, dUm: 200, aUm: 50 })).toHaveLength(1);
  });
  it('red: primer orden fuera de la pantalla y orden ausente', () => {
    const ap = apertureFor({ kind: 'red', a_um: 50, d_um: 200, D_um: 500, gratingId: 'r600' });
    const c = interferenceConditions({ ap, wavelength: 650, L: 200, dUm: 200, aUm: 50 });
    expectAllHandled(c, 1);
    const L = numberIn(c[0].fix, /a (\d+) cm o menos/);
    expect(interferenceConditions({ ap, wavelength: 650, L, dUm: 200, aUm: 50 })).toHaveLength(0);
    const doble = apertureFor({ kind: 'doble', a_um: 50, d_um: 200, D_um: 500, gratingId: 'r100' });
    const c2 = interferenceConditions({ ap: doble, wavelength: 650, L: 200, dUm: 200, aUm: 50 });
    expect(c2.find((x) => x.text.startsWith('d/a = 4'))?.level).toBe('nota');
  });
});

describe('Extracción de ADN, metabolismo, secuencias e indagación', () => {
  it('extracción: los cuatro límites del modelo', () => {
    const r = simulateExtraction({ fruit: 'fresa', salt: 5, detergent: 20, ethanolT: 30, mash: 0 });
    expectAllHandled(extractionConditions(r.warnings), 4);
  });
  it('FBA: no factible, óptimos alternativos y formiato', () => {
    const c = metabolismConditions({ infeasible: true, alternativeOptima: true, carbon: 'for', knockouts: 2 });
    expectAllHandled(c, 3);
    expect(c[0].fix).toContain('quita eliminaciones');
    expect(c[0].fix).toContain('otra «Fuente de carbono»');
  });
  it('secuencias: códigos ambiguos (nota) y matriz de sustitución', () => {
    const p = parseSequenceText('>x\nACGTNNACGT');
    expectAllHandled(parseConditions(p.warnings), 1);
    expect(alignConditions('adn', 'blosum62')[0].level).toBe('invalido');
    expect(alignConditions('proteina', 'simple')[0].fix).toContain('BLOSUM62');
    expect(alignConditions('adn', 'simple')).toHaveLength(0);
  });
  it('indagación: presupuesto y niveles que coinciden', () => {
    const big: Design = { system: 'rio', levels: 8, min: 0, max: 30, replicates: 4, confound: 'constante', seed: 1 };
    const cb = designConditions(big, designLevels(big), '');
    expectAllHandled(cb, 1);
    expect(cb[0].fix).toContain('con 8 niveles caben hasta 2 réplicas');
    const d: Design = { ...big, max: 1 };
    const c = designConditions(d, designLevels(d), '');
    expectAllHandled(c, 1);
    const fit = numberIn(c.find((x) => x.text.startsWith('Con ese rango'))!.fix, /a (\d+) o menos/);
    expect(designLevels({ ...d, levels: fit })).toHaveLength(fit);
    const bad = designConditions({ ...d, min: 2, max: 1 }, [], 'El valor máximo debe ser mayor que el mínimo.');
    expect(bad[0]).toMatchObject({ level: 'invalido' });
    expect(bad[0].fix).toBeTruthy();
  });
});

describe('adopción en las prácticas', () => {
  it('toda práctica que muestra advertencias del modelo usa su función de condiciones, y la tabla del sistema de diseño la nombra', () => {
    const doc = readFileSync('docs/v2/SISTEMA-DE-DISENO.md', 'utf8');
    const labs = readdirSync('src/labs').filter((f) => f.endsWith('.tsx'));
    let using = 0;
    for (const f of labs) {
      const src = readFileSync(`src/labs/${f}`, 'utf8');
      if (!src.includes('<Warnings')) continue;
      using++;
      const fns = [...new Set([...src.matchAll(/\b([a-z]\w*Conditions)\(/g)].map((m) => m[1]))];
      expect(fns.length, `${f} no usa ninguna función …Conditions`).toBeGreaterThan(0);
      for (const fn of fns) expect(doc, `${f}: ${fn}`).toContain(`\`${fn}\``);
    }
    expect(using).toBe(19);
  });
});
