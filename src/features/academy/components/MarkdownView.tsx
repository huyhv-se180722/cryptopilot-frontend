import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import type { Block, Inline } from '../markdown';

function Inlines({ content }: { content: readonly Inline[] }) {
  return content.map((part, index) => {
    switch (part.kind) {
      case 'text':
        return <Fragment key={index}>{part.text}</Fragment>;
      case 'strong':
        return (
          <strong key={index} className="font-semibold text-fg">
            <Inlines content={part.children} />
          </strong>
        );
      case 'em':
        return (
          <em key={index}>
            <Inlines content={part.children} />
          </em>
        );
      case 'code':
        return (
          <code
            key={index}
            className="rounded bg-surface-alt px-1 py-0.5 font-mono text-[0.9em]"
          >
            {part.text}
          </code>
        );
      case 'link':
        return part.href.startsWith('/') ? (
          <Link key={index} to={part.href} className="text-link">
            <Inlines content={part.children} />
          </Link>
        ) : (
          <a
            key={index}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link"
          >
            <Inlines content={part.children} />
          </a>
        );
    }
  });
}

const headingClass = {
  2: 'mt-8 mb-3 scroll-mt-24 text-xl font-semibold text-fg',
  3: 'mt-6 mb-2 scroll-mt-24 text-base font-semibold text-fg',
  4: 'mt-4 mb-2 scroll-mt-24 text-sm font-semibold text-fg',
} as const;

/** A lesson body parsed by `parseMarkdown`, as React elements only. */
export function MarkdownView({ blocks }: { blocks: readonly Block[] }) {
  return (
    <div className="text-[15px] leading-7 text-fg-2">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'heading': {
            const Tag = `h${String(block.level)}` as 'h2' | 'h3' | 'h4';
            return (
              <Tag
                key={index}
                id={block.id}
                className={headingClass[block.level]}
              >
                {block.text}
              </Tag>
            );
          }
          case 'paragraph':
            return (
              <p key={index} className="my-3">
                <Inlines content={block.content} />
              </p>
            );
          case 'list': {
            const Tag = block.ordered ? 'ol' : 'ul';
            return (
              <Tag
                key={index}
                className={
                  'my-3 grid gap-1.5 pl-6 ' +
                  (block.ordered ? 'list-decimal' : 'list-disc')
                }
              >
                {block.items.map((item, n) => (
                  <li key={n}>
                    <Inlines content={item} />
                  </li>
                ))}
              </Tag>
            );
          }
          case 'table':
            return (
              <div
                key={index}
                className="my-4 overflow-x-auto rounded-xl border border-line"
              >
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-surface-alt text-fg">
                    <tr>
                      {block.header.map((cell, n) => (
                        <th
                          key={n}
                          scope="col"
                          className="px-3 py-2 font-semibold"
                        >
                          <Inlines content={cell} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r} className="border-t border-line">
                        {row.map((cell, n) => (
                          <td key={n} className="px-3 py-2 align-top">
                            <Inlines content={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'quote':
            return (
              <blockquote
                key={index}
                className="my-4 rounded-r-xl border-l-4 border-primary-line bg-primary-soft px-4 py-2 text-fg"
              >
                {block.paragraphs.map((paragraph, n) => (
                  <p key={n} className="my-1">
                    <Inlines content={paragraph} />
                  </p>
                ))}
              </blockquote>
            );
          case 'rule':
            return <hr key={index} className="my-6 border-line" />;
        }
      })}
    </div>
  );
}
