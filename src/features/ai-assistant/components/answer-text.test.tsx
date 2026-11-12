// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { AiMessageSource } from '../../../types/domain';
import { AnswerText, SourceList } from './AnswerText';

const SOURCES: readonly AiMessageSource[] = [
  {
    ref: 1,
    origin: 'SYSTEM',
    headline: 'ETF Bitcoin bị rút ròng',
    outlet: 'CoinDesk',
    publishedAt: '2026-11-12T09:00:00Z',
    url: 'https://coindesk.example/etf',
  },
  {
    ref: 2,
    origin: 'SYSTEM',
    headline: 'Sàn bị hack',
    outlet: 'Cointelegraph',
    publishedAt: null,
    url: 'https://ct.example/hack',
  },
];

describe('cited news in an answer (T-074)', () => {
  it('turns [n] into links to the cited articles, and leaves an unknown number as text', () => {
    render(
      <AnswerText
        text={
          'Dòng tiền ETF rút ra [1], **áp lực [1, 2]**.\n- Theo [9] thì khác.'
        }
        sources={SOURCES}
      />,
    );
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://coindesk.example/etf',
      'https://coindesk.example/etf',
      'https://ct.example/hack',
    ]);
    expect(links[0]!.getAttribute('target')).toBe('_blank');
    expect(links[0]!.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByText(/Theo \[9\] thì khác/)).toBeTruthy();
  });

  it('keeps the brackets as text when the answer has no sources', () => {
    render(<AnswerText text="Mức [1] là hỗ trợ." />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Mức [1] là hỗ trợ.')).toBeTruthy();
  });

  it('lists the sources under the answer with outlet and time, each opening the original', () => {
    render(
      <SourceList
        sources={SOURCES}
        title="Nguồn tham khảo"
        hint="Mở bài gốc."
      />,
    );
    const list = screen.getByRole('region', { name: 'Nguồn tham khảo' });
    const links = within(list).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]!.textContent).toContain('ETF Bitcoin bị rút ròng');
    expect(links[0]!.textContent).toContain('CoinDesk');
    expect(links[1]!.getAttribute('href')).toBe('https://ct.example/hack');
    expect(links[1]!.textContent).toContain('Cointelegraph');
  });

  it('shows nothing when there is no source', () => {
    const { container } = render(
      <SourceList sources={[]} title="Nguồn tham khảo" hint="x" />,
    );
    expect(container.textContent).toBe('');
  });
});
