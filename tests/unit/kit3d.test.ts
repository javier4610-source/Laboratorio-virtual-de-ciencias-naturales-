import { describe, expect, it } from 'vitest';
import {
  arrowScale, cameraPosition, clampOrbit, DEFAULT_ORBIT, describeOrbit, labelAnchor, length, orbitFromKey, physicalArrow, projectOrtho,
  projectPerspective, ROTATE_STEP, spreadLabels, viewBasis, dot, type Orbit,
} from '../../src/three/scene';
import { COLOR_TOKENS, luminance, normalizeHex, readPalette, resolveColor, TOKEN_FALLBACK } from '../../src/three/colors';
import { omegaAt, pendulumKinematics, pendulumScene } from '../../src/labs/pendulum3d';
import { cellParts, cellScene, microscopeStatus, PART_FUNCTION } from '../../src/labs/cell3d';
import { angleAt, BOBS, bobRadius, simulatePendulum } from '../../src/models/pendulum';
import { observe, SAMPLES, STRUCTURES } from '../../src/models/microscope';

const close = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('kit 3D: cámara y teclado', () => {
  it('la base de la vista es ortonormal y la cámara queda a la distancia de encuadre', () => {
    for (const o of [DEFAULT_ORBIT, { yaw: -2, pitch: 1.2, zoom: 2 }, { yaw: 3, pitch: -0.9, zoom: 0.7 }] as Orbit[]) {
      const { right, up, back } = viewBasis(o);
      for (const v of [right, up, back]) close(length(v), 1);
      close(dot(right, up), 0); close(dot(right, back), 0); close(dot(up, back), 0);
    }
    const p = cameraPosition({ yaw: 0, pitch: 0, zoom: 1 }, [0, 0, 0], 1, 1);
    expect(p[0]).toBeCloseTo(0); expect(p[1]).toBeCloseTo(0);
    expect(p[2]).toBeCloseTo(1 / Math.sin((20 * Math.PI) / 180), 6);
  });

  it('flechas giran 15°, + y − acercan, Inicio y 0 restablecen; otras teclas no son de la escena', () => {
    const o = DEFAULT_ORBIT;
    close(orbitFromKey(o, 'ArrowRight', o)!.yaw - o.yaw, ROTATE_STEP);
    close(orbitFromKey(o, 'ArrowLeft', o)!.yaw - o.yaw, -ROTATE_STEP);
    close(orbitFromKey(o, 'ArrowUp', o)!.pitch - o.pitch, ROTATE_STEP);
    expect(orbitFromKey(o, '+', o)!.zoom).toBeGreaterThan(o.zoom);
    expect(orbitFromKey(o, '-', o)!.zoom).toBeLessThan(o.zoom);
    const moved = orbitFromKey(orbitFromKey(o, 'ArrowRight', o)!, '+', o)!;
    expect(orbitFromKey(moved, 'Home', o)).toEqual(clampOrbit(o));
    expect(orbitFromKey(moved, '0', o)).toEqual(clampOrbit(o));
    expect(orbitFromKey(o, 'Tab', o)).toBeNull();
    expect(orbitFromKey(o, 'Enter', o)).toBeNull();
    // límites: la inclinación no pasa de ±1,4 rad y el acercamiento queda entre 0,5× y 4×
    let x = o; for (let i = 0; i < 40; i++) x = orbitFromKey(x, 'ArrowUp', o)!;
    expect(x.pitch).toBeCloseTo(1.4);
    for (let i = 0; i < 40; i++) x = orbitFromKey(x, '+', o)!;
    expect(x.zoom).toBe(4);
  });

  it('la proyección en perspectiva coincide con la cámara: el objetivo cae en el centro y la derecha a la derecha', () => {
    const o: Orbit = { yaw: 0.7, pitch: 0.3, zoom: 1 };
    const c = projectPerspective([1, 2, 3], o, [1, 2, 3], 2, 400, 300);
    close(c.x, 200, 1e-6); close(c.y, 150, 1e-6); expect(c.visible).toBe(true);
    const { right, up } = viewBasis(o);
    const r = projectPerspective([1 + right[0], 2 + right[1], 3 + right[2]], o, [1, 2, 3], 2, 400, 300);
    expect(r.x).toBeGreaterThan(200);
    const u = projectPerspective([1 + up[0], 2 + up[1], 3 + up[2]], o, [1, 2, 3], 2, 400, 300);
    expect(u.y).toBeLessThan(150);
    // un punto en el borde de la esfera de encuadre sigue dentro del lienzo
    expect(Math.abs(r.x - 200)).toBeLessThan(200);
    const ortho = projectOrtho([0, 0, 0], o, [0, 0, 0], 2, 400, 300);
    expect([ortho.x, ortho.y]).toEqual([200, 150]);
  });

  it('describe la cámara con números en español', () => {
    expect(describeOrbit({ yaw: Math.PI / 6, pitch: -Math.PI / 12, zoom: 1.5 })).toBe('vista girada 30° e inclinada -15°, acercamiento 1,5×');
  });
});

