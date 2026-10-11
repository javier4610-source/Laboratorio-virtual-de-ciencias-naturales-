// Reúne el contenido de cada práctica para las guías en PDF (lo lee generar_guias.py).
import { PRACTICES } from '../../src/curriculum/index';
import { SABER_BANK } from '../../src/assessment/bank';
import { DATASETS } from '../../src/labs/datasets';
import { GRADES } from '../../src/curriculum/grades';

export function contenido() {
  return PRACTICES.map((p) => ({
    id: p.id, title: p.title, grade: p.grade, gradeName: GRADES.find((g) => g.id === p.grade)!.name,
    area: p.area, topic: p.topic, durationMin: p.durationMin, summary: p.summary,
    problemQuestion: p.problemQuestion, objectives: p.objectives, competencies: p.competencies,
    curricularLink: p.curricularLink, materials: p.materials, background: p.background,
    hypothesis: p.hypothesis, variables: p.variables, procedure: p.procedure, interpretation: p.interpretation,
    assessment: p.assessment, application: p.application, conclusionGuide: p.conclusionGuide,
    transfer: p.transferQuestionIds.map((id) => SABER_BANK.find((q) => q.id === id)).filter(Boolean),
    datasets: DATASETS[p.id] ?? [],
    model: { name: p.model.name, equations: p.model.equations, assumptions: p.model.assumptions, limits: p.model.limits },
    references: p.references,
  }));
}
