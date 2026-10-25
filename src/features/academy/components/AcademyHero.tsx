import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  Search,
  Sparkles,
} from 'lucide-react';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { AcademyTerm } from '../../../types/domain';

const QUICK_TERMS = 6;
const DAY_MS = 86_400_000;

/**
 * The top of the Academy home (T-114): the title, the lesson search, the
 * size of the Academy and, beside them, the glossary — a term of the day
 * with its definition and a few more to look up — so definitions are the
 * first thing a beginner finds, not the last. A Trader also sees how many
 * lessons they have read.
 */
export function AcademyHero({
  text,
  onText,
  lessons,
  topics,
  terms,
  read,
}: {
  text: string;
  onText: (value: string) => void;
  lessons: number | undefined;
  topics: number | undefined;
  terms: readonly AcademyTerm[] | undefined;
  /** The lessons a signed-in Trader has read, or nothing for anyone else. */
  read?: { done: number; total: number } | undefined;
}) {
  const a = useCopy().academy;
  // The term changes every day and is the same for every reader that day.
  const [day] = useState(() => Math.floor(Date.now() / DAY_MS));
  const featured = terms?.length ? terms[day % terms.length] : undefined;
  const quick =
    terms && featured
      ? Array.from(
          { length: Math.min(QUICK_TERMS, terms.length - 1) },
          (_, n) => terms[(day + 1 + n * 7) % terms.length],
        ).filter((term): term is AcademyTerm => !!term && term !== featured)
      : [];
  const stats = [
    { value: lessons, label: a.statLessons },
    { value: topics, label: a.statTopics },
    { value: terms?.length, label: a.statTerms },
  ];

  return (
    <section
      className="relative mb-8 overflow-hidden rounded-3xl p-6 text-white shadow-xl sm:p-8"
      style={{
        background:
          'linear-gradient(135deg, #0b1a3a 0%, #1d4ed8 55%, #7c3aed 100%)',
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-white/10 blur-3xl"
      />
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col justify-center">
          <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold tracking-wider uppercase">
            <Sparkles size={12} aria-hidden="true" />
            {a.heroEyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {a.title}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">
            {a.subtitle}
          </p>
          <label className="mt-5 flex max-w-xl items-center gap-2 rounded-2xl bg-white px-4 py-3 text-fg shadow-lg focus-within:ring-4 focus-within:ring-white/30">
            <Search size={18} aria-hidden="true" className="text-muted-dim" />
            <span className="sr-only">{a.searchLabel}</span>
            <input
              type="search"
              value={text}
              maxLength={100}
              placeholder={a.searchPlaceholder}
              onChange={(event) => onText(event.target.value)}
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>
          <dl className="mt-6 flex flex-wrap gap-6">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd className="text-2xl font-bold">
                  {stat.value ?? '–'}
                  <span className="ml-1.5 text-xs font-medium text-white/70">
                    {stat.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          {read && (
            <div className="mt-5 max-w-sm">
              <p className="flex items-center gap-1.5 text-xs font-medium text-white/90">
                <CheckCircle2 size={14} aria-hidden="true" />
                {formatCopy(a.readProgress, read)}
              </p>
              <div
                role="progressbar"
                aria-label={a.readProgressLabel}
                aria-valuemin={0}
                aria-valuemax={read.total}
                aria-valuenow={read.done}
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/20"
              >
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all"
                  style={{
                    width:
                      String(read.total ? (100 * read.done) / read.total : 0) +
                      '%',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <aside
          aria-label={a.glossaryTitle}
          className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md"
        >
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wider text-white/80 uppercase">
            <BookOpenText size={14} aria-hidden="true" />
            {a.termOfDay}
          </p>
          {featured ? (
            <Link
              to={'/academy/glossary#' + featured.slug}
              className="mt-3 block text-white no-underline"
            >
              <span className="text-lg font-semibold">{featured.term}</span>
              <span className="mt-1 block text-sm leading-6 text-white/80">
                {featured.definition}
              </span>
            </Link>
          ) : (
            <div className="mt-3 h-16 animate-pulse rounded-xl bg-white/10" />
          )}
          {quick.length > 0 && (
            <>
              <p className="mt-5 text-[11px] font-semibold tracking-wider text-white/60 uppercase">
                {a.quickTerms}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {quick.map((term) => (
                  <li key={term.slug}>
                    <Link
                      to={'/academy/glossary#' + term.slug}
                      title={term.definition}
                      className="inline-block rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white no-underline hover:bg-white/25"
                    >
                      {term.term}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link
            to="/academy/glossary"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-white no-underline hover:underline"
          >
            {formatCopy(a.allTerms, { count: terms?.length ?? 0 })}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </section>
  );
}
