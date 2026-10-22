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
