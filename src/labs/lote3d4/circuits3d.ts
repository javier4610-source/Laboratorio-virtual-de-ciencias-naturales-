/**
 * «circuitos» (lote 3D-4): el circuito del banco en 3D como un «paisaje de potencial». Funciones PURAS a partir del
 * MISMO resultado del modelo (src/models/circuits.ts → solveCircuit): el circuito está sobre el plano de la mesa con la
 * forma del esquema 2D, y la ALTURA de cada cable es su potencial eléctrico respecto del polo − (escala fija: 1 V = 0,1 de
 * alto). La pila sube el potencial hasta el voltaje de sus bornes; cada bombillo es una rampa que baja su caída de voltaje
 * V = I·R del modelo; un interruptor abierto es un escalón (allí queda toda la diferencia de potencial). Los electrones
 * (puntos) recorren cada tramo con una rapidez proporcional a la corriente del modelo en ese tramo (0,25 A = 1 unidad por
 * segundo, exagerada) y la misma densidad de puntos en todos los tramos, así que en los nudos se conserva la corriente.
 */
import { fmt } from '../../lib/format';
import { brightness, type CircuitResult, type Topology } from '../../models/circuits';
import type { SceneItem, Vec3 } from '../../three/scene';
import { bulb, electronsAlong, wireRods } from './elec3d';

/** Altura de la escena por voltio. */
export const V_SCALE = 0.2;
export const DRIFT_CURRENT = 0.25;
export const DRIFT_CAP = 4;
export const driftSpeed = (i: number) => Math.min(DRIFT_CAP, Math.abs(i) / DRIFT_CURRENT);

/** Coordenadas del esquema 2D del banco (px) → plano de la mesa 3D. */
const P = (x: number, y: number, V: number): Vec3 => [(x - 320) / 100, V * V_SCALE, (y - 160) / 100];

export interface CircuitSceneInput {
  topology: Topology;
  res: CircuitResult;
  emf: number;
  closed: readonly [boolean, boolean, boolean];
  main: boolean;
  t: number;
}

interface Seg { pts: Vec3[]; current: number }

