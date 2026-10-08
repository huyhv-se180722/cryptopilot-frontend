import { Component, type ContextType, type PropsWithChildren } from 'react';
import { I18nContext } from '../../i18n/i18n-context';
import { ErrorState } from './States';

export class ErrorBoundary extends Component<
  PropsWithChildren,
  { failed: boolean }
> {
  static contextType = I18nContext;
  declare context: ContextType<typeof I18nContext>;
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <ErrorState
          message={this.context.copy.errors.render}
          onRetry={() => window.location.reload()}
        />
      );
    return this.props.children;
  }
}
