import { describe, expect, it } from 'vitest';
import {
  absorbedSolar, blackbody, CO2, co2Conditions, co2Forcing, co2Warming, ECS, effectiveTemp, epsilonFor, EPS_288, F2X, layerConditions, layerModel, opaqueLayers, PLANETS, S0, SIGMA,
} from '../../src/models/greenhouse';
import {
  ADA, BERGMAN, DURATION, fastingCategory, fluxesAt, glucoseConditions, ogttCategory, simulateGlucose, stateAt, type GlucoseInput,
} from '../../src/models/glucose';
import {
  BUILD_GROUPS, buildConditions, buildKey, correctAnswers, domainOf, findKey, findOrganism, fiveKingdoms, identify, KEYS, keyMembers, ORGANISMS, TRAITS, validateKey, walkConditions, walkKey,
} from '../../src/models/classification';

describe('efecto invernadero: balance de energía', () => {
  it('constantes: σ de CODATA 2018 y S₀ de Kopp y Lean (2011)', () => {
    expect(SIGMA).toBe(5.670374419e-8);
    expect(S0).toBe(1361);
  });
  it('sin efecto invernadero: T_e = [S(1 − α)/(4σ)]^¼ = 254,6 K con α = 0,30', () => {
    expect(absorbedSolar(1361, 0.3)).toBeCloseTo(238.175, 10);
    expect(effectiveTemp(1361, 0.3)).toBeCloseTo(254.578, 3);
    expect(blackbody(effectiveTemp(1361, 0.3))).toBeCloseTo(238.175, 9);
  });
  it('coincide con la temperatura de cuerpo negro de la NASA Planetary Fact Sheet', () => {
    expect(effectiveTemp(1361, 0.306)).toBeCloseTo(254.0, 1);
    for (const p of PLANETS.filter((x) => x.id !== 'tierra')) expect(effectiveTemp(p.S, p.albedo), p.id).toBeCloseTo(p.tBlackbody, 1);
  });
  it('modelo de una capa: ε = 0 → T_e; ε = 1 → 2^¼·T_e; ε = 0,78 → 288 K y la capa a T_s/2^¼', () => {
    const Te = effectiveTemp(1361, 0.3);
    expect(layerModel({ S: 1361, albedo: 0.3, eps: 0 }).Ts).toBeCloseTo(Te, 12);
    expect(layerModel({ S: 1361, albedo: 0.3, eps: 0 }).Ta).toBeNull();
    expect(layerModel({ S: 1361, albedo: 0.3, eps: 1 }).Ts).toBeCloseTo(Te * 2 ** 0.25, 10);
    expect(layerModel({ S: 1361, albedo: 0.3, eps: 1 }).Ts).toBeCloseTo(302.75, 2);
    const r = layerModel({ S: 1361, albedo: 0.3, eps: EPS_288 });
    expect(r.Ts).toBeCloseTo(288.06, 2);
    expect(r.Ta!).toBeCloseTo(r.Ts / 2 ** 0.25, 10);
    expect(epsilonFor(1361, 0.3, 288)).toBeCloseTo(0.7789, 4);
  });
  it('conserva la energía: en la cima la radiación saliente es la solar absorbida; en la superficie y en la capa entra = sale', () => {
    for (const eps of [0, 0.25, 0.5, 0.78, 1]) {
      const r = layerModel({ S: 1361, albedo: 0.3, eps });
      expect(r.olr, `ε = ${eps}`).toBeCloseTo(r.absorbed, 9);
      expect(r.absorbed + r.layerDown).toBeCloseTo(r.surfaceIR, 9);
      expect(r.layerAbsorbs).toBeCloseTo(r.layerUp + r.layerDown, 9);
      expect(r.incoming).toBeCloseTo(r.reflected + r.absorbed, 9);
    }
  });
  it('n capas opacas: T_s = T_e·(n + 1)^¼ y la de una capa coincide con ε = 1', () => {
    expect(opaqueLayers(1361, 0.3, 0)).toBeCloseTo(effectiveTemp(1361, 0.3), 12);
    expect(opaqueLayers(1361, 0.3, 1)).toBeCloseTo(layerModel({ S: 1361, albedo: 0.3, eps: 1 }).Ts, 10);
    expect(opaqueLayers(1361, 0.3, 3)).toBeCloseTo(effectiveTemp(1361, 0.3) * Math.SQRT2, 10);
  });
  it('más albedo enfría y más absorción infrarroja calienta (monótonas)', () => {
    expect(effectiveTemp(1361, 0.35)).toBeLessThan(effectiveTemp(1361, 0.3));
    expect(layerModel({ S: 1361, albedo: 0.3, eps: 0.8 }).Ts).toBeGreaterThan(layerModel({ S: 1361, albedo: 0.3, eps: 0.7 }).Ts);
  });
  it('forzamiento del CO₂ (Myhre, 1998): 3,71 W/m² al duplicar; 2,07 W/m² de 1750 a 2019; calentamiento = ECS por duplicación', () => {
    expect(F2X).toBeCloseTo(3.7083, 4);
    expect(co2Forcing(2 * CO2.preindustrial)).toBeCloseTo(F2X, 12);
    expect(co2Forcing(CO2.preindustrial)).toBe(0);
    expect(co2Forcing(CO2.y2019)).toBeCloseTo(2.0716, 4);
    expect(co2Warming(2 * CO2.preindustrial, 3).dT).toBeCloseTo(3, 12);
    expect(co2Warming(4 * CO2.preindustrial, 3).dT).toBeCloseTo(6, 12);
    expect(co2Warming(CO2.y2019, 3).dT).toBeCloseTo(1.676, 3);
    expect(co2Warming(CO2.glacial, 3).dT).toBeLessThan(0);
    expect(ECS).toEqual({ best: 3, likely: [2.5, 4], veryLikely: [2, 5] });
  });
  it('avisos: capa opaca, albedo de bola de nieve, sensibilidad fuera del rango del IPCC, CO₂ glacial', () => {
    expect(layerConditions({ S: 1361, albedo: 0.3, eps: 1 }).map((x) => x.text).join()).toMatch(/303 K/);
    expect(layerConditions({ S: 1361, albedo: 0.7, eps: 0.78 }).map((x) => x.text).join()).toMatch(/bola de nieve/);
    expect(co2Conditions(409.9, 6)[0]).toMatchObject({ level: 'advertencia' });
    expect(co2Conditions(409.9, 3)).toEqual([]);
    expect(co2Conditions(160, 3)[0].text).toMatch(/glaciaciones/);
    for (const x of [...layerConditions({ S: 1361, albedo: 0.7, eps: 1 }), ...co2Conditions(160, 6)]) expect(x.fix.length).toBeGreaterThan(10);
  });
  it('rechaza valores imposibles', () => {
    expect(() => layerModel({ S: 1361, albedo: 0.3, eps: 1.2 })).toThrow(RangeError);
    expect(() => effectiveTemp(1361, 1.5)).toThrow(RangeError);
    expect(() => co2Forcing(0)).toThrow(RangeError);
  });
});

