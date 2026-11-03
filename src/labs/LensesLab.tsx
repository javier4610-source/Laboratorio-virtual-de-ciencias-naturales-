import { useMemo, useState } from 'react';
import { BENCH, bench, benchConditions, EYE, EYES, eyeImage, findEye, findLens, LENSES, power, principalRays } from '../models/lenses';
import { fmt } from '../lib/format';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { resolutionText } from '../components/Experiment';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import { useMeasure } from '../components/Measurement';
import { usePublishModel } from '../components/Advanced';
import { instrument } from './instruments';
import type { LabProps } from './registry';
import { Scene3D } from '../three';
import { benchScene, eyeScene } from './lenses3d';

type Station = 'banco' | 'ojo';
const DISTANCES = [{ value: 'inf', label: 'Muy lejos (el tablero desde el fondo, ∞)' }, { value: '100', label: '1 m' }, { value: '50', label: '50 cm' }, { value: '25', label: '25 cm (leer un libro)' }];

const IDEAS: Idea[] = [
  { id: 'i1', text: 'Si se tapa la mitad de una lente con un papel, en la pantalla se ve solo la mitad de la vela.', answer: 'falso', feedback: 'Cada punto de la vela manda rayos a toda la lente; la otra mitad sigue formando la imagen completa, solo que más tenue (llega menos luz).' },
  { id: 'i2', text: 'Una lente convergente siempre forma imágenes invertidas.', answer: 'falso', feedback: 'Si la vela está entre la lente y el foco (d_o < f), la imagen es virtual, derecha y mayor: así funciona la lupa. Pon la vela a 5 cm de la lente de +10 cm.' },
  { id: 'i3', text: 'La imagen real se forma aunque no haya pantalla.', answer: 'cierto', feedback: 'Los rayos se cruzan en el mismo punto haya o no pantalla; la pantalla solo dispersa la luz para que la veamos. Por eso hay que moverla hasta el lugar donde la imagen es nítida.' },
  { id: 'i4', text: 'Las personas miopes ven mal de cerca.', answer: 'falso', feedback: 'El miope ve bien de cerca y mal de lejos: su ojo converge demasiado y la imagen de lo lejano cae DELANTE de la retina. Se corrige con una lente divergente (negativa).' },
  { id: 'i5', text: 'Una lente de +2 D es más «fuerte» (converge más) que una de +10 D.', answer: 'falso', feedback: 'La potencia es P = 1/f: +10 D corresponde a f = 10 cm y +2 D a f = 50 cm. Más dioptrías, más convergencia.' },
];

