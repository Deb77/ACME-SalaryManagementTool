import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from '../../molecules/ErrorState/ErrorState';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback; defaults to an ErrorState with a "Try again" button. */
  fallback?: (reset: () => void) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Stops a rendering bug in one screen or card from blanking the whole app.
 * Data-fetching errors are handled by the screen (ErrorState); this is the
 * last line of defence for unexpected exceptions.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  private reset = () => this.setState({ hasError: false });

  override render() {
    if (!this.state.hasError) return this.props.children;
    return this.props.fallback ? (
      this.props.fallback(this.reset)
    ) : (
      <ErrorState
        description="This part of the page failed to display. Your data is safe."
        onRetry={this.reset}
      />
    );
  }
}
