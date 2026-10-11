import { useEffect } from 'react';
import { Icon } from './icons';
import { applyUpdate, dismissOfflineReady, promptInstall, usePwa } from '../lib/pwa';

/** Avisos de la aplicación instalable: lista sin conexión y versión nueva disponible. */
export function PwaNotices() {
  const pwa = usePwa();
  // El aviso de «listo sin conexión» es informativo: se oculta solo para no tapar el contenido.
  useEffect(() => {
    if (!pwa.offlineReady || pwa.updateAvailable) return;
    const t = setTimeout(dismissOfflineReady, 12_000);
    return () => clearTimeout(t);
  }, [pwa.offlineReady, pwa.updateAvailable]);
  if (!pwa.updateAvailable && !pwa.offlineReady) return null;
  return (
    <div className="pwa-toast" role="status">
      {pwa.updateAvailable ? (
        <>
          <span>Hay una versión nueva del laboratorio. Tu trabajo guardado se conserva.</span>
          <button type="button" className="btn small primary" onClick={applyUpdate}>Actualizar</button>
        </>
      ) : (
        <>
          <span>Listo: el laboratorio ya funciona sin conexión en este equipo.</span>
          <button type="button" className="btn small" onClick={dismissOfflineReady}>Entendido</button>
        </>
      )}
    </div>
  );
}

/** Botón para instalar la aplicación; solo aparece cuando el navegador lo permite. */
export function InstallButton({ className = 'btn' }: { className?: string }) {
  const pwa = usePwa();
  if (!pwa.canInstall || pwa.installed) return null;
  return <button type="button" className={className} onClick={() => { void promptInstall(); }}><Icon name="instalar" size={18} />Instalar la aplicación</button>;
}
