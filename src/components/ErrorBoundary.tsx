import { Component, type ReactNode } from 'react';
import { isChunkLoadError, resetFailedLazies } from '../lib/importar';
import { RetryButtons } from './Reintentar';

interface State { error: Error | null; retries: number; }

/** Evita que un error en un laboratorio deje la página en blanco y ofrece recuperarse. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null, retries: 0 };
  static getDerivedStateFromError(error: Error): Partial<State> { return { error }; }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && (this.state.error || this.state.retries)) this.setState({ error: null, retries: 0 });
  }
  render() {
    if (!this.state.error) return this.props.children;
    // Un fragmento que no se descargó (sin conexión la primera vez): «Reintentar» lo vuelve a pedir sin recargar
    // (src/lib/importar.ts); si el reintento también falla, aparece «Recargar la página».
    if (isChunkLoadError(this.state.error)) {
      return (
        <div className="notice bad stack-sm" role="alert">
          <strong>No se pudo descargar esta sección.</strong>
          <span className="small">Revisa tu conexión a internet: lo que ya abriste antes funciona sin conexión; lo nuevo necesita descargarse una vez. Tu trabajo guardado no se perdió.</span>
          <RetryButtons retries={this.state.retries} onRetry={() => { resetFailedLazies(); this.setState((s) => ({ error: null, retries: s.retries + 1 })); }} />
        </div>
      );
    }
    return (
      <div className="notice bad stack-sm" role="alert">
        <strong>Ocurrió un error inesperado en esta sección.</strong>
        <span className="small">Tu trabajo guardado no se perdió: los datos están en este navegador. Intenta de nuevo; si el error se repite, recarga la página o abre la sección desde el inicio.</span>
        <span className="small muted">Detalle técnico (para tu docente): {this.state.error.message}</span>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => { resetFailedLazies(); this.setState({ error: null }); }}>Intentar de nuevo</button>
          <a className="btn" href="#/">Volver al inicio</a>
        </div>
      </div>
    );
  }
}
