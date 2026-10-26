import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimControls, resolutionText, simPrimaryAction, simStatusOf, simStatusText, type SimStatus } from '../../src/components/Experiment';

const noop = () => {};
const render = (props: Partial<Parameters<typeof SimControls>[0]> & { status: SimStatus }) =>
  renderToStaticMarkup(createElement(SimControls, { onStart: noop, onPause: noop, onResume: noop, onReset: noop, title: 'Prueba', ...props }));
const buttons = (html: string) => [...html.matchAll(/<button([^>]*)>(.*?)<\/button>/g)]
  .map((m) => ({ label: m[2].replace(/<[^>]+>/g, ''), disabled: /\bdisabled=""/.test(m[1]) }));

describe('SimControls: estado de la simulación', () => {
  it('simStatusOf: terminada > en curso > en pausa (ya empezó) > lista', () => {
    expect(simStatusOf(false, false)).toBe('listo');
    expect(simStatusOf(true, false)).toBe('en-curso');
    expect(simStatusOf(true, true)).toBe('en-curso');
    expect(simStatusOf(false, true)).toBe('en-pausa');
    expect(simStatusOf(false, true, true)).toBe('terminado');
    expect(simStatusOf(false, false, true)).toBe('terminado');
    // Si el reloj vuelve a correr (Repetir), manda «En curso» aunque la corrida anterior hubiera terminado.
    expect(simStatusOf(true, true, true)).toBe('en-curso');
  });

  it('recorrido iniciar → pausar → reanudar → terminar → repetir con la acción y el texto correctos', () => {
    const path: [SimStatus, string, string | null][] = [
      ['listo', 'Lista para iniciar', 'Iniciar'],
      ['en-curso', 'En curso', 'Pausar'],
      ['en-pausa', 'En pausa', 'Reanudar'],
      ['en-curso', 'En curso', 'Pausar'],
      ['terminado', 'Terminada', 'Repetir'],
    ];
    for (const [status, text, label] of path) {
      expect(simStatusText(status)).toBe(text);
      expect(simPrimaryAction(status, true)?.label ?? null).toBe(label);
    }
    expect(simPrimaryAction('en-pausa', true)?.kind).toBe('resume');
    expect(simPrimaryAction('terminado', true)?.kind).toBe('repeat');
  });

  it('rótulos propios del laboratorio (se conservan los nombres que usan las pruebas E2E)', () => {
    expect(simPrimaryAction('listo', true, 'Disparar', 'Disparar de nuevo')?.label).toBe('Disparar');
    expect(simPrimaryAction('terminado', true, 'Disparar', 'Disparar de nuevo')?.label).toBe('Disparar de nuevo');
    expect(simPrimaryAction('en-curso', true, 'Disparar')?.label).toBe('Pausar');
  });

  it('sin onPause no hay botón principal mientras corre', () => {
    expect(simPrimaryAction('en-curso', false)).toBeNull();
    expect(render({ status: 'en-curso', onPause: undefined })).not.toContain('Pausar');
  });
});

describe('SimControls: marcado accesible', () => {
  it('grupo rotulado, estado en role="status" y botones según el estado', () => {
    const html = render({ status: 'listo', startLabel: 'Soltar el carrito' });
    expect(html).toMatch(/role="group" aria-labelledby="([^"]+)-t"/);
    expect(html).toContain('>Prueba</span>');
    expect(html).toMatch(/role="status"><span class="sim-dot" aria-hidden="true"><\/span>Lista para iniciar/);
    expect(buttons(html)).toEqual([{ label: 'Soltar el carrito', disabled: false }, { label: 'Reiniciar', disabled: true }]);
    expect(buttons(render({ status: 'en-curso' }))).toEqual([{ label: 'Pausar', disabled: false }, { label: 'Reiniciar', disabled: false }]);
    expect(buttons(render({ status: 'en-pausa' }))).toEqual([{ label: 'Reanudar', disabled: false }, { label: 'Reiniciar', disabled: false }]);
    expect(render({ status: 'en-pausa' })).toContain('En pausa');
  });

  it('resetDisabled habilita Reiniciar antes de iniciar (preparación previa) y disabled bloquea ambos', () => {
    expect(buttons(render({ status: 'listo', resetDisabled: false }))[1].disabled).toBe(false);
    expect(buttons(render({ status: 'en-curso', disabled: true })).every((b) => b.disabled)).toBe(true);
  });

  it('el avance es una barra con valor y texto equivalente (t = … de … s)', () => {
    const html = render({ status: 'en-pausa', progress: { value: 12, max: 60, unit: 's', label: 't' } });
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="20"');
    expect(html).toContain('aria-valuetext="t = 12 de 60 s"');
    expect(html).toContain('width:20%');
    // Valores fuera del intervalo se recortan a 0–100 %.
    expect(render({ status: 'terminado', progress: { value: 70, max: 60, unit: 's' } })).toContain('aria-valuenow="100"');
    // Sin máximo positivo no se dibuja barra.
    expect(render({ status: 'listo', progress: { value: 0, max: 0, unit: 'h' } })).not.toContain('progressbar');
  });
});

describe('Readout: texto de la resolución', () => {
  it('usa coma decimal y los decimales del paso', () => {
    expect(resolutionText(0.01, 's')).toBe('resolución 0,01 s');
    expect(resolutionText(0.001, 'm')).toBe('resolución 0,001 m');
    expect(resolutionText(1, 'mL')).toBe('resolución 1 mL');
    expect(resolutionText(0.1, 'ms')).toBe('resolución 0,1 ms');
  });
});

/** Prácticas que adoptaron la barra común (ver la tabla de adopción en docs/v2/SISTEMA-DE-DISENO.md). */
const ADOPTED = [
  'CollisionsLab', 'ConductionLab', 'ConservationLab', 'EcosystemLab', 'EnergyLab', 'ExpressionLab', 'FoodWebLab', 'GasLab', 'HeatLab',
  'InductionLab', 'InquiryLab', 'KinematicsLab', 'KineticPotentialLab', 'KineticsLab', 'MotionLab', 'NewtonLab', 'OsmosisLab', 'PendulumLab',
  'PhotoLab', 'ProjectileLab', 'RespirationLab', 'WavesLab', 'WorkLab',
];

describe('adopción de SimControls', () => {
  it('cada práctica adoptada usa el componente con pausa y la tabla del sistema de diseño la menciona', () => {
    const doc = readFileSync('docs/v2/SISTEMA-DE-DISENO.md', 'utf8');
    for (const lab of ADOPTED) {
      const src = readFileSync(`src/labs/${lab}.tsx`, 'utf8');
      expect(src, lab).toContain('<SimControls');
      expect(src, lab).toMatch(/onPause=/);
      expect(doc, lab).toContain(`\`${lab}\``);
    }
  });
});