const base: GlucoseInput = { profile: 'normal', meal: 'ptog', exerciseStart: null, bolus: 0, insulinOn: true, glucagonOn: true };
describe('homeostasis de la glucosa: modelo mínimo de Bergman con extensiones', () => {
  it('parámetros del modelo mínimo (Furler y otros, 1985, citados por Fisher, 1991)', () => {
    expect(BERGMAN).toEqual({ p1: 0.028735, p2: 0.028344, p3: 5.035e-5, n: 5 / 54 });
  });
  it('en ayunas y sin ejercicio la glucosa se queda en su nivel basal durante 4 h', () => {
    for (const profile of ['normal', 'tipo2', 'tipo1'] as const) {
      const r = simulateGlucose({ ...base, profile, meal: 'ayuno' });
      expect(r.points).toHaveLength(DURATION + 1);
      for (const q of r.points) expect(q.G, profile).toBeCloseTo(r.profile.Gb, 9);
    }
  });
  it('con la insulina bloqueada y sin comida, G − G_b decae como e^(−p₁·t) (solución exacta del modelo mínimo)', () => {
    const r = simulateGlucose({ ...base, meal: 'ayuno', insulinOn: false, G0: 185 });
    const exact = (t: number) => 85 + 100 * Math.exp(-BERGMAN.p1 * t);
    expect(exact(60)).toBeCloseTo(102.83, 2);
    for (const t of [10, 60, 120, 240]) expect(r.points[t].G, `t = ${t}`).toBeCloseTo(exact(t), 7);
  });
  it('persona sana con 75 g: pico ≈ 166 mg/dL hacia los 26 min y 91 mg/dL a las 2 h (normal según la ADA)', () => {
    const r = simulateGlucose(base);
    expect(r.fasting).toBe(85);
    expect(r.peak.G).toBeGreaterThan(150);
    expect(r.peak.G).toBeLessThan(180);
    expect(r.peak.t).toBeGreaterThanOrEqual(20);
    expect(r.peak.t).toBeLessThanOrEqual(40);
    expect(r.at2h).toBeCloseTo(90.7, 0);
    expect(ogttCategory(r.at2h)).toBe('normal');
    expect(r.min.G).toBeGreaterThanOrEqual(ADA.hypo1);
  });
  it('la insulina sube con la glucosa y el glucagón baja después de comer (retroalimentación negativa)', () => {
    const r = simulateGlucose(base);
    const s30 = stateAt(r, 30);
    expect(s30.I).toBeGreaterThan(30);
    expect(s30.N).toBeLessThan(60);
    expect(fluxesAt(r, s30).secretion).toBeGreaterThan(0);
    expect(fluxesAt(r, stateAt(r, 0)).uptake).toBeCloseTo(fluxesAt(r, stateAt(r, 0)).liver, 9);
  });
  it('sin la acción de la insulina la glucosa sube más y tarda más en bajar', () => {
    const on = simulateGlucose(base), off = simulateGlucose({ ...base, insulinOn: false });
    expect(off.peak.G).toBeGreaterThan(on.peak.G + 20);
    expect(off.at2h).toBeGreaterThan(on.at2h + 50);
    expect(glucoseConditions(off).map((x) => x.text).join()).toMatch(/retroalimentación negativa/);
  });
  it('diabetes tipo 2 (ejemplo): ayunas ≥ 126 y 2 h ≥ 200 mg/dL → rango de diabetes; tipo 1 sin insulina rápida, más alta aún', () => {
    const t2 = simulateGlucose({ ...base, profile: 'tipo2' });
    expect(fastingCategory(t2.fasting)).toBe('diabetes');
    expect(ogttCategory(t2.at2h)).toBe('diabetes');
    const t1 = simulateGlucose({ ...base, profile: 'tipo1' });
    expect(t1.at2h).toBeGreaterThan(t2.at2h);
    expect(glucoseConditions(t1).map((x) => x.text).join()).toMatch(/orina/);
  });
  it('tipo 1: 5 U de insulina rápida la normalizan; 8 U producen hipoglucemia con aviso', () => {
    const ok = simulateGlucose({ ...base, profile: 'tipo1', bolus: 5 });
    expect(ok.at2h).toBeLessThan(140);
    expect(ok.min.G).toBeGreaterThanOrEqual(70);
    const hi = simulateGlucose({ ...base, profile: 'tipo1', bolus: 8 });
    expect(hi.min.G).toBeLessThan(70);
    expect(glucoseConditions(hi)[0]).toMatchObject({ level: 'advertencia' });
    expect(glucoseConditions(hi)[0].fix).toMatch(/dosis/);
  });
  it('ejercicio en ayunas: el glucagón evita la hipoglucemia; sin glucagón baja más', () => {
    const w = simulateGlucose({ ...base, meal: 'ayuno', exerciseStart: 0 });
    const wo = simulateGlucose({ ...base, meal: 'ayuno', exerciseStart: 0, glucagonOn: false });
    expect(w.min.G).toBeGreaterThan(70);
    expect(wo.min.G).toBeLessThan(w.min.G - 10);
    expect(Math.max(...w.points.map((q) => q.N))).toBeGreaterThan(80);
    expect(fluxesAt(w, stateAt(w, 20)).exercising).toBe(true);
  });
  it('el almuerzo se absorbe más despacio: pico más bajo', () => {
    expect(simulateGlucose({ ...base, meal: 'almuerzo' }).peak.G).toBeLessThan(simulateGlucose(base).peak.G);
  });
  it('criterios de la ADA (2025)', () => {
    expect([99, 100, 125, 126].map(fastingCategory)).toEqual(['normal', 'prediabetes', 'prediabetes', 'diabetes']);
    expect([139, 140, 199, 200].map(ogttCategory)).toEqual(['normal', 'prediabetes', 'prediabetes', 'diabetes']);
  });
  it('avisos con su corrección y valores fuera de rango', () => {
    expect(glucoseConditions(simulateGlucose({ ...base, bolus: 3 })).some((x) => x.level === 'invalido')).toBe(true);
    for (const x of glucoseConditions(simulateGlucose({ ...base, profile: 'tipo1', meal: 'ayuno', bolus: 6 }))) expect(x.fix.length).toBeGreaterThan(10);
    expect(() => simulateGlucose({ ...base, bolus: 20 })).toThrow(RangeError);
  });
});

