import { MessageSquare, Pencil, Plus, Trash2 } from 'lucide-react';
import { EmptyState } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import { IconButton } from '../../../components/ui/IconButton';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import type { AiConversation } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { formatInstantLocal } from '../../../utils/instant-format';

/** The conversation list of SCR-29: the latest first, each renamable and deletable. */
export function ConversationList({
  conversations,
  loading,
  selectedId,
  canStart,
  starting,
  onSelect,
  onStart,
  onRename,
  onDelete,
}: {
  conversations: readonly AiConversation[];
  loading: boolean;
  selectedId: string | null;
  canStart: boolean;
  starting: boolean;
  onSelect: (id: string) => void;
  onStart: () => void;
  onRename: (conversation: AiConversation) => void;
  onDelete: (conversation: AiConversation) => void;
}) {
  const t = useCopy().aiAssistant;
  return (
    <aside
      aria-label={t.conversations}
      className="flex min-h-0 flex-col gap-2 rounded-lg border border-line bg-surface p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-sm font-semibold text-fg">{t.conversations}</h2>
        <Button size="sm" onClick={onStart} disabled={!canStart || starting}>
          <Plus size={14} aria-hidden="true" />
          {t.newConversation}
        </Button>
      </div>
      {loading ? (
        <div className="grid gap-2">
          {[0, 1, 2].map((k) => (
            <Skeleton key={k} className="h-10 w-full" />
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={t.noConversations}
          description={t.noConversationsHint}
        />
      ) : (
        <ul className="m-0 grid list-none gap-1 overflow-y-auto p-0">
          {conversations.map((conversation) => {
            const selected = conversation.id === selectedId;
            return (
              <li
                key={conversation.id}
                className="group flex items-center gap-1"
              >
                <button
                  type="button"
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => onSelect(conversation.id)}
                  className={classNames(
                    'min-w-0 flex-1 rounded-md px-2 py-1.5 text-left',
                    selected
                      ? 'bg-primary-soft text-fg'
                      : 'text-fg-2 hover:bg-raised',
                  )}
                >
                  <span className="block truncate text-sm">
                    {conversation.title}
                  </span>
                  <span className="block text-[11px] text-muted-dim">
                    {formatInstantLocal(conversation.updatedAt)}
                  </span>
                </button>
                <IconButton
                  label={t.rename + ': ' + conversation.title}
                  icon={<Pencil size={13} aria-hidden="true" />}
                  onClick={() => onRename(conversation)}
                />
                <IconButton
                  label={t.delete + ': ' + conversation.title}
                  icon={<Trash2 size={13} aria-hidden="true" />}
                  onClick={() => onDelete(conversation)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
