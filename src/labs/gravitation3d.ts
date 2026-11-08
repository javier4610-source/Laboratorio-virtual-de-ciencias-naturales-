/**
 * Órbita de un planeta en 3D (kit src/three). Funciones PURAS con la MISMA órbita integrada del laboratorio
 * (RK4, src/models/gravitation.ts): el Sol en un foco, la trayectoria integrada, el planeta en el instante t con su
 * velocidad (tangente, longitud proporcional a la rapidez) y la fuerza del Sol (hacia el foco, proporcional a 1/r²),
 * y los radios del Sol a las posiciones en 8 instantes igualmente espaciados del período. Las áreas del primer
 * intervalo (junto al perihelio) y del quinto (junto al afelio) se rellenan con puntos: son iguales aunque una sea
 * corta y ancha y la otra larga y angosta. El plano de la órbita se inclina el ángulo real del planeta sobre la
 * eclíptica (se ve al girar la cámara). Escala: la órbita cabe en 2,4 unidades; el Sol y el planeta no están a escala.
 */
import { fmt } from '../lib/format';
import { orbitAt, AU_PER_YEAR_KMS, type OrbitRun } from '../models/gravitation';
import { arrowScale, type SceneItem, type Vec3 } from '../three/scene';

const SUN = '#e3a008';
/** Rapidez: 50 km/s = 1,2 unidades de la escena. */
export const K_SPEED = arrowScale(50, 1.2);
/** Fuerza por unidad de masa: la del Sol a 0,3 UA = 1,1 unidades (escala relativa, proporcional a 1/r²). */
export const K_FORCE = arrowScale(1 / 0.3 ** 2, 1.1);
export const ORBIT_SPAN = 2.4;

export interface OrbitSceneInput { run: OrbitRun; t: number; inclDeg: number; name: string }

/** Escala de la escena (unidades por UA) para que el afelio quede a ORBIT_SPAN del Sol. */
export const sceneScale = (run: OrbitRun) => ORBIT_SPAN / run.ra;

export function orbitScene({ run, t, inclDeg, name }: OrbitSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const s = sceneScale(run);
  const inc = (inclDeg * Math.PI) / 180;
  const P = (x: number, y: number): Vec3 => [x * s, y * s * Math.sin(inc), -y * s * Math.cos(inc)];
  const items: SceneItem[] = [
    { id: 'sol', kind: 'sphere', center: [0, 0, 0], radius: 0.16, color: SUN, label: 'Sol (en un foco de la elipse)', tag: 'Sol' },
    { id: 'ecliptica', kind: 'plane', center: [-run.a * run.e * s, -0.002, 0], size: [2 * run.a * s + 0.5, 2 * run.b * s + 0.5], color: 'line', opacity: 0.35, label: 'plano de la eclíptica (referencia)', tag: '' },
  ];
  // Trayectoria integrada: 96 tramos.
  const N = 96;
  for (let k = 0; k < N; k++) {
    const p = orbitAt(run, (k / N) * run.period), q = orbitAt(run, ((k + 1) / N) * run.period);
    items.push({ id: `orbita-${k}`, kind: 'rod', from: P(p.x, p.y), to: P(q.x, q.y), radius: 0.012, color: 'ink-3', opacity: 0.8 });
  }
  // Radios en 8 instantes iguales y áreas rellenas del 1.º y del 5.º intervalo.
  for (let k = 0; k < 8; k++) {
    const p = orbitAt(run, (k / 8) * run.period);
    items.push({ id: `radio-${k}`, kind: 'rod', from: [0, 0, 0], to: P(p.x, p.y), radius: 0.008, color: 'ink-2', opacity: 0.6 });
  }
  const fill = (k: number): Vec3[] => {
    const pts: Vec3[] = [];
    const t0 = (k / 8) * run.period, t1 = ((k + 1) / 8) * run.period;
    for (let i = 0; i <= 12; i++) {
      const p = orbitAt(run, t0 + ((t1 - t0) * i) / 12);
      for (let j = 1; j <= 6; j++) pts.push(P((p.x * j) / 6, (p.y * j) / 6));
    }
    // El primer punto (ancla del rótulo) es el del medio del arco, en el borde de la órbita.
    const mid = orbitAt(run, (t0 + t1) / 2);
    return [P(mid.x, mid.y), ...pts];
  };
  items.push({ id: 'area-perihelio', kind: 'particles', points: fill(0), radius: 0.022, color: 'series-2', opacity: 0.85, label: 'área barrida en 1/8 del período junto al perihelio', tag: 'área 1' });
  items.push({ id: 'area-afelio', kind: 'particles', points: fill(4), radius: 0.022, color: 'series-3', opacity: 0.85, label: 'área barrida en 1/8 del período junto al afelio (igual)', tag: 'área 2' });

  const st = orbitAt(run, t);
  const here = P(st.x, st.y);
  items.push({ id: 'planeta', kind: 'sphere', center: here, radius: 0.09, color: 'series-5', label: name });
  const vKms = st.v * AU_PER_YEAR_KMS;
  const vdir = Math.hypot(st.vx, st.vy);
  const ux = st.vx / vdir, uy = st.vy / vdir;
  const vv: Vec3 = [ux, uy * Math.sin(inc), -uy * Math.cos(inc)]; // dirección unitaria en el plano inclinado
  const vLen = vKms * K_SPEED;
  items.push({ id: 'velocidad', kind: 'arrow', from: here, vector: [vv[0] * vLen, vv[1] * vLen, vv[2] * vLen], radius: 0.035, color: 'data', label: `velocidad: ${fmt(vKms, 1)} km/s` });
  const fLen = Math.min(2.2, (1 / st.r ** 2) * K_FORCE);
  const toSun: Vec3 = [-here[0] / Math.hypot(...here), -here[1] / Math.hypot(...here), -here[2] / Math.hypot(...here)];
  items.push({ id: 'fuerza', kind: 'arrow', from: here, vector: [toSun[0] * fLen, toSun[1] * fLen, toSun[2] * fLen], radius: 0.035, color: 'bad', label: 'fuerza del Sol (∝ 1/r²)', tag: 'fuerza' });

  const days = st.t * 365.25;
  const description = `${name} en una órbita de semieje ${fmt(run.a, 3)} UA y excentricidad ${fmt(run.e, 3)}, inclinada ${fmt(inclDeg, 2)}° sobre la eclíptica. `
    + `Día ${fmt(days, 0)} de ${fmt(run.period * 365.25, 0)}: está a ${fmt(st.r, 3)} UA del Sol y va a ${fmt(vKms, 1)} km/s (perihelio ${fmt(run.vp * AU_PER_YEAR_KMS, 1)} km/s, afelio ${fmt(run.va * AU_PER_YEAR_KMS, 1)} km/s). `
    + 'La fuerza apunta al Sol y crece al acercarse (1/r²). Los ocho radios marcan posiciones separadas por el mismo tiempo; las áreas rellenas junto al perihelio y al afelio son iguales.';
  return { items, extent: run.a * s + 0.35, target: [-run.a * run.e * s, 0, 0], description };
}