export default function LensesLab({ api }: LabProps) {
  const [station, setStation] = useState<Station>('banco');
  const [lens, setLens] = useState('c10');
  const [objectX, setObjectX] = useState(10);
  const [lensX, setLensX] = useState(40);
  const [screenX, setScreenX] = useState(55);
  const [objectH, setObjectH] = useState(3);
  const [eye, setEye] = useState('normal');
  const [dist, setDist] = useState('inf');
  const [lensD, setLensD] = useState(0);
  const { measure, real } = useMeasure();

  const input = useMemo(() => ({ lens, objectX, lensX, screenX, objectH }), [lens, objectX, lensX, screenX, objectH]);
  const b = useMemo(() => bench(input), [input]);
  const conds = useMemo(() => benchConditions(input), [input]);
  const L = findLens(lens);
  const ruler = instrument('lentes', 'regla');
  const dO = measure(b.dO, { ...ruler, key: 'dO' });
  const s = measure(b.s, { ...ruler, key: 's' });
  const hi = b.sharp ? measure(Math.abs(b.hi), { ...ruler, key: 'hi' }) : null;
  const dCm = dist === 'inf' ? Infinity : Number(dist);
  const e = findEye(eye);
  const er = useMemo(() => eyeImage(eye, dCm, lensD), [eye, dCm, lensD]);

  usePublishModel(() => ({
    vars: {
      f: { sym: 'f', name: 'Distancia focal', value: L.f, unit: 'cm', decimals: 1 },
      d_o: { sym: 'd_o', name: 'Distancia del objeto', value: b.dO, unit: 'cm', decimals: 1 },
    },
    equations: [{ title: 'Distancia de la imagen (ecuación de las lentes)', lhs: 'd_i', expr: '\\frac{1}{\\frac{1}{[f]} − \\frac{1}{[d_o]}}' }],
  }), [L.f, b.dO]);

  const scene = useMemo(() => (station === 'banco' ? benchScene(input) : eyeScene(eye, dCm, lensD)), [station, input, eye, dCm, lensD]);

  const recordImage = () => api.addTrial('imagenes', {
    lente: L.hidden ? 'misteriosa' : L.name.replace(/ \(.*/, ''), dO, dI: s, invDo: Number((1 / dO).toFixed(4)), invDi: Number((1 / s).toFixed(4)),
    hi: hi ?? 0, aumento: Number((-(s / dO)).toFixed(3)), fCalculada: Number((1 / (1 / dO + 1 / s)).toFixed(2)),
  });
  const recordEye = () => api.addTrial('ojo', { ojo: e.name.replace(/ \(.*/, ''), distancia: Number.isFinite(dCm) ? dCm : 'infinito', lente: lensD, potenciaOjo: Number(er.used.toFixed(2)), imagen: er.where === 'retina' ? 'sobre la retina' : er.where === 'delante' ? 'delante de la retina' : 'detrás de la retina' });

  // dibujo 2D del banco (vista lateral)
  const X = (cm: number) => 20 + cm * 3.3;
  const Yp = (cm: number) => 150 - cm * 12;
  const rays = b.dO > 0 ? principalRays(b.f, objectX, lensX, objectH, b.s > 0 ? screenX : BENCH.length) : [];
  return (
    <div className="lab-layout">
      <div className="stack">
        <Segmented<Station> label="Estación" value={station} onChange={setStation} options={[{ value: 'banco', label: 'Banco óptico' }, { value: 'ojo', label: 'El ojo y las gafas' }]} />
        {station === 'banco' ? (
          <>
            <div className="bench">
              <svg viewBox="0 0 440 300" role="img" aria-labelledby="len-b-t len-b-d">
                <title id="len-b-t">Banco óptico: vela, lente, pantalla y los tres rayos principales</title>
                <desc id="len-b-d">{`Vela en ${fmt(objectX, 1)} cm, lente en ${fmt(lensX, 1)} cm, pantalla en ${fmt(screenX, 1)} cm. ${b.real && !b.atInfinity ? `Imagen ${b.kind} a ${fmt(b.di, 1)} cm de la lente; ${b.sharp ? 'nítida en la pantalla' : 'en la pantalla se ve borrosa'}.` : b.atInfinity ? 'No se forma imagen.' : 'Imagen virtual: no se recoge en la pantalla.'}`}</desc>
                <rect width="440" height="300" rx="14" fill="var(--surface-2)" />
                <line x1="20" y1="150" x2="420" y2="150" stroke="var(--line-strong)" strokeDasharray="4 4" />
                <rect x="16" y="262" width="408" height="10" rx="3" fill="var(--ink-3)" />
                {Array.from({ length: 13 }, (_, k) => <text key={k} x={X(k * 10)} y="290" textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)' }}>{k * 10}</text>)}
                {rays.map((r, k) => <polyline key={k} points={r.pts.map(([x, y]) => `${X(x)},${Yp(y)}`).join(' ')} fill="none" stroke={`var(--series-${k + 1})`} strokeWidth="1.6" />)}
                {rays.map((r, k) => r.back && <line key={`b${k}`} x1={X(r.back[0][0])} y1={Yp(r.back[0][1])} x2={X(r.back[1][0])} y2={Yp(r.back[1][1])} stroke={`var(--series-${k + 1})`} strokeWidth="1.2" strokeDasharray="3 3" />)}
                <rect x={X(objectX) - 4} y={Yp(objectH * 0.7)} width="8" height={150 - Yp(objectH * 0.7) + 110} fill="#f2efe6" stroke="var(--ink-3)" />
                <ellipse cx={X(objectX)} cy={Yp(objectH)} rx="4" ry="9" fill="#f2a32b" />
                <ellipse cx={X(lensX)} cy="150" rx={b.f > 0 ? 6 : 3} ry="40" fill="#7fc8dc" opacity="0.6" stroke="var(--ink-2)" />
                <rect x={X(screenX) - 2} y="80" width="4" height="140" fill="var(--ink-2)" />
                {b.sharp && <line x1={X(screenX) - 4} y1="150" x2={X(screenX) - 4} y2={Yp(b.hi)} stroke="var(--data)" strokeWidth="3" />}
                {[b.f, -b.f].map((df) => lensX + df >= 0 && lensX + df <= 120 && <text key={df} x={X(lensX + df)} y="166" textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink)' }}>{(df > 0) === (b.f > 0) ? 'F′' : 'F'}</text>)}
              </svg>
            </div>
            <Readout items={[
              { k: 'Distancia vela–lente (regla)', v: `d_o = ${fmt(dO, 1)} cm`, data: true, resolution: resolutionText(ruler.resolution, 'cm') },
              { k: 'Distancia lente–pantalla (regla)', v: `${fmt(s, 1)} cm`, data: true, resolution: resolutionText(ruler.resolution, 'cm') },
              { k: 'En la pantalla', v: b.sharp ? 'imagen nítida' : b.blur !== null ? `mancha borrosa de ${fmt(b.blur, 1)} cm` : 'solo una mancha de luz (no hay imagen real)', state: b.sharp ? 'ok' : undefined },
              { k: 'Altura de la imagen (regla)', v: hi !== null ? `${fmt(hi, 1)} cm, invertida` : '—', data: hi !== null, resolution: hi !== null ? resolutionText(ruler.resolution, 'cm') : undefined },
              { k: 'Lente', v: L.hidden ? 'misteriosa: calcula f con 1/f = 1/d_o + 1/d_i' : `f = ${fmt(L.f, 1)} cm; P = ${fmt(power(L.f), 2)} D` },
              { k: 'Imagen (ecuación de las lentes)', v: L.hidden ? 'descúbrela con la pantalla' : b.atInfinity ? 'en el infinito' : `d_i = ${fmt(b.di, 1)} cm; M = ${fmt(b.M, 3)}; ${b.kind}` },
            ]} />
            {conds.map((x) => <ConditionAlert key={x.text} level={x.level} cause={x.text} fix={x.fix} />)}
          </>
        ) : (
          <>
            <Readout items={[
              { k: 'Dónde se forma la imagen', v: er.where === 'retina' ? 'sobre la retina: se ve nítido' : er.where === 'delante' ? 'delante de la retina: se ve borroso' : 'detrás de la retina: se ve borroso', state: er.where === 'retina' ? 'ok' : 'bad' },
              { k: 'Potencia del cristalino', v: `${fmt(er.used, 2)} D (acomoda ${fmt(er.accommodation, 2)} de ${fmt(EYE.amplitude, 0)} D)` },
              { k: 'Punto remoto y punto próximo', v: `${Number.isFinite(e.far) ? (e.far > 0 ? `${fmt(e.far, 0)} cm` : 'más allá del infinito') : 'infinito'}; ${fmt(e.near, 1)} cm` },
              { k: 'Lente correctora recomendada', v: e.correction === 0 ? 'ninguna' : `${e.correction > 0 ? '+' : '−'}${fmt(Math.abs(e.correction), 2)} D (${e.correction > 0 ? 'convergente' : 'divergente'})` },
              { k: 'Explicación', v: e.explain },
            ]} />
          </>
        )}
        <section className="card" aria-labelledby="len-3d-h">
          <h3 id="len-3d-h">Vista 3D: {station === 'banco' ? 'los rayos principales y la imagen' : 'el ojo en corte'}</h3>
          <Scene3D idPrefix="len" title={station === 'banco' ? 'Banco óptico en 3D' : 'Ojo en 3D'} items={scene.items} extent={scene.extent} target={scene.target}
            description={scene.description} height={330} initialOrbit={{ yaw: 0.05, pitch: 0.2 }} status="modelo"
            statusNote={station === 'banco' ? 'Rayos e imagen calculados con la ecuación de las lentes delgadas; las alturas se dibujan ×5 (los rayos siguen siendo rectas y se cruzan en la misma imagen).' : 'Ojo reducido de los textos (lente equivalente a 1,7 cm de la retina); rayos de un punto del eje calculados con las potencias.'} />
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="len" intro="Ideas frecuentes sobre las lentes y la visión. Decide si son ciertas o falsas y compruébalo en el banco óptico y en el ojo." />
      </div>
      <div className="controls">
        {station === 'banco' ? (
          <div className="card stack">
            <h3>Banco óptico</h3>
            <Select label="Lente" value={lens} onChange={setLens} options={LENSES.map((l) => ({ value: l.id, label: l.name }))} />
            <Slider label="Posición de la vela" value={objectX} min={0} max={BENCH.length} step={0.5} unit="cm" decimals={1} onChange={setObjectX} />
            <Slider label="Posición de la lente" value={lensX} min={0} max={BENCH.length} step={0.5} unit="cm" decimals={1} onChange={setLensX} />
            <Slider label="Posición de la pantalla" value={screenX} min={0} max={BENCH.length} step={0.5} unit="cm" decimals={1} onChange={setScreenX} />
            <Slider label="Altura de la llama" value={objectH} min={1} max={5} step={0.5} unit="cm" decimals={1} onChange={setObjectH} />
            <RecordButton onRecord={recordImage} disabled={!b.sharp} label="Guardar la imagen nítida en la tabla" />
            <Notice>{real ? 'Instrumento real: la regla trae el error de ubicar la imagen «nítida» a ojo; repite la medida.' : 'Regla del banco con divisiones de 1 mm.'} Mueve la pantalla hasta que la imagen se vea nítida (mancha menor que 1 mm).</Notice>
          </div>
        ) : (
          <div className="card stack">
            <h3>El ojo</h3>
            <Select label="Ojo" value={eye} onChange={setEye} options={EYES.map((x) => ({ value: x.id, label: x.name }))} />
            <Select label="Distancia del objeto" value={dist} onChange={setDist} options={DISTANCES} />
            <Slider label="Lente correctora" value={lensD} min={-4} max={4} step={0.25} unit="D" decimals={2} onChange={setLensD} />
            <button type="button" className="btn" onClick={() => setLensD(Math.round(e.correction * 100) / 100)}>Poner la lente recomendada</button>
            <RecordButton onRecord={recordEye} label="Guardar el caso del ojo en la tabla" />
            <Notice>Ojo reducido: lente equivalente a {fmt(EYE.retina, 1)} cm de la retina y {fmt(EYE.amplitude, 0)} D de acomodación (convención de los textos).</Notice>
          </div>
        )}
      </div>
    </div>
  );
}
