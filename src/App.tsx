import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import Dashboard from './Dashboard';

// ---------------------------------------------------------------------------
// Error boundary — catches rendering crashes and shows the error instead of
// a black screen, so we can diagnose runtime issues during development.
// ---------------------------------------------------------------------------

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 font-mono text-status-skipped bg-bg-primary min-h-screen">
          <h1 className="text-h1 mb-3">
            ⚠️ React crashed
          </h1>
          <pre className="whitespace-pre-wrap text-text-primary bg-bg-secondary p-4 rounded-button overflow-auto">
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}

export default App;
