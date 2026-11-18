import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  Flag,
  Gavel,
  ShieldCheck,
} from 'lucide-react';
import { CommunityNav } from '../../features/community/components/CommunityNav';
import { usePostInteractions } from '../../features/community/components/use-post-interactions';
import { useCopy } from '../../hooks/use-copy';

/**
 * Community Rules (D-99), the article CoinMarketCap opens from "More": what
 * belongs in the community and what does not, how to report a post and
 * what the moderators do (UC-42, UC-43). A table of contents stays beside
 * the article on wide screens. Anyone reads it.
 */
export function CommunityRulesPage() {
  const c = useCopy().community;
  const r = c.rulesPage;
  const actions = usePostInteractions();
  return (
    <div className="w-full">
      <CommunityNav trader={actions.trader} />
      <nav
        aria-label={r.breadcrumb}
        className="mb-4 flex items-center gap-1 text-xs text-muted"
      >
        <Link to="/community" className="no-underline hover:text-fg-2">
          {r.breadcrumb}
        </Link>
        <ChevronRight size={12} aria-hidden="true" />
        <span aria-current="page" className="text-fg-2">
          {r.title}
        </span>
      </nav>
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_260px]">
        <aside className="hidden lg:block">
          <nav
            aria-label={r.contentsLabel}
            className="sticky top-16 rounded-2xl border border-line bg-surface p-4"
          >
            <h2 className="mb-2 text-[10px] font-semibold tracking-widest text-muted-x uppercase">
              {r.contentsLabel}
            </h2>
            <ol className="flex flex-col gap-0.5 text-xs">
              {r.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={'#' + section.id}
                    className="block rounded-md px-2 py-1.5 text-muted no-underline hover:bg-raised hover:text-fg-2"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="#report"
                  className="block rounded-md px-2 py-1.5 text-muted no-underline hover:bg-raised hover:text-fg-2"
                >
                  {r.reportTitle}
                </a>
              </li>
            </ol>
          </nav>
        </aside>
        <article className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <header className="border-b border-line pb-5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
              <ShieldCheck size={14} aria-hidden="true" />
              CryptoPilot
            </span>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-fg">
              {r.title}
            </h1>
            <p className="mt-1 text-xs text-muted-dim">{r.updated}</p>
          </header>
          <p className="mt-5 text-sm leading-relaxed text-fg-2">{r.intro}</p>
          <p className="mt-3 rounded-xl border border-warning-line bg-warning-soft px-4 py-3 text-sm leading-relaxed text-fg-2">
            {r.enforcement}
          </p>

          {r.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={section.id + '-title'}
              className="mt-8 scroll-mt-20"
            >
              <h2
                id={section.id + '-title'}
                className="text-lg font-semibold text-fg"
              >
                {section.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-fg-2">
                {section.body}
              </p>
              {'items' in section && (
                <dl className="mt-3 flex flex-col gap-3 border-l-2 border-primary-line pl-4">
                  {section.items.map((item) => (
                    <div key={item.title}>
                      <dt className="text-sm font-semibold text-fg">
                        {item.title}
                      </dt>
                      <dd className="mt-0.5 text-sm leading-relaxed text-fg-2">
                        {item.body}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          ))}

          <section
            id="report"
            aria-labelledby="report-title"
            className="mt-10 scroll-mt-20 rounded-2xl border border-line bg-raised p-5"
          >
            <h2
              id="report-title"
              className="flex items-center gap-2 text-base font-semibold text-fg"
            >
              <Flag size={15} aria-hidden="true" className="text-primary" />
              {r.reportTitle}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-fg-2">
              {r.reportBody}
            </p>
            <h3 className="mt-4 flex items-center gap-2 text-sm font-semibold text-fg">
              <Gavel size={14} aria-hidden="true" className="text-primary" />
              {r.enforcementTitle}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-fg-2">
              {r.enforcement}
            </p>
          </section>

          <Link
            to="/community"
            className="mt-8 inline-flex items-center gap-1.5 text-xs font-semibold text-primary no-underline hover:underline"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            {r.backToFeed}
          </Link>
        </article>
        <aside className="hidden xl:block">
          <nav
            aria-labelledby="rules-related"
            className="sticky top-16 rounded-2xl border border-line bg-surface p-4"
          >
            <h2
              id="rules-related"
              className="mb-2 text-[10px] font-semibold tracking-widest text-muted-x uppercase"
            >
              {r.relatedTitle}
            </h2>
            <ul className="flex flex-col gap-0.5 text-xs">
              {[
                { to: '/community/articles', label: r.relatedArticles },
                { to: '/community/topics', label: r.relatedTopics },
                { to: '/academy', label: r.relatedAcademy },
                { to: '/academy/glossary', label: r.relatedRisk },
              ].map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-fg-2 no-underline hover:bg-raised hover:text-primary"
                  >
                    {link.label}
                    <ChevronRight
                      size={12}
                      aria-hidden="true"
                      className="shrink-0 text-muted-x"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
      {actions.dialogs}
    </div>
  );
}