describe('clasificación de los seres vivos con claves dicotómicas', () => {
  it('25 organismos con nombre científico, reino y dominio; ids y caracteres válidos', () => {
    expect(ORGANISMS).toHaveLength(25);
    expect(new Set(ORGANISMS.map((o) => o.id)).size).toBe(25);
    const traits = new Set(TRAITS.map((t) => t.id));
    for (const o of ORGANISMS) {
      expect(o.scientific.length, o.id).toBeGreaterThan(4);
      for (const t of o.traits) expect(traits.has(t), `${o.id}: ${t}`).toBe(true);
      expect(o.traits.includes('nucleo')).toBe(domainOf(o) === 'Eukarya');
    }
  });
  it('tres dominios (Woese y otros, 1990) y cinco reinos (Whittaker, 1969)', () => {
    expect(domainOf(findOrganism('ecoli'))).toBe('Bacteria');
    expect(domainOf(findOrganism('halobacteria'))).toBe('Archaea');
    expect(domainOf(findOrganism('levadura'))).toBe('Eukarya');
    expect(fiveKingdoms('Arqueobacterias')).toBe('Monera');
    expect(fiveKingdoms('Eubacterias')).toBe('Monera');
    expect(fiveKingdoms('Hongos')).toBe('Hongos');
  });
  it('cada clave es válida y lleva a cada organismo a su reino o grupo', () => {
    for (const k of KEYS) {
      expect(validateKey(k), k.id).toMatchObject({ ok: true });
      for (const o of keyMembers(k)) expect(identify(k, o), `${k.id}: ${o.id}`).toBe(k.resultOf(o));
    }
    expect(keyMembers(findKey('animales'))).toHaveLength(10);
    expect(keyMembers(findKey('plantas'))).toHaveLength(6);
  });
  it('la hormiga arriera: tiene núcleo, no es unicelular ni hace fotosíntesis y no tiene quitina en la pared → Animales; en la clave de animales, Insectos', () => {
    const o = findOrganism('arriera');
    expect(correctAnswers(findKey('reinos'), o)).toEqual([true, false, false, false]);
    expect(identify(findKey('animales'), o)).toBe('Insectos');
    expect(o.legs).toBe(6);
    expect([findOrganism('arana').legs, findOrganism('cangrejo').legs]).toEqual([8, 10]);
  });
  it('recorrer la clave: respuestas parciales dejan el siguiente dilema; una respuesta equivocada da un aviso con el dilema a revisar', () => {
    const k = findKey('animales');
    const w = walkKey(k, [true]);
    expect(w.result).toBeNull();
    expect(w.next!.id).toBe('2');
    const wrong = walkConditions(k, findOrganism('sapo'), [true, false, false, false, true]);
    expect(walkKey(k, [true, false, false, false, true]).result).toBe('Reptiles');
    expect(wrong[0].text).toMatch(/dilema 5/);
    expect(wrong[0].fix).toMatch(/Vuelve al dilema 5/);
    expect(walkConditions(findKey('plantas'), findOrganism('arriera'), [])[0].level).toBe('invalido');
  });
  it('construir una clave: n − 1 dilemas, profundidad ≥ ⌈log₂ n⌉ y caracteres inútiles marcados', () => {
    for (const g of BUILD_GROUPS) {
      const vectors = g.members.map((id) => g.traits.map((t) => findOrganism(id).traits.includes(t)).join());
      expect(new Set(vectors).size, `${g.id}: los caracteres separan a todos`).toBe(g.members.length);
    }
    const b = buildKey('animales', { '': 'vertebras', a: 'pelo', ab: 'plumas', abb: 'aletas', abbb: 'escamasSecas', b: 'patasArticuladas', ba: 'seisPatas', bab: 'ochoPatas', bb: 'segmentado' });
    expect(b).toMatchObject({ n: 10, couplets: 9, resolved: true, minDepth: 4 });
    expect(b.depth).toBeGreaterThanOrEqual(b.minDepth);
    expect(b.leaves).toHaveLength(10);
    const partial = buildKey('plantas', { '': 'fotosintesis' });
    expect(partial.useless).toHaveLength(1);
    expect(partial.resolved).toBe(false);
    expect(buildConditions(partial)[0].text).toMatch(/todos lo tienen/);
    const greedy = buildKey('microbios', { '': 'nucleo', a: 'quitina', aa: 'unicelular', b: 'eter' });
    expect(greedy).toMatchObject({ couplets: 4, resolved: true, depth: 3, minDepth: 3 });
  });
});
