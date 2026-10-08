// @vitest-environment jsdom
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs } from './Tabs';

function Settings() {
  const [value, setValue] = useState('a');
  return (
    <Tabs
      orientation="vertical"
      label="Settings"
      value={value}
      onChange={setValue}
      items={[
        { id: 'a', label: 'Profile', panel: 'Profile panel' },
        { id: 'b', label: 'Security', panel: 'Security panel' },
        { id: 'c', label: 'Locked', panel: 'Locked panel', disabled: true },
      ]}
    />
  );
}

describe('Tabs', () => {
  it('moves through a vertical list with the up and down arrows', async () => {
    render(<Settings />);
    expect(screen.getByRole('tablist').getAttribute('aria-orientation')).toBe(
      'vertical',
    );
    screen.getByRole('tab', { name: 'Profile' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(
      screen
        .getByRole('tab', { name: 'Security' })
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.getByText('Security panel').hidden).toBe(false);
    // The disabled tab is skipped and the list wraps around.
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement?.textContent).toBe('Profile');
    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement?.textContent).toBe('Security');
  });
});
