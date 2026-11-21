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

function draw(dense?: boolean) {
  render(
    <I18nProvider locale="en">
      <Table
        caption="Pairs"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        dense={dense}
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
});
