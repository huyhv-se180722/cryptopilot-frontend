import { describe, expect, it } from 'vitest';
import {
  headingId,
  outline,
  parseInline,
  parseMarkdown,
  safeHref,
} from './markdown';

describe('Academy Markdown', () => {
  it('reads headings with unique Vietnamese-free anchors and an outline', () => {
    const blocks = parseMarkdown(
      '## Ví & bảo mật\n\ntext\n\n### Chi tiết\n\n## Ví & bảo mật',
    );
    expect(blocks.map((b) => b.kind)).toEqual([
      'heading',
      'paragraph',
      'heading',
      'heading',
    ]);
    expect(outline(blocks)).toEqual([
      { id: 'vi-bao-mat', text: 'Ví & bảo mật' },
      { id: 'vi-bao-mat-2', text: 'Ví & bảo mật' },
    ]);
    expect(headingId('Đòn bẩy, ký quỹ')).toBe('don-bay-ky-quy');
  });

  it('joins the lines of a paragraph and reads bullet and numbered lists', () => {
    const blocks = parseMarkdown(
      'one\ntwo\n\n- a\n- **b**\n\n1. first\n2. second',
    );
    expect(blocks[0]).toEqual({
      kind: 'paragraph',
      content: [{ kind: 'text', text: 'one two' }],
    });
    expect(blocks[1]).toMatchObject({ kind: 'list', ordered: false });
    expect(blocks[2]).toMatchObject({ kind: 'list', ordered: true });
    if (blocks[1]?.kind !== 'list') throw new Error('list expected');
    expect(blocks[1].items[1]).toEqual([
      { kind: 'strong', children: [{ kind: 'text', text: 'b' }] },
    ]);
  });

  it('reads a table with its header row and a quote', () => {
    const blocks = parseMarkdown(
      '| A | B |\n|---|---|\n| 1 | *2* |\n\n> Lãi = Giá × Đòn bẩy\n>\n> *note*',
    );
    expect(blocks[0]).toMatchObject({ kind: 'table' });
    if (blocks[0]?.kind !== 'table') throw new Error('table expected');
    expect(blocks[0].header).toEqual([
      [{ kind: 'text', text: 'A' }],
      [{ kind: 'text', text: 'B' }],
    ]);
    expect(blocks[0].rows[0]?.[1]).toEqual([
      { kind: 'em', children: [{ kind: 'text', text: '2' }] },
    ]);
    expect(blocks[1]).toMatchObject({ kind: 'quote' });
    if (blocks[1]?.kind !== 'quote') throw new Error('quote expected');
    expect(blocks[1].paragraphs).toHaveLength(2);
  });

  it('links only app paths and web addresses', () => {
    expect(parseInline('[a](/plans/new) [b](javascript:alert(1))')).toEqual([
      {
        kind: 'link',
        href: '/plans/new',
        children: [{ kind: 'text', text: 'a' }],
      },
      { kind: 'text', text: ' ' },
      { kind: 'text', text: 'b' },
      { kind: 'text', text: ')' },
    ]);
    expect(safeHref('//evil.test')).toBeNull();
    expect(safeHref('https://example.test')).toBe('https://example.test');
  });

  it('keeps going past a line that looks like a table but is not one', () => {
    expect(parseMarkdown('| lonely\nnext')).toEqual([
      {
        kind: 'paragraph',
        content: [{ kind: 'text', text: '| lonely next' }],
      },
    ]);
  });
});
