import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './icons';
import { copyText, downloadBlob } from '../lib/report';
import { practicePermalink } from '../lib/permalink';

/**
 * Botón «Compartir (QR)» del encabezado de la práctica (programa v2, sección 8.4). Abre un diálogo modal nativo
 * (<dialog> con showModal: atrapa el foco y se cierra con Escape, como el diálogo «Mi curso») con el código QR del
 * enlace permanente. La biblioteca qrcode se carga bajo demanda para que no forme parte del paquete principal.
 */
export function ShareQrButton({ practiceId, title }: { practiceId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [status, setStatus] = useState('');
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const url = practicePermalink(practiceId);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { try { d.showModal(); } catch { d.setAttribute('open', ''); } }
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open || svg) return;
    let alive = true;
    import('qrcode')
      .then((QR) => QR.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 4, color: { dark: '#000000', light: '#ffffff' } }))
      .then((s) => { if (alive) setSvg(s); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [open, svg, url]);

  const alt = `Código QR que abre la práctica «${title}» en el laboratorio virtual: ${url}`;

  const copy = async () => setStatus((await copyText(url)) ? 'Enlace copiado.' : 'No se pudo copiar; selecciona el enlace y cópialo a mano.');
  const download = () => {
    if (!svg) return;
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const file = svg.replace(/<svg([^>]*)>/, `<svg$1><title>${esc(alt)}</title>`);
    setStatus(downloadBlob(`qr-${practiceId}.svg`, new Blob([file], { type: 'image/svg+xml' })) ? 'QR descargado.' : 'Este navegador bloqueó la descarga.');
  };

  return (
    <>
      <button type="button" className="btn" aria-haspopup="dialog" onClick={() => { setStatus(''); setOpen(true); }}>
        <Icon name="codigo" size={18} />Compartir (QR)
      </button>
      <dialog ref={ref} className="dialog" aria-labelledby={titleId} aria-describedby={descId} onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
        {open && (
          <div className="dialog-body stack">
            <div className="dialog-head">
              <h2 id={titleId}>Compartir la práctica</h2>
              <button type="button" className="btn small ghost" onClick={() => setOpen(false)} aria-label="Cerrar"><Icon name="cerrar" size={18} /></button>
            </div>
            <p id={descId} className="small muted" style={{ margin: 0 }}>
              Escanea el código con la cámara del celular para abrir «{title}». El enlace es permanente: sirve en las guías impresas y no cambia entre versiones.
            </p>
            <div className="qr-box" role="img" aria-label={alt} data-qr-url={url}>
              {svg
                ? <span className="qr-svg" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
                : <span className="small muted" aria-hidden="true">{error ? 'No se pudo generar el código QR.' : 'Generando código QR…'}</span>}
            </div>
            <p className="qr-url"><a href={url}>{url}</a></p>
            <div className="btn-row">
              <button type="button" className="btn" onClick={copy}><Icon name="copiar" size={16} />Copiar enlace</button>
              <button type="button" className="btn" onClick={download} disabled={!svg}><Icon name="descargar" size={16} />Descargar QR (SVG)</button>
            </div>
            <p className="small muted" role="status" style={{ margin: 0 }}>{status}</p>
          </div>
        )}
      </dialog>
    </>
  );
}
