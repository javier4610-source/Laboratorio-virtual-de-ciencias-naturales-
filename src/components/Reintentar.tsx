/**
 * Botones tras una descarga fallida: «Reintentar» vuelve a pedir el archivo sin recargar (src/lib/importar.ts). Si un
 * reintento ya falló, aparece también «Recargar la página», el último recurso (lo guardado en este navegador no se
 * pierde).
 */
export function RetryButtons({ onRetry, retries, label = 'Reintentar', small = false }: {
  onRetry: () => void;
  /** Reintentos hechos hasta ahora (0 = aún no se ha reintentado). */
  retries: number;
  label?: string;
  small?: boolean;
}) {
  const cls = `btn${small ? ' small' : ''}`;
  return (
    <div className="btn-row" style={small ? { marginTop: 6 } : undefined}>
      <button type="button" className={cls} onClick={onRetry}>{label}</button>
      {retries > 0 && <button type="button" className={`${cls} ghost`} onClick={() => window.location.reload()}>Recargar la página</button>}
    </div>
  );
}
