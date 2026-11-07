import { useState } from 'react';
import { MessageSquare, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import type { AiConversation } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import type { ChatAccent } from './ChatPanel';

type Group = 'today' | 'yesterday' | 'week' | 'older';
const GROUPS: readonly Group[] = ['today', 'yesterday', 'week', 'older'];
const DAY_MS = 86_400_000;

function groupOf(updatedAt: string, now: Date): Group {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const at = Date.parse(updatedAt);
  if (at >= midnight.getTime()) return 'today';
  if (at >= midnight.getTime() - DAY_MS) return 'yesterday';
  if (at >= midnight.getTime() - 6 * DAY_MS) return 'week';
  return 'older';
}

function timeOf(value: string) {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return pad(date.getHours()) + ':' + pad(date.getMinutes());
}

function dayOf(value: string) {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return pad(date.getDate()) + '/' + pad(date.getMonth() + 1);
}

const SELECTED: Record<ChatAccent, string> = {
  primary: 'bg-primary-soft',
  purple: 'bg-purple-soft',
};
const BADGE: Record<ChatAccent, string> = {
  primary: 'border-primary-line text-primary',
  purple: 'border-purple text-purple',
};
const START: Record<ChatAccent, string> = {
  primary: 'bg-primary',
  purple: 'bg-purple',
};

/**
 * The conversation list of one SCR-29 page: searchable, grouped by when it
 * was last asked (today, yesterday, this week, older), each with the coin
 * it is about; renaming and deleting show on hover or focus.
 */
export function ConversationList({
  heading,
  emptyHint,
  conversations,
  loading,
  selectedId,
  canStart,
  starting,
  accent = 'primary',
  badgeOf,
  onSelect,
  onStart,
  onRename,
  onDelete,
}: {
  heading: string;
  emptyHint: string;
  conversations: readonly AiConversation[];
  loading: boolean;
  selectedId: string | null;
  canStart: boolean;
  starting: boolean;
  accent?: ChatAccent;
  /** A short tag of what a conversation is about, e.g. BTC. */
  badgeOf?: (conversation: AiConversation) => string | null;
  onSelect: (id: string) => void;
  onStart: () => void;
  onRename: (conversation: AiConversation) => void;
  onDelete: (conversation: AiConversation) => void;
}) {
  const t = useCopy().aiAssistant;
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();
  const shown = conversations.filter(
    (conversation) =>
      needle === '' ||
      (conversation.title ?? t.untitled).toLowerCase().includes(needle),
  );
  const now = new Date();
  const label: Record<Group, string> = {
    today: t.groupToday,
    yesterday: t.groupYesterday,
    week: t.groupWeek,
    older: t.groupOlder,
  };

  return (
    <aside
      aria-label={heading}
      className="flex min-h-0 flex-col gap-3 rounded-2xl border border-line bg-surface px-2.5 py-3.5"
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="m-0 text-[13px] font-semibold text-fg">{heading}</h2>
        {/* Only the "+" fits beside the heading; hovering or focusing it names it. */}
        <div className="group relative shrink-0">
          <button
            type="button"
            aria-label={t.newConversation}
            onClick={onStart}
            disabled={!canStart || starting}
            className={classNames(
              'inline-flex size-8 items-center justify-center rounded-[9px] text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:size-11',
              START[accent],
            )}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-full right-0 z-20 mt-1.5 hidden rounded-md bg-fg px-2 py-1 text-[11px] font-medium whitespace-nowrap text-surface shadow-overlay group-hover:block group-has-[:focus-visible]:block"
          >
            {t.newConversation}
          </span>
        </div>
      </div>
      {conversations.length > 0 && (
        <label className="flex h-[34px] items-center gap-2 rounded-[9px] bg-surface-alt px-2.5 text-muted-dim focus-within:ring-2 focus-within:ring-primary-soft">
          <Search size={13} aria-hidden="true" />
          <span className="sr-only">{t.searchConversations}</span>
          <input
            type="search"
            value={search}
            placeholder={t.searchConversations}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent text-xs text-fg outline-none placeholder:text-muted-dim"
          />
        </label>
      )}
      {loading ? (
        <div className="grid gap-2">
          {[0, 1, 2].map((k) => (
            <Skeleton key={k} className="h-11 w-full" />
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="grid flex-1 content-center justify-items-center gap-2 px-3 py-8 text-center">
          <span
            aria-hidden="true"
            className="inline-flex size-10 items-center justify-center rounded-xl bg-surface-alt text-muted-dim"
          >
            <MessageSquare size={18} />
          </span>
          <p className="m-0 text-[13px] font-semibold text-fg">
            {t.noConversations}
          </p>
          <p className="m-0 text-xs leading-relaxed text-muted">{emptyHint}</p>
        </div>
      ) : shown.length === 0 ? (
        <p className="m-0 px-2 py-6 text-center text-xs text-muted">
          {t.noMatch}
        </p>
      ) : (
        <div className="-mx-0.5 grid min-h-0 grid-cols-[minmax(0,1fr)] content-start gap-0.5 overflow-y-auto px-0.5">
          {GROUPS.map((group) => {
            const rows = shown.filter(
              (conversation) => groupOf(conversation.updatedAt, now) === group,
            );
            if (rows.length === 0) return null;
            return (
              <section
                key={group}
                aria-label={label[group]}
                className="min-w-0"
              >
                <h3 className="m-0 mt-2 mb-1 px-1.5 text-[10.5px] font-semibold tracking-wider text-muted-dim uppercase first:mt-0">
                  {label[group]}
                </h3>
                <ul className="m-0 grid min-w-0 grid-cols-[minmax(0,1fr)] list-none gap-0.5 p-0">
                  {rows.map((conversation) => {
                    const selected = conversation.id === selectedId;
                    const title = conversation.title ?? t.untitled;
                    const badge = badgeOf?.(conversation) ?? null;
                    return (
                      <li
                        key={conversation.id}
                        className={classNames(
                          'group flex min-w-0 items-center gap-1 rounded-[9px] pr-1',
                          selected ? SELECTED[accent] : 'hover:bg-raised',
                        )}
                      >
                        <button
                          type="button"
                          aria-current={selected ? 'true' : undefined}
                          onClick={() => onSelect(conversation.id)}
                          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[9px] p-2 text-left"
                        >
                          <span
                            aria-hidden="true"
                            className={classNames(
                              'inline-flex size-7 shrink-0 items-center justify-center rounded-lg border text-[9.5px] font-bold',
                              selected
                                ? classNames('bg-surface', BADGE[accent])
                                : 'border-transparent bg-surface-alt text-muted',
                            )}
                          >
                            {badge ?? <MessageSquare size={13} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={classNames(
                                'block truncate text-[12.5px] text-fg',
                                selected ? 'font-semibold' : 'font-medium',
                              )}
                            >
                              {title}
                            </span>
                            <span className="block text-[11px] text-muted-dim">
                              {group === 'today' || group === 'yesterday'
                                ? timeOf(conversation.updatedAt)
                                : dayOf(conversation.updatedAt)}
                            </span>
                          </span>
                        </button>
                        <div
                          className={classNames(
                            'flex shrink-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100',
                            selected ? 'opacity-100' : 'opacity-0',
                          )}
                        >
                          <button
                            type="button"
                            aria-label={t.rename + ': ' + title}
                            title={t.rename}
                            onClick={() => onRename(conversation)}
                            className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-fg-2"
                          >
                            <Pencil size={13} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={t.delete + ': ' + title}
                            title={t.delete}
                            onClick={() => onDelete(conversation)}
                            className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-negative-soft hover:text-negative"
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </aside>
  );
}
