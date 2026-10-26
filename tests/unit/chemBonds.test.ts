import { describe, expect, it } from 'vitest';
import {
  buildReactionScene, frameBonds, ION_ASSEMBLY_LABEL, MOLECULES, moleculeSpecies, speciesFromSdf, toSdf,
  type Reaction3DDef, type Species3D,
} from '../../src/chem';
import { ballRadius, BALL_MIN, BALL_SCALE, covalentBondLength, R_SINGLE, visibleStickFraction } from '../../src/chem/elements';
import { BUNDLED_CONFORMERS } from '../../src/data/conformers';
import { FUNC_RECORDS, funcSpecies } from '../../src/data/quimica/funcionales';
import { ORGANIC_RECORDS } from '../../src/data/quimica/organica';
import { orgSpecies } from '../../src/data/quimica/organicaSpecies';
import { reaction3dDef } from '../../src/components/funcional/reaction3dDefs';
import { ORG_REACTIONS } from '../../src/models/organicReactions';
import { enumerateForgeResults } from '../../src/models/compoundForge';
import { forgeReaction3D, staticView } from '../../src/labs/compoundForge3d';
import { INORGANIC_REACTION_IDS, inorganicReaction } from '../../src/labs/inorganicReactions3d';

/**
 * «Palitos» (enlaces) de los visores 3D: conectividad coherente de TODAS las especies que la aplicación puede dibujar y
 * palitos visibles en el estilo «esferas y palitos».
 *
 * Causa raíz corregida en la v2.5.0: los visores 3Dmol dejaban la esfera por defecto de la biblioteca (0,28 × radio de
 * van der Waals de Bondi). En los enlaces con H esas esferas tapaban el 70–90 % del enlace y, según el giro, el palito
 * no se veía (NH₃, H₂O₂, OH⁻, H₂…). Ahora todas las vistas usan ballRadius (proporcional al radio covalente).
 */

/* ------------------------------------------------------------------ todas las especies */

const all = new Map<string, { s: Species3D; where: string }>();
const add = (s: Species3D, where: string) => { if (!all.has(`${s.id}|${s.atoms.length}`)) all.set(`${s.id}|${s.atoms.length}`, { s, where }); };
const addDef = (d: Reaction3DDef, where: string) => { for (const t of [...d.reactants, ...d.products]) add(t.species, `${where} · ${t.formula}`); };

for (const m of MOLECULES) add(moleculeSpecies(m.id), `biblioteca del kit (${m.id})`);
for (const c of BUNDLED_CONFORMERS) add(speciesFromSdf(c.sdf, { id: `geo-${c.id}`, name: c.name, label: c.formula, geometry: 'pubchem', geometryLabel: '', method: '' }), `geometría molecular (${c.id})`);
for (const r of ORGANIC_RECORDS) if (r.sdf) add(orgSpecies(r.id), `orgánica (${r.id})`);
for (const r of FUNC_RECORDS) if (r.sdf) add(funcSpecies(r.id), `funciones orgánicas (${r.id})`);
const DEFS: { def: Reaction3DDef; where: string }[] = [];
for (const id of INORGANIC_REACTION_IDS) DEFS.push({ def: inorganicReaction(id), where: `reacción inorgánica ${id}` });
for (const r of ORG_REACTIONS) DEFS.push({ def: reaction3dDef(r), where: `reacción orgánica ${r.id}` });
const forge = enumerateForgeResults();
for (const r of forge) {
  const sv = staticView(r.product);
  if (sv.kind === 'molecula') add(sv.species, `taller · ${r.product.key}`);
  if (sv.kind === 'ionico') for (const s of sv.ions) add(s, `taller · ion de ${r.product.key}`);
  const rx = forgeReaction3D(r);
  if ('def' in rx) DEFS.push({ def: rx.def, where: `taller · reacción ${r.route.id} ${r.product.key}` });
}
for (const d of DEFS) addDef(d.def, d.where);
const SPECIES = [...all.values()];

const dist = (s: Species3D, i: number, j: number) => Math.hypot(s.atoms[i].x - s.atoms[j].x, s.atoms[i].y - s.atoms[j].y, s.atoms[i].z - s.atoms[j].z);
const isIonic = (s: Species3D) => s.geometry === 'cristal' || s.geometryLabel === ION_ASSEMBLY_LABEL;
const expectedLength = (a: string, b: string, order: number) => {
  try { return covalentBondLength(a, b, (order >= 1 && order <= 3 ? order : 1) as 1 | 2 | 3); } catch { return covalentBondLength(a, b, 1); }
};
function components(s: Species3D): number[][] {
  const parent = s.atoms.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (const b of s.bonds) parent[find(b.a)] = find(b.b);
  const groups = new Map<number, number[]>();
  s.atoms.forEach((_, i) => { const r = find(i); groups.set(r, [...(groups.get(r) ?? []), i]); });
  return [...groups.values()];
}

