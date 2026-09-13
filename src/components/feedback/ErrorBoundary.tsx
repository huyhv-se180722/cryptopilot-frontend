import { Component, type PropsWithChildren } from 'react';
import { ErrorState } from './States';

export class ErrorBoundary extends Component<
  PropsWithChildren,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <ErrorState
          message="The application could not render this view."
          onRetry={() => window.location.reload()}
        />
      );
    return this.props.children;
  }
}
