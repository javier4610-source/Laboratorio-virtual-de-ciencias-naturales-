import { Component, type ReactNode } from 'react';

interface State { error: Error | null; }

/** Evita que un error en un laboratorio deje la página en blanco y ofrece recuperarse. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="notice bad stack-sm" role="alert">
        <strong>Ocurrió un error inesperado en esta sección.</strong>
        <span className="small">Tu trabajo guardado no se perdió: los datos están en este navegador. Intenta de nuevo; si el error se repite, recarga la página o abre la sección desde el inicio.</span>
        <span className="small muted">Detalle técnico (para tu docente): {this.state.error.message}</span>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => this.setState({ error: null })}>Intentar de nuevo</button>
          <a className="btn" href="#/">Volver al inicio</a>
        </div>
      </div>
    );
  }
}
