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
});
