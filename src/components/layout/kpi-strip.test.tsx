// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { KpiStrip } from './KpiStrip';

describe('KpiStrip (T-141)', () => {
  it('names the panel and lists each figure with its label and note', () => {
    render(
      <KpiStrip
        label="Key figures"
        header={<span>All time</span>}
        items={[
          {
            id: 'pnl',
            label: 'Net P/L',
            value: '+13.78',
            note: '9 closed trades',
            tone: 'positive',
          },
          { id: 'plans', label: 'Active plans', value: '2' },
        ]}
      />,
    );
    const panel = within(screen.getByRole('region', { name: 'Key figures' }));
    expect(panel.getByText('All time')).toBeTruthy();
    expect(panel.getByText('Net P/L').tagName).toBe('DT');
    expect(panel.getByText('+13.78').className).toContain('text-positive');
    expect(panel.getByText('9 closed trades')).toBeTruthy();
    expect(panel.getByText('2').className).toContain('text-fg');
  });

  it('leaves the header out when none is given', () => {
    const { container } = render(
      <KpiStrip
        label="Figures"
        items={[{ id: 'a', label: 'A', value: '1' }]}
      />,
    );
    expect(container.querySelectorAll('section > div')).toHaveLength(0);
  });
});
