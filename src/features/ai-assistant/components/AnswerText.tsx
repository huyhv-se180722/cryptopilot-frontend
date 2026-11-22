import type { ReactNode } from 'react';
import type { AiMessageSource } from '../../../types/domain';

/** `[1]`, `[1, 2]`: the numbers of the articles an answer cites (T-074). */
const CITATION = /(\[\d{1,2}(?:\s*,\s*\d{1,2})*\])/g;

/**
 * The citations in a piece of text as small links to the cited articles. A
 * number the answer has no source for stays plain text, so a link is only
 * ever one the backend stored.
 */
function cite(
  text: string,
  byRef: ReadonlyMap<number, AiMessageSource>,
  key: string,
): ReactNode[] {
  if (byRef.size === 0) return [text];
  return text.split(CITATION).map((part, index) => {
    if (!/^\[\d/.test(part)) return part;
    const refs = part
      .slice(1, -1)
      .split(',')
      .map((n) => Number(n.trim()));
    if (!refs.every((ref) => byRef.has(ref))) return part;
    return (
      <sup key={key + '-' + index} className="ml-0.5 whitespace-nowrap">
        {refs.map((ref) => {
          const source = byRef.get(ref);
          if (source === undefined) return null;
          return (
            <a
              key={ref}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              title={source.headline ?? source.outlet ?? source.url}
              className="mr-0.5 rounded bg-primary-soft px-1 text-xs font-semibold text-primary no-underline hover:underline"
            >
              {ref}
            </a>
          );
        })}
      </sup>
    );
  });
}

/**
 * `**bold**` inside one line of an answer, as React nodes: the model writes
 * light Markdown, and the text stays text (React escapes it), so nothing in
 * an answer can become markup. Citations become links to their sources.
 */
function inline(
  line: string,
  byRef: ReadonlyMap<number, AiMessageSource>,
): ReactNode[] {
  return line
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, index) =>
      part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
        <strong key={index}>
          {cite(part.slice(2, -2), byRef, 'b' + index)}
        </strong>
      ) : (
        cite(part, byRef, 't' + index)
      ),
    );
}

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;

/**
 * An assistant answer: paragraphs, bullet or numbered lines as a list, and
 * bold, the subset of Markdown the model uses. Headings lose their `#`.
 * `[n]` links to the article the answer cites, when `sources` has it.
 */
export function AnswerText({
  text,
  sources = [],
}: {
  text: string;
  sources?: readonly AiMessageSource[];
}) {
  const byRef = new Map(sources.map((source) => [source.ref, source]));
  const blocks: ReactNode[] = [];
  let items: string[] = [];
  const flush = () => {
    if (items.length === 0) return;
    blocks.push(
      <ul
        key={'list-' + blocks.length}
        className="my-1 list-disc space-y-0.5 pl-5"
      >
        {items.map((item, index) => (
          <li key={index}>{inline(item, byRef)}</li>
        ))}
      </ul>,
    );
    items = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.replace(/^#{1,6}\s+/, '');
    if (BULLET.test(line)) {
      items.push(line.replace(BULLET, ''));
      continue;
    }
    flush();
    if (line.trim() !== '')
      blocks.push(
        <p key={'p-' + blocks.length} className="my-1">
          {inline(line, byRef)}
        </p>,
      );
  }
  flush();
  return <div className="break-words text-sm leading-relaxed">{blocks}</div>;
}

function when(value: string | null): string | null {
  if (value === null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes()) +
    ' ' +
    pad(date.getDate()) +
    '/' +
    pad(date.getMonth() + 1)
  );
}

/**
 * The articles an answer cites, under it (T-074): number, headline, outlet
 * and time, each opening the original in a new tab so the Trader can check
 * what the answer says.
 */
export function SourceList({
  sources,
  title,
  hint,
}: {
  sources: readonly AiMessageSource[];
  title: string;
  hint: string;
}) {
  if (sources.length === 0) return null;
  return (
    <section
      aria-label={title}
      className="mt-2 border-t border-line pt-2 text-xs"
    >
      <p className="m-0 mb-1 font-semibold text-fg-2">{title}</p>
      <ol className="m-0 list-none space-y-1 p-0">
        {sources.map((source) => {
          const meta = [source.outlet, when(source.publishedAt)]
            .filter((part): part is string => part !== null)
            .join(' · ');
          return (
            <li key={source.ref} className="flex gap-1.5">
              <span className="shrink-0 rounded bg-primary-soft px-1 text-xs font-semibold leading-4 text-primary">
                {source.ref}
              </span>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 text-fg hover:text-primary hover:underline"
              >
                <span className="line-clamp-2">
                  {source.headline ?? source.url}
                </span>
                {meta !== '' && (
                  <span className="block text-xs text-muted">{meta}</span>
                )}
              </a>
            </li>
          );
        })}
      </ol>
      <p className="m-0 mt-1 text-xs text-muted">{hint}</p>
    </section>
  );
}
