import { describe, expect, it } from 'vitest';
import { ALL_QUESTIONS, PRACTICES, questionById } from '../../src/curriculum';
import { GRADES } from '../../src/curriculum/grades';
import { DATASETS } from '../../src/labs/datasets';
import { CATALOG } from '../../src/curriculum/catalog';
import { LOADER_IDS, loadPractice } from '../../src/curriculum/loader';

describe('integridad del currículo', () => {
  it('el catálogo liviano coincide con las definiciones completas y cada práctica tiene cargador', async () => {
    expect(CATALOG.map((c) => c.id)).toEqual(PRACTICES.map((p) => p.id));
    expect([...LOADER_IDS].sort()).toEqual(PRACTICES.map((p) => p.id).sort());
    for (const meta of CATALOG) {
      const full = await loadPractice(meta.id);
      const picked = { id: full.id, title: full.title, grade: full.grade, area: full.area, topic: full.topic, durationMin: full.durationMin, summary: full.summary, competencies: full.competencies, keywords: full.keywords };
      expect(meta, meta.id).toEqual(picked);
    }
  });

  it('hay al menos una práctica completa por grado (6.º a 11.º)', () => {
    for (const g of GRADES) expect(PRACTICES.some((p) => p.grade === g.id), `grado ${g.id}`).toBe(true);
  });

  it('cada práctica tiene todas las secciones de la estructura uniforme', () => {
    for (const p of PRACTICES) {
      const ctx = p.id;
      expect(p.title, ctx).toBeTruthy();
      expect(p.topic, ctx).toBeTruthy();
      expect(p.problemQuestion, ctx).toMatch(/\?/);
      expect(p.objectives.length, ctx).toBeGreaterThanOrEqual(3);
      expect(p.competencies.length, ctx).toBeGreaterThan(0);
      expect(p.materials.length, ctx).toBeGreaterThan(0);
      expect(p.background.length, ctx).toBeGreaterThan(0);
      expect(p.variables.independent.length * p.variables.dependent.length * p.variables.controlled.length, ctx).toBeGreaterThan(0);
      expect(p.procedure.length, ctx).toBeGreaterThanOrEqual(5);
      expect(p.interpretation.length, ctx).toBeGreaterThanOrEqual(3);
      expect(p.assessment.length, ctx).toBeGreaterThanOrEqual(3);
      expect(p.application.question, ctx).toBeTruthy();
      expect(p.transferQuestionIds.length, ctx).toBeGreaterThan(0);
      expect(p.model.assumptions.length, ctx).toBeGreaterThan(0);
      expect(p.model.limits.length, ctx).toBeGreaterThan(0);
      expect(p.references.length, ctx).toBeGreaterThan(0);
      expect(p.curricularLink.dba, ctx).toMatch(/[Vv]alidar/);
    }
  });

  it('cada práctica tiene un conjunto de datos y sus hipótesis apuntan a columnas numéricas existentes', () => {
    for (const p of PRACTICES) {
      const ds = DATASETS[p.id];
      expect(ds, p.id).toBeDefined();
      for (const pair of p.hypothesis.pairs) {
        const d = ds.find((x) => x.id === pair.datasetId);
        expect(d, `${p.id}:${pair.datasetId}`).toBeDefined();
        for (const key of [pair.x, pair.y]) {
          const col = d!.columns.find((c) => c.key === key);
          expect(col?.numeric, `${p.id}:${key}`).toBe(true);
        }
      }
      for (const d of ds) {
        expect(d.columns.some((c) => c.key === d.defaultX)).toBe(true);
        expect(d.columns.some((c) => c.key === d.defaultY)).toBe(true);
      }
    }
  });

  it('las preguntas tienen identificador único, una respuesta correcta válida y retroalimentación en cada opción', () => {
    const ids = new Set<string>();
    for (const q of ALL_QUESTIONS) {
      expect(ids.has(q.id), `duplicada ${q.id}`).toBe(false);
      ids.add(q.id);
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(3);
      expect(q.options.filter((o) => o.id === q.correct), q.id).toHaveLength(1);
      for (const o of q.options) expect(o.feedback.length, `${q.id}:${o.id}`).toBeGreaterThan(5);
      // la retroalimentación "Correcto" solo puede estar en la opción correcta
      for (const o of q.options) if (o.id !== q.correct) expect(o.feedback.startsWith('Correcto'), `${q.id}:${o.id}`).toBe(false);
      expect(q.explanation.length).toBeGreaterThan(10);
      expect(q.review.length).toBeGreaterThan(5);
    }
  });

  it('las preguntas de transferencia referenciadas existen', () => {
    for (const p of PRACTICES) for (const id of p.transferQuestionIds) expect(questionById(id), id).toBeDefined();
  });

  it('las competencias de las preguntas cubren las tres competencias de Saber 11', () => {
    const comps = new Set(ALL_QUESTIONS.map((q) => q.competency));
    expect([...comps].sort()).toEqual(['explicacion', 'indagacion', 'uso']);
  });
});
