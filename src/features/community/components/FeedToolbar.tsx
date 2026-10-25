import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, PenSquare, Search } from 'lucide-react';
import { Menu } from '../../../components/ui/Menu';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { FeedTab } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { useMemberSearch } from '../hooks/use-community';
import { memberPath } from './post-format';
import { AuthorAvatar } from './PostParts';

export type FeedView = 'posts' | 'mindshare';

const SEARCH_MIN = 2;
const SEARCH_MAX = 100;
const DEBOUNCE_MS = 400;

/**
 * The header of the CoinMarketCap feed: the feed's name, the For You menu
 * of feeds, Posts or Mindshare, "Search posts or users" and New Post. The
 * search waits for the typing to stop; a Trader also sees the members
 * whose name starts with it (D-99).
 */
export function FeedToolbar({
  tab,
  tabs,
  onTab,
  view,
  onView,
  q,
  onSearch,
  trader,
  onNewPost,
}: {
  tab: FeedTab;
  tabs: readonly FeedTab[];
  onTab: (tab: FeedTab) => void;
  view: FeedView;
  onView: (view: FeedView) => void;
  q: string;
  onSearch: (q: string) => void;
  trader: boolean;
  onNewPost: () => void;
}) {
  const c = useCopy().community;
  const label: Record<FeedTab, string> = {
    TRENDING: c.tabTrending,
    LATEST: c.tabLatest,
    MOST_LIKED: c.tabMostLiked,
    FOLLOWING: c.tabFollowing,
    SAVED: c.tabSaved,
    MINE: c.tabMine,
  };
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <h1 className="mr-auto text-2xl font-bold tracking-tight text-fg">
        {view === 'mindshare' ? c.mindshareTitle : c[`feedTitle${tab}`]}
      </h1>
      <div className="flex h-9 items-center rounded-lg border border-line bg-surface p-0.5">
        <Menu
          label={c.feedSort}
          items={tabs.map((each) => ({
            id: each,
            label: label[each],
            onSelect: () => {
              onView('posts');
              onTab(each);
            },
          }))}
          trigger={
            <span
              className={classNames(
                'inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-semibold',
                view === 'posts' ? 'bg-raised text-fg' : 'text-muted-x',
              )}
            >
              {label[tab]}
              <ChevronDown size={13} aria-hidden="true" />
            </span>
          }
        />
        <button
          type="button"
          aria-pressed={view === 'mindshare'}
          onClick={() => onView(view === 'mindshare' ? 'posts' : 'mindshare')}
          className={classNames(
            'h-8 rounded-md px-3 text-xs font-semibold transition-colors duration-150',
            view === 'mindshare'
              ? 'bg-raised text-fg'
              : 'text-muted-x hover:text-fg-2',
          )}
        >
          {c.mindshare}
        </button>
      </div>
      <SearchBox q={q} onSearch={onSearch} trader={trader} />
      {trader ? (
        <button
          type="button"
          onClick={onNewPost}
          className={buttonClassName(
            'secondary',
            'md',
            'border-primary-line text-primary',
          )}
        >
          <PenSquare size={14} aria-hidden="true" />
          {c.newPost}
        </button>
      ) : (
        <Link
          to="/login"
          state={{ from: '/community' }}
          className={buttonClassName(
            'secondary',
            'md',
            'border-primary-line text-primary',
          )}
        >
          <PenSquare size={14} aria-hidden="true" />
          {c.newPost}
        </Link>
      )}
    </div>
  );
}

function SearchBox({
  q,
  onSearch,
  trader,
}: {
  q: string;
  onSearch: (q: string) => void;
  trader: boolean;
}) {
  const c = useCopy().community;
  const [text, setText] = useState(q);
  const [open, setOpen] = useState(false);
  const members = useMemberSearch(text, trader && open);

  // The URL (back and forward, a cleared filter) wins over what was typed.
  const [seen, setSeen] = useState(q);
  if (seen !== q) {
    setSeen(q);
    if (text.trim() !== q) setText(q);
  }

  useEffect(() => {
    const value = text.trim();
    if (value === q || (value.length > 0 && value.length < SEARCH_MIN)) return;
    const timer = setTimeout(() => onSearch(value), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, q, onSearch]);

  const found = members.data ?? [];
  const short = text.trim().length > 0 && text.trim().length < SEARCH_MIN;
  return (
    <div
      role="search"
      className="relative w-full sm:w-60"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <Search
        size={13}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-x"
      />
      <input
        type="search"
        aria-label={c.searchPostsUsers}
        placeholder={c.searchPostsUsers}
        value={text}
        maxLength={SEARCH_MAX}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-8 text-xs text-fg placeholder:text-muted-x focus:border-primary-line focus:outline-none"
      />
      {open && (found.length > 0 || short) && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line-strong bg-surface shadow-(--cp-shadow-panel)">
          {short && (
            <p className="px-3 py-2 text-[11px] text-muted-dim">
              {c.searchTooShort}
            </p>
          )}
          {found.length > 0 && (
            <>
              <p className="px-3 pt-2 text-[10px] font-semibold tracking-widest text-muted-x uppercase">
                {c.searchMembers}
              </p>
              <ul className="py-1">
                {found.map((member) => (
                  <li key={member.userId}>
                    <Link
                      to={memberPath(member.userId)}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs text-fg-2 no-underline hover:bg-raised"
                    >
                      <AuthorAvatar author={member} size={24} />
                      {member.displayName ?? c.noName}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {text.trim().length >= SEARCH_MIN && (
            <button
              type="button"
              onClick={() => {
                onSearch(text.trim());
                setOpen(false);
              }}
              className="block w-full border-t border-line px-3 py-2 text-left text-xs text-primary hover:bg-raised"
            >
              {formatCopy(c.searchPostsFor, { q: text.trim() })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