describe('kit 3D: rótulos', () => {
  it('spreadLabels separa los rótulos que chocan y los mantiene dentro del lienzo', () => {
    const out = spreadLabels([{ x: 100, y: 50, text: 'Pared celular' }, { x: 104, y: 52, text: 'Membrana celular' }, { x: 390, y: 5, text: 'Cloroplastos' }], 400, 300);
    for (const o of out) {
      expect(o.left).toBeGreaterThanOrEqual(2);
      expect(o.left + o.item.text.length * 7 + 14).toBeLessThanOrEqual(398);
      expect(o.bottom).toBeGreaterThanOrEqual(22);
    }
    const [a, b] = ['Pared celular', 'Membrana celular'].map((t) => out.find((o) => o.item.text === t)!);
    expect(Math.abs(a.bottom - b.bottom)).toBeGreaterThanOrEqual(20);
  });
});

describe('kit 3D: vectores', () => {
  it('arrowScale lleva la mayor magnitud a la longitud pedida y physicalArrow conserva la dirección', () => {
    const k = arrowScale(4, 2);
    expect(k).toBe(0.5);
    const a = physicalArrow([1, 1, 1], [0, -4, 0], k)!;
    expect(a.vector).toEqual([0, -2, 0]);
    expect(a.magnitude).toBe(4);
    expect(physicalArrow([0, 0, 0], [0, 0, 1e-6], k)).toBeNull();
    expect(arrowScale(0, 1)).toBe(0);
    expect(labelAnchor({ id: 'v', kind: 'arrow', from: [1, 0, 0], vector: [0, 2, 0], color: 'data' })).toEqual([1, 2, 0]);
  });
});

describe('kit 3D: colores del tema', () => {
  const light = (v: string) => ({ '--data': '#b23a0a', '--surface': '#ffffff', '--ink': ' #0f1b2d ' } as Record<string, string>)[v] ?? '';
  const dark = (v: string) => ({ '--data': '#fb923c', '--surface': '#141c28', '--ink': 'rgb(232, 238, 246)' } as Record<string, string>)[v] ?? '';
  it('resuelve tokens con el lector del tema y usa el respaldo si la variable no existe', () => {
    expect(resolveColor('data', light)).toBe('#b23a0a');
    expect(resolveColor('data', dark)).toBe('#fb923c');
    expect(resolveColor('ink', dark)).toBe('#e8eef6');
    expect(resolveColor('series-3', dark)).toBe(TOKEN_FALLBACK['series-3']);
    expect(resolveColor('#ABC', dark)).toBe('#aabbcc');
    const p = readPalette(dark);
    expect(Object.keys(p)).toEqual([...COLOR_TOKENS]);
    expect(luminance(p.surface)).toBeLessThan(0.05);
    expect(luminance(readPalette(light).surface)).toBeCloseTo(1);
  });
  it('normalizeHex acepta #rgb, #rrggbb(aa) y rgb(); rechaza lo demás', () => {
    expect(normalizeHex('#0F1')).toBe('#00ff11');
    expect(normalizeHex('#0a5a73ff')).toBe('#0a5a73');
    expect(normalizeHex('rgba(10, 90, 115, 0.5)')).toBe('#0a5a73');
    expect(normalizeHex('var(--ink)')).toBeNull();
    expect(normalizeHex('color-mix(in srgb, red, blue)')).toBeNull();
  });
  it('los respaldos son los valores del tema claro de src/tokens.css', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('src/tokens.css', 'utf8');
    const root = css.slice(0, css.indexOf('@media (prefers-color-scheme: dark)'));
    for (const t of COLOR_TOKENS) {
      const m = new RegExp(`--${t}:\\s*(#[0-9a-fA-F]{6})`).exec(root);
      expect(m?.[1].toLowerCase(), t).toBe(TOKEN_FALLBACK[t]);
    }
  });
});

