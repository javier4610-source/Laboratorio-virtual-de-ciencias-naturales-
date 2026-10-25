import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Segmented } from '../components/ui';
import { playSound } from '../lib/sound';
import type { RouteId } from '../models/compoundForge';
import type { LabProps } from './registry';

const CompoundForge = lazy(() => import('./CompoundForge'));

type Station = 'banco' | 'taller';

/**
 * Estación «Taller de formación de compuestos» compartida por las prácticas de óxidos e hidróxidos, ácidos y sales y
 * nomenclatura inorgánica. El banco original queda intacto (montado y oculto mientras se usa el taller, para no perder
 * su estado); el taller se carga bajo demanda la primera vez que se abre.
 */
export function ForgeStation({ api, practice, children, initialRoute, idPrefix, benchLabel }: LabProps & { children: ReactNode; initialRoute: RouteId; idPrefix: string; benchLabel: string }) {
  const [station, setStation] = useState<Station>('banco');
  const [opened, setOpened] = useState(false);
  return (
    <div className="stack">
      <div className="forge-switch">
        <Segmented label="Estación de la práctica" value={station} options={[{ value: 'banco', label: benchLabel }, { value: 'taller', label: 'Taller de formación de compuestos' }]}
          onChange={(v) => { setStation(v); if (v === 'taller') setOpened(true); playSound('click', { intensity: 0.3 }); }} />
      </div>
      <div className="bench-panel" hidden={station !== 'banco'}>{children}</div>
      {opened && (
        <div className="forge-panel" hidden={station !== 'taller'}>
          <Suspense fallback={<p className="small muted" role="status">Cargando el taller…</p>}>
            <CompoundForge api={api} practice={practice} initialRoute={initialRoute} idPrefix={idPrefix} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
