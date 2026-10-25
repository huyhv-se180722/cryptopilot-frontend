/**
 * The Markdown of the Academy lessons (T-114), parsed into plain data that
 * MarkdownView renders as React elements: no HTML string is ever built, so
 * nothing in a lesson can inject markup. Only the subset the lessons use is
 * understood — headings (##, ###, ####), paragraphs, bullet and numbered
 * lists, tables, block quotes, rules, and inline bold, italic, code and
 * links; anything else stays visible as text.
 */

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; children: readonly Inline[] }
  | { kind: 'em'; children: readonly Inline[] }
  | { kind: 'code'; text: string }
  | { kind: 'link'; href: string; children: readonly Inline[] };

export type Block =
  | { kind: 'heading'; level: 2 | 3 | 4; id: string; text: string }
  | { kind: 'paragraph'; content: readonly Inline[] }
  | { kind: 'list'; ordered: boolean; items: readonly (readonly Inline[])[] }
  | {
      kind: 'table';
      header: readonly (readonly Inline[])[];
      rows: readonly (readonly (readonly Inline[])[])[];
    }
  | { kind: 'quote'; paragraphs: readonly (readonly Inline[])[] }
  | { kind: 'rule' };

const HEADING = /^(#{2,4})\s+(.+?)\s*#*\s*$/;
const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const RULE = /^\s*(-{3,}|\*{3,})\s*$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const INLINE =
  /(`[^`]+`)|(\*\*(?=\S)[\s\S]*?\S\*\*)|(\*(?=\S)[^*]*?\S\*|\*\S\*)|(\[[^\]]+\]\([^)\s]+\))/g;

/** Only app paths and web addresses are links; anything else stays text. */
export function safeHref(href: string): string | null {
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  return /^https?:\/\//i.test(href) ? href : null;
}

/** An anchor id from a heading, Vietnamese marks removed: "Ví & bảo mật" → "vi-bao-mat". */
export function headingId(text: string): string {
  const id = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return id || 'muc';
}

export function parseInline(source: string): readonly Inline[] {
  const result: Inline[] = [];
  let last = 0;
  for (const match of source.matchAll(INLINE)) {
    const at = match.index;
    if (at > last) result.push({ kind: 'text', text: source.slice(last, at) });
    const [token] = match;
    if (match[1]) {
      result.push({ kind: 'code', text: token.slice(1, -1) });
    } else if (match[2]) {
      result.push({
        kind: 'strong',
        children: parseInline(token.slice(2, -2)),
      });
    } else if (match[3]) {
      result.push({ kind: 'em', children: parseInline(token.slice(1, -1)) });
    } else {
      const split = token.indexOf('](');
      const label = parseInline(token.slice(1, split));
      const href = safeHref(token.slice(split + 2, -1));
      if (href) result.push({ kind: 'link', href, children: label });
      else result.push(...label);
    }
    last = at + token.length;
  }
  if (last < source.length)
    result.push({ kind: 'text', text: source.slice(last) });
  return result;
}

function cells(line: string): string[] {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|')) row = row.slice(0, -1);
  return row.split('|').map((cell) => cell.trim());
}

export function parseMarkdown(source: string): readonly Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  const ids = new Map<string, number>();
  let i = 0;
  const uniqueId = (text: string) => {
    const base = headingId(text);
    const seen = ids.get(base) ?? 0;
    ids.set(base, seen + 1);
    return seen === 0 ? base : base + '-' + String(seen + 1);
  };
  const isBlank = (line: string | undefined) =>
    line === undefined || line.trim() === '';

  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (isBlank(line)) {
      i++;
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      const text = heading[2] ?? '';
      blocks.push({
        kind: 'heading',
        level: (heading[1]?.length ?? 2) as 2 | 3 | 4,
        id: uniqueId(text),
        text,
      });
      i++;
      continue;
    }
    if (RULE.test(line)) {
      blocks.push({ kind: 'rule' });
      i++;
      continue;
    }
    if (
      line.trim().startsWith('|') &&
      TABLE_SEPARATOR.test(lines[i + 1] ?? '')
    ) {
      const header = cells(line).map(parseInline);
      const rows: (readonly Inline[])[][] = [];
      i += 2;
      while (i < lines.length && (lines[i] ?? '').trim().startsWith('|')) {
        rows.push(cells(lines[i] ?? '').map(parseInline));
        i++;
      }
      blocks.push({ kind: 'table', header, rows });
      continue;
    }
    if (line.trim().startsWith('>')) {
      const paragraphs: (readonly Inline[])[] = [];
      let current: string[] = [];
      while (i < lines.length && (lines[i] ?? '').trim().startsWith('>')) {
        const text = (lines[i] ?? '').trim().replace(/^>\s?/, '');
        if (text.trim() === '') {
          if (current.length) paragraphs.push(parseInline(current.join(' ')));
          current = [];
        } else current.push(text.trim());
        i++;
      }
      if (current.length) paragraphs.push(parseInline(current.join(' ')));
      blocks.push({ kind: 'quote', paragraphs });
      continue;
    }
    const ordered = NUMBERED.test(line);
    if (ordered || BULLET.test(line)) {
      const pattern = ordered ? NUMBERED : BULLET;
      const items: (readonly Inline[])[] = [];
      while (i < lines.length) {
        const item = pattern.exec(lines[i] ?? '');
        if (!item) break;
        items.push(parseInline(item[1] ?? ''));
        i++;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }
    // The first line always belongs to the paragraph, so a stray "|" line
    // that starts no table still moves the parser on.
    const paragraph: string[] = [line.trim()];
    i++;
    while (i < lines.length) {
      const next = lines[i] ?? '';
      if (
        isBlank(next) ||
        HEADING.test(next) ||
        RULE.test(next) ||
        next.trim().startsWith('|') ||
        next.trim().startsWith('>') ||
        BULLET.test(next) ||
        NUMBERED.test(next)
      )
        break;
      paragraph.push(next.trim());
      i++;
    }
    blocks.push({
      kind: 'paragraph',
      content: parseInline(paragraph.join(' ')),
    });
  }
  return blocks;
}

/** The second-level headings, for a lesson's table of contents. */
export function outline(
  blocks: readonly Block[],
): readonly { id: string; text: string }[] {
  return blocks.flatMap((block) =>
    block.kind === 'heading' && block.level === 2
      ? [{ id: block.id, text: block.text }]
      : [],
  );
}