describe('piloto: péndulo en 3D (mismo modelo que el laboratorio)', () => {
  const input = { length: 1, massG: 100, amplitudeDeg: 10, placeId: 'apartado', dampingId: 'ninguno' };
  const run = simulatePendulum(input);
  it('ω(t) interpola las muestras de la integración y es coherente con θ(t)', () => {
    expect(omegaAt(run, 0)).toBe(0);
    const t = run.passages[0];
    const h = 1e-4;
    close(omegaAt(run, t), (angleAt(run, t + h) - angleAt(run, t - h)) / (2 * h), 2e-3);
  });
  it('cinemática: en el punto más bajo la velocidad es horizontal y T = m(g + Lω²) > peso', () => {
    const w = omegaAt(run, run.passages[0]);
    const k = pendulumKinematics(1, 0.1, run.g, 0, w);
    close(k.velocity[1], 0); close(Math.abs(k.velocity[0]), Math.abs(w));
    close(k.tensionMagnitude, 0.1 * (run.g + w * w));
    expect(k.tensionMagnitude).toBeGreaterThan(k.weightMagnitude);
    // energía: v² = 2gL(1 − cos θ₀) (sin amortiguamiento, tolerancia de la integración)
    close(k.speed ** 2, 2 * run.g * (1 - Math.cos((10 * Math.PI) / 180)), 2e-4);
    // en un extremo, la velocidad es nula y la tensión equilibra la componente radial del peso
    const e = pendulumKinematics(1, 0.1, run.g, 0.3, 0);
    close(e.speed, 0); close(e.tensionMagnitude, 0.1 * run.g * Math.cos(0.3));
    close(dot(e.velocity, e.position), 0);
  });
  it('la escena sigue θ(t) del modelo y describe el estado', () => {
    const bob = BOBS[0];
    const t = 0.37;
    const theta = angleAt(run, t);
    const sc = pendulumScene({ run, length: 1, massG: 100, amplitudeDeg: 10, theta, t, released: true, bobRadiusM: bobRadius(100, bob.density), bobColor: bob.color, bobName: bob.name, placeName: 'Apartadó', damped: false });
    const lenteja = sc.items.find((i) => i.id === 'lenteja')!;
    expect(lenteja.kind).toBe('sphere');
    if (lenteja.kind === 'sphere') { close(lenteja.center[0], Math.sin(theta)); close(lenteja.center[1], -Math.cos(theta)); }
    expect(sc.items.map((i) => i.id)).toEqual(expect.arrayContaining(['hilo', 'peso', 'tension', 'velocidad', 'trayectoria']));
    expect(sc.description).toMatch(/^Péndulo en 3D en t = 0,37 s: ángulo \d+°, rapidez \d+,\d{2} m\/s/);
    // la flecha de la velocidad es tangente (perpendicular al hilo)
    const v = sc.items.find((i) => i.id === 'velocidad')!;
    if (v.kind === 'arrow' && lenteja.kind === 'sphere') close(dot(v.vector, lenteja.center), 0, 1e-9);
    // antes de soltar: solo el peso, y la descripción dice que está sostenida
    const rest = pendulumScene({ run, length: 1, massG: 100, amplitudeDeg: 10, theta: run.theta[0], t: 0, released: false, bobRadiusM: 0.01, bobColor: bob.color, bobName: bob.name, placeName: 'Apartadó', damped: false });
    expect(rest.items.some((i) => i.id === 'velocidad' || i.id === 'tension')).toBe(false);
    expect(rest.description).toContain('sostenida a 10° de la vertical');
  });
});

describe('piloto: célula en 3D (datos de la práctica del microscopio)', () => {
  it('dibuja las estructuras de la práctica con sus nombres, más la membrana, y todas tienen función', () => {
    for (const s of SAMPLES) {
      const parts = cellParts(s.id);
      for (const st of STRUCTURES[s.id]) expect(parts.find((p) => p.id === st.id)?.name).toBe(st.name);
      expect(parts.some((p) => p.id === 'membrana')).toBe(true);
      for (const p of parts) expect(PART_FUNCTION[p.id].length).toBeGreaterThan(40);
      const sc = cellScene(s.id, null);
      expect(sc.items.map((i) => i.id).sort()).toEqual(parts.map((p) => p.id).sort());
      expect(sc.items.every((i) => i.selectable && i.label)).toBe(true);
      expect(sc.extent).toBeGreaterThan(s.lengthUm / 2);
    }
    expect(cellParts('mucosa').some((p) => p.id === 'pared')).toBe(false);
    expect(cellParts('elodea').map((p) => p.id)).toContain('cloroplastos');
  });
  it('enlaza la estructura elegida con la observación actual y no revela el reino', () => {
    const obs = observe({ sampleId: 'mucosa', stain: 'ninguna', objective: 40, focus: 47 });
    const nucleo = cellParts('mucosa').find((p) => p.id === 'nucleo')!;
    expect(microscopeStatus(nucleo, obs)).toMatch(/no se ve: .*tinci/);
    const teñida = observe({ sampleId: 'mucosa', stain: 'azul', objective: 40, focus: 47 });
    expect(microscopeStatus(nucleo, teñida)).toMatch(/se ve\.$/);
    const sc = cellScene('cebolla', 'nucleo');
    expect(sc.description).toContain('Elegida: Núcleo.');
    expect(sc.description).not.toMatch(/vegetal|animal|hongo/i);
  });
});
