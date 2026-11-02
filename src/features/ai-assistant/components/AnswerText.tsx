import type { ReactNode } from 'react';

/**
 * `**bold**` inside one line of an answer, as React nodes: the model writes
 * light Markdown, and the text stays text (React escapes it), so nothing in
 * an answer can become markup.
 */
function inline(line: string): ReactNode[] {
  return line
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, index) =>
      part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
        <strong key={index}>{part.slice(2, -2)}</strong>
      ) : (
        part
      ),
    );
}

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;

/**
 * An assistant answer: paragraphs, bullet or numbered lines as a list, and
 * bold, the subset of Markdown the model uses. Headings lose their `#`.
 */
export function AnswerText({ text }: { text: string }) {
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
          <li key={index}>{inline(item)}</li>
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
          {inline(line)}
        </p>,
      );
  }
  flush();
  return <div className="break-words text-sm leading-relaxed">{blocks}</div>;
}
