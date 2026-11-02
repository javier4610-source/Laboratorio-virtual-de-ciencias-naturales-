import { useMemo, useState } from 'react';
import { Scene3D } from '../../three';
import { Select } from '../../components/ui';
import { helixScene, pairFromId, pairInfo } from './helix';

const P = 'xadh3d';

/**
 * «extraccion-adn», actividad de complementariedad: la doble hebra que arma el estudiante como hélice 3D (molde y hebra
 * nueva con su orientación). Los puentes de hidrógeno y los pares que no son complementarios se muestran solo después
 * de «Verificar la doble hebra», igual que las lecturas del laboratorio: la escena no adelanta la respuesta.
 */
export default function ComplementoView3D({ template, built, orientation, verified }: { template: string; built: readonly (string | null)[]; orientation: 'antiparalela' | 'paralela'; verified: boolean }) {
  const [sel, setSel] = useState<number | null>(null);
  const scene = useMemo(() => helixScene({
    id: P, strand1: template, strand2: built, name1: 'hebra molde', name2: 'hebra nueva', orientation, showPairing: verified, selected: sel, color2: 'data',
  }), [template, built, orientation, verified, sel]);
  const chosen = sel !== null && sel < scene.n ? sel : null;
  const info = chosen === null ? null : verified ? pairInfo(template, built, chosen) : `Par ${chosen + 1}: ${template[chosen]} de la molde frente a ${built[chosen] ?? 'un espacio vacío'}. Verifica la doble hebra para ver los puentes de hidrógeno.`;
  return (
    <Scene3D idPrefix={P} title="Doble hebra 3D que construiste" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description + (verified ? '' : ' Los puentes de hidrógeno aparecen al verificar la doble hebra.') + (info ? ` Elegido: ${info}` : '')}
      height={340} initialOrbit={{ yaw: 0.5, pitch: 0.12 }} status="modelo" selectedId={chosen === null ? null : `${P}-b${chosen}-1`}
      onSelect={(id) => { const i = pairFromId(P, id); if (i !== null) setSel(i); }}
      statusNote="Hélice calculada con los parámetros del ADN-B (10,5 pares por vuelta, 3,4 Å por par) y las bases que colocaste; el desfase que forma los surcos es aproximado. Con orientación paralela se dibuja igual para comparar, aunque esa doble hélice no existe.">
      <div className="stack-sm" style={{ marginTop: 8 }}>
        <Select label="Par que quieres ver" value={chosen === null ? '' : String(chosen)} onChange={(v) => setSel(v === '' ? null : Number(v))}
          options={[{ value: '', label: 'Ninguno (toca una base en la escena)' }, ...Array.from({ length: scene.n }, (_, i) => ({ value: String(i), label: `Par ${i + 1}: ${template[i]} – ${built[i] ?? 'vacío'}` }))]} />
        <p className="small" aria-live="polite" style={{ margin: 0 }}>{info ?? 'Elige un par en la lista o tocando una base de la hélice.'}</p>
      </div>
    </Scene3D>
  );
}
