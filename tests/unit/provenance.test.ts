import { describe, expect, it } from 'vitest';
import { newton } from '../../src/curriculum/practices/newton';
import { emptySession } from '../../src/lib/session';
import { buildExperimentRecord, importExperimentRecord, RECORD_FORMAT, validateExperimentRecord } from '../../src/lib/experimentRecord';
import { practiceProvenance, STATUS_LABEL, trialStatusText } from '../../src/lib/provenance';
import { trialsToCSV } from '../../src/lib/report';
import type { PracticeSession } from '../../src/core/types';
import { readFileSync } from 'node:fs';

function sessionWithTrials(): PracticeSession {
  const s = emptySession('newton', 'libre');
  s.hypothesis = { text: 'Si aumento la fuerza, la aceleración aumenta.', pairIndex: 0, trend: 'aumenta' };
  s.measurement = { mode: 'real', counts: { tiempo: 2 } };
  s.trials = [
    { id: 't1', datasetId: 'carrito', createdAt: Date.UTC(2026, 9, 18, 10), values: { superficie: 'Madera', masa: 0.5, fuerza: 1, tiempo: 1.234 }, meta: { v: '1.1.0', medicion: 'real' } },
    { id: 't2', datasetId: 'carrito', createdAt: Date.UTC(2026, 9, 18, 11), values: { superficie: 'Madera', masa: 0.5, fuerza: 2, tiempo: 0.8 }, note: 'repetido' },
  ];
  return s;
}

describe('procedencia de los datos', () => {
  it('ninguna práctica declara evidencia experimental: los datos son de modelo calculado y la escena es ilustración', () => {
    for (const id of ['newton', 'densidad', 'reto']) {
      const p = practiceProvenance(id);
      expect(p.data).toBe('modelo');
      expect(p.scene).toBe('ilustracion');
      expect(p.detail).toMatch(/no son mediciones reales/);
    }
  });
  it('el modo «Instrumento real» y la práctica de datos sintéticos lo dicen explícitamente', () => {
    expect(practiceProvenance('newton', 'real').detail).toMatch(/ruido de medición sintético/);
    expect(trialStatusText('newton', 'real')).toBe(`${STATUS_LABEL.modelo} con ruido de medición sintético`);
    expect(trialStatusText('reto')).toMatch(/datos sintéticos con semilla/);
  });
  it('la exportación CSV agrega la columna de estatus de cada ensayo', () => {
    const csv = trialsToCSV('newton', 'carrito', sessionWithTrials()).split('\n');
    expect(csv[0].endsWith(';Estatus del dato')).toBe(true);
    expect(csv[1].endsWith(';Modelo calculado con ruido de medición sintético')).toBe(true);
    expect(csv[2].endsWith(';Modelo calculado')).toBe(true);
  });
});

describe('registro reproducible del experimento', () => {
  const s = sessionWithTrials();
  const rec = buildExperimentRecord(newton, s, Date.UTC(2026, 9, 18, 12));

  it('contiene pregunta, hipótesis, modelo, versión, semilla y ensayos con estatus', () => {
    expect(rec.formato).toBe(RECORD_FORMAT);
    expect(rec.software.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(rec.pregunta).toBe(newton.problemQuestion);
    expect(rec.hipotesis.texto).toMatch(/aceleración/);
    expect(rec.modelo.ecuaciones.length).toBeGreaterThan(0);
    expect(rec.medicion).toMatchObject({ modo: 'real', lecturas: { tiempo: 2 } });
    expect(rec.medicion.semilla).toMatch(/Determinista/);
    expect(rec.conjuntos).toHaveLength(1);
    expect(rec.conjuntos[0].ensayos.map((t) => t.estatus)).toEqual(['Modelo calculado con ruido de medición sintético', 'Modelo calculado']);
    expect(rec.conjuntos[0].columnas.find((c) => c.clave === 'tiempo')).toMatchObject({ unidad: 's', entrada: false, resolucion: 0.001 });
    expect(rec.estado).toBe('con-datos');
  });

  it('no incluye datos personales ni campos de la sesión que no son científicos', () => {
    const text = JSON.stringify(rec);
    for (const k of ['student', 'name', 'nombre del estudiante', 'pin', 'answers', 'conclusion']) expect(text.toLowerCase()).not.toContain(`"${k}"`);
  });

  it('se valida, se importa en una sesión vacía y reproduce los mismos ensayos (ida y vuelta)', () => {
    const roundTrip = JSON.parse(JSON.stringify(rec));
    expect(validateExperimentRecord(roundTrip, 'newton')).toBeNull();
    const { session, added } = importExperimentRecord(roundTrip, emptySession('newton'));
    expect(added).toBe(2);
    expect(session.trials.map((t) => [t.id, t.datasetId, t.createdAt, t.values, t.note, t.meta])).toEqual(s.trials.map((t) => [t.id, t.datasetId, t.createdAt, t.values, t.note, t.meta]));
    expect(importExperimentRecord(roundTrip, session).added).toBe(0);
  });

  it('rechaza archivos de otro formato, de otra práctica o con columnas o valores inválidos', () => {
    expect(validateExperimentRecord({ formato: 'otro' }, 'newton')).toMatch(/formato desconocido/);
    expect(validateExperimentRecord(rec, 'densidad')).toMatch(/otra práctica/);
    const badCol = JSON.parse(JSON.stringify(rec)); badCol.conjuntos[0].ensayos[0].valores.inventada = 1;
    expect(validateExperimentRecord(badCol, 'newton')).toMatch(/inventada/);
    const badVal = JSON.parse(JSON.stringify(rec)); badVal.conjuntos[0].ensayos[0].valores.masa = { x: 1 };
    expect(validateExperimentRecord(badVal, 'newton')).toMatch(/Valor no válido/);
  });

  it('coincide con el esquema documentado: mismas propiedades de primer nivel, todas obligatorias', () => {
    const schema = JSON.parse(readFileSync(new URL('../../docs/v2/esquema-registro-experimento.json', import.meta.url), 'utf8'));
    expect(Object.keys(rec).sort()).toEqual(Object.keys(schema.properties).sort());
    expect([...schema.required].sort()).toEqual(Object.keys(rec).sort());
    expect(schema.properties.formato.const).toBe(RECORD_FORMAT);
  });
});
