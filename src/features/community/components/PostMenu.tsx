import { Ban, Flag, Link2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Menu, type MenuItem } from '../../../components/ui/Menu';
import { useCopy } from '../../../hooks/use-copy';

/**
 * The ⋯ menu of a post: Edit and Delete for its author, Report for anyone
 * else (SRS 3.7.4: never on an own post), Block its author (D-99), and
 * Copy link.
 */
export function PostMenu({
  mine,
  onEdit,
  onDelete,
  onReport,
  onCopyLink,
  blockLabel,
  onBlock,
}: {
  mine: boolean;
  blockLabel?: string;
  onBlock?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
  onCopyLink: () => void;
}) {
  const c = useCopy().community;
  const items: MenuItem[] = mine
    ? [
        {
          id: 'edit',
          label: c.edit,
          icon: <Pencil size={13} />,
          onSelect: onEdit,
        },
        {
          id: 'delete',
          label: c.delete,
          icon: <Trash2 size={13} />,
          tone: 'danger',
          onSelect: onDelete,
        },
      ]
    : [
        {
          id: 'report',
          label: c.report,
          icon: <Flag size={13} />,
          onSelect: onReport,
        },
      ];
  if (blockLabel && onBlock)
    items.push({
      id: 'block',
      label: blockLabel,
      icon: <Ban size={13} />,
      tone: 'danger',
      onSelect: onBlock,
    });
  items.push({
    id: 'link',
    label: c.share,
    icon: <Link2 size={13} />,
    onSelect: onCopyLink,
  });
  return (
    <Menu
      label={c.actions}
      items={items}
      trigger={
        <span className="inline-flex size-8 items-center justify-center rounded-lg text-muted-dim hover:bg-raised hover:text-fg-2 pointer-coarse:size-10">
          <MoreHorizontal size={15} aria-hidden="true" />
        </span>
      }
    />
  );
}
