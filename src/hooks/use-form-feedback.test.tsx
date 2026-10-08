// @vitest-environment jsdom
import { act, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../app/providers/ToastProvider';
import { I18nProvider } from '../i18n/I18nProvider';
import { useToast } from './use-toast';
import { useFormFeedback } from './use-form-feedback';
import { ServiceError } from '../services/api/errors';

function Trigger() {
  const { show } = useToast();
  return (
    <>
      <button onClick={() => show({ tone: 'success', message: 'Saved.' })}>
        ok
      </button>
      <button onClick={() => show({ tone: 'error', message: 'Broken.' })}>
        fail
      </button>
    </>
  );
}

function FeedbackProbe({ error }: { error: unknown }) {
  const feedback = useFormFeedback();
  return (
    <>
      <button onClick={() => feedback.failed(error)}>submit</button>
      <button onClick={feedback.saved}>save</button>
      {feedback.inline && <p>inline shown</p>}
    </>
  );
}

const wrap = (node: React.ReactNode) =>
  render(
    <I18nProvider>
      <ToastProvider>{node}</ToastProvider>
    </I18nProvider>,
  );

const problem = (code: string, messageCode: string) =>
  new ServiceError('refused', 'HTTP_ERROR', 400, {
    status: 400,
    code,
    messageCode,
    messageArgs: [],
    fieldErrors: {},
  });

describe('Toaster', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('announces, closes on its own and pauses while hovered', () => {
    wrap(<Trigger />);
    fireEvent.click(screen.getByText('ok'));
    const toast = screen.getByRole('status');
    expect(toast.textContent).toContain('Saved.');
    fireEvent.mouseEnter(toast.closest('ol') as HTMLElement);
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.queryByText('Saved.')).not.toBeNull();
    fireEvent.mouseLeave(toast.closest('ol') as HTMLElement);
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByText('Saved.')).toBeNull();
  });

  it('shows errors as alerts with a close button', () => {
    wrap(<Trigger />);
    fireEvent.click(screen.getByText('fail'));
    expect(screen.getByRole('alert').textContent).toContain('Broken.');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('useFormFeedback (SRS 5.3 placement)', () => {
  it('toasts MSG14 and an unexpected failure (MSG43)', () => {
    wrap(<FeedbackProbe error={new Error('network stack trace')} />);
    fireEvent.click(screen.getByText('save'));
    expect(screen.getByText('Saved successfully.')).toBeTruthy();
    fireEvent.click(screen.getByText('submit'));
    expect(screen.getByRole('alert').textContent).toContain(
      'Something went wrong. Please try again.',
    );
    expect(screen.queryByText('inline shown')).toBeNull();
  });

  it('keeps a known refusal inline', () => {
    wrap(
      <FeedbackProbe error={problem('CURRENT_PASSWORD_INCORRECT', 'MSG08')} />,
    );
    fireEvent.click(screen.getByText('submit'));
    expect(screen.getByText('inline shown')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
