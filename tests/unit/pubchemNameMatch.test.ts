import { describe, expect, it } from 'vitest';
import { canonName, nameMatch, otherStructure } from '../../src/models/pubchemNameMatch';

/** Regla documentada para revisar los registros de PubChem hallados solo por la fórmula (src/models/pubchemNameMatch.ts). */
describe('revisión de registros hallados por la fórmula · forma canónica de los nombres', () => {
  it('iguala notaciones equivalentes cuando la fórmula ya coincide (cargas, Stock, multiplicadores, «;», fórmula final)', () => {
    expect(canonName('Tin(2+) dihydroxide')).toBe(canonName('tin(II) hydroxide'));
    expect(canonName('Silver;bromate')).toBe(canonName('silver bromate'));
    expect(canonName('Terbium(3+);trihydroxide')).toBe(canonName('terbium hydroxide'));
    expect(canonName('Erbium hydroxide (Er(OH)3)')).toBe(canonName('erbium hydroxide'));
    expect(canonName('Dichlorine pentoxide')).toBe(canonName('dichlorine pentaoxide'));
    expect(canonName('carbon monoxide')).toBe(canonName('carbon oxide'));
    expect(canonName('Aluminium sulphate')).toBe(canonName('aluminum sulfate'));
    expect(canonName('Óxido de hierro(III)')).toBe(canonName('oxido de hierro'));
  });

  it('no iguala nombres de otra sustancia', () => {
    expect(canonName('Rubidium(1+),hydroxide')).not.toBe(canonName('rubidium oxide'));
    expect(canonName('Disilver;dioxido(dioxo)manganese')).not.toBe(canonName('silver manganate'));
    expect(canonName('Chloroperoxyperoxy hypochlorite')).not.toBe(canonName('dichlorine pentoxide'));
  });

  it('nameMatch devuelve el par que coincide (nombre del motor, nombre de PubChem)', () => {
    expect(nameMatch(['tin(II) hydroxide', 'stannous hydroxide'], ['CID 9793862', 'Tin(2+) dihydroxide'])).toEqual({ motor: 'tin(II) hydroxide', pubchem: 'Tin(2+) dihydroxide' });
    expect(nameMatch(['rubidium oxide'], ['Rubidium(1+),hydroxide'])).toBeNull();
  });
});

describe('revisión de registros hallados por la fórmula · otra estructura', () => {
  it('descarta registros de otra clase (hidróxido, peróxido, hidrato, hidruro) que el compuesto no es', () => {
    expect(otherStructure('oxido-basico', 'Rubidium(1+),hydroxide')).toMatch(/hidróxido/);
    expect(otherStructure('oxido-acido', 'Chloroperoxyperoxy hypochlorite')).toMatch(/peróxido/);
    expect(otherStructure('hidroxido', 'Hydroxy(oxo)vanadium;hydrate')).toMatch(/hidrato/);
    expect(otherStructure('sal-haloidea', 'Sodium hydride chloride')).toMatch(/hidruro/);
  });

  it('acepta la palabra de clase cuando el compuesto sí la tiene', () => {
    expect(otherStructure('hidroxido', 'Tin(2+) dihydroxide')).toBeNull();
    expect(otherStructure('oxacido', 'Tellursaeure', 'dihydroxy(dioxo)-lambda6-tellane')).toBeNull();
    expect(otherStructure('peroxido', 'Barium peroxide')).toBeNull();
    expect(otherStructure('hidruro-metalico', 'Calcium hydride')).toBeNull();
    expect(otherStructure('oxisal', 'Silver;bromate')).toBeNull();
  });
});