export function circuitScene(inp: CircuitSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; heights: { battery: number; afterR: number[] }; segments: Seg[] } {
  const { topology, res, closed, main } = inp;
  const els = res.elements;
  const Vb = res.terminalVoltage;
  const I = res.open ? 0 : res.totalCurrent;
  const items: SceneItem[] = [{ id: 'mesa', kind: 'plane', center: [0, -0.005, 0], size: [5.6, 2.9], color: 'surface-3' }];
  const wires: Vec3[][] = [];
  const segs: Seg[] = [];
  const posts: Vec3[] = [];
  const afterR: number[] = [0, 0, 0];

  // Pila: del polo − (0 V) al polo + (voltaje en los bornes).
  items.push({ id: 'pila', kind: 'rod', from: P(80, 205, 0), to: P(80, 115, Vb), radius: 0.13, color: '#2b3133', label: 'Pila' });
  items.push({ id: 'pila-mas', kind: 'rod', from: P(80, 125, Vb * 0.93), to: P(80, 115, Vb), radius: 0.135, color: '#c46f22' });
  wires.push([P(80, 260, 0), P(80, 205, 0)], [P(80, 115, Vb), P(80, 60, Vb)]);

  /** Bombillo en rampa entre dos puntos (bajada = su caída de voltaje). */
  const lamp = (i: number, a: Vec3, b: Vec3) => {
    items.push({ id: `R${i + 1}-rampa`, kind: 'rod', from: a, to: b, radius: 0.05, color: 'series-6' });
    const m: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    items.push(...bulb(`R${i + 1}`, m, 0.16, els[i].active ? brightness(els[i].power) : 0, `R${i + 1}`));
  };
  /** Interruptor entre a y b: cerrado = palanca que une; abierto = palanca levantada (escalón de potencial). */
  const sw = (id: string, a: Vec3, b: Vec3, isClosed: boolean) => {
    const tip: Vec3 = isClosed ? b : [a[0] + (b[0] - a[0]) * 0.7, a[1] + 0.22, a[2] + (b[2] - a[2]) * 0.7];
    items.push({ id, kind: 'rod', from: a, to: tip, radius: 0.03, color: 'series-8' });
    items.push({ id: `${id}-mango`, kind: 'sphere', center: tip, radius: 0.05, color: isClosed ? 'ok' : 'bad' });
  };
  // Recorrido convencional por dentro de la pila: del polo − (abajo) al polo + (arriba).
  const bat: Vec3[] = [P(80, 260, 0), P(80, 205, 0), P(80, 115, Vb), P(80, 60, Vb)];
  const flow = (pts: Vec3[], current: number) => { if (current > 1e-9) segs.push({ pts, current }); };

  if (topology === 'serie') {
    // Recorrido convencional desde el polo +: R1, S1, R2, S2, R3, S3, lado derecho, abajo, interruptor general, polo −.
    let V = Vb;
    const xs = [150, 300, 450];
    let x = 80;
    const loop: Vec3[] = [...bat];
    xs.forEach((cx, i) => {
      wires.push([P(x, 60, V), P(cx - 25, 60, V)]);
      const v1 = V - els[i].voltage;
      lamp(i, P(cx - 25, 60, V), P(cx + 25, 60, v1));
      afterR[i] = v1;
      V = v1;
      wires.push([P(cx + 25, 60, V), P(cx + 50, 60, V)]);
      const after = closed[i] ? V : 0;
      sw(`S${i + 1}`, P(cx + 50, 60, V), P(cx + 90, 60, after), closed[i]);
      loop.push(P(cx - 25, 60, afterR[i] + els[i].voltage), P(cx + 25, 60, afterR[i]), P(cx + 90, 60, after));
      V = after;
      x = cx + 90;
    });
    const Vr = V; // lado derecho y abajo hasta el interruptor general
    wires.push([P(x, 60, Vr), P(560, 60, Vr)], [P(560, 60, Vr), P(560, 260, Vr)], [P(560, 260, Vr), P(355, 260, Vr)]);
    sw('S-general', P(355, 260, Vr), P(305, 260, main ? Vr : 0), main);
    wires.push([P(305, 260, main ? Vr : 0), P(80, 260, 0)]);
    posts.push(P(80, 60, Vb), P(560, 60, Vr), P(560, 260, Vr), P(80, 260, 0));
    loop.push(P(560, 60, Vr), P(560, 260, Vr), P(80, 260, 0));
    flow(loop, I);
  } else {
    // Paralelo y mixto: cable de arriba, ramas verticales (interruptor y bombillo) y cable de abajo a 0 V.
    const branchX = topology === 'paralelo' ? [240, 380, 520] : [380, 520];
    const first = topology === 'paralelo' ? 0 : 1;
    let Vtop: number;
    if (topology === 'paralelo') {
      wires.push([P(80, 60, Vb), P(125, 60, Vb)]);
      Vtop = main ? Vb : 0;
      sw('S-general', P(125, 60, Vb), P(175, 60, Vtop), main);
      wires.push([P(175, 60, Vtop), P(520, 60, Vtop)]);
      posts.push(P(80, 60, Vb), P(520, 60, Vtop));
    } else {
      wires.push([P(80, 60, Vb), P(205, 60, Vb)]);
      Vtop = Vb - els[0].voltage;
      lamp(0, P(205, 60, Vb), P(255, 60, Vtop));
      afterR[0] = Vtop;
      wires.push([P(255, 60, Vtop), P(520, 60, Vtop)]);
      posts.push(P(80, 60, Vb), P(520, 60, Vtop));
    }
    // Potencial del cable de abajo (lado derecho): el de una rama cerrada después de su bombillo; si no hay, el de arriba.
    let Vbot = Vtop;
    branchX.forEach((x, k) => {
      const i = first + k;
      const after = closed[i] ? Vtop : 0;
      wires.push([P(x, 60, Vtop), P(x, 85, Vtop)]);
      sw(`S${i + 1}`, P(x, 85, Vtop), P(x, 135, after), closed[i]);
      const v1 = after - els[i].voltage;
      wires.push([P(x, 135, after), P(x, 165, after)]);
      lamp(i, P(x, 165, after), P(x, 215, v1));
      afterR[i] = v1;
      if (closed[i]) Vbot = v1;
      wires.push([P(x, 215, v1), P(x, 260, v1)]);
      posts.push(P(x, 260, v1));
    });
    if (topology === 'paralelo') {
      wires.push([P(520, 260, Vbot), P(80, 260, 0)]);
      // Electrones: pila y cable izquierdo con I total; cable de arriba y de abajo entre ramas con la suma de las de la derecha.
      const Ib = els.map((e) => e.current);
      flow([...bat, P(240, 60, Vtop)], I);
      flow([P(240, 60, Vtop), P(380, 60, Vtop)], Ib[1] + Ib[2]);
      flow([P(380, 60, Vtop), P(520, 60, Vtop)], Ib[2]);
      branchX.forEach((x, i) => flow([P(x, 60, Vtop), P(x, 165, Vtop), P(x, 215, afterR[i]), P(x, 260, afterR[i])], Ib[i]));
      flow([P(520, 260, 0), P(380, 260, 0)], Ib[2]);
      flow([P(380, 260, 0), P(240, 260, 0)], Ib[1] + Ib[2]);
      flow([P(240, 260, 0), P(80, 260, 0)], I);
    } else {
      // Mixto: abajo, de las ramas al interruptor general (240) y al de R1 (160), luego al polo −.
      wires.push([P(520, 260, Vbot), P(265, 260, Vbot)]);
      const Vm = main ? Vbot : 0;
      sw('S-general', P(265, 260, Vbot), P(215, 260, Vm), main);
      wires.push([P(215, 260, Vm), P(185, 260, Vm)]);
      const V1 = closed[0] ? Vm : 0;
      sw('S1', P(185, 260, Vm), P(135, 260, V1), closed[0]);
      wires.push([P(135, 260, V1), P(80, 260, 0)]);
      const Ib = els.map((e) => e.current);
      flow([...bat, P(205, 60, Vb), P(255, 60, Vtop), P(380, 60, Vtop)], I);
      flow([P(380, 60, Vtop), P(520, 60, Vtop)], Ib[2]);
      branchX.forEach((x, k) => flow([P(x, 60, Vtop), P(x, 165, Vtop), P(x, 215, afterR[k + 1]), P(x, 260, afterR[k + 1])], Ib[k + 1]));
      flow([P(520, 260, 0), P(380, 260, 0)], Ib[2]);
      flow([P(380, 260, 0), P(80, 260, 0)], I);
    }
  }

  wires.forEach((w, i) => items.push(...wireRods(`cable-${i}`, w, 0.025, I > 0 ? 'accent' : 'ink-2')));
  // Postes del potencial: del cable al plano de 0 V (para leer la altura).
  posts.filter((p) => p[1] > 0.02).forEach((p, i) => items.push({ id: `poste-${i}`, kind: 'rod', from: [p[0], 0, p[2]], to: p, radius: 0.008, color: 'ink-3', opacity: 0.6 }));

  const electrons: Vec3[] = [];
  for (const s of segs) electrons.push(...electronsAlong(s.pts, driftSpeed(s.current) * inp.t, 0.2, [0, 0.04, 0]));
  if (electrons.length) items.push({ id: 'electrones', kind: 'particles', points: electrons, radius: 0.035, color: 'info' });

  const name = { serie: 'en serie', paralelo: 'en paralelo', mixto: 'mixto (R1 en serie con R2 y R3 en paralelo)' }[topology];
  let description = `Circuito ${name} en 3D como paisaje de potencial: la altura de cada cable es su potencial respecto del polo − de la pila (1 V = 0,2 de alto). La pila sube el potencial a ${fmt(Vb, 2)} V (voltaje en sus bornes). `;
  if (res.open) description += 'El circuito está abierto: no circula corriente, los bombillos no bajan el potencial y toda la diferencia de ' + `${fmt(Vb, 2)} V queda en el interruptor abierto (el escalón). Los electrones no avanzan.`;
  else {
    description += `Cada bombillo es una rampa que baja su voltaje: ${els.map((e) => `R${e.id} ${e.active ? `${fmt(e.voltage, 2)} V con ${fmt(e.current, 3)} A` : 'sin corriente'}`).join('; ')}; al volver al polo − el potencial es 0 V. `;
    description += `Los electrones (puntos azules) salen del polo −, suben por la pila y bajan por los bombillos al revés que la corriente convencional; corriente total ${fmt(I, 3)} A. Su rapidez en cada tramo es proporcional a su corriente${topology === 'serie' ? ' (en serie es la misma en todo el circuito)' : ' (en los nudos la corriente se reparte y se vuelve a juntar)'}.`;
  }
  return { items, extent: 2.5, target: [0, Math.max(0.25, Vb * V_SCALE * 0.45), 0], description, heights: { battery: Vb * V_SCALE, afterR: afterR.map((v) => v * V_SCALE) }, segments: segs };
}
