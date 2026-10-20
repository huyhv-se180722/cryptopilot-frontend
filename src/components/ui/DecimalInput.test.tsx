// @vitest-environment jsdom
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DecimalInput } from './DecimalInput';

function Field() {
  const [value, setValue] = useState('');
  return (
    <>
      <DecimalInput label="Amount" value={value} onValueChange={setValue} />
      <output aria-label="held">{value}</output>
    </>
  );
}

const setup = () => {
  render(<Field />);
  return {
    input: screen.getByRole('textbox', { name: 'Amount' }) as HTMLInputElement,
    held: () => screen.getByRole('status', { name: 'held' }).textContent,
    user: userEvent.setup(),
  };
};

describe('DecimalInput', () => {
  it('reads "0,5" as 0.5, never 5, and shows the point once left', async () => {
    const { input, held, user } = setup();
    await user.type(input, '0,5');
    expect(input.value).toBe('0,5');
    expect(held()).toBe('0.5');
    await user.tab();
    expect(input.value).toBe('0.5');
    expect(held()).toBe('0.5');
  });

  it('groups while typing and takes a typed grouping comma', async () => {
    const { input, held, user } = setup();
    await user.type(input, '59000');
    expect(input.value).toBe('59,000');
    await user.clear(input);
    await user.type(input, '59,000.5');
    expect(input.value).toBe('59,000.5');
    expect(held()).toBe('59000.5');
  });

  it('keeps the grouping it put in while more digits are typed', async () => {
    const { input, held, user } = setup();
    await user.type(input, '590000');
    expect(input.value).toBe('590,000');
    expect(held()).toBe('590000');
  });

  it('takes a comma typed after grouped digits as the decimal mark', async () => {
    const { input, held, user } = setup();
    await user.type(input, '5900,25');
    expect(input.value).toBe('5900,25');
    expect(held()).toBe('5900.25');
  });

  it('shows a pasted text it cannot read as typed', async () => {
    const { input, held, user } = setup();
    await user.click(input);
    await user.paste('1,234,5');
    expect(input.value).toBe('1,234,5');
    expect(held()).toBe('1,234,5');
  });
});
