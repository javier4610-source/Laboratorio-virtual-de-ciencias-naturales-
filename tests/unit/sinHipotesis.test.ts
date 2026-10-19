import { describe, expect, it } from 'vitest';
import { PRACTICES } from '../../src/curriculum';
import { practiceById } from '../../src/curriculum';
import { progressPercent, stageDone, STAGES } from '../../src/lib/progress';
import { emptySession } from '../../src/lib/session';
import { buildSyncSummary } from '../../src/lib/syncSummary';
import { sessionFromSummary } from '../../src/lib/classroom';
import { buildReport, validateReport } from '../../src/lib/report';
import type { PracticeSession } from '../../src/core/types';
// @ts-expect-error módulo JavaScript sin tipos
import { validateProgress } from '../../server/app.mjs';

/** Retiro de la etapa de hipótesis (ADR 0006): etapas, progreso, fichas y compatibilidad con datos antiguos. */
const densidad = practiceById('densidad')!;

describe('etapas sin hipótesis', () => {
  it('quedan cinco etapas en el orden pedido por el docente', () => {
    expect(STAGES.map((s) => s.label)).toEqual(['Preparación', 'Experimento', 'Análisis y conclusión', 'Evaluación', 'Modelo y referencias']);
    expect(STAGES.map((s) => s.id)).not.toContain('hipotesis');
  });

  it('el progreso se reparte entre cuatro etapas principales (25 % cada una)', () => {
    const s = emptySession('densidad');
    expect(progressPercent(densidad, s)).toBe(0);
    s.visited = ['preparacion'];
    expect(progressPercent(densidad, s)).toBe(25);
    s.trials = [1, 2, 3].map((i) => ({ id: `t${i}`, datasetId: 'medidas', createdAt: i, values: {} }));
    expect(progressPercent(densidad, s)).toBe(50);
    // El análisis se completa con interpretación y afirmación; ya no exige el veredicto apoya/refuta.
    s.interpretations = { 0: 'La masa aumenta con el volumen.' };
    s.conclusion = { claim: 'La densidad no depende del tamaño.', evidence: '', reasoning: '' };
    expect(stageDone(densidad, s).analisis).toBe(true);
    expect(progressPercent(densidad, s)).toBe(75);
    for (const q of densidad.assessment) s.answers[q.id] = { chosen: 'a', correct: true, attempts: 1, firstTryCorrect: true };
    expect(progressPercent(densidad, s)).toBe(100);
  });

  it('una sesión nueva no tiene campos de hipótesis ni de comparación', () => {
    const s = emptySession('densidad');
    expect(s).not.toHaveProperty('hypothesis');
    expect(s).not.toHaveProperty('comparison');
  });
});

describe('fichas de las prácticas', () => {
  it('ninguna ficha conserva el campo «hypothesis» ni un enunciado de hipótesis', () => {
    expect(PRACTICES.length).toBeGreaterThanOrEqual(56);
    for (const p of PRACTICES) {
      expect(p, p.id).not.toHaveProperty('hypothesis');
      // El fundamento y los objetivos pueden nombrar la hipótesis como concepto científico (chi-cuadrado en Mendel,
      // «hipótesis conceptual» de perturbación en el rastreo génico); los pasos y las preguntas guía no deben pedirle
      // al estudiante que formule su hipótesis ni que compare con ella.
      const texts = [...p.procedure, ...p.interpretation, p.conclusionGuide].join(' ').normalize('NFC');
      expect(texts, p.id).not.toMatch(/\b(tu|mi|su|una) hip[oó]tesis|formula(r)? (la |tu |una )?hip[oó]tesis|apoya(n)? o refuta(n)?/i);
      for (const r of p.relations ?? []) expect(Object.keys(r).every((k) => ['x', 'y', 'xLabel', 'yLabel', 'datasetId', 'allowVary'].includes(k)), p.id).toBe(true);
    }
  });

  it('las 56 fichas migradas conservan al menos una relación para el análisis de tendencia', () => {
    // Prácticas sin relaciones numéricas (talleres de nomenclatura): el tipo permite omitir `relations`.
    const SIN_RELACIONES = new Set(['nomenclatura-inorganica']);
    for (const p of PRACTICES.filter((x) => !SIN_RELACIONES.has(x.id))) expect(p.relations?.length ?? 0, p.id).toBeGreaterThan(0);
  });
});

describe('compatibilidad con sesiones y resúmenes antiguos', () => {
  const oldSession = (): PracticeSession => ({
    ...emptySession('densidad'),
    hypothesis: { text: 'Si aumento el volumen, la masa aumenta.', pairIndex: 0, trend: 'aumenta', savedAt: 1 },
    comparison: { verdict: 'apoya', justification: 'Según los ensayos.' },
    visited: ['preparacion'],
  });

  it('una sesión antigua con hipótesis se sigue leyendo y el progreso la ignora', () => {
    expect(progressPercent(densidad, oldSession())).toBe(25);
  });

  it('el resumen de sincronización ya no envía la hipótesis y el servidor lo acepta', () => {
    const summary = buildSyncSummary(densidad, oldSession(), 0);
    expect(summary).not.toHaveProperty('hypothesis');
    expect(summary).not.toHaveProperty('comparison');
    expect(summary.stages).toEqual(['preparacion']);
    const clean = validateProgress(JSON.parse(JSON.stringify(summary)), Date.now());
    expect(clean.percent).toBe(25);
  });

  it('el servidor sigue aceptando resúmenes antiguos con la etapa «hipotesis» y se restauran sin error', () => {
    const now = Date.now();
    const old = { ...buildSyncSummary(densidad, oldSession(), 0), stages: ['preparacion', 'hipotesis'], percent: 40, hypothesis: { text: 'x', trend: 'aumenta', pairIndex: 0, savedAt: now - 1 }, comparison: { verdict: 'apoya', justification: 'y' } };
    const clean = validateProgress(old, now);
    expect(clean.stages).toEqual(['preparacion', 'hipotesis']);
    const restored = sessionFromSummary('densidad', clean);
    expect(restored.practiceId).toBe('densidad');
    expect(progressPercent(densidad, restored)).toBe(25);
  });
});

describe('informe para el docente (formato lvcn-informe-v1)', () => {
  it('no lleva el texto de la hipótesis, pero conserva los campos vacíos para paneles de versiones anteriores', () => {
    const s: PracticeSession = { ...emptySession('densidad'), hypothesis: { text: 'Mi hipótesis antigua', pairIndex: 0, trend: 'aumenta', savedAt: 1 } };
    const r = buildReport(densidad, s, { name: 'Ana', course: '6-1' });
    expect(validateReport(JSON.parse(JSON.stringify(r)))).toBeNull();
    expect(r.session.hypothesis).toEqual({ text: '', pairIndex: 0, trend: '' });
    expect(r.session.comparison).toEqual({ verdict: '', justification: '' });
    expect(JSON.stringify(r)).not.toContain('Mi hipótesis antigua');
  });
});
