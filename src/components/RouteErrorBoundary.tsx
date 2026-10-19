import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onReload?: () => void;
}

interface State {
  failed: boolean;
}

// A lazy page whose chunk no longer exists (the binary was rebuilt with the tab
// open) throws while rendering; only a full reload fetches the new build.
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const reload = this.props.onReload ?? (() => window.location.reload());
    return (
      <div className="state state-box" role="alert">
        <p>Não foi possível carregar esta tela.</p>
        <button type="button" className="btn btn-primary" onClick={reload}>
          Recarregar
        </button>
      </div>
    );
  }
}
