import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { EmptyState, ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { AcademyDisclaimer } from '../../features/academy/components/AcademyDisclaimer';
import { AcademyLocale } from '../../features/academy/components/AcademyLocale';
import { useAcademyTerms } from '../../features/academy/hooks/use-academy';
import { useCopy } from '../../hooks/use-copy';
import { errorText } from '../../i18n/messages';
import type { AcademyTerm } from '../../types/domain';
import { classNames } from '../../utils/class-names';

/** The Latin letters and Đ, the first letters a term may start with. */
const LETTERS = [...'ABCDĐEFGHIJKLMNOPQRSTUVWXYZ'];
const SEARCH_MIN = 2;
const SEARCH_DELAY_MS = 350;

const firstLetter = (term: string) => term.charAt(0).toLocaleUpperCase('vi');

/**
 * The glossary of the Academy (T-114), A to Z: each term with a short
 * definition and, where one exists, the lesson that explains it. Filtered
 * by a first letter or a search. Guests read it.
 */
export function AcademyGlossaryPage() {
  return (
    <AcademyLocale>
      <Glossary />
    </AcademyLocale>
  );
}

function Glossary() {
  const copy = useCopy();
  const a = copy.academy;
  const [letter, setLetter] = useState<string | undefined>();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const wanted = text.trim().length >= SEARCH_MIN ? text.trim() : '';
    const timer = setTimeout(() => setQ(wanted), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const terms = useAcademyTerms({
    ...(q ? { q } : {}),
    ...(letter ? { letter } : {}),
  });
  const groups = new Map<string, AcademyTerm[]>();
  for (const term of terms.data ?? []) {
    const key = firstLetter(term.term);
    groups.set(key, [...(groups.get(key) ?? []), term]);
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Link
        to="/academy"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted no-underline hover:text-fg-2"
      >
        <ArrowLeft size={13} aria-hidden="true" />
        {a.backToAcademy}
      </Link>
      <PageHeader title={a.glossaryTitle} description={a.glossarySubtitle} />

      <Input
        label={a.searchTerms}
        type="search"
        placeholder={a.searchTermsPlaceholder}
        value={text}
        maxLength={100}
        onChange={(event) => setText(event.target.value)}
      />
      <div
        role="group"
        aria-label={a.lettersLabel}
        className="mt-3 flex flex-wrap gap-1"
      >
        {[undefined, ...LETTERS].map((item) => (
          <button
            key={item ?? 'all'}
            type="button"
            aria-pressed={letter === item}
            onClick={() => setLetter(item)}
            className={classNames(
              'min-w-8 rounded-lg border px-2 py-1 text-xs font-semibold',
              letter === item
                ? 'border-primary-line bg-primary-soft text-primary'
                : 'border-line bg-surface text-muted-dim hover:text-fg',
            )}
          >
            {item ?? a.allLetters}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {terms.isPending ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : terms.isError ? (
          <ErrorState
            message={errorText(copy, terms.error)}
            onRetry={() => void terms.refetch()}
          />
        ) : terms.data.length === 0 ? (
          <EmptyState icon={Search} title={a.noTerms} />
        ) : (
          [...groups].map(([key, items]) => (
            <section
              key={key}
              aria-labelledby={'letter-' + key}
              className="mb-6"
            >
              <h2
                id={'letter-' + key}
                className="mb-2 font-mono text-lg font-semibold text-primary"
              >
                {key}
              </h2>
              <dl className="grid gap-2">
                {items.map((term) => (
                  <div
                    key={term.slug}
                    id={term.slug}
                    className="rounded-xl border border-line bg-surface p-3"
                  >
                    <dt className="text-sm font-semibold text-fg">
                      {term.term}
                    </dt>
                    <dd className="mt-1 text-sm text-fg-2">
                      {term.definition}
                      {term.articleSlug && (
                        <Link
                          to={'/academy/' + term.articleSlug}
                          className="ml-2 text-xs text-link"
                        >
                          {a.readLesson}
                          {term.articleTitle ? ': ' + term.articleTitle : ''}
                        </Link>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))
        )}
      </div>

      <AcademyDisclaimer />
    </div>
  );
}
