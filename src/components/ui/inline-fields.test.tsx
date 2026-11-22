// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from './Input';
import { Select } from './Select';

describe('inline fields', () => {
  it('keep the label tied to the control and the error described', () => {
    render(
      <>
        <Input inline label="Price (USDT)" error="Enter a price" />
        <Select inline label="Time in force" defaultValue="GTC">
          <option value="GTC">GTC</option>
        </Select>
      </>,
    );
    const price = screen.getByRole('textbox', { name: 'Price (USDT)' });
    expect(price.getAttribute('aria-invalid')).toBe('true');
    const described = price.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(described)?.textContent).toBe(
      'Enter a price',
    );
    expect(
      (
        screen.getByRole('combobox', {
          name: 'Time in force',
        }) as HTMLSelectElement
      ).value,
    ).toBe('GTC');
  });
});

describe('filter fields (T-142)', () => {
  it('put the label outside at the left and the choice at the left of a compact box', () => {
    render(
      <>
        <Select filter label="Status" defaultValue="ALL">
          <option value="ALL">All statuses</option>
        </Select>
        <Input filter label="From" type="date" />
      </>,
    );
    const status = screen.getByRole('combobox', { name: 'Status' });
    const label = screen.getByText('Status');
    expect(label.tagName).toBe('LABEL');
    expect(status.parentElement?.contains(label)).toBe(false);
    expect(status.className.split(' ')).toEqual(
      expect.arrayContaining(['text-left', 'h-8']),
    );
    expect(status.className.split(' ')).not.toContain('text-right');
    const from = screen.getByLabelText('From');
    expect(from.className.split(' ')).toContain('h-8');
  });
});
