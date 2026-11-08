import { useMemo, useState } from 'react';
import {
  BUILD_GROUPS, buildConditions, buildKey, correctAnswers, domainOf, findGroup, findKey, findOrganism, findTrait, fiveKingdoms, KEYS, ORGANISMS, walkConditions, walkKey,
  type BuildNode, type TraitId,
} from '../models/classification';
import { Notice, Readout, RecordButton, Segmented, Select } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import type { LabProps } from './registry';
import { Scene3D } from '../three';
import { specimenScene, trayScene } from './classification3d';

type Station = 'usar' | 'construir' | 'dominios';

const IDEAS: Idea[] = [
  { id: 'i1', text: 'Los hongos son plantas porque crecen en el suelo y no se mueven.', answer: 'falso', feedback: 'Los hongos no hacen fotosíntesis: se alimentan absorbiendo sustancias de lo que descomponen (o de la hoja del banano, como la sigatoka negra) y su pared celular es de quitina. Por eso forman su propio reino.' },
  { id: 'i2', text: 'Las arañas son insectos.', answer: 'falso', feedback: 'Las arañas tienen 8 patas, el cuerpo en dos partes y no tienen antenas: son arácnidos. Los insectos, como la hormiga arriera, tienen 6 patas, tres regiones del cuerpo y antenas.' },
  { id: 'i3', text: 'Las bacterias y las arqueas se parecen al microscopio, pero pertenecen a dominios distintos.', answer: 'cierto', feedback: 'Las dos son células sin núcleo. Carl Woese (1977–1990) comparó su ARN ribosómico y sus membranas y descubrió que las arqueas son tan distintas de las bacterias como de nosotros: por eso hay tres dominios.' },
  { id: 'i4', text: 'Una clave dicotómica sirve para identificar cualquier ser vivo del planeta.', answer: 'falso', feedback: 'Una clave solo funciona para los organismos para los que se escribió. Un organismo nuevo llegará a un nombre equivocado: por eso los biólogos escriben claves para cada región y cada grupo.' },
  { id: 'i5', text: 'Un pez, un sapo y una iguana tienen columna vertebral.', answer: 'cierto', feedback: 'Los tres son vertebrados, igual que las aves y los mamíferos. Se separan por la piel y la respiración: aletas y branquias, piel húmeda, o piel seca con escamas.' },
];

function KeyTree({ node }: { node: BuildNode }) {
  if (!node.trait || node.useless || !node.yes || !node.no) {
    return <li>{node.members.length === 1 ? <strong>{node.members[0].common}</strong> : <span>Falta separar: {node.members.map((o) => o.common).join(', ')}</span>}</li>;
  }
  const t = findTrait(node.trait);
  return (
    <li>
      <span>{t.yes}</span>
      <ul><KeyTree node={node.yes} /></ul>
      <span>{t.no}</span>
      <ul><KeyTree node={node.no} /></ul>
    </li>
  );
}

