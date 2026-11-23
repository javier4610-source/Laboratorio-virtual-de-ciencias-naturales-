import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BANK_BY_GRADE, SABER_BANK } from '../../src/assessment/bank';
import { BANK_GRADES, loadBank, loadBankGrade, loadedBankGrade } from '../../src/assessment/banco/cargar';
import { GRADES } from '../../src/curriculum/grades';
import { CATALOG } from '../../src/curriculum/catalog';
import { loadPractice } from '../../src/curriculum/loader';

describe('banco tipo Saber 11 por grado (carga bajo demanda)', () => {
  it('hay un archivo por cada grado del laboratorio y el cargador lista los mismos', () => {
    expect(BANK_GRADES).toEqual(GRADES.map((g) => g.id));
    expect(Object.keys(BANK_BY_GRADE).map(Number)).toEqual([...BANK_GRADES]);
  });

  it('cada pregunta está en el archivo de su grado y los id no se repiten', () => {
    for (const [g, qs] of Object.entries(BANK_BY_GRADE)) for (const q of qs) expect(q.grade, q.id).toBe(Number(g));
    expect(new Set(SABER_BANK.map((q) => q.id)).size).toBe(SABER_BANK.length);
  });

  it('lo cargado por grado es idéntico (los mismos objetos) al banco completo', async () => {
    const loaded = await loadBank();
    expect(loaded.length).toBe(SABER_BANK.length);
    expect(loaded.every((q, i) => q === SABER_BANK[i])).toBe(true);
    for (const g of BANK_GRADES) {
      expect(await loadBankGrade(g)).toBe(BANK_BY_GRADE[g]);
      expect(loadedBankGrade(g)).toBe(BANK_BY_GRADE[g]);
    }
    expect(await loadBankGrade(5)).toEqual([]);
  });

  it('las preguntas de transferencia de cada práctica están en el archivo del grado de la práctica', async () => {
    for (const m of CATALOG) {
      const p = await loadPractice(m.id);
      const ids = new Set(BANK_BY_GRADE[p.grade].map((q) => q.id));
      for (const id of p.transferQuestionIds) expect(ids.has(id), `${p.id}/${id}`).toBe(true);
    }
  });

  it('la página del banco y las prácticas no importan el banco completo', () => {
    for (const f of ['../../src/pages/BankPage.tsx', '../../src/assessment/lookup.ts', '../../src/lib/report.ts', '../../src/curriculum/loader.ts']) {
      const src = readFileSync(new URL(f, import.meta.url), 'utf8');
      expect(src, f).not.toMatch(/from '\.\.?\/(assessment\/)?bank'/);
      expect(src, f).not.toMatch(/banco\/grado\d+'/);
    }
  });
});
