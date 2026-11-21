// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '../../i18n/I18nProvider';
import { Table, type Column } from './Table';

interface Row {
  id: string;
  name: string;
}
const columns: Column<Row>[] = [
  { id: 'name', header: 'Name', render: (row) => row.name },
];
const rows: Row[] = [{ id: '1', name: 'BTC' }];

function draw(dense = false, cards = false, items: readonly Row[] = rows) {
  render(
    <I18nProvider locale="en">
      <Table
        caption="Pairs"
        columns={columns}
        rows={items}
        rowKey={(row) => row.id}
        dense={dense}
        cards={cards}
      />
    </I18nProvider>,
  );
}

describe('Table', () => {
  it('keeps the wide cell padding by default', () => {
    draw();
    expect(screen.getByRole('columnheader').className).toContain('px-5');
    expect(screen.getByRole('cell').className).toContain('px-5');
  });

  it('narrows the cell padding when dense (T-140)', () => {
    draw(true);
    expect(screen.getByRole('columnheader').className).toContain('px-3');
    expect(screen.getByRole('cell').className).toContain('px-3');
    expect(screen.getByRole('cell').className).not.toContain('px-5');
  });

  it('keeps the plain table below 640 px unless cards are asked for', () => {
    draw();
    const cell = screen.getByRole('cell');
    expect(cell.getAttribute('data-label')).toBeNull();
    expect(cell.className).not.toContain('max-sm:');
    expect(screen.getByRole('table').getAttribute('role')).toBeNull();
  });

  it('draws each row as a card with its column names below 640 px (T-141)', () => {
    draw(false, true);
    const table = screen.getByRole('table', { name: 'Pairs' });
    expect(table.className).toContain('max-sm:block');
    expect(table.querySelector('thead')?.className).toContain('max-sm:hidden');
    const cell = screen.getByRole('cell');
    expect(cell.getAttribute('data-label')).toBe('Name');
    expect(cell.className).toContain('max-sm:flex');
    expect(cell.className).toContain(
      'max-sm:before:content-[attr(data-label)]',
    );
    expect(screen.getByRole('row', { name: /BTC/ }).className).toContain(
      'max-sm:block',
    );
    // the header stays for wide screens and assistive technology
    expect(
      screen.getByRole('columnheader', { name: 'Name' }).getAttribute('role'),
    ).toBe('columnheader');
  });

  it('keeps the empty message in card mode', () => {
    draw(false, true, []);
    expect(screen.getByRole('cell').textContent).not.toBe('');
    expect(screen.getByRole('cell').className).toContain('max-sm:block');
  });
});