export default function ClassificationLab({ api }: LabProps) {
  const [station, setStation] = useState<Station>('usar');
  const [keyId, setKeyId] = useState('reinos');
  const [orgId, setOrgId] = useState('arriera');
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [groupId, setGroupId] = useState('animales');
  const [choices, setChoices] = useState<Record<string, TraitId>>({});

  const key = findKey(keyId);
  const org = findOrganism(orgId);
  const walk = useMemo(() => walkKey(key, answers), [key, answers]);
  const right = useMemo(() => (key.members(org) ? correctAnswers(key, org) : []), [key, org]);
  const wconds = useMemo(() => (walk.result !== null || !key.members(org) ? walkConditions(key, org, answers) : []), [walk.result, key, org, answers]);
  const correct = walk.result !== null && key.members(org) && walk.result === key.resultOf(org);
  const group = findGroup(groupId);
  const built = useMemo(() => buildKey(groupId, choices), [groupId, choices]);
  const bconds = useMemo(() => buildConditions(built), [built]);
  const next = built.pending[0] ?? null;
  const members = useMemo(() => group.members.map(findOrganism), [group]);
  const active = useMemo(() => new Set((next?.members ?? []).map((o) => o.id)), [next]);
  const scene = useMemo(() => (station === 'construir' ? trayScene(members, active) : specimenScene(org)), [station, members, active, org]);

  const resetWalk = () => setAnswers([]);
  const chooseKey = (id: string) => { setKeyId(id); setAnswers([]); };
  const chooseOrg = (id: string) => { setOrgId(id); setAnswers([]); };
  const chooseGroup = (id: string) => { setGroupId(id); setChoices({}); };
  const recordWalk = () => api.addTrial('identificaciones', {
    ejemplar: org.common, cientifico: org.scientific, clave: key.name.replace(/ \(.*/, ''), pasos: answers.length,
    camino: walk.steps.map((s) => `${s.couplet.id}${s.answer ? 'a' : 'b'}`).join(' → '), resultado: walk.result ?? '—', correcto: correct ? 'sí' : 'no',
  });
  const recordKey = () => api.addTrial('claves', {
    grupo: group.name, organismos: built.n, pares: built.couplets, profundidad: built.depth, profundidadMinima: built.minDepth,
    separaTodos: built.resolved ? 'sí' : 'no', inutiles: built.useless.length,
  });

  return (
    <div className="lab-layout">
      <div className="stack">
        <Segmented<Station> label="Estación" value={station} onChange={setStation} options={[{ value: 'usar', label: 'Usar una clave' }, { value: 'construir', label: 'Construir tu clave' }, { value: 'dominios', label: 'Dominios y reinos' }]} />
        {station === 'usar' && (
          <section className="card stack" aria-labelledby="cla-key-h">
            <h3 id="cla-key-h">{key.name}</h3>
            {walk.steps.length > 0 && (
              <ol className="small">
                {walk.steps.map((s) => { const t = findTrait(s.couplet.trait); return <li key={s.couplet.id}>Dilema {s.couplet.id}: {s.answer ? t.yes : t.no}</li>; })}
              </ol>
            )}
            {walk.next && (
              <div className="stack" role="group" aria-labelledby="cla-dil-h">
                <p id="cla-dil-h"><strong>Dilema {walk.next.id}.</strong> Observa el ejemplar y elige la afirmación que lo describe:</p>
                <div className="btn-row">
                  <button type="button" className="btn" onClick={() => setAnswers([...answers, true])}>{walk.next.id}a. {findTrait(walk.next.trait).yes}</button>
                  <button type="button" className="btn" onClick={() => setAnswers([...answers, false])}>{walk.next.id}b. {findTrait(walk.next.trait).no}</button>
                </div>
                <p className="small">Cómo se observa: {findTrait(walk.next.trait).how}</p>
              </div>
            )}
            <Readout items={[
              { k: 'Ejemplar', v: `${org.common} (${org.scientific})` },
              { k: 'La clave llega a', v: walk.result ?? 'aún no: responde el dilema' },
              { k: '¿Coincide con su clasificación?', v: walk.result === null ? '—' : correct ? `sí: ${key.resultOf(org)}` : 'no: revisa tus respuestas' },
              { k: 'Dilemas respondidos', v: `${answers.length}${key.members(org) ? ` de ${right.length}` : ''}` },
            ]} />
            <div className="btn-row">
              <button type="button" className="btn" disabled={answers.length === 0} onClick={() => setAnswers(answers.slice(0, -1))}>Deshacer el último dilema</button>
              <button type="button" className="btn" disabled={answers.length === 0} onClick={resetWalk}>Volver a empezar</button>
            </div>
          </section>
        )}
        {station === 'construir' && (
          <section className="card stack" aria-labelledby="cla-build-h">
            <h3 id="cla-build-h">Tu clave: {group.name}</h3>
            {next ? (
              <div className="stack">
                <Select label={`Carácter para separar: ${next.members.map((o) => o.common).join(', ')}`} value={choices[next.path] ?? ''}
                  onChange={(v) => setChoices({ ...choices, [next.path]: v as TraitId })}
                  options={[{ value: '', label: 'Elige un carácter…' }, ...group.traits.map((t) => ({ value: t, label: findTrait(t).yes }))]} />
                {next.useless && <button type="button" className="btn" onClick={() => { const c = { ...choices }; delete c[next.path]; setChoices(c); }}>Quitar el carácter que no separa</button>}
              </div>
            ) : <Notice kind="ok">Tu clave separa a los {built.n} organismos.</Notice>}
            <ul className="small key-tree"><KeyTree node={built.root} /></ul>
            <Readout items={[
              { k: 'Organismos del grupo', v: String(built.n) },
              { k: 'Dilemas de tu clave', v: `${built.couplets}${built.resolved ? ` (= ${built.n} − 1)` : ''}`, data: true },
              { k: 'Profundidad (dilemas del camino más largo)', v: `${built.depth}; la mínima posible es ⌈log₂ ${built.n}⌉ = ${built.minDepth}` },
              { k: '¿Separa a todos?', v: built.resolved ? 'sí' : `no: faltan ${built.pending.length} grupo(s)` },
            ]} />
          </section>
        )}
        {station === 'dominios' && (
          <section className="card stack" aria-labelledby="cla-dom-h">
            <h3 id="cla-dom-h">Los 25 organismos en tres dominios y en reinos</h3>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Organismos por dominio y reino">
              <table>
                <caption className="sr-only">Nombre común, nombre científico, dominio, reino (seis y cinco reinos) y dónde vive</caption>
                <thead><tr><th scope="col">Organismo</th><th scope="col">Nombre científico</th><th scope="col">Dominio</th><th scope="col">Reino (6)</th><th scope="col">Reino (5)</th><th scope="col">Grupo</th><th scope="col">Dónde vive</th></tr></thead>
                <tbody>{ORGANISMS.map((o) => <tr key={o.id}><th scope="row">{o.common}</th><td><i>{o.scientific}</i></td><td>{domainOf(o)}</td><td>{o.kingdom}</td><td>{fiveKingdoms(o.kingdom)}</td><td>{o.group}</td><td>{o.where}</td></tr>)}</tbody>
              </table>
            </div>
            <Notice kind="info">Tres dominios: Woese, Kandler y Wheelis (1990). Cinco reinos: Whittaker (1969), con Monera para bacterias y arqueas. Los nombres científicos se escriben en cursiva; «sp.» indica una especie del género sin precisar.</Notice>
          </section>
        )}
        {[...(station === 'usar' ? wconds : station === 'construir' ? bconds : [])].map((x) => <ConditionAlert key={x.text} level={x.level} cause={x.text} fix={x.fix} />)}
        <section className="card" aria-labelledby="cla-3d-h">
          <h3 id="cla-3d-h">Vista 3D: {station === 'construir' ? 'bandeja de ejemplares' : 'el ejemplar para observar'}</h3>
          <Scene3D idPrefix="cla" title={station === 'construir' ? 'Bandeja de ejemplares en 3D' : `Ejemplar en 3D: ${org.common}`} items={scene.items} extent={scene.extent} target={scene.target}
            description={scene.description} height={340} initialOrbit={{ yaw: 0.5, pitch: 0.45 }} status="ilustracion"
            statusNote="Formas simplificadas dibujadas con los caracteres del modelo (número de patas, antenas, aletas, flores, conos, esporas, núcleo); colores y tamaños ilustrativos y sin escala entre ejemplares." />
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="cla" intro="Ideas frecuentes sobre la clasificación. Decide si son ciertas o falsas y compruébalo con las claves y los ejemplares." />
      </div>
      <div className="controls">
        {station !== 'construir' && (
          <div className="card stack">
            <h3>Clave y ejemplar</h3>
            <Select label="Clave" value={keyId} onChange={chooseKey} options={KEYS.map((k) => ({ value: k.id, label: k.name }))} />
            <Select label="Ejemplar" value={orgId} onChange={chooseOrg} options={ORGANISMS.map((o) => ({ value: o.id, label: `${o.common} (${o.scientific})` }))} />
            <RecordButton onRecord={recordWalk} disabled={walk.result === null} label="Guardar la identificación en la tabla" />
            <Notice>Observa el ejemplar en 3D y en su descripción: la clave pregunta por un carácter en cada dilema. Para la bacteria y la arquea, el carácter de la membrana se averigua en un laboratorio de microbiología.</Notice>
          </div>
        )}
        {station === 'construir' && (
          <div className="card stack">
            <h3>Grupo para tu clave</h3>
            <Select label="Grupo de organismos" value={groupId} onChange={chooseGroup} options={BUILD_GROUPS.map((g) => ({ value: g.id, label: `${g.name} (${g.members.length})` }))} />
            <button type="button" className="btn" disabled={Object.keys(choices).length === 0} onClick={() => setChoices({})}>Borrar mi clave</button>
            <RecordButton onRecord={recordKey} label="Guardar mi clave en la tabla" />
            <Notice>Elige un carácter para el grupo que falta separar: los que lo tienen van a la primera afirmación y los demás a la segunda. Una buena clave usa caracteres fáciles de observar.</Notice>
          </div>
        )}
      </div>
    </div>
  );
}
