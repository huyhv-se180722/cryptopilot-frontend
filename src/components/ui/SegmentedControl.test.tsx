// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedControl } from './SegmentedControl';

describe('SegmentedControl', () => {
  it('exposes a radio group and reports the chosen value', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Appearance"
        value="light"
        onChange={onChange}
        iconOnly
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Appearance' })).toBeTruthy();
    expect(
      screen.getByRole('radio', { name: 'Light' }).getAttribute('aria-checked'),
    ).toBe('true');
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(onChange).toHaveBeenCalledWith('dark');
  });

  it('colours a chosen long green and a chosen short red, never by colour alone', () => {
    const { rerender } = render(
      <SegmentedControl
        label="Direction"
        value="LONG"
        onChange={() => undefined}
        options={[
          { value: 'LONG', label: 'Long', tone: 'positive' },
          { value: 'SHORT', label: 'Short', tone: 'negative' },
        ]}
      />,
    );
    const long = screen.getByRole('radio', { name: 'Long' });
    expect(long.className).toContain('text-positive');
    expect(long.getAttribute('aria-checked')).toBe('true');
    rerender(
      <SegmentedControl
        label="Direction"
        value="SHORT"
        onChange={() => undefined}
        options={[
          { value: 'LONG', label: 'Long', tone: 'positive' },
          { value: 'SHORT', label: 'Short', tone: 'negative' },
        ]}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Short' }).className).toContain(
      'text-negative',
    );
    expect(screen.getByRole('radio', { name: 'Long' }).className).not.toContain(
      'text-positive',
    );
  });
});