describe('palitos · conectividad de todas las especies que se pueden dibujar', () => {
  it('recorre la biblioteca, las prácticas orgánicas y funcionales, la geometría VSEPR, los iones, los ensamblados iónicos y las 3D del taller', () => {
    console.log(`[palitos] ${SPECIES.length} especies distintas (${DEFS.length} reacciones 3D, ${forge.length} combinaciones del taller)`);
    expect(SPECIES.length).toBeGreaterThan(250);
    expect(DEFS.length).toBeGreaterThan(400);
  });

  it('índices dentro de rango, sin enlaces repetidos ni de un átomo consigo mismo, y órdenes válidos 1–3 (Kekulé)', () => {
    const bad: string[] = [];
    for (const { s, where } of SPECIES) {
      const seen = new Set<string>();
      for (const b of s.bonds) {
        const k = `${Math.min(b.a, b.b)}-${Math.max(b.a, b.b)}`;
        if (!Number.isInteger(b.a) || !Number.isInteger(b.b) || b.a < 0 || b.b < 0 || b.a >= s.atoms.length || b.b >= s.atoms.length || b.a === b.b) bad.push(`${where}: índices ${b.a}-${b.b}`);
        if (![1, 2, 3].includes(b.order)) bad.push(`${where}: orden ${b.order}`);
        if (seen.has(k)) bad.push(`${where}: enlace repetido ${k}`);
        seen.add(k);
      }
    }
    expect(bad).toEqual([]);
  });

  it('cada enlace tiene una longitud razonable (±25 % de la suma de radios covalentes de Pyykkö para su orden)', () => {
    const bad: string[] = [];
    for (const { s, where } of SPECIES) for (const b of s.bonds) {
      const L = dist(s, b.a, b.b), want = expectedLength(s.atoms[b.a].el, s.atoms[b.b].el, b.order);
      if (L < 0.75 * want || L > 1.25 * want) bad.push(`${where}: ${s.atoms[b.a].el}${b.a + 1}–${s.atoms[b.b].el}${b.b + 1} = ${L.toFixed(3)} Å (esperado ≈ ${want.toFixed(2)})`);
    }
    expect(bad).toEqual([]);
  });

  it('no falta ningún enlace: dos átomos de un mismo fragmento covalente a distancia de enlace siempre están unidos', () => {
    const bad: string[] = [];
    for (const { s, where } of SPECIES) {
      const bonded = new Set(s.bonds.map((b) => `${Math.min(b.a, b.b)}-${Math.max(b.a, b.b)}`));
      const comp = new Map<number, number>();
      components(s).forEach((g, k) => g.forEach((i) => comp.set(i, k)));
      for (let i = 0; i < s.atoms.length; i++) for (let j = i + 1; j < s.atoms.length; j++) {
        // Entre iones distintos de un sólido iónico no hay enlace que dibujar (es correcto que no haya palito).
        if (isIonic(s) && comp.get(i) !== comp.get(j)) continue;
        const L = dist(s, i, j), lim = 1.15 * ((R_SINGLE[s.atoms[i].el] ?? 1.3) + (R_SINGLE[s.atoms[j].el] ?? 1.3));
        if (L < lim && !bonded.has(`${i}-${j}`)) bad.push(`${where}: ${s.atoms[i].el}${i + 1}–${s.atoms[j].el}${j + 1} a ${L.toFixed(2)} Å sin enlace`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('las moléculas son un solo fragmento conectado; en los sólidos iónicos solo quedan sueltos los iones monoatómicos (con carga) y los iones poliatómicos conservan sus enlaces covalentes', () => {
    const bad: string[] = [];
    let polyIons = 0;
    for (const { s, where } of SPECIES) {
      const groups = components(s);
      if (!isIonic(s)) { if (groups.length !== 1) bad.push(`${where}: ${groups.length} fragmentos sueltos`); continue; }
      for (const g of groups) {
        if (g.length === 1) { if (!s.atoms[g[0]].charge) bad.push(`${where}: átomo ${s.atoms[g[0]].el} suelto y sin carga`); continue; }
        polyIons++;
        const nb = s.bonds.filter((b) => g.includes(b.a)).length;
        if (nb < g.length - 1) bad.push(`${where}: ion poliatómico con ${nb} enlaces para ${g.length} átomos`);
      }
    }
    expect(bad).toEqual([]);
    expect(polyIons).toBeGreaterThan(50);
  });

  it('los iones poliatómicos de las sales del taller llevan sus palitos: SO₄²⁻ (4), NO₃⁻ (3), CO₃²⁻ (3), OH⁻ (1) en CaSO₄, NaNO₃, Na₂CO₃ y Ca(OH)₂', () => {
    const rx = (route: string, key: string) => {
      const r = forge.find((x) => x.route.id === route && x.product.key === key)!;
      const d = forgeReaction3D(r);
      if (!('def' in d)) throw new Error(d.reason);
      return d.def.products[0].species;
    };
    const so4 = rx('neutralizacion', 'oxisal:Ca2-S6');
    expect(so4.bonds.length).toBe(4);
    expect(rx('neutralizacion', 'oxisal:Na1-N5').bonds.length).toBe(3);
    expect(rx('neutralizacion', 'oxisal:Na1-C4').bonds.length).toBe(3);
    expect(rx('oxido-agua', 'hidroxido:Ca2').bonds.length).toBe(2);
  });

  it('toSdf escribe un V2000 que las reglas de columnas de 3Dmol 2.5.5 (parsers/SDF.ts) leen con los mismos átomos, enlaces y órdenes', () => {
    // Copia de las reglas de lectura de 3Dmol.js 2.5.5 (src/parsers/SDF.ts, parseV2000).
    const read3Dmol = (sdf: string) => {
      const lines = sdf.split(/\r?\n|\r/);
      const na = parseInt(lines[3].substring(0, 3)), nb = parseInt(lines[3].substring(3, 6));
      const fmt = lines[3].length > 38 ? lines[3].substring(34, 39) : 'V2000';
      const atoms = lines.slice(4, 4 + na).map((l) => ({ el: l.substring(31, 34).replace(/ /g, ''), x: parseFloat(l.substring(0, 10)) }));
      const bonds = lines.slice(4 + na, 4 + na + nb).map((l) => ({ a: parseInt(l.substring(0, 3)) - 1, b: parseInt(l.substring(3, 6)) - 1, order: parseFloat(l.substring(6)) }));
      return { fmt, atoms, bonds };
    };
    for (const { s, where } of SPECIES) {
      const r = read3Dmol(toSdf(s));
      expect(r.fmt, where).toBe('V2000');
      expect(r.atoms.map((a) => a.el), where).toEqual(s.atoms.map((a) => a.el));
      expect(r.bonds, where).toEqual(s.bonds.map((b) => ({ a: b.a, b: b.b, order: b.order })));
    }
  });

  it('reacción 3D: al inicio, durante y al final los enlaces apuntan a átomos de la escena y los palitos que se conservan nunca se desvanecen', () => {
    for (const { def, where } of DEFS) {
      const sc = buildReactionScene(def);
      for (const t of [0, 0.15, 0.3, 0.45, 0.5, 0.55, 0.7, 0.85, 1]) {
        for (const b of frameBonds(sc, t)) {
          expect(b.a >= 0 && b.b >= 0 && b.a < sc.atoms.length && b.b < sc.atoms.length, `${where} t=${t}`).toBe(true);
          expect(b.opacity, `${where} t=${t}`).toBeGreaterThan(0.01);
        }
      }
      // Al inicio y al final se ven TODOS los enlaces de reactivos y de productos, opacos.
      expect(frameBonds(sc, 0).filter((b) => b.opacity === 1).length, where).toBe(sc.rBonds.length);
      expect(frameBonds(sc, 1).filter((b) => b.opacity === 1).length, where).toBe(sc.pBonds.length);
    }
  });
});

describe('palitos · visibles en «esferas y palitos»', () => {
  it('con las esferas del kit (proporcionales al radio covalente) siempre queda a la vista al menos un tercio de cada palito', () => {
    let worst = { f: 1, where: '' };
    for (const { s, where } of SPECIES) for (const b of s.bonds) {
      const f = visibleStickFraction(s.atoms[b.a].el, s.atoms[b.b].el, dist(s, b.a, b.b));
      if (f < worst.f) worst = { f, where: `${where}: ${s.atoms[b.a].el}–${s.atoms[b.b].el}` };
    }
    console.log(`[palitos] fracción visible mínima del palito: ${(worst.f * 100).toFixed(0)} % (${worst.where})`);
    expect(worst.f).toBeGreaterThanOrEqual(1 / 3);
    expect(ballRadius('H')).toBe(BALL_MIN);
    expect(ballRadius('S')).toBeCloseTo(BALL_SCALE * 1.03, 6);
  });

  it('regresión: con la esfera por defecto de 3Dmol (0,28 × van der Waals de Bondi) los palitos con H quedaban casi tapados', () => {
    const BONDI: Record<string, number> = { H: 1.2, N: 1.55, O: 1.52 };
    const old = (a: string, b: string, L: number) => Math.max(0, L - 0.28 * BONDI[a] - 0.28 * BONDI[b]) / L;
    const nh3 = moleculeSpecies('amoniaco'), h2o2 = moleculeSpecies('h2o2'), h2 = moleculeSpecies('hidrogeno');
    const nh = nh3.bonds.find((b) => nh3.atoms[b.b].el === 'H' || nh3.atoms[b.a].el === 'H')!;
    const oh = h2o2.bonds.find((b) => h2o2.atoms[b.b].el === 'H' || h2o2.atoms[b.a].el === 'H')!;
    expect(old('N', 'H', dist(nh3, nh.a, nh.b))).toBeLessThan(0.25);
    expect(old('O', 'H', dist(h2o2, oh.a, oh.b))).toBeLessThan(0.25);
    expect(old('H', 'H', dist(h2, 0, 1))).toBeLessThan(0.1);
    expect(visibleStickFraction('N', 'H', dist(nh3, nh.a, nh.b))).toBeGreaterThan(0.45);
    expect(visibleStickFraction('H', 'H', dist(h2, 0, 1))).toBeGreaterThan(0.35);
  });
});
