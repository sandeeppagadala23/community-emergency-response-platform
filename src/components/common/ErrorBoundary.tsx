import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-6 text-center bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark rounded-panel my-8">
          <div className="w-12 h-12 rounded-full bg-signal/10 flex items-center justify-center text-signal mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold font-serif text-ink dark:text-ink-dark mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark max-w-md mb-6">
            {this.props.fallbackMessage ||
              this.state.error?.message ||
              'An unexpected error occurred while displaying this page.'}
          </p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-control bg-action text-white text-xs font-semibold hover:bg-action/90 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
